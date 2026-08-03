import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDashboardItemAriaLabel,
  buildDashboardItemIcon,
  handleDashboardItemIconError,
  installDashboardItemIconBoundary,
} from './dashboard-item-icons.mjs'

function createImage({ stage = 'primary', src = 'file:///skin/item.webp', connected = true } = {}) {
  return {
    dataset: { farmItemIcon: stage },
    hidden: false,
    src,
    connected,
    removedAttributes: [],
    matches(selector) {
      return selector === 'img[data-farm-item-icon]'
    },
    removeAttribute(name) {
      this.removedAttributes.push(name)
      if (name === 'src') this.src = ''
    },
  }
}

function createRoot() {
  const listeners = new Map()
  return {
    addCalls: [],
    removeCalls: [],
    contains(target) { return target?.connected === true },
    addEventListener(type, listener, capture) {
      this.addCalls.push({ type, listener, capture })
      listeners.set(type, listener)
    },
    removeEventListener(type, listener, capture) {
      this.removeCalls.push({ type, listener, capture })
      if (listeners.get(type) === listener) listeners.delete(type)
    },
    dispatchError(target) { listeners.get('error')?.({ target }) },
  }
}

test('builds escaped decorative image markup without item Emoji', () => {
  const html = buildDashboardItemIcon(
    { iconSrc: 'file:///skin/a.webp?x="<&', emoji: '🍎' },
    { className: 'wh-item-icon"<&', fallbackSrc: 'file:///skin/fallback.webp?x="<&' },
  )

  assert.match(html, /^<img /)
  assert.match(html, /class="wh-item-icon&quot;&lt;&amp;"/)
  assert.match(html, /data-farm-item-icon="primary"/)
  assert.match(html, /data-fallback-src="file:\/\/\/skin\/fallback\.webp\?x=&quot;&lt;&amp;"/)
  assert.match(html, /alt=""/)
  assert.match(html, /draggable="false"/)
  assert.doesNotMatch(html, /🍎/u)
  assert.doesNotMatch(html, /pointer-events/)
})

test('missing primary source starts at fallback and aria labels clamp invalid counts', () => {
  const html = buildDashboardItemIcon(
    { iconSrc: '', emoji: '🍎' },
    { className: 'inventory-item-icon', fallbackSrc: 'file:///skin/fallback.webp' },
  )
  assert.match(html, /data-farm-item-icon="fallback"/)
  assert.match(html, /src="file:\/\/\/skin\/fallback\.webp"/)
  assert.equal(buildDashboardItemAriaLabel({ name: '苹果"<&>' }, 3), '苹果&quot;&lt;&amp;&gt;，数量 3')
  assert.equal(buildDashboardItemAriaLabel({ name: '苹果' }, -1), '苹果，数量 0')
  assert.equal(buildDashboardItemAriaLabel({ name: '苹果' }, 1.5), '苹果，数量 0')
})

test('error handling advances once from primary to fallback and then hides', () => {
  const root = createRoot()
  const image = createImage()

  assert.equal(handleDashboardItemIconError(root, { target: image }, 'file:///skin/fallback.webp'), 'fallback')
  assert.equal(image.dataset.farmItemIcon, 'fallback')
  assert.equal(image.src, 'file:///skin/fallback.webp')
  assert.equal(image.hidden, false)

  assert.equal(handleDashboardItemIconError(root, { target: image }, 'file:///skin/fallback.webp'), 'hidden')
  assert.equal(image.dataset.farmItemIcon, 'hidden')
  assert.equal(image.hidden, true)
  assert.deepEqual(image.removedAttributes, ['src'])

  assert.equal(handleDashboardItemIconError(root, { target: image }, 'file:///skin/fallback.webp'), 'hidden')
  assert.deepEqual(image.removedAttributes, ['src'])
})

test('error handling ignores unrelated and detached targets', () => {
  const root = createRoot()
  const detached = createImage({ connected: false })
  const unrelated = createImage()
  unrelated.matches = () => false

  assert.equal(handleDashboardItemIconError(root, { target: detached }, 'file:///skin/fallback.webp'), 'ignored')
  assert.equal(handleDashboardItemIconError(root, { target: unrelated }, 'file:///skin/fallback.webp'), 'ignored')
  assert.equal(handleDashboardItemIconError(root, {}, 'file:///skin/fallback.webp'), 'ignored')
  assert.equal(detached.dataset.farmItemIcon, 'primary')
  assert.equal(unrelated.dataset.farmItemIcon, 'primary')
})

test('boundary installs once, disposes idempotently and can be reinstalled', () => {
  const root = createRoot()
  const first = installDashboardItemIconBoundary(root, 'file:///skin/fallback.webp')
  const duplicate = installDashboardItemIconBoundary(root, 'file:///skin/fallback.webp')
  assert.equal(duplicate, first)
  assert.equal(root.addCalls.length, 1)
  assert.deepEqual(root.addCalls.map(call => [call.type, call.capture]), [['error', true]])

  const image = createImage()
  root.dispatchError(image)
  assert.equal(image.dataset.farmItemIcon, 'fallback')

  first.dispose()
  first.dispose()
  assert.equal(root.removeCalls.length, 1)
  assert.deepEqual(root.removeCalls.map(call => [call.type, call.capture]), [['error', true]])

  const afterCleanup = createImage()
  root.dispatchError(afterCleanup)
  assert.equal(afterCleanup.dataset.farmItemIcon, 'primary')

  const second = installDashboardItemIconBoundary(root, 'file:///skin/fallback.webp')
  assert.notEqual(second, first)
  assert.equal(root.addCalls.length, 2)
  second.dispose()
})
