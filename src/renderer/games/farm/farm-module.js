import { EventBus } from '../../shared/event-bus.js'
import { PetState } from '../../shared/pet-state.js'
import { createFarmService } from './farm-service.js'
import { mountFarm } from './farm-ui.js'

const STYLE_ID = 'farm-module-style'

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const link = document.createElement('link')
  link.id = STYLE_ID
  link.rel = 'stylesheet'
  link.href = new URL('./farm.css', import.meta.url).href
  document.head.appendChild(link)
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
  })
}
