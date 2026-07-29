const LAYER_NAMES = Object.freeze([
  'background',
  'ground',
  'objects',
  'characters',
  'effects',
  'interaction',
])

function clampResolution(value) {
  return Math.min(2, Math.max(0.1, Number.isFinite(value) ? value : 1))
}

function containerSize(container, width, height) {
  return {
    width: Number.isFinite(width) && width > 0 ? width : Math.max(1, container.clientWidth || 1),
    height: Number.isFinite(height) && height > 0 ? height : Math.max(1, container.clientHeight || 1),
  }
}

function textureRecords(manifest) {
  return {
    critical: [
    manifest.background,
    manifest.land?.level1,
    ...(manifest.crops?.wheat?.stages || []),
    ...(manifest.buildings?.sprinkler?.levels || []),
    ],
    optional: [
    manifest.pet?.idle,
    manifest.effects?.plant,
    manifest.effects?.harvest,
    manifest.ui?.recipeCookie,
    manifest.ui?.orderPaper,
    ],
  }
}

function assetUrl(manifest, src) {
  if (
    typeof manifest.skinId !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(manifest.skinId)
    || manifest.skinId === '.'
    || manifest.skinId === '..'
  ) {
    throw new Error('INVALID_FARM_SKIN_ID')
  }
  return new URL(
    `../../assets/farm/${manifest.skinId}/${src}`,
    import.meta.url,
  ).href
}

function applyRecord(sprite, record) {
  if (record.anchor) sprite.anchor?.set(record.anchor.x, record.anchor.y)
  if (record.logicalPosition) {
    sprite.position?.set(record.logicalPosition.x, record.logicalPosition.y)
  }
}

