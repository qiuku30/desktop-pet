import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adjacentTileIds,
  buildingEffectForTile,
  calculateHarvest,
  calculatePlantSnapshot,
  canUnlockTile,
  isCropMature,
} from './farm-rules.mjs'

test('level one uses four-neighbor and level two uses eight-neighbor', () => {
  assert.deepEqual(adjacentTileIds('r1c1', 1).sort(), ['r0c1', 'r1c0', 'r1c2', 'r2c1'])
  assert.equal(adjacentTileIds('r1c1', 2).length, 8)
  assert.deepEqual(adjacentTileIds('r0c0', 3).sort(), ['r0c1', 'r1c0', 'r1c1'])
})

test('only a locked four-neighbor of an open tile can unlock', () => {
  const tiles = [
    { id: 'r1c1', occupancy: 'field' },
    { id: 'r1c2', occupancy: 'locked' },
    { id: 'r2c2', occupancy: 'locked' },
  ]
  assert.equal(canUnlockTile(tiles, 'r1c2'), true)
  assert.equal(canUnlockTile(tiles, 'r2c2'), false)
  assert.equal(canUnlockTile([{ id: 'r1c2', occupancy: 'field' }], 'r1c2'), false)
})

test('same building type uses highest level while different types stack', () => {
  const tiles = [
    { id: 'r1c1', occupancy: 'field' },
    { id: 'r1c0', occupancy: 'building', building: { id: 'building:1', typeId: 'building:sprinkler', level: 1 } },
    { id: 'r0c1', occupancy: 'building', building: { id: 'building:2', typeId: 'building:sprinkler', level: 3 } },
    { id: 'r2c1', occupancy: 'building', building: { id: 'building:3', typeId: 'building:scarecrow', level: 1 } },
  ]
  assert.deepEqual(buildingEffectForTile(tiles, 'r1c1'), {
    growthSpeed: 0.4,
    yield: 0.15,
    bonusDrop: 0,
    contributingBuildingIds: ['building:2', 'building:3'],
  })
})

test('60m crop with sprinkler 25% and happy 10% takes the configured divided duration', () => {
  const snapshot = calculatePlantSnapshot({
    baseDurationMs: 3_600_000,
    sprinkler: 0.25,
    mood: 0.1,
    farmSpeed: 0,
    baseYield: 4,
    landMultiplier: 1,
    scarecrow: 0,
    farmYieldMultiplier: 1,
    baseBonusDropChance: 0.03,
    compost: 0,
    contributingBuildingIds: [],
  })
  assert.equal(snapshot.durationMs, Math.round(3_600_000 / 1.25 / 1.1))
  assert.equal(snapshot.quantity, 4)
  assert.equal(snapshot.bonusDropChance, 0.03)
})

test('yield rounds once and bonus branches are deterministic at 3/11/18 percent', () => {
  assert.equal(calculateHarvest({
    cropId: 'crop:wheat',
    seedId: 'seed:wheat',
    baseYield: 4,
    landMultiplier: 1.25,
    scarecrow: 0.15,
    farmYieldMultiplier: 1,
    bonusDropChance: 0.11,
    random: () => 0.99,
  }).quantity, 6)

  const seed = calculateHarvest({
    cropId: 'crop:wheat', seedId: 'seed:wheat', quantity: 4,
    bonusDropChance: 0.03, random: sequence([0.029, 0.69]),
  })
  assert.deepEqual(seed.bonus, { items: { 'seed:wheat': 1 }, coins: 0 })

  const coins = calculateHarvest({
    cropId: 'crop:wheat', seedId: 'seed:wheat', quantity: 4,
    bonusDropChance: 0.18, random: sequence([0.17, 0.7, 0.99]),
  })
  assert.deepEqual(coins.bonus, { items: {}, coins: 3 })
})

test('mature crops remain mature forever and invalid or rolled-back time is safe', () => {
  const crop = { readyAt: '2026-07-26T09:00:00.000Z' }
  assert.equal(isCropMature(crop, '2026-07-26T09:00:00.000Z'), true)
  assert.equal(isCropMature(crop, '2030-01-01T00:00:00.000Z'), true)
  assert.equal(isCropMature(crop, '2026-07-26T08:00:00.000Z'), false)
  assert.equal(isCropMature({ readyAt: 'bad' }, '2026-07-26T10:00:00.000Z'), false)
})

function sequence(values) {
  let index = 0
  return () => values[index++]
}
