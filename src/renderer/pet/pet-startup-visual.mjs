import { anchoredDrawRect } from './animation/frame-timing.mjs'

export const PET_VISUAL_LAYOUT = Object.freeze({
  scale: 0.6,
  anchor: Object.freeze({ x: 0.5, y: 0.92 }),
})

const SOURCE_SIZE = Object.freeze({ width: 512, height: 512 })

export function createPetStartupVisual({
  body,
  staticFrame,
  canvas,
  fallback,
  getViewport,
  layout = PET_VISUAL_LAYOUT,
}) {
  if (!body || !staticFrame || !canvas || !fallback || !getViewport) {
    throw new Error('pet startup visual requires all three visual layers')
  }

  let destroyed = false

  function setState(state) {
    if (destroyed) return false
    body.dataset.visualState = state
    return true
  }

  function resize() {
    if (destroyed) return false
    const viewport = getViewport()
    const rect = anchoredDrawRect(SOURCE_SIZE, viewport, layout.scale, layout.anchor)
    staticFrame.style.left = `${rect.x}px`
    staticFrame.style.top = `${rect.y}px`
    staticFrame.style.width = `${rect.width}px`
    staticFrame.style.height = `${rect.height}px`
    return true
  }

  function onStaticLoad() {
    if (destroyed || body.dataset.visualState !== 'loading') return
    body.dataset.staticFrame = 'loaded'
  }

  function onStaticError() {
    if (destroyed || body.dataset.visualState !== 'loading') return
    body.dataset.staticFrame = 'failed'
    setState('error')
  }

  body.dataset.visualState = 'loading'
  body.dataset.staticFrame = 'pending'
  body.style.setProperty?.('--pet-visual-scale', layout.scale)
  body.style.setProperty?.('--pet-anchor-x', layout.anchor.x)
  body.style.setProperty?.('--pet-anchor-y', layout.anchor.y)
  staticFrame.addEventListener('load', onStaticLoad)
  staticFrame.addEventListener('error', onStaticError)
  resize()

  if (staticFrame.complete) {
    if (staticFrame.naturalWidth > 0) onStaticLoad()
    else onStaticError()
  }

  return {
    getState: () => body.dataset.visualState,
    resize,
    markAnimationReady() {
      if (destroyed || body.dataset.visualState !== 'loading') return false
      return setState('ready')
    },
    markAnimationError() {
      if (destroyed || body.dataset.visualState === 'ready') return false
      body.dataset.staticFrame = body.dataset.staticFrame === 'loaded'
        ? 'loaded'
        : 'failed'
      return setState('error')
    },
    destroy() {
      if (destroyed) return
      staticFrame.removeEventListener('load', onStaticLoad)
      staticFrame.removeEventListener('error', onStaticError)
      destroyed = true
    },
  }
}
