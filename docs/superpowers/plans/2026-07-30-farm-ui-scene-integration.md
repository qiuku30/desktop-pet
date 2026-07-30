# Farm Pixi Scene UI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount the completed snapshot-driven Pixi farm scene in the real farm page while preserving the existing DOM operations, accessibility, business semantics and Pixi → static → DOM fallback chain.

**Architecture:** `farm-module.js` assembles production scene dependencies and injects them into the existing `mountFarm()` controller. `farm-ui.js` owns one persistent scene host, converts every existing view model to an immutable visual snapshot, routes Canvas intents through the same handlers as native DOM controls, and keeps the existing service commands authoritative. The adapter receives only minimal presentation extensions for selected-tile highlighting and tile-positioned effects.

**Tech Stack:** Electron 43, JavaScript ES modules, PixiJS `8.19.0`, DOM/CSS, Node `node:test`, Electron Forge, existing WebP manifest assets.

## Global Constraints

- Keep `mountFarm(container, options) -> cleanup` and farm module `mount(container, options) -> cleanup` public contracts compatible.
- Do not modify FarmService, PetState, farm rules, economic data, timing, reminders, bird rewards or desktop-pet action semantics.
- Do not add events, IPC, npm dependencies, persistence fields or business schema.
- Do not modify loader, manifest/model, processing/order UI, Dashboard, shared, main, assets, package files or trackers.
- Do not display Emoji as the successful Pixi render path.
- Full fallback order is `pixi → static background plus visible native 4×4 grid → current DOM farm`.
- Never stage, commit, merge, push or create a branch without separate explicit ARCH-11/user authorization. The checkpoints below are reports, not Git authorization.
- Use strict TDD: run every named RED test before changing production code, then make the smallest GREEN change.

## File Map

| File | Responsibility |
|------|----------------|
| `src/renderer/games/farm/farm-scene-adapter.js` | Selected-tile presentation and tile-positioned transaction effects |
| `src/renderer/games/farm/farm-scene-adapter.test.mjs` | Adapter selection/effect/lifecycle regression contracts |
| `src/renderer/games/farm/farm-ui.js` | Persistent scene host, mode state, snapshot updates, intent routing and post-commit effects |
| `src/renderer/games/farm/farm-ui.test.mjs` | Existing controller and renderer regressions |
| `src/renderer/games/farm/farm-module.js` | Production URL/fetch/loader/static/adapter dependency assembly |
| `src/renderer/games/farm/farm.css` | Scene-first responsive layout, offscreen mirror and static/DOM fallback presentation |
| `src/renderer/games/farm/farm-scene-integration.test.mjs` | End-to-end controller integration across Pixi/static/DOM modes |

---

### Task 1: Adapter Selection Highlight and Positioned Effects

**Files:**
- Modify: `src/renderer/games/farm/farm-scene-adapter.js:327-353,459-523,611-639`
- Modify: `src/renderer/games/farm/farm-scene-adapter.test.mjs`

**Interfaces:**
- Consumes: existing `adapter.update(snapshot)` with `snapshot.selectedObject`.
- Consumes: existing `adapter.playEffect({ type, tileId?, logicalPosition? })`.
- Produces: one non-texture selection display object in the `interaction` layer.
- Produces: effects positioned at a current tile center, explicit logical position, or manifest record position in that priority order.

- [ ] **Step 1: Write selected-tile RED tests**

Add tests that update the adapter with a full snapshot and assert:

```js
await adapter.update({
  ...sceneSnapshot(),
  selectedObject: { type: 'tile', id: 'r1c2' },
})
const interaction = layerByName(applications[0], 'interaction')
const highlight = interaction.children.find(child => child.label === 'farm-selection-highlight')
assert.ok(highlight)
assert.deepEqual(highlight.positionValue, tileCenter(1, 2))
assert.equal(highlight.visible, true)

await adapter.update({ ...sceneSnapshot(), selectedObject: null })
assert.equal(highlight.visible, false)
```

Also assert the highlight is reused across updates, uses an outline/shape rather than tinting the land texture, becomes invisible for a missing tile ID, and is destroyed by adapter cleanup.

- [ ] **Step 2: Run the selected-tile tests and verify RED**

