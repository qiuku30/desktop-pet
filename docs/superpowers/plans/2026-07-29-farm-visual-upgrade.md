# Farm Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans`, `test-driven-development`, and `verification-before-completion` to implement this plan task-by-task. Do not use subagents unless ARCH-11 and the user explicitly authorize them. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the farm’s Emoji-and-card presentation with an original, bright, volumetric 2D cartoon farm scene while preserving every existing farm transaction, timer, lifecycle and pet-animation semantic.

**Architecture:** Existing FarmService, PetState, EventBus and pure rule modules remain authoritative. A narrow PixiJS v8 scene adapter consumes immutable visual snapshots and emits user intents; DOM remains responsible for HUD, processing, orders, confirmations, accessibility and the fully functional fallback. Art validation precedes runtime integration, and every later task depends on the approved vertical slice.

**Tech Stack:** Electron 43, JavaScript ES modules, PixiJS `8.19.0`, DOM/CSS, Node `node:test`, AI-assisted original WebP/PNG assets, JSON manifests.

## Global Constraints

- Read `AGENTS.md`, `docs/architecture.md`, `specs/farm-system.md`, `docs/superpowers/specs/2026-07-26-farm-system-design.md`, `docs/superpowers/specs/2026-07-29-farm-visual-upgrade-design.md`, `src/renderer/games/farm/DESIGN.md`, and `docs/progress.md` before acting.
- Before code or asset production, report intended functions, interface, data, events, IPC, dependencies and persistence to ARCH-11 and wait for confirmation.
- Do not change farm economy, timing, schema v1, transaction ordering, reminder semantics, pet idle/sleep/feed semantics or the `4×4` map.
- `FarmService` remains the only farm mutation authority; PixiJS must never read or write PetState.
- Do not add IPC channels, persistent fields, business events or a Godot/Unity runtime.
- The camera is fixed; no pan, zoom, free placement, pathfinding or decoration editor.
- Processing and orders remain DOM interfaces; the scene and top tabs are two entrances to the same pages.
- All art is original. Do not copy or trace protected QQ Farm, Hay Day or other game assets.
- Every continuous animation respects `prefers-reduced-motion` and page visibility.
- Every async load, effect and confirmation has a generation/disposal guard.
- Failure chain is `full Pixi scene → static scene with DOM operations → current functional DOM farm`.
- Validate at `800×600` and `600×400`.
- Different implementation windows must not modify the same file concurrently.
- Do not commit, merge or push without explicit user approval.

---

## File and Window Decomposition

| Window | Purpose | Exclusive production files |
|---|---|---|
| `farm-art-01` | Art bible and vertical slice | `src/renderer/assets/farm/bright-homestead/**` |
| `farm-visual-01` | Pixi dependency, manifest, snapshot and adapter prototype | `package.json`, `package-lock.json`, new `farm-scene-*.js`, matching tests |
| `farm-visual-02` | Full field scene and farm UI integration | scene component files, `farm-ui.js`, `farm-module.js`, `farm.css`, matching tests |
| `farm-visual-03` | Processing/orders visual redesign and shared item icons | `farm-processing-ui.js`, `farm-orders-ui.js`, their tests, dedicated farm workshop/order CSS |
| `farm-visual-04` | Warehouse/shop/reminder icon integration and final fallback verification | authorized Dashboard/pet/shared files, integration tests, farm design doc |

Tracker documents remain ARCH-11-owned during implementation. ARCH-11 updates `PROJECT_BRIEF.md`, `docs/progress.md` and `docs/session-log.md` after independently verifying each delivery.

---

### Task 1: Art Bible and Vertical Slice

