# Pet Animation Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the independently testable manifest, timing, Canvas renderer, and animation-controller foundation for the future 奶油星团 desktop pet without replacing the current Emoji UI.

**Architecture:** Keep all new code inside `src/renderer/pet/animation/`. Pure manifest/timing functions remain DOM-free; `FrameRenderer` receives browser primitives through constructor injection; `AnimationController` depends only on a renderer interface. `pet.js`, PetState, Electron IPC, dashboard, and production art remain untouched in this phase.

**Tech Stack:** JavaScript ES modules (`.mjs`), Node.js built-in `node:test`, Canvas 2D API through injected adapters, `requestAnimationFrame`

## Global Constraints

- Implementation window: `pet-10`.
- Allowed source scope: `src/renderer/pet/animation/*` and `src/renderer/pet/DESIGN.md`.
- Required closing docs: `docs/progress.md` and `docs/session-log.md`.
- Do not modify `pet.js`, `pet.html`, `pet.css`, `src/renderer/shared/*`, `src/main/*`, dashboard files, or `package.json`.
- Do not add third-party dependencies.
- Do not add production skin assets or use the ARCH-08 AI concept preview as a game asset.
- Do not add `activeSkinId` or `ownedSkinIds`; those belong to a later integration plan.
- Use no semicolons, matching the existing renderer style.
- All public animation-foundation functions/classes must be importable in Node without DOM globals at module evaluation time.
- Run each test in red-green order; do not write implementation before observing its test fail for the expected reason.
- Before implementation, report to ARCH-08 in natural language: functionality, UI impact (“none”), and data impact (“none persisted”).

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/renderer/pet/animation/skin-manifest.mjs` | Validate version-1 skin manifests, enforce safe relative asset paths, select level form, resolve action fallback |
| `src/renderer/pet/animation/skin-manifest.test.mjs` | Manifest validation, path safety, form selection, fallback tests |
| `src/renderer/pet/animation/frame-timing.mjs` | Pure frame-index, high-DPI backing-size, and anchored draw-rectangle calculations |
| `src/renderer/pet/animation/frame-timing.test.mjs` | Timing boundaries, one-shot completion, DPR, anchor calculations |
| `src/renderer/pet/animation/frame-renderer.mjs` | Preload decoded frames, draw time-based Canvas frames, flip direction, stop/destroy |
| `src/renderer/pet/animation/frame-renderer.test.mjs` | Renderer tests with fake Canvas, fake loader, fake RAF clock |
| `src/renderer/pet/animation/animation-controller.mjs` | Base action, one-shot priority, stale completion protection, facing delegation |
| `src/renderer/pet/animation/animation-controller.test.mjs` | Action interruption/restoration and lifecycle tests |
| `src/renderer/pet/DESIGN.md` | Document the new interfaces as implemented but not yet integrated |
| `docs/progress.md` | Record pet-10 completion |
| `docs/session-log.md` | Register pet-10 files, authorization, and notes |

## Spec Coverage Boundary

This plan implements the design document's reusable foundation:

- versioned manifest validation and safe asset paths;
- level-based form selection and action fallback;
- elapsed-time frame calculation;
- high-DPI Canvas sizing, anchored drawing, and horizontal flip;
- animation preload/play/stop/destroy lifecycle;
- base/transient action priority and stale-completion protection.

The following approved design items are intentionally assigned to later plans:

- Canvas DOM insertion and replacement of the Emoji;
- 奶油星团 production portrait and seven animation frame sets;
- click/feed/walk/mood/sleep scheduling in `pet.js`;
- `activeSkinId`, `ownedSkinIds`, store defaults, and snapshot protection;
- dashboard portrait and skin switching;
- Electron manual UI/performance acceptance.

---

### Task 1: Manifest Validation and Form Resolution

**Files:**
- Create: `src/renderer/pet/animation/skin-manifest.test.mjs`
- Create: `src/renderer/pet/animation/skin-manifest.mjs`

**Interfaces:**
- Produces: `SCHEMA_VERSION: 1`
- Produces: `STANDARD_ACTIONS: readonly string[]`
- Produces: `isSafeAssetPath(path: unknown): boolean`
- Produces: `validateSkinManifest(manifest: unknown): { valid: boolean, errors: string[] }`
- Produces: `selectFormId(manifest: object, level: number): string`
- Produces: `resolveAnimation(form: object, action: string): { action: string, config: object } | null`

- [ ] **Step 1: Write the failing manifest tests**

Create `src/renderer/pet/animation/skin-manifest.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test and observe the expected red state**

