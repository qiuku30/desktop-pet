import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { NAV_ITEMS } from './nav-config.js'
import { MODULES, loadRegisteredModule } from '../shared/module-registry.js'
import { createPageNavigationCoordinator } from './page-navigation.js'

test('farm navigation is ordered after Pomodoro and before 2048', () => {
  const ids = NAV_ITEMS.map(item => item.id)
  assert.ok(ids.indexOf('pomodoro') < ids.indexOf('farm'))
  assert.ok(ids.indexOf('farm') < ids.indexOf('game2048'))
})

test('registry loads farm only through its public module path', async () => {
  const farm = MODULES.find(module => module.id === 'farm')
  assert.deepEqual(farm, {
    id: 'farm',
    modulePath: '../games/farm/farm-module.js',
  })

  const loadedPaths = []
  const publicModule = { mount() {} }
  const loaded = await loadRegisteredModule('farm', async path => {
    loadedPaths.push(path)
    return publicModule
  })
  assert.equal(loaded, publicModule)
  assert.deepEqual(loadedPaths, ['../games/farm/farm-module.js'])
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createNavigationHarness(renderers) {
  const activations = []
  const errors = []
  const coordinator = createPageNavigationCoordinator({
    initialPageId: 'home',
    resolvePage: pageId => ({ id: pageId, render: renderers[pageId] }),
    onActivate: pageId => activations.push(pageId),
    onError: (pageId, error) => errors.push([pageId, error.message]),
  })
  return { coordinator, activations, errors }
}

test('late dynamic mount never activates and its cleanup runs exactly once', async () => {
  const late = deferred()
  let lateCleanupCalls = 0
  const harness = createNavigationHarness({
    farm: () => late.promise,
    warehouse: async () => ({ activate() {}, cleanup() {} }),
  })

  const farmNavigation = harness.coordinator.navigate('farm')
  await Promise.resolve()
  await Promise.resolve()
  await harness.coordinator.navigate('warehouse')
  late.resolve({
    activate() { harness.activations.push('late-farm-dom') },
    cleanup() { lateCleanupCalls += 1 },
  })
  await farmNavigation

  assert.deepEqual(harness.activations, ['warehouse'])
  assert.equal(lateCleanupCalls, 1)
  assert.equal(harness.coordinator.currentPageId, 'warehouse')
})

test('normal page cleanup runs exactly once when navigating away', async () => {
  let cleanupCalls = 0
  const harness = createNavigationHarness({
    farm: async () => ({ activate() {}, cleanup() { cleanupCalls += 1 } }),
    warehouse: async () => ({ activate() {}, cleanup() {} }),
  })

  await harness.coordinator.navigate('farm')
  await harness.coordinator.navigate('warehouse')

  assert.equal(cleanupCalls, 1)
  assert.deepEqual(harness.activations, ['farm', 'warehouse'])
})

test('failed page load can retry the same entry and succeed', async () => {
  let attempts = 0
  const harness = createNavigationHarness({
    farm: async () => {
      attempts += 1
      if (attempts === 1) throw new Error('temporary failure')
      return { activate() {}, cleanup() {} }
    },
  })

  assert.equal(await harness.coordinator.navigate('farm'), false)
  assert.equal(harness.coordinator.currentPageId, null)
  assert.equal(await harness.coordinator.navigate('farm'), true)
  assert.equal(attempts, 2)
  assert.equal(harness.coordinator.currentPageId, 'farm')
  assert.deepEqual(harness.errors, [['farm', 'temporary failure']])
})

test('after a failed target load, the old entry renders again instead of reporting a false success', async () => {
  let homeRenders = 0
  const harness = createNavigationHarness({
    home: async () => {
      homeRenders += 1
      return { activate() {}, cleanup() {} }
    },
    farm: async () => {
      throw new Error('farm unavailable')
    },
  })

  assert.equal(await harness.coordinator.navigate('farm'), false)
  assert.equal(harness.coordinator.currentPageId, null)
  assert.equal(await harness.coordinator.navigate('home'), true)
  assert.equal(homeRenders, 1)
  assert.equal(harness.coordinator.currentPageId, 'home')
})

test('activate failure cleans rendered resources exactly once and remains retryable', async () => {
  let attempts = 0
  let cleanupCalls = 0
  const harness = createNavigationHarness({
    farm: async () => {
      attempts += 1
      return {
        activate() {
          if (attempts === 1) throw new Error('activate failed')
        },
        cleanup() { cleanupCalls += 1 },
      }
    },
  })

  assert.equal(await harness.coordinator.navigate('farm'), false)
  assert.equal(cleanupCalls, 1)
  assert.equal(harness.coordinator.currentPageId, null)
  assert.equal(await harness.coordinator.navigate('farm'), true)
  assert.equal(attempts, 2)
  assert.equal(cleanupCalls, 1)
  assert.equal(harness.coordinator.currentPageId, 'farm')
  harness.coordinator.dispose()
  harness.coordinator.dispose()
  assert.equal(cleanupCalls, 2)
})

test('dispose invalidates a pending render and its late cleanup still runs at most once', async () => {
  const late = deferred()
  let cleanupCalls = 0
  const harness = createNavigationHarness({
    farm: () => late.promise,
  })

  const navigation = harness.coordinator.navigate('farm')
  await Promise.resolve()
  await Promise.resolve()
  harness.coordinator.dispose()
  harness.coordinator.dispose()
  late.resolve({
    activate() { harness.activations.push('disposed-farm-dom') },
    cleanup() { cleanupCalls += 1 },
  })

  assert.equal(await navigation, false)
  assert.equal(cleanupCalls, 1)
  assert.deepEqual(harness.activations, [])
  assert.equal(harness.coordinator.currentPageId, null)
})

test('dashboard source uses registry mount contract, monotonic token and late cleanup guard', async () => {
  const source = await readFile(new URL('./dashboard.js', import.meta.url), 'utf8')

  assert.match(source, /import\s+\{[^}]*loadRegisteredModule[^}]*\}\s+from\s+['"]\.\.\/shared\/module-registry\.js['"]/s)
  assert.match(source, /createPageNavigationCoordinator/)
  assert.match(source, /document\.createElement\(['"]div['"]\)/)
  assert.match(source, /replaceChildren\(staging\)/)
  assert.doesNotMatch(source, /from\s+['"]\.\.\/games\/farm\//)
})
