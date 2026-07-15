// 饱腹值消耗服务（纯函数，配置驱动，不碰 PetState）
// 职责：衰减结算、主动消耗、最大饱腹值计算、心情建议。
// 调用方负责从 PetState 读写状态，satiety-service 只做计算。
//
// 设计决策（infra-08）：
// - 时间戳差值结算：避免高频定时器，离线也生效
// - 最大饱腹值随等级增长：每 5 级 +20（Lv1-4=100, Lv5-9=120, ..., Lv25-29=200, Lv30=220）
// - 心情建议不直接改 PetState：保持纯函数风格，与 feed-service / exp-service 一致

// ── 配置 ──
export const SATIETY_CONFIG = {
  decayPerMinute: 0.2,         // 每分钟衰减量（100→0 ≈ 8.3h）
  hungerThreshold: 30,         // 低于此值建议 mood='hungry'
  onlineTickMs: 60000,         // 在线结算间隔（毫秒）
  baseMaxSatiety: 100,         // 基础最大饱腹值（Lv1）
  maxSatietyPer5Levels: 20,    // 每 5 级增加的最大饱腹值
}

// ── 最大饱腹值（随等级增长）──
// 公式：100 + floor(level / 5) × 20
// Lv1-4→100, Lv5-9→120, Lv10-14→140, Lv15-19→160, Lv20-24→180, Lv25-29→200, Lv30→220
export function calcMaxSatiety(level) {
  const { baseMaxSatiety, maxSatietyPer5Levels } = SATIETY_CONFIG
  return baseMaxSatiety + Math.floor(level / 5) * maxSatietyPer5Levels
}

// ── 计算衰减量 ──
// lastUpdate: 上次结算时间戳（ISO 字符串），null 表示无记录
// now: 当前时间戳（ISO 字符串），默认当前时间
// 返回应扣除的饱腹值（正数，可能带小数）
export function calcDecay(lastUpdate, now = new Date().toISOString()) {
  if (!lastUpdate) return 0
  const diffMs = new Date(now) - new Date(lastUpdate)
  if (diffMs <= 0) return 0
  const minutes = diffMs / 60000
  return minutes * SATIETY_CONFIG.decayPerMinute
}

// ── 主动消耗饱腹值 ──
// 统一接口：所有需要消耗饱腹值的地方（如游戏惩罚、活动消耗等）走此函数。
// satiety: 当前饱腹值
// amount: 消耗量（正数）
// 返回新饱腹值，最低 0
export function reduceSatiety(satiety, amount) {
  return Math.max(0, satiety - amount)
}

// ── 心情建议 ──
// 纯计算：根据饱腹值和当前心情，返回建议的心情。
// suggestMood() 已移除（infra-10 后心情改用 mood-service.js 的 boostMood/reduceMood，不再用旧 string 模式）
