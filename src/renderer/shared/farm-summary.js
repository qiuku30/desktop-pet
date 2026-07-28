function emptySummary() {
  return {
    matureCount: 0,
    processingCompletionKey: null,
    readyOrderIds: [],
  }
}

function validDateMs(value) {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validId(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function readyOrderIds(slots, inventory) {
  if (!Array.isArray(slots)) return []
  return slots.flatMap(slot => {
    const order = slot?.order
    const requirements = order?.requirements
    if (!validId(order?.id) || !requirements || Array.isArray(requirements)
        || typeof requirements !== 'object') return []
    const entries = Object.entries(requirements)
    if (entries.length === 0 || entries.some(([itemId, count]) =>
      !validId(itemId) || !Number.isSafeInteger(count) || count <= 0
      || !Number.isSafeInteger(inventory[itemId]) || inventory[itemId] < count)) return []
    return [order.id]
  }).sort()
}

function processingCompletionKey(farm, nowMs) {
  const queue = farm.processor?.queue
  if (Array.isArray(queue) && queue.length > 0) {
    let finalCompletionMs = validDateMs(queue[0]?.completesAt)
    let validQueue = finalCompletionMs !== null
    for (let index = 0; validQueue && index < queue.length; index += 1) {
      const task = queue[index]
      if (!validId(task?.id)) {
        validQueue = false
      } else if (index > 0) {
        const explicitCompletion = validDateMs(task.completesAt)
        if (explicitCompletion !== null) {
          finalCompletionMs = explicitCompletion
        } else if (Number.isSafeInteger(task.durationMs) && task.durationMs > 0) {
          finalCompletionMs += task.durationMs
        } else {
          validQueue = false
        }
      }
    }
    return validQueue && finalCompletionMs <= nowMs ? queue.at(-1).id : null
  }
  const persisted = farm.notificationState?.lastCompletedProcessingTaskId
  return validId(persisted) ? persisted : null
}

export function getFarmSummary(farm, inventory, now) {
  const nowMs = validDateMs(now)
  if (!farm || Array.isArray(farm) || typeof farm !== 'object' || nowMs === null
      || !inventory || Array.isArray(inventory) || typeof inventory !== 'object') {
    return emptySummary()
  }
  const tiles = farm.farms?.[farm.activeFarmId]?.tiles
  if (!Array.isArray(tiles)) return emptySummary()

  const matureCount = tiles.reduce((count, tile) => {
    const readyAt = validDateMs(tile?.crop?.readyAt)
    return count + (readyAt !== null && readyAt <= nowMs ? 1 : 0)
  }, 0)

  return {
    matureCount,
    processingCompletionKey: processingCompletionKey(farm, nowMs),
    readyOrderIds: readyOrderIds(farm.orders?.slots, inventory),
  }
}

function validSummary(value) {
  return Boolean(
    value
    && Number.isSafeInteger(value.matureCount)
    && value.matureCount >= 0
    && (value.processingCompletionKey === null || validId(value.processingCompletionKey))
    && Array.isArray(value.readyOrderIds)
    && value.readyOrderIds.every(validId),
  )
}

export function diffFarmReminder(previous, next) {
  if (!validSummary(previous) || !validSummary(next)) return null
  if (next.matureCount > previous.matureCount) {
    return { kind: 'mature', count: next.matureCount }
  }
  if (next.processingCompletionKey
      && next.processingCompletionKey !== previous.processingCompletionKey) {
    return { kind: 'processing-complete' }
  }
  const previousReady = new Set(previous.readyOrderIds)
  if (next.readyOrderIds.some(orderId => !previousReady.has(orderId))) {
    return { kind: 'order-ready' }
  }
  return null
}
