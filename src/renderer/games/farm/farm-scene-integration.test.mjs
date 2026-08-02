import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { createFarmSceneRuntime } from './farm-module.js'

function baseFarmDependencies(farm) {
  return {
    service: { settle: async () => ({ ok: true }) },
    petState: {
      get(key) {
        const state = { farm, inventory: {}, coins: 100, level: 2 }
        return structuredClone(state[key])
      },
      subscribe: () => () => {},
    },
    eventBus: { on: () => () => {} },
    setIntervalFn: () => 1,
    clearIntervalFn() {},
    createBirdSchedulerFn: () => ({ start() {}, setVisible() {}, destroy() {} }),
    closeOverlay() {},
    now: () => '2026-07-30T00:00:00.000Z',
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function createSceneControllerHarness({ loader, farm: suppliedFarm, staticController = null, effectImpl = null, serviceResults = {} } = {}) {
  const { mountFarm } = await import('./farm-ui.js')
  const { createDefaultFarmState } = await import('./farm-state.mjs')
  const farm = suppliedFarm || createDefaultFarmState('2026-07-30T00:00:00.000Z', () => 0.5)
  const state = { farm, inventory: {}, coins: 500, level: 12 }
  const calls = []
  const effects = []
  const updates = []
  const pauses = []
  const motion = []
  const slots = []
  const observer = { observeCalls: [], unobserveCalls: [], disconnectCalls: 0,
    observe(value) { this.observeCalls.push(value) },
    unobserve(value) { this.unobserveCalls.push(value) },
    disconnect() { this.disconnectCalls += 1 },
  }
  const media = { matches: false, addCalls: 0, removeCalls: 0, handler: null,
    addEventListener(_type, handler) { this.addCalls += 1; this.handler = handler },
    removeEventListener(_type, handler) { this.removeCalls += 1; if (this.handler === handler) this.handler = null },
  }
  const host = { parentNode: null, classList: { add() {} }, remove() { this.parentNode = null } }
  let currentSlot = null
  let clickHandler = null
  let visibilityHandler = null
  let sceneIntent = null
  let schedulerOptions = null
  const child = { innerHTML: '', addEventListener() {}, removeEventListener() {} }
  const container = {
    className: '', html: '',
    set innerHTML(value) {
      this.html = value
      currentSlot = value.includes('farm-scene-slot') ? {
        id: slots.length + 1, parentNode: null,
        appendChild(node) { node.remove?.(); node.parentNode = this },
        getBoundingClientRect() { return { width: 700 + this.id, height: 400 + this.id } },
      } : null
      if (currentSlot) slots.push(currentSlot)
    },
    get innerHTML() { return this.html },
    querySelector(selector) {
      if (selector === '.farm-scene-slot') return currentSlot
      if (selector === '.farm-tab-content') return child
      return null
    },
    addEventListener(type, handler) { if (type === 'click') clickHandler = handler },
    removeEventListener(type, handler) { if (type === 'click' && clickHandler === handler) clickHandler = null },
  }
  const documentRef = {
    hidden: false,
    createElement: () => host,
    addEventListener(type, handler) { if (type === 'visibilitychange') visibilityHandler = handler },
    removeEventListener(type, handler) { if (type === 'visibilitychange' && visibilityHandler === handler) visibilityHandler = null },
  }
  const controller = {
    destroyCalls: 0,
    update(value) { updates.push(value) },
    resize() {},
    setPaused(value) { pauses.push(value) },
    setReducedMotion(value) { motion.push(value) },
    playEffect(value) { effects.push(value); return effectImpl ? effectImpl(value) : Promise.resolve() },
    destroy() { this.destroyCalls += 1 },
  }
  const service = Object.fromEntries([
    'plant', 'harvest', 'harvestAll', 'removeCrop', 'unlockTile', 'upgradeLand',
    'build', 'moveBuilding', 'upgradeBuilding', 'demolishBuilding', 'enqueue',
    'cancelQueued', 'completeOrder', 'abandonOrder', 'settle', 'claimBird',
  ].map(name => [name, async args => {
    calls.push([name, args])
    if (name in serviceResults) return typeof serviceResults[name] === 'function'
      ? serviceResults[name](args) : serviceResults[name]
    return name === 'claimBird' ? { ok: true, amount: 2 } : { ok: true }
  }]))
  const sceneRuntime = {
    manifestUrl: 'farm.json', trustedBackgroundSrc: 'base.webp',
    fetchJson: async () => ({}), staticAvailable: async () => true,
    reducedMotionMedia: media, getDevicePixelRatio: () => 2,
    createResizeObserver: () => observer,
    createAdapter(options) { sceneIntent = options.onIntent; return controller },
    createStatic() { if (staticController) return staticController; throw new Error('unexpected static controller') },
    loadScene: loader || (async options => ({ mode: 'pixi', adapter: options.createAdapter({ PIXI: {}, manifest: {} }) })),
  }
  const cleanup = mountFarm(container, {
    service, sceneRuntime, documentRef,
    petState: { get: key => structuredClone(state[key]), subscribe: () => () => {} },
    eventBus: { on: () => () => {} }, now: () => '2026-07-30T00:00:00.000Z',
    setIntervalFn: () => 1, clearIntervalFn() {}, closeOverlay() {},
    createBirdSchedulerFn(options) { schedulerOptions = options; return { start() {}, setVisible() {}, claimed() {}, destroy() {} } },
  })
  const flush = () => new Promise(resolve => setImmediate(resolve))
  await flush()
  const click = dataset => clickHandler?.({ target: { closest(selector) {
    if (selector === '[data-farm-tab]' && dataset.farmTab) return { dataset }
    if (selector === '[data-action]' && dataset.action) return { dataset, disabled: false }
    return null
  } } })
  return { container, state, calls, effects, updates, pauses, motion, slots, observer, media,
    host, controller, sceneRuntime, documentRef, cleanup, flush, click,
    intent(value) { sceneIntent?.(value) }, appear(value) { schedulerOptions?.onAppear(value) },
    visibility() { visibilityHandler?.() },
  }
}

test('production scene runtime assembles trusted URLs and side-effect-free dependencies', () => {
  const runtime = createFarmSceneRuntime({
    fetchFn: async () => ({ ok: true, json: async () => ({}) }),
    ImageClass: null,
    ResizeObserverClass: null,
    matchMediaFn: null,
  })

  assert.match(runtime.manifestUrl, /\/assets\/farm\/bright-homestead\/farm\.json$/)
  assert.match(
    runtime.trustedBackgroundSrc,
    /\/assets\/farm\/bright-homestead\/background\/base\.webp$/,
  )
  for (const field of [
    'loadScene',
    'createAdapter',
    'createStatic',
    'fetchJson',
    'staticAvailable',
    'getDevicePixelRatio',
    'createResizeObserver',
  ]) {
    assert.equal(typeof runtime[field], 'function', field)
  }
  assert.equal(runtime.reducedMotionMedia, null)
  assert.equal(runtime.createResizeObserver(() => {}), null)
  assert.ok(Object.isFrozen(runtime))
})

test('production scene runtime handles fetch and trusted static background boundaries', async () => {
  const images = []
  class ImageDouble {
    constructor() {
      images.push(this)
    }
    set src(value) {
      this.srcValue = value
    }
  }
  const fetchCalls = []
  const runtime = createFarmSceneRuntime({
    fetchFn: async url => {
      fetchCalls.push(url)
      if (url === 'bad') return { ok: false, status: 503 }
      if (url === 'file') return { ok: false, status: 0, json: async () => ({ file: true }) }
      return { ok: true, status: 200, json: async () => ({ http: true }) }
    },
    ImageClass: ImageDouble,
    ResizeObserverClass: null,
    matchMediaFn: null,
  })

  await assert.rejects(runtime.fetchJson('bad'), /FARM_SCENE_MANIFEST_HTTP_503/)
  assert.deepEqual(await runtime.fetchJson('file'), { file: true })
  assert.deepEqual(await runtime.fetchJson('good'), { http: true })
  assert.deepEqual(fetchCalls, ['bad', 'file', 'good'])

  assert.equal(await runtime.staticAvailable({ backgroundSrc: 'untrusted' }), false)
  const available = runtime.staticAvailable({ backgroundSrc: runtime.trustedBackgroundSrc })
  images.at(-1).onload()
  assert.equal(await available, true)
  const unavailable = runtime.staticAvailable({ backgroundSrc: runtime.trustedBackgroundSrc })
  images.at(-1).onerror()
  assert.equal(await unavailable, false)
})

test('production runtime shares one manifest request with immutable UI skin loading', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../assets/farm/bright-homestead/farm.json', import.meta.url), 'utf8'))
  let fetchCalls = 0
  const runtime = createFarmSceneRuntime({
    fetchFn: async () => {
      fetchCalls += 1
      return { ok: true, json: async () => manifest }
    },
    ImageClass: null,
    ResizeObserverClass: null,
    matchMediaFn: null,
  })
  const [loaded, skin, again] = await Promise.all([
    runtime.fetchJson(runtime.manifestUrl),
    runtime.loadUiSkin(),
    runtime.loadUiSkin(),
  ])
  assert.equal(loaded, manifest)
  assert.equal(fetchCalls, 1)
  assert.equal(skin, again)
  assert.equal(Object.isFrozen(skin.catalog), true)
  assert.match(skin.catalog.itemIcons['crop:wheat'].src, /crop-wheat\.webp$/)
})

test('repeated production runtime factories do not touch PetState or DOM', () => {
  const beforeDocument = globalThis.document
  const first = createFarmSceneRuntime({
    ImageClass: null,
    ResizeObserverClass: null,
    matchMediaFn: null,
  })
  const second = createFarmSceneRuntime({
    ImageClass: null,
    ResizeObserverClass: null,
    matchMediaFn: null,
  })
  assert.notEqual(first, second)
  assert.equal(globalThis.document, beforeDocument)
})

test('mountFarm creates one persistent scene host over rerenders', async () => {
  const { mountFarm } = await import('./farm-ui.js')
  const nodes = []
  const slot = {
    children: [],
    appendChild(node) {
      node.remove()
      this.children.push(node)
      node.parentNode = this
    },
  }
  const documentRef = {
    hidden: false,
    createElement() {
      const node = {
        className: '',
        classList: { add(value) { node.className = value } },
        parentNode: null,
        remove() {
          if (!this.parentNode) return
          this.parentNode.children = this.parentNode.children.filter(child => child !== this)
          this.parentNode = null
        },
      }
      nodes.push(node)
      return node
    },
    addEventListener() {},
    removeEventListener() {},
  }
  const listeners = new Map()
  const container = {
    className: '',
    set innerHTML(value) {
      this.html = value
      slot.children.length = 0
    },
    querySelector(selector) {
      if (selector === '.farm-scene-slot') return slot
      if (selector === '.farm-tab-content') return {}
      return null
    },
    addEventListener(type, listener) { listeners.set(type, listener) },
    removeEventListener(type) { listeners.delete(type) },
  }
  const state = {
    farm: (await import('./farm-state.mjs')).createDefaultFarmState(
      '2026-07-30T00:00:00.000Z',
      () => 0.5,
    ),
    inventory: {},
    coins: 100,
    level: 2,
  }
  const subscribers = []
  const sceneRuntime = {
    trustedBackgroundSrc: 'trusted.webp',
    reducedMotionMedia: null,
    createResizeObserver: () => null,
    getDevicePixelRatio: () => 1,
    loadScene: () => new Promise(() => {}),
  }
  const cleanup = mountFarm(container, {
    service: { settle: async () => ({ ok: true }) },
    petState: {
      get: key => structuredClone(state[key]),
      subscribe: (_event, callback) => {
        subscribers.push(callback)
        return () => {}
      },
    },
    eventBus: { on: () => () => {} },
    sceneRuntime,
    documentRef,
    setIntervalFn: () => 1,
    clearIntervalFn() {},
    createBirdSchedulerFn: () => ({
      start() {},
      setVisible() {},
      destroy() {},
    }),
    closeOverlay() {},
    now: () => '2026-07-30T00:00:00.000Z',
  })

  assert.match(container.html, /farm-scene--loading/)
  assert.match(container.html, /farm-grid--mirror/)
  assert.equal(nodes.length, 1)
  assert.equal(slot.children[0], nodes[0])
  subscribers[0]({ key: 'coins' })
  assert.equal(nodes.length, 1)
  assert.equal(slot.children[0], nodes[0])
  cleanup()
  assert.equal(nodes[0].parentNode, null)
})

test('mountFarm without sceneRuntime never appends null and keeps the DOM fallback compatible', async () => {
  const { mountFarm } = await import('./farm-ui.js')
  const { createDefaultFarmState } = await import('./farm-state.mjs')
  let cleanupCalls = 0
  const slot = {
    appendChild(node) {
      if (node === null) throw new TypeError('parameter 1 is not of type Node')
    },
  }
  const container = {
    className: '',
    innerHTML: '',
    addEventListener() {},
    removeEventListener() {},
    querySelector(selector) {
      if (selector === '.farm-scene-slot') return slot
      if (selector === '.farm-tab-content') return {}
      return null
    },
  }
  const documentRef = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  }

  const cleanup = mountFarm(container, {
    ...baseFarmDependencies(createDefaultFarmState('2026-07-30T00:00:00.000Z', () => 0.5)),
    sceneRuntime: null,
    documentRef,
    closeOverlay() { cleanupCalls += 1 },
  })
  assert.match(container.innerHTML, /farm-scene--dom/)
  assert.match(container.innerHTML, /data-tile-id="r1c1"/)
  cleanup()
  cleanup()
  assert.equal(cleanupCalls, 1)
})

