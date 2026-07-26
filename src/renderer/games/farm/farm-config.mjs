import { ITEMS } from '../../shared/item-config.js'

const minutes = value => value * 60_000
const freezeEntries = value => Object.freeze(Object.fromEntries(
  Object.entries(value).map(([key, entry]) => [key, Object.freeze(entry)]),
))

export const CROPS = freezeEntries({
  'crop:wheat': { seedId: 'seed:wheat', durationMs: minutes(15), baseYield: 4, seedPrice: 4, sellPrice: 2, unlockFarmLevel: 1, harvestExp: 1 },
  'crop:carrot': { seedId: 'seed:carrot', durationMs: minutes(30), baseYield: 4, seedPrice: 8, sellPrice: 4, unlockFarmLevel: 1, harvestExp: 2 },
  'crop:corn': { seedId: 'seed:corn', durationMs: minutes(60), baseYield: 4, seedPrice: 15, sellPrice: 8, unlockFarmLevel: 2, harvestExp: 4 },
  'crop:strawberry': { seedId: 'seed:strawberry', durationMs: minutes(120), baseYield: 4, seedPrice: 30, sellPrice: 16, unlockFarmLevel: 3, harvestExp: 7 },
  'crop:pumpkin': { seedId: 'seed:pumpkin', durationMs: minutes(360), baseYield: 4, seedPrice: 80, sellPrice: 45, unlockFarmLevel: 5, harvestExp: 15 },
  'crop:star-dew-fruit': { seedId: 'seed:star-dew-fruit', durationMs: minutes(720), baseYield: 4, seedPrice: 160, sellPrice: 90, unlockFarmLevel: 7, harvestExp: 25 },
})

export const RECIPES = freezeEntries({
  'recipe:cookie': { inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 }, durationMs: minutes(30), unlockFarmLevel: 1 },
  'recipe:popcorn': { inputs: { 'crop:corn': 2 }, outputs: { 'food:popcorn': 1 }, durationMs: minutes(60), unlockFarmLevel: 2 },
  'recipe:carrot-juice': { inputs: { 'crop:carrot': 2 }, outputs: { 'food:carrot-juice': 1 }, durationMs: minutes(60), unlockFarmLevel: 3 },
  'recipe:strawberry-milkshake': { inputs: { 'crop:strawberry': 2, 'food:milk': 1 }, outputs: { 'food:strawberry-milkshake': 1 }, durationMs: minutes(180), unlockFarmLevel: 4 },
  'recipe:pumpkin-pie': { inputs: { 'crop:pumpkin': 2, 'crop:wheat': 1 }, outputs: { 'food:pumpkin-pie': 1 }, durationMs: minutes(360), unlockFarmLevel: 6 },
})

export const BUILDINGS = freezeEntries({
  'building:sprinkler': {
    unlockFarmLevel: 2,
    effectType: 'growthSpeed',
    levels: Object.freeze({
      1: { range: 4, effect: 0.25, unlockFarmLevel: 2, cost: 60 },
      2: { range: 8, effect: 0.25, unlockFarmLevel: 4, cost: 150 },
      3: { range: 8, effect: 0.4, unlockFarmLevel: 7, cost: 360 },
    }),
  },
  'building:scarecrow': {
    unlockFarmLevel: 4,
    effectType: 'yield',
    levels: Object.freeze({
      1: { range: 4, effect: 0.15, unlockFarmLevel: 4, cost: 140 },
      2: { range: 8, effect: 0.15, unlockFarmLevel: 6, cost: 320 },
      3: { range: 8, effect: 0.25, unlockFarmLevel: 9, cost: 650 },
    }),
  },
  'building:compost-bin': {
    unlockFarmLevel: 6,
    effectType: 'bonusDrop',
    levels: Object.freeze({
      1: { range: 4, effect: 0.08, unlockFarmLevel: 6, cost: 280 },
      2: { range: 8, effect: 0.08, unlockFarmLevel: 8, cost: 600 },
      3: { range: 8, effect: 0.15, unlockFarmLevel: 10, cost: 1100 },
    }),
  },
})

const FARM_TILES = Object.freeze(Array.from({ length: 4 }, (_, row) =>
  Array.from({ length: 4 }, (_, col) => Object.freeze({
    id: `r${row}c${col}`,
    row,
    col,
    initiallyUnlocked: (row === 1 || row === 2) && (col === 1 || col === 2),
  })),
).flat())

export const FARMS = freezeEntries({
  'basic-farm': {
    rows: 4,
    cols: 4,
    growthSpeedBonus: 0,
    yieldMultiplier: 1,
    tiles: FARM_TILES,
  },
})

export const FARM_LEVELS = Object.freeze([
  30, 60, 100, 160, 240, 350, 500, 700, 950, null,
].map((requiredExp, index) => Object.freeze({ level: index + 1, requiredExp })))

export const LAND_UNLOCKS = Object.freeze([
  { totalUnlocked: 4, petLevel: 1, prices: [] },
  { totalUnlocked: 6, petLevel: 2, prices: [20, 30] },
  { totalUnlocked: 8, petLevel: 4, prices: [45, 65] },
  { totalUnlocked: 10, petLevel: 6, prices: [90, 120] },
  { totalUnlocked: 12, petLevel: 8, prices: [160, 210] },
  { totalUnlocked: 14, petLevel: 10, prices: [270, 340] },
  { totalUnlocked: 16, petLevel: 12, prices: [420, 520] },
].map(Object.freeze))

