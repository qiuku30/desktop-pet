import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarmService } from './farm-service.js'
import { createDefaultFarmState } from './farm-state.mjs'

const NOW = '2026-07-26T08:00:00.000Z'

function harness(initial = {}, nowFn = () => NOW) {
  const data = { level: 1, mood: 70, coins: 100, inventory: {}, farm: null, ...structuredClone(initial) }
  const calls = []
  const log = []
  const petState = {
    get(key) { return structuredClone(data[key]) },
    async setMany(updates) {
      log.push('commit')
      calls.push(structuredClone(updates))
      Object.assign(data, structuredClone(updates))
    },
  }
  const eventBus = {
    emit(event, payload) { log.push(event); log.push(structuredClone(payload)) },
  }
  const service = createFarmService({ petState, eventBus, now: nowFn, random: () => 0.99 })
  return { data, calls, log, service }
}

test('initialize grants starter seeds exactly once in one atomic commit', async () => {
  const { service, calls, data } = harness()
  const first = await service.initialize()
  const second = await service.initialize()
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.equal(calls.length, 1)
  assert.deepEqual(data.inventory, { 'seed:wheat': 4, 'seed:carrot': 4 })
  assert.equal(data.farm.starterGranted, true)
  assert.equal(data.farm.orders.slots.length, 3)
})

test('quick-buy plant changes farm, inventory and coins in exactly one commit', async () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.starterGranted = true
  const { service, calls, data } = harness({ farm, inventory: {}, coins: 100 })
  const result = await service.plant({ tileId: 'r1c1', cropId: 'crop:wheat', quickBuy: true })
  assert.equal(result.ok, true)
  assert.equal(calls.length, 1)
  assert.deepEqual(Object.keys(calls[0]).sort(), ['coins', 'farm', 'inventory'])
  assert.equal(data.coins, 96)
  assert.deepEqual(data.inventory, {})
  assert.equal(data.farm.farms['basic-farm'].tiles.find(tile => tile.id === 'r1c1').crop.cropId, 'crop:wheat')
})

test('insufficient quick-buy coins makes no commit or semantic event', async () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.starterGranted = true
  farm.orders.slots = farm.orders.slots.map(() => ({
    order: null,
    regenerateAt: '2026-07-26T09:00:00.000Z',
  }))
  const { service, calls, log } = harness({ farm, inventory: {}, coins: 0 })
  const result = await service.plant({ tileId: 'r1c1', cropId: 'crop:wheat', quickBuy: true })
  assert.equal(result.ok, false)
  assert.equal(calls.length, 0)
  assert.deepEqual(log, [])
})

test('repeated harvest grants crop and reward only once', async () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.starterGranted = true
  const tile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r1c1')
  tile.crop = matureWheat()
  const { service, calls, data } = harness({ farm })
  assert.equal((await service.harvest({ tileId: 'r1c1' })).ok, true)
  assert.equal((await service.harvest({ tileId: 'r1c1' })).ok, false)
  assert.equal(calls.length, 1)
  assert.equal(data.inventory['crop:wheat'], 4)
  assert.equal(data.farm.exp, 1)
})

test('order event is emitted only after commit and state event is last', async () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.starterGranted = true
  farm.orders.slots[0] = {
    order: {
      id: 'order:1', requirements: { 'crop:wheat': 4 }, materialValue: 8,
      rewards: { coins: 10, farmExp: 8, seedReward: null }, createdAt: NOW,
    },
    regenerateAt: null,
  }
  farm.nextIds.order = 2
  const { service, log } = harness({ farm, inventory: { 'crop:wheat': 4 } })
  const result = await service.completeOrder({ slotIndex: 0 })
  assert.equal(result.ok, true)
  const commitIndex = log.indexOf('commit')
  const completedIndex = log.indexOf('farm:order:completed')
  const stateIndex = log.lastIndexOf('farm:state:changed')
  assert.ok(commitIndex >= 0 && completedIndex > commitIndex && stateIndex > completedIndex)
})

test('concurrent commands are serialized and each sees the prior commit', async () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.starterGranted = true
  const { service, data } = harness({ farm, inventory: { 'seed:wheat': 2 } })
  const [left, right] = await Promise.all([
    service.plant({ tileId: 'r1c1', cropId: 'crop:wheat' }),
    service.plant({ tileId: 'r1c2', cropId: 'crop:wheat' }),
  ])
  assert.equal(left.ok, true)
  assert.equal(right.ok, true)
  assert.deepEqual(data.inventory, {})
  assert.equal(data.farm.farms['basic-farm'].tiles.filter(tile => tile.crop).length, 2)
})

