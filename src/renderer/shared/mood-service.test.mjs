// mood-service 测试（node --test 原生 test runner）
// infra-10：心情系统共享层

import { describe, it } from 'node:test'
import * as assert from 'node:assert'
import {
  MOOD_CONFIG,
  getMoodTier,
  calcMoodDecay,
  reduceMood,
  boostMood,
  getExpMultiplier,
  getClickBoost,
  migrateMood,
  clampMood,
} from './mood-service.js'

// ── getMoodTier ──
describe('getMoodTier', () => {
  // 整数边界
  it('80 → happy', () => {
    const r = getMoodTier(80)
    assert.equal(r.tier, 'happy')
    assert.equal(r.emoji, '😊')
  })
  it('79 → good', () => {
    const r = getMoodTier(79)
    assert.equal(r.tier, 'good')
    assert.equal(r.emoji, '🙂')
  })
  it('50 → good', () => {
    const r = getMoodTier(50)
    assert.equal(r.tier, 'good')
  })
  it('49 → neutral', () => {
    const r = getMoodTier(49)
    assert.equal(r.tier, 'neutral')
  })
  it('30 → neutral', () => {
    const r = getMoodTier(30)
    assert.equal(r.tier, 'neutral')
  })
  it('29 → low', () => {
    const r = getMoodTier(29)
    assert.equal(r.tier, 'low')
    assert.equal(r.emoji, '😢')
  })
  it('0 → low', () => {
    const r = getMoodTier(0)
    assert.equal(r.tier, 'low')
  })
  it('100 → happy', () => {
    const r = getMoodTier(100)
    assert.equal(r.tier, 'happy')
  })

  // 浮点值 — 防止边界间隙回归（dash-05 发现）
  it('79.3 → good（不落入间隙）', () => {
    const r = getMoodTier(79.3)
    assert.equal(r.tier, 'good')
  })
  it('79.9 → good（不落入间隙）', () => {
    const r = getMoodTier(79.9)
    assert.equal(r.tier, 'good')
  })
  it('49.5 → neutral（不落入间隙）', () => {
    const r = getMoodTier(49.5)
    assert.equal(r.tier, 'neutral')
  })
  it('49.9 → neutral（不落入间隙）', () => {
    const r = getMoodTier(49.9)
    assert.equal(r.tier, 'neutral')
  })
  it('29.7 → low（不落入间隙）', () => {
    const r = getMoodTier(29.7)
    assert.equal(r.tier, 'low')
  })
  it('29.1 → low（不落入间隙）', () => {
    const r = getMoodTier(29.1)
    assert.equal(r.tier, 'low')
  })

  // 浮点值 — 衰减模拟（1/15 ≈ 0.0667/min 多次累积）
  it('70 - 15min 衰减(1点) = 69.0 → good', () => {
    const r = getMoodTier(69.0)
    assert.equal(r.tier, 'good')
  })
  it('80 - 1min 衰减(0.0667点) ≈ 79.93 → good', () => {
    // 从 happy 下界衰减 1 分钟，不应直接掉档
    const r = getMoodTier(80 - 1/15)
    assert.equal(r.tier, 'good')
  })
  it('50 - 1min 衰减(0.0667点) ≈ 49.93 → neutral', () => {
    const r = getMoodTier(50 - 1/15)
    assert.equal(r.tier, 'neutral')
  })
  it('30 - 1min 衰减(0.0667点) ≈ 29.93 → low', () => {
    const r = getMoodTier(30 - 1/15)
    assert.equal(r.tier, 'low')
  })

  // 极端浮点：非常接近边界但未越过
  it('50.001 → good', () => {
    const r = getMoodTier(50.001)
    assert.equal(r.tier, 'good')
  })
  it('49.999 → neutral', () => {
    const r = getMoodTier(49.999)
    assert.equal(r.tier, 'neutral')
  })
})