Run:

```bash
node --test --test-name-pattern="selection highlight" \
  src/renderer/games/farm/farm-scene-adapter.test.mjs
```

Expected: FAIL because the adapter does not create `farm-selection-highlight`.

- [ ] **Step 3: Implement one reusable selection display object**

Create the display object after the fixed layers exist. Prefer `PIXI.Graphics` when available and a non-interactive `PIXI.Container` fallback in test doubles:

```js
function createSelectionHighlight() {
  const highlight = PIXI.Graphics ? new PIXI.Graphics() : new PIXI.Container()
  highlight.label = 'farm-selection-highlight'
  highlight.eventMode = 'none'
  if (typeof highlight.ellipse === 'function') {
    highlight.ellipse(0, 0, 66, 41)
    highlight.stroke({ color: 0xfff0a0, width: 4, alpha: 0.95 })
  }
  highlight.visible = false
  layers.interaction.addChildAt?.(highlight, 0) || layers.interaction.addChild(highlight)
  return highlight
}
```

Label every hit target created by `addIntentTarget()` as `farm-intent-target`. Change `rebuildHitTargets()` to remove and destroy only children with that label; do not truncate the whole interaction layer, because that would destroy the persistent selection highlight. After every current layout reconciliation, resolve only `{ type: 'tile', id }` against `layout.tiles`, set the highlight position to `tile.center`, and hide it otherwise. Do not retain the snapshot object.

- [ ] **Step 4: Run selected-tile tests and verify GREEN**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Write tile-positioned effect RED tests**

Add tests for all three position sources:

```js
await adapter.update(sceneSnapshot())
await adapter.playEffect({ type: 'plant', tileId: 'r2c1' })
assert.deepEqual(effectSprite(applications[0]).positionValue, tileCenter(2, 1))

await adapter.playEffect({
  type: 'harvest',
  logicalPosition: { x: 600, y: 430 },
})
assert.deepEqual(effectSprite(applications[0]).positionValue, { x: 600, y: 430 })

await adapter.playEffect({ type: 'harvest', tileId: 'missing' })
assert.equal(effectCount(applications[0]), 1)
```

The missing tile case must not replace the currently visible effect. Add a destroy-during-load case proving no late effect appears.

- [ ] **Step 6: Run effect tests and verify RED**

Run:

```bash
node --test --test-name-pattern="positioned effect" \
  src/renderer/games/farm/farm-scene-adapter.test.mjs
```

Expected: FAIL because `tileId` and explicit `logicalPosition` are not applied.

- [ ] **Step 7: Implement stable effect positioning**

Store a private primitive-only map of current tile centers after accepted reconciliation:

```js
const tileCenters = new Map()

function replaceTileCenters(layout) {
  tileCenters.clear()
  for (const tile of layout.tiles) {
    tileCenters.set(tile.tileId, Object.freeze({ x: tile.center.x, y: tile.center.y }))
  }
}
```

Resolve an effect position before loading:

```js
function effectPosition(effect, record) {
  if (typeof effect.tileId === 'string') return tileCenters.get(effect.tileId) || null
  if (Number.isFinite(effect.logicalPosition?.x) && Number.isFinite(effect.logicalPosition?.y)) {
    return { x: effect.logicalPosition.x, y: effect.logicalPosition.y }
  }
  return record.logicalPosition || null
}
```

If `tileId` is present but not found, resolve without changing the effect slot. Apply the resolved position after `applyRecord()`. Clear `tileCenters` in `destroy()`.

- [ ] **Step 8: Run adapter regressions**

Run:

```bash
node --test src/renderer/games/farm/farm-scene-adapter.test.mjs
node --check src/renderer/games/farm/farm-scene-adapter.js
git diff --check
```

Expected: all adapter tests PASS, syntax PASS, diff check empty.

- [ ] **Step 9: Report Task 1 checkpoint**

Report the exact RED failures, GREEN count, files changed and confirmation that no shared texture or business object was modified. Do not perform Git writes.

---

### Task 2: Production Scene Dependency Assembly

**Files:**
- Modify: `src/renderer/games/farm/farm-module.js:1-34`
- Create: `src/renderer/games/farm/farm-scene-integration.test.mjs`

