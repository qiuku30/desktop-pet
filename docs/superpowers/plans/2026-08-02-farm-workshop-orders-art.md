# Farm Workshop and Order Board Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the complete Bright Homestead workshop, order-board, animation, item-icon, fallback, and review asset package required by the approved redesign.

**Architecture:** This is a presentation-only asset task. Generate coherent asset families from approved art references, export deterministic transparent WebP and spritesheets, extend schema-v1 `farm.json` additively, and prove the package with automated audits and real-size composites before any UI code consumes it.

**Tech Stack:** built-in imagegen skill, official `remove_chroma_key.py`, bundled Python + Pillow, JSON, lossless WebP, sRGB.

## Global Constraints

- Read `AGENTS.md`, `PROJECT_BRIEF.md`, `docs/architecture.md`, `docs/progress.md`, `docs/session-log.md`, the approved design, the prior farm visual plans, and the Bright Homestead README/art bible before reporting.
- Modify only `src/renderer/assets/farm/bright-homestead/**`.
- Do not modify production JavaScript, CSS, package files, business configuration, trackers, or architecture documents.
- No new event, IPC, dependency, persistence field, business schema field, price, output, reward, or unlock value.
- Preserve `schemaVersion: 1` and all existing manifest records byte-for-byte except the additive `ui` extension.
- Use no copied QQ Farm, Hay Day, or other commercial-game asset.
- Keep text, quantities, timers, and labels out of raster assets.
- Remove candidate masters and oversized generation boards before delivery.
- Do not stage, commit, merge, push, or create a branch. ARCH-11 performs integration only after the user approves the independent gate.

---

### Task 1: Lock the asset inventory and manifest contract

**Files:**
- Modify: `src/renderer/assets/farm/bright-homestead/farm.json`
- Modify: `src/renderer/assets/farm/bright-homestead/README.md`
- Modify: `src/renderer/assets/farm/bright-homestead/reference/art-bible.md`
- Modify: `src/renderer/assets/farm/bright-homestead/reference/family-map.md`
- Create: `src/renderer/assets/farm/bright-homestead/review/workshop-orders-audit.json`

**Interfaces:**
- Produces: schema-v1 records listed in design §7.
- Preserves: every pre-existing manifest record and logical position.

- [ ] **Step 1: Write a temporary failing contract audit**

Create `/tmp/farm-art-03-audit.mjs` with checks for the 18 exact item IDs, `ui.itemFallback`, all workshop/order records, safe relative `.webp` paths, positive spritesheet metadata, and forbidden business keys.

```js
const ITEM_IDS = [
  'seed:wheat', 'seed:carrot', 'seed:corn', 'seed:strawberry',
  'seed:pumpkin', 'seed:star-dew-fruit',
  'crop:wheat', 'crop:carrot', 'crop:corn', 'crop:strawberry',
  'crop:pumpkin', 'crop:star-dew-fruit',
  'food:cookie', 'food:popcorn', 'food:carrot-juice',
  'food:strawberry-milkshake', 'food:pumpkin-pie', 'food:milk',
]
assert.deepEqual(Object.keys(manifest.ui.itemIcons).sort(), ITEM_IDS.sort())
```

- [ ] **Step 2: Run the audit and verify RED**

Run: `node /tmp/farm-art-03-audit.mjs`

Expected: FAIL because `ui.itemIcons`, `ui.workshop`, `ui.orders`, and their files do not exist.

- [ ] **Step 3: Add the exact additive manifest shape**

Add safe relative records under `ui` only:

```json
{
  "itemIcons": { "crop:wheat": { "src": "ui/items/crop-wheat.webp" } },
  "itemFallback": { "src": "ui/items/fallback.webp" },
  "workshop": {
    "machine": {
      "base": { "src": "ui/workshop/machine-base.webp" },
      "gearSheet": { "src": "ui/workshop/gear-sheet.webp", "frameWidth": 256, "frameHeight": 256, "frameCount": 4, "durationMs": 800 },
      "steamSheet": { "src": "ui/workshop/steam-sheet.webp", "frameWidth": 256, "frameHeight": 256, "frameCount": 4, "durationMs": 1200 },
      "workGlow": { "src": "ui/workshop/work-glow.webp" },
      "completionFlash": { "src": "ui/workshop/completion-flash.webp" }
    },
    "recipeShelf": { "src": "ui/workshop/recipe-shelf.webp" },
    "slots": {
      "running": { "src": "ui/workshop/slot-running.webp" },
      "queued": { "src": "ui/workshop/slot-queued.webp" },
      "empty": { "src": "ui/workshop/slot-empty.webp" }
    },
    "lockedMask": { "src": "ui/workshop/locked-mask.webp" }
  },
  "orders": {
    "board": { "src": "ui/orders/board.webp" },
    "paper": { "src": "ui/orders/paper.webp" },
    "readyStamp": { "src": "ui/orders/ready-stamp.webp" },
    "cooldownPaper": { "src": "ui/orders/cooldown-paper.webp" },
    "pin": { "src": "ui/orders/pin.webp" },
    "completionOverlay": { "src": "ui/orders/completion-overlay.webp" },
    "abandonPaper": { "src": "ui/orders/abandon-paper.webp" }
  }
}
```

Complete all 18 `itemIcons` keys with the filename rule `<category>-<name>.webp`.

- [ ] **Step 4: Run the audit and verify the expected missing-file failure**

Expected: manifest shape passes; file-existence assertions remain RED.

### Task 2: Produce and gate the 18-icon family