// ── calcMoodDecay ──
describe('calcMoodDecay', () => {
  it('正常速率 — 15 分钟扣 1 点', () => {
    const now = new Date('2026-07-14T12:15:00')
    const lastUpdate = new Date('2026-07-14T12:00:00')
    const decay = calcMoodDecay(lastUpdate.toISOString(), now.toISOString(), false, 0)
    assert.ok(Math.abs(decay - 1) < 0.01, `expected ~1, got ${decay}`)
  })

  it('正常速率 — 30 分钟扣 2 点', () => {
    const now = new Date('2026-07-14T12:30:00')
    const lastUpdate = new Date('2026-07-14T12:00:00')
    const decay = calcMoodDecay(lastUpdate.toISOString(), now.toISOString(), false, 0)
    assert.ok(Math.abs(decay - 2) < 0.01, `expected ~2, got ${decay}`)
  })

  it('饥饿加速 — 15 分钟扣 2 点（2/15 速率）', () => {
    const now = new Date('2026-07-14T12:15:00')
    const lastUpdate = new Date('2026-07-14T12:00:00')
    const decay = calcMoodDecay(lastUpdate.toISOString(), now.toISOString(), true, 0)
    assert.ok(Math.abs(decay - 2) < 0.01, `expected ~2, got ${decay}`)
  })

  it('首次启动（lastUpdate 为 null）不扣', () => {
    const now = new Date('2026-07-14T12:00:00').toISOString()
    assert.equal(calcMoodDecay(null, now, false, 0), 0)
  })

  it('lastUpdate 在未来 → 不扣', () => {
    const now = new Date('2026-07-14T12:00:00').toISOString()
    const lastUpdate = new Date('2026-07-14T13:00:00').toISOString()
    assert.equal(calcMoodDecay(lastUpdate, now, false, 0), 0)
  })

  it('单日不超上限 — 已累计 45 点，再离线 2h（原始 8 点）→ 只剩 5 额度，实扣 5', () => {
    const now = new Date('2026-07-14T14:00:00')
    const lastUpdate = new Date('2026-07-14T12:00:00')
    // 2h = 120min × 1/15 = 8，todayAccumulatedDecay=45 → 剩余额度 5
    const decay = calcMoodDecay(lastUpdate.toISOString(), now.toISOString(), false, 45)
    assert.ok(Math.abs(decay - 5) < 0.01, `expected ~5, got ${decay}`)
  })

  it('单日已达上限 — 已累计 50 点，再离线也不扣', () => {
    const now = new Date('2026-07-14T14:00:00')
    const lastUpdate = new Date('2026-07-14T12:00:00')
    const decay = calcMoodDecay(lastUpdate.toISOString(), now.toISOString(), false, 50)
    assert.equal(decay, 0)
  })

  it('跨天分段结算 — 离线 34h（7/13 22:00 → 7/15 08:00）', () => {
    const lastUpdate = new Date('2026-07-13T22:00:00').toISOString()
    const now = new Date('2026-07-15T08:00:00').toISOString()
    // 实际时间跨度：7/13 22:00 → 7/15 08:00 = 34h（非 38h）
    // 段1: 7/13 22:00→24:00, 2h=120min×(1/15)=8, cap 50 → 8
    // 段2: 7/14 00:00→24:00, 24h=1440min×(1/15)=96, cap 50 → 50
    // 段3: 7/15 00:00→08:00, 8h=480min×(1/15)=32, cap 50 → 32
    // total = 8 + 50 + 32 = 90
    const decay = calcMoodDecay(lastUpdate, now, false, 0)
    assert.ok(Math.abs(decay - 90) < 0.5, `expected ~90, got ${decay}`)
  })

  it('跨天 + 饥饿加速 — 离线 34h 全部饥饿速率', () => {
    const lastUpdate = new Date('2026-07-13T22:00:00').toISOString()
    const now = new Date('2026-07-15T08:00:00').toISOString()
    // 段1: 120×(2/15)=16, cap 50 → 16
    // 段2: 1440×(2/15)=192, cap 50 → 50
    // 段3: 480×(2/15)=64, cap 50 → 50
    // total = 16 + 50 + 50 = 116
    const decay = calcMoodDecay(lastUpdate, now, true, 0)
    assert.ok(Math.abs(decay - 116) < 0.5, `expected ~116, got ${decay}`)
  })

  it('跨天 + 首日已有累计 — 段1 额度受影响', () => {
    const lastUpdate = new Date('2026-07-13T22:00:00').toISOString()
    const now = new Date('2026-07-14T04:00:00').toISOString()
    // 段1: 7/13 22:00→24:00, 2h=120min×(1/15)=8, 剩余额度 max(0, 50-45)=5 → 5
    // 段2: 7/14 00:00→04:00, 4h=240min×(1/15)=16, cap 50 → 16
    // total = 5 + 16 = 21
    const decay = calcMoodDecay(lastUpdate, now, false, 45)
    assert.ok(Math.abs(decay - 21) < 0.5, `expected ~21, got ${decay}`)
  })
})

