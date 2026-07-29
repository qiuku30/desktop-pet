# Bright Homestead Vertical Slice

`bright-homestead` is the engine-neutral art vertical slice for the farm visual upgrade. It validates one fixed scene, one land level, one four-stage crop, one three-level building, the Cream Star farm companion, two transaction effects, and two DOM-facing UI surfaces before any full asset production or PixiJS integration.

## Scope

- Fixed `1200 × 720` scene composition with the complete `4×4` field, farmhouse, processing station, order board, water channel, fence, grass, and restrained decoration.
- Level-1 land tile.
- Wheat stages 1–4.
- Sprinkler levels 1–3.
- Cream Star farm idle pose.
- Planting and harvest feedback poses.
- Cookie recipe card and blank order paper.
- Actual-size `800×600` and `600×400` review composites.
- White, black, and checker alpha review plus a machine-readable text audit.

This package intentionally excludes the other crops, other building families, runtime animation, PixiJS integration, business state, prices, yields, unlock conditions, rewards, and persistent data.

## Visual source of truth

`reference/scene-composition.webp` is a concept-composition reference. It shows a complete cultivated field only to lock composition, perspective, palette, and lighting; it is not a runtime background.

`background/base.webp` is the runtime base background. Its central play area is continuous grass and contains no baked land tile. Every locked, unlock-eligible, Level-1, Level-2, or Level-3 land state must be supplied by an independent runtime sprite above this background. The two review composites prove this separation by starting with `background/base.webp` and compositing `land/land-1.webp` sixteen times before adding crops, buildings, effects, the pet, and UI samples.

Object assets use the same fixed three-quarter top-down camera, warm-neutral upper-left key light, lower-right soft shadow, and warm dark-brown outlines.

The exact art rules are in `reference/art-bible.md`.

## Manifest

`farm.json` uses schema version 1 and contains only:

- skin identity and logical size;
- in-skin relative asset paths;
- normalized anchors;
- engine-neutral logical positions.

It contains no farm economy, timing, yield, unlock, reward, inventory, IPC, event, or persistence data.

## Export and review

- Assets are lossless WebP with an embedded sRGB profile.
- Scene backgrounds are opaque; object, effect, and UI assets retain alpha.
- Wheat uses root anchor `(0.5, 0.88)`.
- Sprinklers use ground anchor `(0.5, 0.90)`.
- Review composites are deterministic layered layouts, not runtime screenshots. Their `4×4` field is assembled from sixteen independent land sprites; it is never copied from the concept composition.
- `review/alpha-audit.txt` records dimensions, alpha bounds, component checks, and review findings.

AI-assisted outputs were generated as original project artwork, then selected, chroma-keyed, cropped, aligned, checked at both target sizes, and audited against white, black, and checker backgrounds. Structural generation errors are regenerated rather than concealed by post-processing.