**Files:**
- Create: `src/renderer/assets/farm/bright-homestead/ui/items/*.webp` (18 icons plus `fallback.webp`)
- Create/Modify: `src/renderer/assets/farm/bright-homestead/review/alpha-{white,black,checker}.webp`

**Interfaces:**
- All runtime icons: transparent 192×192 lossless WebP, common optical center, safe content box 152×152.
- Fallback: neutral project-owned wooden produce crate, no Emoji or text.

- [ ] **Step 1: Generate grouped chroma-key icon boards**

Use imagegen with the approved art bible and existing mature crop art as identity references. Generate seeds, crops, processed foods/milk, and fallback as separate coherent boards. Require one centered object per cell, no labels, no touching cells, upper-left light, warm-brown outline.

- [ ] **Step 2: Reject structural errors before extraction**

Inspect every board with `view_image`. Regenerate the family if an icon is fused, cropped, duplicated, mislabeled by shape, inconsistent in perspective, or unreadable at 32 logical pixels. Do not repair structural errors by cropping.

- [ ] **Step 3: Remove chroma and export deterministically**

Use the official imagegen helper, then bundled Pillow for component extraction, optical centering, sRGB conversion, and lossless WebP export. Preserve antialiasing and alpha; do not use native transparency generation or a different image model without stopping for ARCH-11.

- [ ] **Step 4: Run icon audit**

Assert 19 files, exact 192×192 dimensions, RGBA/alpha, transparent corners, bounded alpha content, no chroma fringe, and manifest coverage. Build white/black/checker contact sheets and inspect them at full resolution.

Expected: all icons distinguishable without labels and audit PASS.

### Task 3: Produce and gate the modular workshop family

**Files:**
- Create: `src/renderer/assets/farm/bright-homestead/ui/workshop/*.webp`

**Interfaces:**
- Static assets: transparent lossless WebP.
- Gear and steam: horizontal four-frame sheets; each frame exactly 256×256; sheet exactly 1024×256.

- [ ] **Step 1: Generate one workshop master family**

Generate machine base, gear states, steam states, work glow, completion flash, shelf, three slot states, and locked mask in one consistent visual family. Machine silhouette and overlay anchors must remain fixed across states.

- [ ] **Step 2: Gate frame and overlay consistency**

Reject any family where the machine structure changes between frames, gear center drifts, steam is clipped, the light direction changes, or running/queued/empty slots cannot be distinguished at 600×400.

- [ ] **Step 3: Export spritesheets and static records**

Use deterministic Pillow assembly. Verify frame order, 256-pixel boundaries, no neighbor bleed, alpha corners, and exact sheet dimensions.

- [ ] **Step 4: Re-run the temporary audit**

Expected: workshop manifest file checks and spritesheet geometry PASS; order files remain RED.

### Task 4: Produce and gate the order-board family

**Files:**
- Create: `src/renderer/assets/farm/bright-homestead/ui/orders/*.webp`

**Interfaces:**
- Board: opaque or alpha-safe wide surface capable of three-column and single-column cropping/scaling.
- Paper/state/overlays: transparent WebP with no baked text.

- [ ] **Step 1: Generate the board and paper family**

Generate one continuous wood board, base paper, ready stamp without words, cooldown paper treatment, pin, completion overlay, and abandonment paper ghost. Preserve the approved warm palette and upper-left light.

- [ ] **Step 2: Gate semantic states**

At safe minimum, verify base, ready, cooldown, completion, and abandonment remain distinct by silhouette/treatment, not hue alone. Reject fake writing, letters, numbers, logos, or AI glyphs.

- [ ] **Step 3: Export and alpha-audit**

Apply the same transparent-edge audit used by prior farm art tasks. Any continuous magenta/cyan edge or opaque matte is a failure.

- [ ] **Step 4: Re-run the temporary audit**

Expected: every manifest record exists and all automated contract checks PASS.

### Task 5: Build real-size composites and final documentation

**Files:**
- Create: `src/renderer/assets/farm/bright-homestead/review/workshop-orders-800x600.webp`
- Create: `src/renderer/assets/farm/bright-homestead/review/workshop-orders-600x400.webp`
- Modify: the documentation and audit files from Task 1

**Interfaces:**
- Reviews use actual asset layers, not a new concept painting.

- [ ] **Step 1: Compose the 800×600 states**

Show workshop working + queued + empty slots + all five recipe states, and the order board with ready, incomplete, and cooldown papers.

- [ ] **Step 2: Compose the 600×400 states**

Show the workshop first viewport plus the vertical scroll continuation, and the single-column order-board composition. Preserve readable item silhouettes and control safe areas.

- [ ] **Step 3: Complete provenance and audit records**

Record each family source, dimensions, alpha result, sheet metadata, runtime byte size, and review result in `family-map.md` and `workshop-orders-audit.json`. State that candidate boards were removed.

- [ ] **Step 4: Run final verification**

Run:

```bash
node /tmp/farm-art-03-audit.mjs
node --test src/renderer/games/farm/farm-scene-manifest.test.mjs
git diff --check
git status --short -uall
```

Expected: audit PASS; manifest tests PASS; no file outside the approved asset directory; no master boards, scripts, cache, or Git writes.

- [ ] **Step 5: Deliver to ARCH-11**

Report every changed file, total/runtime bytes, adopted/rejected generation boards, family-by-family visual gate, alpha/spritesheet audit, 800×600 and 600×400 results, omissions, known issues, and unchanged Git state. Stop for independent visual review.
