import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REWARD_SEGMENTS,
  MILESTONES,
  MOOD_MULTIPLIERS,
  calcScoreRewards,
  calcMilestoneRewards,
  getMoodMultiplier,
  applyMoodMultiplier,
  calcTotalRewards,
} from './game-reward-service.js'

// ══════════════════════════════════════════════════════
// 配置常量校验
// ══════════════════════════════════════════════════════

test('REWARD_SEGMENTS: 三段配置，maxScore 递增，expPer/coinPer 递减', () => {
  assert.equal(REWARD_SEGMENTS.length, 3)
  assert.ok(REWARD_SEGMENTS[0].maxScore < REWARD_SEGMENTS[1].maxScore)
  assert.ok(REWARD_SEGMENTS[1].maxScore < REWARD_SEGMENTS[2].maxScore)
  // 兑换率递减 = 每点经验的分数门槛降低 = 后期更容易获得经验
  assert.ok(REWARD_SEGMENTS[0].expPer > REWARD_SEGMENTS[1].expPer)
  assert.ok(REWARD_SEGMENTS[1].expPer > REWARD_SEGMENTS[2].expPer)
})

test('MILESTONES: 五档奖励均为正数', () => {
  const values = Object.keys(MILESTONES).map(Number).sort((a, b) => a - b)
  assert.deepEqual(values, [128, 256, 512, 1024, 2048])
  for (const v of values) {
    assert.ok(MILESTONES[v].exp > 0, `${v} exp`)
    assert.ok(MILESTONES[v].coins > 0, `${v} coins`)
  }
})

test('MOOD_MULTIPLIERS: 三档倍率配置完整', () => {
  assert.equal(MOOD_MULTIPLIERS.high.minMood, 80)
  assert.equal(MOOD_MULTIPLIERS.high.multiplier, 1.2)
  assert.equal(MOOD_MULTIPLIERS.low.maxMood, 30)
  assert.equal(MOOD_MULTIPLIERS.low.multiplier, 0.7)
  assert.equal(MOOD_MULTIPLIERS.normal.multiplier, 1.0)
})

// ══════════════════════════════════════════════════════
// calcScoreRewards — 分段计算
// ══════════════════════════════════════════════════════

test('calcScoreRewards: score = 0 返回 { exp: 0, coins: 0 }', () => {
  assert.deepEqual(calcScoreRewards(0), { exp: 0, coins: 0 })
})

test('calcScoreRewards: 负数返回 { exp: 0, coins: 0 }', () => {
  assert.deepEqual(calcScoreRewards(-100), { exp: 0, coins: 0 })
})

test('calcScoreRewards: 纯第一段 — score=1000', () => {
  // exp: round(1000/200) = 5, coins: round(1000/300) = 3
  assert.deepEqual(calcScoreRewards(1000), { exp: 5, coins: 3 })
})

test('calcScoreRewards: 纯第一段 — score=600', () => {
  // exp: round(600/200) = 3, coins: round(600/300) = 2
  assert.deepEqual(calcScoreRewards(600), { exp: 3, coins: 2 })
})

// ══════════════════════════════════════════════════════
// calcScoreRewards — 跨段累加
// ══════════════════════════════════════════════════════

test('calcScoreRewards: 跨一二段 — score=1600', () => {
  // 段1 (0~1000): exp=5, coins=3
  // 段2 (1000~1600): 600/120=5exp, 600/180=3.33→3coins
  assert.deepEqual(calcScoreRewards(1600), { exp: 10, coins: 6 })
})

test('calcScoreRewards: 跨一二段 — score=2500', () => {
  // 段1: exp=5, coins=3
  // 段2 (1000~2500): 1500/120=12.5→13exp, 1500/180=8.33→8coins
  assert.deepEqual(calcScoreRewards(2500), { exp: 18, coins: 11 })
})

test('calcScoreRewards: 刚好在段边界 — score=3000', () => {
  // 段1: exp=5, coins=3
  // 段2 (1000~3000): 2000/120=16.67→17exp, 2000/180=11.11→11coins
  assert.deepEqual(calcScoreRewards(3000), { exp: 22, coins: 14 })
})