test('one ResizeObserver follows the current live scene slot after controller rerenders', async () => {
  const { mountFarm } = await import('./farm-ui.js')
  const { createDefaultFarmState } = await import('./farm-state.mjs')
  const slots = []
  const observed = []
  const unobserved = []
  let disconnectCalls = 0
  let observerCallback = null
  let currentSlot = null
  let sceneIntent = null
  const childContainer = {
    innerHTML: '',
    addEventListener() {},
    removeEventListener() {},
  }
  const container = {
    className: '',
    set innerHTML(value) {
      this.html = value
      currentSlot = {
        id: slots.length + 1,
        isConnected: true,
        appendChild(node) { node.parentNode = this },
        getBoundingClientRect() { return { width: 640 + this.id, height: 360 + this.id } },
      }
      slots.push(currentSlot)
    },
    querySelector(selector) {
      if (selector === '.farm-scene-slot') return currentSlot
      if (selector === '.farm-tab-content') return childContainer
      return null
    },
    addEventListener() {},
    removeEventListener() {},
  }
  const host = {
    classList: { add() {} },
    parentNode: null,
    remove() { this.parentNode = null },
  }
  const documentRef = {
    hidden: false,
    createElement: () => host,
    addEventListener() {},
    removeEventListener() {},
  }
  const controller = {
    update() {},
    resizeCalls: [],
    resize(...args) { this.resizeCalls.push(args) },
    setPaused() {},
    setReducedMotion() {},
    destroy() {},
  }
  const observer = {
    observe(slot) { observed.push(slot) },
    unobserve(slot) { unobserved.push(slot) },
    disconnect() { disconnectCalls += 1 },
  }
  const sceneRuntime = {
    manifestUrl: 'farm.json',
    trustedBackgroundSrc: 'base.webp',
    fetchJson: async () => ({}),
    staticAvailable: async () => true,
    reducedMotionMedia: null,
    getDevicePixelRatio: () => 2,
    createResizeObserver(callback) { observerCallback = callback; return observer },
    createAdapter(options) { sceneIntent = options.onIntent; return controller },
    async loadScene(options) {
      return { mode: 'pixi', adapter: options.createAdapter({ PIXI: {}, manifest: {} }) }
    },
  }
  const cleanup = mountFarm(container, {
    ...baseFarmDependencies(createDefaultFarmState('2026-07-30T00:00:00.000Z', () => 0.5)),
    documentRef,
    sceneRuntime,
  })
  await new Promise(resolve => setImmediate(resolve))
  const initiallyObserved = observed.at(-1)
  sceneIntent({ type: 'select-tile', tileId: 'r1c1' })
  const liveSlot = currentSlot

  assert.notEqual(liveSlot, initiallyObserved)
  assert.equal(observed.at(-1), liveSlot)
  assert.ok(unobserved.includes(initiallyObserved))
  assert.deepEqual(controller.resizeCalls.at(-1), [liveSlot.getBoundingClientRect().width, liveSlot.getBoundingClientRect().height, 2])
  const beforeLateOld = controller.resizeCalls.length
  observerCallback([{ target: initiallyObserved, contentRect: { width: 1, height: 1 } }])
  assert.equal(controller.resizeCalls.length, beforeLateOld)
  observerCallback([
    { target: initiallyObserved, contentRect: { width: 2, height: 2 } },
    { target: liveSlot, contentRect: { width: 777, height: 444 } },
  ])
  assert.deepEqual(controller.resizeCalls.at(-1), [777, 444, 2])
  observerCallback([{ contentRect: { width: 888, height: 555 } }])
  assert.deepEqual(controller.resizeCalls.at(-1), [888, 555, 2])
  cleanup()
  cleanup()
  assert.equal(disconnectCalls, 1)
  const afterCleanup = controller.resizeCalls.length
  observerCallback([{ target: liveSlot, contentRect: { width: 3, height: 3 } }])
  assert.equal(controller.resizeCalls.length, afterCleanup)
})

