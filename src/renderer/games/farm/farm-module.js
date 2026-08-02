import { EventBus } from '../../shared/event-bus.js'
import { PetState } from '../../shared/pet-state.js'
import { createFarmService } from './farm-service.js'
import { mountFarm } from './farm-ui.js'
import { createFarmSceneAdapter } from './farm-scene-adapter.js'
import { loadFarmScene } from './farm-scene-loader.js'
import { createFarmSceneStatic } from './farm-scene-static.js'
import { buildFarmUiSkin } from './farm-ui-skin.mjs'

const STYLES = Object.freeze([
  ['farm-module-style', './farm.css'],
  ['farm-workshop-style', './farm-workshop.css'],
  ['farm-orders-style', './farm-orders.css'],
])

function ensureStyle() {
  for (const [id, path] of STYLES) {
    if (document.getElementById(id)) continue
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = new URL(path, import.meta.url).href
    document.head.appendChild(link)
  }
}

export function createFarmSceneRuntime({
  fetchFn = globalThis.fetch,
  ImageClass = globalThis.Image,
  ResizeObserverClass = globalThis.ResizeObserver,
  matchMediaFn = globalThis.matchMedia?.bind(globalThis),
} = {}) {
  const manifestUrl = new URL(
    '../../assets/farm/bright-homestead/farm.json',
    import.meta.url,
  ).href
  const trustedBackgroundSrc = new URL(
    '../../assets/farm/bright-homestead/background/base.webp',
    import.meta.url,
  ).href
  const jsonCache = new Map()
  let uiSkinPromise = null
  const fetchJson = url => {
    if (!jsonCache.has(url)) {
      jsonCache.set(url, Promise.resolve().then(async () => {
        const response = await fetchFn(url)
        if (!response || (response.ok === false && response.status !== 0)) {
          throw new Error(`FARM_SCENE_MANIFEST_HTTP_${response?.status ?? 'FAILED'}`)
        }
        return response.json()
      }))
    }
    return jsonCache.get(url)
  }
  return Object.freeze({
    manifestUrl,
    trustedBackgroundSrc,
    loadScene: loadFarmScene,
    createAdapter: createFarmSceneAdapter,
    createStatic: createFarmSceneStatic,
    fetchJson,
    loadUiSkin: () => {
      uiSkinPromise ||= fetchJson(manifestUrl).then(manifest => buildFarmUiSkin(manifest, manifestUrl))
      return uiSkinPromise
    },
    staticAvailable: ({ backgroundSrc }) => new Promise(resolve => {
      if (!ImageClass || backgroundSrc !== trustedBackgroundSrc) {
        resolve(false)
        return
      }
      const image = new ImageClass()
      image.onload = () => resolve(true)
      image.onerror = () => resolve(false)
      image.src = backgroundSrc
    }),
    getDevicePixelRatio: () => globalThis.devicePixelRatio || 1,
    createResizeObserver: callback => (
      ResizeObserverClass ? new ResizeObserverClass(callback) : null
    ),
    reducedMotionMedia: matchMediaFn?.('(prefers-reduced-motion: reduce)') || null,
  })
}

export async function mount(container, { onNavigateWarehouse } = {}) {
  ensureStyle()
  await PetState.init()
  const service = createFarmService({
    petState: PetState,
    eventBus: EventBus,
    now: () => new Date().toISOString(),
    random: Math.random,
  })
  await service.initialize()
  await service.settle()
  return mountFarm(container, {
    service,
    petState: PetState,
    eventBus: EventBus,
    onNavigateWarehouse,
    sceneRuntime: createFarmSceneRuntime(),
  })
}
