// 番茄钟 — 纯模块，不依赖 index.js 的变量
// 状态机：idle → focus → break → focus → ... 无限循环
// 计时器每秒 tick，面板开关不影响计时
// 退出 App 直接重置，下次启动需用户手动开始

const { Notification } = require('electron');

// ── 模块内部状态（内存，不持久化）──
let mainWindow = null;
let store = null;
let timerId = null;

let phase = 'idle';       // 'idle' | 'focus' | 'break'
let remainingS = 0;
let isPaused = false;

// ── 统计（从 store 加载，变更时写回）──
let stats = {
  todayCount: 0,
  todayFocusMs: 0,           // 今日累计专注毫秒
  todayDate: null,           // YYYY-MM-DD
  totalCount: 0,
  totalFocusMs: 0,           // 总计专注毫秒
  streakDays: 0,
  lastCompletedDate: null,   // YYYY-MM-DD
  dailyLog: {},              // { 'YYYY-MM-DD': { count, focusMs } }
};

// ── 设置（从 store 加载）──
let settings = {
  focusMin: 25,
  breakMin: 5,
};

// ── 工具 ──
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tryNotify(title, body) {
  try {
    new Notification({ title, body }).show();
  } catch (_) {
    // 静默失败
  }
}

function pushToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ── 持久化 ──
async function loadFromStore() {
  try {
    const state = await store.getState();
    if (state.pomodoroStats) {
      const s = state.pomodoroStats;
      stats = {
        todayCount: s.todayCount ?? 0,
        todayFocusMs: s.todayFocusMs ?? 0,
        todayDate: s.todayDate ?? null,
        totalCount: s.totalCount ?? 0,
        totalFocusMs: s.totalFocusMs ?? 0,
        streakDays: s.streakDays ?? 0,
        lastCompletedDate: s.lastCompletedDate ?? null,
        dailyLog: (s.dailyLog && typeof s.dailyLog === 'object' && !Array.isArray(s.dailyLog))
          ? { ...s.dailyLog }
          : {},
      };
    }
    if (state.settings) {
      const fMin = state.settings.pomodoroFocusMin ?? 25;
      const bMin = state.settings.pomodoroBreakMin ?? 5;
      settings.focusMin = Math.min(120, Math.max(5, fMin));
      settings.breakMin = Math.min(60, Math.max(1, bMin));
    }
  } catch (_) {
    // store 读取失败，用默认值
  }
}

async function saveStats() {
  try {
    // 清理 dailyLog 中超过 365 天的记录
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

    const cleaned = {};
    for (const [date, entry] of Object.entries(stats.dailyLog)) {
      if (date >= cutoffStr) {
        cleaned[date] = entry;
      }
    }
    stats.dailyLog = cleaned;

    const state = await store.getState();
    state.pomodoroStats = { ...stats };
    await store.setState(state);
  } catch (_) {
    // 静默失败
  }
}

async function saveSettings() {
  try {
    const state = await store.getState();
    if (!state.settings) state.settings = {};
    state.settings.pomodoroFocusMin = settings.focusMin;
    state.settings.pomodoroBreakMin = settings.breakMin;
    await store.setState(state);
  } catch (_) {
    // 静默失败
  }
}

// ── 统计计数 ──
function countPomodoro() {
  const today = getToday();
  const focusMs = settings.focusMin * 60 * 1000;

  // 跨天重置今日计数
  if (stats.todayDate !== today) {
    stats.todayDate = today;
    stats.todayCount = 0;
    stats.todayFocusMs = 0;
  }

  stats.todayCount++;
  stats.todayFocusMs += focusMs;
  stats.totalCount++;
  stats.totalFocusMs += focusMs;

  // dailyLog
  if (!stats.dailyLog[today]) {
    stats.dailyLog[today] = { count: 0, focusMs: 0 };
  }
  stats.dailyLog[today].count++;
  stats.dailyLog[today].focusMs += focusMs;

  // 连续天数
  if (stats.lastCompletedDate === today) {
    // 同一天多次完成，streak 不变
  } else if (stats.lastCompletedDate === getYesterday()) {
    stats.streakDays++;
  } else {
    stats.streakDays = 1;
  }
  stats.lastCompletedDate = today;

  // 异步持久化（不阻塞 phase 切换）
  saveStats();
}

