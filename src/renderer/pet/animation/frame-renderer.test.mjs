import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FrameRenderer } from './frame-renderer.mjs'

function harness() {
  let time = 0
  let nextId = 1
  const queue = new Map()
  const calls = []
  const context = {
    setTransform: (...args) => calls.push(['setTransform', ...args]),
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    translate: (...args) => calls.push(['translate', ...args]),
    scale: (...args) => calls.push(['scale', ...args]),
    drawImage: (...args) => calls.push(['drawImage', ...args]),
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  }
  const requestFrame = (callback) => {
    const id = nextId++
    queue.set(id, callback)
    return id
  }
  const cancelFrame = (id) => queue.delete(id)
  const advance = (ms) => {
    time += ms
    const pending = [...queue.values()]
    queue.clear()
    pending.forEach((callback) => callback(time))
  }
  const loadImage = async (url) => ({ src: url, width: 512, height: 512 })

  return {
    canvas,
    calls,
    requestFrame,
    cancelFrame,
    advance,
    now: () => time,
    loadImage,
    queued: () => queue.size,
  }
}

describe('FrameRenderer', () => {
  it('preloads resolved frame URLs and exposes availability', async () => {
    const h = harness()
    const renderer = new FrameRenderer(h)
    await renderer.preload('idle', {
      fps: 8,
      loop: true,
      frames: ['idle/001.webp', 'idle/002.webp'],
    }, 'file:///skin/')

    assert.equal(renderer.hasAnimation('idle'), true)
    assert.equal(renderer.hasAnimation('walk'), false)
  })

  it('configures high-DPI backing size and draws in CSS pixels', async () => {
    const h = harness()
    const renderer = new FrameRenderer(h)
    renderer.resize(200, 150, 2)
    assert.equal(h.canvas.width, 400)
    assert.equal(h.canvas.height, 300)
    assert.deepEqual(h.calls[0], ['setTransform', 2, 0, 0, 2, 0, 0])
  })

  it('draws immediately, advances by elapsed time, and completes one-shot once', async () => {
    const h = harness()
    const renderer = new FrameRenderer(h)
    renderer.resize(200, 200, 1)
    await renderer.preload('eat', {
      fps: 10,
      loop: false,
      frames: ['eat/001.webp', 'eat/002.webp'],
    }, 'file:///skin/')

    let completed = 0
    assert.equal(renderer.play('eat', { onComplete: () => completed++ }), true)
    assert.equal(h.calls.filter(([name]) => name === 'drawImage').length, 1)
    h.advance(100)
    h.advance(100)
    assert.equal(completed, 1)
    assert.equal(h.queued(), 0)
  })

  it('does not schedule RAF for a one-frame loop and mirrors left-facing draw', async () => {
    const h = harness()
    const renderer = new FrameRenderer(h)
    renderer.resize(200, 200, 1)
    renderer.setLayout({ scale: 0.8, anchor: { x: 0.5, y: 0.92 }, flipX: true })
    renderer.setFacing('left')
    await renderer.preload('idle', {
      fps: 8,
      loop: true,
      frames: ['idle/001.webp'],
    }, 'file:///skin/')

    renderer.play('idle')
    assert.equal(h.queued(), 0)
    assert.equal(h.calls.some((call) => call[0] === 'scale' && call[1] === -1), true)
  })

  it('cancels old playback and becomes inert after destroy', async () => {
    const h = harness()
    const renderer = new FrameRenderer(h)
    await renderer.preload('idle', {
      fps: 8,
      loop: true,
      frames: ['idle/001.webp', 'idle/002.webp'],
    }, 'file:///skin/')

    renderer.play('idle')
    assert.equal(h.queued(), 1)
    renderer.destroy()
    assert.equal(h.queued(), 0)
    assert.equal(renderer.play('idle'), false)
  })
})