Run:

```bash
node --test src/renderer/pet/animation/skin-manifest.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `skin-manifest.mjs`.

- [ ] **Step 3: Implement the complete manifest module**

Create `src/renderer/pet/animation/skin-manifest.mjs`:

```js
export const SCHEMA_VERSION = 1

export const STANDARD_ACTIONS = Object.freeze([
  'idle',
  'walk',
  'eat',
  'happy',
  'sad',
  'interact',
  'sleep',
])

const ACTION_SET = new Set(STANDARD_ACTIONS)
const SKIN_ID_RE = /^[a-z0-9][a-z0-9-]*$/
const IMAGE_EXT_RE = /\.(png|webp)$/i

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isSafeAssetPath(path) {
  if (typeof path !== 'string' || path.length === 0) return false
  if (path.includes('\\') || path.includes('?') || path.includes('#')) return false
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return false
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path)) return false
  if (!IMAGE_EXT_RE.test(path)) return false
  return !path.split('/').some(
    (segment) => segment === '' || segment === '.' || segment === '..',
  )
}

function validateAnimation(errors, prefix, animation) {
  if (!isObject(animation)) {
    errors.push(`${prefix} must be an object`)
    return
  }

  if (!Number.isFinite(animation.fps) || animation.fps < 1 || animation.fps > 60) {
    errors.push(`${prefix}.fps must be between 1 and 60`)
  }
  if (typeof animation.loop !== 'boolean') {
    errors.push(`${prefix}.loop must be boolean`)
  }
  if (!Array.isArray(animation.frames) || animation.frames.length === 0) {
    errors.push(`${prefix}.frames must be a non-empty array`)
    return
  }
  animation.frames.forEach((frame, index) => {
    if (!isSafeAssetPath(frame)) {
      errors.push(`${prefix}.frames[${index}] must be a safe relative asset path`)
    }
  })
}

function findFallbackCycle(fallbacks) {
  for (const start of STANDARD_ACTIONS) {
    const seen = new Set()
    let current = start
    while (fallbacks[current]) {
      if (seen.has(current)) return current
      seen.add(current)
      current = fallbacks[current]
    }
  }
  return null
}

function validateForm(errors, formId, form) {
  const prefix = `forms.${formId}`
  if (!isObject(form)) {
    errors.push(`${prefix} must be an object`)
    return
  }

  if (!Number.isInteger(form.unlockLevel) || form.unlockLevel < 1) {
    errors.push(`${prefix}.unlockLevel must be an integer >= 1`)
  }
  if (!Number.isFinite(form.scale) || form.scale <= 0) {
    errors.push(`${prefix}.scale must be a positive number`)
  }
  if (
    !isObject(form.anchor)
    || !Number.isFinite(form.anchor.x)
    || !Number.isFinite(form.anchor.y)
    || form.anchor.x < 0
    || form.anchor.x > 1
    || form.anchor.y < 0
    || form.anchor.y > 1
  ) {
    errors.push(`${prefix}.anchor must contain x/y between 0 and 1`)
  }
  if (typeof form.flipX !== 'boolean') {
    errors.push(`${prefix}.flipX must be boolean`)
  }

  const animations = isObject(form.animations) ? form.animations : {}
  if (!isObject(form.animations)) errors.push(`${prefix}.animations must be an object`)
  if (!animations.idle) errors.push(`${prefix}.animations.idle is required`)

  for (const [action, animation] of Object.entries(animations)) {
    if (!ACTION_SET.has(action)) {
      errors.push(`${prefix}.animations.${action} is not a standard action`)
      continue
    }
    validateAnimation(errors, `${prefix}.animations.${action}`, animation)
  }

  const fallbacks = form.fallbacks
  if (fallbacks === undefined) return
  if (!isObject(fallbacks)) {
    errors.push(`${prefix}.fallbacks must be an object`)
    return
  }

  for (const [action, target] of Object.entries(fallbacks)) {
    if (!ACTION_SET.has(action)) {
      errors.push(`${prefix}.fallbacks.${action} is not a standard action`)
    } else if (!ACTION_SET.has(target)) {
      errors.push(`${prefix}.fallbacks.${action} must target a standard action`)
    }
  }

  const cycleAt = findFallbackCycle(fallbacks)
  if (cycleAt) errors.push(`${prefix}.fallbacks contains a cycle at ${cycleAt}`)
}

