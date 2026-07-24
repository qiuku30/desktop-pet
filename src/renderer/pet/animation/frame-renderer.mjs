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
