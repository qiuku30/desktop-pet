import { EVENTS } from '../../shared/events.js'
import { addItems, getItemCount, removeItems } from '../../shared/inventory-service.js'
import {
  BUILDINGS,
  CROPS,
  FARM_LEVELS,
  FARM_REWARD_CONFIG,
  FARMS,
  LAND_UNLOCKS,
} from './farm-config.mjs'
import { createDefaultFarmState, migrateFarmState } from './farm-state.mjs'
import {
  buildingEffectForTile,
  calculateHarvest,
  calculatePlantSnapshot,
  canUnlockTile,
  isCropMature,
} from './farm-rules.mjs'
import { cancelQueuedTask, enqueueRecipe, settleProcessing } from './farm-processing.mjs'
import {
  abandonOrder,
  canCompleteOrder,
  completeOrder as completeOrderRule,
  generateOrder,
  regenerateDueOrders,
} from './farm-orders.mjs'

const clone = value => structuredClone(value)
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)

function addFarmExp(farm, amount) {
  let level = farm.level
  let exp = farm.exp + amount
  while (level < FARM_LEVELS.length) {
    const required = FARM_LEVELS[level - 1].requiredExp
    if (required === null || exp < required) break
    exp -= required
    level += 1
  }
  return { ...farm, level, exp }
}

