import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFarmViewModel,
  escapeHtml,
  mountFarm,
  renderFarmShell,
  renderFieldGrid,
} from './farm-ui.js'
import { createDefaultFarmState } from './farm-state.mjs'
import { FARM_CONFIG } from './farm-config.mjs'

const NOW = '2026-07-26T08:00:00.000Z'

function sampleState() {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const tiles = farm.farms['basic-farm'].tiles
  tiles.find(tile => tile.id === 'r1c1').crop = {
    cropId: 'crop:wheat',
    seedId: 'seed:wheat',
    plantedAt: '2026-07-26T07:00:00.000Z',
    readyAt: '2026-07-26T07:15:00.000Z',
    baseYield: 4,
    harvestExp: 1,
    snapshot: {
      baseDurationMs: 900000,
      durationMs: 900000,
      baseYield: 4,
      landMultiplier: 1,
      scarecrow: 0,
      farmYieldMultiplier: 1,
      quantity: 4,
      bonusDropChance: 0.03,
      contributingBuildingIds: [],
    },
  }
  tiles.find(tile => tile.id === 'r1c2').crop = {
    ...structuredClone(tiles.find(tile => tile.id === 'r1c1').crop),
    cropId: 'crop:carrot',
    seedId: 'seed:carrot',
  }
  farm.exp = 4
  return farm
}

test('view model exposes exactly sixteen stable tiles and farm-02 summary semantics', () => {
  const vm = buildFarmViewModel({
    farm: sampleState(),
    inventory: { 'seed:wheat': 3 },
    coins: 100,
    petLevel: 2,
  }, FARM_CONFIG, NOW)

  assert.equal(vm.tiles.length, 16)
  assert.deepEqual(vm.tiles.map(tile => tile.id), FARM_CONFIG.farms['basic-farm'].tiles.map(tile => tile.id))
  assert.deepEqual(vm.summary, {
    matureFieldCount: 2,
    processing: { queuedCount: 0, nextCompletionAt: null },
    orders: { readyCount: 0 },
    farmLevel: 1,
    farmExp: 4,
  })
})

test('view model derives unlock, seed, land, building and work-lock presentation data', () => {
  const farm = sampleState()
  const tiles = farm.farms['basic-farm'].tiles
  tiles.find(tile => tile.id === 'r1c1').crop.snapshot.contributingBuildingIds = ['building:1']
  const buildingTile = tiles.find(tile => tile.id === 'r2c2')
  buildingTile.occupancy = 'building'
  buildingTile.building = {
    id: 'building:1',
    typeId: 'building:sprinkler',
    level: 1,
    investedCoins: 60,
  }

  const vm = buildFarmViewModel({
    farm,
    inventory: { 'seed:wheat': 0 },
    coins: 100,
    petLevel: 2,
  }, FARM_CONFIG, NOW)

  assert.equal(vm.crops.find(crop => crop.id === 'crop:wheat').quickBuyPrice, 4)
  assert.equal(vm.tiles.find(tile => tile.id === 'r0c1').unlock.eligible, true)
  assert.equal(vm.tiles.find(tile => tile.id === 'r0c0').unlock.eligible, false)
  assert.equal(vm.tiles.find(tile => tile.id === 'r2c1').land.nextCost, 80)
  assert.equal(vm.tiles.find(tile => tile.id === 'r2c2').building.working, true)
  assert.equal(vm.tiles.find(tile => tile.id === 'r2c2').building.refundPreview, 30)
})

test('shell enables all three tabs, keeps the summary and exposes a child tab host', () => {
  const vm = buildFarmViewModel({
    farm: sampleState(),
    inventory: {},
    coins: 0,
    petLevel: 1,
  }, FARM_CONFIG, NOW)
  const html = renderFarmShell(vm)

  assert.match(html, /data-farm-tab="processing"/)
  assert.match(html, /data-farm-tab="orders"/)
  assert.doesNotMatch(html, /data-farm-tab="(?:processing|orders)"[^>]*disabled/)
  assert.match(html, /class="farm-tab-content"/)
  assert.match(html, /aria-label="农场摘要"/)
  assert.match(html, /data-action="harvest-all"/)
  assert.doesNotMatch(html, /data-action="harvest-all"[^>]*disabled/)
})

