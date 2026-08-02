# Bright Homestead Full Scene Asset Pack

`bright-homestead` is the engine-neutral full-scene art pack for the farm visual upgrade. The approved vertical slice remains the style baseline; this package adds every land, crop, building, character, fallback, and transaction-effect asset required by the snapshot-driven scene contract.

## Scope

- Fixed `1200 × 720` scene composition with the complete `4×4` field, farmhouse, processing station, order board, water channel, fence, grass, and restrained decoration.
- Locked, unlock-eligible, and Level 1–3 land tiles.
- Six crops, each with four visual stages.
- Sprinkler, scarecrow, and compost-bin Level 1–3 bodies plus one reusable local work overlay per family.
- Cream Star farm idle pose and four bird frames.
- Plant, harvest, coins, unlock-land, upgrade-land, building-change, processing-complete, and order-complete effects.
- Project-owned neutral object fallback.
- Cookie recipe card and blank order paper from the approved vertical slice.
- Exact `800×600` and `600×400` full-scene review composites.
- White, black, and checker alpha contact sheets plus a machine-readable JSON audit.

This package intentionally excludes runtime animation code, PixiJS integration, business state, prices, yields, unlock eligibility, rewards, and persistent data.

## Visual source of truth

`reference/scene-composition.webp` is a concept-composition reference. It may show a complete cultivated field only to lock composition, perspective, palette, and lighting; it is not a runtime background.

`background/base.webp` is the runtime base background. Its central play area is continuous grass and contains no baked land tile. Every land state is supplied by an independent runtime sprite above this background.

Object assets use the same fixed three-quarter top-down camera, warm-neutral upper-left key light, lower-right soft shadow, and warm dark-brown outlines. The exact rules are in `reference/art-bible.md`.

## Manifest

`farm.json` keeps schema version 1 and contains only skin identity, logical geometry, in-skin relative paths, anchors, optional frame durations, and the project-owned fallback. It contains no farm economy, timing, yield, unlock qualification, reward, inventory, IPC, event, or persistence data.

## Export and review

- Assets are lossless WebP with an embedded sRGB profile.
- Scene backgrounds are opaque; object, effect, and UI assets retain alpha.
- Crops use a `256×384` canvas and root anchor `(0.5, 0.88)`.
- Buildings use a `360×360` canvas and ground anchor `(0.5, 0.90)`.
- The deterministic review scenes start from `background/base.webp` and add sixteen independent land sprites.
- `reference/family-map.md` records every family/source/adoption decision. Accepted processing masters were removed after the gate so they do not enter `app.asar`.
- `review/full-scene-audit.json` records dimensions, modes, alpha bounds, ICC presence, bytes, family canvases, and baselines.

AI-assisted outputs were independently gated, chroma-keyed, split without reshaping, aligned, checked at both target sizes, and inspected against white, black, and checker backgrounds. The land matte received a 1 px contraction, restored opaque subject cores, and a deterministic warm-soil color correction without changing structure. No family required a second structural generation attempt.

## Workshop and order-board UI extension

The schema-v1 manifest now includes additive presentation-only records for the workshop, order board, eighteen first-release farm item icons, and a neutral project-owned item fallback. Existing `ui.recipeCookie` and `ui.orderPaper` records remain available unchanged for the scene loader contract.

- Item icons use transparent `192×192` lossless WebP canvases with a common `152×152` safe content box.
- Gear and steam loops use horizontal `1024×256` sheets with four exact `256×256` frames.
- Workshop static surfaces, order papers, stamps, pins, and feedback overlays contain no baked text, quantities, timers, rewards, or button labels.
- `review/workshop-orders-audit.json` records dimensions, alpha bounds, ICC presence, bytes, residual-chroma counts, spritesheet geometry, and the immutable hashes of the prior full-scene alpha reviews.
- The dedicated `workshop-orders-alpha-{white,black,checker}.webp` sheets and exact `800×600` / `600×400` composites use the delivered runtime layers.

The accepted generation boards and all temporary extraction scripts live outside the skin during production and are not shipped in `app.asar`.
