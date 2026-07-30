import test from 'node:test'
import assert from 'node:assert/strict'

import { layoutFarmScene } from './farm-scene-layout.mjs'

const logicalSize = Object.freeze({ width: 1200, height: 720 })
const sceneConfig = Object.freeze({
  safeRect: Object.freeze({ x: 300, y: 190, width: 600, height: 420 }),
  tileGrid: Object.freeze({
    origin: Object.freeze({ x: 600, y: 280 }),
    columnStep: Object.freeze({ x: 72, y: 44 }),
    rowStep: Object.freeze({ x: -72, y: 44 }),
    hitSize: Object.freeze({ width: 132, height: 82 }),
  }),
  processing: Object.freeze({ x: 1010, y: 225 }),
  orders: Object.freeze({ x: 1060, y: 365 }),
  pet: Object.freeze({ x: 1010, y: 560 }),
  bird: Object.freeze({ x: 930, y: 160 }),
})

function tile(tileId, row, col, overrides = {}) {
  return {
    tileId,
    row,
    col,
    occupancy: 'empty',
    landLevel: 1,
    unlockState: 'unlocked',
    cropId: null,
    cropStage: null,
    mature: false,
    buildingId: null,
    buildingType: null,
    buildingLevel: null,
    buildingWorking: false,
    ...overrides,
  }
}

function snapshot() {
  const tiles = []
  for (let row = 3; row >= 0; row -= 1) {
    for (let col = 3; col >= 0; col -= 1) {
      tiles.push(tile(`r${row}c${col}`, row, col))
    }
  }
  return {
    tiles,
    pet: { visible: true, moodTier: null },
    bird: { birdId: 'bird:1', visible: true, claimBusy: false },
  }
}

test('maps sixteen tiles into unique safe hit areas in exact stable order', () => {
  const source = snapshot()
  const original = structuredClone(source)
  const layout = layoutFarmScene(source, logicalSize, sceneConfig)

  assert.equal(layout.tiles.length, 16)
  assert.deepEqual(
    layout.tiles.map(record => record.tileId),
    Array.from({ length: 4 }, (_, row) => (
      Array.from({ length: 4 }, (_, col) => `r${row}c${col}`)
    )).flat(),
  )
  assert.equal(
    new Set(layout.tiles.map(record => (
      `${record.hitArea.x}:${record.hitArea.y}:${record.hitArea.width}:${record.hitArea.height}`
    ))).size,
    16,
  )
  for (const record of layout.tiles) {
    assert.ok(record.hitArea.x >= sceneConfig.safeRect.x)
    assert.ok(record.hitArea.y >= sceneConfig.safeRect.y)
    assert.ok(
      record.hitArea.x + record.hitArea.width
      <= sceneConfig.safeRect.x + sceneConfig.safeRect.width,
    )
    assert.ok(
      record.hitArea.y + record.hitArea.height
      <= sceneConfig.safeRect.y + sceneConfig.safeRect.height,
    )
  }
  assert.deepEqual(source, original)
  assert.ok(Object.isFrozen(layout))
  assert.ok(Object.isFrozen(layout.tiles))
  assert.ok(Object.isFrozen(layout.tiles[0].hitArea))
})

test('uses the configured row and column vectors and exposes bottom sort values', () => {
  const source = snapshot()
  const layout = layoutFarmScene(source, logicalSize, sceneConfig)

  assert.deepEqual(
    layout.tiles.find(record => record.tileId === 'r0c0').center,
    { x: 600, y: 280 },
  )
  assert.deepEqual(
    layout.tiles.find(record => record.tileId === 'r2c3').center,
    { x: 672, y: 500 },
  )
  for (const record of layout.tiles) {
    assert.equal(record.sortY, record.center.y + (sceneConfig.tileGrid.hitSize.height / 2))
  }
})

test('preserves visual tile fields without deriving business rules', () => {
  const source = snapshot()
  Object.assign(source.tiles[0], {
    occupancy: 'building',
    landLevel: 3,
    unlockState: 'eligible',
    cropId: 'star-dew-fruit',
    cropStage: 4,
    mature: true,
    buildingId: 'building:9',
    buildingType: 'compost-bin',
    buildingLevel: 2,
    buildingWorking: true,
  })
  const record = layoutFarmScene(source, logicalSize, sceneConfig).tiles.find(
    entry => entry.tileId === source.tiles[0].tileId,
  )

  assert.equal(record.occupancy, 'building')
  assert.equal(record.landLevel, 3)
  assert.equal(record.unlockState, 'eligible')
  assert.equal(record.cropId, 'star-dew-fruit')
  assert.equal(record.cropStage, 4)
  assert.equal(record.mature, true)
  assert.equal(record.buildingId, 'building:9')
  assert.equal(record.buildingType, 'compost-bin')
  assert.equal(record.buildingLevel, 2)
  assert.equal(record.buildingWorking, true)
  assert.equal(record.adjacent, undefined)
  assert.equal(record.bonus, undefined)
})