test('summary persists with identical values across every selected tab', () => {
  const vm = buildFarmViewModel({
    farm: sampleState(),
    inventory: {},
    coins: 7,
    petLevel: 1,
  }, FARM_CONFIG, NOW)
  const summaries = ['field', 'processing', 'orders'].map(activeTab => {
    const html = renderFarmShell(vm, { activeTab })
    return html.match(/<section class="farm-summary"[\s\S]*?<\/section>/)?.[0]
  })
  assert.equal(new Set(summaries).size, 1)
  assert.match(summaries[0], /Lv\.1/)
  assert.match(summaries[0], /可交付/)
})

test('field renderer emits sixteen keyboard-focusable tile buttons', () => {
  const vm = buildFarmViewModel({
    farm: createDefaultFarmState(NOW, () => 0.5),
    inventory: {},
    coins: 0,
    petLevel: 1,
  }, FARM_CONFIG, NOW)
  const html = renderFieldGrid(vm)

  assert.equal((html.match(/data-tile-id=/g) || []).length, 16)
  assert.equal((html.match(/<button/g) || []).length, 16)
  assert.match(html, /aria-label=".*锁定/)
})

test('only legal building move targets expose the move-target accessible name', () => {
  const vm = buildFarmViewModel({
    farm: createDefaultFarmState(NOW, () => 0.5),
    inventory: {},
    coins: 0,
    petLevel: 1,
  }, FARM_CONFIG, NOW)
  const html = renderFieldGrid(vm, { type: 'move-building', buildingId: 'building:1' })
  const targetButton = html.match(/<button[^>]*data-tile-id="r1c1"[\s\S]*?<\/button>/)?.[0] || ''
  const lockedButton = html.match(/<button[^>]*data-tile-id="r0c0"[\s\S]*?<\/button>/)?.[0] || ''

  assert.match(targetButton, /aria-label="[^"]*可作为建筑移动目标"/)
  assert.doesNotMatch(lockedButton, /可作为建筑移动目标/)
})

test('dynamic overlay text escaping covers confirmation content', () => {
  assert.equal(
    escapeHtml(`<作物 & "建筑" '测试'>`),
    '&lt;作物 &amp; &quot;建筑&quot; &#39;测试&#39;&gt;',
  )
})

function createHarness(farm = createDefaultFarmState(NOW, () => 0.5), { level = 12 } = {}) {
  const state = {
    farm,
    inventory: {},
    coins: 500,
    level,
  }
  let clickHandler = null
  let childClickHandler = null
  const childContainer = {
    innerHTML: '',
    addEventListener(type, handler) { if (type === 'click') childClickHandler = handler },
    removeEventListener(type, handler) {
      if (type === 'click' && childClickHandler === handler) childClickHandler = null
    },
  }
  const container = {
    className: '',
    innerHTML: '',
    addEventListener(type, handler) {
      if (type === 'click') clickHandler = handler
    },
    removeEventListener(type, handler) {
      if (type === 'click' && clickHandler === handler) clickHandler = null
    },
    querySelector(selector) {
      return selector === '.farm-tab-content' ? childContainer : null
    },
  }
  const calls = []
  const service = Object.fromEntries([
    'plant', 'harvest', 'harvestAll', 'removeCrop', 'unlockTile', 'upgradeLand',
    'build', 'moveBuilding', 'upgradeBuilding', 'demolishBuilding',
    'enqueue', 'cancelQueued', 'completeOrder', 'abandonOrder', 'settle',
  ].map(name => [name, async args => {
    calls.push([name, args])
    return name === 'demolishBuilding' ? { ok: true, refund: 30 } : { ok: true }
  }]))
  const petState = {
    get(key) { return structuredClone(state[key]) },
    subscribe() { return () => {} },
  }
  const eventBus = { on() { return () => {} } }
  const overlays = []
  const cleanup = mountFarm(container, {
    service,
    petState,
    eventBus,
    now: () => NOW,
    showOverlay: options => new Promise(resolve => overlays.push({ options, resolve })),
    closeOverlay: () => {},
  })
  const click = dataset => {
    const action = { dataset, disabled: false }
    clickHandler({
      target: {
        closest(selector) {
          if (selector === '[data-action]') return action
          return null
        },
      },
    })
  }
  const clickTile = tileId => {
    const tile = { dataset: { tileId } }
    clickHandler({
      target: {
        closest(selector) {
          if (selector === '[data-tile-id].farm-tile') return tile
          return null
        },
      },
    })
  }
  const clickTab = farmTab => {
    const tab = { dataset: { farmTab } }
    clickHandler({
      target: {
        closest(selector) {
          if (selector === '[data-farm-tab]') return tab
          return null
        },
      },
    })
  }
  const clickChild = dataset => {
    const action = { dataset, disabled: false }
    childClickHandler?.({
      target: { closest: selector => selector === '[data-action]' ? action : null },
    })
  }
  return {
    state, container, childContainer, calls, overlays, cleanup, click, clickTile, clickTab, clickChild,
  }
}

test('plant forwards quick-buy intent and harvest-all remains one service command', async () => {
  const harness = createHarness()
  harness.click({
    action: 'plant',
    tileId: 'r1c1',
    cropId: 'crop:wheat',
    quickBuy: 'true',
  })
  await new Promise(resolve => setImmediate(resolve))
  harness.click({ action: 'harvest-all' })
  await new Promise(resolve => setImmediate(resolve))

  assert.deepEqual(harness.calls, [
    ['plant', { tileId: 'r1c1', cropId: 'crop:wheat', quickBuy: true }],
    ['harvestAll', undefined],
  ])
  harness.cleanup()
})

test('remaining farm actions forward exact service parameters and rerender feedback', async () => {
  const harness = createHarness(sampleState())
  const actions = [
    [{ action: 'harvest', tileId: 'r1c1' }, ['harvest', { tileId: 'r1c1' }]],
    [{ action: 'unlock', tileId: 'r0c1' }, ['unlockTile', { tileId: 'r0c1' }]],
    [{ action: 'upgrade-land', tileId: 'r2c1' }, ['upgradeLand', { tileId: 'r2c1' }]],
    [{ action: 'build', tileId: 'r2c1', buildingType: 'building:sprinkler' },
      ['build', { tileId: 'r2c1', typeId: 'building:sprinkler' }]],
    [{ action: 'upgrade-building', buildingId: 'building:1' },
      ['upgradeBuilding', { buildingId: 'building:1' }]],
  ]

  for (const [dataset, expected] of actions) {
    harness.click(dataset)
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(harness.calls.at(-1), expected)
    assert.match(harness.container.innerHTML, /操作成功/)
  }
  harness.cleanup()
})

test('working building locks move and demolition controls', () => {
  const farm = sampleState()
  const tile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r2c2')
  tile.occupancy = 'building'
  tile.building = {
    id: 'building:1',
    typeId: 'building:sprinkler',
    level: 1,
    investedCoins: 60,
  }
  farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r1c1')
    .crop.snapshot.contributingBuildingIds = ['building:1']
  const harness = createHarness(farm)
  harness.clickTile('r2c2')

  assert.match(harness.container.innerHTML, /正在为生长作物提供效果/)
  assert.match(harness.container.innerHTML, /data-action="move-building"[^>]*disabled/)
  assert.match(harness.container.innerHTML, /data-action="demolish-building"[\s\S]*?disabled/)
  harness.cleanup()
})

test('building capacity limit is explicit and disables build choices', () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const buildingTile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r1c1')
  buildingTile.occupancy = 'building'
  buildingTile.building = {
    id: 'building:1',
    typeId: 'building:sprinkler',
    level: 1,
    investedCoins: 60,
  }
  const harness = createHarness(farm, { level: 1 })
  harness.clickTile('r1c2')

  assert.match(harness.container.innerHTML, /建筑容量已满/)
  assert.match(harness.container.innerHTML, /data-action="build"[\s\S]*?disabled/)
  harness.cleanup()
})

