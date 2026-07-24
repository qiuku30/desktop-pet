import { AnimationController } from './animation/animation-controller.mjs'
import { FrameRenderer } from './animation/frame-renderer.mjs'
import {
  STANDARD_ACTIONS,
  resolveAnimation,
  selectFormId,
  validateSkinManifest,
} from './animation/skin-manifest.mjs'

const DEFAULT_SLEEP_MS = 10 * 60 * 1000
const DEFAULT_SAD_MIN_MS = 2 * 60 * 1000
const DEFAULT_SAD_MAX_MS = 5 * 60 * 1000
const DEFAULT_ELIGIBILITY_POLL_MS = 100
const TRANSIENT_ACTIONS = new Set(['eat', 'happy', 'sad', 'interact'])

export function canStartAutoMove({
  destroyed,
  wanderEnabled,
  sleeping,
  autoPaused,
  overlayActive,
}) {
  return !destroyed
    && wanderEnabled
    && !sleeping
    && !autoPaused
    && !overlayActive
}

export function syncPetAnimationViewport(runtime, element, dpr = 1) {
  if (!runtime || !element) return false
  const rect = element.getBoundingClientRect()
  return runtime.resize(rect.width, rect.height, dpr)
}

export class PetAnimationRuntime {
  constructor(controller, {
    renderer = null,
    now = () => Date.now(),
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (id) => clearTimeout(id),
    sleepAfterMs = DEFAULT_SLEEP_MS,
    sadMinMs = DEFAULT_SAD_MIN_MS,
    sadMaxMs = DEFAULT_SAD_MAX_MS,
    eligibilityPollMs = DEFAULT_ELIGIBILITY_POLL_MS,
    random = Math.random,
    getMood = () => 100,
    onSleepChange = () => {},
  } = {}) {
    this.controller = controller
    this.renderer = renderer
    this.now = now
    this.setTimer = setTimer
    this.clearTimer = clearTimer
    this.sleepAfterMs = sleepAfterMs
    this.sadMinMs = sadMinMs
    this.sadMaxMs = sadMaxMs
    this.eligibilityPollMs = eligibilityPollMs
    this.random = random
    this.getMood = getMood
    this.onSleepChange = onSleepChange

    this.destroyed = false
    this.moving = false
    this.sleeping = false
    this.lastActivityAt = this.now()
    this.sleepTimer = null
    this.sadTimer = null
    this.queueTimer = null
    this.queuedOneShots = new Set()

    this.scheduleSleepCheck()
    this.scheduleSad()
  }

  isSleeping() {
    return this.sleeping
  }

  noteUserActivity() {
    if (this.destroyed) return false
    this.lastActivityAt = this.now()
    if (this.sleeping) {
      this.sleeping = false
      this.onSleepChange(false)
    }
    this.controller.setBaseAction(this.moving ? 'walk' : 'idle')
    this.scheduleSleepCheck()
    return true
  }

  setMoving(moving, deltaX = 0) {
    if (this.destroyed) return false
    if (moving && this.sleeping) return false

    this.moving = Boolean(moving)
    if (this.moving) {
      if (deltaX < 0) this.controller.setFacing('left')
      if (deltaX > 0) this.controller.setFacing('right')
      this.controller.setBaseAction('walk')
      return true
    }

    if (this.isSleepDue()) {
      this.requestSleep()
    } else {
      this.controller.setBaseAction('idle')
    }
    return true
  }

  playOneShot(action) {
    if (this.destroyed) return false
    return this.controller.playOneShot(action)
  }

  playFeedResult({ leveledUp = false } = {}) {
    if (this.destroyed) return false
    this.noteUserActivity()
    const started = this.controller.playOneShot('eat')
    if (leveledUp) this.queueOneShot('happy')
    return started
  }

  playLevelUp() {
    if (this.destroyed) return false
    const { transientAction } = this.controller.getState()
    if (transientAction === 'happy' || this.queuedOneShots.has('happy')) {
      return true
    }
    if (this.controller.playOneShot('happy')) return true
    return this.queueOneShot('happy')
  }

  queueOneShot(action) {
    if (
      this.destroyed
      || !TRANSIENT_ACTIONS.has(action)
      || this.queuedOneShots.has(action)
      || this.controller.getState().transientAction === action
    ) {
      return false
    }
    this.queuedOneShots.add(action)
    this.scheduleQueueCheck(0)
    return true
  }

  scheduleQueueCheck(delay = this.eligibilityPollMs) {
    if (this.queueTimer !== null) this.clearTimer(this.queueTimer)
    if (this.destroyed || this.queuedOneShots.size === 0) return
    this.queueTimer = this.setTimer(() => this.drainQueuedOneShot(), delay)
  }