**Interfaces:**
- Consumes: `loadFarmScene(options)`.
- Consumes: `createFarmSceneAdapter({ PIXI, container, manifest, onIntent, now })`.
- Consumes: `createFarmSceneStatic({ container, backgroundSrc, hitTargets, onIntent })`.
- Produces: a `sceneRuntime` option passed to `mountFarm()`.

Use this frozen dependency shape:

```js
{
  manifestUrl,
  trustedBackgroundSrc,
  loadScene(options),
  createAdapter(options),
  createStatic(options),
  fetchJson(url),
  staticAvailable({ backgroundSrc }),
  getDevicePixelRatio(),
  createResizeObserver(callback),
  reducedMotionMedia,
}
```

- [ ] **Step 1: Write module assembly RED test**

In `farm-scene-integration.test.mjs`, load `farm-module.js` with its existing production exports and assert that `mountFarm` receives:

```js
assert.match(sceneRuntime.manifestUrl, /\/assets\/farm\/bright-homestead\/farm\.json$/)
assert.match(sceneRuntime.trustedBackgroundSrc, /\/assets\/farm\/bright-homestead\/background\/base\.webp$/)
assert.equal(typeof sceneRuntime.loadScene, 'function')
assert.equal(typeof sceneRuntime.createAdapter, 'function')
assert.equal(typeof sceneRuntime.createStatic, 'function')
assert.equal(typeof sceneRuntime.fetchJson, 'function')
assert.equal(typeof sceneRuntime.staticAvailable, 'function')
```

Use injected module dependencies or a small exported `createFarmSceneRuntime()` pure factory; do not initialize PetState in this test.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test --test-name-pattern="production scene runtime" \
  src/renderer/games/farm/farm-scene-integration.test.mjs
```

Expected: FAIL because the module does not assemble scene dependencies.

- [ ] **Step 3: Implement the production runtime factory**

Add imports for the existing loader, adapter and static renderer. Export a pure factory for tests:

```js
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
      if (!ImageClass || backgroundSrc !== trustedBackgroundSrc) return resolve(false)
      const image = new ImageClass()
      image.onload = () => resolve(true)
      image.onerror = () => resolve(false)
      image.src = backgroundSrc
    }),
    getDevicePixelRatio: () => globalThis.devicePixelRatio || 1,
    createResizeObserver: callback => ResizeObserverClass ? new ResizeObserverClass(callback) : null,
    reducedMotionMedia: matchMediaFn?.('(prefers-reduced-motion: reduce)') || null,
  })
}
```

Pass `sceneRuntime: createFarmSceneRuntime()` to `mountFarm()`. Preserve all existing module initialization order.

- [ ] **Step 4: Verify factory URL and failure behavior**

Add and run cases proving:

- non-OK fetch rejects;
- file-protocol style status `0` with a readable JSON body is accepted;
- trusted background image load resolves `true`, image error and untrusted URL resolve `false`;
- missing `ResizeObserver` returns `null`;
- missing `matchMedia` returns `null`;
- repeated factory calls have no DOM or PetState side effects.

Run:

```bash
node --test src/renderer/games/farm/farm-scene-integration.test.mjs
node --check src/renderer/games/farm/farm-module.js
```

Expected: PASS.

- [ ] **Step 5: Report Task 2 checkpoint**

Report the exact production URLs, factory fields and tests. Do not perform Git writes.

---

### Task 3: Persistent Farm Scene Controller and Shared Intent Paths

**Files:**
- Modify: `src/renderer/games/farm/farm-ui.js:259-319,391-788`
- Modify: `src/renderer/games/farm/farm-ui.test.mjs`
- Modify: `src/renderer/games/farm/farm-scene-integration.test.mjs`

**Interfaces:**
- Consumes: Task 2 `sceneRuntime`.
- Consumes: `buildFarmSceneSnapshot({ viewModel, activeTab, selectedObject, reducedMotion, bird })`.
- Produces: one persistent `.farm-scene-host`.
- Produces: internal `selectTile(tileId)`, `changeTab(tab)`, `handleSceneIntent(intent)` and `execute(command, effect)` paths shared by Canvas and DOM.

- [ ] **Step 1: Write initial render and host persistence RED tests**

Assert:

```js
const cleanup = mountFarm(container, fixtureOptions({ sceneRuntime }))
assert.equal(container.querySelectorAll('.farm-scene-host').length, 1)
assert.equal(container.querySelector('.farm-grid').classList.contains('farm-grid--mirror'), true)
assert.equal(visibleEmojiGrid(container), false)

