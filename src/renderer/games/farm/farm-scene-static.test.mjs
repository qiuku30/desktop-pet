import test from 'node:test'
import assert from 'node:assert/strict'

import { createFarmSceneStatic } from './farm-scene-static.js'

function element(tagName) {
  return {
    tagName,
    children: [],
    dataset: {},
    listeners: new Map(),
    appendChild(child) { this.children.push(child); child.parentNode = this },
    remove() {
      if (this.parentNode) {
        this.parentNode.children = this.parentNode.children.filter(child => child !== this)
      }
      this.parentNode = null
    },
    addEventListener(type, callback) { this.listeners.set(type, callback) },
    removeEventListener(type) { this.listeners.delete(type) },
    click() { this.listeners.get('click')?.() },
  }
}

function container() {
  const root = element('div')
  root.ownerDocument = { createElement: element }
  return root
}

test('static renderer uses only the explicit trusted background and hit targets', () => {
  const host = container()
  const intents = []
  const renderer = createFarmSceneStatic({
    container: host,
    backgroundSrc: 'file:///trusted/background/base.webp',
    hitTargets: [
      { intent: { type: 'select-tile', tileId: 'r0c0' }, label: '田地 r0c0' },
      { intent: { type: 'open-processing' }, label: '加工' },
    ],
    onIntent: intent => intents.push(intent),
  })

  renderer.mount()
  const [scene] = host.children
  assert.equal(scene.children[0].src, 'file:///trusted/background/base.webp')
  scene.children[1].click()
  scene.children[2].click()

  assert.deepEqual(intents, [
    { type: 'select-tile', tileId: 'r0c0' },
    { type: 'open-processing' },
  ])
})

test('static renderer rejects unapproved intents and never mutates snapshot data', () => {
  const host = container()
  const snapshot = Object.freeze({ tiles: Object.freeze([{ tileId: 'r0c0' }]) })
  const intents = []
  const renderer = createFarmSceneStatic({
    container: host,
    backgroundSrc: 'file:///trusted/background/base.webp',
    snapshot,
    hitTargets: [
      { intent: { type: 'write-state', key: 'coins' }, label: 'bad' },
      { intent: { type: 'click-pet' }, label: 'pet' },
    ],
    onIntent: intent => intents.push(intent),
  })

  renderer.mount()
  for (const target of host.children[0].children.slice(1)) target.click()

  assert.deepEqual(intents, [{ type: 'click-pet' }])
  assert.deepEqual(snapshot.tiles, [{ tileId: 'r0c0' }])
})

test('destroy is idempotent and blocks late intents or remount', () => {
  const host = container()
  const intents = []
  const renderer = createFarmSceneStatic({
    container: host,
    backgroundSrc: 'file:///trusted/background/base.webp',
    hitTargets: [{ intent: { type: 'open-orders' }, label: 'orders' }],
    onIntent: intent => intents.push(intent),
  })

  renderer.mount()
  const button = host.children[0].children[1]
  renderer.destroy()
  renderer.destroy()
  button.click()
  renderer.mount()

  assert.equal(host.children.length, 0)
  assert.deepEqual(intents, [])
})