test('time settlement and successful command share one commit with settlement event first', async () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.starterGranted = true
  farm.orders.slots = farm.orders.slots.map(() => ({ order: null, regenerateAt: '2026-07-26T09:00:00.000Z' }))
  farm.processor.queue = [{
    id: 'processing-task:1', recipeId: 'recipe:cookie',
    inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 },
    durationMs: 1_800_000, enqueuedAt: '2026-07-26T07:00:00.000Z',
    startedAt: '2026-07-26T07:00:00.000Z',
    completesAt: '2026-07-26T07:30:00.000Z', status: 'running',
  }]
  const { service, calls, log, data } = harness({ farm, inventory: { 'seed:wheat': 1 } })
  const result = await service.plant({ tileId: 'r1c1', cropId: 'crop:wheat' })
  assert.equal(result.ok, true)
  assert.equal(calls.length, 1)
  assert.equal(data.inventory['food:cookie'], 3)
  assert.ok(log.indexOf('farm:processing:completed') < log.indexOf('farm:state:changed'))
})

test('failed command commits settlement only, while a true no-op commits nothing', async () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.starterGranted = true
  farm.orders.slots = farm.orders.slots.map(() => ({ order: null, regenerateAt: '2026-07-26T09:00:00.000Z' }))
  farm.processor.queue = [{
    id: 'processing-task:1', recipeId: 'recipe:cookie',
    inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 },
    durationMs: 1_800_000, enqueuedAt: '2026-07-26T07:00:00.000Z',
    startedAt: '2026-07-26T07:00:00.000Z',
    completesAt: '2026-07-26T07:30:00.000Z', status: 'running',
  }]
  const first = harness({ farm, inventory: {}, coins: 0 })
  const failed = await first.service.plant({ tileId: 'r1c1', cropId: 'crop:wheat', quickBuy: true })
  assert.equal(failed.ok, false)
  assert.equal(first.calls.length, 1)
  assert.deepEqual(first.data.inventory, { 'food:cookie': 3 })
  assert.equal(first.log.includes('farm:crop:harvested'), false)

  const second = harness({ farm: first.data.farm, inventory: first.data.inventory, coins: 0 })
  const noOp = await second.service.settle()
  assert.equal(noOp.committed, false)
  assert.equal(second.calls.length, 0)
})

test('harvest that makes an order ready records and emits readiness in the same commit', async () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.starterGranted = true
  const tile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r1c1')
  tile.crop = matureWheat()
  farm.orders.slots = [
    {
      order: {
        id: 'order:1', requirements: { 'crop:wheat': 4 }, materialValue: 8,
        rewards: { coins: 10, farmExp: 8, seedReward: null }, createdAt: NOW,
      },
      regenerateAt: null,
    },
    { order: null, regenerateAt: '2026-07-26T09:00:00.000Z' },
    { order: null, regenerateAt: '2026-07-26T09:00:00.000Z' },
  ]
  const { service, data, calls, log } = harness({ farm, inventory: {} })
  assert.equal((await service.harvest({ tileId: 'r1c1' })).ok, true)
  assert.equal(calls.length, 1)
  assert.deepEqual(data.farm.notificationState.notifiedReadyOrderIds, ['order:1'])
  assert.equal(log.filter(entry => entry === 'farm:order:ready').length, 1)
  assert.ok(log.indexOf('farm:crop:harvested') < log.indexOf('farm:order:ready'))
  assert.ok(log.indexOf('farm:order:ready') < log.indexOf('farm:state:changed'))
  await service.settle()
  assert.equal(log.filter(entry => entry === 'farm:order:ready').length, 1)
})

test('claimBird rejects invalid and duplicate IDs, then resets count and IDs across local date', async () => {
  let current = NOW
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.starterGranted = true
  farm.orders.slots = farm.orders.slots.map(() => ({ order: null, regenerateAt: '2026-07-26T09:00:00.000Z' }))
  const { service, data, calls, log } = harness({ farm }, () => current)

  assert.equal((await service.claimBird({ birdId: '' })).ok, false)
  assert.equal(calls.length, 0)
  assert.equal((await service.claimBird({ birdId: 'bird:first' })).ok, true)
  assert.equal(data.farm.daily.birdRewardCount, 1)
  assert.deepEqual(data.farm.daily.claimedBirdIds, ['bird:first'])
  assert.equal((await service.claimBird({ birdId: 'bird:first' })).ok, false)
  assert.equal(calls.length, 1)
  assert.equal(log.filter(entry => entry === 'farm:bird:rewarded').length, 1)

  current = '2026-07-27T08:00:00.000Z'
  assert.equal((await service.claimBird({ birdId: 'bird:first' })).ok, true)
  assert.equal(data.farm.daily.birdRewardDate, '2026-07-27')
  assert.equal(data.farm.daily.birdRewardCount, 1)
  assert.deepEqual(data.farm.daily.claimedBirdIds, ['bird:first'])
})

function matureWheat() {
  return {
    cropId: 'crop:wheat',
    seedId: 'seed:wheat',
    plantedAt: '2026-07-26T07:30:00.000Z',
    readyAt: NOW,
    baseYield: 4,
    harvestExp: 1,
    snapshot: {
      baseDurationMs: 1_800_000,
      durationMs: 1_800_000,
      baseYield: 4,
      landMultiplier: 1,
      scarecrow: 0,
      farmYieldMultiplier: 1,
      quantity: 4,
      bonusDropChance: 0,
      contributingBuildingIds: [],
    },
  }
}
