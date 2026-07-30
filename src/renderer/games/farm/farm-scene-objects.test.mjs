import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createBirdObject,
  createBuildingObject,
  createCropObject,
  createLandObject,
  createPetObject,
} from './farm-scene-objects.js'

function fakePixi() {
  class DisplayObject {
    constructor(texture = null) {
      this.texture = texture
      this.children = []
      this.visible = true
      this.alpha = 1
      this.rotation = 0
      this.destroyCalls = 0
      this.anchor = { set: (x, y = x) => { this.anchorValue = { x, y } } }
      this.position = { set: (x, y) => { this.positionValue = { x, y } } }
    }
    addChild(child) {
      this.children.push(child)
      return child
    }
    removeChild(child) {
      this.children = this.children.filter(entry => entry !== child)
      return child
    }
    destroy(options) {
      this.destroyCalls += 1
      this.destroyOptions = options
      this.destroyed = true
      if (options?.children) {
        for (const child of this.children) child.destroy?.(options)
        this.children.length = 0
      }
    }
  }

  class Container extends DisplayObject {}
  class Sprite extends DisplayObject {}
  return { Container, Sprite }
}

function fakeTicker() {
  const callbacks = new Set()
  return {
    callbacks,
    add(callback) {
      callbacks.add(callback)
    },
    remove(callback) {
      callbacks.delete(callback)
    },
    tick(deltaMS = 16) {
      for (const callback of [...callbacks]) callback({ deltaMS })
    },
  }
}

function context(overrides = {}) {
  return {
    PIXI: fakePixi(),
    ticker: fakeTicker(),
    fallbackTexture: { id: 'fallback', destroyCalls: 0 },
    ...overrides,
  }
}

function record(overrides = {}) {
  return {
    texture: { id: 'primary', destroyCalls: 0 },
    anchor: { x: 0.5, y: 0.88 },
    x: 100,
    y: 200,
    visible: true,
    ...overrides,
  }
}

test('crop stage update swaps texture without recreating its container', () => {
  const ctx = context()
  const stage1 = { id: 'stage-1' }
  const stage2 = { id: 'stage-2' }
  const object = createCropObject({ ...ctx, record: record({ texture: stage1 }) })
  const displayObject = object.displayObject
  const sprite = displayObject.children[0]

  object.update(record({ texture: stage2, x: 120, y: 240 }))

  assert.equal(object.displayObject, displayObject)
  assert.equal(displayObject.children[0], sprite)
  assert.equal(sprite.texture, stage2)
  assert.deepEqual(displayObject.positionValue, { x: 120, y: 240 })
})

test('land and crop use the project fallback when their requested texture is absent', () => {
  const landContext = context()
  const land = createLandObject({ ...landContext, record: record({ texture: null }) })
  const crop = createCropObject({ ...landContext, record: record({ texture: undefined }) })

  assert.equal(land.displayObject.children[0].texture, landContext.fallbackTexture)
  assert.equal(crop.displayObject.children[0].texture, landContext.fallbackTexture)
})

test('building work overlay animation stays local to its own container', () => {
  const ctx = context()
  const base = { id: 'building' }
  const overlay = { id: 'overlay' }
  const other = createBuildingObject({
    ...ctx,
    record: record({ texture: base, overlayTexture: overlay, working: false }),
  })
  const working = createBuildingObject({
    ...ctx,
    record: record({ texture: base, overlayTexture: overlay, working: true }),
  })
  const otherOverlay = other.displayObject.children[1]
  const workingOverlay = working.displayObject.children[1]

  ctx.ticker.tick(100)

  assert.equal(otherOverlay.visible, false)
  assert.equal(otherOverlay.rotation, 0)
  assert.equal(workingOverlay.visible, true)
  assert.notEqual(workingOverlay.rotation, 0)
  assert.equal(other.displayObject.rotation, 0)
})

test('paused and reduced motion freeze continuous local animation', () => {
  const ctx = context()
  const object = createPetObject({
    ...ctx,
    record: record({ frames: [{ id: 'one' }, { id: 'two' }], frameDurationMs: 10 }),
  })
  const sprite = object.displayObject.children[0]

  ctx.ticker.tick(12)
  assert.equal(sprite.texture.id, 'two')
  object.setPaused(true)
  ctx.ticker.tick(12)
  assert.equal(sprite.texture.id, 'two')
  object.setPaused(false)
  object.setReducedMotion(true)
  ctx.ticker.tick(12)
  assert.equal(sprite.texture.id, 'two')
  object.setReducedMotion(false)
  ctx.ticker.tick(12)
  assert.equal(sprite.texture.id, 'one')
})

test('bird update reuses the container and supports visible state', () => {
  const ctx = context()
  const object = createBirdObject({
    ...ctx,
    record: record({ frames: [{ id: 'bird-1' }, { id: 'bird-2' }], visible: true }),
  })
  const displayObject = object.displayObject

  object.update(record({ frames: [{ id: 'bird-3' }], visible: false, x: 300, y: 160 }))

  assert.equal(object.displayObject, displayObject)
  assert.equal(displayObject.visible, false)
  assert.equal(displayObject.children[0].texture.id, 'bird-3')
  assert.deepEqual(displayObject.positionValue, { x: 300, y: 160 })
})

test('all five factories expose the same lifecycle contract', () => {
  const factories = [
    createLandObject,
    createCropObject,
    createBuildingObject,
    createPetObject,
    createBirdObject,
  ]
  for (const factory of factories) {
    const object = factory({ ...context(), record: record() })
    assert.ok(object.displayObject)
    for (const method of ['update', 'setPaused', 'setReducedMotion', 'destroy']) {
      assert.equal(typeof object[method], 'function')
    }
  }
})

test('destroy is idempotent, removes ticker work and never destroys shared textures', () => {
  const texture = { id: 'shared', destroyCalls: 0 }
  const fallbackTexture = { id: 'fallback', destroyCalls: 0 }
  const ctx = context({ fallbackTexture })
  const object = createBuildingObject({
    ...ctx,
    record: record({ texture, overlayTexture: texture, working: true }),
  })

  assert.equal(ctx.ticker.callbacks.size, 1)
  object.destroy()
  object.destroy()

  assert.equal(ctx.ticker.callbacks.size, 0)
  assert.equal(object.displayObject.destroyCalls, 1)
  assert.deepEqual(object.displayObject.destroyOptions, {
    children: true,
    texture: false,
    textureSource: false,
  })
  assert.equal(texture.destroyCalls, 0)
  assert.equal(fallbackTexture.destroyCalls, 0)
})
