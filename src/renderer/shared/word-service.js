// FSRS 间隔重复算法 — 纯函数服务
//
// 不碰 PetState，不碰 DOM。所有函数接收参数、返回结果。
// 时间注入：scheduleReview 和 getStats 的 now 参数默认 Date.now()
//
// 参考：FSRS v5 (Free Spaced Repetition Scheduler)
// https://github.com/open-spaced-repetition/fsrs.js

// ── 默认参数（社区拟合值，后续 Phase 2 可用用户数据重新拟合）──

const FSRS_DEFAULTS = {
  requestRetention: 0.9,       // 目标保留率（90% 概率记住）
  maximumInterval: 365,        // 最大间隔（天），超过此值截断
  // FSRS 13 个可拟合参数：
  // w[0-3]: 初始稳定性（首次/学习/重学/预留）
  // w[4]: 初始难度
  // w[5]: 失败后难度增量
  // w[6]: 成功后难度减量
  // w[7-8]: 失败后稳定性保留因子
  // w[9-11]: 成功后稳定性增长因子
  // w[12]: 最大难度
  w: [1.0, 1.0, 5.0, -0.5, -0.5, 0.2, 1.4, -0.12, 0.8, 2.0, -0.2, 0.2, 1.0],
};

let params = { ...FSRS_DEFAULTS };

// ── 初始化 ──

/**
 * 初始化/重置 FSRS 参数。后续 Phase 2 可传入拟合后的自定义参数。
 * @param {Object} [customParams] - 部分或全部覆盖默认参数
 */
export function initFSRS(customParams) {
  if (customParams) {
    // 浅合并顶层，深拷贝 w 数组
    params = {
      ...FSRS_DEFAULTS,
      ...customParams,
      w: customParams.w ? [...customParams.w] : [...FSRS_DEFAULTS.w],
    };
  } else {
    params = { ...FSRS_DEFAULTS, w: [...FSRS_DEFAULTS.w] };
  }
}

/**
 * 获取当前参数快照（只读副本）
 */
export function getParams() {
  return { ...params, w: [...params.w] };
}

// ── 核心调度 ──

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 根据评分计算下次复习时间和新的稳定性/难度。
 *
 * @param {Object} word - 词条 FSRS 状态 { stability, difficulty, state, reps, lapses, lastReview }
 * @param {'good'|'again'} rating - 用户自评结果
 * @param {number} [now] - 当前时间戳（ms），默认 Date.now()
 * @returns {Object} { stability, difficulty, state, due, reps, lapses, lastReview }
 */
export function scheduleReview(word, rating, now) {
  const ts = now || Date.now();
  const currentS = word.stability ?? 0.5;
  const currentD = word.difficulty ?? params.w[4];
  const currentReps = word.reps ?? 0;
  const currentLapses = word.lapses ?? 0;
  const currentState = word.state || 'new';
  const lastReview = word.lastReview || null;

  if (rating === 'good') {
    // ── 正确：稳定性增长 ──

    // 计算当前可提取概率 R
    let R = 1.0;
    if (lastReview && currentS > 0) {
      const elapsedDays = (ts - new Date(lastReview).getTime()) / DAY_MS;
      if (elapsedDays > 0) {
        // R = exp(ln(retention) * elapsed / S)
        R = Math.exp(Math.log(params.requestRetention) * Math.max(elapsedDays, 0) / Math.max(currentS, 0.01));
      }
    }

    // 难度微降（越熟越简单）
    const newD = Math.max(0, currentD - params.w[6]);

    // 稳定性增长
    // S' = S * (1 + c1 * (11 - D) * S^(-w[9]) * (exp((1 - R) * w[10]) - 1))
    const c1 = Math.exp(params.w[8]);
    const hardPenalty = (11 - newD);
    const stabilityDecay = Math.pow(currentS, -params.w[9]);
    const retrievabilityGain = Math.exp((1 - R) * params.w[10]) - 1;

    const growthFactor = 1 + c1 * hardPenalty * stabilityDecay * retrievabilityGain;
    let newS = currentS * growthFactor;

    // 截断到最大间隔
    newS = Math.min(newS, params.maximumInterval);

    const dueDate = new Date(ts + newS * DAY_MS);

    return {
      ...word,
      stability: round3(newS),
      difficulty: round3(newD),
      state: 'review',
      due: dueDate.toISOString(),
      reps: currentReps + 1,
      lapses: currentLapses,
      lastReview: new Date(ts).toISOString(),
    };
  }

  // ── 错误：稳定性重置 ──
  // rating === 'again'

  // 难度增加
  const newD = Math.min(currentD + params.w[5], params.w[12]);

  // 稳定性重置：根据当前状态选择初始值
  // w[0] for new->first fail, w[2] for relearning
  let newS;
  if (currentState === 'new' || currentState === 'learning') {
    newS = params.w[0];
  } else {
    // review 或 relearning 状态失败 → 用 w[2]（relearning 初始稳定性）
    newS = params.w[2];
  }

  // 间隔重置为 1 天
  const dueDate = new Date(ts + 1 * DAY_MS);

  return {
    ...word,
    stability: round3(newS),
    difficulty: round3(newD),
    state: 'relearning',
    due: dueDate.toISOString(),
    reps: 0,
    lapses: currentLapses + 1,
    lastReview: new Date(ts).toISOString(),
  };
}