**Files:**
- Create: `src/renderer/assets/farm/bright-homestead/farm.json`
- Create: `src/renderer/assets/farm/bright-homestead/README.md`
- Create: `src/renderer/assets/farm/bright-homestead/reference/art-bible.md`
- Create: `src/renderer/assets/farm/bright-homestead/reference/scene-composition.webp`
- Create: `src/renderer/assets/farm/bright-homestead/background/base.webp`
- Create: `src/renderer/assets/farm/bright-homestead/land/land-1.webp`
- Create: `src/renderer/assets/farm/bright-homestead/crops/wheat/stage-1.webp`
- Create: `src/renderer/assets/farm/bright-homestead/crops/wheat/stage-2.webp`
- Create: `src/renderer/assets/farm/bright-homestead/crops/wheat/stage-3.webp`
- Create: `src/renderer/assets/farm/bright-homestead/crops/wheat/stage-4.webp`
- Create: `src/renderer/assets/farm/bright-homestead/buildings/sprinkler/level-1.webp`
- Create: `src/renderer/assets/farm/bright-homestead/buildings/sprinkler/level-2.webp`
- Create: `src/renderer/assets/farm/bright-homestead/buildings/sprinkler/level-3.webp`
- Create: `src/renderer/assets/farm/bright-homestead/pet/idle.webp`
- Create: `src/renderer/assets/farm/bright-homestead/effects/plant.webp`
- Create: `src/renderer/assets/farm/bright-homestead/effects/harvest.webp`
- Create: `src/renderer/assets/farm/bright-homestead/ui/recipe-cookie.webp`
- Create: `src/renderer/assets/farm/bright-homestead/ui/order-paper.webp`
- Create: `src/renderer/assets/farm/bright-homestead/review/vertical-slice-800x600.webp`
- Create: `src/renderer/assets/farm/bright-homestead/review/vertical-slice-600x400.webp`
- Create: `src/renderer/assets/farm/bright-homestead/review/alpha-audit.txt`

**Interfaces:**
- Produces: schema-v1 `farm.json` with engine-neutral assets, logical coordinates, anchors and animation frame metadata.
- Consumes: no production code and no farm state.

- [ ] **Step 1: Lock the art bible**

Write `art-bible.md` with exact values for:

```markdown
- Logical canvas: 1200 × 720
- Camera: fixed three-quarter top-down
- Key light: upper-left, warm neutral
- Shadows: lower-right, soft edge, 22–32% opacity
- Object outline: warm dark brown, never pure black
- Tile footprint: 132 × 82 logical pixels
- Crop root anchor: (0.5, 0.88)
- Building ground anchor: (0.5, 0.90)
- Export: lossless WebP, transparent objects, sRGB
- Safe minimum: object silhouette remains identifiable at 600×400 dashboard size
```

- [ ] **Step 2: Generate and clean the vertical-slice assets**

Create only the files listed above. Keep wheat stages on the same footprint and root anchor. Keep sprinkler levels on the same ground anchor and light direction. Remove opaque halos and disconnected AI artifacts.

- [ ] **Step 3: Write the schema-v1 manifest**

Use this exact top-level shape:

```json
{
  "schemaVersion": 1,
  "skinId": "bright-homestead",
  "logicalSize": { "width": 1200, "height": 720 },
  "background": { "src": "background/base.webp" },
  "land": {},
  "crops": {},
  "buildings": {},
  "pet": {},
  "effects": {},
  "ui": {}
}
```

Asset records use:

```json
{
  "src": "crops/wheat/stage-1.webp",
  "anchor": { "x": 0.5, "y": 0.88 },
  "logicalPosition": { "x": 0, "y": 0 }
}
```

- [ ] **Step 4: Audit alpha and visual consistency**

Render every transparent asset over white, black and checker backgrounds. Record dimensions, alpha bounds and failures in `alpha-audit.txt`. Reject the slice if crop roots drift, shadows point in different directions, or the small-size render loses stage readability.

- [ ] **Step 5: Produce two review composites**

Render the same scene at actual `800×600` and `600×400` Dashboard content sizes. Include one land tile, four wheat stages, three sprinkler levels, the pet, one planting effect, one harvest effect, one recipe card and one order paper.

- [ ] **Step 6: ARCH-11 visual gate**

Expected: user and ARCH-11 explicitly approve the vertical slice. If rejected twice for perspective, light or cross-stage consistency, stop and report the need for an external 2D artist. Do not begin Task 2.

---

### Task 2: Manifest Validation and Visual Snapshot Contract

**Files:**
- Create: `src/renderer/games/farm/farm-scene-manifest.mjs`
- Create: `src/renderer/games/farm/farm-scene-manifest.test.mjs`
- Create: `src/renderer/games/farm/farm-scene-model.mjs`
- Create: `src/renderer/games/farm/farm-scene-model.test.mjs`

**Interfaces:**
- Produces: `validateFarmSceneManifest(manifest) -> string[]`.
- Produces: `buildFarmSceneSnapshot({ viewModel, activeTab, selectedObject, reducedMotion, bird }) -> FarmSceneSnapshot`.
- Produces: `cropStageFor(crop, now) -> 1|2|3|4`.
- Consumes: existing `buildFarmViewModel()` output only.

