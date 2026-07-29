import { validateFarmSceneManifest } from './farm-scene-manifest.mjs'
import { loadPixiRuntime } from './farm-pixi-runtime.js'

const CRITICAL_RECORDS = Object.freeze([
  ['background'],
  ['land', 'level1'],
  ['crops', 'wheat', 'stages', 0],
  ['crops', 'wheat', 'stages', 1],
  ['crops', 'wheat', 'stages', 2],
  ['crops', 'wheat', 'stages', 3],
  ['buildings', 'sprinkler', 'levels', 0],
  ['buildings', 'sprinkler', 'levels', 1],
  ['buildings', 'sprinkler', 'levels', 2],
])

const OPTIONAL_RECORDS = Object.freeze([
  ['pet', 'idle'],
  ['effects', 'plant'],
  ['effects', 'harvest'],
  ['ui', 'recipeCookie'],
  ['ui', 'orderPaper'],
])

function valueAt(source, path) {
  let value = source
  for (const segment of path) value = value?.[segment]
  return value
}

function keyFor(path) {
  return path.join('.')
}

function asError(error, fallbackMessage) {
  return error instanceof Error ? error : new Error(fallbackMessage, { cause: error })
}

async function canUseStatic(staticAvailable, backgroundSrc) {
  try {
    if (typeof staticAvailable === 'function') {
      return (await staticAvailable({ backgroundSrc })) === true
    }
    return staticAvailable === true
  } catch {
    return false
  }
}

async function fallback(error, staticAvailable, trustedBackgroundSrc) {
  const normalizedError = asError(error, 'FARM_SCENE_LOAD_FAILED')
  if (
    typeof trustedBackgroundSrc === 'string'
    && trustedBackgroundSrc.length > 0
    && await canUseStatic(staticAvailable, trustedBackgroundSrc)
  ) {
    return Object.freeze({
      mode: 'static',
      backgroundSrc: trustedBackgroundSrc,
      error: normalizedError,
    })
  }
  return Object.freeze({ mode: 'dom', error: normalizedError })
}

function resolveAssetUrl(manifestUrl, src) {
  const base = new URL('.', manifestUrl)
  const resolved = new URL(src, base)
  if (!resolved.href.startsWith(base.href)) {
    throw new Error('FARM_SCENE_ASSET_OUTSIDE_SKIN')
  }
  return resolved.href
}

export async function loadFarmScene({
  manifestUrl,
  importPixi = loadPixiRuntime,
  fetchJson,
  validateManifest = validateFarmSceneManifest,
  loadAssets,
  createAdapter,
  staticAvailable = false,
  trustedBackgroundSrc,
}) {
  let manifest
  try {
    manifest = await fetchJson(manifestUrl)
    const errors = validateManifest(manifest)
    if (!Array.isArray(errors) || errors.length > 0) {
      throw new Error(`INVALID_FARM_SCENE_MANIFEST:${(errors || []).join(',')}`)
    }
  } catch (error) {
    return fallback(error, staticAvailable, trustedBackgroundSrc)
  }

  let PIXI
  try {
    PIXI = await importPixi()
  } catch (error) {
    return fallback(error, staticAvailable, trustedBackgroundSrc)
  }

  const assetLoader = typeof loadAssets === 'function'
    ? loadAssets
    : (src => PIXI.Assets.load(src))

  try {
    for (const path of CRITICAL_RECORDS) {
      const key = keyFor(path)
      await assetLoader(
        resolveAssetUrl(manifestUrl, valueAt(manifest, path).src),
        Object.freeze({ critical: true, key }),
      )
    }
  } catch (error) {
    return fallback(error, staticAvailable, trustedBackgroundSrc)
  }

  const optionalFailures = []
  for (const path of OPTIONAL_RECORDS) {
    const key = keyFor(path)
    try {
      await assetLoader(
        resolveAssetUrl(manifestUrl, valueAt(manifest, path).src),
        Object.freeze({ critical: false, key }),
      )
    } catch {
      optionalFailures.push(key)
    }
  }

  const frozenFailures = Object.freeze(optionalFailures)
  const result = {
    mode: 'pixi',
    manifest,
    optionalFailures: frozenFailures,
  }
  if (typeof createAdapter === 'function') {
    let adapter
    try {
      adapter = createAdapter({ PIXI, manifest, optionalFailures: frozenFailures })
      await adapter.mount()
      result.adapter = adapter
    } catch (error) {
      try {
        adapter?.destroy?.()
      } catch {
        // Adapter cleanup is best-effort and never replaces the primary failure.
      }
      return fallback(error, staticAvailable, trustedBackgroundSrc)
    }
  }
  return Object.freeze(result)
}