test('delegated tile focus survives the render and restores focus to the replacement tile', async () => {
  const { mountFarm } = await import('./farm-ui.js')
  const { createDefaultFarmState } = await import('./farm-state.mjs')
  let focusInHandler = null
  let clickHandler = null
  let renderCount = 0
  let buttons = new Map()
  const documentRef = {
    hidden: false,
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
  }
  const makeButton = tileId => ({
    tileId,
    dataset: { tileId },
    isConnected: true,
    ariaPressed: tileId === 'r1c1' && renderCount > 1 ? 'true' : 'false',
    closest(selector) { return selector === '[data-tile-id].farm-tile' ? this : null },
    focus(options) {
      this.focusOptions = options
      documentRef.activeElement = this
      focusInHandler?.({ target: this })
    },
  })
  const childContainer = { innerHTML: '', addEventListener() {}, removeEventListener() {} }
  const slot = { appendChild() {} }
  const container = {
    className: '',
    set innerHTML(value) {
      this.html = value
      for (const button of buttons.values()) {
        button.isConnected = false
        if (documentRef.activeElement === button) documentRef.activeElement = null
      }
      renderCount += 1
      buttons = new Map(['r1c1', 'r1c2'].map(id => [id, makeButton(id)]))
    },
    querySelector(selector) {
      if (selector === '.farm-scene-slot') return slot
      if (selector === '.farm-tab-content') return childContainer
      const tileId = selector.match?.(/data-tile-id="([^"]+)"/)?.[1]
      return tileId ? buttons.get(tileId) || null : null
    },
    addEventListener(type, handler) {
      if (type === 'focusin') focusInHandler = handler
      if (type === 'click') clickHandler = handler
    },
    removeEventListener(type, handler) {
      if (type === 'focusin' && focusInHandler === handler) focusInHandler = null
      if (type === 'click' && clickHandler === handler) clickHandler = null
    },
  }
  const cleanup = mountFarm(container, {
    ...baseFarmDependencies(createDefaultFarmState('2026-07-30T00:00:00.000Z', () => 0.5)),
    sceneRuntime: null,
    documentRef,
  })
  const original = buttons.get('r1c1')
  original.focus()
  const replacement = buttons.get('r1c1')

  assert.equal(original.isConnected, false)
  assert.notEqual(replacement, original)
  assert.equal(documentRef.activeElement, replacement)
  assert.equal(replacement.focusOptions?.preventScroll, true)
  assert.equal(renderCount, 2)
  for (const activation of ['Enter', 'Space']) {
    clickHandler({ target: replacement })
    assert.equal(documentRef.activeElement, replacement, activation)
    assert.equal(renderCount, 2, `${activation} must not replace the selected tile`)
  }
  buttons.get('r1c2').focus()
  assert.equal(documentRef.activeElement?.dataset?.tileId, 'r1c2')
  cleanup()
})

