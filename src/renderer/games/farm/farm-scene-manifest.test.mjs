import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { validateFarmSceneManifest } from './farm-scene-manifest.mjs'

const manifestUrl = new URL('../../assets/farm/bright-homestead/farm.json', import.meta.url)
const validManifest = JSON.parse(await readFile(manifestUrl, 'utf8'))

test('approved vertical-slice manifest satisfies the schema-v1 minimum renderable baseline', () => {
  assert.deepEqual(validateFarmSceneManifest(validManifest), [])
})

test('validator returns stable top-level content errors without throwing', () => {
  assert.deepEqual(validateFarmSceneManifest(null), [
    'INVALID_SCHEMA_VERSION',
    'INVALID_SKIN_ID',
    'INVALID_LOGICAL_SIZE',
    'MISSING_REQUIRED_RECORD:background',
    'MISSING_REQUIRED_RECORD:land.level1',
    'INVALID_STAGE_COUNT:crops.wheat',
    'INVALID_LEVEL_COUNT:buildings.sprinkler',
    'MISSING_REQUIRED_RECORD:pet.idle',
    'MISSING_REQUIRED_RECORD:effects.plant',
    'MISSING_REQUIRED_RECORD:effects.harvest',
    'MISSING_REQUIRED_RECORD:ui.recipeCookie',
    'MISSING_REQUIRED_RECORD:ui.orderPaper',
  ])
})

test('validator rejects unsupported schema identity and non-positive logical size', () => {
  const broken = structuredClone(validManifest)
  broken.schemaVersion = 2
  broken.skinId = ''
  broken.logicalSize = { width: 1200, height: 0 }

  assert.deepEqual(validateFarmSceneManifest(broken), [
    'INVALID_SCHEMA_VERSION',
    'INVALID_SKIN_ID',
    'INVALID_LOGICAL_SIZE',
  ])
})

test('minimum renderable baseline requires exact wheat and sprinkler record counts', () => {
  const broken = structuredClone(validManifest)
  broken.crops.wheat.stages.pop()
  broken.buildings.sprinkler.levels.push(structuredClone(
    broken.buildings.sprinkler.levels[0],
  ))

  assert.deepEqual(validateFarmSceneManifest(broken), [
    'INVALID_STAGE_COUNT:crops.wheat',
    'INVALID_LEVEL_COUNT:buildings.sprinkler',
  ])
})

test('minimum renderable baseline reports missing records and asset paths in fixed order', () => {
  const broken = structuredClone(validManifest)
  broken.background = null
  broken.land.level1.src = ''
  broken.crops.wheat.stages[1] = null
  delete broken.pet.idle

  assert.deepEqual(validateFarmSceneManifest(broken), [
    'MISSING_REQUIRED_RECORD:background',
    'MISSING_ASSET_PATH:land.level1',
    'MISSING_REQUIRED_RECORD:crops.wheat.stages.1',
    'MISSING_REQUIRED_RECORD:pet.idle',
  ])
})

test('validator rejects unsafe paths and invalid anchors independently', () => {
  const unsafePaths = [
    '../outside.webp',
    '/absolute.webp',
    'https://example.com/remote.webp',
    'crops\\wheat\\stage-1.webp',
    'crops/wheat/../../../outside.webp',
    'crops/wheat/stage-1.webp?variant=remote',
    'crops/wheat/stage-1.webp#fragment',
    'C|/outside.webp',
    'fi\nle:../../outside.webp',
    'ht\ntps:example.com/x',
    'ht\ttps:example.com/x',
    'crops/%00wheat/stage-1.webp',
    '%2e%2e/outside.webp',
    'file:///__farm_skin__/outside.webp',
    'file:inside.webp',
    '%20file:///__farm_skin__/x.webp',
    '%20file%3A///__farm_skin__/x.webp',
    'background/base.webp%20',
  ]

  for (const src of unsafePaths) {
    const broken = structuredClone(validManifest)
    broken.crops.wheat.stages[0].src = src
    broken.crops.wheat.stages[0].anchor.x = 2
    assert.deepEqual(validateFarmSceneManifest(broken), [
      'UNSAFE_ASSET_PATH:crops.wheat.stages.0',
      'INVALID_ANCHOR:crops.wheat.stages.0',
    ])
  }
})

test('WHATWG normalization accepts a relative path that remains inside the skin root', () => {
  const normalizedInsideSkin = structuredClone(validManifest)
  normalizedInsideSkin.crops.wheat.stages[0].src = 'crops/wheat/../carrot/stage-1.webp'

  assert.deepEqual(validateFarmSceneManifest(normalizedInsideSkin), [])
})

test('background does not require an anchor while malformed present anchors are rejected', () => {
  const withoutBackgroundAnchor = structuredClone(validManifest)
  assert.equal(withoutBackgroundAnchor.background.anchor, undefined)
  assert.deepEqual(validateFarmSceneManifest(withoutBackgroundAnchor), [])

  const broken = structuredClone(validManifest)
  broken.effects.plant.anchor = { x: 0.5 }
  assert.deepEqual(validateFarmSceneManifest(broken), [
    'INVALID_ANCHOR:effects.plant',
  ])
})

test('frame durations are optional but must be positive finite numbers when present', () => {
  const broken = structuredClone(validManifest)
  broken.crops.wheat.stages[0].durationMs = 0
  broken.buildings.sprinkler.levels[1].durationMs = Number.NaN

  assert.deepEqual(validateFarmSceneManifest(broken), [
    'INVALID_FRAME_DURATION:crops.wheat.stages.0',
    'INVALID_FRAME_DURATION:buildings.sprinkler.levels.1',
  ])
})

test('optional animation assets still enforce in-skin paths and positive frame durations', () => {
  const broken = structuredClone(validManifest)
  broken.effects.sparkle = {
    frames: [{
      src: '%2e%2e/outside.webp',
      anchor: { x: 0.5, y: 0.5 },
      durationMs: -1,
    }],
  }

  assert.deepEqual(validateFarmSceneManifest(broken), [
    'UNSAFE_ASSET_PATH:effects.sparkle.frames.0',
    'INVALID_FRAME_DURATION:effects.sparkle.frames.0',
  ])
})

test('optional asset errors use lexical object-key order independent of insertion order', () => {
  const withOptionalAssets = keys => {
    const manifest = structuredClone(validManifest)
    manifest.optional = Object.fromEntries(keys.map(key => [
      key,
      { src: `../${key}.webp`, durationMs: 0 },
    ]))
    return manifest
  }
  const expected = [
    'UNSAFE_ASSET_PATH:optional.a',
    'INVALID_FRAME_DURATION:optional.a',
    'UNSAFE_ASSET_PATH:optional.z',
    'INVALID_FRAME_DURATION:optional.z',
  ]

  assert.deepEqual(validateFarmSceneManifest(withOptionalAssets(['z', 'a'])), expected)
  assert.deepEqual(validateFarmSceneManifest(withOptionalAssets(['a', 'z'])), expected)
})
