# Farm 02 Domain Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement validated farm configuration, versioned default state, deterministic pure rules, offline settlement, and a transaction coordinator without UI.

**Architecture:** All calculations are ES-module pure functions under `games/farm/`; current time and randomness are injected. A coordinator is the only layer allowed to read and atomically commit PetState.

**Tech Stack:** JavaScript ES modules, Node `node:test`, PetState, EventBus.

## Global Constraints

- Copy every default value from `specs/farm-system.md`; no numeric literal duplication in rule functions.
- No DOM, Electron API, timers, localStorage or filesystem access in pure modules.
- Store stable IDs and transaction snapshots; never store config objects.
- Preserve existing pet idle/sleep/action semantics.

---

### Task 1: Farm and item configuration

**Files:**
- Create: `src/renderer/games/farm/farm-config.mjs`
- Create: `src/renderer/games/farm/farm-config.test.mjs`
- Create: `src/renderer/shared/item-config.js`
- Create: `src/renderer/shared/item-config.test.mjs`

**Interfaces:**
- Produces: `ITEMS`, `CROPS`, `RECIPES`, `BUILDINGS`, `FARMS`, `FARM_LEVELS`, `LAND_UNLOCKS`, `ORDER_CONFIG`, `FARM_REWARD_CONFIG`, `validateFarmConfig(config)`.

- [ ] **Step 1: Write validator tests**

```js
test('approved config validates', () => {
  assert.deepEqual(validateFarmConfig(FARM_CONFIG), [])
})

test('validator reports missing recipe ingredient and duplicate tile', () => {
  const broken = structuredClone(FARM_CONFIG)
  broken.recipes['recipe:test'] = { inputs: { 'missing:item': 1 }, outputs: { 'food:test': 1 }, durationMs: 1 }
  broken.farms['basic-farm'].tiles.push({ id: 'r0c0', row: 0, col: 0 })
  assert.deepEqual(validateFarmConfig(broken).map(e => e.code), ['UNKNOWN_ITEM', 'DUPLICATE_TILE'])
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-config.test.mjs`

Expected: FAIL because config modules do not exist.

- [ ] **Step 3: Implement the exact approved tables**

Use frozen maps keyed by stable namespaced IDs. Express durations in milliseconds through one helper:

```js
const minutes = value => value * 60_000
export const CROPS = Object.freeze({
  'crop:wheat': { seedId: 'seed:wheat', durationMs: minutes(15), baseYield: 4, seedPrice: 4, sellPrice: 2, unlockFarmLevel: 1, harvestExp: 1 },
  // carrot, corn, strawberry, pumpkin, star-dew-fruit copied exactly from spec
})
```

Build the 16 coordinates programmatically once in configuration and mark the central four as initially unlocked.

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/games/farm/farm-config.test.mjs`

Expected: all validator tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/games/farm/farm-config.mjs src/renderer/games/farm/farm-config.test.mjs src/renderer/shared/item-config.js src/renderer/shared/item-config.test.mjs
git commit -m "feat: define validated farm configuration"
```

### Task 2: Versioned default state and migration

**Files:**
- Create: `src/renderer/games/farm/farm-state.mjs`
- Create: `src/renderer/games/farm/farm-state.test.mjs`
- Modify: `src/main/storage/store.js`

**Interfaces:**
- Produces: `createDefaultFarmState(now, random)`, `migrateFarmState(value, now, random)`, `validateFarmState(value)`.

- [ ] **Step 1: Write failing state tests**

```js
test('default state has four central fields, three orders and starter grant marker false', () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  assert.equal(farm.schemaVersion, 1)
  assert.equal(farm.farms['basic-farm'].tiles.filter(t => t.occupancy === 'field').length, 4)
  assert.equal(farm.orders.slots.length, 3)
  assert.equal(farm.starterGranted, false)
  assert.deepEqual(farm.nextIds, { order: 1, processingTask: 1, building: 1 })
  assert.deepEqual(farm.notificationState, {
    notifiedReadyOrderIds: [],
    lastCompletedProcessingTaskId: null,
  })
})

test('migration is idempotent and repairs one invalid order without clearing fields', () => {
  const first = migrateFarmState({ ...validFarm, orders: { slots: [null] } }, NOW, rng)
  const second = migrateFarmState(first.state, NOW, rng)
  assert.deepEqual(second.state, first.state)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-state.test.mjs`

- [ ] **Step 3: Implement schema v1**

Use explicit state factories. Never put `Date.now()` or `Math.random()` inside the module. Add `farm: null` to store defaults; the renderer migration creates schema v1 on first access.

Migration repairs records locally: remove unknown tiles and invalid building/task records; restore invalid open occupancy to an empty field and invalid closed occupancy to locked; preserve/clamp land level; clear only the invalid crop; re-chain remaining processing tasks from `now` if the active task was removed; turn an invalid order slot into `null` with `regenerateAt = now`; repair `nextIds` above every valid persisted numeric suffix; and clean notification references. The second migration of repaired state must be byte-for-byte deep-equal.

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/games/farm/farm-state.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/games/farm/farm-state.mjs src/renderer/games/farm/farm-state.test.mjs src/main/storage/store.js
git commit -m "feat: add versioned farm state"
```

### Task 3: Grid, growth, yield and building rules

**Files:**
- Create: `src/renderer/games/farm/farm-rules.mjs`
- Create: `src/renderer/games/farm/farm-rules.test.mjs`

**Interfaces:**
- Produces: `adjacentTileIds`, `canUnlockTile`, `buildingEffectForTile`, `calculatePlantSnapshot`, `isCropMature`, `calculateHarvest`.

- [ ] **Step 1: Write table-driven failing tests**

```js
test('level one uses four-neighbor and level two uses eight-neighbor', () => {
  assert.deepEqual(adjacentTileIds('r1c1', 1).sort(), ['r0c1','r1c0','r1c2','r2c1'])
  assert.equal(adjacentTileIds('r1c1', 2).length, 8)
})