test('controller activates pixi, static and DOM modes with exact static cleanup', async () => {
  const pixi = await createSceneControllerHarness()
  assert.match(pixi.container.innerHTML, /farm-scene--pixi/)
  assert.equal(pixi.controller.destroyCalls, 0)
  pixi.cleanup()
  pixi.cleanup()
  assert.equal(pixi.controller.destroyCalls, 1)

  const staticController = { mountCalls: 0, destroyCalls: 0,
    mount() { this.mountCalls += 1 }, destroy() { this.destroyCalls += 1 },
    update() {}, resize() {}, setPaused() {}, setReducedMotion() {},
  }
  const staticMode = await createSceneControllerHarness({
    staticController,
    loader: async () => ({ mode: 'static', backgroundSrc: 'base.webp' }),
  })
  assert.match(staticMode.container.innerHTML, /farm-scene--static/)
  assert.equal(staticController.mountCalls, 1)
  staticMode.cleanup()
  staticMode.cleanup()
  assert.equal(staticController.destroyCalls, 1)

  const dom = await createSceneControllerHarness({ loader: async () => ({ mode: 'dom', error: new Error('failed') }) })
  assert.match(dom.container.innerHTML, /farm-scene--dom/)
  assert.match(dom.container.innerHTML, /farm-grid--mirror/)
  dom.cleanup()
})

