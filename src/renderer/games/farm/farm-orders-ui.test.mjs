import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildOrdersViewModel,
  renderOrdersHtml,
  renderOrdersTab,
} from './farm-orders-ui.js'

const NOW = '2026-07-26T08:00:00.000Z'

function order(id = 'order:1') {
  return {
    id,
    requirements: { 'crop:wheat': 4, 'crop:carrot': 2 },
    materialValue: 16,
    rewards: {
      coins: 22,
      farmExp: 8,
      seedReward: { itemId: 'seed:wheat', count: 1 },
    },
    createdAt: NOW,
  }
}

test('exactly three slots show owned/required, reward snapshot and full-delivery state', () => {
  const vm = buildOrdersViewModel({
    farm: {
      orders: {
        slots: [
          { order: order(), regenerateAt: null },
          { order: null, regenerateAt: '2026-07-26T08:30:00.000Z' },
          { order: null, regenerateAt: null },
        ],
      },
    },
    inventory: { 'crop:wheat': 4, 'crop:carrot': 1 },
  }, NOW)
  const html = renderOrdersHtml(vm)

  assert.equal(vm.slots.length, 3)
  assert.deepEqual(vm.slots[0].requirements.map(entry => [entry.owned, entry.required]), [[4, 4], [1, 2]])
  assert.equal(vm.slots[0].canComplete, false)
  assert.equal((html.match(/class="farm-order-card/g) || []).length, 3)
  assert.match(html, /小麦<\/span><strong>4 \/ 4/)
  assert.match(html, /胡萝卜<\/span><strong>1 \/ 2/)
  assert.match(html, /22🪙/)
  assert.match(html, /农场经验 \+8/)
  assert.match(html, /小麦种子 ×1/)
  assert.match(html, /data-action="complete-order"[^>]*disabled/)
})

test('complete action fires once while global busy lock disables all mutations', () => {
  const container = fakeContainer()
  let completeCount = 0
  let busy = false
  const cleanup = renderOrdersTab(container, buildOrdersViewModel({
    farm: { orders: { slots: [{ order: order(), regenerateAt: null }, empty(), empty()] } },
    inventory: { 'crop:wheat': 4, 'crop:carrot': 2 },
  }, NOW), {
    isBusy: () => busy,
    onComplete() { completeCount += 1; busy = true },
  })
  container.click({ action: 'complete-order', slotIndex: '0' })
  container.click({ action: 'complete-order', slotIndex: '0' })
  assert.equal(completeCount, 1)
  cleanup()
})

test('cooldown countdown requests regeneration settlement once at its boundary', () => {
  let current = Date.parse(NOW)
  let intervalCallback = null
  let requests = 0
  const container = fakeContainer()
  const cleanup = renderOrdersTab(container, buildOrdersViewModel({
    farm: {
      orders: {
        slots: [
          { order: null, regenerateAt: '2026-07-26T08:00:01.000Z' },
          empty(),
          empty(),
        ],
      },
    },
    inventory: {},
  }, NOW), {
    now: () => new Date(current).toISOString(),
    requestSettlement() { requests += 1 },
    setIntervalFn(callback) { intervalCallback = callback; return 8 },
    clearIntervalFn() { intervalCallback = null },
  })
  assert.match(container.innerHTML, /冷却中 00:01/)
  current += 1_000
  intervalCallback()
  intervalCallback()
  assert.equal(requests, 1)
  cleanup()
  assert.equal(intervalCallback, null)
})

function empty() {
  return { order: null, regenerateAt: null }
}

function fakeContainer() {
  let clickHandler = null
  return {
    innerHTML: '',
    addEventListener(type, handler) { if (type === 'click') clickHandler = handler },
    removeEventListener(type, handler) {
      if (type === 'click' && clickHandler === handler) clickHandler = null
    },
    click(dataset) {
      const action = { dataset, disabled: false }
      clickHandler?.({ target: { closest: () => action } })
    },
  }
}
