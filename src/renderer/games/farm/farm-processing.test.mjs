import test from 'node:test'
import assert from 'node:assert/strict'
import { cancelQueuedTask, enqueueRecipe, settleProcessing } from './farm-processing.mjs'

const NOW = '2026-07-26T08:00:00.000Z'

test('enqueue deducts ingredients immediately, starts first task and caps queue at three', () => {
  let processor = { level: 1, queue: [] }
  let inventory = { 'crop:wheat': 8 }
  let nextIds = { processingTask: 1 }
  for (let index = 0; index < 3; index += 1) {
    const result = enqueueRecipe({ processor, inventory, recipeId: 'recipe:cookie', now: NOW, nextIds })
    assert.equal(result.ok, true)
    processor = result.processor
    inventory = result.inventory
    nextIds = result.nextIds
  }
  assert.equal(processor.queue.length, 3)
  assert.equal(processor.queue[0].status, 'running')
  assert.equal(processor.queue[1].status, 'queued')
  assert.equal(inventory['crop:wheat'], 2)
  assert.deepEqual(nextIds, { processingTask: 4 })
  assert.equal(enqueueRecipe({ processor, inventory, recipeId: 'recipe:cookie', now: NOW, nextIds }).error, 'QUEUE_FULL')
})

test('running task cannot cancel and queued task refunds its exact input snapshot', () => {
  const processor = {
    level: 1,
    queue: [
      { id: 'processing-task:1', status: 'running', inputs: { 'crop:wheat': 2 } },
      { id: 'processing-task:2', status: 'queued', inputs: { 'crop:wheat': 2 } },
    ],
  }
  assert.equal(cancelQueuedTask({ processor, inventory: {}, taskId: 'processing-task:1' }).error, 'TASK_RUNNING')
  const result = cancelQueuedTask({ processor, inventory: {}, taskId: 'processing-task:2' })
  assert.equal(result.ok, true)
  assert.deepEqual(result.inventory, { 'crop:wheat': 2 })
  assert.deepEqual(result.processor.queue.map(task => task.id), ['processing-task:1'])
})

test('one offline settlement completes multiple tasks at exact serial boundaries', () => {
  const processor = {
    level: 1,
    queue: [
      {
        id: 'processing-task:1', recipeId: 'recipe:cookie',
        inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 },
        durationMs: 1_800_000, enqueuedAt: NOW, startedAt: NOW,
        completesAt: '2026-07-26T08:30:00.000Z', status: 'running',
      },
      {
        id: 'processing-task:2', recipeId: 'recipe:cookie',
        inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 },
        durationMs: 1_800_000, enqueuedAt: NOW, startedAt: null,
        completesAt: null, status: 'queued',
      },
      {
        id: 'processing-task:3', recipeId: 'recipe:cookie',
        inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 },
        durationMs: 1_800_000, enqueuedAt: NOW, startedAt: null,
        completesAt: null, status: 'queued',
      },
    ],
  }
  const result = settleProcessing({
    processor,
    inventory: {},
    now: '2026-07-26T09:05:00.000Z',
  })
  assert.deepEqual(result.completedTaskIds, ['processing-task:1', 'processing-task:2'])
  assert.deepEqual(result.outputs, { 'food:cookie': 6 })
  assert.equal(result.processor.queue[0].id, 'processing-task:3')
  assert.equal(result.processor.queue[0].startedAt, '2026-07-26T09:00:00.000Z')
  assert.equal(result.processor.queue[0].completesAt, '2026-07-26T09:30:00.000Z')
  assert.deepEqual(result.inventory, { 'food:cookie': 6 })
})
