import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFarmSceneSnapshot,
  cropStageFor,
} from './farm-scene-model.mjs'
import { buildFarmViewModel } from './farm-ui.js'
import { createDefaultFarmState } from './farm-state.mjs'

const PLANTED_AT = '2026-07-29T00:00:00.000Z'
const READY_AT = '2026-07-29T00:00:10.000Z'

function atProgress(progress) {
  return new Date(Date.parse(PLANTED_AT) + (10_000 * progress)).toISOString()
}

function crop(overrides = {}) {
  return {
    cropId: 'crop:wheat',
    plantedAt: PLANTED_AT,
    readyAt: READY_AT,
    ...overrides,
  }
}

function tile(index) {
  const row = Math.floor(index / 4)
  const col = index % 4
  return {
    id: `r${row}c${col}`,
    row,
    col,
    occupancy: index < 4 ? 'locked' : 'field',
    landLevel: index < 4 ? null : 1,
    crop: null,
    cropView: null,
    building: null,
    unlock: index < 4
      ? { eligible: index === 1, complete: index === 0, affordable: index % 2 === 0, price: 20 }
      : null,
  }
}

function sampleViewModel() {
  const tiles = Array.from({ length: 16 }, (_, index) => tile(index))
  tiles[4].crop = {
    ...crop(),
    snapshot: {
      quantity: 4,
      baseYield: 4,
      bonusDropChance: 0.03,
    },
  }
  tiles[4].cropView = {
    mature: false,
    quantity: 4,
    remaining: '7 秒',
  }
  tiles[5].occupancy = 'building'
  tiles[5].building = {
    id: 'building:1',
    typeId: 'building:sprinkler',
    level: 2,
    working: true,
    refundPreview: 105,
    nextCost: 360,
  }

  return {
    tiles,
    summary: {
      farmLevel: 3,
      farmExp: 17,
      matureFieldCount: 2,
      processing: { queuedCount: 1, nextCompletionAt: READY_AT },
      orders: { readyCount: 2 },
    },
    coins: 321,
    inventory: { 'seed:wheat': 99 },
    crops: [{ id: 'crop:wheat', quickBuyPrice: 4, seedCount: 99 }],
    buildings: [{ id: 'building:sprinkler', cost: 60 }],
    farmLevelRequiredExp: 100,
    petLevel: 8,
    now: atProgress(0.2),
    service: { plant() {} },
  }
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true)
  for (const nested of Object.values(value)) assertDeepFrozen(nested)
}

function collectKeys(value, keys = []) {
  if (value === null || typeof value !== 'object') return keys
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key)
    collectKeys(nested, keys)
  }
  return keys
}

test('cropStageFor locks exact progress boundaries and mature state', () => {
  const cases = [
    [-0.1, 1],
    [0, 1],
    [0.0999, 1],
    [0.10, 2],
    [0.3999, 2],
    [0.40, 3],
    [0.7499, 3],
    [0.75, 4],
    [1, 4],
    [1.1, 4],
  ]
  for (const [progress, expected] of cases) {
    assert.equal(cropStageFor(crop(), atProgress(progress)), expected)
  }
  assert.equal(cropStageFor(crop({ mature: true }), atProgress(0.01)), 4)
})

test('cropStageFor safely keeps invalid or reversed timelines at stage one', () => {
  assert.equal(cropStageFor(null, atProgress(0.5)), 1)
  assert.equal(cropStageFor(crop({ plantedAt: 'invalid' }), atProgress(0.5)), 1)
  assert.equal(cropStageFor(crop({ readyAt: 'invalid' }), atProgress(0.5)), 1)
  assert.equal(cropStageFor(crop(), 'invalid'), 1)
  assert.equal(cropStageFor(crop({ readyAt: PLANTED_AT }), atProgress(0.5)), 1)
  assert.equal(cropStageFor(crop({ readyAt: '2026-07-28T23:59:59.000Z' }), atProgress(0.5)), 1)
})