emitFarmStateChanged()
assert.equal(container.querySelector('.farm-scene-host'), firstHost)
assert.equal(sceneAdapter.mountCalls, 1)
```

Also assert loading mode has the trusted background class before the loader Promise resolves.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test --test-name-pattern="persistent scene host|loading background" \
  src/renderer/games/farm/farm-scene-integration.test.mjs
```

Expected: FAIL because `mountFarm()` does not create or preserve a scene host.

- [ ] **Step 3: Add scene state and persistent host insertion**

Extend `mountFarm()` options with `sceneRuntime = null`. Create the host once through `documentRef.createElement('div')`, and retain:

```js
let sceneMode = sceneRuntime ? 'loading' : 'dom'
let sceneController = null
let sceneLoadPromise = null
let resizeObserver = null
let reducedMotion = sceneRuntime?.reducedMotionMedia?.matches === true
const sceneHost = sceneRuntime ? documentRef.createElement('div') : null
sceneHost?.classList.add('farm-scene-host')
```

Render a `.farm-scene-slot` and `.farm-grid--mirror`. Before replacing `container.innerHTML`, detach `sceneHost`; after rendering, append the same host to the new slot. Never clone or recreate it.

- [ ] **Step 4: Write loader mode RED tests**

Cover:

```js
resolveLoader({ mode: 'pixi', adapter })
assert.equal(sceneMode(container), 'pixi')
assert.equal(nativeGridVisibility(container), 'offscreen')

resolveLoader({ mode: 'static', backgroundSrc })
assert.equal(sceneMode(container), 'static')
assert.equal(nativeGridVisibility(container), 'visible')

resolveLoader({ mode: 'dom', error: new Error('failed') })
assert.equal(sceneMode(container), 'dom')
assert.equal(nativeGridVisibility(container), 'visible')
```

For static mode assert `createStatic().mount()` runs once and its root is destroyed on cleanup. For a late loader resolution after cleanup, assert no adapter/static mount and no DOM mutation.

- [ ] **Step 5: Implement scene loading and mode activation**

Call `sceneRuntime.loadScene()` once with:

```js
{
  manifestUrl: sceneRuntime.manifestUrl,
  fetchJson: sceneRuntime.fetchJson,
  trustedBackgroundSrc: sceneRuntime.trustedBackgroundSrc,
  staticAvailable: sceneRuntime.staticAvailable,
  createAdapter: ({ PIXI, manifest }) => sceneRuntime.createAdapter({
    PIXI,
    container: sceneHost,
    manifest,
    onIntent: handleSceneIntent,
    now,
  }),
}
```

On `pixi`, store the mounted adapter. On `static`, call `sceneRuntime.createStatic({ container: sceneHost, backgroundSrc: result.backgroundSrc, hitTargets: [], onIntent: handleSceneIntent })` and mount it once; the visible native grid supplies tile operations. On `dom`, leave the current grid visible. Every continuation checks `disposed` and the captured generation.

- [ ] **Step 6: Write shared intent path RED tests**

Cover exact parity:

```js
sceneIntent({ type: 'select-tile', tileId: 'r0c0' })
assert.equal(selectedPanel(container), panelFor('r0c0'))

sceneIntent({ type: 'open-processing' })
assert.equal(activeFarmTab(container), 'processing')

clickTopTab('orders')
assert.equal(activeFarmTab(container), 'orders')

sceneIntent({ type: 'claim-bird', birdId: currentBirdId })
assert.equal(service.claimBird.calls.length, 1)

sceneIntent({ type: 'click-pet' })
assert.match(liveFeedback(container), /奶油星团/)
assert.equal(petState.setCalls.length, 0)
```

Add a move-building case proving Canvas tile selection uses the existing target eligibility and service call.

- [ ] **Step 7: Refactor shared UI handlers**

Extract controller-local functions without changing service calls:

```js
function changeTab(nextTab) { /* existing tab mutation + render */ }
function selectTile(tileId) { /* existing move target or selectedTileId path */ }
function handleSceneIntent(intent) {
  if (intent.type === 'select-tile') return selectTile(intent.tileId)
  if (intent.type === 'open-processing') return changeTab('processing')
  if (intent.type === 'open-orders') return changeTab('orders')
  if (intent.type === 'claim-bird') return claimCurrentBird(intent.birdId)
  if (intent.type === 'click-pet') {
    feedback = '奶油星团正在陪你照看农场。'
    render()
  }
}
```

The DOM click handler delegates to `changeTab()` and `selectTile()` instead of repeating those branches.

- [ ] **Step 8: Add snapshot update and pause state**

After each field render:

```js
const visualSnapshot = buildFarmSceneSnapshot({
  viewModel: vm,
  activeTab,
  selectedObject: selectedTileId ? { type: 'tile', id: selectedTileId } : null,
  reducedMotion,
  bird: {
    birdId: currentBird?.birdId || null,
    visible: Boolean(currentBird),
    claimBusy: birdClaimBusy,
  },
})
void sceneController?.update?.(visualSnapshot)
sceneController?.setPaused?.(activeTab !== 'field' || documentRef?.hidden === true)
sceneController?.setReducedMotion?.(reducedMotion)
```

Observe scene slot size and call `resize(width, height, dpr)`. Media-query changes update reduced motion. Visibility changes update both bird scheduler and scene pause state.

- [ ] **Step 9: Add post-commit effect RED tests**

For every field mutation category, test success and failure. Minimum assertions:

```js
await clickPlant()
assert.deepEqual(sceneAdapter.effects, [{ type: 'plant', tileId: 'r0c0' }])

service.harvest.result = { ok: false, error: 'CROP_NOT_MATURE' }
await clickHarvest()
assert.deepEqual(sceneAdapter.effects, [])

const pending = deferred()
service.upgradeLand.result = pending.promise
clickUpgrade()
cleanup()
pending.resolve({ ok: true })
await pending.promise
assert.deepEqual(sceneAdapter.effects, [])
```

Cover `unlock-land`, `upgrade-land`, `building-change`, center `harvest`, and bird `coins`. Processing/order effects remain absent.

- [ ] **Step 10: Implement effect descriptors in the existing mutation wrapper**

Change only the UI wrapper signature:

```js
const execute = async (command, effect = null) => {
  // existing settlement, command and feedback flow
  if (result.ok && effect && !disposed && callGeneration === generation) {
    void Promise.resolve(sceneController?.playEffect?.(effect)).catch(() => {})
  }
}
```

Pass descriptors from existing DOM action branches. Resolve a building ID to its current tile before upgrade/demolish. Use the move target tile for movement. Use `{ type: 'harvest', logicalPosition: { x: 600, y: 430 } }` for harvest-all.

In successful bird claim, call without delaying the business completion path:

```js
void Promise.resolve(sceneController?.playEffect?.({
  type: 'coins',
  logicalPosition: { x: 930, y: 160 },
})).catch(() => {})
```

Do not await visual feedback before releasing the business busy lock; observe visual Promise rejection so it cannot become unhandled.

- [ ] **Step 11: Write cleanup and rapid-switch RED tests**

Assert:

- adapter/static destroy exactly once;
- ResizeObserver disconnect exactly once;
- media listener removed;
- scene host removed;
- late loader/update/effect callbacks cannot render;
- 20 field → processing → orders → field cycles keep one host and one adapter;
- page cleanup after the cycles leaves zero canvas.

- [ ] **Step 12: Implement complete cleanup**

Invalidate generation first, then:

```js
resizeObserver?.disconnect?.()
sceneRuntime?.reducedMotionMedia?.removeEventListener?.('change', onReducedMotionChange)
sceneController?.destroy?.()
sceneController = null
sceneHost?.remove()
```

Keep existing interval, EventBus, PetState, bird scheduler, overlay and child-tab cleanup in the same idempotent function.

- [ ] **Step 13: Run controller integration regressions**

Run:

```bash
node --test \
  src/renderer/games/farm/farm-scene-integration.test.mjs \
  src/renderer/games/farm/farm-ui.test.mjs \
  src/renderer/games/farm/farm-scene-model.test.mjs \
  src/renderer/games/farm/farm-scene-loader.test.mjs \
  src/renderer/games/farm/farm-scene-static.test.mjs \
  src/renderer/games/farm/farm-scene-adapter.test.mjs
node --check src/renderer/games/farm/farm-ui.js
git diff --check
```

Expected: all PASS.

- [ ] **Step 14: Report Task 3 checkpoint**

Report mode matrix, intent parity, effect matrix, cleanup counts, exact files and any observed environment-only Electron failure. Do not perform Git writes.

---

### Task 4: Scene-First Responsive CSS and Accessible Mirror

**Files:**
- Modify: `src/renderer/games/farm/farm.css:105-220,331-358`
- Modify: `src/renderer/games/farm/farm-ui.js:207-319`
- Modify: `src/renderer/games/farm/farm-ui.test.mjs`
- Modify: `src/renderer/games/farm/farm-scene-integration.test.mjs`

**Interfaces:**
- Consumes DOM state classes: `farm-workspace--panel-open`, `farm-scene--loading|pixi|static|dom`, `farm-grid--mirror`.
- Produces the approved wide side panel and narrow bottom drawer.

- [ ] **Step 1: Extend the Chromium layout harness with four scheme-C RED cases**

Render and measure:

1. 800×600 unselected;
2. 800×600 selected;
3. 600×400 unselected;
4. 600×400 selected.

Assert:

```js
assert.ok(unselected.scene.width > selected.scene.width)
assert.ok(wideSelected.actions.left >= wideSelected.scene.right - epsilon)
assert.ok(narrowSelected.actions.top >= narrowSelected.scene.top)
assert.ok(narrowSelected.actions.bottom <= narrowSelected.workspace.bottom + epsilon)
assert.ok(layout.contentScrollWidth <= layout.contentClientWidth)
assert.ok(layout.scene.width >= layout.sceneHitRegion.width)
```

Also assert the loading/Pixi mirror is offscreen but focusable, while static/DOM grids are visible and inside the workspace.

- [ ] **Step 2: Run Chromium test and verify RED**

Run:

```bash
FARM_LAYOUT_DIAGNOSTICS=1 node --test \
  --test-name-pattern="responsive layout contracts" \
  src/renderer/games/farm/farm-ui.test.mjs
```

Expected: FAIL because the current workspace is always fixed two-column.

- [ ] **Step 3: Implement scene-first layout states**

Use:

```css
.farm-workspace {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.farm-workspace--panel-open {
  grid-template-columns: minmax(0, 1fr) minmax(190px, 28%);
}
.farm-scene-slot,
.farm-grid--mirror { grid-column: 1; grid-row: 1; }
.farm-scene-slot,
.farm-scene-host { min-width: 0; min-height: 0; width: 100%; height: 100%; }
.farm-scene-host canvas { display: block; width: 100%; height: 100%; }
.farm-scene--dom .farm-scene-slot { display: none; }
```

In static mode the visible native grid overlays the trusted background in the same grid area. In DOM mode the scene slot is hidden and the native grid owns that area. Add warm scene loading/static backgrounds using the approved base image URL. Do not embed review composites as runtime backgrounds.

- [ ] **Step 4: Implement the narrow bottom drawer**

Within the existing narrow media query:

```css
.farm-workspace--panel-open { grid-template-columns: minmax(0, 1fr); }
.farm-workspace--panel-open .farm-actions {
  position: absolute;
  z-index: 6;
  left: 6px;
  right: 6px;
  bottom: 6px;
  max-height: 38%;
  overflow-y: auto;
}
```

Add a native close button with `data-action="close-actions"` and an accessible label. It clears `selectedTileId`, exits move mode and rerenders.

- [ ] **Step 5: Implement the offscreen mirror without disabling focus**

Use a visually-hidden pattern only in loading/Pixi:

```css
.farm-scene--loading .farm-grid--mirror,
.farm-scene--pixi .farm-grid--mirror {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  clip-path: inset(50%);
  overflow: hidden;
  white-space: nowrap;
}
.farm-scene--static .farm-grid--mirror,
.farm-scene--dom .farm-grid--mirror {
  position: relative;
  width: auto;
  height: auto;
  clip-path: none;
}
```

