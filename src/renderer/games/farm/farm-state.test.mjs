import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDefaultFarmState,
  migrateFarmState,
  validateFarmState,
} from './farm-state.mjs'
import { generateOrder } from './farm-orders.mjs'

const NOW = '2026-07-26T08:00:00.000Z'

test('default state has four central fields, three slots and approved metadata', () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  assert.equal(farm.schemaVersion, 1)
  assert.equal(farm.farms['basic-farm'].tiles.filter(tile => tile.occupancy === 'field').length, 4)
  assert.equal(farm.farms['basic-farm'].tiles.filter(tile => tile.occupancy === 'locked').length, 12)
  assert.equal(farm.orders.slots.length, 3)
  assert.equal(farm.starterGranted, false)
  assert.deepEqual(farm.nextIds, { order: 1, processingTask: 1, building: 1 })
  assert.deepEqual(farm.notificationState, {
    notifiedReadyOrderIds: [],
    lastCompletedProcessingTaskId: null,
  })
  assert.deepEqual(farm.daily.claimedBirdIds, [])
  assert.deepEqual(validateFarmState(farm), [])
})

test('migration repairs invalid tile records locally and is idempotent', () => {
  const valid = createDefaultFarmState(NOW, () => 0.5)
  const broken = structuredClone(valid)
  broken.farms['basic-farm'].tiles = broken.farms['basic-farm'].tiles.filter(tile => tile.id !== 'r0c0')
  broken.farms['basic-farm'].tiles.push({ id: 'unknown', occupancy: 'field', landLevel: 99 })
  const central = broken.farms['basic-farm'].tiles.find(tile => tile.id === 'r1c1')
  central.landLevel = 9
  central.crop = { cropId: 'crop:missing' }

  const first = migrateFarmState(broken, NOW, () => 0.5)
  const second = migrateFarmState(first.state, NOW, () => 0.5)

  assert.equal(first.state.farms['basic-farm'].tiles.length, 16)
  assert.equal(first.state.farms['basic-farm'].tiles.some(tile => tile.id === 'unknown'), false)
  assert.equal(first.state.farms['basic-farm'].tiles.find(tile => tile.id === 'r0c0').occupancy, 'locked')
  assert.equal(first.state.farms['basic-farm'].tiles.find(tile => tile.id === 'r1c1').landLevel, 3)
  assert.equal(first.state.farms['basic-farm'].tiles.find(tile => tile.id === 'r1c1').crop, null)
  assert.deepEqual(second.state, first.state)
  assert.deepEqual(validateFarmState(first.state), [])
})

test('migration drops individual invalid records, re-chains processing and repairs counters', () => {
  const valid = createDefaultFarmState(NOW, () => 0.5)
  const broken = structuredClone(valid)
  broken.processor.queue = [
    { id: 'processing-task:7', recipeId: 'missing', inputs: {}, outputs: {}, enqueuedAt: NOW, startedAt: NOW, completesAt: NOW, status: 'running' },
    { id: 'processing-task:9', recipeId: 'recipe:cookie', inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 }, durationMs: 1_800_000, enqueuedAt: NOW, startedAt: null, completesAt: null, status: 'queued' },
  ]
  broken.orders.slots = [
    { order: { id: 'order:12', requirements: { 'crop:wheat': 4 }, materialValue: 8, rewards: { coins: 10, farmExp: 8, seedReward: null }, createdAt: NOW }, regenerateAt: null },
    { order: { id: 'bad', requirements: {}, rewards: {}, createdAt: NOW }, regenerateAt: null },
  ]
  broken.notificationState.notifiedReadyOrderIds = ['order:12', 'missing', 'order:12']
  broken.nextIds = { order: 1, processingTask: 1, building: 0 }

  const { state } = migrateFarmState(broken, NOW, () => 0.5)
  assert.equal(state.processor.queue.length, 1)
  assert.equal(state.processor.queue[0].id, 'processing-task:9')
  assert.equal(state.processor.queue[0].status, 'running')
  assert.equal(state.processor.queue[0].startedAt, NOW)
  assert.equal(state.orders.slots.length, 3)
  assert.equal(state.orders.slots[1].order, null)
  assert.equal(state.orders.slots[1].regenerateAt, NOW)
  assert.deepEqual(state.nextIds, { order: 13, processingTask: 10, building: 1 })
  assert.deepEqual(state.notificationState.notifiedReadyOrderIds, ['order:12'])
})

