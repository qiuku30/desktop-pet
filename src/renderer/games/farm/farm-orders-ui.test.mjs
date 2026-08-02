import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

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
  assert.equal((html.match(/<article class="farm-orders-paper/g) || []).length, 3)
  assert.match(html, /小麦<\/span><strong>4 \/ 4/)
  assert.match(html, /胡萝卜<\/span><strong>1 \/ 2/)
  assert.match(html, /金币 22/)
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

test('continuous board renders three semantic papers, states, fallback and one feedback consumption', () => {
  const vm = buildOrdersViewModel({
    farm: { orders: { slots: [
      { order: order('order:ready'), regenerateAt: null },
      { order: order('order:incomplete'), regenerateAt: null },
      { order: null, regenerateAt: '2026-07-26T08:30:00.000Z' },
    ] } },
    inventory: { 'crop:wheat': 4, 'crop:carrot': 2 },
  }, NOW)
  vm.slots[1].canComplete = false
  const uiSkin = {
    itemIcons: {},
    itemFallback: { src: 'file:///skin/fallback.webp' },
    orders: { board: { src: 'file:///skin/board.webp' }, readyStamp: { src: 'file:///skin/stamp.webp' }, completionOverlay: { src: 'file:///skin/complete.webp' } },
  }
  const html = renderOrdersHtml(vm, { uiSkin, uiFeedback: { id: 5, type: 'order-complete' } })
  assert.match(html, /class="farm-orders-board/)
  assert.match(html, /data-hidden="false" data-reduced-motion="false"/)
  assert.equal((html.match(/<article class="farm-orders-paper/g) || []).length, 3)
  assert.match(html, /data-order-state="ready"/)
  assert.match(html, /data-order-state="incomplete"/)
  assert.match(html, /data-order-countdown=/)
  assert.match(html, /file:\/\/\/skin\/fallback\.webp/)
  assert.match(html, /farm-orders-completion-overlay/)
  assert.doesNotMatch(html, /🌾|🍪|📦|🪙|🌱/u)

  let consumed = 0
  let timeoutCallback = null
  const container = fakeContainer()
  const cleanup = renderOrdersTab(container, vm, {
    uiSkin,
    uiFeedback: { id: 5, type: 'order-complete' },
    consumeUiFeedback(id) { consumed += id },
    setTimeoutFn(callback) { timeoutCallback = callback; return 9 },
    clearTimeoutFn() { timeoutCallback = null },
    setIntervalFn: () => 1,
    clearIntervalFn() {},
  })
  assert.equal(consumed, 0)
  assert.match(container.innerHTML, /farm-orders-board--order-complete/)
  timeoutCallback()
  assert.equal(consumed, 5)
  assert.doesNotMatch(container.innerHTML, /farm-orders-board--order-complete/)
  cleanup()
})

test('order feedback timer belongs to cleanup and cannot consume after tab replacement', () => {
  const vm = buildOrdersViewModel({ farm: { orders: { slots: [empty(), empty(), empty()] } }, inventory: {} }, NOW)
  let callback = null
  let cleared = 0
  let consumed = 0
  const cleanup = renderOrdersTab(fakeContainer(), vm, {
    uiFeedback: { id: 13, type: 'order-abandon' },
    consumeUiFeedback() { consumed += 1 },
    setTimeoutFn(next) { callback = next; return 14 },
    clearTimeoutFn() { cleared += 1 },
  })
  cleanup()
  callback?.()
  assert.equal(cleared, 1)
  assert.equal(consumed, 0)
})

test('order board and paper keep warm fallback colors when image variables are absent', async () => {
  const css = await readFile(new URL('./farm-orders.css', import.meta.url), 'utf8')
  assert.match(css, /\.farm-orders-board\s*\{[^}]*background-color:[^}]*background-image:\s*var\(--farm-orders-board-image,\s*none\)/s)
  assert.match(css, /\.farm-orders-paper\s*\{[^}]*background-color:[^}]*background-image:\s*var\(--farm-orders-paper-image,\s*none\)/s)
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