Add delegated `focusin` handling for `.farm-tile` that calls `selectTile(tileId)`. Do not create 16 per-render listeners.

- [ ] **Step 6: Run responsive and accessibility regressions**

Run:

```bash
node --test \
  src/renderer/games/farm/farm-ui.test.mjs \
  src/renderer/games/farm/farm-scene-integration.test.mjs
node --check src/renderer/games/farm/farm-ui.js
git diff --check
```

Expected: all PASS in a GUI-capable Electron environment.

- [ ] **Step 7: Report Task 4 checkpoint**

Report measured rectangles for all four states, focus behavior and fallback grid visibility. Do not perform Git writes.

---

### Task 5: Full Regression, Packaged Runtime and Handoff

**Files:**
- Verify only the seven authorized files.
- Do not modify trackers in this implementation window.

**Interfaces:**
- Produces: a complete implementation delivery report for ARCH-11.

- [ ] **Step 1: Run all farm and Dashboard integration tests**

Run:

```bash
node --test \
  src/renderer/games/farm/*.test.mjs \
  src/renderer/dashboard/dashboard-farm-integration.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run full repository tests in the correct environment**

Run:

```bash
node --test
```

If the Chromium child exits before assertions with the known sandbox/GPU signal, rerun the same command with GUI permission. Record both results and do not count the environment-only attempt as a code failure or pass.

- [ ] **Step 3: Run syntax, scope and architecture checks**

Run:

```bash
node --check src/renderer/games/farm/farm-module.js
node --check src/renderer/games/farm/farm-ui.js
node --check src/renderer/games/farm/farm-scene-adapter.js
git diff --check
git status --short
rg -n "FarmService|PetState|setMany|localStorage|node:fs|renderFieldGrid" \
  src/renderer/games/farm/farm-scene-adapter.js
```

Expected: syntax and diff checks PASS; adapter has no business/storage imports; Git status contains only the seven authorized files.

- [ ] **Step 4: Package the application**

Run:

```bash
npm run package
```

Expected: Electron Forge package succeeds and the generated app.asar contains the seven production/test files as applicable, Pixi distribution and `bright-homestead/farm.json`.

- [ ] **Step 5: Run a same-app.asar visible Electron probe**

Use a temporary harness outside the repository. Load the packaged `dashboard.html` with the packaged preload and verify:

- real farm page enters `pixi`;
- initial background appears before Pixi resolves;
- 800×600 unselected/selected side-panel layout;
- 600×400 unselected/selected bottom-drawer layout;
- Canvas `sendInputEvent` emits all five intents;
- native keyboard focus selects the same tile and moves the Pixi highlight;
- successful plant/harvest produces one correctly positioned effect;
- failed transaction produces no effect;
- processing/orders scene entries and top tabs both work;
- visibility/reduced motion pause and resume ticker;
- 20 rapid tab cycles retain one Application and one Canvas;
- page round trip cleanup leaves zero Canvas;
- injected critical failure enters static with visible native grid;
- injected static failure enters DOM with all existing operations;
- late loader/update/effect resolve or reject after cleanup causes no mutation and no unhandled rejection.

Delete the temporary harness after recording results. Do not modify production code to satisfy a harness-only model.

- [ ] **Step 6: Inspect the visible result**

At both 800×600 and 600×400, visually verify:

- no Emoji grid flashes before Pixi;
- scene remains the default visual focus;
- selected outline identifies the same DOM tile;
- wide panel does not overlay the field;
- narrow drawer remains bounded and scrollable;
- static and DOM fallbacks remain legible and operable;
- processing/orders pages are unchanged in this task.

- [ ] **Step 7: Deliver to ARCH-11**

Report:

- all seven files;
- no out-of-scope edits;
- user-visible behavior;
- mode/fallback matrix;
- exact test totals;
- packaged probe environment and results;
- 800×600/600×400 measurements;
- cleanup and late-Promise results;
- new events/IPC/dependencies/persistence/schema: all none;
- known issues;
- Git status and confirmation of no stage/commit/merge/push/branch.

Reply `收尾完毕`.
