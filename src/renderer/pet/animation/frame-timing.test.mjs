import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  frameAtElapsed,
  canvasBackingSize,
  anchoredDrawRect,
} from './frame-timing.mjs'

describe('frameAtElapsed', () => {
  it('advances using elapsed time instead of callback count', () => {
    assert.deepEqual(frameAtElapsed(0, 10, 3, true), { index: 0, finished: false })
    assert.deepEqual(frameAtElapsed(99, 10, 3, true), { index: 0, finished: false })
    assert.deepEqual(frameAtElapsed(100, 10, 3, true), { index: 1, finished: false })
    assert.deepEqual(frameAtElapsed(300, 10, 3, true), { index: 0, finished: false })
  })

  it('clamps one-shot animation on the final frame and reports completion', () => {
    assert.deepEqual(frameAtElapsed(199, 10, 3, false), { index: 1, finished: false })
    assert.deepEqual(frameAtElapsed(300, 10, 3, false), { index: 2, finished: true })
  })

  it('returns a stable empty result for invalid inputs', () => {
    assert.deepEqual(frameAtElapsed(-1, 0, 0, false), { index: 0, finished: true })
  })
})

describe('canvasBackingSize', () => {
  it('converts CSS pixels to positive rounded backing pixels', () => {
    assert.deepEqual(canvasBackingSize(200, 150, 2), { width: 400, height: 300 })
    assert.deepEqual(canvasBackingSize(100.4, 50.4, 1.5), { width: 151, height: 76 })
    assert.deepEqual(canvasBackingSize(0, 0, 0), { width: 1, height: 1 })
  })
})

describe('anchoredDrawRect', () => {
  it('fits the source and aligns its anchor to the same viewport ratio', () => {
    const rect = anchoredDrawRect(
      { width: 512, height: 512 },
      { width: 200, height: 200 },
      0.8,
      { x: 0.5, y: 0.92 },
    )
    assert.equal(rect.x, 20)
    assert.ok(Math.abs(rect.y - 36.8) < 0.0001)
    assert.equal(rect.width, 160)
    assert.equal(rect.height, 160)
  })

  it('preserves source aspect ratio', () => {
    assert.deepEqual(
      anchoredDrawRect(
        { width: 400, height: 200 },
        { width: 200, height: 200 },
        1,
        { x: 0.5, y: 0.5 },
      ),
      { x: 0, y: 50, width: 200, height: 100 },
    )
  })
})
