import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SCHEMA_VERSION,
  STANDARD_ACTIONS,
  isSafeAssetPath,
  validateSkinManifest,
  selectFormId,
  resolveAnimation,
} from './skin-manifest.mjs'

function validManifest() {
  return {
    schemaVersion: 1,
    id: 'cream-star',
    name: '奶油星团',
    portrait: 'portrait.webp',
    defaultFormId: 'base',
    forms: {
      base: {
        unlockLevel: 1,
        scale: 1,
        anchor: { x: 0.5, y: 0.92 },
        flipX: true,
        fallbacks: {
          walk: 'idle',
          eat: 'idle',
          happy: 'idle',
          sad: 'idle',
          interact: 'idle',
          sleep: 'idle',
        },
        animations: {
          idle: {
            fps: 8,
            loop: true,
            frames: [
              'forms/base/idle/001.webp',
              'forms/base/idle/002.webp',
            ],
          },
          walk: {
            fps: 10,
            loop: true,
            frames: ['forms/base/walk/001.webp'],
          },
        },
      },
    },
  }
}

describe('manifest constants', () => {
  it('locks schema version and seven standard actions', () => {
    assert.equal(SCHEMA_VERSION, 1)
    assert.deepEqual(STANDARD_ACTIONS, [
      'idle', 'walk', 'eat', 'happy', 'sad', 'interact', 'sleep',
    ])
  })
})

describe('isSafeAssetPath', () => {
  it('accepts normalized relative image paths', () => {
    assert.equal(isSafeAssetPath('forms/base/idle/001.webp'), true)
    assert.equal(isSafeAssetPath('portrait.png'), true)
  })

  it('rejects traversal, absolute paths, URLs, query, fragment, and backslashes', () => {
    const unsafe = [
      '../secret.png',
      'forms/../../secret.png',
      '/tmp/pet.png',
      '\\\\server\\pet.png',
      'C:\\pet.png',
      'https://example.com/pet.png',
      'idle.png?x=1',
      'idle.png#frame',
      'forms/./idle.png',
      'idle.svg',
      '',
    ]
    for (const path of unsafe) assert.equal(isSafeAssetPath(path), false, path)
  })
})

describe('validateSkinManifest', () => {
  it('accepts a complete version-1 manifest', () => {
    assert.deepEqual(validateSkinManifest(validManifest()), {
      valid: true,
      errors: [],
    })
  })

  it('collects stable errors instead of throwing', () => {
    const manifest = validManifest()
    manifest.schemaVersion = 2
    manifest.id = '../bad'
    manifest.portrait = '/absolute.png'
    manifest.defaultFormId = 'missing'
    delete manifest.forms.base.animations.idle
    manifest.forms.base.animations.walk.fps = 0
    manifest.forms.base.animations.walk.frames = ['../walk.png']

    const result = validateSkinManifest(manifest)
    assert.equal(result.valid, false)
    assert.deepEqual(result.errors, [
      'schemaVersion must equal 1',
      'id must match /^[a-z0-9][a-z0-9-]*$/',
      'portrait must be a safe relative asset path',
      'defaultFormId must reference an existing form',
      'forms.base.animations.idle is required',
      'forms.base.animations.walk.fps must be between 1 and 60',
      'forms.base.animations.walk.frames[0] must be a safe relative asset path',
    ])
  })

  it('rejects invalid fallback targets and fallback cycles', () => {
    const manifest = validManifest()
    manifest.forms.base.fallbacks.sad = 'unknown'
    manifest.forms.base.fallbacks.eat = 'happy'
    manifest.forms.base.fallbacks.happy = 'eat'

    const result = validateSkinManifest(manifest)
    assert.equal(result.valid, false)
    assert.deepEqual(result.errors, [
      'forms.base.fallbacks.sad must target a standard action',
      'forms.base.fallbacks contains a cycle at eat',
    ])
  })
})

describe('selectFormId', () => {
  it('chooses the highest unlocked form and clamps invalid levels to 1', () => {
    const manifest = validManifest()
    manifest.forms.grown = {
      ...manifest.forms.base,
      unlockLevel: 10,
    }
    manifest.forms.evolved = {
      ...manifest.forms.base,
      unlockLevel: 20,
    }

    assert.equal(selectFormId(manifest, Number.NaN), 'base')
    assert.equal(selectFormId(manifest, 1), 'base')
    assert.equal(selectFormId(manifest, 10), 'grown')
    assert.equal(selectFormId(manifest, 99), 'evolved')
  })
})

describe('resolveAnimation', () => {
  it('returns the requested animation when present', () => {
    const form = validManifest().forms.base
    assert.equal(resolveAnimation(form, 'walk').action, 'walk')
  })

  it('follows fallback to idle and returns null for unknown actions', () => {
    const form = validManifest().forms.base
    assert.equal(resolveAnimation(form, 'eat').action, 'idle')
    assert.equal(resolveAnimation(form, 'dance'), null)
  })
})