test('migration preserves a valid generated order with seed reward and stays idempotent', () => {
  const generated = generateOrder({
    farmLevel: 2,
    existingOrders: [],
    nextId: 4,
    now: NOW,
    random: sequence([0, 0, 0.149, 0.99]),
  })
  assert.deepEqual(generated.order.rewards.seedReward, { itemId: 'seed:wheat', count: 1 })
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.orders.slots[0] = { order: generated.order, regenerateAt: null }

  const first = migrateFarmState(farm, NOW, () => 0)
  const second = migrateFarmState(first.state, NOW, () => 0)
  assert.deepEqual(first.state.orders.slots[0].order, generated.order)
  assert.deepEqual(second.state, first.state)
})

test('migration keeps only the first duplicate building, task and order ID and repairs next IDs', () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  const tiles = farm.farms['basic-farm'].tiles
  const firstTile = tiles.find(tile => tile.id === 'r1c1')
  const duplicateTile = tiles.find(tile => tile.id === 'r1c2')
  firstTile.occupancy = 'building'
  firstTile.landLevel = 2
  firstTile.building = { id: 'building:7', typeId: 'building:sprinkler', level: 1, investedCoins: 60 }
  duplicateTile.occupancy = 'building'
  duplicateTile.landLevel = 3
  duplicateTile.building = { id: 'building:7', typeId: 'building:scarecrow', level: 1, investedCoins: 140 }

  farm.processor.queue = [
    validRunningTask('processing-task:5'),
    { ...validQueuedTask('processing-task:5') },
    validQueuedTask('processing-task:9'),
  ]
  const firstOrder = validOrder('order:4')
  farm.orders.slots = [
    { order: firstOrder, regenerateAt: null },
    { order: { ...firstOrder }, regenerateAt: null },
    { order: validOrder('order:11'), regenerateAt: null },
  ]
  farm.nextIds = { order: 1, processingTask: 1, building: 1 }

  const first = migrateFarmState(farm, NOW, () => 0)
  const second = migrateFarmState(first.state, NOW, () => 0)
  const repairedTiles = first.state.farms['basic-farm'].tiles
  assert.equal(repairedTiles.find(tile => tile.id === 'r1c1').building.id, 'building:7')
  assert.equal(repairedTiles.find(tile => tile.id === 'r1c2').occupancy, 'field')
  assert.equal(repairedTiles.find(tile => tile.id === 'r1c2').landLevel, 3)
  assert.deepEqual(first.state.processor.queue.map(task => task.id), ['processing-task:5', 'processing-task:9'])
  assert.equal(first.state.orders.slots[1].order, null)
  assert.equal(first.state.orders.slots[1].regenerateAt, NOW)
  assert.deepEqual(first.state.nextIds, { order: 12, processingTask: 10, building: 8 })
  assert.deepEqual(second.state, first.state)
})

test('migration removes invalid active timing, re-chains valid queued work and becomes settleable', () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.processor.queue = [
    {
      ...validRunningTask('processing-task:1'),
      completesAt: 'not-a-date',
    },
    validQueuedTask('processing-task:2'),
  ]
  const first = migrateFarmState(farm, NOW, () => 0)
  const second = migrateFarmState(first.state, NOW, () => 0)
  assert.equal(first.state.processor.queue.length, 1)
  assert.equal(first.state.processor.queue[0].id, 'processing-task:2')
  assert.equal(first.state.processor.queue[0].status, 'running')
  assert.equal(first.state.processor.queue[0].startedAt, NOW)
  assert.equal(first.state.processor.queue[0].completesAt, '2026-07-26T08:30:00.000Z')
  assert.deepEqual(second.state, first.state)
})

test('migration restores a damaged non-central opened tile to empty field with land level', () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  const tile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r0c1')
  tile.occupancy = 'damaged'
  tile.landLevel = 2
  const { state } = migrateFarmState(farm, NOW, () => 0)
  const repaired = state.farms['basic-farm'].tiles.find(entry => entry.id === 'r0c1')
  assert.equal(repaired.occupancy, 'field')
  assert.equal(repaired.landLevel, 2)
  assert.equal(repaired.crop, null)
})

test('migration cleans and bounds claimed bird IDs and resets them with invalid date', () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.daily = {
    birdRewardDate: '2026-07-26',
    birdRewardCount: 12,
    claimedBirdIds: ['', 'bird:a', 'bird:a', null, ...Array.from({ length: 12 }, (_, index) => `bird:${index}`)],
  }
  const first = migrateFarmState(farm, NOW, () => 0)
  assert.equal(first.state.daily.claimedBirdIds.length, 10)
  assert.equal(new Set(first.state.daily.claimedBirdIds).size, 10)
  assert.equal(first.state.daily.birdRewardCount, 10)

  first.state.daily.birdRewardDate = 'invalid'
  const reset = migrateFarmState(first.state, NOW, () => 0)
  assert.deepEqual(reset.state.daily, {
    birdRewardDate: '2026-07-26',
    birdRewardCount: 0,
    claimedBirdIds: [],
  })
})