// ── 新词首次学习 ──

/**
 * 新词首次学习后，创建初始 FSRS 状态对象。
 * stability ≈ 0.5 天，due 为当天稍晚。
 *
 * @param {string} word - 单词拼写
 * @param {string} sourceBank - 来源词库 id
 * @param {number} [now] - 当前时间戳
 * @returns {Object} FSRS 状态对象
 */
export function initLearnedWord(word, sourceBank, now) {
  const ts = now || Date.now();
  const initialS = 0.001; // 约 1.4 分钟后即可复习
  const dueDate = new Date(ts + initialS * DAY_MS);

  return {
    stability: initialS,
    difficulty: params.w[4],
    state: 'review',
    due: dueDate.toISOString(),
    reps: 1,
    lapses: 0,
    lastReview: new Date(ts).toISOString(),
    isFavorited: false,
    sourceBank,
  };
}

// ── 到期筛选 ──

/**
 * 返回所有到期（due <= now）的词条。
 * 按 stability 升序排列（越不稳定的越先复习）。
 *
 * @param {Object} words - { [word]: fsrsState }
 * @param {number} [now] - 当前时间戳
 * @returns {Array<{word: string, state: Object}>}
 */
export function getDueWords(words, now) {
  if (!words || typeof words !== 'object') return [];
  const ts = now || Date.now();

  return Object.entries(words)
    .filter(([, state]) => {
      if (!state.due) return false;
      return new Date(state.due).getTime() <= ts;
    })
    .sort((a, b) => (a[1].stability || 0) - (b[1].stability || 0))
    .map(([word, state]) => ({ word, state }));
}

// ── 新词选取 ──

/**
 * 从词库索引中取 count 个未学的新词（排除 alreadyLearned 中的词）。
 * 简单随机打乱后取前 count 个。
 *
 * @param {string[]} bankWords - 词库中的所有单词拼写
 * @param {number} count - 需要的新词数量
 * @param {Set<string>} alreadyLearned - 已学词集合
 * @returns {string[]} 选中的新词拼写数组
 */
export function getNextNewWords(bankWords, count, alreadyLearned) {
  const learned = alreadyLearned instanceof Set
    ? alreadyLearned
    : new Set(alreadyLearned);

  if (count <= 0) return [];

  const candidates = bankWords.filter(w => !learned.has(w));

  if (candidates.length === 0) return [];

  // Fisher-Yates 部分洗牌：只洗前 min(count, candidates.length) 个位置
  const n = Math.min(count, candidates.length);
  const shuffled = [...candidates];

  for (let i = shuffled.length - 1; i >= shuffled.length - n; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(-n);
}

// ── 统计 ──

/**
 * 计算学习统计数据。
 *
 * @param {Object} wordProgress - PetState 中的 wordProgress 对象
 *   { words: { [word]: fsrsState }, streak: { current, lastStudyDate } }
 * @param {number} [now] - 当前时间戳
 * @returns {{ totalWords: number, learnedToday: number, dueCount: number,
 *             streak: number, totalReviews: number, accuracy: number|null }}
 */
export function getStats(wordProgress, now) {
  if (!wordProgress) {
    return { totalWords: 0, learnedToday: 0, dueCount: 0, streak: 0, totalReviews: 0, accuracy: null };
  }
  const ts = now || Date.now();
  const words = wordProgress.words || {};
  const entries = Object.entries(words);

  // 已学单词总数（state !== 'new'）
  const totalWords = entries.filter(([, s]) => s.state && s.state !== 'new').length;

  // 今日学习数：lastReview 为今天的词
  const todayStr = new Date(ts).toISOString().slice(0, 10);
  const learnedToday = entries.filter(([, s]) => {
    if (!s.lastReview) return false;
    return s.lastReview.slice(0, 10) === todayStr;
  }).length;

  // 到期数
  const dueCount = entries.filter(([, s]) => {
    if (!s.due) return false;
    return new Date(s.due).getTime() <= ts;
  }).length;

  // 连续天数
  const streak = wordProgress.streak?.current || 0;

  // 总复习次数
  const totalReviews = entries.reduce((sum, [, s]) => sum + (s.reps || 0), 0);

  // 正确率：全量 reps > 0 中 reps / (reps + lapses)
  let accuracy = null;
  let totalAttempts = 0;
  let totalCorrect = 0;
  for (const [, s] of entries) {
    const r = s.reps || 0;
    const l = s.lapses || 0;
    if (r + l > 0) {
      totalAttempts += r + l;
      totalCorrect += r;
    }
  }
  if (totalAttempts > 0) {
    accuracy = Math.round((totalCorrect / totalAttempts) * 100) / 100;
  }

  return {
    totalWords,
    learnedToday,
    dueCount,
    streak,
    totalReviews,
    accuracy,
  };
}

// ── 辅助 ──

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