test('scene snapshot projects the approved visual contract from the existing view model', () => {
  const viewModel = sampleViewModel()
  const snapshot = buildFarmSceneSnapshot({
    viewModel,
    activeTab: 'field',
    selectedObject: { type: 'tile', id: 'r1c0', price: 20 },
    reducedMotion: false,
    bird: { birdId: 'bird:1', visible: true, claimBusy: true, reward: 3 },
  })

  assert.deepEqual(snapshot, {
    farmLevel: 3,
    coins: 321,
    activeTab: 'field',
    selectedObject: { type: 'tile', id: 'r1c0' },
    motionReduced: false,
    summary: {
      matureCount: 2,
      processingCount: 1,
      readyOrderCount: 2,
    },
    tiles: [
      {
        tileId: 'r0c0', row: 0, col: 0, occupancy: 'locked', landLevel: null,
        unlockState: 'complete', cropId: null, cropStage: null, mature: false,
        buildingId: null, buildingType: null, buildingLevel: null, buildingWorking: false,
      },
      {
        tileId: 'r0c1', row: 0, col: 1, occupancy: 'locked', landLevel: null,
        unlockState: 'eligible', cropId: null, cropStage: null, mature: false,
        buildingId: null, buildingType: null, buildingLevel: null, buildingWorking: false,
      },
      {
        tileId: 'r0c2', row: 0, col: 2, occupancy: 'locked', landLevel: null,
        unlockState: 'locked', cropId: null, cropStage: null, mature: false,
        buildingId: null, buildingType: null, buildingLevel: null, buildingWorking: false,
      },
      {
        tileId: 'r0c3', row: 0, col: 3, occupancy: 'locked', landLevel: null,
        unlockState: 'locked', cropId: null, cropStage: null, mature: false,
        buildingId: null, buildingType: null, buildingLevel: null, buildingWorking: false,
      },
      {
        tileId: 'r1c0', row: 1, col: 0, occupancy: 'field', landLevel: 1,
        unlockState: 'unlocked', cropId: 'crop:wheat', cropStage: 2, mature: false,
        buildingId: null, buildingType: null, buildingLevel: null, buildingWorking: false,
      },
      {
        tileId: 'r1c1', row: 1, col: 1, occupancy: 'building', landLevel: 1,
        unlockState: 'unlocked', cropId: null, cropStage: null, mature: false,
        buildingId: 'building:1', buildingType: 'building:sprinkler',
        buildingLevel: 2, buildingWorking: true,
      },
      ...Array.from({ length: 10 }, (_, offset) => {
        const index = offset + 6
        const row = Math.floor(index / 4)
        const col = index % 4
        return {
          tileId: `r${row}c${col}`, row, col, occupancy: 'field', landLevel: 1,
          unlockState: 'unlocked', cropId: null, cropStage: null, mature: false,
          buildingId: null, buildingType: null, buildingLevel: null, buildingWorking: false,
        }
      }),
    ],
    pet: { visible: true, moodTier: null },
    bird: { birdId: 'bird:1', visible: true, claimBusy: true },
  })
})

test('complete outranks eligible and affordability never changes visual unlock state', () => {
  const viewModel = sampleViewModel()
  viewModel.tiles[0].unlock = { complete: true, eligible: true, affordable: false }
  viewModel.tiles[1].unlock = { complete: false, eligible: true, affordable: false }
  viewModel.tiles[2].unlock = { complete: false, eligible: true, affordable: true }

  const snapshot = buildFarmSceneSnapshot({
    viewModel,
    activeTab: 'field',
    selectedObject: null,
    reducedMotion: true,
    bird: null,
  })

  assert.deepEqual(snapshot.tiles.slice(0, 3).map(entry => entry.unlockState), [
    'complete',
    'eligible',
    'eligible',
  ])
})

