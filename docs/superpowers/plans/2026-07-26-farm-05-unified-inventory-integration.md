# Farm 05 Unified Inventory Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans`, `test-driven-development`, and `verification-before-completion` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not use subagents for this project.

**Goal:** Make the universal namespaced inventory the only writable inventory used by warehouse, shop and both feeding paths, while adding quantity operations and farm seed commerce without changing pet animation semantics.

**Architecture:** `shared/item-config.js` is the only display/ability/commerce catalog and `inventory-service.js` is the only inventory count mutation API. Dashboard and pet compute complete transactions before one `PetState.setMany()` call. The existing overlay IPC remains unchanged; its renderer gains a generic quantity-result adapter.

**Tech Stack:** Electron, JavaScript ES modules, PetState, existing overlay/tooltip UI, Node test runner.

## Global Constraints

- `inventory: { [namespacedItemId]: positiveIntegerCount }` is the only writable inventory.
- `foodInventory` remains accepted only by the version-1 legacy migration; a successful migration deletes that legacy property from the migrated snapshot, and new-store defaults and production consumers do not recreate it.
- Existing apple/cake/fish/milk/cookie counts and their feed/buy/sell values remain unchanged.
- Warehouse categories are exactly `all`, `food`, `crop`, `seed`, `material`; an empty category renders an empty state.
- Feedable raw crops and processed foods are catalog capabilities, not hard-coded category assumptions.
- Warehouse sell/destroy and shop buy accept an integer quantity; feeding always consumes exactly one.
- Shop shows locked seeds disabled with `农场 Lv.X 解锁`; it does not hide them.
- Buy quantity range is `1..floor(coins / buyPrice)`; sell/destroy range is `1..ownedCount`.
- Farm quick-buy remains exactly one seed and continues through `FarmService`; the farm page gains no selling UI.
- Purchase, sale, destruction and feeding each use exactly one `PetState.setMany()`; `PET_FED` emits only after the feed commit succeeds.
- Preserve pet-12 `eat → happy` upgrade ordering, happy deduplication, sleep/inactivity semantics and ordinary-feed behavior.
- No new IPC channels, events, dependencies or farm persistence schema version.
- Implementation may not modify `PROJECT_BRIEF.md`, `docs/progress.md`, or `docs/session-log.md`; ARCH-10 owns them.
- Do not commit, merge or push. Report checkpoints to ARCH-10; ARCH-10 performs the final commit after independent verification.

---

### Task 1: Catalog, commerce consistency and feed compatibility

**Files:**
- Modify: `src/renderer/shared/item-config.js`
- Modify: `src/renderer/shared/item-config.test.mjs`
- Modify: `src/renderer/shared/feed-service.js`
- Create: `src/renderer/shared/feed-service.test.mjs`
- Modify: `src/renderer/shared/inventory-service.js`
- Modify: `src/renderer/shared/inventory-service.test.mjs`
- Modify: `src/renderer/games/farm/farm-config.mjs`
- Modify: `src/renderer/games/farm/farm-config.test.mjs`

**Interfaces:**
- Produces: `getItem(itemId)`, `listItems()`, `listFeedableItems()`, `listPurchasableItems()`.
- A feedable catalog entry exposes flattened `satiety`, `exp`, and `intimacy` values to legacy consumers; non-feedable entries omit them.
- `consumeFood(itemId, inventory)` returns `{ newInventory, consumed }` for a namespaced inventory map.
- Quantity mutations reuse `addItems(inventory, { [itemId]: quantity })` and `removeItems(inventory, { [itemId]: quantity })`.

- [ ] **Step 1: Write catalog and compatibility tests**

Add assertions for:

```js
assert.equal(getItem('food:milk').buyPrice, 10)
assert.equal(getItem('seed:wheat').buyPrice, 4)
assert.equal(getItem('seed:corn').unlockFarmLevel, 2)
assert.equal(getItem('crop:carrot').intimacy, 3)
assert.equal(getItem('crop:wheat').satiety, undefined)
assert.deepEqual(listFeedableItems().map(item => item.id).sort(), [
  'crop:carrot', 'crop:corn', 'crop:star-dew-fruit', 'crop:strawberry',
  'food:apple', 'food:cake', 'food:carrot-juice', 'food:cookie', 'food:fish',
  'food:milk', 'food:popcorn', 'food:pumpkin-pie', 'food:strawberry-milkshake',
])
```