test('keeps fixed semantic records at configured coordinates outside field centers', () => {
  const layout = layoutFarmScene(snapshot(), logicalSize, sceneConfig)
  const centers = new Set(layout.tiles.map(record => `${record.center.x}:${record.center.y}`))

  assert.deepEqual(layout.processing, {
    key: 'processing',
    x: 1010,
    y: 225,
    sortY: 225,
  })
  assert.deepEqual(layout.orders, {
    key: 'orders',
    x: 1060,
    y: 365,
    sortY: 365,
  })
  assert.deepEqual(layout.pet, {
    key: 'pet',
    x: 1010,
    y: 560,
    sortY: 560,
    visible: true,
    moodTier: null,
  })
  assert.deepEqual(layout.bird, {
    key: 'bird',
    x: 930,
    y: 160,
    sortY: 160,
    birdId: 'bird:1',
    visible: true,
    claimBusy: false,
  })
  for (const record of [layout.processing, layout.orders, layout.pet, layout.bird]) {
    assert.equal(centers.has(`${record.x}:${record.y}`), false)
  }
})

test('rejects duplicate tile ids and duplicate row/column coordinates', () => {
  const duplicateId = snapshot()
  duplicateId.tiles[1].tileId = duplicateId.tiles[0].tileId
  assert.throws(
    () => layoutFarmScene(duplicateId, logicalSize, sceneConfig),
    /INVALID_FARM_SCENE_LAYOUT:DUPLICATE_TILE_ID/,
  )

  const duplicateCoordinate = snapshot()
  duplicateCoordinate.tiles[1].row = duplicateCoordinate.tiles[0].row
  duplicateCoordinate.tiles[1].col = duplicateCoordinate.tiles[0].col
  assert.throws(
    () => layoutFarmScene(duplicateCoordinate, logicalSize, sceneConfig),
    /INVALID_FARM_SCENE_LAYOUT:DUPLICATE_TILE_COORDINATE/,
  )
})

test('requires tile coordinates to cover the exact four by four grid', () => {
  const source = snapshot()
  source.tiles.find(record => record.row === 3 && record.col === 1).row = 4

  assert.throws(
    () => layoutFarmScene(source, logicalSize, sceneConfig),
    /INVALID_FARM_SCENE_LAYOUT:INVALID_TILE/,
  )
})

test('rejects non-primitive projected fields without freezing or mutating the input', () => {
  const fieldCases = [
    ['occupancy', {}],
    ['landLevel', []],
    ['unlockState', () => {}],
    ['cropId', Symbol('crop')],
    ['cropStage', {}],
    ['mature', []],
    ['buildingId', () => {}],
    ['buildingType', Symbol('building')],
    ['buildingLevel', {}],
    ['buildingWorking', []],
  ]
  for (const [field, value] of fieldCases) {
    const source = snapshot()
    source.tiles[0][field] = value
    assert.throws(
      () => layoutFarmScene(source, logicalSize, sceneConfig),
      /INVALID_FARM_SCENE_LAYOUT:INVALID_TILE_VISUAL_FIELD/,
    )
    assert.equal(Object.isFrozen(source), false)
    assert.equal(Object.isFrozen(source.tiles), false)
    if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
      assert.equal(Object.isFrozen(value), false)
    }
  }

  const circular = {}
  circular.self = circular
  const petSource = snapshot()
  petSource.pet.moodTier = circular
  assert.throws(
    () => layoutFarmScene(petSource, logicalSize, sceneConfig),
    /INVALID_FARM_SCENE_LAYOUT:INVALID_PET_VISUAL_FIELD/,
  )
  assert.equal(Object.isFrozen(circular), false)
})

test('rejects invalid logical size, scene geometry, tile records and unsafe layouts', () => {
  const cases = [
    [{ width: 0, height: 720 }, sceneConfig, snapshot(), 'INVALID_LOGICAL_SIZE'],
    [logicalSize, { ...sceneConfig, safeRect: { x: -1, y: 0, width: 1, height: 1 } }, snapshot(), 'INVALID_SAFE_RECT'],
    [logicalSize, { ...sceneConfig, tileGrid: { ...sceneConfig.tileGrid, columnStep: { x: 0, y: 0 } } }, snapshot(), 'INVALID_TILE_GRID'],
    [logicalSize, { ...sceneConfig, pet: { x: Number.NaN, y: 0 } }, snapshot(), 'INVALID_FIXED_POSITION'],
    [logicalSize, sceneConfig, (() => {
      const source = snapshot()
      source.tiles[0].tileId = ''
      return source
    })(), 'INVALID_TILE'],
    [logicalSize, {
      ...sceneConfig,
      safeRect: { x: 319, y: 190, width: 581, height: 420 },
    }, snapshot(), 'TILE_OUTSIDE_SAFE_RECT'],
  ]

  for (const [size, config, source, code] of cases) {
    assert.throws(
      () => layoutFarmScene(source, size, config),
      new RegExp(`INVALID_FARM_SCENE_LAYOUT:${code}`),
    )
  }
})
