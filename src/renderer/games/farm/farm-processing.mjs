import { addItems, removeItems } from '../../shared/inventory-service.js'
import { FARM_REWARD_CONFIG, RECIPES } from './farm-config.mjs'

const clone = value => structuredClone(value)

export function enqueueRecipe({ processor, inventory, recipeId, now, nextIds }) {
  const recipe = RECIPES[recipeId]
  if (!recipe) return { ok: false, error: 'UNKNOWN_RECIPE', processor, inventory, nextIds }
  if (processor.queue.length >= FARM_REWARD_CONFIG.processorQueueCapacity) {
    return { ok: false, error: 'QUEUE_FULL', processor, inventory, nextIds }
  }
  const removed = removeItems(inventory, recipe.inputs)
  if (!removed.ok) return { ok: false, error: 'INSUFFICIENT_INGREDIENTS', processor, inventory, nextIds, missing: removed.missing }

  const sequence = nextIds.processingTask
  const running = processor.queue.length === 0
  const task = {
    id: `processing-task:${sequence}`,
    recipeId,
    inputs: clone(recipe.inputs),
    outputs: clone(recipe.outputs),
    durationMs: recipe.durationMs,
    enqueuedAt: now,
    startedAt: running ? now : null,
    completesAt: running ? new Date(Date.parse(now) + recipe.durationMs).toISOString() : null,
    status: running ? 'running' : 'queued',
  }
  return {
    ok: true,
    task,
    processor: { ...processor, queue: [...processor.queue.map(clone), task] },
    inventory: removed.inventory,
    nextIds: { ...nextIds, processingTask: sequence + 1 },
  }
}

export function cancelQueuedTask({ processor, inventory, taskId }) {
  const task = processor.queue.find(entry => entry.id === taskId)
  if (!task) return { ok: false, error: 'TASK_NOT_FOUND', processor, inventory }
  if (task.status === 'running') return { ok: false, error: 'TASK_RUNNING', processor, inventory }
  return {
    ok: true,
    processor: { ...processor, queue: processor.queue.filter(entry => entry.id !== taskId).map(clone) },
    inventory: addItems(inventory, task.inputs),
    cancelledTaskId: taskId,
  }
}

export function settleProcessing({ processor, inventory, now }) {
  const nowMs = Date.parse(now)
  if (!Number.isFinite(nowMs) || processor.queue.length === 0) {
    return { changed: false, processor, inventory, completedTaskIds: [], outputs: {} }
  }

  const queue = processor.queue.map(clone)
  const completedTaskIds = []
  let outputs = {}
  let cursor = queue[0].status === 'running' && Number.isFinite(Date.parse(queue[0].completesAt))
    ? Date.parse(queue[0].completesAt)
    : nowMs + queue[0].durationMs

  while (queue.length && cursor <= nowMs) {
    const completed = queue.shift()
    completedTaskIds.push(completed.id)
    outputs = addItems(outputs, completed.outputs)
    if (queue.length) {
      const next = queue[0]
      next.status = 'running'
      next.startedAt = new Date(cursor).toISOString()
      cursor += next.durationMs
      next.completesAt = new Date(cursor).toISOString()
    }
  }

  if (!completedTaskIds.length) {
    return { changed: false, processor, inventory, completedTaskIds, outputs }
  }
  return {
    changed: true,
    processor: { ...processor, queue },
    inventory: addItems(inventory, outputs),
    completedTaskIds,
    outputs,
  }
}
