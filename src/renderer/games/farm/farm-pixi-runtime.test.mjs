import test from 'node:test'
import assert from 'node:assert/strict'

import { loadPixiRuntime } from './farm-pixi-runtime.js'

test('loadPixiRuntime resolves the packaged ESM distribution boundary', async () => {
  const PIXI = await loadPixiRuntime()

  for (const exportName of ['Application', 'Assets', 'Container', 'Sprite', 'Texture']) {
    assert.ok(PIXI[exportName], `${exportName} must be exported`)
  }
  assert.equal(typeof PIXI.Assets.load, 'function')
})