// ── reduceMood ──
describe('reduceMood', () => {
  it('正常减少', () => assert.equal(reduceMood(70, 5), 65))
  it('边界 clamp 到 0', () => assert.equal(reduceMood(3, 5), 0))
  it('已是 0', () => assert.equal(reduceMood(0, 1), 0))
})

// ── boostMood ──
describe('boostMood', () => {
  it('正常增加', () => assert.equal(boostMood(70, 5), 75))
  it('边界 clamp 到 100', () => assert.equal(boostMood(98, 5), 100))
  it('已是 100', () => assert.equal(boostMood(100, 2), 100))
})

// ── getExpMultiplier ──
describe('getExpMultiplier', () => {
  it('≥80 → 1.2', () => {
    assert.equal(getExpMultiplier(80), 1.2)
    assert.equal(getExpMultiplier(100), 1.2)
  })
  it('50-79 → 1.0', () => {
    assert.equal(getExpMultiplier(50), 1.0)
    assert.equal(getExpMultiplier(79), 1.0)
  })
  it('30-49 → 1.0', () => {
    assert.equal(getExpMultiplier(30), 1.0)
    assert.equal(getExpMultiplier(49), 1.0)
  })
  it('<30 → 0.7', () => {
    assert.equal(getExpMultiplier(29), 0.7)
    assert.equal(getExpMultiplier(0), 0.7)
  })
})

// ── getClickBoost ──
describe('getClickBoost', () => {
  it('低心情（<30）→ 减半', () => {
    const half = MOOD_CONFIG.clickBoost * MOOD_CONFIG.clickBoostLowPenalty
    assert.equal(getClickBoost(29), half)
    assert.equal(getClickBoost(0), half)
  })
  it('正常心情（≥30）→ 全量', () => {
    const full = MOOD_CONFIG.clickBoost
    assert.equal(getClickBoost(30), full)
    assert.equal(getClickBoost(80), full)
  })
})

// ── migrateMood ──
describe('migrateMood', () => {
  it("'happy' → 85", () => assert.equal(migrateMood('happy'), 85))
  it("'neutral' → 60", () => assert.equal(migrateMood('neutral'), 60))
  it("'hungry' → 25", () => assert.equal(migrateMood('hungry'), 25))
  it("'sad' → 15", () => assert.equal(migrateMood('sad'), 15))
  it('number 直通', () => assert.equal(migrateMood(70), 70))
  it('number 超范围 clamp', () => {
    assert.equal(migrateMood(150), 100)
    assert.equal(migrateMood(-10), 0)
  })
  it('undefined → 70', () => assert.equal(migrateMood(undefined), 70))
  it('null → 70', () => assert.equal(migrateMood(null), 70))
  it("未知 string 回退到 70", () => assert.equal(migrateMood('angry'), 70))
})

// ── clampMood ──
describe('clampMood', () => {
  it('正常值', () => assert.equal(clampMood(50), 50))
  it('超上限 → 100', () => assert.equal(clampMood(120), 100))
  it('超下限 → 0', () => assert.equal(clampMood(-5), 0))
  it('边界 100', () => assert.equal(clampMood(100), 100))
  it('边界 0', () => assert.equal(clampMood(0), 0))
})
