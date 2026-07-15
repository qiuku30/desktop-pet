import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EXP_CONFIG,
  calcRequiredExp,
  checkDailyInteraction,
  addExp,
  getFoodExp,
} from './exp-service.js'

// ══════════════════════════════════════════════════════
// EXP_CONFIG
// ══════════════════════════════════════════════════════

test('EXP_CONFIG: 三个配置项均为正数', () => {
  assert.ok(EXP_CONFIG.dailyInteractionLimit > 0)
  assert.ok(EXP_CONFIG.interactionExp > 0)
  assert.ok(EXP_CONFIG.maxLevel > 0)
})

test('EXP_CONFIG: maxLevel 与 calcRequiredExp 一致', () => {
  assert.equal(calcRequiredExp(EXP_CONFIG.maxLevel), Infinity)
})

// ══════════════════════════════════════════════════════
// calcRequiredExp
// ══════════════════════════════════════════════════════

test('calcRequiredExp: maxLevel 返回 Infinity', () => {
  assert.equal(calcRequiredExp(EXP_CONFIG.maxLevel), Infinity)
  assert.equal(calcRequiredExp(EXP_CONFIG.maxLevel + 1), Infinity)
})

test('calcRequiredExp: level < 1 返回 0', () => {
  assert.equal(calcRequiredExp(0), 0)
  assert.equal(calcRequiredExp(-1), 0)
})

test('calcRequiredExp: 新手期 1-5 级（幂次公式）', () => {
  // 60 × level^1.25
  assert.equal(calcRequiredExp(1), 60)
  assert.equal(calcRequiredExp(2), 143)
  assert.equal(calcRequiredExp(3), 237)
  assert.equal(calcRequiredExp(4), 339)
  assert.equal(calcRequiredExp(5), 449)
})

test('calcRequiredExp: 成长期 6-20 级（线性公式）', () => {
  // 110 × level - 190
  assert.equal(calcRequiredExp(6), 470)
  assert.equal(calcRequiredExp(10), 910)
  assert.equal(calcRequiredExp(15), 1460)
  assert.equal(calcRequiredExp(20), 2010)
})

test('calcRequiredExp: 成熟期 21-29 级（线性公式）', () => {
  // 150 × level - 990
  assert.equal(calcRequiredExp(21), 2160)
  assert.equal(calcRequiredExp(25), 2760)
  assert.equal(calcRequiredExp(29), 3360)
})

test('calcRequiredExp: 全 29 级严格递增', () => {
  for (let lv = 2; lv < EXP_CONFIG.maxLevel; lv++) {
    const prev = calcRequiredExp(lv - 1)
    const curr = calcRequiredExp(lv)
    assert.ok(curr > prev, `level ${lv}: ${prev} → ${curr} 非递增`)
  }
})

// ══════════════════════════════════════════════════════
// addExp
// ══════════════════════════════════════════════════════

test('addExp: 零增量不变', () => {
  const r = addExp(50, 3, 0)
  assert.deepEqual(r, { newExp: 50, newLevel: 3, leveledUp: false })
})

test('addExp: 负增量不变', () => {
  const r = addExp(50, 3, -10)
  assert.deepEqual(r, { newExp: 50, newLevel: 3, leveledUp: false })
})

test('addExp: 不够升级，累加到当前等级', () => {
  // 1→2 需 60exp
  const r = addExp(0, 1, 30)
  assert.equal(r.newLevel, 1)
  assert.equal(r.newExp, 30)
  assert.equal(r.leveledUp, false)
})

test('addExp: 刚好升级，exp 归零', () => {
  const r = addExp(0, 1, 60)
  assert.equal(r.newLevel, 2)
  assert.equal(r.newExp, 0)
  assert.equal(r.leveledUp, true)
})

test('addExp: 溢出继承到下一级', () => {
  // 2→3 需 143exp，已有 140，加 30 = 170，溢出 170-143=27
  const r = addExp(140, 2, 30)
  assert.equal(r.newLevel, 3)
  assert.equal(r.newExp, 27)
  assert.equal(r.leveledUp, true)
})

test('addExp: 刚好溢出 1 点', () => {
  // 4→5 需 339，339 + 1 > 339
  const r = addExp(339, 4, 1)
  assert.equal(r.newLevel, 5)
  assert.equal(r.newExp, 1)
  assert.equal(r.leveledUp, true)
})

