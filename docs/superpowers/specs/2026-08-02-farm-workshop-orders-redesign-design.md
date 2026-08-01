# Farm Workshop and Order Board Visual Redesign

**Date:** 2026-08-02
**Status:** Approved design
**Architecture window:** ARCH-11

## 1. Goal

Bring the existing processing and order tabs up to the visual quality of the completed Bright Homestead Pixi farm scene. The result must feel like a rounded, bright, volumetric 2D management game rather than Emoji and text cards, while preserving every current processing, order, transaction, timing, accessibility, fallback, and cleanup contract.

The approved direction is **A: scene hero area**. The workshop centers a large processing machine, with recipes and the three-slot production track arranged around it. The order page is one continuous wooden board carrying three physical order papers.

## 2. Fixed Scope

This phase includes:

- a complete built-in workshop and order-board art set;
- 18 item icons used by first-release farm processing and orders;
- modular 2D spritesheet animation for the workshop and one-shot feedback;
- an immutable UI visual catalog derived from the farm skin manifest;
- semantic DOM redesign of the processing and order tabs;
- responsive layouts for 800×600 and 600×400 Dashboard content sizes;
- local visual feedback for enqueue, processing completion, order completion, and abandonment;
- visual, lifecycle, accessibility, packaging, and regression verification.

This phase excludes:

- changes to processing, order, inventory, reward, unlock, transaction, reminder, or persistence rules;
- new EventBus events, IPC channels, runtime dependencies, or business schema fields;
- warehouse, shop, feed menu, Dashboard inventory, or desktop-pet reminder icon integration;
- Pixi conversion of the processing or order tabs;
- Godot, Unity, Spine, or Rive;
- processing and order expansion beyond the existing five recipes, three queue slots, and three order slots.

The new item assets intentionally prepare for later cross-page reuse, but no cross-module consumer changes are authorized here.

## 3. Visual Direction

All assets follow the approved Bright Homestead art bible:

- rounded, bright, high-quality 2D cartoon rendering;
- visible volume, warm neutral upper-left key light, soft lower-right shadow;
- warm dark-brown outlines rather than pure black;
- consistent scale, perspective, material language, and color temperature with the farm scene;
- readable silhouettes and state differences at 600×400;
- no copied or reconstructed assets from QQ Farm, Hay Day, or another commercial game.

Text, quantities, countdowns, names, rewards, and button labels must remain live DOM content. They must never be baked into raster assets.

## 4. Workshop Composition

The processing tab becomes a vertically scrollable workshop surface.

1. The upper hero area contains the processing machine and occupies roughly one third of the first visible screen.
2. The machine communicates `idle`, `working`, and transient `completed` states.
3. Immediately below it, a fixed three-slot production track shows running, queued, and empty positions.
4. The recipe shelf follows the track and contains all five existing recipes.
5. Each recipe continues to expose output, ingredients, owned/required counts, duration or lock reason, and the existing enqueue action.
6. The existing farm-level, coin, inventory, and cross-tab summary remains authoritative; the workshop does not duplicate a second HUD.

At 800×600 the hero, production track, and the first portion of the recipe shelf are visible without crowding. At 600×400 the content scrolls vertically. The machine and current task retain priority; essential text and controls are not shrunk to force all recipes into one viewport.

## 5. Order Board Composition

The order tab becomes one continuous wooden order board.

- At 800×600, the three papers are arranged in three columns.
- At 600×400, the same board changes to one vertical column and scrolls.
- Each live order paper retains requirements, owned/required values, rewards, abandon, and complete actions.
- A deliverable order displays a clear ready stamp in addition to its button state.
- Incomplete, cooldown, and waiting slots have distinct but restrained paper states.
- Cooldown remains a live native countdown element.
- Buttons remain native buttons with the existing disabled behavior and data attributes.

The board and papers are decorative surfaces. The DOM remains the source of accessible names, status, focus, and actions.

## 6. Asset Package

The art window produces only files under `src/renderer/assets/farm/bright-homestead/**`.

### 6.1 Workshop assets

- machine base;
- four-frame gear loop;
- four-frame steam loop;
- working light overlay;
- completion flash;
- recipe shelf;
- running, queued, and empty production-slot surfaces;
- locked recipe mask.

### 6.2 Order assets

- continuous wooden board;
- base order paper;
- ready stamp;
- cooldown paper treatment;
- pin decoration;
- completion and abandonment overlay elements where required by the approved one-shot feedback.

### 6.3 Item icons

The exact first-release set is:

- six seeds: wheat, carrot, corn, strawberry, pumpkin, star-dew fruit;
- six crops: wheat, carrot, corn, strawberry, pumpkin, star-dew fruit;
- five processed foods: cookie, popcorn, carrot juice, strawberry milkshake, pumpkin pie;
- milk, because it is a current recipe input;
- one project-owned neutral UI item fallback, separate from Emoji.

Every icon uses one transparent canvas size, one optical center rule, sRGB, lossless WebP, and a common safe minimum. Similar items must remain distinguishable without relying on labels alone.

### 6.4 Animation export

Runtime loops are deterministic spritesheets with explicit frame width, frame height, frame count, and duration metadata. Individual source frames may be used during review, but candidate masters and oversized generation boards are removed before delivery. The same sheets must be sliceable later by Godot without re-authoring.

The art gate includes transparent-edge inspection on white, black, and checker backgrounds plus real 800×600 and 600×400 composites for every required state.

## 7. Manifest Contract

`farm.json` remains schema version 1 and receives additive presentation-only records beneath `ui`:

- `ui.itemIcons[itemId]` and `ui.itemFallback`;
- `ui.workshop.machine.base`, `gearSheet`, `steamSheet`, `workGlow`, and `completionFlash`;
- `ui.workshop.recipeShelf`, `slots.running`, `slots.queued`, `slots.empty`, and `lockedMask`;
- `ui.orders.board`, `paper`, `readyStamp`, `cooldownPaper`, `pin`, and approved feedback overlays.

A simple image record contains a safe relative `src`. A spritesheet record additionally contains positive finite `frameWidth`, `frameHeight`, `frameCount`, and `durationMs`. No record may contain price, output, input, reward, unlock eligibility, queue, order, inventory, persistence, or other business values.

All paths resolve relative to the manifest directory and must remain inside the skin root. Missing or invalid optional UI records produce a local visual fallback and never invalidate the farm business page.

## 8. Runtime Architecture

Processing and orders remain DOM interfaces. Pixi remains responsible only for the farm field scene.

### 8.1 UI skin catalog

A new pure UI-skin module:

- validates and extracts only the approved `ui` records;
- resolves safe in-skin asset URLs against `manifestUrl`;
- returns a deeply frozen catalog;
- never reads FarmService, PetState, inventory, order, or processing state;
- never performs network or filesystem access itself;
- returns stable validation errors rather than throwing for content errors.

### 8.2 Manifest loading

`createFarmSceneRuntime()` owns a per-mount cached manifest Promise. The scene loader and UI-skin loader consume the same fetch result, avoiding duplicate requests while keeping their validation and fallback decisions independent.

The initial processing or order DOM renders immediately with semantic text. A valid catalog may enhance the current tab after it resolves. Every continuation is guarded by the current mount generation and disposed state. A late resolve or reject after cleanup cannot rerender, append assets, restart animation, or create an unhandled rejection.

### 8.3 UI boundaries

- `renderProcessingTab(container, viewModel, actions) -> cleanup` remains the public processing contract.
- `renderOrdersTab(container, viewModel, actions) -> cleanup` remains the public order contract.
- The optional visual catalog and reduced-motion state travel through the existing `actions` options object.
- The HTML helpers may accept optional presentation parameters but must preserve current semantic data attributes and native button behavior.
- Dedicated CSS files use only `.farm-workshop-*` or `.farm-orders-*` selectors. They add no generic Dashboard, button, or card rules.
- The module loader attaches the two scoped styles once, alongside the existing farm stylesheet.

Images are presentation only. If one fails at decode or display time, its text alternative and surrounding action remain available. The normal success path never substitutes an Emoji icon.

## 9. Motion and Feedback

The approved animation route is modular 2D frame animation with no new runtime dependency.

- While a task is running, gear and steam spritesheets use low-frequency CSS `steps()` loops.
- Idle and queued states do not run unnecessary continuous animation.
- A successful enqueue gives the new production slot one short entry transition.
- `FARM_PROCESSING_COMPLETED`, an existing event, triggers one machine completion flash when the processing page is current.
- `FARM_ORDER_COMPLETED`, an existing event, triggers one board-level stamp and reward flash after commit.
- A confirmed successful abandonment uses a decorative paper-ghost fade; the business state updates immediately and never waits for the animation.
- Failed commands never play a success effect.

One-shot feedback is represented by a local monotonically increasing presentation token, consumed once by the current child renderer. It is not persisted and is not added to PetState or FarmService. Effects are bounded to one active overlay per tab; replacement and cleanup remove the prior owned node safely.