test('crop removal executes only after explicit confirmation', async () => {
  const harness = createHarness(sampleState())
  harness.click({ action: 'remove-crop', tileId: 'r1c1', cropName: '<小麦>' })
  assert.equal(harness.calls.length, 0)
  assert.match(harness.overlays[0].options.html, /当前作物及本轮种子投入不会返还/)
  assert.doesNotMatch(harness.overlays[0].options.html, /<小麦>/)

  harness.overlays[0].resolve('cancel')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.calls.length, 0)

  harness.click({ action: 'remove-crop', tileId: 'r1c1', cropName: '小麦' })
  harness.overlays[1].resolve('confirm')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(harness.calls.at(-1), ['removeCrop', { tileId: 'r1c1' }])
  harness.cleanup()
})

test('late confirmation after cleanup never executes a destructive command', async () => {
  const harness = createHarness(sampleState())
  harness.click({ action: 'remove-crop', tileId: 'r1c1', cropName: '小麦' })
  harness.cleanup()
  harness.overlays[0].resolve('confirm')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.calls.length, 0)
})

test('demolition confirmation displays derived refund and trusts service result', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const tile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r1c1')
  tile.occupancy = 'building'
  tile.building = { id: 'building:1', typeId: 'building:sprinkler', level: 1, investedCoins: 61 }
  const harness = createHarness(farm)

  harness.click({
    action: 'demolish-building',
    buildingId: 'building:1',
    buildingName: '洒水器',
    refund: '30',
  })
  assert.match(harness.overlays[0].options.html, /预计返还 30 金币（累计投入的 50%，向下取整）/)
  harness.overlays[0].resolve('confirm')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(harness.calls.at(-1), ['demolishBuilding', { buildingId: 'building:1' }])
  assert.match(harness.container.innerHTML, /已返还 30 金币/)
  harness.cleanup()
})

