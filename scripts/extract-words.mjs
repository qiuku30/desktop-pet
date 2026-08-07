#!/usr/bin/env node
// ECDICT 提取脚本
//
// 功能：
// 1. 从 ECDICT CSV 中按考试 tag 筛选词条 → 生成 word-banks/*.json 索引文件
// 2. 创建精简 SQLite 数据库（只含考试词库相关词条，约 20000 条）
// 3. 验证所有索引中的词在 SQLite 中有对应记录
//
// 用法：
//   node scripts/extract-words.mjs [ecdict.csv 路径]
//   默认从 /tmp/ecdict.csv 读取

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// ── 配置 ──

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const BANKS = {
  cet4: { id: 'cet4', name: 'CET-4 四级', icon: '\u{1F4D7}', tag: 'cet4' },
  cet6: { id: 'cet6', name: 'CET-6 六级', icon: '\u{1F4D8}', tag: 'cet6' },
  postgrad: { id: 'postgrad', name: '考研', icon: '\u{1F4D9}', tag: 'ky' },
  ielts: { id: 'ielts', name: '雅思', icon: '\u{1F4D5}', tag: 'ielts' },
  toefl: { id: 'toefl', name: 'TOEFL', icon: '\u{1F4D3}', tag: 'toefl' },
};

const CSV_PATH = process.argv[2] || '/tmp/ecdict.csv';
const OUTPUT_DIR = join(PROJECT_ROOT, 'src', 'renderer', 'assets', 'word-banks');
const DB_OUTPUT = join(PROJECT_ROOT, 'ecdict.db');

// ── CSV 列名（ECdict 标准格式）──
const COLUMNS = [
  'word', 'phonetic', 'definition', 'translation', 'pos',
  'collins', 'oxford', 'tag', 'bnc', 'frq', 'exchange', 'detail', 'audio',
];

// ── 主流程 ──

