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