test('building move mode accepts only an empty open field target', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const tile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r1c1')
  tile.occupancy = 'building'
  tile.building = { id: 'building:1', typeId: 'building:sprinkler', level: 1, investedCoins: 60 }
  const harness = createHarness(farm)

  harness.click({ action: 'move-building', buildingId: 'building:1' })
  assert.match(harness.container.innerHTML, /farm-tile--move-target/)
  harness.clickTile('r0c0')
  assert.equal(harness.calls.length, 0)
  harness.clickTile('r1c2')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(harness.calls.at(-1), [
    'moveBuilding',
    { buildingId: 'building:1', targetTileId: 'r1c2' },
  ])
  harness.cleanup()
})

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function createGateHarness() {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const state = { farm, inventory: {}, coins: 0, level: 1 }
  const callbacks = []
  const settlements = []
  const mutations = []
  let settleCalls = 0
  let mutationCalls = 0
  let clickHandler = null
  let renderCount = 0
  const container = {
    className: '',
    get innerHTML() { return '' },
    set innerHTML(_value) { renderCount += 1 },
    addEventListener(type, handler) { if (type === 'click') clickHandler = handler },
    removeEventListener(type, handler) {
      if (type === 'click' && clickHandler === handler) clickHandler = null
    },
    querySelector() { return null },
  }
  const service = {
    settle() {
      settleCalls += 1
      const gate = deferred()
      settlements.push(gate)
      return gate.promise
    },
    harvestAll() {
      mutationCalls += 1
      const gate = deferred()
      mutations.push(gate)
      return gate.promise
    },
  }
  const cleanup = mountFarm(container, {
    service,
    petState: {
      get(key) { return structuredClone(state[key]) },
      subscribe() { return () => {} },
    },
    eventBus: { on() { return () => {} } },
    now: () => NOW,
    setIntervalFn(callback, delay) {
      callbacks.push({ callback, delay })
      return callbacks.length
    },
    clearIntervalFn() {},
    closeOverlay() {},
  })
  const lowFrequency = callbacks.find(entry => entry.delay === 30_000)
  const clickMutation = () => clickHandler({
    target: {
      closest(selector) {
        if (selector === '[data-action]') {
          return { dataset: { action: 'harvest-all' }, disabled: false }
        }
        return null
      },
    },
  })
  return {
    cleanup,
    lowFrequency,
    settlements,
    mutations,
    clickMutation,
    settleCalls: () => settleCalls,
    mutationCalls: () => mutationCalls,
    renderCount: () => renderCount,
  }
}

