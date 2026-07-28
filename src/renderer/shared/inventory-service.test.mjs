import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeInventory,
  getItemCount,
  canRemoveItems,
  addItems,
  removeItems,
  migrateLegacyFoodInventory,
} from './inventory-service.js'

test('normalizes inventory by keeping only positive integer counts', () => {
  assert.deepEqual(
    normalizeInventory({
      a: 2,
      b: -1,
      c: 1.5,
      d: Number.NaN,
      e: 0,
      f: Number.POSITIVE_INFINITY,
    }),
    { a: 2 },
  )
  assert.deepEqual(normalizeInventory(null), {})
  assert.deepEqual(normalizeInventory([]), {})
})

test('removeItems is atomic when any requirement is missing', () => {
  const inventory = { a: 3, b: 1 }

  assert.deepEqual(removeItems(inventory, { a: 2, b: 2 }), {
    ok: false,
    inventory,
    missing: { b: 1 },
  })
  assert.deepEqual(inventory, { a: 3, b: 1 })
})

test('adds and removes items without mutating input', () => {
  const original = { a: 2 }
  const added = addItems(original, { a: 1, b: 2 })

  assert.deepEqual(added, { a: 3, b: 2 })
  assert.deepEqual(original, { a: 2 })
  assert.equal(getItemCount(added, 'b'), 2)
  assert.equal(canRemoveItems(added, { a: 3, b: 2 }), true)

  assert.deepEqual(removeItems(added, { a: 3 }), {
    ok: true,
    inventory: { b: 2 },
    missing: {},
  })
  assert.deepEqual(added, { a: 3, b: 2 })
})

test('addItems rejects unsafe or non-finite totals without mutating input', () => {
  const safeBoundary = { a: Number.MAX_SAFE_INTEGER }
  const finiteInputs = { a: Number.MAX_VALUE }

  assert.throws(
    () => addItems(safeBoundary, { a: 1 }),
    RangeError,
  )
  assert.throws(
    () => addItems(finiteInputs, { a: Number.MAX_VALUE }),
    RangeError,
  )
  assert.deepEqual(safeBoundary, { a: Number.MAX_SAFE_INTEGER })
  assert.deepEqual(finiteInputs, { a: Number.MAX_VALUE })
})

test('addItems fails atomically when a later addition would overflow', () => {
  const inventory = { a: 1, b: Number.MAX_SAFE_INTEGER }

  assert.throws(
    () => addItems(inventory, { a: 2, b: 1 }),
    RangeError,
  )
  assert.deepEqual(inventory, { a: 1, b: Number.MAX_SAFE_INTEGER })
})

test('migrates mapped legacy food by merging with existing inventory', () => {
  const oldState = {
    inventory: { 'food:apple': 3, 'crop:wheat': 4 },
    foodInventory: [
      { id: 'apple', count: 2 },
      { id: 'cake', count: 1 },
      { id: 'fish', count: 2 },
      { id: 'milk', count: 3 },
      { id: 'cookie', count: 4 },
      { id: 'apple', count: 0 },
    ],
  }

  const result = migrateLegacyFoodInventory(oldState)

  assert.equal(result.migrated, true)
  assert.deepEqual(result.state.inventory, {
    'food:apple': 5,
    'crop:wheat': 4,
    'food:cake': 1,
    'food:fish': 2,
    'food:milk': 3,
    'food:cookie': 4,
  })
  assert.equal(result.state.inventoryMigrationVersion, 1)
  assert.equal(Object.hasOwn(result.state, 'foodInventory'), false)
  assert.equal(oldState.inventoryMigrationVersion, undefined)
  assert.deepEqual(oldState.inventory, { 'food:apple': 3, 'crop:wheat': 4 })
})

test('preserves unknown legacy food under a legacy namespace and warns', () => {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args)

  try {
    const result = migrateLegacyFoodInventory({
      foodInventory: [{ id: 'mod-food', count: 1 }],
    })

    assert.deepEqual(result.state.inventory, { 'legacy:mod-food': 1 })
    assert.deepEqual(warnings, [
      ['[Inventory] Unknown legacy food id preserved:', 'mod-food'],
    ])
  } finally {
    console.warn = originalWarn
  }
})

test('skips malformed legacy ids without warning or namespace pollution', () => {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args)

  try {
    const result = migrateLegacyFoodInventory({
      foodInventory: [
        { count: 1 },
        { id: '', count: 1 },
        { id: '   ', count: 1 },
        { id: 42, count: 1 },
        { id: null, count: 1 },
        { id: 'mod-food', count: 1 },
      ],
    })

    assert.deepEqual(result.state.inventory, { 'legacy:mod-food': 1 })
    assert.deepEqual(warnings, [
      ['[Inventory] Unknown legacy food id preserved:', 'mod-food'],
    ])
    assert.equal('legacy:undefined' in result.state.inventory, false)
    assert.equal('legacy:' in result.state.inventory, false)
  } finally {
    console.warn = originalWarn
  }
})

test('legacy migration is idempotent after version one', () => {
  const first = migrateLegacyFoodInventory({
    foodInventory: [{ id: 'apple', count: 2 }],
  })
  const second = migrateLegacyFoodInventory(first.state)

  assert.equal(second.migrated, false)
  assert.equal(second.state, first.state)
  assert.deepEqual(second.state.inventory, { 'food:apple': 2 })
  assert.equal(Object.hasOwn(second.state, 'foodInventory'), false)
})
