import { layoutFarmScene } from './farm-scene-layout.mjs'
import {
  createBirdObject,
  createBuildingObject,
  createCropObject,
  createLandObject,
  createPetObject,
} from './farm-scene-objects.js'

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

function assetUrl(manifest, src) {
  if (
    typeof manifest.skinId !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(manifest.skinId)
    || manifest.skinId === '.'
    || manifest.skinId === '..'
  ) {
    throw new Error('INVALID_FARM_SKIN_ID')
  }
  if (typeof src !== 'string' || src.length === 0) throw new Error('INVALID_FARM_ASSET_PATH')
  const root = new URL(`../../assets/farm/${manifest.skinId}/`, import.meta.url)
  const resolved = new URL(src, root)
  if (!resolved.href.startsWith(root.href)) throw new Error('INVALID_FARM_ASSET_PATH')
  return resolved.href
}

function applyRecord(sprite, record) {
  if (record.anchor) sprite.anchor?.set(record.anchor.x, record.anchor.y)
  if (record.logicalPosition) {
    sprite.position?.set(record.logicalPosition.x, record.logicalPosition.y)
  }
}

function observed(promise) {
  promise.catch(() => {})
  return promise
}

function landRecordFor(manifest, tile) {
  if (tile.unlockState === 'eligible') return manifest.land?.eligible
  if (tile.occupancy === 'locked' || tile.unlockState === 'locked') return manifest.land?.locked
  return manifest.land?.[`level${tile.landLevel}`]
}

function cropRecordFor(manifest, tile) {
  if (!tile.cropId || !Number.isInteger(tile.cropStage)) return null
  return manifest.crops?.[tile.cropId]?.stages?.[tile.cropStage - 1] || null
}

