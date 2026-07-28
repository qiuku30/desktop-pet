import {
  diffFarmReminder,
  getFarmSummary,
} from '../shared/farm-summary.js'

const REFRESH_MS = 30_000

const BUBBLE_TEXT = Object.freeze({
  mature: '农场有作物成熟啦～ 🌾',
  'processing-complete': '加工台忙完啦～ ⚙️',
  'order-ready': '有订单可以交付啦～ 📋',
})

export function formatFarmIndicator(summary) {
  const count = summary?.matureCount
  if (!Number.isSafeInteger(count) || count <= 0) {
    return { visible: false, text: '' }
  }
  return { visible: true, text: `🌾 ${count}` }
}

export function createPetFarmReminder({
  getState,
  now = () => new Date().toISOString(),
  onSummary = () => {},
  onBubble = () => {},
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  subscribe = () => () => {},
} = {}) {
  let destroyed = false
  let previous = null

  function refresh() {
    if (destroyed) return null
    let state
    try {
      state = getState?.() || {}
    } catch {
      state = {}
    }
    const next = getFarmSummary(state.farm, state.inventory, now())
    const reminder = diffFarmReminder(previous, next)
    previous = next
    if (destroyed) return null
    onSummary(next)
    if (reminder) onBubble(BUBBLE_TEXT[reminder.kind])
    return next
  }

  refresh()
  const timerId = setIntervalFn(() => {
    if (!destroyed) refresh()
  }, REFRESH_MS)
  const unsubscribe = subscribe(() => {
    if (!destroyed) refresh()
  })

  return {
    refresh,
    destroy() {
      if (destroyed) return
      destroyed = true
      clearIntervalFn(timerId)
      unsubscribe?.()
    },
  }
}
