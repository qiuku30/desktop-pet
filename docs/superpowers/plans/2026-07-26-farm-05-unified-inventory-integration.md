# Farm 05 Unified Inventory Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move warehouse, shop and feeding to the universal inventory and item catalog while preserving every existing behavior and enabling crop/seed/material categories.

**Architecture:** `shared/item-config.js` is the display/ability catalog; `inventory-service.js` is the only count mutation API. Existing `FOODS` remains a compatibility export until all call sites switch, then becomes a filtered view of the shared item catalog.

**Tech Stack:** JavaScript ES modules, PetState.setMany, existing dashboard/overlay/tooltip UI, Node tests.

## Global Constraints

- Never maintain `foodInventory` and `inventory` as two writable sources.
- Existing apple/cake/fish/milk/cookie saves must migrate without loss.
- Selling food/crops and feeding must be atomic with coins/pet stats.
- Farm page does not implement selling.

---

### Task 1: Item catalog and feed compatibility

**Files:**
- Modify: `src/renderer/shared/item-config.js`
- Modify: `src/renderer/shared/item-config.test.mjs`
- Modify: `src/renderer/shared/feed-service.js`
- Create: `src/renderer/shared/feed-service.test.mjs`

**Interfaces:**
- Produces: `getItem(itemId)`, `listItems()`, `listFeedableItems()`.
- `applyFeed` uses `food.intimacy ?? FEED_CONFIG.intimacyPerFeed`.
- `consumeFood(foodId, inventory)` accepts namespaced inventory map.

- [ ] **Step 1: Write failing compatibility tests**

Test old foods retain satiety/exp/default intimacy; carrot uses intimacy 3; non-feedable wheat is rejected; consuming `food:milk` removes exactly one map count.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/shared/feed-service.test.mjs`

- [ ] **Step 3: Refactor feed service**

Keep `FOODS` as:

```js
export const FOODS = Object.freeze(
  Object.fromEntries(listFeedableItems().map(item => [item.id, item]))
)
```

Change `applyFeed`:

```js
newIntimacy: intimacy + (food.intimacy ?? FEED_CONFIG.intimacyPerFeed)
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/shared/feed-service.test.mjs src/renderer/shared/*.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/shared/item-config.js src/renderer/shared/item-config.test.mjs src/renderer/shared/feed-service.js src/renderer/shared/feed-service.test.mjs
git commit -m "refactor: unify feed items and inventory"
```

### Task 2: Warehouse categories and quantity operations

**Files:**
- Modify: `src/renderer/dashboard/nav-config.js`
- Modify: `src/renderer/dashboard/dashboard.js`
- Modify: `src/renderer/dashboard/dashboard.css`
- Modify: `src/renderer/dashboard/DESIGN.md`
- Create: `src/renderer/dashboard/dashboard-inventory.test.mjs`

**Interfaces:**
- Categories: `all`, `food`, `crop`, `seed`, `material`.
- Sell/destroy overlay requests a quantity `1..count`; use remains one item.

- [ ] **Step 1: Add failing warehouse fixture tests**

Assert inventory catalog renders zero and nonzero items correctly, filters five categories, uses namespaced IDs, and selling quantity 3 changes inventory/coins in one `setMany`.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/dashboard/dashboard-inventory.test.mjs`

Expected: FAIL because warehouse still reads `foodInventory`.

- [ ] **Step 3: Refactor warehouse data source**

Replace array mapping with:

```js
const inventory = PetState.get('inventory') || {}
const allItems = listItems().map(item => ({ ...item, count: getItemCount(inventory, item.id) }))
```

For selling:

```js
PetState.setMany({
  inventory: removeResult.inventory,
  coins: coins + item.sellPrice * quantity,
})
```

- [ ] **Step 4: Verify dashboard manually**

Check filters, tooltip fields, use, multi-sell, destroy, empty counts, overlay blur and page cleanup.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/dashboard
git commit -m "feat: support universal warehouse inventory"
```

### Task 3: Shop seeds and existing food

**Files:**
- Modify: `src/renderer/dashboard/dashboard.js`
- Modify: `src/renderer/dashboard/dashboard.css`
- Modify: `src/renderer/dashboard/nav-config.js`
- Modify: `src/renderer/dashboard/dashboard-inventory.test.mjs`

**Interfaces:**
- Shop lists only items with finite positive `buyPrice`.
- Seed items unlock from farm level and support single purchase; farm quick-buy still buys exactly one through FarmService.

- [ ] **Step 1: Add failing shop tests**

Test locked seeds hidden/disabled according to configured policy, available seeds sorted by buy price, insufficient coins rejected, and purchase atomically changes coins/inventory.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/dashboard/dashboard-inventory.test.mjs`

Expected: FAIL because shop still reads `FOODS` and `foodInventory`.

- [ ] **Step 3: Implement catalog-driven shop**

Remove `Object.values(FOODS)` dependency. Subscribe to `inventory`, `coins`, and `farm` keys. Use `setMany` for purchase.

- [ ] **Step 4: Verify GREEN and manual shop flow**

Buy milk, wheat seed and carrot seed; verify inventory quantities and coin balance survive pet/dashboard round trip.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/dashboard
git commit -m "feat: sell farm seeds in shop"
```

### Task 4: Pet and dashboard feeding

**Files:**
- Modify: `src/renderer/pet/pet.js`
- Modify: `src/renderer/dashboard/dashboard.js`
- Modify: `src/renderer/pet/DESIGN.md`
- Modify: `src/renderer/dashboard/DESIGN.md`
- Create: `src/renderer/pet/pet-feeding-integration.test.mjs`
- Modify: `src/renderer/dashboard/dashboard-inventory.test.mjs`

**Interfaces:**
- Feeding reads `inventory`, lists only feedable items, and commits inventory/satiety/intimacy/mood/exp/level once.

- [ ] **Step 1: Add failing feed transaction tests**

Cover raw carrot, processed food custom intimacy, full satiety no-consume, mood multiplier, level-up, and exactly one inventory decrement.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/shared/feed-service.test.mjs src/renderer/pet/pet-feeding-integration.test.mjs src/renderer/dashboard/dashboard-inventory.test.mjs`

Expected: FAIL because pet/dashboard feeding still writes `foodInventory` and performs multiple `set()` calls.

- [ ] **Step 3: Replace both feeding paths**

Compute every next field first and call one `PetState.setMany`. Emit `PET_FED` after commit. Preserve pet-12 eat/happy/level-up queue ordering unchanged.

- [ ] **Step 4: Run full automated and Electron regression**

Run: `node --test src/renderer/shared/*.test.mjs src/renderer/games/farm/*.test.mjs src/renderer/pet/*.test.mjs src/renderer/pet/animation/*.test.mjs`

Manual: feed old food, raw crop and processed food from pet overlay, dashboard home and warehouse; verify level-up animation semantics.

- [ ] **Step 5: Remove legacy writable field, update docs and commit**

After `rg -n "foodInventory" src` shows only migration/tests/docs, stop writing `foodInventory`. Keep migration input support.

```bash
git add src/renderer src/main/storage/store.js docs/progress.md docs/session-log.md
git commit -m "refactor: complete universal inventory migration"
```
