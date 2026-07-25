import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const moduleUrl = new URL('./pet-startup-visual.mjs', import.meta.url)
const htmlUrl = new URL('./pet.html', import.meta.url)
const cssUrl = new URL('./pet.css', import.meta.url)

async function readPetSource(url) {
  return readFile(url, 'utf8')
}

describe('pet startup DOM and CSS contract', () => {
  it('starts in loading without exposing the Emoji fallback', async () => {
    const html = await readPetSource(htmlUrl)

    assert.match(html, /id="pet-body"[^>]*data-visual-state="loading"/)
    assert.match(html, /id="pet-static-frame"/)
    assert.match(html, /forms\/base\/idle\/001\.webp/)
    assert.doesNotMatch(html, /id="pet-fallback"[^>]*>\s*🐱/)
  })

  it('keeps static frame and Canvas on the same scale and anchor contract', async () => {
    const css = await readPetSource(cssUrl)

    assert.match(css, /--pet-visual-scale:\s*0\.6/)
    assert.match(css, /--pet-anchor-x:\s*0\.5/)
    assert.match(css, /--pet-anchor-y:\s*0\.92/)
    assert.match(css, /#pet-static-frame/)
    assert.match(css, /data-visual-state="loading"/)
    assert.match(css, /data-visual-state="ready"/)
    assert.match(css, /data-visual-state="error"/)
  })
})

describe('pet startup visual state machine', () => {
  function fakeElement() {
    const listeners = new Map()
    return {
      dataset: {},
      style: {},
      complete: false,
      naturalWidth: 0,
      addEventListener(type, listener) {
        listeners.set(type, listener)
      },
      removeEventListener(type, listener) {
        if (listeners.get(type) === listener) listeners.delete(type)
      },
      dispatch(type) {
        listeners.get(type)?.()
      },
      listenerCount: () => listeners.size,
    }
  }

  async function createHarness(viewport = { width: 170, height: 170 }) {
    const { createPetStartupVisual } = await import(moduleUrl.href)
    const body = fakeElement()
    const staticFrame = fakeElement()
    const canvas = fakeElement()
    const fallback = fakeElement()
    const visual = createPetStartupVisual({
      body,
      staticFrame,
      canvas,
      fallback,
      getViewport: () => viewport,
    })
    return { body, staticFrame, canvas, fallback, visual }
  }

  it('shows the static first frame while animation resources load', async () => {
    const { body, staticFrame, visual } = await createHarness()

    assert.equal(body.dataset.visualState, 'loading')
    assert.equal(body.dataset.staticFrame, 'pending')
    staticFrame.dispatch('load')
    assert.equal(body.dataset.visualState, 'loading')
    assert.equal(body.dataset.staticFrame, 'loaded')
    visual.destroy()
  })

  it('switches atomically to Canvas when every animation resource succeeds', async () => {
    const { body, staticFrame, visual } = await createHarness()

    staticFrame.dispatch('load')
    assert.equal(visual.markAnimationReady(), true)
    assert.equal(body.dataset.visualState, 'ready')
    assert.equal(body.dataset.staticFrame, 'loaded')
    visual.destroy()
  })

  it('uses Emoji error state when the static frame fails', async () => {
    const { body, staticFrame, visual } = await createHarness()

    staticFrame.dispatch('error')
    assert.equal(body.dataset.visualState, 'error')
    visual.destroy()
  })

  it('uses Emoji error state when animation preload fails', async () => {
    const { body, staticFrame, visual } = await createHarness()

    staticFrame.dispatch('load')
    assert.equal(visual.markAnimationError(), true)
    assert.equal(body.dataset.visualState, 'error')
    visual.destroy()
  })

  it('ignores a late static error after Canvas is ready', async () => {
    const { body, staticFrame, visual } = await createHarness()

    staticFrame.dispatch('load')
    visual.markAnimationReady()
    staticFrame.dispatch('error')
    assert.equal(body.dataset.visualState, 'ready')
    visual.destroy()
  })

  it('ignores all late callbacks and removes listeners after destroy', async () => {
    const { body, staticFrame, visual } = await createHarness()

    assert.equal(staticFrame.listenerCount(), 2)
    visual.destroy()
    assert.equal(staticFrame.listenerCount(), 0)
    staticFrame.dispatch('error')
    assert.equal(visual.markAnimationError(), false)
    assert.equal(visual.markAnimationReady(), false)
    assert.equal(body.dataset.visualState, 'loading')
  })

  it('recomputes the anchored static rectangle from the current viewport', async () => {
    const viewport = { width: 170, height: 170 }
    const { staticFrame, visual } = await createHarness(viewport)

    assert.deepEqual(
      {
        left: staticFrame.style.left,
        top: staticFrame.style.top,
        width: staticFrame.style.width,
        height: staticFrame.style.height,
      },
      { left: '34px', top: '62.56px', width: '102px', height: '102px' },
    )

    viewport.width = 255
    viewport.height = 255
    visual.resize()
    assert.deepEqual(
      {
        left: staticFrame.style.left,
        top: staticFrame.style.top,
        width: staticFrame.style.width,
        height: staticFrame.style.height,
      },
      { left: '51px', top: '93.84px', width: '153px', height: '153px' },
    )
    visual.destroy()
  })

  it('starts a fresh listener set for each page instance', async () => {
    const first = await createHarness()
    first.visual.destroy()
    const second = await createHarness()

    assert.equal(first.staticFrame.listenerCount(), 0)
    assert.equal(second.staticFrame.listenerCount(), 2)
    assert.equal(second.body.dataset.visualState, 'loading')
    second.visual.destroy()
  })
})
