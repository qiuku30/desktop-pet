// 主进程 SQLite 词库查询服务
//
// 使用 better-sqlite3（同步 API）查询 ECDICT 词库。
// 表结构：stardict (word, phonetic, definition, translation, pos, collins,
//                    oxford, tag, bnc, frq, exchange, detail, audio)

const Database = require('better-sqlite3');
const path = require('path');

// ── 模块级状态 ──

let db = null;

// prepared statements
let stmtLookup = null;
let stmtRandomExclude = null;

// ── 初始化 ──

/**
 * 初始化：打开 ecdict.db，创建查询用的 prepared statements。
 *
 * @param {string} dbPath - ecdict.db 的完整路径
 * @returns {boolean} 初始化成功返回 true
 */
function initWordDB(dbPath) {
  if (db) {
    // 幂等：重复调用先关闭旧连接
    closeWordDB();
  }

  try {
    db = new Database(dbPath, { readonly: true });

    // 只读优化：使用内存缓存
    db.pragma('cache_size = -8000'); // 8MB cache

    // 准备 prepared statements
    stmtLookup = db.prepare('SELECT * FROM stardict WHERE word = ?');
    stmtRandomExclude = db.prepare(
      'SELECT * FROM stardict WHERE word != ? AND word IS NOT NULL ORDER BY RANDOM() LIMIT ?'
    );

    console.log(`[word-service] 词库已打开: ${dbPath}`);
    return true;
  } catch (err) {
    console.error(`[word-service] 无法打开词库 ${dbPath}:`, err.message);
    db = null;
    return false;
  }
}

/**
 * 关闭数据库连接。
 */
function closeWordDB() {
  if (db) {
    try { db.close(); } catch (_) { /* ignore */ }
    db = null;
    stmtLookup = null;
    stmtRandomExclude = null;
  }
}

// ── 查询 ──

/**
 * 查找单个词的完整信息。
 *
 * @param {string} word - 单词拼写
 * @returns {Object|null} 词条对象，未找到返回 null
 */
function lookupWord(word) {
  if (!db || !word) return null;

  try {
    const row = stmtLookup.get(word.toLowerCase());
    return row ? normalizeRow(row) : null;
  } catch (err) {
    console.error(`[word-service] lookupWord("${word}") 失败:`, err.message);
    return null;
  }
}

/**
 * 批量查词。
 *
 * @param {string[]} words - 单词拼写数组
 * @returns {Object[]} 词条对象数组（找不到的词被过滤掉）
 */
function lookupWords(words) {
  if (!db || !words || !Array.isArray(words)) return [];

  // better-sqlite3 没有简单的 IN 参数绑定（参数数量可变），逐个查询
  // 对于 10-20 个词的批量查询，逐个查的性能足够
  const results = [];
  for (const word of words) {
    const entry = lookupWord(word);
    if (entry) {
      results.push(entry);
    }
  }
  return results;
}

/**
 * 生成选择题干扰项：从词库随机取 count 个词，排除 correctWord。
 *
 * @param {string} correctWord - 正确答案（不包含在结果中）
 * @param {number} count - 需要的干扰项数量（默认 3）
 * @returns {Object[]} 随机干扰词条数组
 */
function generateChoices(correctWord, count) {
  if (!db || !correctWord) return [];

  const n = count ?? 3;

  try {
    const rows = stmtRandomExclude.all(correctWord.toLowerCase(), n);
    return rows.map(normalizeRow);
  } catch (err) {
    console.error(`[word-service] generateChoices("${correctWord}", ${n}) 失败:`, err.message);
    return [];
  }
}

/**
 * 获取词库中单词总数。
 *
 * @returns {number}
 */
function getWordCount() {
  if (!db) return 0;
  try {
    return db.prepare('SELECT COUNT(*) as count FROM stardict').get().count;
  } catch (_) {
    return 0;
  }
}

/**
 * 搜索单词：同时匹配英文（前缀）和中文释义（包含）。
 * 返回最多 limit 条结果，按 Collins 星级 + 词频排序。
 */
function searchWords(query, limit = 20) {
  if (!db || !query || !query.trim()) return [];
  const q = query.trim();
  const hasChinese = /[一-鿿]/.test(q);
  const isSingleLetter = /^[a-z]$/i.test(q);

  let sql, params;
  if (hasChinese) {
    // 中文输入 → 只搜中文释义
    sql = `SELECT * FROM stardict WHERE translation LIKE @substr
           ORDER BY collins DESC, frq ASC LIMIT @limit`;
    params = { substr: '%' + q + '%', limit };
  } else if (isSingleLetter) {
    // 单字母 → 只搜英文前缀（%a% 在中文释义里噪声太大）
    sql = `SELECT * FROM stardict WHERE word LIKE @prefix
           ORDER BY length(word) ASC, collins DESC LIMIT @limit`;
    params = { prefix: q.toLowerCase() + '%', limit };
  } else {
    // 多字母英文 → 同时搜英文前缀 + 中文释义包含
    sql = `SELECT * FROM stardict
           WHERE word LIKE @prefix OR translation LIKE @substr
           ORDER BY collins DESC, frq ASC LIMIT @limit`;
    params = { prefix: q.toLowerCase() + '%', substr: '%' + q + '%', limit };
  }

  try {
    return db.prepare(sql).all(params).map(normalizeRow);
  } catch (err) {
    console.error(`[word-service] searchWords("${q}") 失败:`, err.message);
    return [];
  }
}

// ── 辅助 ──

/**
 * 将数据库行转为前端友好的对象格式。
 * ECDICT 某些字段可能以 JSON 字符串存储，尝试解析。
 */
function normalizeRow(row) {
  const result = { word: row.word };

  // 直接字段
  for (const key of ['phonetic', 'definition', 'translation', 'pos', 'tag', 'audio']) {
    if (row[key] != null && row[key] !== '') {
      result[key] = row[key];
    }
  }

  // exchange 字段可能是 JSON 字符串（如 '{"pl": "abaci"}'），尝试解析
  if (row.exchange && row.exchange !== '') {
    try {
      result.exchange = JSON.parse(row.exchange);
    } catch {
      result.exchange = row.exchange;
    }
  }

  // 数值字段（只用 >=0 的值）
  for (const key of ['collins', 'oxford', 'bnc', 'frq']) {
    if (row[key] != null && row[key] !== '' && row[key] !== 0) {
      result[key] = row[key];
    }
  }

  // detail 字段：保留原始字符串（可能含附加信息）
  if (row.detail && row.detail !== '') {
    result.detail = row.detail;
  }

  return result;
}

// ── 导出 ──

module.exports = {
  initWordDB,
  closeWordDB,
  lookupWord,
  lookupWords,
  generateChoices,
  getWordCount,
  searchWords,
};
