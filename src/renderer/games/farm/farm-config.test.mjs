import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUILDINGS,
  CROPS,
  FARM_CONFIG,
  FARM_LEVELS,
  FARMS,
  LAND_UNLOCKS,
  ORDER_CONFIG,
  RECIPES,
  validateFarmConfig,
} from './farm-config.mjs'
import { getItem } from '../../shared/item-config.js'

test('approved config validates', () => {
  assert.deepEqual(validateFarmConfig(FARM_CONFIG), [])
})

test('validator reports missing recipe ingredient and duplicate tile', () => {
  const broken = structuredClone(FARM_CONFIG)
  broken.recipes['recipe:test'] = {
    inputs: { 'missing:item': 1 },
    outputs: { 'food:test': 1 },
    durationMs: 1,
    unlockFarmLevel: 1,
  }
  broken.farms['basic-farm'].tiles.push({ id: 'r0c0', row: 0, col: 0 })
  assert.deepEqual(
    validateFarmConfig(broken).map(error => error.code),
    ['UNKNOWN_ITEM', 'UNKNOWN_ITEM', 'DUPLICATE_TILE'],
  )
})

test('crop, recipe and building numbers exactly match the approved tables', () => {
  assert.deepEqual(
    Object.values(CROPS).map(crop => [crop.durationMs, crop.baseYield, crop.seedPrice, crop.sellPrice, crop.unlockFarmLevel, crop.harvestExp]),
    [
      [900_000, 4, 4, 2, 1, 1],
      [1_800_000, 4, 8, 4, 1, 2],
      [3_600_000, 4, 15, 8, 2, 4],
      [7_200_000, 4, 30, 16, 3, 7],
      [21_600_000, 4, 80, 45, 5, 15],
      [43_200_000, 4, 160, 90, 7, 25],
    ],
  )
  assert.equal(RECIPES['recipe:cookie'].outputs['food:cookie'], 3)
  assert.equal(RECIPES['recipe:pumpkin-pie'].durationMs, 21_600_000)
  assert.deepEqual(BUILDINGS['building:sprinkler'].levels[3], {
    range: 8,
    effect: 0.4,
    unlockFarmLevel: 7,
    cost: 360,
  })
})

test('all crop commerce values match the shared catalog', () => {
  for (const [cropId, crop] of Object.entries(CROPS)) {
    assert.equal(getItem(crop.seedId).buyPrice, crop.seedPrice)
    assert.equal(getItem(crop.seedId).unlockFarmLevel, crop.unlockFarmLevel)
    assert.equal(getItem(cropId).sellPrice, crop.sellPrice)
  }
})

test('validator reports stable shared catalog commerce mismatches', () => {
  const broken = structuredClone(FARM_CONFIG)
  broken.items['seed:wheat'].buyPrice = 99
  broken.items['seed:carrot'].unlockFarmLevel = 9
  broken.items['crop:corn'].sellPrice = 99

  assert.deepEqual(
    validateFarmConfig(broken).filter(error => error.code.includes('MISMATCH')),
    [
      { code: 'SEED_PRICE_MISMATCH', path: 'crops.crop:wheat.seedPrice' },
      { code: 'SEED_UNLOCK_MISMATCH', path: 'crops.crop:carrot.unlockFarmLevel' },
      { code: 'CROP_SELL_PRICE_MISMATCH', path: 'crops.crop:corn.sellPrice' },
    ],
  )
})

test('map, level and order configuration preserve launch constraints', () => {
  assert.equal(FARMS['basic-farm'].tiles.length, 16)
  assert.deepEqual(
    FARMS['basic-farm'].tiles.filter(tile => tile.initiallyUnlocked).map(tile => tile.id),
    ['r1c1', 'r1c2', 'r2c1', 'r2c2'],
  )
  assert.deepEqual(LAND_UNLOCKS.map(entry => entry.petLevel), [1, 2, 4, 6, 8, 10, 12])
  assert.deepEqual(FARM_LEVELS.map(entry => entry.requiredExp), [30, 60, 100, 160, 240, 350, 500, 700, 950, null])
  assert.equal(ORDER_CONFIG.twoLineChance, 0.3)
  assert.equal(ORDER_CONFIG.seedRewardChance, 0.15)
  assert.equal(ORDER_CONFIG.abandonCooldownMs, 1_800_000)
})

test('validator rejects malformed IDs, probabilities and initial map shape', () => {
  const broken = structuredClone(FARM_CONFIG)
  broken.items.bad = { id: 'bad', category: 'crop' }
  broken.rewards.baseBonusDropChance = 2
  broken.farms['basic-farm'].tiles.find(tile => tile.id === 'r0c0').initiallyUnlocked = true
  assert.deepEqual(validateFarmConfig(broken).map(error => error.code), [
    'INVALID_ITEM_ID',
    'INVALID_PROBABILITY',
    'INVALID_INITIAL_TILES',
  ])
})