export function validateSkinManifest(manifest) {
  const errors = []
  if (!isObject(manifest)) {
    return { valid: false, errors: ['manifest must be an object'] }
  }

  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must equal ${SCHEMA_VERSION}`)
  }
  if (typeof manifest.id !== 'string' || !SKIN_ID_RE.test(manifest.id)) {
    errors.push('id must match /^[a-z0-9][a-z0-9-]*$/')
  }
  if (typeof manifest.name !== 'string' || manifest.name.trim().length === 0) {
    errors.push('name must be a non-empty string')
  }
  if (!isSafeAssetPath(manifest.portrait)) {
    errors.push('portrait must be a safe relative asset path')
  }

  const forms = isObject(manifest.forms) ? manifest.forms : {}
  if (!isObject(manifest.forms) || Object.keys(forms).length === 0) {
    errors.push('forms must be a non-empty object')
  }
  if (typeof manifest.defaultFormId !== 'string' || !forms[manifest.defaultFormId]) {
    errors.push('defaultFormId must reference an existing form')
  }

  for (const [formId, form] of Object.entries(forms)) {
    if (!SKIN_ID_RE.test(formId)) {
      errors.push(`form id ${formId} must match /^[a-z0-9][a-z0-9-]*$/`)
      continue
    }
    validateForm(errors, formId, form)
  }

  return { valid: errors.length === 0, errors }
}

export function selectFormId(manifest, level) {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1
  const unlocked = Object.entries(manifest.forms)
    .filter(([, form]) => form.unlockLevel <= safeLevel)
    .sort((a, b) => b[1].unlockLevel - a[1].unlockLevel)
  return unlocked[0]?.[0] || manifest.defaultFormId
}

export function resolveAnimation(form, action) {
  if (!ACTION_SET.has(action)) return null

  const visited = new Set()
  let current = action
  while (!visited.has(current)) {
    visited.add(current)
    const config = form.animations?.[current]
    if (config) return { action: current, config }
    current = form.fallbacks?.[current]
    if (!current || !ACTION_SET.has(current)) return null
  }
  return null
}
```

- [ ] **Step 4: Run Task 1 tests**

Run:

```bash
node --test src/renderer/pet/animation/skin-manifest.test.mjs
```

Expected: all Task 1 tests PASS, 0 failures.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/renderer/pet/animation/skin-manifest.mjs src/renderer/pet/animation/skin-manifest.test.mjs
git commit -m "feat: add pet skin manifest validation"
```

---

### Task 2: Pure Frame Timing and Layout Math

**Files:**
- Create: `src/renderer/pet/animation/frame-timing.test.mjs`
- Create: `src/renderer/pet/animation/frame-timing.mjs`

**Interfaces:**
- Produces: `frameAtElapsed(elapsedMs, fps, frameCount, loop): { index: number, finished: boolean }`
- Produces: `canvasBackingSize(cssWidth, cssHeight, dpr): { width: number, height: number }`
- Produces: `anchoredDrawRect(source, viewport, scale, anchor): { x, y, width, height }`

- [ ] **Step 1: Write failing timing tests**

Create `src/renderer/pet/animation/frame-timing.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test and observe the expected red state**

Run:

```bash
node --test src/renderer/pet/animation/frame-timing.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `frame-timing.mjs`.

- [ ] **Step 3: Implement the complete timing module**

Create `src/renderer/pet/animation/frame-timing.mjs`:

```js
export function frameAtElapsed(elapsedMs, fps, frameCount, loop) {
  if (
    !Number.isFinite(elapsedMs)
    || elapsedMs < 0
    || !Number.isFinite(fps)
    || fps <= 0
    || !Number.isInteger(frameCount)
    || frameCount <= 0
  ) {
    return { index: 0, finished: true }
  }

  const frameDuration = 1000 / fps
  const rawIndex = Math.floor(elapsedMs / frameDuration)
  if (loop) {
    return { index: rawIndex % frameCount, finished: false }
  }
  return {
    index: Math.min(rawIndex, frameCount - 1),
    finished: rawIndex >= frameCount,
  }
}

export function canvasBackingSize(cssWidth, cssHeight, dpr) {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  return {
    width: Math.max(1, Math.round(Math.max(0, cssWidth) * safeDpr)),
    height: Math.max(1, Math.round(Math.max(0, cssHeight) * safeDpr)),
  }
}

export function anchoredDrawRect(source, viewport, scale, anchor) {
  const fit = Math.min(
    viewport.width / source.width,
    viewport.height / source.height,
  ) * scale
  const width = source.width * fit
  const height = source.height * fit
  return {
    x: viewport.width * anchor.x - width * anchor.x,
    y: viewport.height * anchor.y - height * anchor.y,
    width,
    height,
  }
}
```

- [ ] **Step 4: Run Task 2 tests**

Run:

```bash
node --test src/renderer/pet/animation/frame-timing.test.mjs
```

Expected: all Task 2 tests PASS, 0 failures.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/renderer/pet/animation/frame-timing.mjs src/renderer/pet/animation/frame-timing.test.mjs
git commit -m "feat: add pet animation frame timing"
```

---

### Task 3: Canvas Frame Renderer

**Files:**
- Create: `src/renderer/pet/animation/frame-renderer.test.mjs`
- Create: `src/renderer/pet/animation/frame-renderer.mjs`

**Interfaces:**
- Consumes: `frameAtElapsed`, `canvasBackingSize`, `anchoredDrawRect`
- Produces: `loadBrowserImage(url): Promise<HTMLImageElement>`
- Produces: `new FrameRenderer({ canvas, loadImage, requestFrame, cancelFrame, now })`
- Produces methods:
  - `preload(action, config, baseUrl): Promise<void>`
  - `hasAnimation(action): boolean`
  - `resize(cssWidth, cssHeight, dpr): void`
  - `setLayout({ scale, anchor, flipX }): void`
  - `setFacing('left' | 'right'): void`
  - `play(action, { onComplete? } = {}): boolean`
  - `stop(): void`
  - `destroy(): void`

- [ ] **Step 1: Write failing renderer tests with injected browser fakes**

Create `src/renderer/pet/animation/frame-renderer.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test and observe the expected red state**

Run:

```bash
node --test src/renderer/pet/animation/frame-renderer.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `frame-renderer.mjs`.

- [ ] **Step 3: Implement the complete renderer**

Create `src/renderer/pet/animation/frame-renderer.mjs`:

```js
import {
  frameAtElapsed,
  canvasBackingSize,
  anchoredDrawRect,
} from './frame-timing.mjs'

export function loadBrowserImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`failed to load frame: ${url}`))
    image.src = url
  })
}

export class FrameRenderer {
  constructor({
    canvas,
    loadImage = loadBrowserImage,
    requestFrame = (callback) => requestAnimationFrame(callback),
    cancelFrame = (id) => cancelAnimationFrame(id),
    now = () => performance.now(),
  }) {
    this.canvas = canvas
    this.context = canvas.getContext('2d')
    if (!this.context) throw new Error('2d canvas context is required')

    this.loadImage = loadImage
    this.requestFrame = requestFrame
    this.cancelFrame = cancelFrame
    this.now = now
    this.animations = new Map()
    this.viewport = { width: 1, height: 1 }
    this.layout = {
      scale: 1,
      anchor: { x: 0.5, y: 0.92 },
      flipX: true,
    }
    this.facing = 'right'
    this.rafId = null
    this.playToken = 0
    this.destroyed = false
  }

  async preload(action, config, baseUrl) {
    const frames = await Promise.all(
      config.frames.map((path) => this.loadImage(new URL(path, baseUrl).href)),
    )
    this.animations.set(action, {
      fps: config.fps,
      loop: config.loop,
      frames,
    })
  }

  hasAnimation(action) {
    return this.animations.has(action)
  }

  resize(cssWidth, cssHeight, dpr = 1) {
    this.viewport = { width: cssWidth, height: cssHeight }
    const backing = canvasBackingSize(cssWidth, cssHeight, dpr)
    this.canvas.width = backing.width
    this.canvas.height = backing.height
    this.context.setTransform(dpr > 0 ? dpr : 1, 0, 0, dpr > 0 ? dpr : 1, 0, 0)
  }

  setLayout({ scale, anchor, flipX }) {
    this.layout = { scale, anchor, flipX }
  }

  setFacing(direction) {
    if (direction === 'left' || direction === 'right') this.facing = direction
  }

  play(action, { onComplete } = {}) {
    if (this.destroyed) return false
    const animation = this.animations.get(action)
    if (!animation || animation.frames.length === 0) return false

    this.stop()
    const token = ++this.playToken
    const startedAt = this.now()

    const draw = (timestamp) => {
      if (this.destroyed || token !== this.playToken) return
      const elapsed = Math.max(0, timestamp - startedAt)
      const state = frameAtElapsed(
        elapsed,
        animation.fps,
        animation.frames.length,
        animation.loop,
      )
      this.drawFrame(animation.frames[state.index])

      if (state.finished) {
        this.rafId = null
        onComplete?.()
        return
      }
      if (animation.loop && animation.frames.length === 1) {
        this.rafId = null
        return
      }
      this.rafId = this.requestFrame(draw)
    }

    draw(startedAt)
    return true
  }

  drawFrame(image) {
    const { width, height } = this.viewport
    this.context.clearRect(0, 0, width, height)
    const rect = anchoredDrawRect(
      { width: image.width, height: image.height },
      this.viewport,
      this.layout.scale,
      this.layout.anchor,
    )

    this.context.save()
    if (this.layout.flipX && this.facing === 'left') {
      this.context.translate(width, 0)
      this.context.scale(-1, 1)
      this.context.drawImage(
        image,
        width - rect.x - rect.width,
        rect.y,
        rect.width,
        rect.height,
      )
    } else {
      this.context.drawImage(image, rect.x, rect.y, rect.width, rect.height)
    }
    this.context.restore()
  }

  stop() {
    this.playToken += 1
    if (this.rafId !== null) {
      this.cancelFrame(this.rafId)
      this.rafId = null
    }
  }

  destroy() {
    if (this.destroyed) return
    this.stop()
    this.animations.clear()
    this.destroyed = true
  }
}
```

- [ ] **Step 4: Run Task 2 and Task 3 tests together**

Run:

```bash
node --test \
  src/renderer/pet/animation/frame-timing.test.mjs \
  src/renderer/pet/animation/frame-renderer.test.mjs
```

Expected: all Task 2–3 tests PASS, 0 failures.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/renderer/pet/animation/frame-renderer.mjs src/renderer/pet/animation/frame-renderer.test.mjs
git commit -m "feat: add canvas pet frame renderer"
```

---

### Task 4: Animation Controller and Priority

**Files:**
- Create: `src/renderer/pet/animation/animation-controller.test.mjs`
- Create: `src/renderer/pet/animation/animation-controller.mjs`

**Interfaces:**
- Consumes renderer:
  - `hasAnimation(action): boolean`
  - `play(action, { onComplete? }): boolean`
  - `setFacing(direction): void`
  - `stop(): void`
- Produces: `ACTION_PRIORITY`
- Produces: `new AnimationController(renderer)`
- Produces methods:
  - `setBaseAction('idle' | 'walk' | 'sleep'): boolean`
  - `playOneShot('eat' | 'happy' | 'sad' | 'interact'): boolean`
  - `setFacing('left' | 'right'): void`
  - `getState(): { baseAction, transientAction, currentAction }`
  - `destroy(): void`

- [ ] **Step 1: Write failing controller tests**

Create `src/renderer/pet/animation/animation-controller.test.mjs`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTION_PRIORITY,
  AnimationController,
} from './animation-controller.mjs'

function fakeRenderer({
  available = ['idle', 'walk', 'eat', 'happy', 'sad', 'interact', 'sleep'],
  failActions = [],
} = {}) {
  const plays = []
  const completions = []
  return {
    plays,
    completions,
    facings: [],
    stopped: 0,
    hasAnimation: (action) => available.includes(action),
    play(action, { onComplete } = {}) {
      plays.push(action)
      completions.push(onComplete || null)
      return !failActions.includes(action)
    },
    setFacing(direction) {
      this.facings.push(direction)
    },
    stop() {
      this.stopped += 1
    },
  }
}

describe('ACTION_PRIORITY', () => {
  it('matches the ARCH-08 ordering', () => {
    assert.equal(ACTION_PRIORITY.eat > ACTION_PRIORITY.interact, true)
    assert.equal(ACTION_PRIORITY.interact > ACTION_PRIORITY.walk, true)
    assert.equal(ACTION_PRIORITY.walk > ACTION_PRIORITY.sleep, true)
    assert.equal(ACTION_PRIORITY.sleep > ACTION_PRIORITY.idle, true)
  })
})

describe('AnimationController', () => {
  it('starts idle and switches base action when no transient is active', () => {
    const renderer = fakeRenderer()
    const controller = new AnimationController(renderer)
    assert.deepEqual(renderer.plays, ['idle'])

    assert.equal(controller.setBaseAction('walk'), true)
    assert.deepEqual(renderer.plays, ['idle', 'walk'])
    assert.deepEqual(controller.getState(), {
      baseAction: 'walk',
      transientAction: null,
      currentAction: 'walk',
    })
  })

  it('plays a transient and restores the latest base action on completion', () => {
    const renderer = fakeRenderer()
    const controller = new AnimationController(renderer)
    controller.setBaseAction('walk')
    controller.playOneShot('interact')
    controller.setBaseAction('idle')

    assert.deepEqual(renderer.plays, ['idle', 'walk', 'interact'])
    renderer.completions[2]()
    assert.deepEqual(renderer.plays, ['idle', 'walk', 'interact', 'idle'])
  })

  it('blocks lower-priority transient and allows higher-priority interruption', () => {
    const renderer = fakeRenderer()
    const controller = new AnimationController(renderer)
    assert.equal(controller.playOneShot('happy'), true)
    assert.equal(controller.playOneShot('sad'), false)
    assert.equal(controller.playOneShot('eat'), true)
    assert.deepEqual(renderer.plays, ['idle', 'happy', 'eat'])
  })

  it('ignores stale completion from an interrupted transient', () => {
    const renderer = fakeRenderer()
    const controller = new AnimationController(renderer)
    controller.playOneShot('happy')
    controller.playOneShot('eat')

    renderer.completions[1]()
    assert.equal(controller.getState().transientAction, 'eat')
    renderer.completions[2]()
    assert.equal(controller.getState().transientAction, null)
    assert.equal(controller.getState().currentAction, 'idle')
  })

  it('rejects unknown/missing actions and delegates facing', () => {
    const renderer = fakeRenderer({ available: ['idle'] })
    const controller = new AnimationController(renderer)
    assert.equal(controller.setBaseAction('dance'), false)
    assert.equal(controller.playOneShot('eat'), false)
    controller.setFacing('left')
    assert.deepEqual(renderer.facings, ['left'])
  })

  it('rolls back transient state when the renderer refuses playback', () => {
    const renderer = fakeRenderer({ failActions: ['eat'] })
    const controller = new AnimationController(renderer)
    assert.equal(controller.playOneShot('eat'), false)
    assert.deepEqual(controller.getState(), {
      baseAction: 'idle',
      transientAction: null,
      currentAction: 'idle',
    })
  })

  it('stops the renderer and rejects work after destroy', () => {
    const renderer = fakeRenderer()
    const controller = new AnimationController(renderer)
    controller.destroy()
    assert.equal(renderer.stopped, 1)
    assert.equal(controller.playOneShot('eat'), false)
    assert.equal(controller.setBaseAction('walk'), false)
  })
})
```

- [ ] **Step 2: Run the test and observe the expected red state**

Run:

```bash
node --test src/renderer/pet/animation/animation-controller.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `animation-controller.mjs`.

- [ ] **Step 3: Implement the complete controller**

Create `src/renderer/pet/animation/animation-controller.mjs`:

```js
export const ACTION_PRIORITY = Object.freeze({
  idle: 0,
  sleep: 1,
  sad: 1,
  walk: 2,
  interact: 3,
  happy: 3,
  eat: 4,
})

const BASE_ACTIONS = new Set(['idle', 'walk', 'sleep'])
const TRANSIENT_ACTIONS = new Set(['eat', 'happy', 'sad', 'interact'])

export class AnimationController {
  constructor(renderer) {
    this.renderer = renderer
    this.baseAction = 'idle'
    this.transientAction = null
    this.currentAction = null
    this.playToken = 0
    this.destroyed = false
    this.playBase()
  }

  setBaseAction(action) {
    if (
      this.destroyed
      || !BASE_ACTIONS.has(action)
      || !this.renderer.hasAnimation(action)
    ) {
      return false
    }

    this.baseAction = action
    if (!this.transientAction) this.playBase()
    return true
  }

  playOneShot(action) {
    if (
      this.destroyed
      || !TRANSIENT_ACTIONS.has(action)
      || !this.renderer.hasAnimation(action)
    ) {
      return false
    }

    if (
      this.transientAction
      && ACTION_PRIORITY[action] < ACTION_PRIORITY[this.transientAction]
    ) {
      return false
    }

    const token = ++this.playToken
    this.transientAction = action
    this.currentAction = action
    const started = this.renderer.play(action, {
      onComplete: () => {
        if (this.destroyed || token !== this.playToken) return
        this.transientAction = null
        this.playBase()
      },
    })
    if (!started && token === this.playToken) {
      this.transientAction = null
      this.playBase()
    }
    return started
  }

  setFacing(direction) {
    if (this.destroyed) return
    this.renderer.setFacing(direction)
  }

  getState() {
    return {
      baseAction: this.baseAction,
      transientAction: this.transientAction,
      currentAction: this.currentAction,
    }
  }

  playBase() {
    const action = this.renderer.hasAnimation(this.baseAction)
      ? this.baseAction
      : 'idle'
    if (!this.renderer.hasAnimation(action)) {
      this.currentAction = null
      return false
    }
    this.currentAction = action
    return this.renderer.play(action)
  }

  destroy() {
    if (this.destroyed) return
    this.playToken += 1
    this.transientAction = null
    this.renderer.stop()
    this.destroyed = true
  }
}
```

- [ ] **Step 4: Run all animation-foundation tests**

Run:

```bash
node --test src/renderer/pet/animation/*.test.mjs
```

Expected: all Task 1–4 tests PASS, 0 failures.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/renderer/pet/animation/animation-controller.mjs src/renderer/pet/animation/animation-controller.test.mjs
git commit -m "feat: add pet animation controller"
```

---

### Task 5: Module Design Documentation and Full Regression

**Files:**
- Modify: `src/renderer/pet/DESIGN.md`
- Modify: `docs/progress.md`
- Modify: `docs/session-log.md`

**Interfaces:**
- Documents the exact Task 1–4 interfaces.
- Does not change runtime behavior.

- [ ] **Step 1: Append the foundation section to pet DESIGN.md**

Append this section:

```markdown
## 帧动画基础设施（pet-10）

> 基础设施已实现但尚未接入 `pet.js`；当前 Emoji 表现保持不变。

目录：`src/renderer/pet/animation/`

| 文件 | 职责 |
|------|------|
| `skin-manifest.mjs` | 版本 1 皮肤清单校验、安全相对路径、等级形态选择、动作回退 |
| `frame-timing.mjs` | 时间驱动帧索引、高 DPI backing size、锚点绘制矩形 |
| `frame-renderer.mjs` | 帧预加载、Canvas 绘制、水平翻转、播放生命周期 |
| `animation-controller.mjs` | 基础动作、一次性动作优先级、打断与恢复 |

接口边界：

- `pet.js` 后续只调用语义动作，不直接计算帧序号；
- `AnimationController` 只依赖 renderer 的 `hasAnimation/play/setFacing/stop`；
- `FrameRenderer` 通过构造参数注入图片加载、RAF 和时钟，Node 测试不依赖 DOM；
- 本阶段不含皮肤素材、PetState 字段、面板立绘或 UI 接入。
```

- [ ] **Step 2: Update progress.md**

In `## 🎨 桌宠形象化 — Phase 2`, replace:

```markdown
| 动画引擎实现 | ⏳ | 需先写实施计划并拆分窗口 |
```

with these two rows:

```markdown
| 动画基础设施 | ✅ pet-10 | 清单校验 + 帧时间 + Canvas FrameRenderer + AnimationController；尚未接 UI |
| 动画引擎接入 | ⏳ | 后续窗口接入 pet.js、Canvas DOM 和正式素材 |
```

Keep “角色概念定稿”, “动画引擎接入”, and “面板立绘接入” pending.

- [ ] **Step 3: Register pet-10 in session-log.md**

Add under the pet section:

```markdown
| **pet-10** | 2026-07-24 | 桌宠帧动画基础设施 | `src/renderer/pet/animation/skin-manifest.mjs` `skin-manifest.test.mjs` `frame-timing.mjs` `frame-timing.test.mjs` `frame-renderer.mjs` `frame-renderer.test.mjs` `animation-controller.mjs` `animation-controller.test.mjs` `src/renderer/pet/DESIGN.md` `docs/progress.md` `docs/session-log.md` | 无 | 纯基础设施，未接 pet.js/UI/PetState；独立帧协议、路径安全、Canvas 时间驱动、高 DPI、动作优先级均有 node:test 覆盖 |
```

- [ ] **Step 4: Run the complete project test suite**

Run:

```bash
node --test \
  src/renderer/pet/pet-motion.test.mjs \
  src/renderer/pet/animation/*.test.mjs \
  src/renderer/shared/exp-service.test.mjs \
  src/renderer/shared/mood-service.test.mjs \
  src/renderer/shared/game-reward-service.test.mjs
```

Expected: every listed test PASS, 0 failures.

- [ ] **Step 5: Run compliance checks**

Run:

```bash
rg -n "from ['\"].*(dashboard|games|main)/" src/renderer/pet/animation src/renderer/pet/DESIGN.md
git diff --check
git status --short
```

Expected:

- `rg` returns no matches;
- `git diff --check` exits 0 with no output;
- `git status --short` lists only the pet-10 files and required closing docs before commit.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/renderer/pet/DESIGN.md docs/progress.md docs/session-log.md
git commit -m "docs: document pet animation foundation"
```

---

## Final Review Gate

- [ ] Confirm every Task 1–4 commit exists and Task 5 docs match the actual interfaces.
- [ ] Confirm the current Emoji UI is unchanged.
- [ ] Confirm no production skin asset or AI concept preview was committed.
- [ ] Confirm no files outside the Global Constraints were changed.
- [ ] Re-run the complete project test command from Task 5 and record the exact pass/fail count in the pet-10 handoff.
- [ ] Report changed files, authorization (“无”), pitfalls, and architecture notes to ARCH-08.
- [ ] Do not merge or push until ARCH-08 reviews the implementation.
