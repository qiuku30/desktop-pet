import test from 'node:test'
import assert from 'node:assert/strict'
import {
  abandonOrder,
  canCompleteOrder,
  completeOrder,
  generateOrder,
  orderSignature,
  regenerateDueOrders,
} from './farm-orders.mjs'

const NOW = '2026-07-26T08:00:00.000Z'

test('levels 1-3 generate one line and level 4 follows 70/30 branch', () => {
  const low = generateOrder({ farmLevel: 1, existingOrders: [], nextId: 1, now: NOW, random: () => 0 })
  assert.equal(Object.keys(low.order.requirements).length, 1)

  const levelFourOne = generateOrder({ farmLevel: 4, existingOrders: [], nextId: 1, now: NOW, random: sequence([0.69, 0, 0, 1]) })
  assert.equal(Object.keys(levelFourOne.order.requirements).length, 1)

  const levelFourTwo = generateOrder({ farmLevel: 4, existingOrders: [], nextId: 1, now: NOW, random: sequence([0.7, 0, 0, 1]) })
  assert.equal(Object.keys(levelFourTwo.order.requirements).length, 2)
  assert.ok(Object.values(levelFourTwo.order.requirements).every(count => count >= 1 && count <= 20))
})

test('orders avoid duplicate signatures and persist exact reward shape', () => {
  const first = generateOrder({ farmLevel: 1, existingOrders: [], nextId: 1, now: NOW, random: () => 0 })
  const second = generateOrder({ farmLevel: 1, existingOrders: [first.order], nextId: 2, now: NOW, random: () => 0 })
  assert.notEqual(orderSignature(first.order.requirements), orderSignature(second.order.requirements))
  assert.deepEqual(Object.keys(first.order.rewards), ['coins', 'farmExp', 'seedReward'])
  assert.ok(first.order.rewards.coins > first.order.materialValue)
})

test('seed reward uses 15 percent branch and stable unlocked seed selection', () => {
  const result = generateOrder({
    farmLevel: 2,
    existingOrders: [],
    nextId: 4,
    now: NOW,
    random: sequence([0, 0, 0.149, 0.99]),
  })
  assert.deepEqual(result.order.rewards.seedReward, { itemId: 'seed:wheat', count: 1 })
})

test('complete order atomically removes full requirements and rejects shortage', () => {
  const order = {
    id: 'order:1',
    requirements: { 'crop:wheat': 4, 'crop:carrot': 2 },
    rewards: { coins: 20, farmExp: 8, seedReward: null },
  }
  assert.equal(canCompleteOrder(order, { 'crop:wheat': 4, 'crop:carrot': 1 }), false)
  const failed = completeOrder({ order, inventory: { 'crop:wheat': 4 } })
  assert.equal(failed.ok, false)
  assert.deepEqual(failed.inventory, { 'crop:wheat': 4 })
  const result = completeOrder({ order, inventory: { 'crop:wheat': 4, 'crop:carrot': 2 } })
  assert.equal(result.ok, true)
  assert.deepEqual(result.inventory, {})
  assert.deepEqual(result.rewards, order.rewards)
})

test('abandon cools for 30 minutes and due regeneration fills without duplicates', () => {
  const abandoned = abandonOrder({ order: { id: 'order:1' }, regenerateAt: null }, NOW)
  assert.equal(abandoned.regenerateAt, '2026-07-26T08:30:00.000Z')
  const early = regenerateDueOrders({
    slots: [abandoned], farmLevel: 1, nextId: 2,
    now: '2026-07-26T08:29:59.000Z', random: () => 0,
  })
  assert.equal(early.slots[0].order, null)
  const due = regenerateDueOrders({
    slots: [abandoned, { order: null, regenerateAt: null }],
    farmLevel: 1, nextId: 2, now: '2026-07-26T08:30:00.000Z', random: () => 0,
  })
  assert.ok(due.slots[0].order)
  assert.ok(due.slots[1].order)
  assert.notEqual(orderSignature(due.slots[0].order.requirements), orderSignature(due.slots[1].order.requirements))
})

test('exhausted in-band signatures use deterministic nearest fallback, then return no candidate', () => {
  const inBand = [
    ...Array.from({ length: 7 }, (_, index) => ({ requirements: { 'crop:wheat': index + 4 } })),
    ...Array.from({ length: 4 }, (_, index) => ({ requirements: { 'crop:carrot': index + 2 } })),
  ]
  const fallback = generateOrder({
    farmLevel: 1,
    existingOrders: inBand,
    nextId: 1,
    now: NOW,
    random: () => 0,
  })
  assert.equal(fallback.ok, true)
  assert.deepEqual(fallback.order.requirements, { 'crop:wheat': 3 })

  const everySingle = [
    ...Array.from({ length: 20 }, (_, index) => ({ requirements: { 'crop:wheat': index + 1 } })),
    ...Array.from({ length: 20 }, (_, index) => ({ requirements: { 'crop:carrot': index + 1 } })),
  ]
  const none = generateOrder({
    farmLevel: 1,
    existingOrders: everySingle,
    nextId: 1,
    now: NOW,
    random: () => 0,
  })
  assert.equal(none.ok, false)
  assert.equal(none.order, null)
  assert.equal(none.error, 'NO_CANDIDATE')
})

function sequence(values) {
  let index = 0
  return () => values[index++] ?? 0
}