  drainQueuedOneShot() {
    this.queueTimer = null
    if (this.destroyed || this.queuedOneShots.size === 0) return
    if (this.controller.getState().transientAction) {
      this.scheduleQueueCheck()
      return
    }

    const action = this.queuedOneShots.values().next().value
    this.queuedOneShots.delete(action)
    this.controller.playOneShot(action)
    if (this.queuedOneShots.size > 0) this.scheduleQueueCheck()
  }

  resize(width, height, dpr = 1) {
    if (this.destroyed || !this.renderer) return false
    this.renderer.resize(width, height, dpr)
    const state = this.controller.getState()
    if (state.transientAction) {
      this.controller.playOneShot(state.transientAction)
    } else {
      this.controller.setBaseAction(state.baseAction)
    }
    return true
  }

  isSleepDue() {
    return this.now() - this.lastActivityAt >= this.sleepAfterMs
  }

  scheduleSleepCheck(delay = null) {
    if (this.sleepTimer !== null) this.clearTimer(this.sleepTimer)
    if (this.destroyed) return
    const remaining = Math.max(
      0,
      this.sleepAfterMs - (this.now() - this.lastActivityAt),
    )
    this.sleepTimer = this.setTimer(
      () => this.requestSleep(),
      delay ?? remaining,
    )
  }

  requestSleep() {
    this.sleepTimer = null
    if (this.destroyed || this.sleeping || !this.isSleepDue()) return
    const { transientAction } = this.controller.getState()
    if (this.moving || transientAction || this.queuedOneShots.size > 0) {
      this.scheduleSleepCheck(this.eligibilityPollMs)
      return
    }
    this.sleeping = true
    this.controller.setBaseAction('sleep')
    this.onSleepChange(true)
  }

  scheduleSad() {
    if (this.sadTimer !== null) this.clearTimer(this.sadTimer)
    if (this.destroyed) return
    const range = Math.max(0, this.sadMaxMs - this.sadMinMs)
    const delay = this.sadMinMs + this.random() * range
    this.sadTimer = this.setTimer(() => {
      this.sadTimer = null
      this.trySad()
      this.scheduleSad()
    }, delay)
  }

  trySad() {
    if (this.destroyed || this.sleeping || this.moving || this.getMood() >= 30) {
      return false
    }
    const state = this.controller.getState()
    if (state.baseAction !== 'idle' || state.transientAction) return false
    return this.controller.playOneShot('sad')
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    if (this.sleepTimer !== null) this.clearTimer(this.sleepTimer)
    if (this.sadTimer !== null) this.clearTimer(this.sadTimer)
    if (this.queueTimer !== null) this.clearTimer(this.queueTimer)
    this.sleepTimer = null
    this.sadTimer = null
    this.queueTimer = null
    this.queuedOneShots.clear()
    this.controller.destroy()
    this.renderer?.destroy()
  }
}

export async function loadPetAnimation({
  canvas,
  manifestUrl,
  level,
  fetchManifest = async (url) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`failed to load pet manifest: ${response.status}`)
    return response.json()
  },
  createRenderer = (target) => new FrameRenderer({ canvas: target }),
  viewport,
  runtimeOptions = {},
}) {
  const manifest = await fetchManifest(manifestUrl)
  const validation = validateSkinManifest(manifest)
  if (!validation.valid) {
    throw new Error(`invalid pet manifest: ${validation.errors.join('; ')}`)
  }

  const formId = selectFormId(manifest, level)
  const form = manifest.forms[formId]
  const renderer = createRenderer(canvas)
  const baseUrl = new URL('.', manifestUrl).href

  try {
    renderer.setLayout({
      scale: form.scale,
      anchor: form.anchor,
      flipX: form.flipX,
    })
    renderer.resize(viewport.width, viewport.height, viewport.dpr)
    for (const action of STANDARD_ACTIONS) {
      const resolved = resolveAnimation(form, action)
      if (resolved) {
        const config = TRANSIENT_ACTIONS.has(action)
          && action !== resolved.action
          && resolved.config.loop
          ? { ...resolved.config, loop: false }
          : resolved.config
        await renderer.preload(action, config, baseUrl)
      }
    }

    const controller = new AnimationController(renderer)
    const runtime = new PetAnimationRuntime(controller, {
      ...runtimeOptions,
      renderer,
    })
    runtime.manifest = manifest
    runtime.formId = formId
    return runtime
  } catch (error) {
    renderer.destroy()
    throw error
  }
}