export function createFarmSceneAdapter({ PIXI, container, manifest, onIntent, now }) {
  if (!PIXI || !container || !manifest || typeof onIntent !== 'function') {
    throw new TypeError('PIXI, container, manifest and onIntent are required')
  }

  let app = null
  let mountPromise = null
  let destroyed = false
  let initialized = false
  let appDestroyed = false
  let paused = false
  let reducedMotion = false
  let generation = 0
  let layers = null
  let currentSnapshot = null
  let textures = {}
  let pendingResize = null
  let activeEffect = null

  function isCurrent(token) {
    return !destroyed && token === generation
  }

  function teardownApp() {
    if (!app || appDestroyed) return
    let renderer
    try {
      renderer = app.renderer
    } catch {
      return
    }
    if (!renderer) return
    appDestroyed = true
    let canvas
    try {
      canvas = renderer.canvas || app.canvas
    } catch {
      canvas = null
    }
    try {
      if (canvas?.parentNode === container) container.removeChild(canvas)
    } catch {
      // Cleanup remains best-effort when a partially initialized view is malformed.
    }
    try {
      app.destroy(true, { children: true, texture: false, textureSource: false })
    } catch {
      try {
        if (app.stage && !app.stage.destroyed) {
          app.stage.destroy({ children: true, texture: false, textureSource: false })
        }
      } catch {
        // Continue to the renderer even when plugin or stage cleanup fails.
      }
      try {
        renderer.destroy(true)
      } catch {
        // Cleanup failure must not replace the primary init or load failure.
      }
    }
    try {
      if (canvas?.parentNode === container) container.removeChild(canvas)
    } catch {
      // A plugin may already have detached the canvas.
    }
  }

  function syncTicker() {
    if (!app || !initialized || destroyed) return
    if (paused || reducedMotion) app.ticker.stop()
    else app.ticker.start()
  }

  function applyResize({ width, height, devicePixelRatio }) {
    const size = containerSize(container, width, height)
    app.renderer.resolution = clampResolution(devicePixelRatio)
    app.renderer.resize(size.width, size.height)
    const logicalWidth = manifest.logicalSize?.width || 1200
    const logicalHeight = manifest.logicalSize?.height || 720
    const scale = Math.min(size.width / logicalWidth, size.height / logicalHeight)
    app.stage.scale.set(scale)
    app.stage.position.set(
      (size.width - (logicalWidth * scale)) / 2,
      (size.height - (logicalHeight * scale)) / 2,
    )
  }

  function resize(width, height, devicePixelRatio) {
    if (destroyed) return
    pendingResize = { width, height, devicePixelRatio }
    if (app && initialized) applyResize(pendingResize)
  }

  function addSprite(layer, record) {
    if (!record?.src) return null
    const texture = textures[record.src]
    if (!texture) return null
    const sprite = new PIXI.Sprite(texture)
    applyRecord(sprite, record)
    layer.addChild(sprite)
    return sprite
  }

  function createLayers() {
    const created = {}
    for (const name of LAYER_NAMES) {
      const layer = new PIXI.Container()
      layer.label = name
      created[name] = layer
      app.stage.addChild(layer)
    }
    return created
  }

  function renderSlice() {
    addSprite(layers.background, manifest.background)
    addSprite(layers.ground, manifest.land?.level1)
    for (const record of manifest.crops?.wheat?.stages || []) {
      addSprite(layers.objects, record)
    }
    for (const record of manifest.buildings?.sprinkler?.levels || []) {
      addSprite(layers.objects, record)
    }
    addSprite(layers.characters, manifest.pet?.idle)
  }

  async function loadTextures(token) {
    const records = textureRecords(manifest)
    const loaded = {}
    for (const record of records.critical) {
      const texture = await PIXI.Assets.load(assetUrl(manifest, record.src))
      if (!isCurrent(token)) return null
      loaded[record.src] = texture
    }
    for (const record of records.optional) {
      try {
        const texture = await PIXI.Assets.load(assetUrl(manifest, record.src))
        if (!isCurrent(token)) return null
        loaded[record.src] = texture
      } catch {
        if (!isCurrent(token)) return null
        // Optional project art is omitted without replacing it with a concrete object.
      }
    }
    return loaded
  }

  function addIntentTarget(intent, { x, y, width = 132, height = 82 }) {
    const target = new PIXI.Container()
    target.eventMode = 'static'
    target.position.set(x, y)
    target.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height)
    target.on('pointertap', () => {
      if (!destroyed) onIntent(Object.freeze({ ...intent }))
    })
    layers.interaction.addChild(target)
  }

  function rebuildHitTargets(snapshot) {
    for (const child of layers.interaction.children || []) child.destroy?.()
    layers.interaction.children.length = 0
    for (const tile of snapshot?.tiles || []) {
      if (typeof tile.tileId !== 'string') continue
      addIntentTarget(
        { type: 'select-tile', tileId: tile.tileId },
        { x: 402 + (tile.col * 132), y: 307 + (tile.row * 82) },
      )
    }
    addIntentTarget({ type: 'open-processing' }, { x: 1010, y: 225, width: 180, height: 130 })
    addIntentTarget({ type: 'open-orders' }, { x: 1060, y: 365, width: 160, height: 150 })
    const birdId = snapshot?.bird?.visible ? snapshot.bird.birdId : null
    if (typeof birdId === 'string' && birdId.length > 0) {
      addIntentTarget({ type: 'claim-bird', birdId }, { x: 930, y: 160, width: 100, height: 100 })
    }
    addIntentTarget({ type: 'click-pet' }, { x: 1010, y: 560, width: 140, height: 140 })
  }

  async function mount() {
    if (destroyed) return
    if (mountPromise) return mountPromise
    const token = generation
    app = new PIXI.Application()
    mountPromise = (async () => {
      const initialSize = containerSize(container)
      const initialDpr = clampResolution(globalThis.devicePixelRatio)
      try {
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: initialDpr,
          width: initialSize.width,
          height: initialSize.height,
        })
      } catch (error) {
        teardownApp()
        if (destroyed) return
        throw error
      }
      initialized = true
      if (!isCurrent(token)) {
        teardownApp()
        return
      }
      layers = createLayers()
      let loadedTextures
      try {
        loadedTextures = await loadTextures(token)
      } catch (error) {
        if (destroyed) return
        teardownApp()
        layers = null
        throw error
      }
      if (!isCurrent(token) || !loadedTextures) return
      textures = loadedTextures
      renderSlice()
      container.appendChild(app.canvas)
      applyResize(pendingResize || {
        width: initialSize.width,
        height: initialSize.height,
        devicePixelRatio: initialDpr,
      })
      syncTicker()
      if (currentSnapshot) rebuildHitTargets(currentSnapshot)
    })()
    return mountPromise
  }

  function update(snapshot) {
    if (destroyed) return
    currentSnapshot = snapshot
    if (layers) rebuildHitTargets(snapshot)
  }

  function setPaused(value) {
    if (destroyed) return
    paused = value === true
    syncTicker()
  }

  function setReducedMotion(value) {
    if (destroyed) return
    reducedMotion = value === true
    syncTicker()
  }

  function playEffect(effect) {
    if (destroyed || !layers || !effect || typeof effect.type !== 'string') return
    const record = manifest.effects?.[effect.type]
    if (!record) return
    if (activeEffect) {
      layers.effects.removeChild(activeEffect)
      activeEffect.destroy()
    }
    activeEffect = addSprite(layers.effects, record)
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    generation += 1
    if (activeEffect && layers) {
      layers.effects.removeChild(activeEffect)
      activeEffect.destroy()
    }
    teardownApp()
    layers = null
    currentSnapshot = null
    textures = {}
    activeEffect = null
  }

  return Object.freeze({
    mount,
    update,
    resize,
    setPaused,
    setReducedMotion,
    playEffect,
    destroy,
  })
}
