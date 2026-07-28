import test from 'node:test'
import assert from 'node:assert/strict'

import { diffFarmReminder, getFarmSummary } from './farm-summary.js'

const NOW = '2026-07-28T08:00:00.000Z'

function farmFixture() {
  return {
    level: 3,
    exp: 12,
    activeFarmId: 'basic-farm',
    farms: {
      'basic-farm': {
        tiles: [
          { id: 'a', crop: { readyAt: '2026-07-28T07:59:00.000Z' } },
          { id: 'b', crop: { readyAt: '2026-07-28T08:01:00.000Z' } },
          { id: 'c', crop: null },
        ],
      },
    },
    processor: {
      queue: [{
        id: 'processing-task:4',
        status: 'running',
        completesAt: '2026-07-28T07:58:00.000Z',
      }],
    },
    orders: {
      slots: [
        {
          order: {
            id: 'order:2',
            requirements: { 'crop:wheat': 2 },
          },
        },
        {
          order: {
            id: 'order:1',
            requirements: { 'crop:carrot': 1 },
          },
        },
        { order: null },
      ],
    },
    notificationState: {
      lastCompletedProcessingTaskId: null,
    },
  }
}

test('derives serializable mature, processing-complete and ready-order summary', () => {
  const summary = getFarmSummary(farmFixture(), {
    'crop:wheat': 2,
    'crop:carrot': 0,
  }, NOW)

  assert.deepEqual(summary, {
    matureCount: 1,
    processingCompletionKey: 'processing-task:4',
    readyOrderIds: ['order:2'],
  })
  assert.doesNotThrow(() => JSON.stringify(summary))
})

test('uses persisted processing completion key after queue settlement', () => {
  const farm = farmFixture()
  farm.processor.queue = []
  farm.notificationState.lastCompletedProcessingTaskId = 'processing-task:4'

  assert.equal(
    getFarmSummary(farm, {}, NOW).processingCompletionKey,
    'processing-task:4',
  )
})

test('derives all-serial-processing completion from the active deadline and queued durations', () => {
  const farm = farmFixture()
  farm.processor.queue = [
    {
      id: 'processing-task:4',
      status: 'running',
      completesAt: '2026-07-28T07:58:00.000Z',
      durationMs: 60_000,
    },
    {
      id: 'processing-task:5',
      status: 'queued',
      completesAt: null,
      durationMs: 120_000,
    },
  ]

  assert.equal(
    getFarmSummary(farm, {}, '2026-07-28T07:59:59.999Z').processingCompletionKey,
    null,
  )
  assert.equal(
    getFarmSummary(farm, {}, '2026-07-28T08:00:00.000Z').processingCompletionKey,
    'processing-task:5',
  )
})

test('a running replacement queue suppresses an older persisted completion until its own boundary', () => {
  const farm = farmFixture()
  farm.notificationState.lastCompletedProcessingTaskId = 'processing-task:1'
  farm.processor.queue = [
    {
      id: 'processing-task:2',
      status: 'running',
      completesAt: '2026-07-28T08:01:00.000Z',
      durationMs: 60_000,
    },
    {
      id: 'processing-task:3',
      status: 'queued',
      completesAt: null,
      durationMs: 120_000,
    },
  ]
  const previous = {
    matureCount: 2,
    processingCompletionKey: 'processing-task:1',
    readyOrderIds: [],
  }

  const running = getFarmSummary(farm, {}, '2026-07-28T08:02:59.999Z')
  assert.equal(running.processingCompletionKey, null)
  assert.equal(diffFarmReminder(previous, running), null)

  const completed = getFarmSummary(farm, {}, '2026-07-28T08:03:00.000Z')
  assert.equal(completed.processingCompletionKey, 'processing-task:3')
  assert.deepEqual(diffFarmReminder(running, completed), { kind: 'processing-complete' })
  assert.equal(diffFarmReminder(completed, structuredClone(completed)), null)
})

test('order readiness requires complete positive integer requirements and inventory', () => {
  const farm = farmFixture()
  farm.orders.slots.push(
    { order: { id: 'bad-empty', requirements: {} } },
    { order: { id: 'bad-count', requirements: { 'crop:wheat': 0 } } },
    { order: { id: '', requirements: { 'crop:wheat': 1 } } },
  )
  const summary = getFarmSummary(farm, { 'crop:wheat': 2 }, NOW)

  assert.deepEqual(summary.readyOrderIds, ['order:2'])
})

test('malformed state and invalid time safely return the empty summary', () => {
  const empty = {
    matureCount: 0,
    processingCompletionKey: null,
    readyOrderIds: [],
  }
  for (const [farm, inventory, now] of [
    [null, null, NOW],
    [{}, [], NOW],
    [{ farms: null }, {}, 'not-a-date'],
  ]) {
    assert.deepEqual(getFarmSummary(farm, inventory, now), empty)
  }
})

test('first snapshot and unchanged snapshot produce no reminder', () => {
  const summary = {
    matureCount: 1,
    processingCompletionKey: 'processing-task:1',
    readyOrderIds: ['order:1'],
  }
  assert.equal(diffFarmReminder(null, summary), null)
  assert.equal(diffFarmReminder(summary, structuredClone(summary)), null)
})

test('each individual transition returns its fixed descriptor', () => {
  const base = { matureCount: 0, processingCompletionKey: null, readyOrderIds: [] }

  assert.deepEqual(
    diffFarmReminder(base, { ...base, matureCount: 2 }),
    { kind: 'mature', count: 2 },
  )
  assert.deepEqual(
    diffFarmReminder(base, { ...base, processingCompletionKey: 'processing-task:2' }),
    { kind: 'processing-complete' },
  )
  assert.deepEqual(
    diffFarmReminder(base, { ...base, readyOrderIds: ['order:3'] }),
    { kind: 'order-ready' },
  )
})

test('simultaneous transitions use mature then processing then order priority', () => {
  const base = { matureCount: 0, processingCompletionKey: null, readyOrderIds: [] }
  const all = {
    matureCount: 1,
    processingCompletionKey: 'processing-task:1',
    readyOrderIds: ['order:1'],
  }
  assert.deepEqual(diffFarmReminder(base, all), { kind: 'mature', count: 1 })
  assert.deepEqual(
    diffFarmReminder(base, { ...all, matureCount: 0 }),
    { kind: 'processing-complete' },
  )
  assert.deepEqual(
    diffFarmReminder(base, {
      matureCount: 1,
      processingCompletionKey: null,
      readyOrderIds: ['order:1'],
    }),
    { kind: 'mature', count: 1 },
  )
})

test('lower-priority simultaneous transitions are consumed and not replayed next tick', () => {
  const previous = { matureCount: 0, processingCompletionKey: null, readyOrderIds: [] }
  const next = {
    matureCount: 1,
    processingCompletionKey: 'processing-task:1',
    readyOrderIds: ['order:1'],
  }

  assert.deepEqual(diffFarmReminder(previous, next), { kind: 'mature', count: 1 })
  assert.equal(diffFarmReminder(next, structuredClone(next)), null)
})

test('decreases, removed orders and malformed summaries never notify', () => {
  assert.equal(diffFarmReminder(
    { matureCount: 2, processingCompletionKey: 'processing-task:2', readyOrderIds: ['order:1'] },
    { matureCount: 1, processingCompletionKey: null, readyOrderIds: [] },
  ), null)
  assert.equal(diffFarmReminder({}, null), null)
})