// ── phase 切换 ──
function switchPhase() {
  if (phase === 'focus') {
    // 专注 → 休息
    tryNotify('🍅 专注完成！', '该休息一下啦～☕');
    phase = 'break';
    remainingS = settings.breakMin * 60;
    isPaused = false;
  } else if (phase === 'break') {
    // 休息 → 专注（计一个番茄）
    countPomodoro();
    tryNotify('☕ 休息结束', '继续加油！💪');
    phase = 'focus';
    remainingS = settings.focusMin * 60;
    isPaused = false;
  }

  pushToRenderer('pomodoro:phase:changed', { phase, stats: getPublicStats() });
  pushToRenderer('pomodoro:tick', { phase, remainingS, isPaused });
}

// ── 计时器 tick ──
function tick() {
  if (phase !== 'idle' && !isPaused) {
    remainingS--;
    if (remainingS <= 0) {
      switchPhase();
      return;
    }
  }

  if (phase !== 'idle') {
    pushToRenderer('pomodoro:tick', { phase, remainingS, isPaused });
  }
}

function startTimer() {
  if (timerId) clearInterval(timerId);
  timerId = setInterval(tick, 1000);
}

// ── 对外接口 ──

// 对外 stats（不含 dailyLog，避免大对象泄漏到渲染进程）
function getPublicStats() {
  return {
    todayCount: stats.todayCount,
    todayFocusMs: stats.todayFocusMs,
    todayDate: stats.todayDate,
    totalCount: stats.totalCount,
    totalFocusMs: stats.totalFocusMs,
    streakDays: stats.streakDays,
    lastCompletedDate: stats.lastCompletedDate,
  };
}

function getPomodoroState() {
  return {
    phase,
    remainingS,
    isPaused,
    stats: getPublicStats(),
    settings: { focusMin: settings.focusMin, breakMin: settings.breakMin },
  };
}

function handleCommand(action) {
  switch (action) {
    case 'start':
      if (phase !== 'idle') return;
      phase = 'focus';
      remainingS = settings.focusMin * 60;
      isPaused = false;
      pushToRenderer('pomodoro:phase:changed', { phase, stats: getPublicStats() });
      break;

    case 'pause':
      if (phase === 'idle' || isPaused) return;
      isPaused = true;
      break;

    case 'resume':
      if (phase === 'idle' || !isPaused) return;
      isPaused = false;
      break;

    case 'skip':
      if (phase === 'idle') return;
      if (phase === 'focus') {
        // 跳过专注 → 休息，不计数
        phase = 'break';
        remainingS = settings.breakMin * 60;
        isPaused = false;
      } else if (phase === 'break') {
        // 跳过休息 → 专注
        phase = 'focus';
        remainingS = settings.focusMin * 60;
        isPaused = false;
      }
      pushToRenderer('pomodoro:phase:changed', { phase, stats: getPublicStats() });
      break;

    case 'abort':
      if (phase !== 'focus') return;
      // 放弃专注 → 重置为 idle，不计数
      phase = 'idle';
      remainingS = 0;
      isPaused = false;
      pushToRenderer('pomodoro:phase:changed', { phase, stats: getPublicStats() });
      break;

    case 'end':
      if (phase !== 'break') return;
      // 结束休息 → 计一个番茄，进入专注
      countPomodoro();
      phase = 'focus';
      remainingS = settings.focusMin * 60;
      isPaused = false;
      pushToRenderer('pomodoro:phase:changed', { phase, stats: getPublicStats() });
      break;

    default:
      return;
  }

  // 每次命令后推送最新 tick 状态
  if (phase !== 'idle') {
    pushToRenderer('pomodoro:tick', { phase, remainingS, isPaused });
  }
}

async function updateSettings({ focusMin, breakMin }) {
  // 仅 idle 时生效
  if (phase !== 'idle') return;

  if (typeof focusMin === 'number' && focusMin >= 5 && focusMin <= 120) {
    settings.focusMin = focusMin;
  }
  if (typeof breakMin === 'number' && breakMin >= 1 && breakMin <= 60) {
    settings.breakMin = breakMin;
  }

  await saveSettings();
}

async function initPomodoro(win, str) {
  mainWindow = win;
  store = str;
  await loadFromStore();
  startTimer();
}

module.exports = { getPomodoroState, handleCommand, updateSettings, initPomodoro };
