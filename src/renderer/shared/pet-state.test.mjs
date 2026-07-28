import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

import { EVENTS } from './events.js'
import { setEventBusDebug } from './event-bus.js'

setEventBusDebug(false)

let moduleSequence = 0

async function createPetState(initialState = {}) {
  const savedSnapshots = []
  globalThis.window = {
    electronAPI: {
      getPetState: async () => initialState,
      setPetState: async (snapshot) => {
        savedSnapshots.push(structuredClone(snapshot))
      },
    },
  }
  const { PetState } = await import(`./pet-state.js?test=${moduleSequence++}`)
  await PetState.init()
  return { PetState, savedSnapshots }
}

test('setMany exposes every new value before emitting in field order', async () => {
  const { PetState } = await createPetState({
    coins: 1,
    inventory: {},
  })
  const seen = []
  const unsubscribe = PetState.subscribe(
    EVENTS.PET_STATE_CHANGED,
    ({ key }) => {
      seen.push([key, PetState.get('coins'), PetState.get('inventory')])
    },
  )

  try {
    PetState.setMany({ coins: 12, inventory: { 'crop:wheat': 4 } })

    assert.deepEqual(seen, [
      ['coins', 12, { 'crop:wheat': 4 }],
      ['inventory', 12, { 'crop:wheat': 4 }],
    ])
  } finally {
    unsubscribe()
    await PetState.flush()
  }
})

test('setMany emits mapped event before generic event for each field', async () => {
  const { PetState } = await createPetState({ satiety: 100, coins: 1 })
  const seen = []
  const unsubscribeMapped = PetState.subscribe(
    EVENTS.PET_SATIETY_CHANGED,
    ({ value }) => seen.push(['mapped', value, PetState.get('coins')]),
  )
  const unsubscribeGeneric = PetState.subscribe(
    EVENTS.PET_STATE_CHANGED,
    ({ key }) => seen.push(['generic', key, PetState.get('coins')]),
  )

  try {
    PetState.setMany({ satiety: 80, coins: 9 })

    assert.deepEqual(seen, [
      ['mapped', 80, 9],
      ['generic', 'satiety', 9],
      ['generic', 'coins', 9],
    ])
  } finally {
    unsubscribeMapped()
    unsubscribeGeneric()
    await PetState.flush()
  }
})

test('setMany emits unchanged fields and schedules one persisted snapshot', async () => {
  const { PetState, savedSnapshots } = await createPetState({
    coins: 5,
    inventory: {},
  })
  const keys = []
  const unsubscribe = PetState.subscribe(
    EVENTS.PET_STATE_CHANGED,
    ({ key }) => keys.push(key),
  )

  try {
    PetState.setMany({ coins: 5, inventory: { 'seed:wheat': 2 } })
    await new Promise((resolve) => setTimeout(resolve, 550))

    assert.deepEqual(keys, ['coins', 'inventory'])
    assert.equal(savedSnapshots.length, 1)
    assert.deepEqual(savedSnapshots[0].inventory, { 'seed:wheat': 2 })
  } finally {
    unsubscribe()
    await PetState.flush()
  }
})

test('setMany isolates stored values, reads, and event payloads from mutation', async () => {
  const { PetState } = await createPetState({})
  const input = { 'crop:wheat': 4 }
  let payload
  const unsubscribe = PetState.subscribe(
    EVENTS.PET_STATE_CHANGED,
    (event) => {
      if (event.key === 'inventory') payload = event.value
    },
  )

  try {
    PetState.setMany({ inventory: input })
    input['crop:wheat'] = 99
    payload['crop:wheat'] = 88
    const read = PetState.get('inventory')
    read['crop:wheat'] = 77

    assert.deepEqual(PetState.get('inventory'), { 'crop:wheat': 4 })
  } finally {
    unsubscribe()
    await PetState.flush()
  }
})

test('setMany rejects empty or non-plain update containers', async () => {
  const { PetState } = await createPetState({})

  assert.throws(() => PetState.setMany(), TypeError)
  assert.throws(() => PetState.setMany(null), TypeError)
  assert.throws(() => PetState.setMany([]), TypeError)
  assert.throws(() => PetState.setMany({}), TypeError)
})

test('init migrates legacy inventory and persists the complete migrated snapshot', async () => {
  const initialState = {
    level: 7,
    coins: 123,
    settings: { showTooltip: false },
    foodInventory: [{ id: 'milk', count: 2 }],
  }
  const { PetState, savedSnapshots } = await createPetState(initialState)

  assert.deepEqual(PetState.get('inventory'), { 'food:milk': 2 })
  assert.equal(PetState.get('inventoryMigrationVersion'), 1)

  await PetState.flush()

  assert.equal(savedSnapshots.length, 1)
  assert.deepEqual(savedSnapshots[0], {
    level: 7,
    coins: 123,
    settings: { showTooltip: false },
    inventory: { 'food:milk': 2 },
    inventoryMigrationVersion: 1,
  })
})

test('store defaults create universal inventory fields for a new save', async () => {
  const source = await readFile(
    new URL('../../main/storage/store.js', import.meta.url),
    'utf8',
  )
  const writes = []
  const fakeFs = {
    access: async () => {
      throw new Error('missing')
    },
    writeFile: async (...args) => {
      writes.push(args)
    },
  }
  const module = { exports: {} }
  const context = {
    module,
    exports: module.exports,
    console,
    require(specifier) {
      if (specifier === 'fs') return { promises: fakeFs }
      if (specifier === 'path') {
        return { join: (...parts) => parts.join('/') }
      }
      if (specifier === 'electron') {
        return { app: { getPath: () => '/mock-user-data' } }
      }
      throw new Error(`Unexpected require: ${specifier}`)
    },
  }

  vm.runInNewContext(source, context, { filename: 'store.js' })
  await module.exports.initStore()

  assert.equal(writes.length, 1)
  const persisted = JSON.parse(writes[0][1])
  assert.deepEqual(persisted.inventory, {})
  assert.equal(persisted.inventoryMigrationVersion, 0)
  assert.equal(Object.hasOwn(persisted, 'foodInventory'), false)
})

test('events expose the six approved farm names and remove old placeholders', () => {
  assert.deepEqual(
    {
      FARM_STATE_CHANGED: EVENTS.FARM_STATE_CHANGED,
      FARM_CROP_HARVESTED: EVENTS.FARM_CROP_HARVESTED,
      FARM_PROCESSING_COMPLETED: EVENTS.FARM_PROCESSING_COMPLETED,
      FARM_ORDER_COMPLETED: EVENTS.FARM_ORDER_COMPLETED,
      FARM_ORDER_READY: EVENTS.FARM_ORDER_READY,
      FARM_BIRD_REWARDED: EVENTS.FARM_BIRD_REWARDED,
    },
    {
      FARM_STATE_CHANGED: 'farm:state:changed',
      FARM_CROP_HARVESTED: 'farm:crop:harvested',
      FARM_PROCESSING_COMPLETED: 'farm:processing:completed',
      FARM_ORDER_COMPLETED: 'farm:order:completed',
      FARM_ORDER_READY: 'farm:order:ready',
      FARM_BIRD_REWARDED: 'farm:bird:rewarded',
    },
  )
  assert.equal('GAME_FARM_HARVEST' in EVENTS, false)
  assert.equal('GAME_FARM_FOOD_SYNTHESIZED' in EVENTS, false)
})
