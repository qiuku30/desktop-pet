import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PetAnimationRuntime,
  canStartAutoMove,
  loadPetAnimation,
  syncPetAnimationViewport,
} from './pet-animation-runtime.mjs'

function validManifest() {
  const animation = (name, loop = true) => ({
    fps: 8,
    loop,
    frames: [`forms/base/${name}/001.webp`],
  })
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
          idle: animation('idle'),
          walk: animation('walk'),
          eat: animation('eat', false),
          happy: animation('happy', false),
          sad: animation('sad', false),
          interact: animation('interact', false),
          sleep: animation('sleep'),
        },
      },
    },
  }
}

function fakeClock() {
  let now = 0
  let nextId = 1
  const timers = new Map()
  const setTimer = (callback, delay) => {
    const id = nextId++
    timers.set(id, { callback, at: now + delay })
    return id
  }
  const clearTimer = (id) => timers.delete(id)
  const advance = (ms) => {
    const end = now + ms
    while (true) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      now = due[1].at
      timers.delete(due[0])
      due[1].callback()
    }
    now = end
  }
  return {
    now: () => now,
    setTimer,
    clearTimer,
    advance,
    pending: () => timers.size,
  }
}

function fakeController() {
  const priority = {
    idle: 0,
    sleep: 1,
    sad: 1,
    walk: 2,
    interact: 3,
    happy: 3,
    eat: 4,
  }
  const calls = []
  const state = {
    baseAction: 'idle',
    transientAction: null,
    currentAction: 'idle',
  }
  return {
    calls,
    state,
    setBaseAction(action) {
      calls.push(['base', action])
      state.baseAction = action
      if (!state.transientAction) state.currentAction = action
      return true
    },
    playOneShot(action) {
      if (
        state.transientAction
        && priority[action] < priority[state.transientAction]
      ) {
        return false
      }
      calls.push(['oneShot', action])
      state.transientAction = action
      state.currentAction = action
      return true
    },
    finishOneShot() {
      state.transientAction = null
      state.currentAction = state.baseAction
    },
    setFacing(direction) {
      calls.push(['facing', direction])
    },
    getState: () => ({ ...state }),
    destroy() {
      calls.push(['destroy'])
    },
  }
}

describe('loadPetAnimation', () => {
  it('validates the manifest, selects the level form, and preloads seven actions', async () => {
    const renderer = {
      preloads: [],
      resizeCalls: [],
      setLayoutCalls: [],
      async preload(action, config, baseUrl) {
        this.preloads.push([action, config.frames[0], baseUrl])
      },
      resize(...args) { this.resizeCalls.push(args) },
      setLayout(layout) { this.setLayoutCalls.push(layout) },
      hasAnimation: () => true,
      play: () => true,
      setFacing() {},
      stop() {},
      destroy() {},
    }

    const result = await loadPetAnimation({
      canvas: {},
      manifestUrl: 'file:///skins/cream-star/pet.json',
      level: 1,
      fetchManifest: async () => validManifest(),
      createRenderer: () => renderer,
      viewport: { width: 200, height: 200, dpr: 2 },
    })

    assert.equal(result.formId, 'base')
    assert.deepEqual(
      renderer.preloads.map(([action]) => action),
      ['idle', 'walk', 'eat', 'happy', 'sad', 'interact', 'sleep'],
    )
    assert.deepEqual(renderer.resizeCalls, [[200, 200, 2]])
    assert.deepEqual(renderer.setLayoutCalls, [{
      scale: 1,
      anchor: { x: 0.5, y: 0.92 },
      flipX: true,
    }])
    result.destroy()
  })

  it('destroys a partial renderer and rejects when frame preload fails', async () => {
    let destroyed = 0
    const renderer = {
      async preload(action) {
        if (action === 'eat') throw new Error('broken frame')
      },
      resize() {},
      setLayout() {},
      destroy() { destroyed += 1 },
    }

    await assert.rejects(
      loadPetAnimation({
        canvas: {},
        manifestUrl: 'file:///skins/cream-star/pet.json',
        level: 1,
        fetchManifest: async () => validManifest(),
        createRenderer: () => renderer,
        viewport: { width: 200, height: 200, dpr: 1 },
      }),
      /broken frame/,
    )
    assert.equal(destroyed, 1)
  })

  it('preloads actions sequentially so failed teardown has no late action writes', async () => {
    let active = 0
    let maxActive = 0
    const renderer = {
      async preload() {
        active += 1
        maxActive = Math.max(maxActive, active)
        await Promise.resolve()
        active -= 1
      },
      resize() {},
      setLayout() {},
      hasAnimation: () => true,
      play: () => true,
      setFacing() {},
      stop() {},
      destroy() {},
    }

    const result = await loadPetAnimation({
      canvas: {},
      manifestUrl: 'file:///skins/cream-star/pet.json',
      level: 1,
      fetchManifest: async () => validManifest(),
      createRenderer: () => renderer,
      viewport: { width: 200, height: 200, dpr: 1 },
    })

    result.destroy()
    assert.equal(maxActive, 1)
  })

  it('makes a looping idle fallback finite when used for a transient action', async () => {
    const manifest = validManifest()
    delete manifest.forms.base.animations.eat
    const renderer = {
      preloads: [],
      async preload(action, config) {
        this.preloads.push([action, config.loop])
      },
      resize() {},
      setLayout() {},
      hasAnimation: () => true,
      play: () => true,
      setFacing() {},
      stop() {},
      destroy() {},
    }

    const result = await loadPetAnimation({
      canvas: {},
      manifestUrl: 'file:///skins/cream-star/pet.json',
      level: 1,
      fetchManifest: async () => manifest,
      createRenderer: () => renderer,
      viewport: { width: 200, height: 200, dpr: 1 },
    })

    assert.deepEqual(
      renderer.preloads.find(([action]) => action === 'idle'),
      ['idle', true],
    )
    assert.deepEqual(
      renderer.preloads.find(([action]) => action === 'eat'),
      ['eat', false],
    )
    result.destroy()
  })
})

