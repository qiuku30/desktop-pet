# Farm 01 Inventory and State Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the universal inventory model, idempotent legacy migration, and atomic multi-key PetState commits without changing existing farm UI.

**Architecture:** Keep inventory operations pure and config-agnostic. PetState remains the single renderer state owner; `setMany()` applies all keys before emitting events and schedules one save. Legacy `foodInventory` remains readable until Farm 05 switches every consumer.

**Tech Stack:** Electron, JavaScript ES modules, Node `node:test`, EventBus, JSON store.

## Global Constraints

- Do not implement farm gameplay or UI in this plan.
- Do not remove `foodInventory` until all old consumers migrate in Farm 05.
- Preserve ADR-005 copy isolation and existing `set()` behavior.
- All inventory counts are finite non-negative integers.
- No module writes files or `localStorage`; persistence stays in `store.js`.

---

### Task 1: Pure inventory service

**Files:**
- Create: `src/renderer/shared/inventory-service.js`
- Create: `src/renderer/shared/inventory-service.test.mjs`

**Interfaces:**
- Produces: `normalizeInventory(value)`, `getItemCount(inventory, itemId)`, `canRemoveItems(inventory, requirements)`, `addItems(inventory, additions)`, `removeItems(inventory, requirements)`.

- [ ] **Step 1: Write failing tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeInventory, getItemCount, canRemoveItems, addItems, removeItems,
} from './inventory-service.js'

test('normalizes and freezes out invalid counts', () => {
  assert.deepEqual(normalizeInventory({ a: 2, b: -1, c: 1.5, d: NaN }), { a: 2 })
})

test('removeItems is atomic when any requirement is missing', () => {
  const inventory = { a: 3, b: 1 }
  assert.deepEqual(removeItems(inventory, { a: 2, b: 2 }), {
    ok: false, inventory, missing: { b: 1 },
  })
})

test('adds and removes without mutating input', () => {
  const original = { a: 2 }
  const added = addItems(original, { a: 1, b: 2 })
  assert.deepEqual(added, { a: 3, b: 2 })
  assert.deepEqual(original, { a: 2 })
  assert.equal(getItemCount(added, 'b'), 2)
  assert.equal(canRemoveItems(added, { a: 3, b: 2 }), true)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test src/renderer/shared/inventory-service.test.mjs`

Expected: FAIL because `inventory-service.js` does not exist.

- [ ] **Step 3: Implement the pure API**

```js
function validCount(value) {
  return Number.isInteger(value) && value > 0
}

export function normalizeInventory(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).filter(([, count]) => validCount(count)))
}

export function getItemCount(inventory, itemId) {
  return normalizeInventory(inventory)[itemId] || 0
}

export function canRemoveItems(inventory, requirements) {
  const source = normalizeInventory(inventory)
  return Object.entries(normalizeInventory(requirements))
    .every(([id, count]) => (source[id] || 0) >= count)
}

export function addItems(inventory, additions) {
  const next = { ...normalizeInventory(inventory) }
  for (const [id, count] of Object.entries(normalizeInventory(additions))) {
    next[id] = (next[id] || 0) + count
  }
  return next
}