Test all six seed `buyPrice`/`unlockFarmLevel` values against the crop table and all six crop `sellPrice` values against `CROPS`.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test src/renderer/shared/item-config.test.mjs src/renderer/shared/feed-service.test.mjs src/renderer/games/farm/farm-config.test.mjs
```

Expected: FAIL because catalog helpers, commerce fields and map-based `consumeFood` do not exist.

- [ ] **Step 3: Implement the catalog API**

Keep catalog entries immutable. Preserve existing food prices:

```js
export const getItem = itemId => ITEMS[itemId] || null
export const listItems = () => Object.values(ITEMS)
export const listFeedableItems = () => listItems().filter(entry =>
  Number.isFinite(entry.satiety) && entry.satiety > 0
)
export const listPurchasableItems = () => listItems().filter(entry =>
  Number.isFinite(entry.buyPrice) && entry.buyPrice > 0
)
```

Seed prices/unlock levels are `4/1`, `8/1`, `15/2`, `30/3`, `80/5`, `160/7`. Existing foods retain buy prices `10/30/20/10/5`; legacy `food:cookie` therefore remains purchasable even though the farm can also produce it. The four newly introduced processed outputs are not shop-purchasable.

- [ ] **Step 4: Refactor feed compatibility and validate farm commerce**

Build `FOODS` from `listFeedableItems()` keyed by namespaced ID. Implement:

```js
export function consumeFood(itemId, inventory) {
  const result = removeItems(inventory, { [itemId]: 1 })
  return { newInventory: result.inventory, consumed: result.ok }
}
```

`applyFeed` adds `food.intimacy ?? FEED_CONFIG.intimacyPerFeed`. Extend `validateFarmConfig()` to report stable errors when crop seed price, crop sale price or seed unlock level differs from the shared catalog.
Update `migrateLegacyFoodInventory()` so its returned migrated snapshot omits `foodInventory`; retain the version marker so repeated migration remains idempotent.

- [ ] **Step 5: Run GREEN checkpoint**

Run:

```bash
node --test src/renderer/shared/*.test.mjs src/renderer/games/farm/farm-config.test.mjs
```

Expected: all pass. Report the count; do not commit.

---

### Task 2: Generic quantity overlay adapter

**Files:**
- Modify: `src/renderer/overlay/overlay.js`
- Create: `src/renderer/overlay/overlay.test.mjs`

**Interfaces:**
- Fixed `[data-overlay-result]` behavior remains backward compatible.
- A quantity confirmation element declares `data-overlay-quantity-action` and `data-overlay-quantity-input`.
- Result shape is `{ action: string, quantity: integer }`.

- [ ] **Step 1: Add RED DOM behavior tests**

Use a minimal injected document/window harness. Cover decrement, increment, direct invalid input normalization, `全部`, confirmation result, fixed-result compatibility and missing input rejection.

The quantity markup contract is:

```html
<button data-quantity-step="-1">－</button>
<input id="quantity" type="number" min="1" max="12" value="1">
<button data-quantity-step="1">＋</button>
<button data-quantity-all data-quantity-input="quantity">全部</button>
<button data-overlay-quantity-action="sell"
        data-overlay-quantity-input="quantity">确认</button>
```

- [ ] **Step 2: Run RED**

Run:

```bash
node --test src/renderer/overlay/overlay.test.mjs
```

Expected: FAIL because quantity controls are not handled.

- [ ] **Step 3: Implement one delegated adapter**

Clamp with parsed `input.min`/`input.max`, normalize non-integers by flooring, and close only with a safe integer in range:

```js
window.overlayAPI.close({
  action: button.dataset.overlayQuantityAction,
  quantity,
})
```

Do not modify `overlay-preload.js`, `overlay-manager.js`, IPC names or the fixed-result JSON parsing path.

- [ ] **Step 4: Run GREEN**

Run:

```bash
node --test src/renderer/overlay/overlay.test.mjs
```

Expected: all pass. Report the count; do not commit.

---

### Task 3: Catalog-driven warehouse and shop

**Files:**
- Modify: `src/renderer/dashboard/nav-config.js`
- Modify: `src/renderer/dashboard/dashboard.js`
- Modify: `src/renderer/dashboard/dashboard.css`
- Modify: `src/renderer/dashboard/DESIGN.md`
- Create: `src/renderer/dashboard/dashboard-inventory.test.mjs`

**Interfaces:**
- Categories: `all`, `food`, `crop`, `seed`, `material`.
- Warehouse uses `listItems()` plus `getItemCount(inventory, item.id)`.
- Shop uses `listPurchasableItems()`, current `farm.level`, current coins and the quantity overlay result.

- [ ] **Step 1: Extract testable inventory transaction helpers**

In `dashboard.js` or a new dashboard-local helper exported only for tests, define pure operations:

```js
sellInventoryItem({ inventory, coins, item, quantity })
destroyInventoryItem({ inventory, itemId, quantity })
buyInventoryItem({ inventory, coins, item, quantity, farmLevel })
```

Each returns `{ ok, updates }` on success, where `updates` is passed unchanged to one `PetState.setMany()`. Stable failures are `INVALID_QUANTITY`, `INSUFFICIENT_ITEMS`, `INSUFFICIENT_COINS`, and `ITEM_LOCKED`.

- [ ] **Step 2: Write RED warehouse/shop tests**

Cover five category filters, namespaced IDs, empty material state, selling three crops, destroying all seeds, unlocked seed batch purchase, locked visible seed metadata, existing food batch purchase, insufficient coins, unsafe totals and exactly one `setMany()` per successful action.

- [ ] **Step 3: Run RED**

Run:

```bash
node --test src/renderer/dashboard/dashboard-inventory.test.mjs
```

Expected: FAIL because Dashboard still reads/writes `foodInventory`.

- [ ] **Step 4: Replace warehouse data and quantity actions**

Use:

```js
const inventory = PetState.get('inventory') || {}
const allItems = listItems().map(item => ({
  ...item,
  count: getItemCount(inventory, item.id),
}))
```

“使用” is visible only for `listFeedableItems()` entries with count above zero. “出售” requires positive `sellPrice`; seeds remain non-sellable. Sell/destroy open the shared quantity UI, then call one `setMany(result.updates)`.

- [ ] **Step 5: Replace shop data and batch purchase**

Render all purchasable entries sorted by `buyPrice`, then stable item ID. Locked seeds remain visible disabled with exact copy `农场 Lv.X 解锁`. Clicking or right-clicking an enabled product opens quantity selection with max `Math.floor(coins / item.buyPrice)`; confirmation calls one `setMany(result.updates)`.

Subscribe warehouse to `inventory`; subscribe shop to `inventory`, `coins`, and `farm`. Cleanup must remove subscriptions, DOM listeners, delayed category render and any open overlay.

- [ ] **Step 6: Run GREEN checkpoint**

Run:

```bash
node --test src/renderer/dashboard/dashboard-inventory.test.mjs src/renderer/dashboard/*.test.mjs
```

Expected: all pass. Report the count; do not commit.

---

### Task 4: Atomic Dashboard and pet feeding

**Files:**
- Modify: `src/renderer/dashboard/dashboard.js`
- Modify: `src/renderer/dashboard/DESIGN.md`
- Modify: `src/renderer/pet/pet.js`
- Modify: `src/renderer/pet/DESIGN.md`
- Create: `src/renderer/pet/pet-feeding-integration.test.mjs`
- Modify: `src/renderer/dashboard/dashboard-inventory.test.mjs`

**Interfaces:**
- Feeding reads `inventory`, lists `listFeedableItems()`, consumes exactly one and computes one updates object.
- Commit fields are `inventory`, `satiety`, `intimacy`, `mood`, `exp`, and `level` when changed.
- `emitFed(itemId)` runs immediately after the synchronous `PetState.setMany()` state commit returns.

- [ ] **Step 1: Write RED feed transaction tests**

Cover old milk, raw carrot custom intimacy, processed pumpkin pie, non-feedable wheat rejection, full satiety no-consume, mood multiplier, one-level and multi-level gains, one inventory decrement, one `setMany()`, post-commit `PET_FED`, failed commit with no event, and pet animation source ordering.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test src/renderer/shared/feed-service.test.mjs src/renderer/pet/pet-feeding-integration.test.mjs src/renderer/dashboard/dashboard-inventory.test.mjs
```

Expected: FAIL because both paths perform multiple `set()` calls against `foodInventory`.

- [ ] **Step 3: Implement one feed transaction calculation**

Calculate from a single snapshot before writing:

```js
const updates = {
  inventory: consumedInventory,
  satiety: newSatiety,
  intimacy: newIntimacy,
  mood: newMood,
  exp: addResult.newExp,
  level: addResult.newLevel,
}
PetState.setMany(updates)
emitFed(itemId)
```

If already at `calcMaxSatiety(level)`, return without consuming or emitting. If calculation or `setMany()` throws, do not emit. Both Dashboard and pet overlay must list raw feedable crops and processed foods. Pet must keep `levelChangeSource = 'feed'` around the atomic commit so the existing eat/happy sequence remains authoritative.

- [ ] **Step 4: Run GREEN and animation regression**

Run:

```bash
node --test src/renderer/shared/feed-service.test.mjs src/renderer/pet/pet-feeding-integration.test.mjs src/renderer/dashboard/dashboard-inventory.test.mjs src/renderer/pet/*.test.mjs src/renderer/pet/animation/*.test.mjs
```

Expected: all pass, including existing pet-12 ordering tests. Report the count; do not commit.

---

### Task 5: Remove the legacy writable field and verify the complete phase

**Files:**
- Modify: `src/main/storage/store.js`
- Modify: `src/renderer/shared/pet-state.test.mjs`
- Modify: `src/renderer/dashboard/DESIGN.md`
- Modify: `src/renderer/pet/DESIGN.md`

**Interfaces:**
- New stores contain `inventory` and `inventoryMigrationVersion` but no `foodInventory` default.
- `migrateLegacyInventory()` continues accepting old persisted `foodInventory` arrays.

- [ ] **Step 1: Add RED default-state and source-boundary tests**

Assert a new store has no own `foodInventory` default and retains `inventory: {}`. Keep migration fixtures proving old arrays merge once without loss.

- [ ] **Step 2: Remove the old default and stale production references**

Remove `foodInventory` from `DEFAULT_STATE`. Update PetState comments and both design docs. Run:

```bash
rg -n "foodInventory" src --glob '!**/*.test.mjs'
```

Expected matches: only `src/renderer/shared/inventory-service.js` legacy migration code and explanatory migration comments; no Dashboard, pet, feed-service or store default matches.

- [ ] **Step 3: Run complete automated verification**

Run:

```bash
node --test
node --check src/renderer/shared/item-config.js
node --check src/renderer/shared/feed-service.js
node --check src/renderer/overlay/overlay.js
node --check src/renderer/dashboard/dashboard.js
node --check src/renderer/pet/pet.js
git diff --check
```

Expected: all tests and checks pass. Existing `MODULE_TYPELESS_PACKAGE_JSON` warnings may remain.

- [ ] **Step 4: Run Electron manual regression**

Verify:

1. Old food counts appear unchanged after restart.
2. Warehouse category switching, empty material state, crop multi-sell and seed multi-destroy.
3. Shop existing-food batch purchase, unlocked seed batch purchase, locked seed disabled copy, insufficient-coins state and page cleanup.
4. Feed an old food, raw carrot and processed food from Dashboard and pet overlay.
5. Full satiety does not consume; level-up still plays eat then happy; ordinary feed plays only eat.
6. Farm quick-buy still purchases and plants exactly one seed.
7. Dashboard ↔ pet and warehouse/shop/farm page round trips preserve counts and coins.

- [ ] **Step 5: Deliver for ARCH-10 review**

Report every modified/created file, whether any out-of-scope file changed, test commands/counts, Electron paths checked, known issues, `foodInventory` source scan, and git status. Do not modify tracker files and do not commit, merge or push.