test('calcScoreRewards: 跨三段 — score=3500', () => {
  // 段1: exp=5, coins=3
  // 段2: exp=17, coins=11
  // 段3 (3000~3500): 500/80=6.25→6exp, 500/120=4.17→4coins
  assert.deepEqual(calcScoreRewards(3500), { exp: 28, coins: 18 })
})

test('calcScoreRewards: 跨三段 — score=5000', () => {
  // 段1: exp=5, coins=3
  // 段2: exp=17, coins=11
  // 段3 (3000~5000): 2000/80=25exp, 2000/120=16.67→17coins
  assert.deepEqual(calcScoreRewards(5000), { exp: 47, coins: 31 })
})

test('calcScoreRewards: 刚好跨入第三段 — score=3001', () => {
  // 段1: exp=5, coins=3
  // 段2: exp=17, coins=11
  // 段3: 1/80=0.01→0exp, 1/120=0.01→0coins
  assert.deepEqual(calcScoreRewards(3001), { exp: 22, coins: 14 })
})

// ══════════════════════════════════════════════════════
// calcScoreRewards — 四舍五入边界
// ══════════════════════════════════════════════════════

test('calcScoreRewards: 四舍五入 — 段1 exp 刚好过半 (score=100)', () => {
  // 100/200=0.5 → round=1
  const r = calcScoreRewards(100)
  assert.equal(r.exp, 1)
})

test('calcScoreRewards: 四舍五入 — 段1 exp 刚好不过半 (score=99)', () => {
  // 99/200=0.495 → round=0
  const r = calcScoreRewards(99)
  assert.equal(r.exp, 0)
})

test('calcScoreRewards: 四舍五入 — 段1 coins 刚好过半 (score=150)', () => {
  // 150/300=0.5 → round=1
  const r = calcScoreRewards(150)
  assert.equal(r.coins, 1)
})

test('calcScoreRewards: 四舍五入 — 段1 coins 刚好不过半 (score=149)', () => {
  // 149/300=0.497 → round=0
  const r = calcScoreRewards(149)
  assert.equal(r.coins, 0)
})

test('calcScoreRewards: 四舍五入 — 段2 exp 刚好过半 (score=1060)', () => {
  // 段1: exp=5, coins=3
  // 段2: 60/120=0.5 → round=1
  assert.equal(calcScoreRewards(1060).exp, 6) // 5+1
})

test('calcScoreRewards: 四舍五入 — 段2 coins 刚好过半 (score=1090)', () => {
  // 段2: 90/180=0.5 → round=1
  assert.equal(calcScoreRewards(1090).coins, 4) // 3+1
})

test('calcScoreRewards: 四舍五入 — 段3 exp 刚好过半 (score=3040)', () => {
  // 段1: exp=5 coins=3, 段2: exp=17 coins=11
  // 段3: 40/80=0.5 → round=1
  assert.equal(calcScoreRewards(3040).exp, 23) // 5+17+1
})

test('calcScoreRewards: 四舍五入 — 段3 coins 刚好过半 (score=3060)', () => {
  // 段3: 60/120=0.5 → round=1
  assert.equal(calcScoreRewards(3060).coins, 15) // 3+11+1
})

// ══════════════════════════════════════════════════════
// calcMilestoneRewards — 里程碑触发
// ══════════════════════════════════════════════════════

test('calcMilestoneRewards: maxTile 低于最小里程碑 → 不触发', () => {
  const r = calcMilestoneRewards(64, { 128: false, 256: false, 512: false, 1024: false, 2048: false })
  assert.deepEqual(r, { exp: 0, coins: 0, triggered: [] })
})

test('calcMilestoneRewards: 单个触发 128', () => {
  const r = calcMilestoneRewards(128, { 128: false, 256: false, 512: false, 1024: false, 2048: false })
  assert.equal(r.exp, 5)
  assert.equal(r.coins, 3)
  assert.deepEqual(r.triggered, [128])
})

test('calcMilestoneRewards: 连带触发 128+256+512', () => {
  const r = calcMilestoneRewards(512, { 128: false, 256: false, 512: false, 1024: false, 2048: false })
  // 5+10+20 = 35, 3+6+12 = 21
  assert.equal(r.exp, 35)
  assert.equal(r.coins, 21)
  assert.deepEqual(r.triggered, [128, 256, 512])
})

