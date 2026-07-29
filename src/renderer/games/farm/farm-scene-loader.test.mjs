import test from 'node:test'
import assert from 'node:assert/strict'

import { loadFarmScene } from './farm-scene-loader.js'

function manifest() {
  return {
    background: { src: 'background/base.webp' },
    land: { level1: { src: 'land/land-1.webp' } },
    crops: {
      wheat: {
        stages: Array.from({ length: 4 }, (_, index) => ({
          src: `crops/wheat/stage-${index + 1}.webp`,
        })),
      },
    },
    buildings: {
      sprinkler: {
        levels: Array.from({ length: 3 }, (_, index) => ({
          src: `buildings/sprinkler/level-${index + 1}.webp`,
        })),
      },
    },
    pet: { idle: { src: 'pet/idle.webp' } },
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

function defaults(overrides = {}) {
  return {
    manifestUrl: 'file:///skin/farm.json',
    importPixi: async () => ({ Application: class Application {} }),
    fetchJson: async () => manifest(),
    validateManifest: () => [],
    loadAssets: async () => ({}),
    createAdapter: ({ PIXI }) => ({
      PIXI,
      async mount() {},
      destroy() {},
    }),
    staticAvailable: true,
    trustedBackgroundSrc: 'file:///trusted/background/base.webp',
    ...overrides,
  }
}

test('successful load uses exactly nine critical and five optional assets', async () => {
  const calls = []
  const result = await loadFarmScene(defaults({
    loadAssets: async (src, metadata) => calls.push([src, metadata]),
  }))

  assert.equal(result.mode, 'pixi')
  assert.equal(calls.filter(([, metadata]) => metadata.critical).length, 9)
  assert.equal(calls.filter(([, metadata]) => !metadata.critical).length, 5)
  assert.deepEqual(result.optionalFailures, [])
  assert.equal(Object.isFrozen(result.optionalFailures), true)
})

test('default Assets loader resolves all manifest records against the manifest skin directory', async () => {
  const calls = []
  const PIXI = {
    Application: class Application {},
    Assets: { load: async src => calls.push(src) },
  }
  const result = await loadFarmScene(defaults({
    manifestUrl: 'file:///app/src/renderer/assets/farm/bright-homestead/farm.json',
    importPixi: async () => PIXI,
    loadAssets: undefined,
    createAdapter: undefined,
  }))

  assert.equal(result.mode, 'pixi')
  assert.equal(calls.length, 14)
  assert.equal(calls[0], 'file:///app/src/renderer/assets/farm/bright-homestead/background/base.webp')
  assert.equal(calls.at(-1), 'file:///app/src/renderer/assets/farm/bright-homestead/ui/order-paper.webp')
  assert.ok(calls.every(src => src.startsWith(
    'file:///app/src/renderer/assets/farm/bright-homestead/',
  )))
})

test('adapter must mount before pixi result and init failure follows static or DOM fallback with cleanup', async () => {
  const mounted = {
    mountCalls: 0,
    destroyCalls: 0,
    async mount() { this.mountCalls += 1 },
    destroy() { this.destroyCalls += 1 },
  }
  const success = await loadFarmScene(defaults({
    createAdapter: () => mounted,
  }))
  assert.equal(success.mode, 'pixi')
  assert.equal(success.adapter, mounted)
  assert.equal(mounted.mountCalls, 1)
  assert.equal(mounted.destroyCalls, 0)

  for (const staticAvailable of [true, false]) {
    const failed = {
      mountCalls: 0,
      destroyCalls: 0,
      async mount() {
        this.mountCalls += 1
        throw new Error('init failed')
      },
      destroy() { this.destroyCalls += 1 },
    }
    const result = await loadFarmScene(defaults({
      createAdapter: () => failed,
      staticAvailable,
    }))
    assert.equal(result.mode, staticAvailable ? 'static' : 'dom')
    assert.equal(failed.mountCalls, 1)
    assert.equal(failed.destroyCalls, 1)
    assert.match(result.error.message, /init failed/)
  }
})

test('adapter cleanup failure never replaces the primary failure or blocks fallback', async () => {
  for (const staticAvailable of [true, false]) {
    const primaryError = new Error('primary mount failure')
    const failed = {
      async mount() { throw primaryError },
      destroyCalls: 0,
      destroy() {
        this.destroyCalls += 1
        throw new Error('cleanup failure')
      },
    }
    const result = await loadFarmScene(defaults({
      createAdapter: () => failed,
      staticAvailable,
    }))

    assert.equal(result.mode, staticAvailable ? 'static' : 'dom')
    assert.equal(result.error, primaryError)
    assert.equal(failed.destroyCalls, 1)
  }
})

test('each critical texture failure prevents pixi and independently probes static mode', async () => {
  for (const failingIndex of Array.from({ length: 9 }, (_, index) => index)) {
    let criticalIndex = -1
    let staticProbeCalls = 0
    const result = await loadFarmScene(defaults({
      loadAssets: async (_src, { critical }) => {
        if (critical) criticalIndex += 1
        if (critical && criticalIndex === failingIndex) throw new Error(`critical-${failingIndex}`)
      },
      staticAvailable: async ({ backgroundSrc }) => {
        staticProbeCalls += 1
        assert.equal(backgroundSrc, 'file:///trusted/background/base.webp')
        return true
      },
    }))
    assert.equal(result.mode, 'static')
    assert.equal(staticProbeCalls, 1)
  }
})

test('optional failures stay in pixi and return stable readonly diagnostics', async () => {
  const result = await loadFarmScene(defaults({
    loadAssets: async (_src, { critical, key }) => {
      if (!critical && (key === 'pet.idle' || key === 'ui.orderPaper')) {
        throw new Error('optional missing')
      }
    },
  }))

  assert.equal(result.mode, 'pixi')
  assert.deepEqual(result.optionalFailures, ['pet.idle', 'ui.orderPaper'])
  assert.equal(Object.isFrozen(result.optionalFailures), true)
})

test('invalid manifest never supplies asset paths and uses independent static inputs', async () => {
  let loadCalls = 0
  const result = await loadFarmScene(defaults({
    fetchJson: async () => ({ background: { src: 'https://invalid.example/bad.webp' } }),
    validateManifest: () => ['INVALID_SCHEMA_VERSION'],
    loadAssets: async () => { loadCalls += 1 },
    staticAvailable: ({ backgroundSrc }) => (
      backgroundSrc === 'file:///trusted/background/base.webp'
    ),
  }))

  assert.equal(result.mode, 'static')
  assert.equal(loadCalls, 0)
  assert.equal(result.backgroundSrc, 'file:///trusted/background/base.webp')
})

test('manifest, Pixi, critical or static failure returns DOM mode without business imports', async () => {
  const cases = [
    { fetchJson: async () => { throw new Error('manifest fetch') }, staticAvailable: false },
    { importPixi: async () => { throw new Error('pixi import') }, staticAvailable: false },
    { loadAssets: async (_src, { critical }) => {
      if (critical) throw new Error('critical')
    }, staticAvailable: false },
    { validateManifest: () => ['INVALID'], staticAvailable: async () => { throw new Error('probe') } },
  ]
  for (const overrides of cases) {
    const result = await loadFarmScene(defaults(overrides))
    assert.equal(result.mode, 'dom')
    assert.ok(result.error instanceof Error)
    assert.equal(result.adapter, undefined)
  }
})
