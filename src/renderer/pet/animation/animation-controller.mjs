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