test('calcMilestoneRewards: 连带触发 128~2048 全部', () => {
  const r = calcMilestoneRewards(2048, { 128: false, 256: false, 512: false, 1024: false, 2048: false })
  // 5+10+20+40+80 = 155, 3+6+12+25+50 = 96
  assert.equal(r.exp, 155)
  assert.equal(r.coins, 96)
  assert.deepEqual(r.triggered, [128, 256, 512, 1024, 2048])
})

// ══════════════════════════════════════════════════════
// calcMilestoneRewards — 不重复触发
// ══════════════════════════════════════════════════════

test('calcMilestoneRewards: 已解锁的不重复触发', () => {
  const r = calcMilestoneRewards(512, {
    128: true, 256: false, 512: false, 1024: false, 2048: false,
  })
  assert.equal(r.exp, 30)  // 10+20
  assert.equal(r.coins, 18) // 6+12
  assert.deepEqual(r.triggered, [256, 512])
})

test('calcMilestoneRewards: 全部已解锁 → 空', () => {
  const r = calcMilestoneRewards(2048, {
    128: true, 256: true, 512: true, 1024: true, 2048: true,
  })
  assert.deepEqual(r, { exp: 0, coins: 0, triggered: [] })
})

test('calcMilestoneRewards: maxTile=256，128 已解锁 → 只触发 256', () => {
  const r = calcMilestoneRewards(256, {
    128: true, 256: false, 512: false, 1024: false, 2048: false,
  })
  assert.equal(r.exp, 10)
  assert.equal(r.coins, 6)
  assert.deepEqual(r.triggered, [256])
})

test('calcMilestoneRewards: 默认空对象 → 全部触发', () => {
  const r = calcMilestoneRewards(256)
  assert.equal(r.exp, 15) // 5+10
  assert.deepEqual(r.triggered, [128, 256])
})

// ══════════════════════════════════════════════════════
// getMoodMultiplier — 心情四档边界
// ══════════════════════════════════════════════════════

test('getMoodMultiplier: 开心 ≥80 → 1.2', () => {
  assert.equal(getMoodMultiplier(100), 1.2)
  assert.equal(getMoodMultiplier(85), 1.2)
  assert.equal(getMoodMultiplier(80), 1.2)
})

test('getMoodMultiplier: 良好 一般 30~79 → 1.0', () => {
  assert.equal(getMoodMultiplier(79), 1.0)
  assert.equal(getMoodMultiplier(50), 1.0)
  assert.equal(getMoodMultiplier(30), 1.0)
})

test('getMoodMultiplier: 低落 <30 → 0.7', () => {
  assert.equal(getMoodMultiplier(29), 0.7)
  assert.equal(getMoodMultiplier(15), 0.7)
  assert.equal(getMoodMultiplier(0), 0.7)
})

test('getMoodMultiplier: 边界刚好 30 属于正常 → 1.0', () => {
  assert.equal(getMoodMultiplier(30), 1.0)
})

test('getMoodMultiplier: 边界刚好 80 属于开心 → 1.2', () => {
  assert.equal(getMoodMultiplier(80), 1.2)
})

// ══════════════════════════════════════════════════════
// applyMoodMultiplier
// ══════════════════════════════════════════════════════

test('applyMoodMultiplier: 1.0 倍率不变', () => {
  assert.equal(applyMoodMultiplier(10, 1.0), 10)
  assert.equal(applyMoodMultiplier(100, 1.0), 100)
})

test('applyMoodMultiplier: 1.2 倍率', () => {
  assert.equal(applyMoodMultiplier(10, 1.2), 12)
  assert.equal(applyMoodMultiplier(5, 1.2), 6)
})

test('applyMoodMultiplier: 0.7 倍率', () => {
  assert.equal(applyMoodMultiplier(10, 0.7), 7)
  assert.equal(applyMoodMultiplier(100, 0.7), 70)
})

test('applyMoodMultiplier: 四舍五入 — 刚好过半', () => {
  // 5 * 0.7 = 3.5 → round=4
  assert.equal(applyMoodMultiplier(5, 0.7), 4)
})