test('Canvas intents share tile, tab, bird and pet handlers with DOM including move-building', async () => {
  const harness = await createSceneControllerHarness()
  harness.intent({ type: 'select-tile', tileId: 'r1c1' })
  assert.match(harness.container.innerHTML, /farm-workspace--panel-open/)
  assert.match(harness.container.innerHTML, /aria-pressed="true"/)
  harness.intent({ type: 'open-processing' })
  assert.match(harness.container.innerHTML, /farm-tab farm-tab--active[\s\S]*data-farm-tab="processing"/)
  harness.click({ farmTab: 'orders' })
  assert.match(harness.container.innerHTML, /farm-tab farm-tab--active[\s\S]*data-farm-tab="orders"/)
  harness.click({ farmTab: 'field' })
  harness.intent({ type: 'click-pet' })
  assert.match(harness.container.innerHTML, /奶油星团/)
  harness.appear({ birdId: 'bird:integration' })
  harness.intent({ type: 'claim-bird', birdId: 'bird:integration' })
  await harness.flush()
  assert.deepEqual(harness.calls.find(([name]) => name === 'claimBird'), ['claimBird', { birdId: 'bird:integration' }])
  assert.deepEqual(harness.effects.at(-1), { type: 'coins', logicalPosition: { x: 930, y: 160 } })
  harness.cleanup()

  const { createDefaultFarmState } = await import('./farm-state.mjs')
  const farm = createDefaultFarmState('2026-07-30T00:00:00.000Z', () => 0.5)
  const occupied = farm.farms['basic-farm'].tiles.find(tile => tile.id === 'r1c1')
  occupied.occupancy = 'building'
  occupied.building = { id: 'building:1', typeId: 'building:sprinkler', level: 1, investedCoins: 60 }
  const moving = await createSceneControllerHarness({ farm })
  moving.click({ action: 'move-building', buildingId: 'building:1' })
  moving.intent({ type: 'select-tile', tileId: 'r1c2' })
  await moving.flush()
  assert.deepEqual(moving.calls.find(([name]) => name === 'moveBuilding'), [
    'moveBuilding', { buildingId: 'building:1', targetTileId: 'r1c2' },
  ])
  assert.deepEqual(moving.effects.at(-1), { type: 'building-change', tileId: 'r1c2' })
  moving.cleanup()
})