export function removeItems(inventory, requirements) {
  const source = normalizeInventory(inventory)
  const needed = normalizeInventory(requirements)
  const missing = {}
  for (const [id, count] of Object.entries(needed)) {
    if ((source[id] || 0) < count) missing[id] = count - (source[id] || 0)
  }
  if (Object.keys(missing).length) return { ok: false, inventory, missing }
  const next = { ...source }
  for (const [id, count] of Object.entries(needed)) {
    next[id] -= count
    if (next[id] === 0) delete next[id]
  }
  return { ok: true, inventory: next, missing: {} }
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test src/renderer/shared/inventory-service.test.mjs`

Expected: all inventory tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/shared/inventory-service.js src/renderer/shared/inventory-service.test.mjs
git commit -m "feat: add universal inventory service"
```

### Task 2: Idempotent legacy food migration

**Files:**
- Modify: `src/renderer/shared/inventory-service.js`
- Modify: `src/renderer/shared/inventory-service.test.mjs`

**Interfaces:**
- Produces: `migrateLegacyFoodInventory(state) -> { state, migrated }`.
- Legacy mapping: `apple→food:apple`, `cake→food:cake`, `fish→food:fish`, `milk→food:milk`, `cookie→food:cookie`.

- [ ] **Step 1: Add failing migration tests**

```js
test('migrates legacy food once and preserves unknown ids', () => {
  const old = { foodInventory: [{ id: 'apple', count: 2 }, { id: 'mod-food', count: 1 }] }
  const first = migrateLegacyFoodInventory(old)
  assert.deepEqual(first.state.inventory, { 'food:apple': 2, 'legacy:mod-food': 1 })
  assert.equal(first.state.inventoryMigrationVersion, 1)
  const second = migrateLegacyFoodInventory(first.state)
  assert.deepEqual(second.state.inventory, first.state.inventory)
  assert.equal(second.migrated, false)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/shared/inventory-service.test.mjs`

Expected: FAIL because the migration export is missing.

- [ ] **Step 3: Implement migration**

```js
const LEGACY_FOOD_IDS = Object.freeze({
  apple: 'food:apple', cake: 'food:cake', fish: 'food:fish',
  milk: 'food:milk', cookie: 'food:cookie',
})

export function migrateLegacyFoodInventory(state) {
  if ((state?.inventoryMigrationVersion || 0) >= 1) {
    return { state, migrated: false }
  }
  let inventory = normalizeInventory(state?.inventory)
  for (const entry of Array.isArray(state?.foodInventory) ? state.foodInventory : []) {
    if (!entry || !validCount(entry.count)) continue
    const id = LEGACY_FOOD_IDS[entry.id] || `legacy:${entry.id}`
    inventory = addItems(inventory, { [id]: entry.count })
  }
  return {
    migrated: true,
    state: { ...state, inventory, inventoryMigrationVersion: 1 },
  }
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/shared/inventory-service.test.mjs`

Expected: all tests PASS, including repeated migration.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/shared/inventory-service.js src/renderer/shared/inventory-service.test.mjs
git commit -m "feat: migrate legacy food inventory"
```

### Task 3: Atomic PetState.setMany

**Files:**
- Modify: `src/renderer/shared/pet-state.js`
- Create: `src/renderer/shared/pet-state.test.mjs`

**Interfaces:**
- Produces: `PetState.setMany(updates)`.
- Emits all mapped events only after every key is visible; emits one `PET_STATE_CHANGED` per updated key; schedules one save.

- [ ] **Step 1: Write failing atomicity tests**

```js
test('setMany exposes every new value before emitting', async () => {
  const seen = []
  PetState.subscribe(EVENTS.PET_STATE_CHANGED, ({ key }) => {
    seen.push([key, PetState.get('coins'), PetState.get('inventory')])
  })
  PetState.setMany({ coins: 12, inventory: { 'crop:wheat': 4 } })
  assert.deepEqual(seen, [
    ['coins', 12, { 'crop:wheat': 4 }],
    ['inventory', 12, { 'crop:wheat': 4 }],
  ])
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/shared/pet-state.test.mjs`

Expected: FAIL because `setMany` is missing.

- [ ] **Step 3: Implement setMany and route set through it**

```js
set(key, value) {
  this.setMany({ [key]: value })
}

setMany(updates) {
  if (!updates || Array.isArray(updates) || typeof updates !== 'object'
      || Object.keys(updates).length === 0) {
    throw new TypeError('updates must be a non-empty object')
  }
  const entries = Object.entries(updates).map(([key, value]) => [key, this._clone(value)])
  for (const [key, value] of entries) this._data[key] = value
  for (const [key, value] of entries) {
    const mapping = KEY_EVENT_MAP[key]
    if (mapping) EventBus.emit(mapping.event, { [mapping.payloadKey]: this._clone(value) })
    EventBus.emit(EVENTS.PET_STATE_CHANGED, { key, value: this._clone(value) })
  }
  this._scheduleSave()
}
```

- [ ] **Step 4: Verify GREEN and regression**

Run: `node --test src/renderer/shared/pet-state.test.mjs src/renderer/shared/*.test.mjs`

Expected: PetState tests and all existing shared tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/shared/pet-state.js src/renderer/shared/pet-state.test.mjs
git commit -m "feat: add atomic pet state updates"
```

### Task 4: Store defaults and startup migration

**Files:**
- Modify: `src/main/storage/store.js`
- Modify: `src/renderer/shared/pet-state.js`
- Modify: `src/renderer/shared/pet-state.test.mjs`
- Modify: `src/renderer/shared/events.js`
- Modify: `docs/progress.md`
- Modify: `docs/session-log.md`

**Interfaces:**
- Store defaults produce `inventory: {}` and `inventoryMigrationVersion: 0`.
- `PetState.init()` migrates once, adopts the complete returned state, and schedules persistence.

- [ ] **Step 1: Add failing startup migration test**

```js
test('init migrates legacy inventory and persists the migrated snapshot', async () => {
  electronState = { foodInventory: [{ id: 'milk', count: 2 }] }
  await PetState.init()
  assert.deepEqual(PetState.get('inventory'), { 'food:milk': 2 })
  assert.equal(PetState.get('inventoryMigrationVersion'), 1)
  await PetState.flush()
  assert.equal(savedSnapshots.at(-1).inventory['food:milk'], 2)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/shared/pet-state.test.mjs`

Expected: FAIL because init does not migrate.

- [ ] **Step 3: Add defaults and init migration**

Add to `DEFAULT_STATE`:

```js
inventory: {},
inventoryMigrationVersion: 0,
```

In `PetState.init()` after loading:

```js
const { state, migrated } = migrateLegacyFoodInventory(this._data)
this._data = state
this._ready = true
if (migrated) this._scheduleSave()
```

Replace old farm event constants with the six approved `FARM_*` constants, but do not emit them yet.

- [ ] **Step 4: Run foundation regression**

Run: `node --test src/renderer/shared/*.test.mjs src/renderer/pet/*.test.mjs src/renderer/pet/animation/*.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Update docs and commit**

Update `docs/progress.md` and `docs/session-log.md` with migration behavior, files, tests and no unapproved scope.

```bash
git add src/main/storage/store.js src/renderer/shared docs/progress.md docs/session-log.md
git commit -m "feat: initialize universal inventory state"
```
