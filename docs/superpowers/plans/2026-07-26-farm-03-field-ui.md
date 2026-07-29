# Farm 03 Field and Building UI Implementation Plan

> **Status (2026-07-29):** Completed after lifecycle and accessibility repairs; final implementation commit `550aa3a`, 277/277 full-suite tests. The unchecked steps below are retained as the original execution script, not as current progress.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the navigable farm page with a responsive `4×4` field, planting, harvesting, expansion, land upgrades, building placement, movement, upgrades and demolition.

**Architecture:** A self-contained farm UI module mounts into the existing dashboard and calls only the Farm 02 service. Dashboard owns navigation and lifecycle; farm UI owns its DOM and cleanup.

**Tech Stack:** ES modules, DOM/CSS, Node `node:test`, Electron manual verification.

## Global Constraints

- Do not implement processing, orders, bird rewards or pet reminders here.
- No farm formula may appear in UI code.
- Keep `_pageCleanup` correct and avoid listeners after unmount.
- The `4×4` grid must fit supported small dashboard sizes without clipping.

---

### Task 1: Farm view model and renderer contract

**Files:**
- Create: `src/renderer/games/farm/farm-ui.js`
- Create: `src/renderer/games/farm/farm-ui.test.mjs`
- Create: `src/renderer/games/farm/farm.css`
- Create: `src/renderer/games/farm/farm-module.js`

**Interfaces:**
- Produces internally: `mountFarm(container, { service, petState, onNavigateWarehouse }) -> cleanup`.
- Public module contract: `farm-module.js` exports `mount(container, { onNavigateWarehouse }) -> cleanup`.
- Internal exported-for-test helpers: `buildFarmViewModel`, `renderFarmShell`, `renderFieldGrid`.

- [ ] **Step 1: Write failing view-model tests**

```js
test('view model exposes exactly sixteen stable tiles and summary', () => {
  const vm = buildFarmViewModel(state, config, NOW)
  assert.equal(vm.tiles.length, 16)
  assert.deepEqual(vm.summary, { matureCount: 2, processingCount: 0, readyOrderCount: 0, level: 1, exp: 4 })
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-ui.test.mjs`

- [ ] **Step 3: Implement shell**

Render a top summary, inner tabs with only Farm enabled in this phase, grid buttons with `data-tile-id`, an action area, and one “收获全部” button disabled when `matureCount===0`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/games/farm/farm-ui.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/games/farm/farm-ui.js src/renderer/games/farm/farm-ui.test.mjs src/renderer/games/farm/farm.css
git commit -m "feat: add farm field view"
```

### Task 2: Plant, harvest and land actions

**Files:**
- Modify: `src/renderer/games/farm/farm-ui.js`
- Modify: `src/renderer/games/farm/farm-ui.test.mjs`
- Modify: `src/renderer/games/farm/farm.css`

**Interfaces:**
- Consumes Farm 02 commands: `plant`, `harvest`, `harvestAll`, `removeCrop`, `unlockTile`, `upgradeLand`.

- [ ] **Step 1: Add failing interaction tests**

Test unlocked empty field opens crop choices; locked field shows pet-level/coin requirements; missing seed offers one-click quick buy; mature click harvests; growing crop requires confirmed removal; harvest-all calls one service command.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-ui.test.mjs`

- [ ] **Step 3: Implement event delegation**

Use one grid click listener and one action-area listener. After each successful service result, rebuild the view model and patch grid/summary. Confirm destructive actions through the existing overlay manager, not `window.confirm`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/games/farm/farm-ui.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/games/farm/farm-ui.js src/renderer/games/farm/farm-ui.test.mjs src/renderer/games/farm/farm.css
git commit -m "feat: add farm field interactions"
```

### Task 3: Building interactions and restrained motion

**Files:**
- Modify: `src/renderer/games/farm/farm-ui.js`
- Modify: `src/renderer/games/farm/farm-ui.test.mjs`
- Modify: `src/renderer/games/farm/farm.css`

**Interfaces:**
- Consumes: `build`, `moveBuilding`, `upgradeBuilding`, `demolishBuilding`.

- [ ] **Step 1: Add failing building tests**

Cover building capacity, empty-field placement, work-lock messaging, move target eligibility, retained underlying land level, upgrade gate/cost, demolition 50% refund display, and same-screen re-render.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/games/farm/farm-ui.test.mjs`

- [ ] **Step 3: Implement building mode**

Use an explicit UI mode `{ type: 'move-building', instanceId }`; eligible tiles receive a class and accessible label. Cancel mode on page cleanup. Add low-frequency sprinkler and compost animations under:

```css
@media (prefers-reduced-motion: reduce) {
  .farm-building, .farm-crop { animation: none !important; }
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/renderer/games/farm/farm-ui.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/games/farm
git commit -m "feat: add farm building interactions"
```

### Task 4: Dashboard navigation and lifecycle

**Files:**
- Modify: `src/renderer/dashboard/nav-config.js`
- Modify: `src/renderer/dashboard/dashboard.js`
- Modify: `src/renderer/dashboard/dashboard.css`
- Modify: `src/renderer/dashboard/DESIGN.md`
- Modify: `src/renderer/games/farm/DESIGN.md`
- Modify: `src/renderer/shared/module-registry.js`
- Create: `src/renderer/dashboard/dashboard-farm-integration.test.mjs`

**Interfaces:**
- `module-registry.js` registers `{ id:'farm', modulePath:'../games/farm/farm-module.js' }`.
- Dashboard imports only the shared registry and dynamically loads the registered public `mount` contract; it never directly imports farm internals.
- `NAV_ITEMS` receives `{ id:'farm', icon:'🌾', label:'农场' }`.

- [ ] **Step 1: Add a dashboard integration test**

Create a minimal fake DOM container and injected module-loader spy. Assert Farm sits after Pomodoro and before 2048, the registry path is loaded, the public `mount` renders 16 cells, and cleanup is called once when switching away. Also assert a late dynamic-import result is discarded after a second navigation.

- [ ] **Step 2: Verify RED**

Run: `node --test src/renderer/dashboard/dashboard-farm-integration.test.mjs`

Expected: FAIL because the farm navigation item and render binding are missing.

- [ ] **Step 3: Wire navigation**

In `initStatus()`, assign a generic registry render:

```js
const farmItem = NAV_ITEMS.find(n => n.id === 'farm')
if (farmItem) farmItem.render = container =>
  mountRegisteredModule('farm', container, {
    onNavigateWarehouse: () => switchPage('warehouse'),
  })
```

Make `switchPage` await async render results behind a monotonically increasing navigation token. If a module resolves after navigation changed, call its cleanup immediately and do not install it as `_pageCleanup`.

- [ ] **Step 4: Run automated and Electron checks**

Run: `node --test src/renderer/dashboard/dashboard-farm-integration.test.mjs src/renderer/games/farm/*.test.mjs src/renderer/shared/*.test.mjs`

Manual: open Farm at 800×600 and 600×400; verify no grid clipping, keyboard focus, all confirmation flows, page switching and re-entry.

- [ ] **Step 5: Update docs and commit**

```bash
git add src/renderer/dashboard src/renderer/games/farm docs/progress.md docs/session-log.md
git commit -m "feat: integrate farm field page"
```
