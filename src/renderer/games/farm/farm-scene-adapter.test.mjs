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
    addChildAt(child, index) {
      this.children.splice(index, 0, child)
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
        callbacks: new Set(),
        add: callback => { this._ticker.callbacks.add(callback) },
        remove: callback => { this._ticker.callbacks.delete(callback) },
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
  class Graphics extends DisplayObject {
    ellipse(x, y, width, height) {
      this.ellipseValue = { x, y, width, height }
      return this
    }
    stroke(options) {
      this.strokeValue = options
      return this
    }
  }
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
      Graphics,
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

function layerByName(application, name) {
  return application.stage.children.find(child => child.label === name)
}

function tileCenter(row, col) {
  return {
    x: 600 + (col * 72) - (row * 72),
    y: 280 + (col * 44) + (row * 44),
  }
}

function manifest() {
  return {
    skinId: 'bright-homestead',
    logicalSize: { width: 1200, height: 720 },
    scene: {
      safeRect: { x: 300, y: 190, width: 600, height: 420 },
      tileGrid: {
        origin: { x: 600, y: 280 },
        columnStep: { x: 72, y: 44 },
        rowStep: { x: -72, y: 44 },
        hitSize: { width: 132, height: 82 },
      },
      processing: { x: 1010, y: 225 },
      orders: { x: 1060, y: 365 },
      pet: { x: 1010, y: 560 },
      bird: { x: 930, y: 160 },
    },
    background: { src: 'background/base.webp' },
    land: {
      locked: { src: 'land/locked.webp', anchor: { x: 0.5, y: 0.5 } },
      eligible: { src: 'land/eligible.webp', anchor: { x: 0.5, y: 0.5 } },
      level1: { src: 'land/land-1.webp', anchor: { x: 0.5, y: 0.5 } },
      level2: { src: 'land/land-2.webp', anchor: { x: 0.5, y: 0.5 } },
      level3: { src: 'land/land-3.webp', anchor: { x: 0.5, y: 0.5 } },
    },
    crops: {
      wheat: {
        stages: Array.from({ length: 4 }, (_, index) => ({
          src: `crops/wheat/stage-${index + 1}.webp`,
          anchor: { x: 0.5, y: 0.88 },
          logicalPosition: { x: 600, y: 430 },
        })),
      },
      carrot: {
        stages: Array.from({ length: 4 }, (_, index) => ({
          src: `crops/carrot/stage-${index + 1}.webp`,
          anchor: { x: 0.5, y: 0.88 },
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
      scarecrow: {
        levels: Array.from({ length: 3 }, (_, index) => ({
          src: `buildings/scarecrow/level-${index + 1}.webp`,
          anchor: { x: 0.5, y: 0.9 },
        })),
        workOverlay: {
          src: 'buildings/scarecrow/work-overlay.webp',
          anchor: { x: 0.5, y: 0.9 },
        },
      },
    },
    pet: {
      idle: {
        src: 'pet/idle.webp',
        anchor: { x: 0.5, y: 0.9 },
        logicalPosition: { x: 1010, y: 560 },
      },
      idleFrames: [
        { src: 'pet/idle-1.webp', anchor: { x: 0.5, y: 0.9 }, durationMs: 125 },
        { src: 'pet/idle-2.webp', anchor: { x: 0.5, y: 0.9 }, durationMs: 125 },
      ],
    },
    bird: {
      frames: [
        { src: 'bird/frame-1.webp', anchor: { x: 0.5, y: 0.88 }, durationMs: 500 },
        { src: 'bird/frame-2.webp', anchor: { x: 0.5, y: 0.88 }, durationMs: 500 },
      ],
    },
    effects: {
      plant: { src: 'effects/plant.webp' },
      harvest: { src: 'effects/harvest.webp' },
    },
    fallbacks: {
      object: { src: 'fallbacks/object.webp', anchor: { x: 0.5, y: 0.9 } },
    },
    ui: {
      recipeCookie: { src: 'ui/recipe-cookie.webp' },
      orderPaper: { src: 'ui/order-paper.webp' },
    },
  }
}

function sceneSnapshot(overrides = {}) {
  const tiles = []
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      tiles.push({
        tileId: `r${row}c${col}`,
        row,
        col,
        occupancy: 'empty',
        landLevel: 1,
        unlockState: 'unlocked',
        cropId: null,
        cropStage: null,
        mature: false,
        buildingId: null,
        buildingType: null,
        buildingLevel: null,
        buildingWorking: false,
      })
    }
  }
  return {
    tiles,
    pet: { visible: true, moodTier: null },
    bird: { birdId: null, visible: false, claimBusy: false },
    ...overrides,
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
  assert.equal(assetCalls.length, 3)
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
  const snapshot = sceneSnapshot({
    bird: { birdId: 'bird:1', visible: true, claimBusy: false },
  })
  const original = structuredClone(snapshot)
  await adapter.mount()
  await adapter.update(snapshot)

  const interaction = applications[0].stage.children.at(-1)
  for (const target of interaction.children) target.emit('pointertap')

  assert.deepEqual(intents, [
    ...snapshot.tiles.map(tile => ({ type: 'select-tile', tileId: tile.tileId })),
    { type: 'open-processing' },
    { type: 'open-orders' },
    { type: 'claim-bird', birdId: 'bird:1' },
    { type: 'click-pet' },
  ])
  assert.deepEqual(snapshot, original)
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

  await adapter.playEffect({ type: 'plant' })
  const first = effects.children[0]
  await adapter.playEffect({ type: 'harvest' })

  assert.equal(first.destroyed, true)
  assert.equal(effects.children.length, 1)
  adapter.destroy()
  assert.equal(effects.children.length, 0)
})

test('effect cleanup failures do not escape or block idempotent app teardown', async () => {
  for (const failure of ['remove', 'destroy']) {
    const { PIXI, applications } = fakePixi({ loadAsset: async src => ({ src }) })
    const container = createContainer()
    const adapter = createFarmSceneAdapter({
      PIXI, container, manifest: manifest(), onIntent() {}, now: () => 0,
    })
    await adapter.mount()
    await adapter.playEffect({ type: 'plant' })
    const effects = applications[0].stage.children.find(layer => layer.label === 'effects')
    if (failure === 'remove') {
      effects.removeChild = () => { throw new Error('effect remove failed') }
    } else {
      effects.children[0].destroy = () => { throw new Error('effect destroy failed') }
    }

    assert.doesNotThrow(() => adapter.destroy())
    assert.doesNotThrow(() => adapter.destroy())
    assert.equal(applications[0].destroyCalls, 1)
    assert.equal(applications[0]._renderer.destroyCalls, 1)
    assert.equal(container.children.length, 0)
  }
})

test('snapshot update creates full keyed objects and reuses containers across texture changes', async () => {
  const { PIXI, applications } = fakePixi({ loadAsset: async src => ({ src }) })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  const first = sceneSnapshot()
  first.tiles[0].cropId = 'wheat'
  first.tiles[0].cropStage = 1
  first.tiles[1].occupancy = 'building'
  first.tiles[1].buildingId = 'building:1'
  first.tiles[1].buildingType = 'scarecrow'
  first.tiles[1].buildingLevel = 1
  first.tiles[1].buildingWorking = true
  first.bird = { birdId: 'bird:1', visible: true, claimBusy: false }
  await adapter.update(first)

  const ground = applications[0].stage.children.find(layer => layer.label === 'ground')
  const objects = applications[0].stage.children.find(layer => layer.label === 'objects')
  const characters = applications[0].stage.children.find(layer => layer.label === 'characters')
  assert.equal(ground.children.length, 16)
  assert.equal(objects.children.length, 2)
  assert.equal(characters.children.length, 2)
  const cropContainer = objects.children.find(child => child.children[0].texture.src.includes('/wheat/'))
  const buildingContainer = objects.children.find(child => child.children.length === 2)

  const second = structuredClone(first)
  second.tiles[0].cropStage = 2
  second.tiles[1].buildingWorking = false
  await adapter.update(second)

  assert.equal(objects.children.includes(cropContainer), true)
  assert.equal(objects.children.includes(buildingContainer), true)
  assert.ok(cropContainer.children[0].texture.src.endsWith('/crops/wheat/stage-2.webp'))
  assert.equal(buildingContainer.children[1].visible, false)
})

test('disappeared snapshot objects are destroyed precisely', async () => {
  const { PIXI, applications } = fakePixi({ loadAsset: async src => ({ src }) })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  const first = sceneSnapshot()
  first.tiles[0].cropId = 'wheat'
  first.tiles[0].cropStage = 1
  await adapter.update(first)
  const objects = applications[0].stage.children.find(layer => layer.label === 'objects')
  const crop = objects.children[0]

  await adapter.update(sceneSnapshot())

  assert.equal(crop.destroyed, true)
  assert.equal(objects.children.includes(crop), false)
})

test('concurrent updates deduplicate the same in-flight texture source', async () => {
  const pending = deferred()
  let wheatLoads = 0
  let deferWheat = false
  const { PIXI } = fakePixi({
    loadAsset: src => {
      if (deferWheat && src.endsWith('/crops/wheat/stage-1.webp')) {
        wheatLoads += 1
        return pending.promise
      }
      return Promise.resolve({ src })
    },
  })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  deferWheat = true
  const source = sceneSnapshot()
  source.tiles[0].cropId = 'wheat'
  source.tiles[0].cropStage = 1
  const first = adapter.update(source)
  const second = adapter.update(structuredClone(source))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(wheatLoads, 1)
  pending.resolve({ src: 'stage-1' })
  await Promise.all([first, second])
})

test('a newer snapshot revision prevents stale async reconciliation', async () => {
  const slow = deferred()
  let deferWheat = false
  const { PIXI, applications } = fakePixi({
    loadAsset: src => (
      deferWheat && src.endsWith('/crops/wheat/stage-1.webp')
        ? slow.promise
        : Promise.resolve({ src })
    ),
  })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  deferWheat = true
  const stale = sceneSnapshot()
  stale.tiles[0].cropId = 'wheat'
  stale.tiles[0].cropStage = 1
  const staleUpdate = adapter.update(stale)
  const currentUpdate = adapter.update(sceneSnapshot())
  await currentUpdate
  slow.resolve({ src: 'late-wheat' })
  await staleUpdate

  const objects = applications[0].stage.children.find(layer => layer.label === 'objects')
  assert.equal(objects.children.length, 0)
})

test('single crop, building, pet and bird failures render the neutral project fallback', async () => {
  const { PIXI, applications } = fakePixi({
    loadAsset: async src => {
      if (
        src.includes('/crops/wheat/')
        || src.includes('/buildings/scarecrow/')
        || src.includes('/pet/idle-')
        || src.includes('/bird/frame-')
      ) {
        throw new Error('optional object missing')
      }
      return { src }
    },
  })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  const source = sceneSnapshot()
  source.tiles[0].cropId = 'wheat'
  source.tiles[0].cropStage = 1
  source.tiles[1].occupancy = 'building'
  source.tiles[1].buildingId = 'building:1'
  source.tiles[1].buildingType = 'scarecrow'
  source.tiles[1].buildingLevel = 1
  source.bird = { birdId: 'bird:1', visible: true, claimBusy: false }
  await adapter.update(source)

  const fallbackSrc = 'fallbacks/object.webp'
  const objects = applications[0].stage.children.find(layer => layer.label === 'objects')
  const characters = applications[0].stage.children.find(layer => layer.label === 'characters')
  for (const object of [...objects.children, ...characters.children]) {
    assert.ok(object.children[0].texture.src.includes(fallbackSrc))
  }
})

test('crop and building body fallback use the fallback asset anchor', async () => {
  const sourceManifest = manifest()
  sourceManifest.fallbacks.object.anchor = { x: 0.25, y: 0.75 }
  const { PIXI, applications } = fakePixi({
    loadAsset: async src => {
      if (
        src.endsWith('/crops/wheat/stage-1.webp')
        || src.endsWith('/buildings/scarecrow/level-1.webp')
      ) {
        throw new Error('object body missing')
      }
      return { src }
    },
  })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: sourceManifest, onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  const source = sceneSnapshot()
  source.tiles[0].cropId = 'wheat'
  source.tiles[0].cropStage = 1
  Object.assign(source.tiles[1], {
    occupancy: 'building',
    buildingId: 'building:1',
    buildingType: 'scarecrow',
    buildingLevel: 1,
  })
  await adapter.update(source)

  const objects = applications[0].stage.children.find(layer => layer.label === 'objects')
  assert.equal(objects.children.length, 2)
  for (const object of objects.children) {
    assert.ok(object.children[0].texture.src.endsWith('/fallbacks/object.webp'))
    assert.deepEqual(object.children[0].anchorValue, { x: 0.25, y: 0.75 })
  }
})

test('pet and bird use one static fallback when any animation frame fails', async () => {
  const { PIXI, applications } = fakePixi({
    loadAsset: async src => {
      if (src.endsWith('/pet/idle-2.webp') || src.endsWith('/bird/frame-2.webp')) {
        throw new Error('one animation frame missing')
      }
      return { src }
    },
  })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  const source = sceneSnapshot()
  source.bird = { birdId: 'bird:1', visible: true, claimBusy: false }
  await adapter.update(source)

  const characters = applications[0].stage.children.find(layer => layer.label === 'characters')
  assert.equal(characters.children.length, 2)
  for (const object of characters.children) {
    assert.ok(object.children[0].texture.src.endsWith('/fallbacks/object.webp'))
    assert.deepEqual(object.children[0].anchorValue, { x: 0.5, y: 0.9 })
  }
  applications[0]._ticker.callbacks.forEach(callback => callback({ deltaMS: 1000 }))
  for (const object of characters.children) {
    assert.ok(object.children[0].texture.src.endsWith('/fallbacks/object.webp'))
  }
})

test('work overlay failure omits the overlay while preserving the building body', async () => {
  const { PIXI, applications } = fakePixi({
    loadAsset: async src => {
      if (src.endsWith('/buildings/scarecrow/work-overlay.webp')) {
        throw new Error('overlay missing')
      }
      return { src }
    },
  })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  const source = sceneSnapshot()
  Object.assign(source.tiles[0], {
    occupancy: 'building',
    buildingId: 'building:1',
    buildingType: 'scarecrow',
    buildingLevel: 1,
    buildingWorking: true,
  })
  await adapter.update(source)

  const objects = applications[0].stage.children.find(layer => layer.label === 'objects')
  const building = objects.children[0]
  assert.ok(building.children[0].texture.src.endsWith('/buildings/scarecrow/level-1.webp'))
  assert.equal(building.children[1].visible, false)
  assert.equal(building.children[1].texture, null)
})

test('visible land texture failure rejects update, tears down the scene and is handled if ignored', async () => {
  const { PIXI, applications } = fakePixi({
    loadAsset: async src => {
      if (src.endsWith('/land/land-3.webp')) throw new Error('critical visible land')
      return { src }
    },
  })
  const container = createContainer()
  const adapter = createFarmSceneAdapter({
    PIXI, container, manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  const source = sceneSnapshot()
  source.tiles[0].landLevel = 3

  await assert.rejects(adapter.update(source), /critical visible land/)
  assert.equal(applications[0].destroyCalls, 1)
  assert.equal(container.children.length, 0)

  const ignored = fakePixi({
    loadAsset: async src => {
      if (src.endsWith('/land/land-3.webp')) throw new Error('ignored critical land')
      return { src }
    },
  })
  const ignoredAdapter = createFarmSceneAdapter({
    PIXI: ignored.PIXI,
    container: createContainer(),
    manifest: manifest(),
    onIntent() {},
    now: () => 0,
  })
  await ignoredAdapter.mount()
  ignoredAdapter.update(source)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(ignored.applications[0].destroyCalls, 1)
})

test('object cleanup failure never replaces a visible-land critical failure or blocks app teardown', async () => {
  const critical = new Error('critical land remains primary')
  let failLand = false
  const { PIXI, applications } = fakePixi({
    loadAsset: async src => {
      if (failLand && src.endsWith('/land/land-3.webp')) throw critical
      return { src }
    },
  })
  const container = createContainer()
  const adapter = createFarmSceneAdapter({
    PIXI, container, manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  await adapter.update(sceneSnapshot())
  const ground = applications[0].stage.children.find(layer => layer.label === 'ground')
  ground.children[0].destroy = () => {
    throw new Error('object cleanup failed')
  }
  const source = sceneSnapshot()
  source.tiles[0].landLevel = 3
  failLand = true

  await assert.rejects(adapter.update(source), error => error === critical)
  assert.equal(applications[0].destroyCalls, 1)
  assert.equal(applications[0]._renderer.destroyCalls, 1)
  assert.equal(container.children.length, 0)
})

test('eligible locked occupancy uses eligible land art and object children follow bottom sort order', async () => {
  const { PIXI, applications } = fakePixi({ loadAsset: async src => ({ src }) })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  const source = sceneSnapshot()
  source.tiles[0].occupancy = 'locked'
  source.tiles[0].unlockState = 'eligible'
  source.tiles[0].cropId = 'wheat'
  source.tiles[0].cropStage = 1
  source.tiles[15].occupancy = 'building'
  source.tiles[15].buildingId = 'building:15'
  source.tiles[15].buildingType = 'scarecrow'
  source.tiles[15].buildingLevel = 1
  await adapter.update(source)

  const ground = applications[0].stage.children.find(layer => layer.label === 'ground')
  const eligible = ground.children.find(child => child.positionValue.x === 600 && child.positionValue.y === 280)
  assert.ok(eligible.children[0].texture.src.endsWith('/land/eligible.webp'))

  const objects = applications[0].stage.children.find(layer => layer.label === 'objects')
  assert.deepEqual(
    objects.children.map(child => child.sortY),
    [...objects.children.map(child => child.sortY)].sort((left, right) => left - right),
  )
})

test('selection highlight is a reused non-interactive outline that follows the selected tile', async () => {
  const { PIXI, applications } = fakePixi({ loadAsset: async src => ({ src }) })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  await adapter.update({
    ...sceneSnapshot(),
    selectedObject: { type: 'tile', id: 'r1c2' },
  })

  const interaction = layerByName(applications[0], 'interaction')
  const highlight = interaction.children.find(child => child.label === 'farm-selection-highlight')
  assert.ok(highlight)
  assert.deepEqual(highlight.positionValue, tileCenter(1, 2))
  assert.equal(highlight.visible, true)
  assert.equal(highlight.eventMode, 'none')
  assert.ok(highlight.strokeValue)

  await adapter.update({
    ...sceneSnapshot(),
    selectedObject: { type: 'tile', id: 'r2c1' },
  })
  assert.equal(
    interaction.children.filter(child => child.label === 'farm-selection-highlight').length,
    1,
  )
  assert.deepEqual(highlight.positionValue, tileCenter(2, 1))

  await adapter.update({ ...sceneSnapshot(), selectedObject: null })
  assert.equal(highlight.visible, false)
  await adapter.update({
    ...sceneSnapshot(),
    selectedObject: { type: 'tile', id: 'missing' },
  })
  assert.equal(highlight.visible, false)

  adapter.destroy()
  assert.equal(highlight.destroyed, true)
})

test('positioned effect prefers a current tile center, then an explicit logical position', async () => {
  const { PIXI, applications } = fakePixi({ loadAsset: async src => ({ src }) })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  await adapter.update(sceneSnapshot())
  const effects = layerByName(applications[0], 'effects')

  await adapter.playEffect({ type: 'plant', tileId: 'r2c1' })
  assert.deepEqual(effects.children[0].positionValue, tileCenter(2, 1))
  const first = effects.children[0]

  await adapter.playEffect({
    type: 'harvest',
    logicalPosition: { x: 600, y: 430 },
  })
  assert.deepEqual(effects.children[0].positionValue, { x: 600, y: 430 })
  const current = effects.children[0]
  assert.notEqual(current, first)

  await adapter.playEffect({ type: 'harvest', tileId: 'missing' })
  assert.equal(effects.children.length, 1)
  assert.equal(effects.children[0], current)
})

test('positioned effect cannot appear after adapter destroy while its texture is loading', async () => {
  const pending = deferred()
  const { PIXI, applications } = fakePixi({
    loadAsset: src => src.endsWith('/effects/plant.webp')
      ? pending.promise
      : Promise.resolve({ src }),
  })
  const adapter = createFarmSceneAdapter({
    PIXI, container: createContainer(), manifest: manifest(), onIntent() {}, now: () => 0,
  })
  await adapter.mount()
  await adapter.update(sceneSnapshot())
  const effects = layerByName(applications[0], 'effects')
  const effectPromise = adapter.playEffect({ type: 'plant', tileId: 'r0c0' })
  adapter.destroy()
  pending.resolve({ src: 'late-effect' })
  await effectPromise
  assert.equal(effects.children.length, 0)
})
