import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

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

  assert.equal((html.match(/<article class="farm-workshop-slot/g) || []).length, 3)
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

test('workshop renders semantic hero, three slots, five recipes, assets and one feedback consumption', () => {
  const vm = buildProcessingViewModel(snapshot(), FARM_CONFIG, NOW)
  const uiSkin = {
    itemIcons: { 'food:cookie': { src: 'file:///skin/cookie.webp' } },
    itemFallback: { src: 'file:///skin/fallback.webp' },
    workshop: {
      machine: {
        base: { src: 'file:///skin/machine.webp' },
        gearSheet: { src: 'file:///skin/gears.webp', frameCount: 4, durationMs: 800 },
        steamSheet: { src: 'file:///skin/steam.webp', frameCount: 4, durationMs: 1200 },
      },
      slots: {},
    },
  }
  const html = renderProcessingHtml(vm, { uiSkin, uiFeedback: { id: 7, type: 'enqueue' } })
  assert.equal((html.match(/<article class="farm-workshop-slot/g) || []).length, 3)
  assert.equal((html.match(/<article class="farm-workshop-recipe/g) || []).length, 5)
  assert.match(html, /class="farm-workshop-hero/)
  assert.match(html, /--farm-workshop-gear-sheet:url\('file:\/\/\/skin\/gears\.webp'\)/)
  assert.match(html, /--farm-workshop-steam-sheet:url\('file:\/\/\/skin\/steam\.webp'\)/)
  assert.match(html, /data-machine-state="idle"/)
  assert.match(html, /data-hidden="false" data-reduced-motion="false"/)
  assert.doesNotMatch(html, /farm-workshop-gear farm-workshop-gear--active/)
  assert.match(html, /data-action="enqueue-processing"/)
  assert.match(html, /file:\/\/\/skin\/fallback\.webp/)
  assert.doesNotMatch(html, /🌾|🍪|📦|🪙/u)

  let consumed = 0
  let timeoutCallback = null
  const container = fakeContainer()
  const cleanup = renderProcessingTab(container, vm, {
    uiSkin,
    uiFeedback: { id: 7, type: 'enqueue' },
    consumeUiFeedback(id) { consumed += id },
    setTimeoutFn(callback) { timeoutCallback = callback; return 9 },
    clearTimeoutFn() { timeoutCallback = null },
    setIntervalFn: () => 1,
    clearIntervalFn() {},
  })
  assert.equal(consumed, 0)
  assert.match(container.innerHTML, /farm-workshop-view--enqueue/)
  timeoutCallback()
  assert.equal(consumed, 7)
  assert.doesNotMatch(container.innerHTML, /farm-workshop-view--enqueue/)
  cleanup()
})

test('workshop feedback timer belongs to cleanup and cannot consume after replacement', () => {
  const vm = buildProcessingViewModel(snapshot(), FARM_CONFIG, NOW)
  let callback = null
  let cleared = 0
  let consumed = 0
  const container = fakeContainer()
  const cleanup = renderProcessingTab(container, vm, {
    uiFeedback: { id: 11, type: 'processing-complete' },
    consumeUiFeedback() { consumed += 1 },
    setTimeoutFn(next) { callback = next; return 12 },
    clearTimeoutFn() { cleared += 1 },
    setIntervalFn: () => 1,
    clearIntervalFn() {},
  })
  cleanup()
  callback?.()
  assert.equal(cleared, 1)
  assert.equal(consumed, 0)
})

test('workshop fallback colors and four-frame sheet positions have deterministic CSS contracts', async () => {
  const css = await readFile(new URL('./farm-workshop.css', import.meta.url), 'utf8')
  assert.match(css, /\.farm-workshop-hero\s*\{[^}]*background-color:/s)
  assert.match(css, /\.farm-workshop-slot\s*\{[^}]*background-color:[^}]*background-image:\s*var\(--farm-workshop-slot-image,\s*none\)/s)
  assert.match(css, /\.farm-workshop-shelf\s*\{[^}]*background-color:[^}]*background-image:\s*var\(--farm-workshop-shelf-image,\s*none\)/s)
  assert.match(css, /@keyframes farm-workshop-sheet\s*\{\s*to\s*\{\s*background-position:\s*133\.333(?:3+)?% 0;/)
})

function fakeContainer() {
  return {
    innerHTML: '',
    addEventListener() {},
    removeEventListener() {},
  }
}