export const ORDER_CONFIG = Object.freeze({
  slots: 3,
  twoLineUnlockLevel: 4,
  processedUnlockLevel: 4,
  oneLineChance: 0.7,
  twoLineChance: 0.3,
  maxQuantityPerLine: 20,
  seedRewardChance: 0.15,
  abandonCooldownMs: minutes(30),
  valueBands: Object.freeze([
    { minLevel: 1, maxLevel: 2, minValue: 8, maxValue: 20 },
    { minLevel: 3, maxLevel: 4, minValue: 20, maxValue: 50 },
    { minLevel: 5, maxLevel: 6, minValue: 50, maxValue: 120 },
    { minLevel: 7, maxLevel: 10, minValue: 100, maxValue: 250 },
  ].map(Object.freeze)),
  rawCoinMultiplier: Object.freeze({ min: 1.25, max: 1.4 }),
  processedCoinMultiplier: Object.freeze({ min: 1.35, max: 1.5 }),
  exp: Object.freeze({ min: 8, max: 60, base: 5, valueDivisor: 10 }),
})

export const FARM_REWARD_CONFIG = Object.freeze({
  starterItems: Object.freeze({ 'seed:wheat': 4, 'seed:carrot': 4 }),
  landMultipliers: Object.freeze({ 1: 1, 2: 1.25, 3: 1.5 }),
  landUpgradeCosts: Object.freeze({ 2: 80, 3: 240 }),
  moodGrowthBonuses: Object.freeze({ happy: 0.1, good: 0.05, neutral: 0, low: 0 }),
  baseBonusDropChance: 0.03,
  seedDropChance: 0.7,
  coinDropChance: 0.3,
  bonusCoinRange: Object.freeze({ min: 1, max: 3 }),
  birdCoinRange: Object.freeze({ min: 1, max: 3 }),
  birdDailyLimit: 10,
  processorQueueCapacity: 3,
  buildingRefundRate: 0.5,
  buildingCapacity: Object.freeze([
    { petLevel: 2, capacity: 1 },
    { petLevel: 5, capacity: 2 },
    { petLevel: 8, capacity: 3 },
    { petLevel: 12, capacity: 4 },
  ].map(Object.freeze)),
})

export const FARM_CONFIG = Object.freeze({
  items: ITEMS,
  crops: CROPS,
  recipes: RECIPES,
  buildings: BUILDINGS,
  farms: FARMS,
  farmLevels: FARM_LEVELS,
  landUnlocks: LAND_UNLOCKS,
  order: ORDER_CONFIG,
  rewards: FARM_REWARD_CONFIG,
})

const positive = value => Number.isFinite(value) && value > 0

export function validateFarmConfig(config) {
  const errors = []
  const items = config?.items || {}

  for (const [itemId, entry] of Object.entries(items)) {
    if (!/^[a-z][a-z-]*:[a-z0-9][a-z0-9-]*$/.test(itemId) || entry?.id !== itemId) {
      errors.push({ code: 'INVALID_ITEM_ID', path: `items.${itemId}` })
    }
  }

  const probabilities = [
    config?.rewards?.baseBonusDropChance,
    config?.rewards?.seedDropChance,
    config?.rewards?.coinDropChance,
    config?.order?.seedRewardChance,
    config?.order?.oneLineChance,
    config?.order?.twoLineChance,
  ]
  if (probabilities.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
    errors.push({ code: 'INVALID_PROBABILITY', path: 'probabilities' })
  }

  const initialIds = (config?.farms?.['basic-farm']?.tiles || [])
    .filter(tile => tile.initiallyUnlocked)
    .map(tile => tile.id)
    .sort()
  if (JSON.stringify(initialIds) !== JSON.stringify(['r1c1', 'r1c2', 'r2c1', 'r2c2'])) {
    errors.push({ code: 'INVALID_INITIAL_TILES', path: 'farms.basic-farm.tiles' })
  }

  for (const [recipeId, recipe] of Object.entries(config?.recipes || {})) {
    for (const itemId of Object.keys(recipe.inputs || {})) {
      if (!items[itemId]) errors.push({ code: 'UNKNOWN_ITEM', path: `recipes.${recipeId}.inputs.${itemId}` })
    }
    for (const itemId of Object.keys(recipe.outputs || {})) {
      if (!items[itemId]) errors.push({ code: 'UNKNOWN_ITEM', path: `recipes.${recipeId}.outputs.${itemId}` })
    }
    if (!positive(recipe.durationMs)) errors.push({ code: 'INVALID_DURATION', path: `recipes.${recipeId}.durationMs` })
  }

  for (const [cropId, crop] of Object.entries(config?.crops || {})) {
    if (!items[cropId] || !items[crop.seedId]) errors.push({ code: 'UNKNOWN_ITEM', path: `crops.${cropId}` })
    if (![crop.durationMs, crop.baseYield, crop.seedPrice, crop.sellPrice].every(positive)) {
      errors.push({ code: 'INVALID_CROP_NUMBER', path: `crops.${cropId}` })
    }
  }

  for (const [farmId, farm] of Object.entries(config?.farms || {})) {
    const seenIds = new Set()
    const seenCoordinates = new Set()
    for (const tile of farm.tiles || []) {
      const coordinate = `${tile.row}:${tile.col}`
      if (seenIds.has(tile.id) || seenCoordinates.has(coordinate)) {
        errors.push({ code: 'DUPLICATE_TILE', path: `farms.${farmId}.tiles.${tile.id}` })
      }
      seenIds.add(tile.id)
      seenCoordinates.add(coordinate)
    }
  }

  return errors
}
