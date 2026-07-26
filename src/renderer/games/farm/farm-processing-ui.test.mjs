import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildProcessingViewModel,
  renderProcessingHtml,
  renderProcessingTab,
} from './farm-processing-ui.js'
import { FARM_CONFIG } from './farm-config.mjs'

const NOW = '2026-07-26T08:00:00.000Z'

function snapshot(overrides = {}) {
  return {
    farm: {
      level: 1,
      processor: { level: 1, queue: [] },
    },
    inventory: { 'crop:wheat': 2 },
    ...structuredClone(overrides),
  }
}

test('recipes expose unlock, owned/required ingredients and queue capacity state', () => {
  const vm = buildProcessingViewModel(snapshot(), FARM_CONFIG, NOW)
  const cookie = vm.recipes.find(recipe => recipe.id === 'recipe:cookie')
  const popcorn = vm.recipes.find(recipe => recipe.id === 'recipe:popcorn')

  assert.equal(cookie.unlocked, true)
  assert.equal(cookie.canEnqueue, true)
  assert.deepEqual(cookie.ingredients, [{
    id: 'crop:wheat', name: '小麦', emoji: '🌾', owned: 2, required: 2, sufficient: true,
  }])
  assert.equal(popcorn.unlocked, false)
  assert.equal(popcorn.lockMessage, '农场 Lv.2 解锁')

  const full = buildProcessingViewModel(snapshot({
    farm: {
      level: 1,
      processor: { level: 1, queue: [{}, {}, {}] },
    },
  }), FARM_CONFIG, NOW)
  assert.equal(full.queueFull, true)
  assert.equal(full.recipes.find(recipe => recipe.id === 'recipe:cookie').canEnqueue, false)
})

test('queue renders three slots, running countdown and queued exact refund controls', () => {
  const vm = buildProcessingViewModel(snapshot({
    farm: {
      level: 1,
      processor: {
        level: 1,
        queue: [
          {
            id: 'processing-task:1', recipeId: 'recipe:cookie', status: 'running',
            inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 },
            completesAt: '2026-07-26T08:00:05.000Z',
          },
          {
            id: 'processing-task:2', recipeId: 'recipe:cookie', status: 'queued',
            inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 },
            completesAt: null,
          },
        ],
      },
    },
  }), FARM_CONFIG, NOW)
  const html = renderProcessingHtml(vm)

  assert.equal((html.match(/class="farm-queue-slot/g) || []).length, 3)
  assert.match(html, /00:05/)
  assert.doesNotMatch(html, /data-task-id="processing-task:1"[^>]*>取消/)
  assert.match(html, /data-action="cancel-processing" data-task-id="processing-task:2"/)
  assert.match(html, /小麦 × 2/)
})

test('completed outputs are reflected by the next inventory-derived recipe state', () => {
  const vm = buildProcessingViewModel(snapshot({
    inventory: { 'crop:wheat': 2, 'food:cookie': 6 },
  }), FARM_CONFIG, NOW)
  assert.deepEqual(vm.outputInventory, [{
    id: 'food:cookie', name: '饼干', emoji: '🍪', count: 6,
  }])
})

test('tab timer requests settlement once per crossed processing boundary and cleanup stops it', () => {
  let current = Date.parse(NOW)
  let intervalCallback = null
  let settlementRequests = 0
  const container = fakeContainer()
  const cleanup = renderProcessingTab(container, buildProcessingViewModel(snapshot({
    farm: {
      level: 1,
      processor: {
        level: 1,
        queue: [{
          id: 'processing-task:1', recipeId: 'recipe:cookie', status: 'running',
          inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 },
          completesAt: '2026-07-26T08:00:01.000Z',
        }],
      },
    },
  }), FARM_CONFIG, NOW), {
    now: () => new Date(current).toISOString(),
    requestSettlement: () => { settlementRequests += 1 },
    setIntervalFn(callback) { intervalCallback = callback; return 7 },
    clearIntervalFn() { intervalCallback = null },
  })

  current += 1_000
  intervalCallback()
  assert.equal(settlementRequests, 1)
  intervalCallback()
  assert.equal(settlementRequests, 1)
  cleanup()
  assert.equal(intervalCallback, null)
})

function fakeContainer() {
  return {
    innerHTML: '',
    addEventListener() {},
    removeEventListener() {},
  }
}