- [ ] **Step 1: Write manifest RED tests**

```js
test('approved vertical-slice manifest validates', () => {
  assert.deepEqual(validateFarmSceneManifest(validManifest), [])
})

test('validator rejects unsafe path and invalid anchor', () => {
  const broken = structuredClone(validManifest)
  broken.crops.wheat.stages[0].src = '../outside.webp'
  broken.crops.wheat.stages[0].anchor.x = 2
  assert.deepEqual(validateFarmSceneManifest(broken), [
    'UNSAFE_ASSET_PATH:crops.wheat.stages.0',
    'INVALID_ANCHOR:crops.wheat.stages.0',
  ])
})
```

- [ ] **Step 2: Run the manifest test and verify RED**

Run: `node --test src/renderer/games/farm/farm-scene-manifest.test.mjs`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict manifest validation**

Validate schema version, skin ID, logical size, relative in-skin paths, anchors in `[0,1]`, positive frame durations and the schema-v1 minimum renderable baseline: background, land level 1, four wheat stages, three sprinkler levels, pet idle, plant/harvest effects, recipe cookie and order paper. This Task does not introduce a `fallback` field or pretend crop/building art is a neutral placeholder; dedicated project-owned neutral fallback assets and any manifest evolution require a later ARCH-11 decision. Return stable error strings; do not throw for content errors.

- [ ] **Step 4: Write snapshot RED tests**

```js
test('scene snapshot is visual-only and immutable', () => {
  const snapshot = buildFarmSceneSnapshot({
    viewModel,
    activeTab: 'field',
    selectedObject: { type: 'tile', id: 'r1c1' },
    reducedMotion: false,
    bird: null,
  })
  assert.equal(snapshot.tiles.length, 16)
  assert.equal(snapshot.tiles[0].coins, undefined)
  assert.equal(snapshot.tiles[0].cropStage, 2)
  assert.deepEqual(viewModel, originalViewModel)
})
```

Stage boundaries are:

```js
progress < 0.10 => 1
progress < 0.40 => 2
progress < 0.75 => 3
otherwise      => 4
```

Mature crops always return stage 4.

- [ ] **Step 5: Run snapshot tests and verify RED**

Run: `node --test src/renderer/games/farm/farm-scene-model.test.mjs`
Expected: FAIL because exports are missing.

- [ ] **Step 6: Implement the pure snapshot adapter**

Return only the approved design fields. Freeze the returned root and tile array in tests; never include inventory, prices, FarmService functions or PetState.

- [ ] **Step 7: Run GREEN**

Run:

```bash
node --test src/renderer/games/farm/farm-scene-manifest.test.mjs \
  src/renderer/games/farm/farm-scene-model.test.mjs
```

Expected: all tests PASS.

---

