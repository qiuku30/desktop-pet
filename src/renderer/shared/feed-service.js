// 食物配置表 + 投喂逻辑（原则5：配置驱动，原则2：高内聚）
// pet.js 和 dashboard.js 共享同一份食物配置和投喂计算，消除重复。
//
// 纯函数不碰 PetState，调用方负责读写状态、UI 反馈。

import { EventBus } from './event-bus.js'
import { EVENTS } from './events.js'

// ── 食物配置表 ──
// 新增食物品类只需加一行，无需改业务逻辑代码。
export const FOODS = {
  apple:  { id: 'apple',  name: '苹果',   emoji: '🍎', satiety: 20, exp: 10 },
  cake:   { id: 'cake',   name: '蛋糕',   emoji: '🍰', satiety: 30, exp: 25 },
  fish:   { id: 'fish',   name: '小鱼干', emoji: '🐟', satiety: 25, exp: 20 },
  milk:   { id: 'milk',   name: '牛奶',   emoji: '🥛', satiety: 15, exp: 10 },
  cookie: { id: 'cookie', name: '饼干',   emoji: '🍪', satiety: 10, exp: 5 },
}

// ── 纯函数：消耗食物 ──
// 从 foodInventory 中扣减 1 个指定食物。
// 不碰 PetState，调用方负责 set('foodInventory', ...)。
// 返回 { newInventory, consumed } — consumed=false 表示库存不足或没有该食物。
export function consumeFood(foodId, foodInventory) {
  const entry = foodInventory.find(item => item.id === foodId)
  if (!entry || entry.count <= 0) {
    return { newInventory: foodInventory, consumed: false }
  }

  const newInventory = foodInventory
    .map(item => item.id === foodId ? { ...item, count: item.count - 1 } : item)
    .filter(item => item.count > 0)

  return { newInventory, consumed: true }
}

// ── 纯函数：计算投喂后的新值 ──
// 返回 { newSatiety, newIntimacy }，satiety 上限 100。
// 调用方负责 PetState.set(...) 持久化。
export function applyFeed(satiety, intimacy, food) {
  return {
    newSatiety: Math.min(100, satiety + food.satiety),
    newIntimacy: intimacy + 5,
  }
}

// ── 发送投喂事件 ──
// EVENTS.PET_FED 在 events.js L10 已定义，此前全项目无人 emit。
export function emitFed(foodId) {
  EventBus.emit(EVENTS.PET_FED, { food: foodId })
}