test('addExp: 连升多级', () => {
  // 1 级 0exp + 500: 60(升2)→143(升3)→237(升4)→剩余60
  const r = addExp(0, 1, 500)
  assert.equal(r.newLevel, 4)
  assert.equal(r.newExp, 60)
  assert.equal(r.leveledUp, true)
})

test('addExp: 满级不再升级，保留已有经验', () => {
  const r = addExp(500, EXP_CONFIG.maxLevel, 1000)
  assert.equal(r.newLevel, EXP_CONFIG.maxLevel)
  assert.equal(r.newExp, 500)
  assert.equal(r.leveledUp, false)
})

test('addExp: 满级且 0 经验', () => {
  const r = addExp(0, EXP_CONFIG.maxLevel, 1000)
  assert.equal(r.newLevel, EXP_CONFIG.maxLevel)
  assert.equal(r.newExp, 0)
  assert.equal(r.leveledUp, false)
})

test('addExp: 异常状态自修正（exp 已超过升级所需）', () => {
  // 1 级有 200exp（远超所需 60），再加 50
  const r = addExp(200, 1, 50)
  assert.equal(r.newLevel, 3)
  assert.equal(r.newExp, 47)
})

test('addExp: 0 级自修正到 1 级', () => {
  const r = addExp(0, 0, 50)
  assert.equal(r.newLevel, 1)
  assert.equal(r.newExp, 50)
})

// ══════════════════════════════════════════════════════
// checkDailyInteraction
// ══════════════════════════════════════════════════════

// 固定测试日期，消除跨天依赖
const FIXED_NOW = new Date('2026-07-13T12:00:00')
const FIXED_TODAY = '2026-07-13'

test('checkDailyInteraction: 计数正确 +1', () => {
  const r = checkDailyInteraction(5, FIXED_TODAY, FIXED_NOW)
  assert.equal(r.canGain, true)
  assert.equal(r.newCount, 6)
  assert.equal(r.newDate, FIXED_TODAY)
})

test('checkDailyInteraction: 刚好达到上限前最后一次', () => {
  const r = checkDailyInteraction(EXP_CONFIG.dailyInteractionLimit - 1, FIXED_TODAY, FIXED_NOW)
  assert.equal(r.canGain, true)
  assert.equal(r.newCount, EXP_CONFIG.dailyInteractionLimit)
})

test('checkDailyInteraction: 达到上限后阻断', () => {
  const r = checkDailyInteraction(EXP_CONFIG.dailyInteractionLimit, FIXED_TODAY, FIXED_NOW)
  assert.equal(r.canGain, false)
  assert.equal(r.newCount, EXP_CONFIG.dailyInteractionLimit)
})

test('checkDailyInteraction: 上限阻断后不修正超限值', () => {
  // 数据异常时可超 20，不修正但也不让继续加
  const r = checkDailyInteraction(25, FIXED_TODAY, FIXED_NOW)
  assert.equal(r.canGain, false)
  assert.equal(r.newCount, 25)
})

test('checkDailyInteraction: 过日归零', () => {
  const r = checkDailyInteraction(EXP_CONFIG.dailyInteractionLimit, '2020-01-01')
  assert.equal(r.canGain, true)
  assert.equal(r.newCount, 1)
})

test('checkDailyInteraction: null 日期视为过日', () => {
  const r = checkDailyInteraction(10, null)
  assert.equal(r.canGain, true)
  assert.equal(r.newCount, 1)
})

test('checkDailyInteraction: undefined 日期视为过日', () => {
  const r = checkDailyInteraction(10, undefined)
  assert.equal(r.canGain, true)
  assert.equal(r.newCount, 1)
})

test('checkDailyInteraction: 返回日期是本地 YYYY-MM-DD 格式', () => {
  const r = checkDailyInteraction(0, null)
  assert.match(r.newDate, /^\d{4}-\d{2}-\d{2}$/)
})

test('checkDailyInteraction: 返回日期等于今天本地日期', () => {
  const now = new Date()
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const r = checkDailyInteraction(0, null)
  assert.equal(r.newDate, expected)
})

// ══════════════════════════════════════════════════════
// getFoodExp
// ══════════════════════════════════════════════════════

test('getFoodExp: 正常取食物经验', () => {
  assert.equal(getFoodExp({ id: 'cake', exp: 25 }), 25)
  assert.equal(getFoodExp({ id: 'cookie', exp: 5 }), 5)
})

test('getFoodExp: 缺 exp 字段返回 0', () => {
  assert.equal(getFoodExp({ id: 'water' }), 0)
})

test('getFoodExp: 空对象返回 0', () => {
  assert.equal(getFoodExp({}), 0)
})
