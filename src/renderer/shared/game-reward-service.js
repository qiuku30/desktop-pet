// 2048 游戏收益结算服务（纯函数，配置驱动，不碰 PetState）
// 职责：分数分段兑换、首达阶梯奖励、心情倍率加成。
// 调用方负责从 PetState 读写状态，game-reward-service 只做计算。
//
// 设计决策（infra-12）：
// - 分数分段递减：越高分段兑换率越高（匹配后期难度递增）
// - 首达阶梯：maxTile 连带触发所有 ≤ maxTile 的未解锁里程碑（128→256→512 递进合成）
// - 心情倍率：≥80→1.2, <30→0.7, 其他→1.0，先汇总再乘（对齐 spec "对总收益施加倍率"）
// - 各段计算结果四舍五入到整数

// ══════════════════════════════════════════════════════
// 配置常量
// ══════════════════════════════════════════════════════

// 分数分段兑换配置
// maxScore: 该段分数上界，expPer/coinPer: 每 N 分兑换 1 exp/coin
export const REWARD_SEGMENTS = [
  { maxScore: 1000,    expPer: 200, coinPer: 300 },
  { maxScore: 3000,    expPer: 120, coinPer: 180 },
  { maxScore: Infinity, expPer: 80,  coinPer: 120 },
]

// 首达阶梯奖励（一次性，每个档位终身仅生效一次）
export const MILESTONES = {
  128:  { exp: 5,  coins: 3 },
  256:  { exp: 10, coins: 6 },
  512:  { exp: 20, coins: 12 },
  1024: { exp: 40, coins: 25 },
  2048: { exp: 80, coins: 50 },
}

// 里程碑值列表（从小到大），供遍历使用
const MILESTONE_VALUES = Object.keys(MILESTONES)
  .map(Number)
  .sort((a, b) => a - b)

// 心情倍率档位
// 判断顺序：≥80 → 1.2，<30 → 0.7，其余 → 1.0
export const MOOD_MULTIPLIERS = {
  high:   { minMood: 80, multiplier: 1.2 },
  low:    { maxMood: 30, multiplier: 0.7 },  // mood < 30（不含 30）
  normal: { multiplier: 1.0 },
}

// ══════════════════════════════════════════════════════
// 纯函数
// ══════════════════════════════════════════════════════

// ── 分数分段计算基础收益 ──
// score: 本局总分
// 返回 { exp, coins } — 各段兑换后四舍五入累加
export function calcScoreRewards(score) {
  if (score <= 0) return { exp: 0, coins: 0 }

  let exp = 0
  let coins = 0
  let lowerBound = 0

  for (const seg of REWARD_SEGMENTS) {
    if (score <= lowerBound) break
    const segScore = Math.min(score, seg.maxScore) - lowerBound
    exp += Math.round(segScore / seg.expPer)
    coins += Math.round(segScore / seg.coinPer)
    lowerBound = seg.maxScore
  }

  return { exp, coins }
}

// ── 首达阶梯奖励检查 ──
// maxTile: 本局达到的最大方块值（如 256、512 等）
// unlockedMilestones: 已解锁的里程碑标记对象 { 128: true, 256: false, ... }
// 返回 { exp, coins, triggered[] } — triggered 为新触发的里程碑值数组
// maxTile=512 时连带检查 128/256/512（合成路径递进）
export function calcMilestoneRewards(maxTile, unlockedMilestones = {}) {
  let exp = 0
  let coins = 0
  const triggered = []

  for (const value of MILESTONE_VALUES) {
    if (maxTile >= value && !unlockedMilestones[value]) {
      const reward = MILESTONES[value]
      exp += reward.exp
      coins += reward.coins
      triggered.push(value)
    }
  }

  return { exp, coins, triggered }
}

// ── 心情倍率查档 ──
// mood: 当前心情数值（0-100）
// 返回倍率数值（1.2 / 1.0 / 0.7）
export function getMoodMultiplier(mood) {
  if (mood >= MOOD_MULTIPLIERS.high.minMood) return MOOD_MULTIPLIERS.high.multiplier
  if (mood < MOOD_MULTIPLIERS.low.maxMood) return MOOD_MULTIPLIERS.low.multiplier
  return MOOD_MULTIPLIERS.normal.multiplier
}

// ── 应用心情倍率 ──
// amount: 待加成数值（exp 或 coins）
// multiplier: 心情倍率（来自 getMoodMultiplier）
// 返回四舍五入后的整数
export function applyMoodMultiplier(amount, multiplier) {
  return Math.round(amount * multiplier)
}

// ── 完整结算汇总 ──
// score: 本局总分
// maxTile: 本局达到的最大方块值
// mood: 当前心情数值（0-100）
// unlockedMilestones: 已解锁的里程碑标记对象
// 先汇总基础+里程碑，再乘心情倍率（对齐 spec"对总收益施加倍率"）
export function calcTotalRewards(score, maxTile, mood, unlockedMilestones = {}) {
  const baseRewards = calcScoreRewards(score)
  const milestoneRewards = calcMilestoneRewards(maxTile, unlockedMilestones)
  const multiplier = getMoodMultiplier(mood)

  const subtotalExp = baseRewards.exp + milestoneRewards.exp
  const subtotalCoins = baseRewards.coins + milestoneRewards.coins

  return {
    score,
    maxTile,
    mood,
    moodMultiplier: multiplier,
    baseExp: baseRewards.exp,
    baseCoins: baseRewards.coins,
    milestoneExp: milestoneRewards.exp,
    milestoneCoins: milestoneRewards.coins,
    triggeredMilestones: milestoneRewards.triggered,
    subtotalExp,
    subtotalCoins,
    totalExp: applyMoodMultiplier(subtotalExp, multiplier),
    totalCoins: applyMoodMultiplier(subtotalCoins, multiplier),
  }
}