describe('pet UI integration helpers', () => {
  it('blocks auto movement whenever any live guard becomes false', () => {
    const ready = {
      destroyed: false,
      wanderEnabled: true,
      sleeping: false,
      autoPaused: false,
      overlayActive: false,
    }
    assert.equal(canStartAutoMove(ready), true)
    for (const key of Object.keys(ready)) {
      const blocked = { ...ready, [key]: key === 'wanderEnabled' ? false : true }
      assert.equal(canStartAutoMove(blocked), false, key)
    }
  })

  it('reads the current element size when synchronizing after async loading', () => {
    const calls = []
    const runtime = {
      resize(...args) {
        calls.push(args)
        return true
      },
    }
    const element = {
      getBoundingClientRect: () => ({ width: 250, height: 240 }),
    }

    assert.equal(syncPetAnimationViewport(runtime, element, 2), true)
    assert.deepEqual(calls, [[250, 240, 2]])
  })
})

describe('PetAnimationRuntime', () => {
  it('plays only eat for an ordinary successful feed', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      getMood: () => 70,
    })

    assert.equal(runtime.playFeedResult({ leveledUp: false }), true)
    assert.deepEqual(
      controller.calls.filter(([type]) => type === 'oneShot'),
      [['oneShot', 'eat']],
    )
    runtime.destroy()
  })

  it('plays happy immediately for a click-triggered level up', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      getMood: () => 70,
    })

    assert.equal(runtime.playLevelUp(), true)
    assert.deepEqual(controller.calls.at(-1), ['oneShot', 'happy'])
    runtime.destroy()
  })

  it('queues one happy when click or external level-up occurs during ordinary eat', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      eligibilityPollMs: 100,
      getMood: () => 70,
    })

    runtime.playFeedResult({ leveledUp: false })
    assert.equal(runtime.playLevelUp(), true)
    assert.deepEqual(
      controller.calls.filter(([type]) => type === 'oneShot'),
      [['oneShot', 'eat']],
    )

    controller.finishOneShot()
    clock.advance(100)
    assert.equal(
      controller.calls.filter(
        ([type, action]) => type === 'oneShot' && action === 'happy',
      ).length,
      1,
    )
    runtime.destroy()
  })

  it('reuses feed-upgrade queued happy when another level-up arrives before polling', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      eligibilityPollMs: 100,
      getMood: () => 70,
    })

    runtime.playFeedResult({ leveledUp: true })
    controller.finishOneShot()
    assert.equal(runtime.playLevelUp(), true)
    clock.advance(100)
    controller.finishOneShot()
    clock.advance(100)

    assert.equal(
      controller.calls.filter(
        ([type, action]) => type === 'oneShot' && action === 'happy',
      ).length,
      1,
    )
    runtime.destroy()
  })

  it('plays feed level-up feedback in eat then happy order', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      eligibilityPollMs: 100,
      getMood: () => 70,
    })

    runtime.playFeedResult({ leveledUp: true })
    assert.deepEqual(
      controller.calls.filter(([type]) => type === 'oneShot'),
      [['oneShot', 'eat']],
    )
    clock.advance(100)
    assert.equal(controller.state.transientAction, 'eat')

    controller.finishOneShot()
    clock.advance(100)
    assert.deepEqual(
      controller.calls.filter(([type]) => type === 'oneShot'),
      [['oneShot', 'eat'], ['oneShot', 'happy']],
    )
    runtime.destroy()
  })

  it('deduplicates a queued happy within the same feed-upgrade sequence', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      eligibilityPollMs: 100,
      getMood: () => 70,
    })

    runtime.playFeedResult({ leveledUp: true })
    assert.equal(runtime.queueOneShot('happy'), false)
    controller.finishOneShot()
    clock.advance(100)
    controller.finishOneShot()
    clock.advance(100)

    assert.equal(
      controller.calls.filter(
        ([type, action]) => type === 'oneShot' && action === 'happy',
      ).length,
      1,
    )
    runtime.destroy()
  })

  it('delays sleep until queued feed-upgrade happy completes', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      sleepAfterMs: 10,
      eligibilityPollMs: 100,
      getMood: () => 70,
    })

    runtime.playFeedResult({ leveledUp: true })
    clock.advance(10)
    assert.equal(runtime.isSleeping(), false)

    controller.finishOneShot()
    clock.advance(100)
    assert.equal(controller.state.transientAction, 'happy')
    assert.equal(runtime.isSleeping(), false)

    controller.finishOneShot()
    clock.advance(100)
    assert.equal(runtime.isSleeping(), true)
    runtime.destroy()
  })

  it('clears queued happy on destroy', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      eligibilityPollMs: 100,
      getMood: () => 70,
    })

    runtime.playFeedResult({ leveledUp: true })
    runtime.destroy()
    controller.finishOneShot()
    clock.advance(1_000)

    assert.equal(
      controller.calls.some(
        ([type, action]) => type === 'oneShot' && action === 'happy',
      ),
      false,
    )
  })

  it('enters sleep after user inactivity, pauses wandering, and wakes on user activity', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const sleepChanges = []
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      sleepAfterMs: 600_000,
      onSleepChange: (sleeping) => sleepChanges.push(sleeping),
      getMood: () => 70,
    })

    clock.advance(600_000)
    assert.equal(runtime.isSleeping(), true)
    assert.deepEqual(controller.calls.at(-1), ['base', 'sleep'])
    assert.deepEqual(sleepChanges, [true])

    runtime.noteUserActivity()
    assert.equal(runtime.isSleeping(), false)
    assert.deepEqual(controller.calls.at(-1), ['base', 'idle'])
    assert.deepEqual(sleepChanges, [true, false])

    clock.advance(599_999)
    assert.equal(runtime.isSleeping(), false)
    runtime.destroy()
  })

  it('does not reset inactivity for movement or one-shots and waits until both finish', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      sleepAfterMs: 600_000,
      eligibilityPollMs: 100,
      getMood: () => 70,
    })

    clock.advance(599_000)
    runtime.setMoving(true, 40)
    runtime.playOneShot('happy')
    clock.advance(1_000)
    assert.equal(runtime.isSleeping(), false)

    runtime.setMoving(false)
    clock.advance(100)
    assert.equal(runtime.isSleeping(), false)

    controller.finishOneShot()
    clock.advance(100)
    assert.equal(runtime.isSleeping(), true)
    runtime.destroy()
  })

  it('sets facing from horizontal movement without waking a sleeping pet', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      sleepAfterMs: 10,
      getMood: () => 70,
    })

    runtime.setMoving(true, -5)
    assert.deepEqual(controller.calls.slice(-2), [
      ['facing', 'left'],
      ['base', 'walk'],
    ])
    runtime.setMoving(false)
    clock.advance(10)
    assert.equal(runtime.isSleeping(), true)
    assert.equal(runtime.setMoving(true, 5), false)
    assert.equal(runtime.isSleeping(), true)
    runtime.destroy()
  })

  it('plays sad only when mood is low, idle, and no transient is active', () => {
    const clock = fakeClock()
    const controller = fakeController()
    let mood = 20
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      sleepAfterMs: 600_000,
      sadMinMs: 120_000,
      sadMaxMs: 300_000,
      random: () => 0,
      getMood: () => mood,
    })

    clock.advance(120_000)
    assert.deepEqual(controller.calls.at(-1), ['oneShot', 'sad'])
    controller.finishOneShot()
    const sadCallCount = controller.calls.filter(
      (call) => call[0] === 'oneShot' && call[1] === 'sad',
    ).length

    mood = 40
    clock.advance(120_000)
    assert.equal(
      controller.calls.filter(
        (call) => call[0] === 'oneShot' && call[1] === 'sad',
      ).length,
      sadCallCount,
    )
    runtime.destroy()
  })

  it('resizes the renderer and restarts the current semantic action', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const resizeCalls = []
    const runtime = new PetAnimationRuntime(controller, {
      renderer: { resize: (...args) => resizeCalls.push(args), destroy() {} },
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      getMood: () => 70,
    })

    runtime.playOneShot('eat')
    const callsBeforeResize = controller.calls.length
    assert.equal(runtime.resize(300, 250, 2), true)
    assert.deepEqual(resizeCalls, [[300, 250, 2]])
    assert.deepEqual(controller.calls.slice(callsBeforeResize), [['oneShot', 'eat']])
    runtime.destroy()
  })

  it('cancels all timers and becomes inert after destroy', () => {
    const clock = fakeClock()
    const controller = fakeController()
    const runtime = new PetAnimationRuntime(controller, {
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      getMood: () => 20,
    })

    assert.ok(clock.pending() >= 2)
    runtime.destroy()
    assert.equal(clock.pending(), 0)
    assert.deepEqual(controller.calls.at(-1), ['destroy'])
    assert.equal(runtime.noteUserActivity(), false)
    assert.equal(runtime.playOneShot('eat'), false)
  })
})
