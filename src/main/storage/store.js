// 统一数据存取层
// 唯一直接读写 JSON 文件的地方
// 所有数据存取都必须经过此文件

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

let dataPath = null;

// 默认宠物状态
const DEFAULT_STATE = {
  level: 1,
  exp: 0,
  mood: 70,            // 0-100 数值心情（infra-10: 从 string 升级）
  satiety: 100,        // 0+，越高越饱，随时间下降
  intimacy: 0,         // 亲密度
  coins: 0,
  foodInventory: [],   // 食物库存
  zoomLevel: 1.0,      // 窗口缩放倍率（0.75 / 1.0 / 1.25 / 1.5）
  dailyInteractionCount: 0,    // 今日互动次数
  lastInteractionDate: null,   // 上次互动日期（YYYY-MM-DD）
  lastSatietyUpdate: null,     // 上次饱腹值结算时间戳（ISO 字符串）
  lastMoodUpdate: null,         // 上次心情衰减结算时间戳（ISO 字符串）
  lastMoodDecayDate: null,      // 上次心情衰减日期（YYYY-MM-DD），用于跨天重置
  todayMoodDecay: 0,            // 今日已累计心情衰减量
  dailyMoodClicks: 0,           // 今日心情点击次数
  lastMoodClickDate: null,      // 上次心情点击日期（YYYY-MM-DD）
  lastSaved: null,
};

// ── 初始化 ──
async function initStore() {
  dataPath = path.join(app.getPath('userData'), 'pet-data.json');

  try {
    await fs.access(dataPath);
  } catch {
    // 文件不存在，创建默认数据
    await fs.writeFile(dataPath, JSON.stringify(DEFAULT_STATE, null, 2), 'utf-8');
  }
}

// ── 读取 ──
async function getState() {
  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

// ── 写入 ──
async function setState(data) {
  data.lastSaved = new Date().toISOString();
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { initStore, getState, setState };
