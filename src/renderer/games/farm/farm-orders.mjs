import { ITEMS } from '../../shared/item-config.js'
import { canRemoveItems, removeItems } from '../../shared/inventory-service.js'
import { CROPS, ORDER_CONFIG, RECIPES } from './farm-config.mjs'

const clone = value => structuredClone(value)

export function orderSignature(requirements) {
  return Object.entries(requirements)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, count]) => `${id}=${count}`)
    .join('|')
}

function valueBand(level) {
  return ORDER_CONFIG.valueBands.find(band => level >= band.minLevel && level <= band.maxLevel)
}

function unlockedItems(level) {
  const raw = Object.entries(CROPS)
    .filter(([, crop]) => crop.unlockFarmLevel <= level)
    .map(([id]) => id)
  if (level < ORDER_CONFIG.processedUnlockLevel) return raw.sort()
  const processed = Object.values(RECIPES)
    .filter(recipe => recipe.unlockFarmLevel <= level)
    .flatMap(recipe => Object.keys(recipe.outputs))
  return [...new Set([...raw, ...processed])].sort()
}

function materialValue(requirements) {
  return Object.entries(requirements)
    .reduce((total, [id, count]) => total + ITEMS[id].sellPrice * count, 0)
}

function oneLineCandidates(ids, band, includeOutside = false) {
  const candidates = []
  for (const id of ids) {
    for (let count = 1; count <= ORDER_CONFIG.maxQuantityPerLine; count += 1) {
      const requirements = { [id]: count }
      const value = materialValue(requirements)
      if (includeOutside || (value >= band.minValue && value <= band.maxValue)) {
        candidates.push({ requirements, value, signature: orderSignature(requirements) })
      }
    }
  }
  return candidates.sort((left, right) =>
    left.signature.localeCompare(right.signature))
}

function twoLineCandidates(ids, band) {
  const candidates = []
  for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
      for (let leftCount = 1; leftCount <= ORDER_CONFIG.maxQuantityPerLine; leftCount += 1) {
        for (let rightCount = 1; rightCount <= ORDER_CONFIG.maxQuantityPerLine; rightCount += 1) {
          const requirements = { [ids[leftIndex]]: leftCount, [ids[rightIndex]]: rightCount }
          const value = materialValue(requirements)
          if (value >= band.minValue && value <= band.maxValue) {
            candidates.push({ requirements, value, signature: orderSignature(requirements) })
          }
        }
      }
    }
  }
  return candidates.sort((left, right) => left.signature.localeCompare(right.signature))
}

const pick = (values, random) => values[Math.min(values.length - 1, Math.floor(random() * values.length))]

export function generateOrder({ farmLevel, existingOrders, nextId, now, random }) {
  const band = valueBand(farmLevel)
  const ids = unlockedItems(farmLevel)
  if (!band || !ids.length) return { ok: false, order: null, nextId, error: 'NO_CANDIDATE' }

  const excluded = new Set(existingOrders.filter(Boolean).map(order => orderSignature(order.requirements)))
  const wantsTwo = farmLevel >= ORDER_CONFIG.twoLineUnlockLevel
    && random() >= ORDER_CONFIG.oneLineChance
  let candidates = wantsTwo ? twoLineCandidates(ids, band) : oneLineCandidates(ids, band)
  candidates = candidates.filter(candidate => !excluded.has(candidate.signature))
  if (!candidates.length && wantsTwo) {
    candidates = oneLineCandidates(ids, band).filter(candidate => !excluded.has(candidate.signature))
  }
  if (!candidates.length) {
    candidates = oneLineCandidates(ids, band, true)
      .filter(candidate => !excluded.has(candidate.signature))
      .sort((left, right) =>
        Math.abs(left.value - band.minValue) - Math.abs(right.value - band.minValue)
        || left.signature.localeCompare(right.signature))
      .slice(0, 1)
  }
  if (!candidates.length) return { ok: false, order: null, nextId, error: 'NO_CANDIDATE' }

  const candidate = pick(candidates, random)
  const containsProcessed = Object.keys(candidate.requirements).some(id => id.startsWith('food:'))
  const multiplierConfig = containsProcessed
    ? ORDER_CONFIG.processedCoinMultiplier
    : ORDER_CONFIG.rawCoinMultiplier
  const multiplier = multiplierConfig.min
    + random() * (multiplierConfig.max - multiplierConfig.min)
  const coins = Math.ceil(candidate.value * multiplier)
  const farmExp = Math.max(
    ORDER_CONFIG.exp.min,
    Math.min(ORDER_CONFIG.exp.max,
      ORDER_CONFIG.exp.base + Math.floor(candidate.value / ORDER_CONFIG.exp.valueDivisor)),
  )
  let seedReward = null
  if (random() < ORDER_CONFIG.seedRewardChance) {
    const seeds = Object.values(CROPS)
      .filter(crop => crop.unlockFarmLevel <= farmLevel)
      .map(crop => crop.seedId)
      .sort()
    if (seeds.length) seedReward = { itemId: pick(seeds, random), count: 1 }
  }
  const order = {
    id: `order:${nextId}`,
    requirements: clone(candidate.requirements),
    materialValue: candidate.value,
    rewards: { coins, farmExp, seedReward },
    createdAt: now,
  }
  return { ok: true, order, nextId: nextId + 1 }
}

export function canCompleteOrder(order, inventory) {
  return Boolean(order) && canRemoveItems(inventory, order.requirements)
}

export function completeOrder({ order, inventory }) {
  if (!order) return { ok: false, error: 'ORDER_NOT_FOUND', inventory }
  const removed = removeItems(inventory, order.requirements)
  if (!removed.ok) return { ok: false, error: 'INSUFFICIENT_ITEMS', inventory, missing: removed.missing }
  return { ok: true, inventory: removed.inventory, rewards: clone(order.rewards), orderId: order.id }
}

export function abandonOrder(slot, now) {
  return {
    order: null,
    regenerateAt: new Date(Date.parse(now) + ORDER_CONFIG.abandonCooldownMs).toISOString(),
  }
}

export function regenerateDueOrders({ slots, farmLevel, nextId, now, random }) {
  const nextSlots = slots.map(clone)
  let counter = nextId
  const generatedOrderIds = []
  for (let index = 0; index < nextSlots.length; index += 1) {
    const slot = nextSlots[index]
    const due = !slot.order && (
      slot.regenerateAt === null
      || (Number.isFinite(Date.parse(slot.regenerateAt)) && Date.parse(slot.regenerateAt) <= Date.parse(now))
    )
    if (!due) continue
    const existingOrders = nextSlots.map(entry => entry.order).filter(Boolean)
    const generated = generateOrder({ farmLevel, existingOrders, nextId: counter, now, random })
    if (generated.ok) {
      nextSlots[index] = { order: generated.order, regenerateAt: null }
      generatedOrderIds.push(generated.order.id)
      counter = generated.nextId
    }
  }
  return {
    changed: generatedOrderIds.length > 0,
    slots: nextSlots,
    nextId: counter,
    generatedOrderIds,
  }
}
