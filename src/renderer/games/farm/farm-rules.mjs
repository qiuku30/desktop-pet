import { BUILDINGS, FARM_REWARD_CONFIG, FARMS } from './farm-config.mjs'

function coordinates(tileId) {
  const match = /^r(\d+)c(\d+)$/.exec(tileId || '')
  return match ? { row: Number(match[1]), col: Number(match[2]) } : null
}

export function adjacentTileIds(tileId, buildingLevel = 1, farm = FARMS['basic-farm']) {
  const origin = coordinates(tileId)
  if (!origin) return []
  const includeDiagonal = buildingLevel >= 2
  return farm.tiles.filter(tile => {
    const rowDistance = Math.abs(tile.row - origin.row)
    const colDistance = Math.abs(tile.col - origin.col)
    if (rowDistance === 0 && colDistance === 0) return false
    return includeDiagonal
      ? Math.max(rowDistance, colDistance) === 1
      : rowDistance + colDistance === 1
  }).map(tile => tile.id)
}

export function canUnlockTile(tiles, tileId) {
  const target = tiles.find(tile => tile.id === tileId)
  if (!target || target.occupancy !== 'locked') return false
  const neighbors = new Set(adjacentTileIds(tileId, 1))
  return tiles.some(tile => neighbors.has(tile.id) && tile.occupancy !== 'locked')
}

export function buildingEffectForTile(tiles, tileId) {
  const bestByType = new Map()
  for (const tile of tiles) {
    const building = tile.occupancy === 'building' ? tile.building : null
    const config = BUILDINGS[building?.typeId]
    const levelConfig = config?.levels?.[building?.level]
    if (!levelConfig) continue
    if (!adjacentTileIds(tile.id, building.level).includes(tileId)) continue
    const existing = bestByType.get(building.typeId)
    if (!existing || building.level > existing.building.level) {
      bestByType.set(building.typeId, { building, config, levelConfig })
    }
  }

  const result = {
    growthSpeed: 0,
    yield: 0,
    bonusDrop: 0,
    contributingBuildingIds: [],
  }
  for (const { building, config, levelConfig } of bestByType.values()) {
    result[config.effectType] = levelConfig.effect
    result.contributingBuildingIds.push(building.id)
  }
  result.contributingBuildingIds.sort()
  return result
}

export function calculatePlantSnapshot({
  baseDurationMs,
  sprinkler,
  mood,
  farmSpeed,
  baseYield,
  landMultiplier,
  scarecrow,
  farmYieldMultiplier,
  baseBonusDropChance,
  compost,
  contributingBuildingIds,
}) {
  return {
    baseDurationMs,
    durationMs: Math.round(baseDurationMs / (1 + sprinkler) / (1 + mood) / (1 + farmSpeed)),
    baseYield,
    landMultiplier,
    scarecrow,
    farmYieldMultiplier,
    quantity: Math.round(baseYield * landMultiplier * (1 + scarecrow) * farmYieldMultiplier),
    bonusDropChance: baseBonusDropChance + compost,
    contributingBuildingIds: [...contributingBuildingIds],
  }
}

export function isCropMature(crop, now) {
  const readyAt = Date.parse(crop?.readyAt)
  const current = Date.parse(now)
  return Number.isFinite(readyAt) && Number.isFinite(current) && current >= readyAt
}

export function calculateHarvest({
  cropId,
  seedId,
  quantity,
  baseYield,
  landMultiplier,
  scarecrow,
  farmYieldMultiplier,
  bonusDropChance = FARM_REWARD_CONFIG.baseBonusDropChance,
  random,
}) {
  const finalQuantity = Number.isSafeInteger(quantity)
    ? quantity
    : Math.round(baseYield * landMultiplier * (1 + scarecrow) * farmYieldMultiplier)
  const bonus = { items: {}, coins: 0 }
  if (random() < bonusDropChance) {
    if (random() < FARM_REWARD_CONFIG.seedDropChance) {
      bonus.items[seedId] = 1
    } else {
      const { min, max } = FARM_REWARD_CONFIG.bonusCoinRange
      bonus.coins = min + Math.floor(random() * (max - min + 1))
    }
  }
  return { cropId, quantity: finalQuantity, bonus }
}
