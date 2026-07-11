// 宠物状态管理器（薄）
// 单例，集中管理宠物状态数据。对外只暴露 init / get / set / subscribe（ADR-005）。
// 职责：存数据 + 数据变更时发事件 + 防抖写盘。不含成长业务逻辑（升级由宠物模块自己算）。

import { EventBus } from './event-bus.js'
import { EVENTS } from './events.js'

// key → 事件映射。只有能对上现成事件的 key 才在 set 时自动发事件。
// payloadKey 对齐 docs/events.md 各事件的参数字段名（hunger→value / mood→mood / level→level）。
// 其余 key（exp / intimacy / coins / foodInventory 等）只改内存 + 存盘，不发事件；
// 需要通知的语义（如金币赚/花）由调用方自己 EventBus.emit。
const KEY_EVENT_MAP = {
  hunger: { event: EVENTS.PET_HUNGER_CHANGED, payloadKey: 'value' },
  mood:   { event: EVENTS.PET_MOOD_CHANGED,   payloadKey: 'mood' },
  level:  { event: EVENTS.PET_LEVEL_UP,        payloadKey: 'level' },
}

// 防抖写盘延迟（毫秒）：连续 set 只在安静这么久之后写一次盘。
const SAVE_DEBOUNCE_MS = 500

class PetStateCore {
  constructor() {
    this._data = {}          // 内存中的宠物状态，唯一真数据源
    this._ready = false      // 是否已完成初始化加载
    this._saveTimer = null   // 防抖计时器句柄
  }

  // 启动时调用一次，从磁盘存档灌入内存。用前必须 await。
  async init() {
    if (this._ready) return
    if (window.electronAPI && window.electronAPI.getPetState) {
      this._data = await window.electronAPI.getPetState()
    } else {
      console.warn('[PetState] electronAPI 不可用，退回空状态')
      this._data = {}
    }
    this._ready = true
  }

  // 读取。对象/数组返回副本，防止外部绕过 set() 直接篡改内部状态（ADR-005）。
  get(key) {
    return this._clone(this._data[key])
  }

  // 写入：改内存 → 按映射发事件 → 防抖存盘。
  set(key, value) {
    this._data[key] = value
    const mapping = KEY_EVENT_MAP[key]
    if (mapping) {
      EventBus.emit(mapping.event, { [mapping.payloadKey]: value })
    }
    this._scheduleSave()
  }

  // 订阅状态事件。转发到 EventBus.on，返回「取消订阅」函数。
  subscribe(event, callback) {
    return EventBus.on(event, callback)
  }

  // ── 内部 ──

  // 返回值的副本：数组逐项克隆、普通对象浅拷一层，基础类型原样返回。
  _clone(value) {
    if (Array.isArray(value)) return value.map((v) => this._clone(v))
    if (value !== null && typeof value === 'object') return { ...value }
    return value
  }

  // 防抖调度：多次 set 只保留最后一次，安静 SAVE_DEBOUNCE_MS 后写盘。
  _scheduleSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null
      this._save()
    }, SAVE_DEBOUNCE_MS)
  }

  // 把当前完整内存状态快照发给主进程存盘（store.js 整体覆盖写）。
  async _save() {
    if (!window.electronAPI || !window.electronAPI.setPetState) return
    try {
      await window.electronAPI.setPetState({ ...this._data })
    } catch (err) {
      console.error('[PetState] 存盘失败:', err)
    }
  }
}

// 单例导出，全项目共用同一个实例。
export const PetState = new PetStateCore()
