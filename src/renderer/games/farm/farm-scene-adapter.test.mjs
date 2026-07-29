import test from 'node:test'
import assert from 'node:assert/strict'

import { createFarmSceneAdapter } from './farm-scene-adapter.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createContainer(width = 800, height = 600) {
  return {
    clientWidth: width,
    clientHeight: height,
    children: [],
    appendChild(child) {
      this.children.push(child)
      child.parentNode = this
    },
    removeChild(child) {
      this.children = this.children.filter(entry => entry !== child)
      child.parentNode = null
    },
  }
}

function fakePixi({
  initPromise = Promise.resolve(),
  loadPromise = Promise.resolve({}),
  loadAsset,
  rendererBeforeInitSettles = false,
  destroyError,
} = {}) {
  const applications = []
  const assetCalls = []

  class DisplayObject {
    constructor(texture = null) {
      this.texture = texture
      this.children = []
      this.listeners = new Map()
      this.anchor = { set: (x, y = x) => { this.anchorValue = { x, y } } }
      this.position = { set: (x, y) => { this.positionValue = { x, y } } }
      this.scale = { set: value => { this.scaleValue = value } }
    }
    addChild(child) {
      this.children.push(child)
      return child
    }
    removeChild(child) {
      this.children = this.children.filter(entry => entry !== child)
      return child
    }
    on(event, callback) {
      this.listeners.set(event, callback)
      return this
    }
    emit(event) {
      this.listeners.get(event)?.()
    }
    destroy() {
      this.destroyed = true
      this.listeners.clear()
      this.children.length = 0
    }
  }

  class Application {
    constructor() {
      this._canvas = { parentNode: null }
      this.initialized = false
      this.stage = new DisplayObject()
      this._ticker = {
        started: true,
        startCalls: 0,
        stopCalls: 0,
        start: () => { this._ticker.started = true; this._ticker.startCalls += 1 },
        stop: () => { this._ticker.started = false; this._ticker.stopCalls += 1 },
      }
      this._renderer = {
        canvas: this._canvas,
        destroyCalls: 0,
        resolution: 1,
        width: 0,
        height: 0,
        resizeCalls: [],
        resize: (width, height) => {
          this._renderer.width = width * this._renderer.resolution
          this._renderer.height = height * this._renderer.resolution
          this._renderer.resizeCalls.push([width, height, this._renderer.resolution])
        },
        destroy: () => { this._renderer.destroyCalls += 1 },
      }
      this.destroyCalls = 0
      applications.push(this)
    }
    get canvas() {
      if (!this.initialized) throw new Error('canvas before init')
      return this._canvas
    }
    get renderer() {
      return this.initialized || rendererBeforeInitSettles ? this._renderer : undefined
    }
    get ticker() {
      return this.initialized ? this._ticker : undefined
    }
    async init(options) {
      this.initOptions = options
      await initPromise
      this.initialized = true
      this._renderer.resolution = options.resolution
    }
    destroy() {
      this.destroyCalls += 1
      if (destroyError) throw destroyError
      if (!this.renderer) throw new Error('destroy before renderer')
      this.stage.destroy()
      this._renderer.destroy()
    }
  }

  class Container extends DisplayObject {}
  class Sprite extends DisplayObject {}
  class Rectangle {
    constructor(x, y, width, height) {
      Object.assign(this, { x, y, width, height })
    }
  }

  return {
    PIXI: {
      Application,
      Container,
      Rectangle,
      Sprite,
      Assets: {
        load: src => {
          assetCalls.push(src)
          return loadAsset ? loadAsset(src) : loadPromise
        },
      },
      Texture: class Texture {},
    },
    applications,
    assetCalls,
  }
}

function manifest() {
  return {
    skinId: 'bright-homestead',
    logicalSize: { width: 1200, height: 720 },
    background: { src: 'background/base.webp' },
    land: { level1: { src: 'land/land-1.webp', logicalPosition: { x: 600, y: 430 } } },
    crops: {
      wheat: {
        stages: Array.from({ length: 4 }, (_, index) => ({
          src: `crops/wheat/stage-${index + 1}.webp`,
          anchor: { x: 0.5, y: 0.88 },
          logicalPosition: { x: 600, y: 430 },
        })),
      },
    },
    buildings: {
      sprinkler: {
        levels: Array.from({ length: 3 }, (_, index) => ({
          src: `buildings/sprinkler/level-${index + 1}.webp`,
          anchor: { x: 0.5, y: 0.9 },
          logicalPosition: { x: 720, y: 430 },
        })),
      },
    },
    pet: {
      idle: {
        src: 'pet/idle.webp',
        anchor: { x: 0.5, y: 0.9 },
        logicalPosition: { x: 1010, y: 560 },
      },
    },
    effects: {
      plant: { src: 'effects/plant.webp' },
      harvest: { src: 'effects/harvest.webp' },
    },
    ui: {
      recipeCookie: { src: 'ui/recipe-cookie.webp' },
      orderPaper: { src: 'ui/order-paper.webp' },
    },
  }
}

