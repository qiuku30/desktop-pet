# Farm Workshop and Order Board UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consume the approved farm-art-03 package to deliver the semantic, responsive, animated Bright Homestead workshop and order board without changing business behavior.

**Architecture:** A pure immutable UI-skin catalog resolves optional manifest records. The existing DOM tabs consume that catalog, while `farm-ui` owns cached loading, generation guards, reduced-motion/visibility state, and bounded one-shot feedback. Pixi remains field-only.

**Tech Stack:** JavaScript ES modules, semantic HTML, scoped CSS spritesheet animation, Node test runner, Electron Chromium, Electron Forge.

## Global Constraints

- Start only after farm-art-03 passes ARCH-11 gate and is integrated into the baseline.
- Preserve five recipes, three processing slots, three order slots, all action/data attributes, confirmations, one-second countdown ownership, settlement, transaction ordering, reminders, and cleanup.
- No new EventBus event, IPC, dependency, persistence field, business schema, or asset generation.
- Normal rendering uses project assets or text-only fallback, never Emoji.
- Pixi field fallback and processing/order visual fallback are independent.
- Every async continuation is generation/disposed guarded; cleanup is idempotent.
- Modify only the exact files listed below.
- Do not stage, commit, merge, push, or create a branch. ARCH-11 integrates only after user-approved independent verification.

## File Map

- Create `farm-ui-skin.mjs` / `.test.mjs`: pure validation, safe URL resolution, frozen catalog.
- Modify `farm-module.js`: three stylesheet links and per-runtime cached manifest/UI catalog.
- Modify `farm-ui.js` / `.test.mjs`: non-blocking catalog lifecycle, motion state, one-shot feedback bridge.
- Modify `farm-processing-ui.js` / `.test.mjs`: workshop view model markup, icons, slots, feedback consumption.
- Modify `farm-orders-ui.js` / `.test.mjs`: order-board markup, icons, states, feedback consumption.
- Create `farm-workshop.css`: only `.farm-workshop-*` selectors.
- Create `farm-orders.css`: only `.farm-orders-*` selectors.
- Modify `farm-scene-integration.test.mjs`: production assembly, cache, late promise, event, lifecycle integration.

---

### Task 1: Add the pure UI-skin catalog

**Files:**
- Create: `src/renderer/games/farm/farm-ui-skin.mjs`
- Create: `src/renderer/games/farm/farm-ui-skin.test.mjs`

**Interfaces:**
- Produces: `buildFarmUiSkin(manifest, manifestUrl) -> { catalog, errors }`.
- `catalog` is deeply frozen and contains `itemIcons`, `itemFallback`, `workshop`, and `orders` URL records.

- [ ] **Step 1: Write RED tests**

Cover the approved real manifest, all 18 item IDs, missing optional records, unsafe/out-of-skin paths, invalid/overflowing sheet metadata, stable lexical error order, input immutability, and deep output freezing.

```js
const result = buildFarmUiSkin(manifest, 'file:///skin/farm.json')
assert.equal(result.catalog.itemIcons['crop:wheat'].src, 'file:///skin/ui/items/crop-wheat.webp')
assert.ok(Object.isFrozen(result.catalog.workshop.machine.gearSheet))
assert.deepEqual(buildFarmUiSkin(broken, base).errors, [
  'INVALID_UI_SHEET:ui.workshop.machine.gearSheet',
])
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test src/renderer/games/farm/farm-ui-skin.test.mjs`

Expected: FAIL because the module/export does not exist.

- [ ] **Step 3: Implement the minimal pure catalog**

Implement safe WHATWG resolution beneath `new URL('.', manifestUrl)`, exact positive finite sheet metadata, recursive deep freeze, and stable errors. Do not fetch or inspect the filesystem.

```js
export function buildFarmUiSkin(manifest, manifestUrl) {
  const errors = []
  const catalog = extractApprovedUiRecords(manifest?.ui, manifestUrl, errors)
  return deepFreeze({ catalog, errors: Object.freeze(errors) })
}
```

- [ ] **Step 4: Run and verify GREEN**

Run the new test plus `farm-scene-manifest.test.mjs`.

Expected: all PASS; existing schema-v1 validator remains unchanged.

### Task 2: Add cached production loading and stylesheet assembly

**Files:**
- Modify: `src/renderer/games/farm/farm-module.js`
- Modify: `src/renderer/games/farm/farm-scene-integration.test.mjs`

**Interfaces:**
- Adds: `sceneRuntime.loadUiSkin() -> Promise<{ catalog, errors }>`.
- Preserves: every existing `createFarmSceneRuntime()` field.

- [ ] **Step 1: Write RED production-runtime tests**

