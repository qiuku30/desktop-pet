function validTexture(texture) {
  return texture ?? null
}

function textureOrFallback(record, fallbackTexture) {
  return validTexture(record?.texture) || fallbackTexture
}

function copyFrames(record, fallbackTexture) {
  const frames = Array.isArray(record?.frames)
    ? record.frames.filter(Boolean)
    : []
  if (frames.length > 0) return [...frames]
  return [textureOrFallback(record, fallbackTexture)]
}

function applyAnchor(sprite, anchor) {
  if (
    anchor
    && Number.isFinite(anchor.x)
    && Number.isFinite(anchor.y)
  ) {
    sprite.anchor?.set(anchor.x, anchor.y)
  }
}

function createObject(context, kind) {
  const {
    PIXI,
    ticker,
    fallbackTexture,
  } = context
  if (!PIXI?.Container || !PIXI?.Sprite || !fallbackTexture) {
    throw new TypeError('PIXI, ticker and fallbackTexture are required')
  }

  const container = new PIXI.Container()
  const sprite = new PIXI.Sprite(fallbackTexture)
  container.addChild(sprite)
  const overlay = kind === 'building' ? new PIXI.Sprite(PIXI.Texture?.EMPTY || null) : null
  if (overlay) container.addChild(overlay)

  let destroyed = false
  let paused = false
  let reducedMotion = false
  let working = false
  let frames = [fallbackTexture]
  let frameDurationMs = 500
  let frameIndex = 0
  let elapsedMs = 0
  let phase = 0

  function stopAtRest() {
    if (overlay) overlay.rotation = 0
  }

  function onTick(tick = {}) {
    if (destroyed || paused || reducedMotion) return
    const deltaMS = Number.isFinite(tick.deltaMS) ? tick.deltaMS : 16
    if ((kind === 'pet' || kind === 'bird') && frames.length > 1) {
      elapsedMs += deltaMS
      while (elapsedMs >= frameDurationMs) {
        elapsedMs -= frameDurationMs
        frameIndex = (frameIndex + 1) % frames.length
      }
      sprite.texture = frames[frameIndex]
    }
    if (kind === 'building' && working && overlay?.visible) {
      phase += deltaMS / 500
      overlay.rotation = Math.sin(phase) * 0.025
    }
  }

  if (kind === 'building' || kind === 'pet' || kind === 'bird') ticker?.add?.(onTick)

  function update(record = {}) {
    if (destroyed) return
    frames = copyFrames(record, fallbackTexture)
    frameDurationMs = Number.isFinite(record.frameDurationMs) && record.frameDurationMs > 0
      ? record.frameDurationMs
      : 500
    frameIndex = Math.min(frameIndex, frames.length - 1)
    sprite.texture = frames[frameIndex] || fallbackTexture
    applyAnchor(sprite, record.anchor)
    container.position?.set(record.x ?? 0, record.y ?? 0)
    container.visible = record.visible !== false
    container.sortY = Number.isFinite(record.sortY) ? record.sortY : (record.y ?? 0)

    if (overlay) {
      if (record.overlayTexture) {
        overlay.texture = record.overlayTexture
        applyAnchor(overlay, record.overlayAnchor || record.anchor)
      }
      working = record.working === true
      overlay.visible = working && Boolean(record.overlayTexture)
      if (!working) overlay.rotation = 0
    }
    if (reducedMotion) stopAtRest()
  }

  function setPaused(value) {
    if (destroyed) return
    paused = value === true
  }

  function setReducedMotion(value) {
    if (destroyed) return
    reducedMotion = value === true
    if (reducedMotion) stopAtRest()
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    ticker?.remove?.(onTick)
    container.destroy({
      children: true,
      texture: false,
      textureSource: false,
    })
  }

  update(context.record)
  return Object.freeze({
    displayObject: container,
    update,
    setPaused,
    setReducedMotion,
    destroy,
  })
}

export function createLandObject(context) {
  return createObject(context, 'land')
}

export function createCropObject(context) {
  return createObject(context, 'crop')
}

export function createBuildingObject(context) {
  return createObject(context, 'building')
}

export function createPetObject(context) {
  return createObject(context, 'pet')
}

export function createBirdObject(context) {
  return createObject(context, 'bird')
}
