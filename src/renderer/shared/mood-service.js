// 心情系统服务（纯函数，配置驱动，不碰 PetState）
// 职责：数值计算、衰减结算（按自然日分段 + 单日 50 点上限）、加成倍率、数据迁移。
// 调用方负责从 PetState 读写状态，mood-service 只做计算。
//
// 设计决策（infra-10）：
// - 心情从 string 字段升级为独立 0-100 数值系统
// - 自然衰减：饱腹 ≥ 30 → 1/15 点/分钟；饱腹 < 30 → 2/15 点/分钟（翻倍）
// - 单日上限 50 点，按自然日零点点重置（对齐 exp-service 每日重置逻辑）
// - 离线结算按自然日分界切段，每一天单独 apply 50 点上限
// - 心情影响经验倍率：≥80→1.2, 50-79→1.0, <30→0.7
// - migrateMood 支持旧 string 存档 → 新 number 格式

// ── 配置 ──
export const MOOD_CONFIG = {
  // 数值范围
  maxMood: 100,
  minMood: 0,
  initialMood: 70,

  // 自然衰减（每分钟）
  decayPerMinute: 1 / 15,        // 饱腹 ≥ 30：每 15 分钟降 1 点
  decayPerMinuteHungry: 2 / 15,  // 饱腹 < 30：翻倍，每 7.5 分钟降 1 点
  dailyDecayCap: 50,             // 单日自然衰减上限
  hungerAccelThreshold: 30,      // 饱腹低于此值触发加速衰减

  // 提升途径
  clickBoost: 2,                 // 点击互动/抚摸 +2
  clickDailyCap: 20,             // 互动每日上限
  feedBoost: 3,                  // 喂食普通食物 +3
  playBoost: 10,                 // 小游戏 +10（预留）
  playDailyCap: 30,              // 小游戏每日上限（预留）

  // 经验加成
  expBonusHigh: 1.2,             // 心情 ≥ 80 → 经验 ×1.2
  expBonusNormal: 1.0,           // 心情 50-79 → 正常
  expPenaltyLow: 0.7,            // 心情 < 30 → 经验 ×0.7

  // 互动反馈
  clickBoostLowPenalty: 0.5,     // 低心情时互动回复量减半
}

// ── 档位配置 ──
export const MOOD_TIERS = [
  { tier: 'happy',   label: '开心', min: 80, max: 100, emoji: '😊' },
  { tier: 'good',    label: '良好', min: 50, max: 80,  emoji: '🙂' },
  { tier: 'neutral', label: '一般', min: 30, max: 50,  emoji: '😐' },
  { tier: 'low',     label: '低落', min: 0,  max: 30,  emoji: '😢' },
]

// ── clamp 到 0-100 ──
export function clampMood(mood) {
  return Math.max(MOOD_CONFIG.minMood, Math.min(MOOD_CONFIG.maxMood, mood))
}

// ── 根据数值返回对应档位对象 ──
export function getMoodTier(mood) {
  for (const tier of MOOD_TIERS) {
    if (mood >= tier.min && mood <= tier.max) {
      return { ...tier }
    }
  }
  return { ...MOOD_TIERS[MOOD_TIERS.length - 1] }
}

// ── 获取某天零点（本地时间）的 Date 对象 ──
function getLocalMidnight(date) {
  const d = new Date(date)
  d.setHours(24, 0, 0, 0)
  return d
}

// ── 计算衰减量 ──
// 按自然日（本地 00:00）分界切段，每一天单独 apply 50 点上限。
//
// lastUpdate: 上次结算时间戳（ISO 字符串），null 表示无记录（首次启动）
// now: 当前时间戳（ISO 字符串）
// isHungry: 饱腹是否低于阈值（true → 2/15 速率，false → 1/15 速率）
// todayAccumulatedDecay: 当日已累计衰减量（当前自然日零点至今已扣的衰减）
//
// 返回应扣除的心情值（正数），调用方用 reduceMood 扣减。
export function calcMoodDecay(lastUpdate, now, isHungry, todayAccumulatedDecay = 0) {
  if (!lastUpdate) return 0

  const startTime = new Date(lastUpdate)
  const endTime = new Date(now)
  if (endTime <= startTime) return 0

  const rate = isHungry
    ? MOOD_CONFIG.decayPerMinuteHungry   // 2/15
    : MOOD_CONFIG.decayPerMinute          // 1/15

  let totalDecay = 0
  let current = new Date(startTime)
  // 段 1 的当日额度：从 todayAccumulatedDecay 开始消耗
  let todaysRemainingQuota = Math.max(0, MOOD_CONFIG.dailyDecayCap - todayAccumulatedDecay)

  while (current < endTime) {
    // 下一个自然日零点（本地时间）
    const nextMidnight = getLocalMidnight(current)
    const segmentEnd = nextMidnight <= endTime ? nextMidnight : endTime

    const segmentMinutes = (segmentEnd - current) / 60000
    if (segmentMinutes > 0) {
      const rawDecay = segmentMinutes * rate
      const effectiveDecay = Math.min(rawDecay, todaysRemainingQuota)
      totalDecay += effectiveDecay
    }

    // 跨入下一天：重置当日额度为满额 50
    current = segmentEnd
    todaysRemainingQuota = MOOD_CONFIG.dailyDecayCap
  }

  return totalDecay
}

// ── 减少心情（最低 0）──
export function reduceMood(mood, amount) {
  return Math.max(MOOD_CONFIG.minMood, mood - amount)
}

// ── 增加心情（最高 100）──
export function boostMood(mood, amount) {
  return Math.min(MOOD_CONFIG.maxMood, mood + amount)
}

// ── 心情 → 经验倍率 ──
export function getExpMultiplier(mood) {
  if (mood >= 80) return MOOD_CONFIG.expBonusHigh
  if (mood < 30) return MOOD_CONFIG.expPenaltyLow
  return MOOD_CONFIG.expBonusNormal
}

// ── 心情 → 互动回复量（低心情时减半）──
export function getClickBoost(mood) {
  if (mood < 30) return MOOD_CONFIG.clickBoost * MOOD_CONFIG.clickBoostLowPenalty
  return MOOD_CONFIG.clickBoost
}

// ── 数据迁移：旧 string → 新 number ──
const OLD_MOOD_MAP = {
  happy: 85,
  neutral: 60,
  hungry: 25,
  sad: 15,
}

export function migrateMood(oldMood) {
  if (oldMood === undefined || oldMood === null) {
    return MOOD_CONFIG.initialMood
  }
  if (typeof oldMood === 'string') {
    return OLD_MOOD_MAP[oldMood] ?? MOOD_CONFIG.initialMood
  }
  if (typeof oldMood === 'number') {
    return clampMood(oldMood)
  }
  return MOOD_CONFIG.initialMood
}