### Task 3: PixiJS Prototype and Three-Level Fallback

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/renderer/games/farm/farm-scene-adapter.js`
- Create: `src/renderer/games/farm/farm-scene-adapter.test.mjs`
- Create: `src/renderer/games/farm/farm-pixi-runtime.js`
- Create: `src/renderer/games/farm/farm-pixi-runtime.test.mjs`
- Create: `src/renderer/games/farm/farm-scene-loader.js`
- Create: `src/renderer/games/farm/farm-scene-loader.test.mjs`
- Create: `src/renderer/games/farm/farm-scene-static.js`
- Create: `src/renderer/games/farm/farm-scene-static.test.mjs`

**Interfaces:**
- Produces: `createFarmSceneAdapter({ PIXI, container, manifest, onIntent, now })`.
- Produces: `loadPixiRuntime() -> Promise<typeof import('pixi.js')>`.
- Adapter methods: `mount`, `update`, `resize`, `setPaused`, `setReducedMotion`, `playEffect`, `destroy`.
- Produces: `loadFarmScene({ manifestUrl, importPixi, fetchJson, loadAssets }) -> { mode, adapter?, manifest?, error? }`.
- Modes: `'pixi' | 'static' | 'dom'`.

- [ ] **Step 1: Add the approved dependency**

Run:

```bash
npm install pixi.js@8.19.0 --save-exact
```

Expected: `package.json` contains `"pixi.js": "8.19.0"` under `dependencies`, and the lockfile changes only for PixiJS and its transitive dependencies.

- [ ] **Step 2: Prove Pixi runtime resolution before adapter work**

This repository has no Vite/Webpack and renderer modules load from `file:` URLs. Do not use an unresolved browser bare import. Implement a single runtime boundary:

```js
export async function loadPixiRuntime() {
  return import(new URL('../../../../node_modules/pixi.js/dist/pixi.mjs', import.meta.url).href)
}
```

First inspect the installed package and use its actual documented ESM distribution entry. Add a test that calls the boundary in Node and asserts `Application`, `Assets`, `Container`, `Sprite` and `Texture` exports. Then run:

```bash
node --test src/renderer/games/farm/farm-pixi-runtime.test.mjs
npm run package
```

Launch the packaged app and confirm the renderer can load the same entry from inside the packaged application. If development or packaged resolution fails, stop and report two explicit alternatives to ARCH-11: add a minimal bundler, or vendor the exact MIT-licensed Pixi distribution with license notice. Do not scatter `node_modules` paths across production files.

- [ ] **Step 3: Write adapter lifecycle RED tests**

Use an injected fake PIXI application:

```js
test('destroy is idempotent and blocks late load/update', async () => {
  const late = deferred()
  const adapter = createFarmSceneAdapter({
    PIXI: fakePixi({ init: late.promise }),
    container,
    manifest,
    onIntent: intent => intents.push(intent),
  })
  const mounting = adapter.mount()
  adapter.destroy()
  late.resolve()
  await mounting
  adapter.update(snapshot)
  assert.equal(container.children.length, 0)
  assert.equal(fakeApp.destroyCalls, 1)
  assert.deepEqual(intents, [])
})
```

Cover pause/resume, reduced motion, resize with DPR clamped to `2`, and click intents without state mutation.

- [ ] **Step 4: Run adapter tests and verify RED**

Run: `node --test src/renderer/games/farm/farm-scene-adapter.test.mjs`
Expected: FAIL because the adapter is missing.

- [ ] **Step 5: Implement the minimal Pixi adapter**

Initialize asynchronously:

```js
const app = new PIXI.Application()
await app.init({
  backgroundAlpha: 0,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(devicePixelRatio || 1, 2),
})
```

Create fixed containers named `background`, `ground`, `objects`, `characters`, `effects`, and `interaction`. Do not implement all crops in this task; render only the approved vertical slice.

- [ ] **Step 6: Write fallback RED tests**

```js
test('critical texture failure chooses static mode', async () => {
  const result = await loadFarmScene({
    manifestUrl,
    importPixi: async () => PIXI,
    fetchJson: async () => manifest,
    loadAssets: async () => { throw new Error('critical texture') },
    staticAvailable: true,
  })
  assert.equal(result.mode, 'static')
})

test('manifest and static failure chooses functional DOM mode', async () => {
  const result = await loadFarmScene({
    fetchJson: async () => { throw new Error('manifest') },
    staticAvailable: false,
  })
  assert.equal(result.mode, 'dom')
})
```

- [ ] **Step 7: Implement loader and static renderer**

The loader must distinguish critical and optional assets. Static mode uses `background/base.webp` and DOM hit targets; DOM mode delegates to the existing `renderFieldGrid()` and action panel.

- [ ] **Step 8: Verify the prototype**

Run:

```bash
node --test src/renderer/games/farm/farm-pixi-runtime.test.mjs \
  src/renderer/games/farm/farm-scene-*.test.mjs