CSS spritesheet animation supplies the runtime loop. No new JavaScript interval is added; the existing one-second interval remains solely responsible for processing and cooldown countdown display.

When `prefers-reduced-motion` is active, loop animation is paused and one-shot movement becomes a static highlight or short opacity transition. Leaving the tab destroys its child DOM and stops all local motion.

## 10. Error and Fallback Behavior

Visual enhancement follows a local degradation chain:

1. complete Bright Homestead UI asset;
2. neutral project-owned item fallback or text-only surface;
3. current semantic DOM structure and native controls.

This chain is separate from the field scene's `pixi -> static -> DOM` fallback. A field-scene failure must not remove workshop or order visuals when their validated UI catalog is available; a UI visual failure must not change field-scene mode.

Manifest fetch, parsing, validation, image, spritesheet, animation, and cleanup errors are observed and contained. Cleanup errors never replace the primary business or load error. No visual error can suppress transaction feedback, countdown settlement, keyboard access, or native button state.

## 11. Accessibility

- Every icon has an accessible text equivalent already present in the DOM; decorative images are hidden from the accessibility tree.
- State is expressed by text and native disabled/pressed semantics, never by color, animation, or imagery alone.
- Recipe and order reading order matches visual order at both sizes.
- The three production slots and three order papers remain semantic articles or equivalent labelled regions.
- Existing keyboard focus, confirmation overlays, action labels, and countdown ownership remain intact.
- Reduced-motion behavior is verified independently of the operating system animation throttle.

## 12. Implementation Windows

The work is sequential because both windows depend on the same final asset contract.

### `farm-art-03`

Creates and validates the art package, manifest additions, family map, alpha audit, and two-size review composites. It does not change production JavaScript, CSS, business code, dependencies, trackers, or architecture documents.

### `farm-visual-06`

Starts only after `farm-art-03` passes the ARCH-11 visual and manifest gate and is integrated. It implements the UI-skin catalog, cached manifest access, semantic DOM redesign, scoped CSS, feedback bridge, responsive behavior, and tests. It does not regenerate art or change business rules.

The later cross-page icon phase, if approved, receives a separate design, exact shared/dashboard/pet file authorization, and its own implementation window.

## 13. Acceptance and Verification

### 13.1 Art gate

- all required sources exist and are unique manifest paths;
- transparent WebP, sRGB, common icon canvas and optical alignment;
- no chroma-key fringe, unintended component, broken silhouette, baked text, or inconsistent light;
- spritesheet frame geometry and duration metadata are exact;
- running, queued, empty, locked, missing-material, ready, cooldown, and waiting states remain readable at 600×400;
- white, black, checker, 800×600, and 600×400 review outputs pass visual inspection;
- candidate masters and dead build artifacts are absent from the final runtime package.

### 13.2 Contract and behavior gate

- exactly three processing slots and three order slots;
- current action names, IDs, slot indices, owned/required text, native disabled states, and countdown attributes remain present;
- enqueue, queued cancellation, full delivery, abandonment confirmation, cooldown regeneration, and settlement behavior are unchanged;
- processing and order cleanup remain idempotent;
- no visual code imports or mutates FarmService, PetState, storage, transaction, or reminder state.

### 13.3 Lifecycle and responsive gate

- 20 rapid field/processing/orders cycles leave one farm mount and no stale child intervals or animation nodes;
- hidden page, restored page, reduced motion, normal motion, late catalog resolve/reject, missing image, and cleanup races are covered;
- 800×600 uses the wide compositions without overlap or horizontal overflow;
- 600×400 uses vertical scrolling, readable native controls, and no horizontal overflow;
- keyboard traversal and confirmation overlays remain usable in complete-asset and text-only fallback modes.

### 13.4 Final regression gate

- focused processing, order, UI-skin, farm UI, scene integration, and Dashboard tests;
- GUI full-repository test suite;
- production JavaScript syntax checks and `git diff --check`;
- scope and forbidden-import scans;
- Electron Forge package;
- same-`app.asar` visible verification of both sizes, normal and fallback assets, live countdowns, interactions, reduced motion, and cleanup.

## 14. Long-Term Compatibility

The DOM/Pixi separation, manifest-backed UI catalog, safe relative asset records, fixed spritesheet metadata, and text-over-art rule keep this phase compatible with later external skin packs. The same raster sheets can also be imported into a possible Godot farm implementation. This phase does not commit the project to Godot and introduces no engine-specific business dependency.