test('post-commit effects cover field mappings, failures, rejection and cleanup-late success', async () => {
  const rejectedEffects = []
  const harness = await createSceneControllerHarness({
    effectImpl(effect) { if (effect.type === 'upgrade-land') { rejectedEffects.push(effect); return Promise.reject(new Error('visual only')) } return Promise.resolve() },
  })
  harness.click({ action: 'plant', tileId: 'r1c1', cropId: 'crop:wheat' })
  await harness.flush()
  harness.click({ action: 'harvest', tileId: 'r1c1' })
  await harness.flush()
  harness.click({ action: 'harvest-all' })
  await harness.flush()
  harness.click({ action: 'unlock', tileId: 'r2c1' })
  await harness.flush()
  harness.click({ action: 'upgrade-land', tileId: 'r1c1' })
  await harness.flush()
  assert.deepEqual(harness.effects.map(effect => effect.type), [
    'plant', 'harvest', 'harvest', 'unlock-land', 'upgrade-land',
  ])
  assert.equal(harness.effects[2].logicalPosition.x, 600)
  assert.equal(rejectedEffects.length, 1)
  harness.cleanup()

  const failed = await createSceneControllerHarness({ serviceResults: { harvest: { ok: false, error: 'CROP_NOT_MATURE' } } })
  failed.click({ action: 'harvest', tileId: 'r1c1' })
  await failed.flush()
  assert.deepEqual(failed.effects, [])
  failed.cleanup()

  const pending = deferred()
  const late = await createSceneControllerHarness({ serviceResults: { upgradeLand: () => pending.promise } })
  late.click({ action: 'upgrade-land', tileId: 'r1c1' })
  late.cleanup()
  pending.resolve({ ok: true })
  await late.flush()
  assert.deepEqual(late.effects, [])
})