function buildingRecordsFor(manifest, tile) {
  if (!tile.buildingId || !tile.buildingType || !Number.isInteger(tile.buildingLevel)) return null
  const family = manifest.buildings?.[tile.buildingType]
  const base = family?.levels?.[tile.buildingLevel - 1]
  return base ? { base, overlay: family.workOverlay || null } : null
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
  let snapshotRevision = 0
  let layers = null
  let currentSnapshot = null
  let pendingResize = null
  let activeEffect = null
  let backgroundSprite = null
  let fallbackTexture = null

  const texturePromises = new Map()
  const landObjects = new Map()
  const cropObjects = new Map()
  const buildingObjects = new Map()
  let petObject = null
  let birdObject = null

  function isCurrent(token) {
    return !destroyed && token === generation
  }

  function isCurrentRevision(token, revision) {
    return isCurrent(token) && revision === snapshotRevision
  }

  function destroyObject(layer, object) {
    if (!object) return
    try {
      layer?.removeChild?.(object.displayObject)
    } catch {
      // The renderer may already have detached this object.
    }
    try {
      object.destroy()
    } catch {
      // Object cleanup is best-effort and never replaces the scene failure cause.
    }
  }

  function destroySceneObjects() {
    for (const object of landObjects.values()) destroyObject(layers?.ground, object)
    for (const object of cropObjects.values()) destroyObject(layers?.objects, object)
    for (const object of buildingObjects.values()) destroyObject(layers?.objects, object)
    landObjects.clear()
    cropObjects.clear()
    buildingObjects.clear()
    destroyObject(layers?.characters, petObject)
    destroyObject(layers?.characters, birdObject)
    petObject = null
    birdObject = null
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

  function failScene(error) {
    destroySceneObjects()
    teardownApp()
    layers = null
    throw error
  }

  function syncTicker() {
    if (!app || !initialized || destroyed || appDestroyed) return
    if (paused || reducedMotion) app.ticker.stop()
    else app.ticker.start()
  }

  function syncObjectMotion(object) {
    object.setPaused(paused)
    object.setReducedMotion(reducedMotion)
  }

  function syncAllObjectMotion() {
    for (const collection of [landObjects, cropObjects, buildingObjects]) {
      for (const object of collection.values()) syncObjectMotion(object)
    }
    if (petObject) syncObjectMotion(petObject)
    if (birdObject) syncObjectMotion(birdObject)
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
    if (app && initialized && !appDestroyed) applyResize(pendingResize)
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

  function loadTexture(record) {
    if (!record?.src) return Promise.reject(new Error('MISSING_FARM_SCENE_TEXTURE'))
    if (!texturePromises.has(record.src)) {
      let promise
      try {
        promise = Promise.resolve(PIXI.Assets.load(assetUrl(manifest, record.src)))
      } catch (error) {
        promise = Promise.reject(error)
      }
      texturePromises.set(record.src, promise)
    }
    return texturePromises.get(record.src)
  }

  async function loadOptional(record) {
    if (!record) return fallbackTexture
    try {
      return await loadTexture(record)
    } catch {
      return fallbackTexture
    }
  }

  async function loadOptionalObject(record) {
    try {
      return { texture: await loadTexture(record), fallback: false }
    } catch {
      return { texture: fallbackTexture, fallback: true }
    }
  }

  async function loadOptionalFrames(records) {
    if (records.length === 0) {
      return { frames: [fallbackTexture], fallback: true }
    }
    try {
      return { frames: await Promise.all(records.map(loadTexture)), fallback: false }
    } catch {
      return { frames: [fallbackTexture], fallback: true }
    }
  }

  function addIntentTarget(intent, { x, y, width = 132, height = 82 }) {
    const target = new PIXI.Container()
    target.eventMode = 'static'
    target.position.set(x, y)
    target.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height)
    target.on('pointertap', () => {
      if (!destroyed && !appDestroyed) onIntent(Object.freeze({ ...intent }))
    })
    layers.interaction.addChild(target)
  }

  function rebuildHitTargets(layout) {
    for (const child of layers.interaction.children || []) child.destroy?.()
    layers.interaction.children.length = 0
    for (const tile of layout.tiles) {
      addIntentTarget(
        { type: 'select-tile', tileId: tile.tileId },
        {
          x: tile.center.x,
          y: tile.center.y,
          width: tile.hitArea.width,
          height: tile.hitArea.height,
        },
      )
    }
    addIntentTarget(
      { type: 'open-processing' },
      { x: layout.processing.x, y: layout.processing.y, width: 180, height: 130 },
    )
    addIntentTarget(
      { type: 'open-orders' },
      { x: layout.orders.x, y: layout.orders.y, width: 160, height: 150 },
    )
    if (layout.bird.visible && layout.bird.birdId) {
      addIntentTarget(
        { type: 'claim-bird', birdId: layout.bird.birdId },
        { x: layout.bird.x, y: layout.bird.y, width: 100, height: 100 },
      )
    }
    addIntentTarget(
      { type: 'click-pet' },
      { x: layout.pet.x, y: layout.pet.y, width: 140, height: 140 },
    )
  }

  function reconcileMap({ map, desired, layer, factory }) {
    const desiredKeys = new Set(desired.map(entry => entry.key))
    for (const [key, object] of map) {
      if (desiredKeys.has(key)) continue
      destroyObject(layer, object)
      map.delete(key)
    }
    for (const entry of desired) {
      let object = map.get(entry.key)
      if (object) {
        object.update(entry.record)
      } else {
        object = factory({
          PIXI,
          ticker: app.ticker,
          fallbackTexture,
          record: entry.record,
        })
        map.set(entry.key, object)
        layer.addChild(object.displayObject)
      }
      syncObjectMotion(object)
      object.displayObject.zIndex = object.displayObject.sortY
    }
    layer.sortableChildren = true
    layer.children.sort((left, right) => (left.sortY ?? 0) - (right.sortY ?? 0))
  }

  async function prepareSnapshot(layout) {
    const lands = await Promise.all(layout.tiles.map(async tile => {
      const asset = landRecordFor(manifest, tile)
      if (!asset) throw new Error(`MISSING_FARM_LAND_TEXTURE:${tile.tileId}`)
      const texture = await loadTexture(asset)
      return {
        key: tile.tileId,
        record: {
          texture,
          anchor: asset.anchor,
          x: tile.center.x,
          y: tile.center.y,
          sortY: tile.sortY,
          visible: true,
        },
      }
    }))

    const crops = await Promise.all(layout.tiles.flatMap(tile => {
      const asset = cropRecordFor(manifest, tile)
      if (!asset) return []
      return [loadOptionalObject(asset).then(loaded => ({
        key: tile.tileId,
        record: {
          texture: loaded.texture,
          anchor: loaded.fallback
            ? manifest.fallbacks.object.anchor
            : asset.anchor || manifest.fallbacks.object.anchor,
          x: tile.center.x,
          y: tile.center.y,
          sortY: tile.sortY + 1,
          visible: true,
        },
      }))]
    }))

    const buildings = await Promise.all(layout.tiles.flatMap(tile => {
      const assets = buildingRecordsFor(manifest, tile)
      if (!assets) return []
      return [Promise.all([
        loadOptionalObject(assets.base),
        assets.overlay
          ? loadTexture(assets.overlay).catch(() => null)
          : Promise.resolve(null),
      ]).then(([loadedBase, overlayTexture]) => ({
        key: tile.buildingId,
        record: {
          texture: loadedBase.texture,
          overlayTexture,
          anchor: loadedBase.fallback
            ? manifest.fallbacks.object.anchor
            : assets.base.anchor || manifest.fallbacks.object.anchor,
          overlayAnchor: assets.overlay?.anchor || assets.base.anchor,
          x: tile.center.x,
          y: tile.center.y,
          sortY: tile.sortY + 2,
          visible: true,
          working: tile.buildingWorking,
        },
      }))]
    }))

    let pet = null
    if (layout.pet.visible) {
      const frameRecords = manifest.pet?.idleFrames?.length
        ? manifest.pet.idleFrames
        : [manifest.pet?.idle].filter(Boolean)
      const loaded = await loadOptionalFrames(frameRecords)
      const frames = loaded.frames
      pet = {
        texture: frames[0] || fallbackTexture,
        frames,
        frameDurationMs: frameRecords[0]?.durationMs,
        anchor: loaded.fallback
          ? manifest.fallbacks.object.anchor
          : frameRecords[0]?.anchor || manifest.fallbacks.object.anchor,
        x: layout.pet.x,
        y: layout.pet.y,
        sortY: layout.pet.sortY,
        visible: true,
      }
    }

    let bird = null
    if (layout.bird.visible && layout.bird.birdId) {
      const frameRecords = manifest.bird?.frames || []
      const loaded = await loadOptionalFrames(frameRecords)
      const frames = loaded.frames
      bird = {
        texture: frames[0] || fallbackTexture,
        frames,
        frameDurationMs: frameRecords[0]?.durationMs,
        anchor: loaded.fallback
          ? manifest.fallbacks.object.anchor
          : frameRecords[0]?.anchor || manifest.fallbacks.object.anchor,
        x: layout.bird.x,
        y: layout.bird.y,
        sortY: layout.bird.sortY,
        visible: true,
      }
    }
    return { lands, crops, buildings, pet, bird }
  }

  async function reconcileSnapshot(snapshot, token, revision) {
    const layout = layoutFarmScene(snapshot, manifest.logicalSize, manifest.scene)
    let prepared
    try {
      prepared = await prepareSnapshot(layout)
    } catch (error) {
      if (!isCurrentRevision(token, revision)) return
      failScene(error)
    }
    if (!isCurrentRevision(token, revision) || !layers) return

    reconcileMap({
      map: landObjects,
      desired: prepared.lands,
      layer: layers.ground,
      factory: createLandObject,
    })
    reconcileMap({
      map: cropObjects,
      desired: prepared.crops,
      layer: layers.objects,
      factory: createCropObject,
    })
    reconcileMap({
      map: buildingObjects,
      desired: prepared.buildings,
      layer: layers.objects,
      factory: createBuildingObject,
    })

    if (prepared.pet) {
      if (petObject) petObject.update(prepared.pet)
      else {
        petObject = createPetObject({
          PIXI,
          ticker: app.ticker,
          fallbackTexture,
          record: prepared.pet,
        })
        layers.characters.addChild(petObject.displayObject)
      }
      syncObjectMotion(petObject)
    } else if (petObject) {
      destroyObject(layers.characters, petObject)
      petObject = null
    }

    if (prepared.bird) {
      if (birdObject) birdObject.update(prepared.bird)
      else {
        birdObject = createBirdObject({
          PIXI,
          ticker: app.ticker,
          fallbackTexture,
          record: prepared.bird,
        })
        layers.characters.addChild(birdObject.displayObject)
      }
      syncObjectMotion(birdObject)
    } else if (birdObject) {
      destroyObject(layers.characters, birdObject)
      birdObject = null
    }
    rebuildHitTargets(layout)
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
      try {
        const backgroundTexture = await loadTexture(manifest.background)
        const level1Texture = await loadTexture(manifest.land?.level1)
        const loadedFallback = await loadTexture(manifest.fallbacks?.object)
        if (!isCurrent(token)) return
        fallbackTexture = loadedFallback
        backgroundSprite = new PIXI.Sprite(backgroundTexture)
        applyRecord(backgroundSprite, manifest.background)
        layers.background.addChild(backgroundSprite)
        // Keep the verified base-land texture warm in the shared cache.
        void level1Texture
      } catch (error) {
        if (destroyed) return
        teardownApp()
        layers = null
        throw error
      }
      if (!isCurrent(token)) return
      container.appendChild(app.canvas)
      applyResize(pendingResize || {
        width: initialSize.width,
        height: initialSize.height,
        devicePixelRatio: initialDpr,
      })
      syncTicker()
      if (currentSnapshot) {
        await reconcileSnapshot(currentSnapshot, token, snapshotRevision)
      }
    })()
    return mountPromise
  }

  function update(snapshot) {
    if (destroyed || appDestroyed) return Promise.resolve()
    currentSnapshot = snapshot
    snapshotRevision += 1
    const revision = snapshotRevision
    const token = generation
    const operation = layers
      ? reconcileSnapshot(snapshot, token, revision)
      : Promise.resolve()
    return observed(operation)
  }

  function setPaused(value) {
    if (destroyed) return
    paused = value === true
    syncTicker()
    syncAllObjectMotion()
  }

  function setReducedMotion(value) {
    if (destroyed) return
    reducedMotion = value === true
    syncTicker()
    syncAllObjectMotion()
  }

  function playEffect(effect) {
    if (
      destroyed
      || appDestroyed
      || !layers
      || !effect
      || typeof effect.type !== 'string'
    ) {
      return Promise.resolve()
    }
    const record = manifest.effects?.[effect.type]
    if (!record) return Promise.resolve()
    const token = generation
    const operation = loadOptional(record).then(texture => {
      if (!isCurrent(token) || !layers) return
      if (activeEffect) {
        layers.effects.removeChild(activeEffect)
        activeEffect.destroy({
          children: true,
          texture: false,
          textureSource: false,
        })
      }
      activeEffect = new PIXI.Sprite(texture)
      applyRecord(activeEffect, record)
      layers.effects.addChild(activeEffect)
    })
    return observed(operation)
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    generation += 1
    snapshotRevision += 1
    destroySceneObjects()
    if (activeEffect && layers) {
      try {
        layers.effects.removeChild(activeEffect)
      } catch {
        // Continue cleanup if the effect was already detached or malformed.
      }
      try {
        activeEffect.destroy({
          children: true,
          texture: false,
          textureSource: false,
        })
      } catch {
        // Effect cleanup must not block renderer and canvas teardown.
      }
    }
    teardownApp()
    layers = null
    currentSnapshot = null
    texturePromises.clear()
    activeEffect = null
    backgroundSprite = null
    fallbackTexture = null
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