test('applyMoodMultiplier: 四舍五入 — 刚好不过半', () => {
  // 4 * 0.7 = 2.8 → round=3
  assert.equal(applyMoodMultiplier(4, 0.7), 3)
  // 2 * 0.7 = 1.4 → round=1
  assert.equal(applyMoodMultiplier(2, 0.7), 1)
})

// ══════════════════════════════════════════════════════
// calcTotalRewards — 集成测试
// ══════════════════════════════════════════════════════

test('calcTotalRewards: 完整结算 — 新手局', () => {
  const r = calcTotalRewards(600, 128, 85, {
    128: false, 256: false, 512: false, 1024: false, 2048: false,
  })
  // base: exp=3 coins=2
  // milestone: 128 → +5exp +3coins
  // subtotal: exp=8 coins=5
  // mood 85 → 1.2 → totalExp=round(8*1.2)=10, totalCoins=round(5*1.2)=6
  assert.equal(r.score, 600)
  assert.equal(r.maxTile, 128)
  assert.equal(r.mood, 85)
  assert.equal(r.moodMultiplier, 1.2)
  assert.equal(r.baseExp, 3)
  assert.equal(r.baseCoins, 2)
  assert.equal(r.milestoneExp, 5)
  assert.equal(r.milestoneCoins, 3)
  assert.deepEqual(r.triggeredMilestones, [128])
  assert.equal(r.subtotalExp, 8)
  assert.equal(r.subtotalCoins, 5)
  assert.equal(r.totalExp, 10)
  assert.equal(r.totalCoins, 6)
})

test('calcTotalRewards: 无里程碑触发', () => {
  const r = calcTotalRewards(2000, 64, 50, {
    128: false, 256: false, 512: false, 1024: false, 2048: false,
  })
  // base: 段1 exp=5 coins=3, 段2 1000/120=8.33→8exp 1000/180=5.56→6coins
  // base total: exp=13 coins=9
  // milestone: none (maxTile=64)
  // mood 50 → 1.0
  assert.equal(r.baseExp, 13)
  assert.equal(r.baseCoins, 9)
  assert.equal(r.milestoneExp, 0)
  assert.deepEqual(r.triggeredMilestones, [])
  assert.equal(r.totalExp, 13)
  assert.equal(r.totalCoins, 9)
})

test('calcTotalRewards: 低落心情 0.7 倍率', () => {
  const r = calcTotalRewards(1000, 256, 20, {
    128: true, 256: false, 512: false, 1024: false, 2048: false,
  })
  // base: exp=5 coins=3
  // milestone: 256 → +10exp +6coins (128 已解锁跳过)
  // subtotal: exp=15 coins=9
  // mood <30 → 0.7 → totalExp=round(15*0.7)=11, totalCoins=round(9*0.7)=6
  assert.equal(r.moodMultiplier, 0.7)
  assert.equal(r.milestoneExp, 10)
  assert.equal(r.milestoneCoins, 6)
  assert.deepEqual(r.triggeredMilestones, [256])
  assert.equal(r.subtotalExp, 15)
  assert.equal(r.subtotalCoins, 9)
  assert.equal(r.totalExp, 11)
  assert.equal(r.totalCoins, 6)
})

test('calcTotalRewards: 高分+开心+多里程碑', () => {
  const r = calcTotalRewards(5000, 512, 90, {
    128: false, 256: false, 512: false, 1024: false, 2048: false,
  })
  // base: exp=47 coins=31
  // milestone: 128+256+512 → exp=35 coins=21
  // subtotal: exp=82 coins=52
  // mood 90 → 1.2 → totalExp=round(82*1.2)=98, totalCoins=round(52*1.2)=62
  assert.equal(r.baseExp, 47)
  assert.equal(r.baseCoins, 31)
  assert.equal(r.milestoneExp, 35)
  assert.equal(r.milestoneCoins, 21)
  assert.deepEqual(r.triggeredMilestones, [128, 256, 512])
  assert.equal(r.subtotalExp, 82)
  assert.equal(r.subtotalCoins, 52)
  assert.equal(r.moodMultiplier, 1.2)
  assert.equal(r.totalExp, 98)
  assert.equal(r.totalCoins, 62)
})