Assert three unique style links, one fetch for concurrent `fetchJson(manifestUrl)` and `loadUiSkin()`, rejected fetch cache behavior for the mount lifetime, frozen catalog, and no Pixi import from the skin module.

```js
const [manifest, skin] = await Promise.all([
  runtime.fetchJson(runtime.manifestUrl),
  runtime.loadUiSkin(),
])
assert.equal(fetchCalls.length, 1)
assert.equal(skin.catalog.itemIcons['crop:wheat'].src.endsWith('crop-wheat.webp'), true)
```

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because `loadUiSkin` and the two scoped stylesheet links are absent.

- [ ] **Step 3: Implement cached loading**

Use a per-runtime `Map<string, Promise<object>>`; cache before awaiting so concurrent consumers share the same promise. Add style IDs `farm-workshop-style` and `farm-orders-style`, resolving URLs with `new URL('./farm-workshop.css', import.meta.url)` and the corresponding orders path.

- [ ] **Step 4: Run and verify GREEN**

Run integration and UI-skin tests. Expected: PASS with one manifest request.

### Task 3: Redesign the workshop semantic DOM

**Files:**
- Modify: `src/renderer/games/farm/farm-processing-ui.js`
- Modify: `src/renderer/games/farm/farm-processing-ui.test.mjs`
- Create: `src/renderer/games/farm/farm-workshop.css`

**Interfaces:**
- `renderProcessingTab(container, vm, actions) -> cleanup` unchanged.
- Optional actions: `{ uiSkin, reducedMotion, hidden, uiFeedback, consumeUiFeedback }`.

- [ ] **Step 1: Write semantic DOM RED tests**

Assert one hero machine, exactly three production-slot articles, five recipe articles, existing enqueue/cancel attributes, live owned/required text, native disabled states, no Emoji in output, asset/text fallback, and one feedback token consumption.

```js
assert.equal((html.match(/farm-workshop-slot/g) || []).length, 3)
assert.equal((html.match(/farm-workshop-recipe/g) || []).length, 5)
assert.match(html, /data-action="enqueue-processing"/)
assert.doesNotMatch(html, /🌾|🍪|📦/u)
```

- [ ] **Step 2: Run and verify RED**

Run the processing test. Expected: FAIL on missing workshop structure and Emoji removal.

- [ ] **Step 3: Implement workshop markup and icon helper**

Render decorative image/spritesheet elements with empty `alt`, while adjacent live names remain. Add `data-motion-paused` when reduced motion or hidden. Apply the feedback class only when the token type is `enqueue` or `processing-complete`, then synchronously call `consumeUiFeedback(token.id)` after the first render.

- [ ] **Step 4: Implement scoped responsive CSS**

Use only `.farm-workshop-*` selectors. Implement hero, three-slot track, recipe shelf, 800×600 composition, 600×400 vertical flow, CSS `steps(4)` sheets, reduced-motion/static states, focus visibility, and no horizontal overflow.

- [ ] **Step 5: Run and verify GREEN**

Run processing tests and `node --check farm-processing-ui.js`. Expected: PASS; existing countdown and cleanup tests unchanged.

### Task 4: Redesign the order-board semantic DOM

**Files:**
- Modify: `src/renderer/games/farm/farm-orders-ui.js`
- Modify: `src/renderer/games/farm/farm-orders-ui.test.mjs`
- Create: `src/renderer/games/farm/farm-orders.css`

**Interfaces:**
- `renderOrdersTab(container, vm, actions) -> cleanup` unchanged.
- Uses the same optional visual/motion/feedback action fields as Task 3.

- [ ] **Step 1: Write semantic DOM RED tests**

Assert one board, exactly three paper articles, ready stamp class, incomplete state, cooldown native countdown, existing complete/abandon attributes, rewards and seed reward, no Emoji, missing-icon fallback, and one feedback token consumption.

- [ ] **Step 2: Run and verify RED**

Expected: FAIL on missing board/paper structure and Emoji removal.

- [ ] **Step 3: Implement order-board markup**

Keep the current view model and `canCompleteOrder` result authoritative. Use decorative paper surfaces and live text. Map `order-complete` to the board overlay and `order-abandon` to the paper-ghost overlay; consume each token once.

- [ ] **Step 4: Implement scoped responsive CSS**

Use only `.farm-orders-*` selectors. At wide size use three columns on one board; below the approved narrow breakpoint use one column with vertical scrolling. Preserve native focus/disabled styles and use opacity-only reduced-motion feedback.

- [ ] **Step 5: Run and verify GREEN**

Run order tests and syntax check. Expected: all prior timer/action tests plus new semantic tests PASS.

### Task 5: Integrate catalog, motion, and bounded feedback in the controller