async function main() {
  console.log('=== ECDICT 词库提取 ===');
  console.log(`CSV 路径: ${CSV_PATH}`);
  console.log(`输出目录: ${OUTPUT_DIR}`);
  console.log(`数据库:   ${DB_OUTPUT}\n`);

  // 检查 CSV 文件
  if (!existsSync(CSV_PATH)) {
    console.error(`❌ CSV 文件不存在: ${CSV_PATH}`);
    console.error('   请先下载: curl -L -o /tmp/ecdict.csv \\');
    console.error('     "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"');
    process.exit(1);
  }

  // 确保输出目录存在
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 1: 解析 CSV，收集各词库的词条
  console.log('📖 正在解析 CSV...');
  const bankWords = {
    cet4: new Set(),
    cet6: new Set(),
    postgrad: new Set(),
    ielts: new Set(),
    toefl: new Set(),
  };
  // allEntries: 所有考试词条的完整信息（用于建 SQLite）
  // key: word (小写), value: 完整的 CSV 行对象
  const allEntries = new Map();

  let totalLines = 0;
  let matchedLines = 0;
  let parseErrors = 0;

  const rl = createInterface({
    input: createReadStream(CSV_PATH, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let isHeader = true;

  for await (const line of rl) {
    totalLines++;

    if (isHeader) {
      isHeader = false;
      continue;
    }

    // 解析 CSV 行（处理逗号分隔和引号包裹）
    const row = parseCSVLine(line);
    if (!row || row.length < 4) {
      parseErrors++;
      continue;
    }

    const word = row[0]?.trim().toLowerCase();
    const tag = row[7]?.trim() || '';
    const translation = row[3]?.trim() || '';

    if (!word || !translation) continue;

    // 检查是否匹配任何考试词库
    const matchedBanks = [];
    for (const [bankId, bank] of Object.entries(BANKS)) {
      if (hasTag(tag, bank.tag)) {
        bankWords[bankId].add(word);
        matchedBanks.push(bankId);
      }
    }

    if (matchedBanks.length > 0) {
      matchedLines++;

      // 构建词条对象（去重：同一个词可能出现在多行中）
      if (!allEntries.has(word)) {
        const entry = {};
        for (let i = 0; i < COLUMNS.length; i++) {
          entry[COLUMNS[i]] = (row[i] || '').trim();
        }
        entry.word = word; // 确保小写
        allEntries.set(word, entry);
      }
    }

    // 进度提示（每 100000 行）
    if (totalLines % 100000 === 0) {
      console.log(`   已处理 ${totalLines} 行，匹配 ${matchedLines} 条，已收集 ${allEntries.size} 个词条`);
    }
  }

  console.log(`   总计 ${totalLines} 行，匹配 ${matchedLines} 条考试词条，去重后 ${allEntries.size} 个唯一词\n`);

  // Step 2: 生成 word-banks JSON 文件
  console.log('📝 正在生成词库索引文件...');
  for (const [bankId, bank] of Object.entries(BANKS)) {
    const words = [...bankWords[bankId]].sort();
    const json = {
      id: bank.id,
      name: bank.name,
      icon: bank.icon,
      count: words.length,
      words,
    };

    const filePath = join(OUTPUT_DIR, `${bankId}.json`);
    writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
    console.log(`   ✅ ${bankId}.json — ${words.length} 个词条`);
  }

  // Step 3: 创建 SQLite 数据库
  console.log('\n🗄️  正在创建 SQLite 数据库...');
  createDatabase(DB_OUTPUT, allEntries);

  // Step 4: 验证
  console.log('\n🔍 正在验证索引与数据库的一致性...');
  validate(DB_OUTPUT, bankWords);

  // 汇总
  console.log('\n=== 提取完成 ===');
  const totalUnique = [...new Set(
    Object.values(bankWords).flatMap(s => [...s])
  )].length;
  console.log(`考试词库总词条（去重）: ${totalUnique}`);
  console.log(`SQLite 词条数: ${allEntries.size}`);
  console.log(`输出目录: ${OUTPUT_DIR}`);

  // 关闭 readline
  rl.close();
}

// ── 辅助函数 ──

/**
 * 检查 tag 字段是否包含指定考试标签。
 * tag 值如 "cet4 cet6 ky" — 空格分隔的标签列表。
 */
function hasTag(tagField, targetTag) {
  if (!tagField) return false;
  const tags = new Set(tagField.toLowerCase().split(/\s+/).filter(Boolean));
  return tags.has(targetTag.toLowerCase());
}

/**
 * 简单 CSV 行解析器（处理逗号分隔和引号包裹）。
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // 转义引号 ""
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current); // 最后一个字段
  return result;
}

/**
 * 创建 SQLite 数据库。
 */
function createDatabase(dbPath, entries) {
  // 删除旧文件
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const db = new Database(dbPath);

  // 建表
  db.exec(`
    CREATE TABLE stardict (
      word        TEXT PRIMARY KEY,
      phonetic    TEXT,
      definition  TEXT,
      translation TEXT,
      pos         TEXT,
      collins     INTEGER,
      oxford      INTEGER,
      tag         TEXT,
      bnc         INTEGER,
      frq         INTEGER,
      exchange    TEXT,
      detail      TEXT,
      audio       TEXT
    );
    CREATE INDEX idx_stardict_word ON stardict(word);
  `);

  // 插入数据
  const insert = db.prepare(`
    INSERT INTO stardict (word, phonetic, definition, translation, pos,
      collins, oxford, tag, bnc, frq, exchange, detail, audio)
    VALUES (@word, @phonetic, @definition, @translation, @pos,
      @collins, @oxford, @tag, @bnc, @frq, @exchange, @detail, @audio)
  `);

  const insertMany = db.transaction((entries) => {
    for (const entry of entries) {
      insert.run({
        word: entry.word,
        phonetic: entry.phonetic || null,
        definition: entry.definition || null,
        translation: entry.translation || null,
        pos: entry.pos || null,
        collins: toInt(entry.collins),
        oxford: toInt(entry.oxford),
        tag: entry.tag || null,
        bnc: toInt(entry.bnc),
        frq: toInt(entry.frq),
        exchange: entry.exchange || null,
        detail: entry.detail || null,
        audio: entry.audio || null,
      });
    }
  });

  insertMany([...entries.values()]);
  db.close();

  console.log(`   ✅ 数据库已创建: ${dbPath}`);
  console.log(`   📊 ${entries.size} 条记录`);
}

function toInt(val) {
  if (val == null || val === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

/**
 * 验证索引文件中的所有词在 SQLite 中都有记录。
 */
function validate(dbPath, bankWords) {
  const db = new Database(dbPath, { readonly: true });
  const lookup = db.prepare('SELECT word FROM stardict WHERE word = ?');

  let totalChecked = 0;
  let missingCount = 0;
  const missing = [];

  for (const [bankId, words] of Object.entries(bankWords)) {
    for (const word of words) {
      totalChecked++;
      const row = lookup.get(word);
      if (!row) {
        missingCount++;
        missing.push(`[${bankId}] ${word}`);
      }
    }
  }

  db.close();

  console.log(`   检查了 ${totalChecked} 个词条`);
  if (missingCount === 0) {
    console.log('   ✅ 所有索引词条在数据库中均有对应记录');
  } else {
    console.log(`   ⚠️  ${missingCount} 个词条在数据库中缺失：`);
    for (const m of missing.slice(0, 20)) {
      console.log(`      ${m}`);
    }
    if (missing.length > 20) {
      console.log(`      ... 还有 ${missing.length - 20} 个`);
    }
  }
}

// ── 入口 ──

main().catch(err => {
  console.error('❌ 脚本执行失败:', err);
  process.exit(1);
});
