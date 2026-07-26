import { ITEMS } from '../../shared/item-config.js'
import { CROPS, FARM_REWARD_CONFIG, FARMS, RECIPES } from './farm-config.mjs'

const clone = value => structuredClone(value)
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const validPositiveMap = value => value && !Array.isArray(value) && typeof value === 'object'
  && Object.keys(value).length > 0
  && Object.values(value).every(count => Number.isSafeInteger(count) && count > 0)
const validPositiveItemMap = value => validPositiveMap(value)
  && Object.keys(value).every(itemId => ITEMS[itemId])

const emptySlot = regenerateAt => ({ order: null, regenerateAt })
const seedIds = new Set(Object.values(CROPS).map(crop => crop.seedId))

function localDateKey(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createTile(template) {
  const opened = template.initiallyUnlocked
  return {
    id: template.id,
    row: template.row,
    col: template.col,
    occupancy: opened ? 'field' : 'locked',
    landLevel: opened ? 1 : null,
    crop: null,
    building: null,
  }
}

export function createDefaultFarmState(_now, _random) {
  return {
    schemaVersion: 1,
    level: 1,
    exp: 0,
    activeFarmId: 'basic-farm',
    farms: {
      'basic-farm': {
        tiles: FARMS['basic-farm'].tiles.map(createTile),
      },
    },
    processor: { level: 1, queue: [] },
    orders: { slots: Array.from({ length: 3 }, () => emptySlot(null)) },
    daily: { birdRewardDate: null, birdRewardCount: 0, claimedBirdIds: [] },
    notificationState: {
      notifiedReadyOrderIds: [],
      lastCompletedProcessingTaskId: null,
    },
    nextIds: { order: 1, processingTask: 1, building: 1 },
    starterGranted: false,
  }
}

function validCrop(crop) {
  const config = crop && CROPS[crop.cropId]
  const snapshot = crop?.snapshot
  return config
    && crop.seedId === config.seedId
    && validDate(crop.plantedAt)
    && validDate(crop.readyAt)
    && Date.parse(crop.readyAt) >= Date.parse(crop.plantedAt)
    && Number.isSafeInteger(crop.baseYield)
    && crop.baseYield > 0
    && Number.isSafeInteger(crop.harvestExp)
    && crop.harvestExp > 0
    && snapshot && !Array.isArray(snapshot) && typeof snapshot === 'object'
    && Number.isSafeInteger(snapshot.baseDurationMs) && snapshot.baseDurationMs > 0
    && Number.isSafeInteger(snapshot.durationMs) && snapshot.durationMs > 0
    && Number.isSafeInteger(snapshot.baseYield) && snapshot.baseYield === crop.baseYield
    && Number.isFinite(snapshot.landMultiplier) && snapshot.landMultiplier > 0
    && Number.isFinite(snapshot.scarecrow) && snapshot.scarecrow >= 0
    && Number.isFinite(snapshot.farmYieldMultiplier) && snapshot.farmYieldMultiplier > 0
    && Number.isSafeInteger(snapshot.quantity) && snapshot.quantity > 0
    && Number.isFinite(snapshot.bonusDropChance)
    && snapshot.bonusDropChance >= 0 && snapshot.bonusDropChance <= 1
    && Array.isArray(snapshot.contributingBuildingIds)
    && snapshot.contributingBuildingIds.every(id => /^building:\d+$/.test(id))
    && new Set(snapshot.contributingBuildingIds).size === snapshot.contributingBuildingIds.length
}

function validBuilding(building) {
  return building
    && /^building:\d+$/.test(building.id)
    && ['building:sprinkler', 'building:scarecrow', 'building:compost-bin'].includes(building.typeId)
    && Number.isInteger(building.level) && building.level >= 1 && building.level <= 3
    && Number.isSafeInteger(building.investedCoins) && building.investedCoins >= 0
}

function repairTiles(sourceTiles) {
  const seenBuildingIds = new Set()
  const sourceById = new Map(
    (Array.isArray(sourceTiles) ? sourceTiles : [])
      .filter(tile => FARMS['basic-farm'].tiles.some(template => template.id === tile?.id))
      .map(tile => [tile.id, tile]),
  )

  return FARMS['basic-farm'].tiles.map(template => {
    const fallback = createTile(template)
    const source = sourceById.get(template.id)
    if (!source) return fallback

    const opened = template.initiallyUnlocked
      || source.occupancy === 'field'
      || source.occupancy === 'building'
      || Number.isInteger(source.landLevel)
    if (!opened) return fallback
    const landLevel = Math.max(1, Math.min(3, Number.isInteger(source.landLevel) ? source.landLevel : 1))

    if (source.occupancy === 'building'
      && validBuilding(source.building)
      && !seenBuildingIds.has(source.building.id)) {
      seenBuildingIds.add(source.building.id)
      return { ...fallback, occupancy: 'building', landLevel, building: clone(source.building) }
    }
    return {
      ...fallback,
      occupancy: 'field',
      landLevel,
      crop: validCrop(source.crop) ? clone(source.crop) : null,
    }
  })
}

function validTask(task) {
  const common = task && /^processing-task:\d+$/.test(task.id)
    && RECIPES[task.recipeId]
    && validPositiveItemMap(task.inputs)
    && validPositiveItemMap(task.outputs)
    && Number.isSafeInteger(task.durationMs) && task.durationMs > 0
    && validDate(task.enqueuedAt)
    && ['running', 'queued'].includes(task.status)
  if (!common) return false
  if (task.status === 'queued') return task.startedAt === null && task.completesAt === null
  return validDate(task.startedAt)
    && validDate(task.completesAt)
    && Date.parse(task.completesAt) === Date.parse(task.startedAt) + task.durationMs
}

function repairQueue(source, now) {
  const original = Array.isArray(source) ? source : []
  const seenIds = new Set()
  const valid = original.filter(task => {
    if (!validTask(task) || seenIds.has(task.id)) return false
    seenIds.add(task.id)
    return true
  }).map(clone)
  const firstRunningWasPreserved = original.length > 0
    && validTask(original[0])
    && original[0].status === 'running'
    && valid[0]?.id === original[0].id

  if (!valid.length) return []
  if (!firstRunningWasPreserved) {
    let cursor = Date.parse(now)
    return valid.map((task, index) => {
      const startedAt = new Date(cursor).toISOString()
      cursor += task.durationMs
      return {
        ...task,
        status: index === 0 ? 'running' : 'queued',
        startedAt: index === 0 ? startedAt : null,
        completesAt: index === 0 ? new Date(cursor).toISOString() : null,
      }
    })
  }
  return valid.map((task, index) => index === 0 ? task : {
    ...task,
    status: 'queued',
    startedAt: null,
    completesAt: null,
  })
}

function validReward(reward) {
  const seedReward = reward?.seedReward
  const validSeedReward = seedReward === null
    || (seedReward
      && !Array.isArray(seedReward)
      && typeof seedReward === 'object'
      && Object.keys(seedReward).length === 2
      && seedIds.has(seedReward.itemId)
      && seedReward.count === 1)
  return reward
    && Object.keys(reward).length === 3
    && Number.isSafeInteger(reward.coins) && reward.coins >= 0
    && Number.isSafeInteger(reward.farmExp) && reward.farmExp >= 0
    && validSeedReward
}

function validOrder(order) {
  return order
    && Object.keys(order).length === 5
    && /^order:\d+$/.test(order.id)
    && validPositiveItemMap(order.requirements)
    && Number.isSafeInteger(order.materialValue) && order.materialValue > 0
    && validReward(order.rewards)
    && validDate(order.createdAt)
}

function repairSlots(source, now) {
  const seenOrderIds = new Set()
  return Array.from({ length: 3 }, (_, index) => {
    const slot = Array.isArray(source) ? source[index] : null
    if (slot?.order && validOrder(slot.order) && !seenOrderIds.has(slot.order.id)) {
      seenOrderIds.add(slot.order.id)
      return { order: clone(slot.order), regenerateAt: null }
    }
    if (!slot?.order && (slot?.regenerateAt === null || validDate(slot?.regenerateAt))) {
      return emptySlot(slot.regenerateAt)
    }
    return emptySlot(now)
  })
}

function numericSuffix(id, prefix) {
  const match = new RegExp(`^${prefix}:(\\d+)$`).exec(id || '')
  return match ? Number(match[1]) : 0
}

export function migrateFarmState(value, now, random) {
  const base = createDefaultFarmState(now, random)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { state: base, migrated: true, warnings: [] }
  }

  const tiles = repairTiles(value.farms?.['basic-farm']?.tiles)
  const queue = repairQueue(value.processor?.queue, now)
  const slots = repairSlots(value.orders?.slots, now)
  const existingOrderIds = new Set(slots.map(slot => slot.order?.id).filter(Boolean))
  const notified = [...new Set(
    (Array.isArray(value.notificationState?.notifiedReadyOrderIds)
      ? value.notificationState.notifiedReadyOrderIds
      : []).filter(id => existingOrderIds.has(id)),
  )]

  const orderMax = Math.max(0, ...[...existingOrderIds].map(id => numericSuffix(id, 'order')))
  const taskMax = Math.max(0, ...queue.map(task => numericSuffix(task.id, 'processing-task')))
  const buildingMax = Math.max(0, ...tiles.map(tile => numericSuffix(tile.building?.id, 'building')))
  const counter = (key, max) => Math.max(max + 1,
    Number.isSafeInteger(value.nextIds?.[key]) && value.nextIds[key] > 0 ? value.nextIds[key] : 1)
  const today = localDateKey(now)
  const sameBirdRewardDay = value.daily?.birdRewardDate === today
  const pristineBirdRewards = value.daily?.birdRewardDate == null
    && (value.daily?.birdRewardCount == null || value.daily.birdRewardCount === 0)
    && (!Array.isArray(value.daily?.claimedBirdIds) || value.daily.claimedBirdIds.length === 0)
  const claimedBirdIds = sameBirdRewardDay
    ? [...new Set(
      (Array.isArray(value.daily?.claimedBirdIds) ? value.daily.claimedBirdIds : [])
        .filter(id => typeof id === 'string' && id.trim().length > 0),
    )].slice(0, FARM_REWARD_CONFIG.birdDailyLimit)
    : []
  const state = {
    ...base,
    level: Number.isInteger(value.level) && value.level >= 1 && value.level <= 10 ? value.level : 1,
    exp: Number.isSafeInteger(value.exp) && value.exp >= 0 ? value.exp : 0,
    activeFarmId: 'basic-farm',
    farms: { 'basic-farm': { tiles } },
    processor: {
      level: Number.isInteger(value.processor?.level) && value.processor.level > 0 ? value.processor.level : 1,
      queue,
    },
    orders: { slots },
    daily: {
      birdRewardDate: pristineBirdRewards ? null : today,
      birdRewardCount: sameBirdRewardDay ? claimedBirdIds.length : 0,
      claimedBirdIds,
    },
    notificationState: {
      notifiedReadyOrderIds: notified,
      lastCompletedProcessingTaskId:
        typeof value.notificationState?.lastCompletedProcessingTaskId === 'string'
          ? value.notificationState.lastCompletedProcessingTaskId
          : null,
    },
    nextIds: {
      order: counter('order', orderMax),
      processingTask: counter('processingTask', taskMax),
      building: counter('building', buildingMax),
    },
    starterGranted: value.starterGranted === true,
  }

  return {
    state,
    migrated: JSON.stringify(state) !== JSON.stringify(value),
    warnings: [],
  }
}

export function validateFarmState(value) {
  const errors = []
  if (!value || value.schemaVersion !== 1) errors.push({ code: 'INVALID_SCHEMA_VERSION' })
  const tiles = value?.farms?.['basic-farm']?.tiles
  if (!Array.isArray(tiles) || tiles.length !== FARMS['basic-farm'].tiles.length) {
    errors.push({ code: 'INVALID_TILES' })
  }
  if (!Array.isArray(value?.orders?.slots) || value.orders.slots.length !== 3) {
    errors.push({ code: 'INVALID_ORDER_SLOTS' })
  }
  if (!value?.nextIds || ['order', 'processingTask', 'building'].some(
    key => !Number.isSafeInteger(value.nextIds[key]) || value.nextIds[key] < 1,
  )) {
    errors.push({ code: 'INVALID_NEXT_IDS' })
  }
  if (!Array.isArray(value?.daily?.claimedBirdIds)
    || value.daily.claimedBirdIds.some(id => typeof id !== 'string' || id.trim().length === 0)) {
    errors.push({ code: 'INVALID_CLAIMED_BIRD_IDS' })
  }
  return errors
}