test('root coins are allowed while nested visual objects leak no economic or business fields', () => {
  const snapshot = buildFarmSceneSnapshot({
    viewModel: sampleViewModel(),
    activeTab: 'orders',
    selectedObject: null,
    reducedMotion: true,
    bird: null,
  })

  assert.equal(snapshot.coins, 321)
  for (const nested of [snapshot.summary, snapshot.tiles, snapshot.pet, snapshot.bird]) {
    const keys = collectKeys(nested)
    for (const forbidden of [
      'coins', 'inventory', 'price', 'quickBuyPrice', 'quantity', 'yield', 'reward',
      'cost', 'affordable', 'petLevel', 'farmExp', 'service', 'farmService', 'petState',
    ]) {
      assert.equal(keys.includes(forbidden), false, `${forbidden} leaked into visual object`)
    }
  }
  assert.equal(JSON.stringify(snapshot).includes('plant'), false)
})

test('snapshot construction does not mutate input and returns a deeply frozen copy', () => {
  const viewModel = sampleViewModel()
  const selectedObject = { type: 'tile', id: 'r1c0' }
  const bird = { birdId: 'bird:2', visible: true, claimBusy: false }
  const service = viewModel.service
  const serializableViewModel = { ...viewModel }
  delete serializableViewModel.service
  const original = structuredClone({ viewModel: serializableViewModel, selectedObject, bird })

  const snapshot = buildFarmSceneSnapshot({
    viewModel,
    activeTab: 'processing',
    selectedObject,
    reducedMotion: false,
    bird,
  })

  const actualSerializableViewModel = { ...viewModel }
  delete actualSerializableViewModel.service
  assert.deepEqual(
    { viewModel: actualSerializableViewModel, selectedObject, bird },
    original,
  )
  assert.equal(viewModel.service, service)
  assert.notEqual(snapshot.selectedObject, selectedObject)
  assert.notEqual(snapshot.bird, bird)
  assertDeepFrozen(snapshot)
  assert.throws(() => {
    snapshot.tiles[0].unlockState = 'eligible'
  }, TypeError)
})

test('object-valued identifiers and tabs never enter, freeze, or overflow the snapshot', () => {
  const selectedId = { marker: 'selected-id' }
  selectedId.self = selectedId
  const activeTab = { marker: 'active-tab' }
  activeTab.self = activeTab
  const birdId = { marker: 'bird-id' }
  birdId.self = birdId

  const snapshot = buildFarmSceneSnapshot({
    viewModel: sampleViewModel(),
    activeTab,
    selectedObject: { type: 'tile', id: selectedId },
    reducedMotion: false,
    bird: { birdId, visible: true, claimBusy: true },
  })

  assert.equal(snapshot.activeTab, 'field')
  assert.equal(snapshot.selectedObject, null)
  assert.deepEqual(snapshot.bird, { birdId: null, visible: true, claimBusy: true })
  assert.doesNotThrow(() => JSON.stringify(snapshot))
  for (const input of [selectedId, activeTab, birdId]) {
    assert.equal(Object.isFrozen(input), false)
    assert.equal(input.self, input)
    assert.match(input.marker, /^(selected-id|active-tab|bird-id)$/)
  }

  assert.equal(buildFarmSceneSnapshot({
    viewModel: sampleViewModel(),
    activeTab: 'processing',
    selectedObject: { type: '', id: 'r1c0' },
    reducedMotion: false,
    bird: { birdId: '', visible: false, claimBusy: false },
  }).selectedObject, null)
})

test('scene snapshot consumes a real buildFarmViewModel output contract', () => {
  const farm = createDefaultFarmState(PLANTED_AT, () => 0.5)
  const viewModel = buildFarmViewModel({
    farm,
    inventory: {},
    coins: 77,
    petLevel: 1,
  }, undefined, PLANTED_AT)

  const snapshot = buildFarmSceneSnapshot({
    viewModel,
    activeTab: 'orders',
    selectedObject: null,
    reducedMotion: false,
    bird: null,
  })

  assert.equal(snapshot.tiles.length, 16)
  assert.equal(snapshot.tiles.filter(entry => entry.unlockState === 'unlocked').length, 4)
  assert.equal(snapshot.farmLevel, 1)
  assert.equal(snapshot.coins, 77)
  assert.deepEqual(snapshot.pet, { visible: true, moodTier: null })
})
