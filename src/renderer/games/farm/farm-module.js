import { EventBus } from '../../shared/event-bus.js'
import { PetState } from '../../shared/pet-state.js'
import { createFarmService } from './farm-service.js'
import { mountFarm } from './farm-ui.js'
import { createFarmSceneAdapter } from './farm-scene-adapter.js'
import { loadFarmScene } from './farm-scene-loader.js'
import { createFarmSceneStatic } from './farm-scene-static.js'

const STYLE_ID = 'farm-module-style'

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const link = document.createElement('link')
  link.id = STYLE_ID
  link.rel = 'stylesheet'
  link.href = new URL('./farm.css', import.meta.url).href
  document.head.appendChild(link)
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
  return Object.freeze({
    manifestUrl,
    trustedBackgroundSrc,
    loadScene: loadFarmScene,
    createAdapter: createFarmSceneAdapter,
    createStatic: createFarmSceneStatic,
    fetchJson: async url => {
      const response = await fetchFn(url)
      if (!response || (response.ok === false && response.status !== 0)) {
        throw new Error(`FARM_SCENE_MANIFEST_HTTP_${response?.status ?? 'FAILED'}`)
      }
      return response.json()
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