test('mount is idempotent and creates the approved fixed layer stack', async () => {
  const { PIXI, applications, assetCalls } = fakePixi()
  const container = createContainer()
  const adapter = createFarmSceneAdapter({
    PIXI, container, manifest: manifest(), onIntent() {}, now: () => 0,
  })

  await Promise.all([adapter.mount(), adapter.mount()])

  assert.equal(applications.length, 1)
  assert.equal(container.children.length, 1)
  assert.deepEqual(
    applications[0].stage.children.map(layer => layer.label),
    ['background', 'ground', 'objects', 'characters', 'effects', 'interaction'],
  )
  assert.equal(assetCalls.length, 14)
  assert.ok(assetCalls.every(src => (
    src.startsWith('file:')
    && src.includes('/src/renderer/assets/farm/bright-homestead/')
    && !src.includes('/src/assets/')
  )))
})

test('destroy is idempotent and blocks late init, load, update, effect and intent', async () => {
  const init = deferred()
  const load = deferred()
  const { PIXI, applications } = fakePixi({ initPromise: init.promise, loadPromise: load.promise })
  const container = createContainer()
  const intents = []
  const adapter = createFarmSceneAdapter({
    PIXI, container, manifest: manifest(), onIntent: intent => intents.push(intent), now: () => 0,
  })

  const mounting = adapter.mount()
  adapter.destroy()
  adapter.destroy()
  init.resolve()
  load.resolve({})
  await mounting
  adapter.update({ tiles: [] })
  adapter.playEffect({ type: 'plant', tileId: 'r0c0' })

  assert.equal(container.children.length, 0)
  assert.equal(applications[0].destroyCalls, 1)
  assert.deepEqual(intents, [])
})

test('partial init failure cleans an assigned renderer without replacing the primary error', async () => {
  const init = deferred()
  const cleanupError = new Error('plugin cleanup failed')
  const { PIXI, applications } = fakePixi({
    initPromise: init.promise,
    rendererBeforeInitSettles: true,
    destroyError: cleanupError,
  })
  const container = createContainer()
  const adapter = createFarmSceneAdapter({
    PIXI, container, manifest: manifest(), onIntent() {}, now: () => 0,
  })

  const mounting = adapter.mount()
  await Promise.resolve()
  container.appendChild(applications[0]._canvas)
  const primaryError = new Error('plugin init failed')
  init.reject(primaryError)

  await assert.rejects(mounting, error => error === primaryError)
  assert.equal(applications[0].destroyCalls, 1)
  assert.equal(applications[0]._renderer.destroyCalls, 1)
  assert.equal(applications[0].stage.destroyed, true)
  assert.equal(container.children.length, 0)
  assert.doesNotThrow(() => adapter.destroy())
  assert.equal(applications[0].destroyCalls, 1)
})

test('destroy during texture load waits for late load and tears down exactly once', async () => {
  const load = deferred()
  const { PIXI, applications, assetCalls } = fakePixi({ loadPromise: load.promise })
  const container = createContainer()
  const adapter = createFarmSceneAdapter({
    PIXI, container, manifest: manifest(), onIntent() {}, now: () => 0,
  })

  const mounting = adapter.mount()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(assetCalls.length, 1)
  assert.doesNotThrow(() => adapter.destroy())
  load.resolve({})
  await assert.doesNotReject(mounting)

  assert.equal(applications[0].destroyCalls, 1)
  assert.equal(container.children.length, 0)
  assert.equal(applications[0].stage.children.length, 0)
})

test('pending init queues latest resize and motion state without touching renderer or ticker', async () => {
  const init = deferred()
  const { PIXI, applications } = fakePixi({ initPromise: init.promise })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })

  const mounting = adapter.mount()
  assert.doesNotThrow(() => {
    adapter.resize(640, 360, 3)
    adapter.resize(600, 400, 1.5)
    adapter.setPaused(true)
    adapter.setPaused(false)
    adapter.setReducedMotion(true)
  })
  init.resolve()
  await mounting

  assert.deepEqual(applications[0].renderer.resizeCalls, [[600, 400, 1.5]])
  assert.equal(applications[0].ticker.stopCalls, 1)
  assert.equal(applications[0].ticker.startCalls, 0)
})

test('live critical rejection tears down once while a destroyed late rejection resolves inert', async () => {
  const live = fakePixi({
    loadAsset: async src => {
      if (src.includes('/background/base.webp')) throw new Error('critical live')
      return { src }
    },
  })
  const liveContainer = createContainer()
  const liveAdapter = createFarmSceneAdapter({
    PIXI: live.PIXI,
    container: liveContainer,
    manifest: manifest(),
    onIntent() {},
    now: () => 0,
  })
  await assert.rejects(liveAdapter.mount(), /critical live/)
  assert.equal(live.applications[0].destroyCalls, 1)
  assert.equal(liveContainer.children.length, 0)
  assert.equal(live.applications[0].stage.children.length, 0)

  const late = deferred()
  const destroyed = fakePixi({ loadPromise: late.promise })
  const destroyedAdapter = createFarmSceneAdapter({
    PIXI: destroyed.PIXI,
    container: createContainer(),
    manifest: manifest(),
    onIntent() {},
    now: () => 0,
  })
  const mounting = destroyedAdapter.mount()
  await Promise.resolve()
  await Promise.resolve()
  destroyedAdapter.destroy()
  late.reject(new Error('critical late'))
  await assert.doesNotReject(mounting)
  assert.equal(destroyed.assetCalls.length, 1)
  assert.equal(destroyed.applications[0].destroyCalls, 1)
})