test('migration clears crops with incomplete or unsafe runtime snapshots while preserving land', () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  const tiles = farm.farms['basic-farm'].tiles.filter(tile => tile.occupancy === 'field')
  const invalidCrops = [
    {
      cropId: 'crop:wheat',
      plantedAt: NOW,
      readyAt: NOW,
      baseYield: 4,
      snapshot: {},
    },
    { ...validCrop(), seedId: 'seed:carrot' },
    { ...validCrop(), readyAt: '2026-07-26T07:59:59.999Z' },
    {
      ...validCrop(),
      snapshot: { ...validCrop().snapshot, contributingBuildingIds: ['bad-building-id'] },
    },
  ]
  invalidCrops.forEach((crop, index) => {
    tiles[index].landLevel = index + 1 > 3 ? 3 : index + 1
    tiles[index].crop = crop
  })

  const first = migrateFarmState(farm, NOW, () => 0)
  const second = migrateFarmState(first.state, NOW, () => 0)
  const repaired = first.state.farms['basic-farm'].tiles.filter(tile => tile.occupancy === 'field')
  assert.deepEqual(repaired.map(tile => tile.crop), [null, null, null, null])
  assert.deepEqual(repaired.map(tile => tile.landLevel), [1, 2, 3, 3])
  assert.deepEqual(second.state, first.state)
})

test('migration rejects unknown order items and missing material snapshots without affecting other slots', () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.orders.slots = [
    { order: validOrder('order:1'), regenerateAt: null },
    {
      order: {
        ...validOrder('order:2'),
        requirements: { 'missing:item': 1 },
      },
      regenerateAt: null,
    },
    {
      order: {
        ...validOrder('order:3'),
        materialValue: undefined,
      },
      regenerateAt: null,
    },
  ]

  const { state } = migrateFarmState(farm, NOW, () => 0)
  assert.deepEqual(state.orders.slots[0], farm.orders.slots[0])
  assert.deepEqual(state.orders.slots[1], { order: null, regenerateAt: NOW })
  assert.deepEqual(state.orders.slots[2], { order: null, regenerateAt: NOW })
})

test('migration keeps only the first running task, normalizes later tasks and drops unknown items', () => {
  const farm = createDefaultFarmState(NOW, () => 0)
  farm.processor.queue = [
    validRunningTask('processing-task:1'),
    validRunningTask('processing-task:2'),
    {
      ...validQueuedTask('processing-task:3'),
      inputs: { 'missing:item': 1 },
    },
  ]

  const first = migrateFarmState(farm, NOW, () => 0)
  const second = migrateFarmState(first.state, NOW, () => 0)
  assert.deepEqual(first.state.processor.queue.map(task => ({
    id: task.id,
    status: task.status,
    startedAt: task.startedAt,
    completesAt: task.completesAt,
  })), [
    {
      id: 'processing-task:1',
      status: 'running',
      startedAt: NOW,
      completesAt: '2026-07-26T08:30:00.000Z',
    },
    {
      id: 'processing-task:2',
      status: 'queued',
      startedAt: null,
      completesAt: null,
    },
  ])
  assert.deepEqual(second.state, first.state)
})

function validRunningTask(id) {
  return {
    id,
    recipeId: 'recipe:cookie',
    inputs: { 'crop:wheat': 2 },
    outputs: { 'food:cookie': 3 },
    durationMs: 1_800_000,
    enqueuedAt: NOW,
    startedAt: NOW,
    completesAt: '2026-07-26T08:30:00.000Z',
    status: 'running',
  }
}

function validCrop() {
  return {
    cropId: 'crop:wheat',
    seedId: 'seed:wheat',
    plantedAt: NOW,
    readyAt: '2026-07-26T08:30:00.000Z',
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
      bonusDropChance: 0.03,
      contributingBuildingIds: [],
    },
  }
}

function validQueuedTask(id) {
  return {
    ...validRunningTask(id),
    startedAt: null,
    completesAt: null,
    status: 'queued',
  }
}

function validOrder(id) {
  return {
    id,
    requirements: { 'crop:wheat': 4 },
    materialValue: 8,
    rewards: { coins: 10, farmExp: 8, seedReward: null },
    createdAt: NOW,
  }
}

function sequence(values) {
  let index = 0
  return () => values[index++] ?? 0
}