function localDateKey(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTile(farm, tileId) {
  return farm.farms[farm.activeFarmId].tiles.find(tile => tile.id === tileId)
}

function summaryOf(farm, inventory, now) {
  const tiles = farm.farms[farm.activeFarmId].tiles
  const active = farm.processor.queue[0] || null
  return {
    farmLevel: farm.level,
    farmExp: farm.exp,
    matureFieldCount: tiles.filter(tile => tile.crop && isCropMature(tile.crop, now)).length,
    processing: {
      queuedCount: farm.processor.queue.length,
      activeTaskId: active?.id || null,
      nextCompletionAt: active?.completesAt || null,
    },
    orders: {
      readyCount: farm.orders.slots.filter(slot => slot.order && canCompleteOrder(slot.order, inventory)).length,
      coolingDownCount: farm.orders.slots.filter(slot => !slot.order && slot.regenerateAt !== null).length,
    },
  }
}

function collectNewReadyOrders(draft) {
  const existingOrderIds = new Set(
    draft.farm.orders.slots.map(slot => slot.order?.id).filter(Boolean),
  )
  const previousReady = draft.farm.notificationState.notifiedReadyOrderIds
    .filter(id => existingOrderIds.has(id))
  const previousReadySet = new Set(previousReady)
  const newlyReady = draft.farm.orders.slots
    .map(slot => slot.order)
    .filter(order => order && canCompleteOrder(order, draft.inventory) && !previousReadySet.has(order.id))
    .map(order => order.id)
  const nextReady = [...previousReady, ...newlyReady]
  const changed = !equal(nextReady, draft.farm.notificationState.notifiedReadyOrderIds)
  if (changed) draft.farm.notificationState.notifiedReadyOrderIds = nextReady
  return { changed, orderIds: newlyReady }
}

function settleDraft(draft, at, random) {
  const events = []
  let changed = false

  const processing = settleProcessing({
    processor: draft.farm.processor,
    inventory: draft.inventory,
    now: at,
  })
  if (processing.changed) {
    draft.farm.processor = processing.processor
    draft.inventory = processing.inventory
    changed = true
    if (processing.processor.queue.length === 0) {
      draft.farm.notificationState.lastCompletedProcessingTaskId =
        processing.completedTaskIds[processing.completedTaskIds.length - 1]
    }
    events.push({
      event: EVENTS.FARM_PROCESSING_COMPLETED,
      payload: { taskIds: processing.completedTaskIds, outputs: processing.outputs },
    })
  }

  const regeneration = regenerateDueOrders({
    slots: draft.farm.orders.slots,
    farmLevel: draft.farm.level,
    nextId: draft.farm.nextIds.order,
    now: at,
    random,
  })
  if (regeneration.changed) {
    draft.farm.orders.slots = regeneration.slots
    draft.farm.nextIds.order = regeneration.nextId
    changed = true
  }

  const ready = collectNewReadyOrders(draft)
  if (ready.changed) changed = true
  if (ready.orderIds.length) {
    events.push({ event: EVENTS.FARM_ORDER_READY, payload: { orderIds: ready.orderIds } })
  }

  return { changed, events }
}

export function createFarmService({ petState, eventBus, now, random }) {
  let tail = Promise.resolve()

  function serial(operation) {
    const result = tail.then(operation, operation)
    tail = result.then(() => undefined, () => undefined)
    return result
  }

  async function transact(command, { settle = true } = {}) {
    const at = now()
    const original = {
      farm: petState.get('farm'),
      inventory: petState.get('inventory') || {},
      coins: petState.get('coins') || 0,
      petLevel: petState.get('level') || 1,
      mood: petState.get('mood') ?? 70,
    }
    const migration = migrateFarmState(original.farm, at, random)
    const draft = {
      farm: migration.state,
      inventory: clone(original.inventory),
      coins: original.coins,
      petLevel: original.petLevel,
      mood: original.mood,
    }
    const settlement = settle ? settleDraft(draft, at, random) : { changed: false, events: [] }
    const commandResult = command ? await command(draft, at) : { ok: true, events: [] }
    const commandReady = commandResult.ok
      ? collectNewReadyOrders(draft)
      : { changed: false, orderIds: [] }

    const updates = {}
    if (!equal(draft.farm, original.farm)) updates.farm = draft.farm
    if (!equal(draft.inventory, original.inventory)) updates.inventory = draft.inventory
    if (draft.coins !== original.coins) updates.coins = draft.coins
    for (const key of commandResult.forceKeys || []) {
      if (key === 'farm') updates.farm = draft.farm
      if (key === 'inventory') updates.inventory = draft.inventory
      if (key === 'coins') updates.coins = draft.coins
    }
    const hasUpdates = Object.keys(updates).length > 0

    if (hasUpdates) {
      await petState.setMany(updates)
      for (const entry of settlement.events) eventBus.emit(entry.event, entry.payload)
      if (commandResult.ok) {
        for (const entry of commandResult.events || []) eventBus.emit(entry.event, entry.payload)
        if (commandReady.orderIds.length) {
          eventBus.emit(EVENTS.FARM_ORDER_READY, { orderIds: commandReady.orderIds })
        }
      }
      eventBus.emit(EVENTS.FARM_STATE_CHANGED, {
        summary: summaryOf(draft.farm, draft.inventory, at),
      })
    }
    return { ...commandResult, settled: settlement.changed, committed: hasUpdates }
  }

  const run = (command, options) => serial(() => transact(command, options))

  return {
    initialize() {
      return run((draft) => {
        if (draft.farm.starterGranted) return { ok: true, events: [] }
        draft.inventory = addItems(draft.inventory, FARM_REWARD_CONFIG.starterItems)
        draft.farm.starterGranted = true
        return { ok: true, events: [] }
      })
    },

    settle() {
      return run(null)
    },

    plant({ tileId, cropId, quickBuy = false }) {
      return run((draft, at) => {
        const tile = getTile(draft.farm, tileId)
        const crop = CROPS[cropId]
        if (!tile || tile.occupancy !== 'field' || tile.crop) return { ok: false, error: 'TILE_NOT_EMPTY' }
        if (!crop || crop.unlockFarmLevel > draft.farm.level) return { ok: false, error: 'CROP_LOCKED' }

        if (getItemCount(draft.inventory, crop.seedId) > 0) {
          draft.inventory = removeItems(draft.inventory, { [crop.seedId]: 1 }).inventory
        } else if (quickBuy) {
          if (draft.coins < crop.seedPrice) return { ok: false, error: 'INSUFFICIENT_COINS' }
          draft.coins -= crop.seedPrice
        } else {
          return { ok: false, error: 'INSUFFICIENT_SEEDS' }
        }

        const effects = buildingEffectForTile(draft.farm.farms[draft.farm.activeFarmId].tiles, tileId)
        const farmConfig = FARMS[draft.farm.activeFarmId]
        const moodBonus = draft.mood >= 80
          ? FARM_REWARD_CONFIG.moodGrowthBonuses.happy
          : draft.mood >= 50
            ? FARM_REWARD_CONFIG.moodGrowthBonuses.good
            : 0
        const snapshot = calculatePlantSnapshot({
          baseDurationMs: crop.durationMs,
          sprinkler: effects.growthSpeed,
          mood: moodBonus,
          farmSpeed: farmConfig.growthSpeedBonus,
          baseYield: crop.baseYield,
          landMultiplier: FARM_REWARD_CONFIG.landMultipliers[tile.landLevel],
          scarecrow: effects.yield,
          farmYieldMultiplier: farmConfig.yieldMultiplier,
          baseBonusDropChance: FARM_REWARD_CONFIG.baseBonusDropChance,
          compost: effects.bonusDrop,
          contributingBuildingIds: effects.contributingBuildingIds,
        })
        tile.crop = {
          cropId,
          seedId: crop.seedId,
          plantedAt: at,
          readyAt: new Date(Date.parse(at) + snapshot.durationMs).toISOString(),
          baseYield: crop.baseYield,
          harvestExp: crop.harvestExp,
          snapshot,
        }
        return {
          ok: true,
          events: [],
          forceKeys: quickBuy ? ['farm', 'inventory', 'coins'] : [],
        }
      })
    },

    harvest({ tileId }) {
      return run((draft, at) => harvestTile(draft, tileId, at, random))
    },

    harvestAll() {
      return run((draft, at) => {
        const events = []
        let count = 0
        for (const tile of draft.farm.farms[draft.farm.activeFarmId].tiles) {
          const result = harvestTile(draft, tile.id, at, random)
          if (result.ok) {
            count += 1
            events.push(...result.events)
          }
        }
        return count ? { ok: true, harvestedCount: count, events } : { ok: false, error: 'NO_MATURE_CROPS' }
      })
    },

    removeCrop({ tileId }) {
      return run((draft) => {
        const tile = getTile(draft.farm, tileId)
        if (!tile?.crop) return { ok: false, error: 'CROP_NOT_FOUND' }
        tile.crop = null
        return { ok: true, events: [] }
      })
    },

    unlockTile({ tileId }) {
      return run((draft) => {
        const tiles = draft.farm.farms[draft.farm.activeFarmId].tiles
        if (!canUnlockTile(tiles, tileId)) return { ok: false, error: 'TILE_NOT_ADJACENT' }
        const opened = tiles.filter(tile => tile.occupancy !== 'locked').length
        const tier = LAND_UNLOCKS.find(entry => entry.totalUnlocked > opened)
        const priceIndex = opened - (tier.totalUnlocked - tier.prices.length)
        const price = tier?.prices[priceIndex]
        if (!tier || draft.petLevel < tier.petLevel) return { ok: false, error: 'PET_LEVEL_REQUIRED' }
        if (draft.coins < price) return { ok: false, error: 'INSUFFICIENT_COINS' }
        const tile = getTile(draft.farm, tileId)
        tile.occupancy = 'field'
        tile.landLevel = 1
        draft.coins -= price
        return { ok: true, events: [] }
      })
    },

    upgradeLand({ tileId }) {
      return run((draft) => {
        const tile = getTile(draft.farm, tileId)
        if (!tile || tile.occupancy !== 'field' || tile.crop) return { ok: false, error: 'LAND_NOT_EMPTY' }
        if (tile.landLevel >= 3) return { ok: false, error: 'LAND_MAX_LEVEL' }
        const nextLevel = tile.landLevel + 1
        const cost = FARM_REWARD_CONFIG.landUpgradeCosts[nextLevel]
        if (draft.coins < cost) return { ok: false, error: 'INSUFFICIENT_COINS' }
        draft.coins -= cost
        tile.landLevel = nextLevel
        return { ok: true, events: [] }
      })
    },

    build({ tileId, typeId }) {
      return run((draft) => {
        const tile = getTile(draft.farm, tileId)
        const config = BUILDINGS[typeId]
        if (!tile || tile.occupancy !== 'field' || tile.crop) return { ok: false, error: 'BUILD_TILE_NOT_EMPTY' }
        if (!config || draft.farm.level < config.unlockFarmLevel) return { ok: false, error: 'BUILDING_LOCKED' }
        const buildingCount = draft.farm.farms[draft.farm.activeFarmId].tiles.filter(entry => entry.building).length
        const capacity = [...FARM_REWARD_CONFIG.buildingCapacity].reverse()
          .find(entry => draft.petLevel >= entry.petLevel)?.capacity || 0
        if (buildingCount >= capacity) return { ok: false, error: 'BUILDING_CAPACITY' }
        const cost = config.levels[1].cost
        if (draft.coins < cost) return { ok: false, error: 'INSUFFICIENT_COINS' }
        const id = `building:${draft.farm.nextIds.building}`
        draft.farm.nextIds.building += 1
        draft.coins -= cost
        tile.occupancy = 'building'
        tile.building = { id, typeId, level: 1, investedCoins: cost }
        return { ok: true, buildingId: id, events: [] }
      })
    },

    moveBuilding({ buildingId, targetTileId }) {
      return run((draft) => {
        const tiles = draft.farm.farms[draft.farm.activeFarmId].tiles
        const source = tiles.find(tile => tile.building?.id === buildingId)
        const target = tiles.find(tile => tile.id === targetTileId)
        if (!source) return { ok: false, error: 'BUILDING_NOT_FOUND' }
        if (buildingLocked(tiles, buildingId)) return { ok: false, error: 'BUILDING_WORKING' }
        if (!target || target.occupancy !== 'field' || target.crop) return { ok: false, error: 'BUILD_TILE_NOT_EMPTY' }
        target.occupancy = 'building'
        target.building = source.building
        source.occupancy = 'field'
        source.building = null
        return { ok: true, events: [] }
      })
    },

    upgradeBuilding({ buildingId }) {
      return run((draft) => {
        const tile = draft.farm.farms[draft.farm.activeFarmId].tiles.find(entry => entry.building?.id === buildingId)
        if (!tile) return { ok: false, error: 'BUILDING_NOT_FOUND' }
        const nextLevel = tile.building.level + 1
        const levelConfig = BUILDINGS[tile.building.typeId].levels[nextLevel]
        if (!levelConfig) return { ok: false, error: 'BUILDING_MAX_LEVEL' }
        if (draft.farm.level < levelConfig.unlockFarmLevel) return { ok: false, error: 'BUILDING_LEVEL_LOCKED' }
        if (draft.coins < levelConfig.cost) return { ok: false, error: 'INSUFFICIENT_COINS' }
        draft.coins -= levelConfig.cost
        tile.building.level = nextLevel
        tile.building.investedCoins += levelConfig.cost
        return { ok: true, events: [] }
      })
    },

    demolishBuilding({ buildingId }) {
      return run((draft) => {
        const tiles = draft.farm.farms[draft.farm.activeFarmId].tiles
        const tile = tiles.find(entry => entry.building?.id === buildingId)
        if (!tile) return { ok: false, error: 'BUILDING_NOT_FOUND' }
        if (buildingLocked(tiles, buildingId)) return { ok: false, error: 'BUILDING_WORKING' }
        const refund = Math.floor(tile.building.investedCoins * FARM_REWARD_CONFIG.buildingRefundRate)
        draft.coins += refund
        tile.occupancy = 'field'
        tile.building = null
        return { ok: true, refund, events: [] }
      })
    },

    enqueue({ recipeId }) {
      return run((draft, at) => {
        const result = enqueueRecipe({
          processor: draft.farm.processor,
          inventory: draft.inventory,
          recipeId,
          now: at,
          nextIds: draft.farm.nextIds,
        })
        if (!result.ok) return result
        draft.farm.processor = result.processor
        draft.inventory = result.inventory
        draft.farm.nextIds = result.nextIds
        return { ok: true, task: result.task, events: [] }
      })
    },

    cancelQueued({ taskId }) {
      return run((draft) => {
        const result = cancelQueuedTask({
          processor: draft.farm.processor,
          inventory: draft.inventory,
          taskId,
        })
        if (!result.ok) return result
        draft.farm.processor = result.processor
        draft.inventory = result.inventory
        return { ok: true, events: [] }
      })
    },

    completeOrder({ slotIndex }) {
      return run((draft, at) => {
        const slot = draft.farm.orders.slots[slotIndex]
        const order = slot?.order
        const result = completeOrderRule({ order, inventory: draft.inventory })
        if (!result.ok) return result
        draft.inventory = result.inventory
        if (result.rewards.seedReward) {
          draft.inventory = addItems(draft.inventory, {
            [result.rewards.seedReward.itemId]: result.rewards.seedReward.count,
          })
        }
        draft.coins += result.rewards.coins
        draft.farm = addFarmExp(draft.farm, result.rewards.farmExp)
        draft.farm.notificationState.notifiedReadyOrderIds =
          draft.farm.notificationState.notifiedReadyOrderIds.filter(id => id !== order.id)
        const generated = generateOrder({
          farmLevel: draft.farm.level,
          existingOrders: draft.farm.orders.slots.map(entry => entry.order)
            .filter(existing => existing && existing.id !== order.id),
          nextId: draft.farm.nextIds.order,
          now: at,
          random,
        })
        draft.farm.orders.slots[slotIndex] = generated.ok
          ? { order: generated.order, regenerateAt: null }
          : { order: null, regenerateAt: at }
        if (generated.ok) draft.farm.nextIds.order = generated.nextId
        return {
          ok: true,
          rewards: result.rewards,
          events: [{ event: EVENTS.FARM_ORDER_COMPLETED, payload: { orderId: order.id, rewards: result.rewards } }],
        }
      })
    },

    abandonOrder({ slotIndex }) {
      return run((draft, at) => {
        const slot = draft.farm.orders.slots[slotIndex]
        if (!slot?.order) return { ok: false, error: 'ORDER_NOT_FOUND' }
        const oldId = slot.order.id
        draft.farm.orders.slots[slotIndex] = abandonOrder(slot, at)
        draft.farm.notificationState.notifiedReadyOrderIds =
          draft.farm.notificationState.notifiedReadyOrderIds.filter(id => id !== oldId)
        return { ok: true, events: [] }
      })
    },

    claimBird({ birdId } = {}) {
      return run((draft, at) => {
        if (typeof birdId !== 'string' || birdId.trim().length === 0) {
          return { ok: false, error: 'INVALID_BIRD_ID' }
        }
        const date = localDateKey(at)
        if (!date) return { ok: false, error: 'INVALID_TIME' }
        if (draft.farm.daily.birdRewardDate !== date) {
          draft.farm.daily.birdRewardDate = date
          draft.farm.daily.birdRewardCount = 0
          draft.farm.daily.claimedBirdIds = []
        }
        if (draft.farm.daily.claimedBirdIds.includes(birdId)) {
          return { ok: false, error: 'BIRD_ALREADY_CLAIMED' }
        }
        if (draft.farm.daily.birdRewardCount >= FARM_REWARD_CONFIG.birdDailyLimit) {
          return { ok: false, error: 'BIRD_DAILY_LIMIT' }
        }
        const range = FARM_REWARD_CONFIG.birdCoinRange
        const amount = range.min + Math.floor(random() * (range.max - range.min + 1))
        draft.farm.daily.claimedBirdIds.push(birdId)
        draft.farm.daily.birdRewardCount += 1
        draft.coins += amount
        return {
          ok: true,
          amount,
          events: [{
            event: EVENTS.FARM_BIRD_REWARDED,
            payload: { amount, dailyCount: draft.farm.daily.birdRewardCount },
          }],
        }
      })
    },
  }
}

function harvestTile(draft, tileId, at, random) {
  const tile = getTile(draft.farm, tileId)
  if (!tile?.crop) return { ok: false, error: 'CROP_NOT_FOUND' }
  if (!isCropMature(tile.crop, at)) return { ok: false, error: 'CROP_NOT_MATURE' }
  const harvest = calculateHarvest({
    cropId: tile.crop.cropId,
    seedId: tile.crop.seedId,
    quantity: tile.crop.snapshot.quantity,
    bonusDropChance: tile.crop.snapshot.bonusDropChance,
    random,
  })
  draft.inventory = addItems(draft.inventory, {
    [tile.crop.cropId]: harvest.quantity,
    ...harvest.bonus.items,
  })
  draft.coins += harvest.bonus.coins
  draft.farm = addFarmExp(draft.farm, tile.crop.harvestExp)
  tile.crop = null
  return {
    ok: true,
    events: [{
      event: EVENTS.FARM_CROP_HARVESTED,
      payload: { cropId: harvest.cropId, quantity: harvest.quantity, tileId },
    }],
  }
}

function buildingLocked(tiles, buildingId) {
  return tiles.some(tile => tile.crop?.snapshot?.contributingBuildingIds?.includes(buildingId))
}