test('resize uses supplied container dimensions and clamps DPR to two', async () => {
  const { PIXI, applications } = fakePixi()
  const container = createContainer(600, 400)
  const adapter = createFarmSceneAdapter({
    PIXI, container, manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()

  adapter.resize(640, 360, 4)
  adapter.resize(undefined, undefined, 0.5)

  assert.deepEqual(applications[0].renderer.resizeCalls, [
    [600, 400, 1],
    [640, 360, 2],
    [600, 400, 0.5],
  ])
  assert.equal(applications[0].renderer.width, 300)
  assert.equal(applications[0].renderer.height, 200)
  assert.equal(applications[0].stage.scaleValue, 0.5)
  assert.deepEqual(applications[0].stage.positionValue, { x: 0, y: 20 })
})

test('paused and reduced motion stop non-essential ticker work', async () => {
  const { PIXI, applications } = fakePixi()
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()

  adapter.setPaused(true)
  adapter.setPaused(false)
  adapter.setReducedMotion(true)
  adapter.setReducedMotion(false)

  assert.equal(applications[0].ticker.stopCalls, 2)
  assert.equal(applications[0].ticker.startCalls, 3)
})

test('approved hit targets emit intents without mutating the snapshot', async () => {
  const { PIXI, applications } = fakePixi()
  const intents = []
  const adapter = createFarmSceneAdapter({
    PIXI,
    container: createContainer(),
    manifest: manifest(),
    onIntent: intent => intents.push(intent),
    now: () => 0,
  })
  const snapshot = Object.freeze({
    tiles: Object.freeze([{ tileId: 'r0c0' }]),
    bird: Object.freeze({ birdId: 'bird:1', visible: true }),
  })
  await adapter.mount()
  adapter.update(snapshot)

  const interaction = applications[0].stage.children.at(-1)
  for (const target of interaction.children) target.emit('pointertap')

  assert.deepEqual(intents, [
    { type: 'select-tile', tileId: 'r0c0' },
    { type: 'open-processing' },
    { type: 'open-orders' },
    { type: 'claim-bird', birdId: 'bird:1' },
    { type: 'click-pet' },
  ])
  assert.deepEqual(snapshot.tiles, [{ tileId: 'r0c0' }])
})

test('optional texture failures stay mounted while every critical failure rejects mount', async () => {
  const optionalFailure = fakePixi({
    loadAsset: async src => {
      if (src.includes('/pet/idle.webp')) throw new Error('optional missing')
      return { src }
    },
  })
  const optionalContainer = createContainer()
  const optionalAdapter = createFarmSceneAdapter({
    PIXI: optionalFailure.PIXI,
    container: optionalContainer,
    manifest: manifest(),
    onIntent() {},
    now: () => 0,
  })
  await optionalAdapter.mount()
  assert.equal(optionalContainer.children.length, 1)

  const criticalFailure = fakePixi({
    loadAsset: async src => {
      if (src.includes('/land/land-1.webp')) throw new Error('critical missing')
      return { src }
    },
  })
  const criticalAdapter = createFarmSceneAdapter({
    PIXI: criticalFailure.PIXI,
    container: createContainer(),
    manifest: manifest(),
    onIntent() {},
    now: () => 0,
  })
  await assert.rejects(criticalAdapter.mount(), /critical missing/)
})

test('skinId is one safe path segment and never permits an asset request outside farm root', async () => {
  const unsafeIds = [
    '', ' ', '.', '..', '../escape', 'a/b', 'a\\b', 'bad%2fskin',
    'bad?query', 'bad#fragment', 'bad\nskin',
  ]
  for (const skinId of unsafeIds) {
    const { PIXI, assetCalls } = fakePixi()
    const broken = manifest()
    broken.skinId = skinId
    const adapter = createFarmSceneAdapter({
      PIXI, container: createContainer(), manifest: broken, onIntent() {}, now: () => 0,
    })
    await assert.rejects(adapter.mount(), /INVALID_FARM_SKIN_ID/)
    assert.deepEqual(assetCalls, [])
  }
})

test('playEffect keeps one bounded effect sprite and destroys the replaced sprite', async () => {
  const { PIXI, applications } = fakePixi()
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  const effects = applications[0].stage.children.find(layer => layer.label === 'effects')

  adapter.playEffect({ type: 'plant' })
  const first = effects.children[0]
  adapter.playEffect({ type: 'harvest' })

  assert.equal(first.destroyed, true)
  assert.equal(effects.children.length, 1)
  adapter.destroy()
  assert.equal(effects.children.length, 0)
})
