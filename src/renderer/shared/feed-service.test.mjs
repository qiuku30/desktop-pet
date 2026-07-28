import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FEED_CONFIG,
  FOODS,
  applyFeed,
  calculateFeedTransaction,
  commitFeedTransaction,
  consumeFood,
} from './feed-service.js'

test('FOODS is keyed by namespaced IDs from the feedable catalog', () => {
  assert.equal(FOODS['food:milk'].id, 'food:milk')
  assert.equal(FOODS['crop:carrot'].intimacy, 3)
  assert.equal(FOODS['crop:wheat'], undefined)
})

test('commitFeedTransaction emits only after one successful synchronous commit', () => {
  const calls = []
  const transaction = { ok: true, updates: { inventory: {}, satiety: 20 } }
  commitFeedTransaction({
    transaction,
    itemId: 'food:milk',
    setMany(updates) {
      calls.push(['setMany', updates])
    },
    emit(itemId) {
      calls.push(['emit', itemId])
    },
  })
  assert.deepEqual(calls, [
    ['setMany', transaction.updates],
    ['emit', 'food:milk'],
  ])

  assert.throws(() => commitFeedTransaction({
    transaction,
    itemId: 'food:milk',
    setMany() {
      throw new Error('commit failed')
    },
    emit() {
      calls.push(['unexpected emit'])
    },
  }), /commit failed/)
  assert.equal(calls.some(([name]) => name === 'unexpected emit'), false)
})

test('calculateFeedTransaction covers old food, custom crop intimacy and processed food', () => {
  const base = {
    inventory: { 'food:milk': 1, 'crop:carrot': 1, 'food:pumpkin-pie': 1 },
    satiety: 10,
    intimacy: 4,
    mood: 50,
    exp: 0,
    level: 1,
  }
  const milk = calculateFeedTransaction({ ...base, itemId: 'food:milk' })
  assert.equal(milk.ok, true)
  assert.equal(milk.updates.inventory['food:milk'], undefined)
  assert.equal(milk.updates.satiety, 25)
  assert.equal(milk.updates.intimacy, 9)

  const carrot = calculateFeedTransaction({ ...base, itemId: 'crop:carrot' })
  assert.equal(carrot.updates.intimacy, 7)

  const pie = calculateFeedTransaction({ ...base, itemId: 'food:pumpkin-pie' })
  assert.equal(pie.updates.satiety, 70)
  assert.equal(pie.updates.intimacy, 19)
})

test('calculateFeedTransaction rejects non-feedable, missing and full-satiety feeds', () => {
  const base = {
    inventory: { 'crop:wheat': 1, 'food:milk': 1 },
    satiety: 10,
    intimacy: 0,
    mood: 50,
    exp: 0,
    level: 1,
  }
  assert.deepEqual(calculateFeedTransaction({ ...base, itemId: 'crop:wheat' }), {
    ok: false,
    error: 'ITEM_NOT_FEEDABLE',
  })
  assert.deepEqual(calculateFeedTransaction({ ...base, itemId: 'food:cake' }), {
    ok: false,
    error: 'INSUFFICIENT_ITEMS',
  })
  assert.deepEqual(calculateFeedTransaction({ ...base, satiety: 100, itemId: 'food:milk' }), {
    ok: false,
    error: 'SATIETY_FULL',
  })
})

test('calculateFeedTransaction applies mood multiplier and supports multi-level gains', () => {
  const result = calculateFeedTransaction({
    inventory: { 'food:pumpkin-pie': 1 },
    itemId: 'food:pumpkin-pie',
    satiety: 0,
    intimacy: 0,
    mood: 79,
    exp: 55,
    level: 1,
  })
  assert.equal(result.ok, true)
  assert.equal(result.updates.mood, 82)
  assert.equal(result.updates.level, 2)
  assert.equal(result.leveledUp, true)

  const multi = calculateFeedTransaction({
    inventory: { 'crop:star-dew-fruit': 1 },
    itemId: 'crop:star-dew-fruit',
    satiety: 0,
    intimacy: 0,
    mood: 90,
    exp: 59,
    level: 1,
  })
  assert.equal(multi.ok, true)
  assert.ok(multi.updates.level >= 2)
  assert.equal(multi.updates.inventory['crop:star-dew-fruit'], undefined)
})

test('consumeFood removes exactly one namespaced inventory item immutably', () => {
  const inventory = { 'food:milk': 2, 'crop:carrot': 1 }
  assert.deepEqual(consumeFood('food:milk', inventory), {
    newInventory: { 'food:milk': 1, 'crop:carrot': 1 },
    consumed: true,
  })
  assert.deepEqual(inventory, { 'food:milk': 2, 'crop:carrot': 1 })
  assert.deepEqual(consumeFood('food:cake', inventory), {
    newInventory: inventory,
    consumed: false,
  })
})

test('applyFeed uses item intimacy and falls back to the legacy default', () => {
  assert.deepEqual(applyFeed(20, 7, FOODS['crop:carrot'], 1), {
    newSatiety: 28,
    newIntimacy: 10,
  })
  assert.deepEqual(applyFeed(20, 7, { satiety: 5 }, 1), {
    newSatiety: 25,
    newIntimacy: 7 + FEED_CONFIG.intimacyPerFeed,
  })
})
