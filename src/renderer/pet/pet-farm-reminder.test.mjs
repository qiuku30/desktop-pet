import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createPetFarmReminder,
  formatFarmIndicator,
} from './pet-farm-reminder.mjs'

const START = '2026-07-28T08:00:00.000Z'

function stateFixture() {
  return {
    farm: {
      activeFarmId: 'basic-farm',
      farms: {
        'basic-farm': {
          tiles: [{
            id: 'r1c1',
            crop: { readyAt: '2026-07-28T08:01:00.000Z' },
          }],
        },
      },
      processor: { queue: [] },
      orders: { slots: [] },
      notificationState: { lastCompletedProcessingTaskId: null },
    },
    inventory: {},
  }
}

function createHarness() {
  const state = stateFixture()
  const summaries = []
  const bubbles = []
  const timers = new Map()
  let nextTimerId = 1
  let now = START
  let stateListener = null
  let unsubscribeCalls = 0
  const reminder = createPetFarmReminder({
    getState: () => structuredClone(state),
    now: () => now,
    onSummary: summary => summaries.push(summary),
    onBubble: text => bubbles.push(text),
    setIntervalFn(callback, delay) {
      const id = nextTimerId++
      timers.set(id, { callback, delay })
      return id
    },
    clearIntervalFn(id) {
      timers.delete(id)
    },
    subscribe(callback) {
      stateListener = callback
      return () => {
        unsubscribeCalls += 1
        stateListener = null
      }
    },
  })
  return {
    state,
    summaries,
    bubbles,
    timers,
    reminder,
    setNow(value) { now = value },
    emitStateChange() { stateListener?.() },
    unsubscribeCalls: () => unsubscribeCalls,
  }
}

test('initial snapshot updates indicator immediately without a bubble and owns one 30s timer', () => {
  const harness = createHarness()

  assert.deepEqual(harness.summaries, [{
    matureCount: 0,
    processingCompletionKey: null,
    readyOrderIds: [],
  }])
  assert.deepEqual(harness.bubbles, [])
  assert.equal(harness.timers.size, 1)
  assert.equal([...harness.timers.values()][0].delay, 30_000)
  harness.reminder.destroy()
})

test('indicator shows only mature count and hides at zero', () => {
  assert.deepEqual(formatFarmIndicator({ matureCount: 3 }), {
    visible: true,
    text: '🌾 3',
  })
  assert.deepEqual(formatFarmIndicator({ matureCount: 0 }), {
    visible: false,
    text: '',
  })
  assert.deepEqual(formatFarmIndicator(null), {
    visible: false,
    text: '',
  })
})

test('timer discovers maturity once, updates count and never duplicates the bubble', () => {
  const harness = createHarness()
  const timer = [...harness.timers.values()][0]

  harness.setNow('2026-07-28T08:01:00.000Z')
  timer.callback()
  timer.callback()

  assert.equal(harness.summaries.at(-1).matureCount, 1)
  assert.deepEqual(harness.bubbles, ['农场有作物成熟啦～ 🌾'])
  harness.reminder.destroy()
})

test('state change refreshes immediately and fixed processing/order messages emit once', () => {
  const processing = createHarness()
  processing.state.farm.notificationState.lastCompletedProcessingTaskId = 'processing-task:1'
  processing.emitStateChange()
  processing.emitStateChange()
  assert.deepEqual(processing.bubbles, ['加工台忙完啦～ ⚙️'])
  processing.reminder.destroy()

  const order = createHarness()
  order.state.farm.orders.slots = [{
    order: {
      id: 'order:1',
      requirements: { 'crop:wheat': 2 },
    },
  }]
  order.state.inventory['crop:wheat'] = 2
  order.emitStateChange()
  order.emitStateChange()
  assert.deepEqual(order.bubbles, ['有订单可以交付啦～ 📋'])
  order.reminder.destroy()
})

test('simultaneous transitions emit only the fixed priority result and consume the rest', () => {
  const harness = createHarness()
  harness.setNow('2026-07-28T08:01:00.000Z')
  harness.state.farm.notificationState.lastCompletedProcessingTaskId = 'processing-task:1'
  harness.state.farm.orders.slots = [{
    order: { id: 'order:1', requirements: { 'crop:wheat': 1 } },
  }]
  harness.state.inventory['crop:wheat'] = 1

  harness.emitStateChange()
  harness.emitStateChange()

  assert.deepEqual(harness.bubbles, ['农场有作物成熟啦～ 🌾'])
  harness.reminder.destroy()
})

test('manual refresh uses the same dedupe baseline', () => {
  const harness = createHarness()
  harness.setNow('2026-07-28T08:01:00.000Z')

  harness.reminder.refresh()
  harness.reminder.refresh()

  assert.deepEqual(harness.bubbles, ['农场有作物成熟啦～ 🌾'])
  harness.reminder.destroy()
})

test('destroy clears timer/subscription and blocks late callbacks and manual refresh', () => {
  const harness = createHarness()
  const staleTimer = [...harness.timers.values()][0].callback
  const summaryCount = harness.summaries.length

  harness.reminder.destroy()
  assert.equal(harness.timers.size, 0)
  assert.equal(harness.unsubscribeCalls(), 1)

  harness.setNow('2026-07-28T08:01:00.000Z')
  staleTimer()
  harness.reminder.refresh()
  harness.emitStateChange()
  assert.equal(harness.summaries.length, summaryCount)
  assert.deepEqual(harness.bubbles, [])

  harness.reminder.destroy()
  assert.equal(harness.unsubscribeCalls(), 1)
})