test('visibility, reduced motion and 20 tab cycles retain one controller and clean every binding once', async () => {
  const harness = await createSceneControllerHarness()
  assert.equal(harness.media.addCalls, 1)
  harness.documentRef.hidden = true
  harness.visibility()
  assert.equal(harness.pauses.at(-1), true)
  harness.media.matches = true
  harness.media.handler?.({ matches: true })
  assert.equal(harness.motion.at(-1), true)

  for (let index = 0; index < 20; index += 1) {
    harness.intent({ type: 'open-processing' })
    harness.intent({ type: 'open-orders' })
    harness.click({ farmTab: 'field' })
  }
  assert.equal(harness.host.className, undefined)
  assert.equal(harness.controller.destroyCalls, 0)
  assert.equal(harness.observer.observeCalls.at(-1), harness.slots.at(-1))
  assert.ok(harness.observer.unobserveCalls.length >= 20)
  harness.cleanup()
  harness.cleanup()
  assert.equal(harness.controller.destroyCalls, 1)
  assert.equal(harness.observer.disconnectCalls, 1)
  assert.equal(harness.media.removeCalls, 1)
  assert.equal(harness.media.handler, null)
  assert.equal(harness.host.parentNode, null)
})

test('late loader resolve and reject after cleanup cannot mount or mutate the controller', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const gate = deferred()
    const harness = await createSceneControllerHarness({ loader: () => gate.promise })
    const html = harness.container.innerHTML
    harness.cleanup()
    if (outcome === 'resolve') gate.resolve({ mode: 'pixi', adapter: harness.controller })
    else gate.reject(new Error('late loader failure'))
    await harness.flush()
    assert.equal(harness.container.innerHTML, html)
    assert.equal(harness.controller.destroyCalls, outcome === 'resolve' ? 1 : 0)
    assert.equal(harness.observer.disconnectCalls, 0)
  }
})

test('scene-first CSS defines wide panel, narrow drawer and accessible fallback modes', async () => {
  const css = await readFile(new URL('./farm.css', import.meta.url), 'utf8')
  assert.match(css, /\.farm-workspace--panel-open\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(190px,\s*28%\)/s)
  assert.match(css, /\.farm-scene--loading\s+\.farm-grid--mirror[\s\S]*clip-path:\s*inset\(50%\)/)
  assert.match(css, /\.farm-scene--static\s+\.farm-grid--mirror[\s\S]*clip-path:\s*none/)
  assert.match(css, /@media[\s\S]*\.farm-workspace--panel-open\s+\.farm-actions\s*\{[^}]*position:\s*absolute/s)
})

test('farm controller owns guarded UI skin, bounded feedback and motion propagation contracts', async () => {
  const source = await readFile(new URL('./farm-ui.js', import.meta.url), 'utf8')
  assert.match(source, /sceneRuntime\?\.loadUiSkin\?\.\(\)/)
  assert.match(source, /pendingUiFeedback/)
  assert.match(source, /consumeUiFeedback/)
  assert.match(source, /FARM_PROCESSING_COMPLETED/)
  assert.match(source, /FARM_ORDER_COMPLETED/)
  assert.match(source, /uiEffectType/)
  assert.doesNotMatch(source, /completeOrder\(\{ slotIndex \}\)\), null, 'order-complete'/)
  assert.match(source, /\.farm-workshop-view, \.farm-orders-board/)
})
