// 食物配置表 + 投喂逻辑（原则5：配置驱动，原则2：高内聚）
// pet.js 和 dashboard.js 共享同一份食物配置和投喂计算，消除重复。
//
// 纯函数不碰 PetState，调用方负责读写状态、UI 反馈。

import { EventBus } from './event-bus.js'
import { EVENTS } from './events.js'
import { getItem, listFeedableItems } from './item-config.js'
import { removeItems } from './inventory-service.js'
import { addExp, getFoodExp } from './exp-service.js'
import { boostMood, getExpMultiplier, MOOD_CONFIG } from './mood-service.js'
import { calcMaxSatiety } from './satiety-service.js'

// ── 喂食通用配置 ──
// 与食物无关的固定参数放这里；单个食物有可能覆盖时优先读 FOODS 字段。
export const FEED_CONFIG = {
  intimacyPerFeed: 5,   // 每次喂食亲密度加成
}

// ── 食物配置表 ──
// 新增食物品类只需加一行，无需改业务逻辑代码。
export const FOODS = Object.freeze(Object.fromEntries(
  listFeedableItems().map(food => [food.id, food]),
))

// ── 纯函数：消耗食物 ──
// 从通用 inventory 中扣减 1 个指定食物。
// 不碰 PetState，调用方负责将完整投喂事务一次性提交。
// 返回 { newInventory, consumed } — consumed=false 表示库存不足或没有该食物。
export function consumeFood(foodId, inventory) {
  const result = removeItems(inventory, { [foodId]: 1 })
  return { newInventory: result.inventory, consumed: result.ok }
}

// ── 纯函数：计算投喂后的新值 ──
// 返回 { newSatiety, newIntimacy }，satiety 上限由等级决定。
// level 参数可选（默认 1），向后兼容旧调用方。
// 调用方负责 PetState.set(...) 持久化。
export function applyFeed(satiety, intimacy, food, level = 1) {
  return {
    newSatiety: Math.min(calcMaxSatiety(level), satiety + food.satiety),
    newIntimacy: intimacy + (food.intimacy ?? FEED_CONFIG.intimacyPerFeed),
  }
}

export function calculateFeedTransaction({
  inventory,
  itemId,
  satiety,
  intimacy,
  mood,
  exp,
  level,
}) {
  const food = getItem(itemId)
  if (!food || !Number.isFinite(food.satiety) || food.satiety <= 0) {
    return { ok: false, error: 'ITEM_NOT_FEEDABLE' }
  }
  if (satiety >= calcMaxSatiety(level)) {
    return { ok: false, error: 'SATIETY_FULL' }
  }
  const consumed = consumeFood(itemId, inventory)
  if (!consumed.consumed) return { ok: false, error: 'INSUFFICIENT_ITEMS' }

  const feed = applyFeed(satiety, intimacy, food, level)
  const newMood = boostMood(mood, MOOD_CONFIG.feedBoost)
  const adjustedExp = Math.round(getFoodExp(food) * getExpMultiplier(newMood))
  const expResult = addExp(exp, level, adjustedExp)
  return {
    ok: true,
    item: food,
    leveledUp: expResult.leveledUp,
    updates: {
      inventory: consumed.newInventory,
      satiety: feed.newSatiety,
      intimacy: feed.newIntimacy,
      mood: newMood,
      exp: expResult.newExp,
      level: expResult.newLevel,
    },
  }
}

export function commitFeedTransaction({
  transaction,
  itemId,
  setMany,
  emit = emitFed,
}) {
  if (!transaction?.ok || typeof setMany !== 'function') {
    throw new TypeError('successful feed transaction and setMany are required')
  }
  setMany(transaction.updates)
  emit(itemId)
}

// ── 发送投喂事件 ──
// EVENTS.PET_FED 在 events.js L10 已定义，此前全项目无人 emit。
export function emitFed(foodId) {
  EventBus.emit(EVENTS.PET_FED, { food: foodId })
}