test('settlement requests during an active settlement coalesce into exactly one follow-up', async () => {
  const harness = createGateHarness()
  assert.ok(harness.lowFrequency)
  harness.lowFrequency.callback()
  harness.lowFrequency.callback()
  harness.lowFrequency.callback()
  assert.equal(harness.settleCalls(), 1)
  harness.settlements[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.settleCalls(), 2)
  harness.settlements[1].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.settleCalls(), 2)
  harness.cleanup()
})

test('mutation clicked during settlement waits, locks immediately and runs exactly once', async () => {
  const harness = createGateHarness()
  harness.lowFrequency.callback()
  harness.clickMutation()
  harness.clickMutation()
  assert.equal(harness.mutationCalls(), 0)
  harness.settlements[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.mutationCalls(), 1)
  harness.mutations[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.mutationCalls(), 1)
  harness.cleanup()
})

test('settlement requests during mutation coalesce into exactly one follow-up', async () => {
  const harness = createGateHarness()
  harness.clickMutation()
  assert.equal(harness.mutationCalls(), 1)
  harness.lowFrequency.callback()
  harness.lowFrequency.callback()
  assert.equal(harness.settleCalls(), 0)
  harness.mutations[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.settleCalls(), 1)
  harness.settlements[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.settleCalls(), 1)
  harness.cleanup()
})

test('cleanup cancels queued follow-ups and late settlement or mutation side effects', async () => {
  const settlementCase = createGateHarness()
  settlementCase.lowFrequency.callback()
  settlementCase.lowFrequency.callback()
  const settlementRenders = settlementCase.renderCount()
  settlementCase.cleanup()
  settlementCase.settlements[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settlementCase.settleCalls(), 1)
  assert.equal(settlementCase.renderCount(), settlementRenders)

  const waitingMutationCase = createGateHarness()
  waitingMutationCase.lowFrequency.callback()
  waitingMutationCase.clickMutation()
  const waitingRenders = waitingMutationCase.renderCount()
  waitingMutationCase.cleanup()
  waitingMutationCase.settlements[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(waitingMutationCase.mutationCalls(), 0)
  assert.equal(waitingMutationCase.renderCount(), waitingRenders)

  const mutationCase = createGateHarness()
  mutationCase.clickMutation()
  mutationCase.lowFrequency.callback()
  const mutationRenders = mutationCase.renderCount()
  mutationCase.cleanup()
  mutationCase.mutations[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(mutationCase.settleCalls(), 0)
  assert.equal(mutationCase.renderCount(), mutationRenders)
})

test('processing cancellation and order abandonment confirmations show escaped exact details', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  farm.processor.queue = [
    {
      id: 'processing-task:1', recipeId: 'recipe:cookie', status: 'running',
      inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 },
      completesAt: '2026-07-26T08:30:00.000Z',
    },
    {
      id: 'processing-task:2', recipeId: 'recipe:cookie', status: 'queued',
      inputs: { 'crop:wheat': 2, '<unsafe>': 1 }, outputs: { 'food:cookie': 3 },
      completesAt: null,
    },
  ]
  farm.orders.slots[0] = {
    order: {
      id: 'order:1',
      requirements: { 'crop:carrot': 2, '<unsafe>': 1 },
      rewards: { coins: 10, farmExp: 8, seedReward: null },
    },
    regenerateAt: null,
  }
  const harness = createHarness(farm)

  harness.clickTab('processing')
  harness.clickChild({ action: 'cancel-processing', taskId: 'processing-task:2' })
  assert.match(harness.overlays[0].options.html, /小麦 × 2/)
  assert.match(harness.overlays[0].options.html, /&lt;unsafe&gt; × 1/)
  assert.match(harness.overlays[0].options.html, /全部返还/)
  harness.overlays[0].resolve('cancel')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.calls.some(([name]) => name === 'cancelQueued'), false)

  harness.clickTab('orders')
  harness.clickChild({ action: 'abandon-order', slotIndex: '0' })
  assert.match(harness.overlays[1].options.html, /胡萝卜 × 2/)
  assert.match(harness.overlays[1].options.html, /&lt;unsafe&gt; × 1/)
  assert.match(harness.overlays[1].options.html, /30 分钟冷却，期间无订单/)
  harness.clickTab('field')
  harness.overlays[1].resolve('confirm')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.calls.some(([name]) => name === 'abandonOrder'), false)
  harness.cleanup()
})