**Files:**
- Modify: `src/renderer/games/farm/farm-ui.js`
- Modify: `src/renderer/games/farm/farm-ui.test.mjs`
- Modify: `src/renderer/games/farm/farm-scene-integration.test.mjs`

**Interfaces:**
- Local state: `uiSkin`, `uiSkinPromise`, `nextUiFeedbackId`, `pendingUiFeedback`.
- Extends: `execute(command, sceneEffect = null, uiEffectType = null)` and `confirmThen(options, command, sceneEffect = null, uiEffectType = null)`.

- [ ] **Step 1: Write RED lifecycle and feedback tests**

Cover non-blocking initial text render, catalog resolve rerender, catalog reject fallback, cleanup-before-resolve/reject, current-generation guard, hidden/reduced state, enqueue success/failure, existing `FARM_PROCESSING_COMPLETED` and `FARM_ORDER_COMPLETED`, abandonment success/failure, tab mismatch discard, single active token, and no unhandled rejection.

```js
eventBus.emit(EVENTS.FARM_PROCESSING_COMPLETED, { taskIds: ['processing-task:1'] })
assert.equal(lastChildActions.uiFeedback.type, 'processing-complete')
lastChildActions.consumeUiFeedback(lastChildActions.uiFeedback.id)
assert.equal(pendingFeedback(), null)
```

- [ ] **Step 2: Run and verify RED**

Run `farm-ui.test.mjs` and integration tests. Expected: failures on missing load/feedback/motion contracts only.

- [ ] **Step 3: Implement guarded catalog loading**

Start `sceneRuntime.loadUiSkin?.()` without awaiting mount. On current success store `result.catalog`; on failure store the empty frozen catalog; render only while current. Cleanup observes the promise and prevents late mutation.

- [ ] **Step 4: Implement one-shot feedback**

Create a token only after a successful command or approved existing event. Keep one pending token; replacement is allowed. Pass it only to the matching active child tab. `consumeUiFeedback(id)` clears only the matching token and never triggers a business update.

- [ ] **Step 5: Synchronize visibility and reduced motion**

Pass both values on every child mount. On visibility change update the current `.farm-workshop-view` or `.farm-orders-board` `data-motion-paused` attribute without creating a new interval. Reduced-motion changes may use the existing guarded render path.

- [ ] **Step 6: Run and verify GREEN**

Run UI, integration, processing, and order tests. Expected: all PASS; no new event definitions.

### Task 6: Regression, layout, package, and same-asar gate

**Files:**
- Modify only tests from earlier tasks if a verification probe exposes a real contract defect.

**Interfaces:**
- No new production interface.

- [ ] **Step 1: Run focused tests**

```bash
node --test \
  src/renderer/games/farm/farm-ui-skin.test.mjs \
  src/renderer/games/farm/farm-processing-ui.test.mjs \
  src/renderer/games/farm/farm-orders-ui.test.mjs \
  src/renderer/games/farm/farm-ui.test.mjs \
  src/renderer/games/farm/farm-scene-integration.test.mjs \
  src/renderer/dashboard/dashboard-farm-integration.test.mjs
```

Expected: 0 failures.

- [ ] **Step 2: Run syntax, scope, and full regression checks**

Run `node --check` on all changed production JS, `git diff --check`, exact-file status audit, forbidden business/storage import scan, and GUI full-repository `node --test`.

Expected: 0 failures and only the approved 12 files changed.

- [ ] **Step 3: Measure real Chromium layouts**

At 800×600 verify workshop hero/track/shelf and three-column board. At 600×400 verify vertical scrolling, one-column papers, readable controls, `scrollWidth === clientWidth`, and no clipped focus ring.

- [ ] **Step 4: Verify lifecycle and fallback matrix**

Run 20 field → processing → orders → field cycles; normal assets, invalid optional UI record, image error, text-only fallback, hidden/restore, reduced motion, late catalog resolve/reject, cleanup during feedback, and countdown boundary settlement. Assert one farm mount, one manifest fetch per runtime, no stale interval, no animation node after cleanup, and no unhandled rejection.

- [ ] **Step 5: Package and test the real archive**

Run `npm run package`. From the same `app.asar` dashboard page verify the real manifest, item icon, workshop/order assets and both scoped CSS files load; perform enqueue, queued cancel, deliver, abandon cancel/confirm, cooldown display, keyboard traversal, reduced motion, and cleanup.

- [ ] **Step 6: Deliver to ARCH-11**

Report the exact 12 files, RED/GREEN evidence, focused and full counts, size/layout measurements, same-asar results, fallback/lifecycle results, events/IPC/dependency/persistence status, known issues, and unchanged Git state. Stop for independent gate.