node --check src/renderer/games/farm/farm-scene-adapter.js
git diff --check
```

Manual: mount/unmount 20 times, resize continuously, hide/show the page, inject one critical texture failure and one optional decoration failure.

- [ ] **Step 9: ARCH-11 technical gate**

Report development and packaged runtime resolution, measured initial-load time, steady ticker behavior, renderer type, maximum canvas pixel size, cleanup results and fallback behavior. Stop if the runtime cannot load from the packaged app or the prototype cannot remain responsive at both required window sizes.

---

### Task 4: Full Farm Scene Assets and Components

**Files:**
- Modify: `src/renderer/assets/farm/bright-homestead/farm.json`
- Create/Modify: `src/renderer/assets/farm/bright-homestead/background/**`
- Create/Modify: `src/renderer/assets/farm/bright-homestead/land/**`
- Create/Modify: `src/renderer/assets/farm/bright-homestead/crops/**`
- Create/Modify: `src/renderer/assets/farm/bright-homestead/buildings/**`
- Create/Modify: `src/renderer/assets/farm/bright-homestead/pet/**`
- Create/Modify: `src/renderer/assets/farm/bright-homestead/bird/**`
- Create/Modify: `src/renderer/assets/farm/bright-homestead/effects/**`
- Create: `src/renderer/games/farm/farm-scene-layout.mjs`
- Create: `src/renderer/games/farm/farm-scene-layout.test.mjs`
- Create: `src/renderer/games/farm/farm-scene-objects.js`
- Create: `src/renderer/games/farm/farm-scene-objects.test.mjs`
- Modify: `src/renderer/games/farm/farm-scene-adapter.js`
- Modify: `src/renderer/games/farm/farm-scene-adapter.test.mjs`

**Interfaces:**
- Produces: `layoutFarmScene(snapshot, logicalSize) -> SceneLayout`.
- Produces: object factories `createLandObject`, `createCropObject`, `createBuildingObject`, `createPetObject`, `createBirdObject`.
- Consumes: approved schema-v1 manifest and Task 2 snapshot.

- [ ] **Step 1: Produce the approved complete asset set**

Create all six crops with four stages, three land levels, locked/eligible land, three buildings with three levels and work states, pet idle frames, bird frames and transaction effects. Re-run alpha audit and small-size composites.

- [ ] **Step 2: Write deterministic layout RED tests**

```js
test('sixteen tiles stay inside the safe scene rectangle', () => {
  const layout = layoutFarmScene(snapshot, { width: 1200, height: 720 })
  assert.equal(layout.tiles.length, 16)
  for (const tile of layout.tiles) {
    assert.ok(tile.hitArea.x >= 0)
    assert.ok(tile.hitArea.y >= 0)
    assert.ok(tile.hitArea.x + tile.hitArea.width <= 1200)
    assert.ok(tile.hitArea.y + tile.hitArea.height <= 720)
  }
})
```

Assert unique hit areas, stable tile order, processing/order building positions outside tile hit areas, and pet not covering any field center.

- [ ] **Step 3: Implement fixed layout**

Store scene coordinates in the skin manifest; `layoutFarmScene()` validates and converts them into immutable render records. Do not infer business adjacency from screen coordinates.

- [ ] **Step 4: Write object update RED tests**

Assert that changing wheat stage swaps texture without recreating the container, building work state toggles only its local animation, and reduced motion freezes all continuous transforms.

- [ ] **Step 5: Implement object factories and keyed reconciliation**

Key scene objects by `tileId`, building ID, pet ID and bird ID. Reuse objects across updates; remove and destroy only disappeared objects. One object failure uses its neutral in-skin fallback texture.

- [ ] **Step 6: Implement effects after commit**

Supported effects:

```js
{ type: 'plant', tileId }
{ type: 'harvest', tileId, itemId, quantity }
{ type: 'coins', fromObjectId, amount }
{ type: 'unlock-land', tileId }
{ type: 'upgrade-land', tileId, level }
{ type: 'building-change', tileId, action }
{ type: 'processing-complete' }
{ type: 'order-complete', orderId }
```

Effects are cancellable on destroy and never mutate scene snapshots.

- [ ] **Step 7: Run asset, layout and scene tests**

Run:

```bash
node --test src/renderer/games/farm/farm-scene-*.test.mjs
git diff --check
```

Expected: all PASS and every manifest asset exists.

---

### Task 5: Farm UI Integration and Accessible DOM Mirror

**Files:**
- Modify: `src/renderer/games/farm/farm-ui.js`
- Modify: `src/renderer/games/farm/farm-ui.test.mjs`
- Modify: `src/renderer/games/farm/farm-module.js`
- Modify: `src/renderer/games/farm/farm.css`
- Create: `src/renderer/games/farm/farm-scene-integration.test.mjs`

**Interfaces:**
- Consumes: `loadFarmScene()`, `buildFarmSceneSnapshot()`, scene adapter lifecycle.
- Produces: existing `mountFarm(...) -> cleanup` contract unchanged.

- [ ] **Step 1: Write integration RED tests**

Cover:

```js
test('scene tile intent selects the same DOM action panel', async () => {})
test('scene processing building opens the existing processing tab', async () => {})
test('top processing tab remains usable in DOM fallback mode', async () => {})
test('successful harvest plays effect after service resolves', async () => {})
test('failed harvest never plays success effect', async () => {})
test('cleanup destroys scene once and blocks late render', async () => {})
test('keyboard focus mirrors scene selection highlight', async () => {})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test src/renderer/games/farm/farm-scene-integration.test.mjs`
Expected: FAIL because `mountFarm` does not mount a scene adapter.

- [ ] **Step 3: Integrate without changing service commands**

Mount the scene inside a dedicated `.farm-scene-host`. Convert existing view model to the visual snapshot after every existing render. Map scene intents to the same selection/tab handlers used by DOM controls.

- [ ] **Step 4: Preserve fallback DOM**

Keep the current 16 native tile buttons available in DOM mode. In Pixi/static modes, render an accessible offscreen object list with native buttons and synchronized focus/selection.

- [ ] **Step 5: Connect post-commit effects**

Modify the existing mutation wrapper so a successful service result may return a visual effect descriptor. Call `scene.playEffect()` only after the awaited command succeeds and the mount generation remains current.

- [ ] **Step 6: Verify lifecycle and current regressions**

Run:

```bash
node --test src/renderer/games/farm/*.test.mjs \
  src/renderer/dashboard/dashboard-farm-integration.test.mjs
node --check src/renderer/games/farm/farm-ui.js
git diff --check
```

Manual: test Pixi/static/DOM modes, page round trips, 20 rapid tab changes, hidden page, 600×400 and 800×600.

---

### Task 6: Workshop and Order Board Redesign

**Files:**
- Modify: `src/renderer/games/farm/farm-processing-ui.js`
- Modify: `src/renderer/games/farm/farm-processing-ui.test.mjs`
- Modify: `src/renderer/games/farm/farm-orders-ui.js`
- Modify: `src/renderer/games/farm/farm-orders-ui.test.mjs`
- Create: `src/renderer/games/farm/farm-workshop.css`
- Create: `src/renderer/games/farm/farm-orders.css`
- Modify: `src/renderer/assets/farm/bright-homestead/farm.json`
- Create/Modify: `src/renderer/assets/farm/bright-homestead/ui/**`

**Interfaces:**
- Existing `renderProcessingTab(...) -> cleanup` unchanged.
- Existing `renderOrdersTab(...) -> cleanup` unchanged.
- Consumes shared item icon records from `farm.json`.

- [ ] **Step 1: Write semantic DOM RED tests**

Assert exactly three processing slots and three order papers, existing action data attributes, owned/required text, locked state, cooldown countdown and native button disable behavior.

- [ ] **Step 2: Implement workshop structure**

Render one machine hero area, recipe shelf and three-slot production track. Keep all existing action names and timer ownership. Replace Emoji with manifest item icons and accessible text alternatives.

- [ ] **Step 3: Implement order-board structure**

Render a wooden board with three order-paper articles. Ready orders receive a visual stamp class; cooldown slots remain native countdown elements. Preserve delivery and abandon semantics.

- [ ] **Step 4: Add scoped CSS**

All selectors start with `.farm-workshop-` or `.farm-orders-`. Do not add new generic Dashboard button/card rules.

- [ ] **Step 5: Verify child cleanup and small layouts**

Run:

```bash
node --test src/renderer/games/farm/farm-processing-ui.test.mjs \
  src/renderer/games/farm/farm-orders-ui.test.mjs \
  src/renderer/games/farm/farm-ui.test.mjs
git diff --check
```

Manual: running/queued/empty processor, locked recipes, deliverable/incomplete/cooldown orders at both target sizes.

---

### Task 7: Shared Farm Icons and Cross-Page Integration

**Files:**
- Modify only after ARCH-11 grants exact cross-module authorization:
- Modify: `src/renderer/shared/item-config.js`
- Modify: `src/renderer/shared/item-config.test.mjs`
- Modify: `src/renderer/dashboard/dashboard.js`
- Modify: `src/renderer/dashboard/dashboard-inventory.test.mjs`
- Modify: `src/renderer/dashboard/dashboard.css`
- Modify: `src/renderer/pet/pet.html`
- Modify: `src/renderer/pet/pet.css`
- Modify: `src/renderer/pet/pet-farm-reminder.mjs`
- Modify: `src/renderer/pet/pet-farm-reminder.test.mjs`

**Interfaces:**
- Item catalog may add engine-neutral `iconSrc`; no inventory or feed fields change.
- Pet reminder semantics and text remain unchanged.

- [ ] **Step 1: Request and record cross-module authorization**

Report the exact file list above. Do not start until ARCH-11 confirms no other window is modifying them.

- [ ] **Step 2: Write icon compatibility RED tests**

Assert every farm seed, crop and processed food has an in-project `iconSrc`; legacy foods retain all current buy/sell/feed values. Assert missing icon uses a neutral project fallback and does not inject Emoji as the success path.

- [ ] **Step 3: Add icon metadata**

Add only:

```js
iconSrc: new URL('../assets/farm/bright-homestead/ui/items/<id>.webp', import.meta.url).href
```

If URL construction in the shared catalog harms Node tests, store a stable relative asset key and resolve it in the renderer adapter instead.

- [ ] **Step 4: Update warehouse and shop rendering**

Render `<img>` with escaped alt text and an onerror neutral fallback. Preserve quantity, category, tooltip, batch operation and feed behavior.

- [ ] **Step 5: Update farm reminder icon**

Replace the successful farm indicator Emoji with the project farm icon. Do not alter reminder priority, dedupe, idle reset or sleep behavior.

- [ ] **Step 6: Run cross-module regression**

Run:

```bash
node --test src/renderer/shared/*.test.mjs \
  src/renderer/dashboard/*.test.mjs \
  src/renderer/pet/*.test.mjs \
  src/renderer/pet/animation/*.test.mjs
```

Expected: all PASS.

---

### Task 8: Final Verification, Documentation and Delivery

**Files:**
- Modify: `src/renderer/games/farm/DESIGN.md`
- Modify only by ARCH-11: `PROJECT_BRIEF.md`
- Modify only by ARCH-11: `docs/progress.md`
- Modify only by ARCH-11: `docs/session-log.md`
- Modify only if needed: `docs/events.md`

**Interfaces:**
- No new runtime interface.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
node --test
node --check src/renderer/games/farm/farm-ui.js
node --check src/renderer/games/farm/farm-module.js
node --check src/renderer/games/farm/farm-scene-adapter.js
node --check src/renderer/dashboard/dashboard.js
node --check src/renderer/pet/pet.js
git diff --check
```

Expected: zero failures and zero syntax/whitespace errors.

- [ ] **Step 2: Run compliance scans**

Run:

```bash
rg -n "PetState|setMany|localStorage|writeFile|readFile" \
  src/renderer/games/farm/farm-scene-*.js
rg -n "from ['\"].*(pet|dashboard)/" \
  src/renderer/games/farm src/renderer/shared
rg -n "Godot|Unity|Spine|Rive" package.json src
```

Expected: no scene state mutation, filesystem/localStorage access, cross-module import or unapproved engine runtime.

- [ ] **Step 3: Run the Electron visual matrix**

Verify:

1. Pixi, static and DOM fallback modes.
2. 800×600, 600×400 and continuous resize.
3. All 16 tiles, three land levels, six crops/four stages, three buildings/three levels.
4. Plant, quick-buy, remove, harvest, harvest-all, unlock and upgrade.
5. Build, move, upgrade, demolish and work lock.
6. Three-task processing and queued cancellation.
7. Three orders, delivery, abandon and cooldown.
8. Pet companion, bird reward and reduced motion.
9. Page hide/show, farm/home round trips and Dashboard/pet round trips.
10. Critical/optional asset failure, retry and cleanup.
11. Warehouse/shop icons, feeding and weak reminder regression.

- [ ] **Step 4: Independently review races and resource lifecycle**

Inspect late manifest load, late Pixi init, effects after navigation, texture failure, repeated selection, settlement/mutation overlap, child timer cleanup, ticker pause and renderer destruction. Fix every finding and rerun Steps 1–3.

- [ ] **Step 5: Update design and tracker facts**

Record exact modified files, test counts, manual paths, asset sizes, dependency version, fallback results, authorizations, known issues and commit/push status. Register new events only if explicitly approved and actually added.

- [ ] **Step 6: User approval before Git writes**

Present verification evidence and ask separately for authorization to stage, commit and push. Do not infer authorization from design or plan approval.

---

## Execution Order and Stop Gates

```text
Task 1 visual gate
  ↓ approved
Tasks 2–3 technical gate
  ↓ approved
Task 4 full scene
  ↓
Task 5 integration
  ↓
Task 6 processing/orders
  ↓
Task 7 cross-module icons
  ↓
Task 8 independent final verification
```

Do not overlap Tasks 4–6 because they share the farm manifest and scene/UI integration. Task 7 may start only after Task 6 stops modifying farm item assets and ARCH-11 confirms its cross-module file list is free.
