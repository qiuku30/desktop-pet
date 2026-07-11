// 事件总线核心
// 模块间通信的唯一渠道，提供 on / off / once / emit。
// 全项目共用一个单例。模块之间禁止直接 import 通信，一律走此总线。

// 开发模式日志开关：为 true 时打印每次 emit，便于追踪事件链（ADR-002）。
const DEBUG = true

class EventBusCore {
  constructor() {
    // event 名 → 监听器数组
    this._listeners = new Map()
  }

  // 订阅事件，返回「取消订阅」函数（调用即解除本次订阅）。
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, [])
    }
    this._listeners.get(event).push(callback)
    return () => this.off(event, callback)
  }

  // 只触发一次的订阅：触发后自动移除。同样返回「取消订阅」函数。
  once(event, callback) {
    const wrapper = (payload) => {
      this.off(event, wrapper)
      callback(payload)
    }
    return this.on(event, wrapper)
  }

  // 取消订阅。
  off(event, callback) {
    const list = this._listeners.get(event)
    if (!list) return
    const idx = list.indexOf(callback)
    if (idx !== -1) list.splice(idx, 1)
    if (list.length === 0) this._listeners.delete(event)
  }

  // 触发事件，逐个通知监听器。
  emit(event, payload) {
    if (DEBUG) {
      console.log('[EventBus] emit:', event, payload)
    }
    const list = this._listeners.get(event)
    if (!list) return
    // 先复制一份再遍历：防止监听器在回调里 on/off 改动原数组，导致漏掉或重复通知。
    for (const callback of [...list]) {
      // 逐个 try-catch：单个监听器出错只记录，不影响其他监听器与 emit 方（ADR-006）。
      try {
        callback(payload)
      } catch (err) {
        console.error(`[EventBus] listener error on "${event}":`, err)
      }
    }
  }
}

// 单例导出，全项目共用同一个实例。
export const EventBus = new EventBusCore()