test('60m crop with sprinkler 25% and happy 10% takes 43.64m', () => {
  const snapshot = calculatePlantSnapshot({ baseDurationMs: 3_600_000, sprinkler: .25, mood: .10, farmSpeed: 0 })
  assert.equal(snapshot.durationMs, Math.round(3_600_000 / 1.25 / 1.10))
})

test('yield rounds once after land and scarecrow multiply', () => {
  assert.equal(calculateHarvest({ baseYield: 4, landMultiplier: 1.25, scarecrow: .15, farmYieldMultiplier: 1 }).quantity, 6)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-rules.test.mjs`

- [ ] **Step 3: Implement minimal pure functions**

Use row/column parsing, Manhattan distance for level 1 and Chebyshev distance for levels 2/3. Gather overlapping buildings by type and select the highest level before reading config effects.

- [ ] **Step 4: Add edge tests and verify GREEN**

Cover corners, locked tiles, non-adjacent unlock, same-type non-stacking, cross-type stacking, building instance locks, 3/11/18% bonus drops, mature crops never expiring, and deterministic random branches.

Run: `node --test src/renderer/games/farm/farm-rules.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/games/farm/farm-rules.mjs src/renderer/games/farm/farm-rules.test.mjs
git commit -m "feat: add deterministic farm rules"
```

### Task 4: Processor and order rules

**Files:**
- Create: `src/renderer/games/farm/farm-processing.mjs`
- Create: `src/renderer/games/farm/farm-processing.test.mjs`
- Create: `src/renderer/games/farm/farm-orders.mjs`
- Create: `src/renderer/games/farm/farm-orders.test.mjs`

**Interfaces:**
- Produces: `enqueueRecipe`, `cancelQueuedTask`, `settleProcessing`, `generateOrder`, `canCompleteOrder`, `completeOrder`, `abandonOrder`, `regenerateDueOrders`.

- [ ] **Step 1: Write failing processor tests**

Test three-task capacity, immediate ingredient deduction, running-task cancellation rejection, queued-task full refund, and one offline settlement completing multiple tasks with exact next start times.

- [ ] **Step 2: Write failing order tests**

Test level bands, stable feasible-candidate enumeration, one/two-line 70/30 selection, per-line quantity cap 20, no duplicate slot signature, two-line fallback to one line, nearest-lower-bound fallback, no-candidate null slot, raw and processed reward multipliers, exact `{ coins, farmExp, seedReward }` snapshot, 15% seed reward with stable unlocked-seed selection, full-order atomic removal, and 30-minute abandoned-slot regeneration.

- [ ] **Step 3: Verify RED**

Run: `node --test src/renderer/games/farm/farm-processing.test.mjs src/renderer/games/farm/farm-orders.test.mjs`

- [ ] **Step 4: Implement from configuration**

Every function returns `{ ok, ...nextValues, error? }`; never mutates input or calls PetState. Persist requirement/reward/input/output snapshots on created records. IDs come from persisted `nextIds` counters (`order:<n>`, `processing-task:<n>`, `building:<n>`), never from gameplay randomness.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test src/renderer/games/farm/*.test.mjs`

```bash
git add src/renderer/games/farm
git commit -m "feat: add farm processing and order rules"
```

### Task 5: Transaction coordinator

**Files:**
- Create: `src/renderer/games/farm/farm-service.js`
- Create: `src/renderer/games/farm/farm-service.test.mjs`
- Modify: `src/renderer/games/farm/DESIGN.md`

**Interfaces:**
- Produces: `createFarmService({ petState, eventBus, now, random })`.
- Commands: `initialize`, `settle`, `plant`, `harvest`, `harvestAll`, `removeCrop`, `unlockTile`, `upgradeLand`, `build`, `moveBuilding`, `upgradeBuilding`, `demolishBuilding`, `enqueue`, `cancelQueued`, `completeOrder`, `abandonOrder`, `claimBird`.

- [ ] **Step 1: Write failing atomic transaction tests**

Use fake PetState that records `setMany` calls. Assert initialization grants four wheat and four carrot seeds exactly once; quick-buy plant changes coins/inventory/farm in one call; insufficient coins produces no call; repeated harvest yields one reward; order completion emits only after commit; two concurrent commands are serialized; time settlement and a successful command share one commit; a failed command with settlement changes commits only settlement; and a no-op makes no commit.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-service.test.mjs`

- [ ] **Step 3: Implement coordinator**

Serialize all commands through one internal promise queue. For time-dependent commands, calculate settlement in memory and merge it with the command result before at most one `petState.setMany({...})`. Emit settlement events, then command events, then one `FARM_STATE_CHANGED` with the approved minimal summary. Do not add a transaction ledger: persisted occupancy/order/task/bird transitions are the equivalent idempotency condition.

- [ ] **Step 4: Verify full domain suite**

Run: `node --test src/renderer/games/farm/*.test.mjs src/renderer/shared/*.test.mjs`

Expected: all PASS.

- [ ] **Step 5: Update design and commit**

```bash
git add src/renderer/games/farm docs/progress.md docs/session-log.md
git commit -m "feat: add farm transaction service"
```
