# Bright Homestead Art Bible

## Visual identity

- Original, rounded, bright, warm 2D cartoon illustration with soft volume.
- Fixed three-quarter top-down camera. No perspective drift between scene objects.
- Forms are clean and readable, with restrained surface detail and no pixel-art, photorealistic, 3D-rendered, or third-party game assets.
- Palette centers on cream, honey gold, fresh leaf green, warm soil brown, pale water blue, and warm dark-brown linework.

## Scene geometry

- Logical canvas: `1200 × 720`.
- Tile footprint: `132 × 82` logical pixels.
- The complete fixed camera must show the `4×4` field, farmhouse, water channel, fence, grass, processing station, order board, and a small amount of environmental decoration.
- The field is the visual center. Buildings, pet, and decoration must not cover tile centers or compromise the field silhouette.
- Review composites use the same composition scaled to actual `800×600` and `600×400` dashboard content sizes.
- `reference/scene-composition.webp` is a concept reference and may show the complete cultivated field.
- `background/base.webp` is the runtime background and must keep the central field area as continuous grass with no baked land state.
- Locked, unlock-eligible, Level-1, Level-2, and Level-3 land are always independent sprites layered above the runtime background.
- The vertical-slice review field uses sixteen independent Level-1 land sprites in a fixed `4×4` three-quarter top-down grid.

## Camera, light, and edges

- Camera: fixed three-quarter top-down.
- Key light: upper-left, warm neutral.
- Shadows: lower-right, soft edge, `22–32%` opacity.
- Object outline: warm dark brown, never pure black.
- Highlights are broad and soft. Avoid plastic specular glare, hard rim lighting, and unrelated local light sources.

## Anchors and consistency

- Crop root anchor: `(0.5, 0.88)`.
- Building ground anchor: `(0.5, 0.90)`.
- Wheat stages share one root point, one tile footprint, one perspective, and one light direction.
- Sprinkler levels share one ground point, one footprint family, one perspective, one light direction, and one design language.
- Structural AI errors must be regenerated. Cropping, matte cleanup, and edge repair may not conceal malformed geometry.

## Export

- Lossless WebP in sRGB.
- Scene backgrounds are opaque.
- Crops, buildings, pet, effects, and UI objects use transparent backgrounds.
- Transparent exports require clean antialiased edges with no white halo, black halo, chroma fringe, disconnected debris, or clipped parts.
- Logical position metadata belongs in `farm.json`; no business prices, yields, unlock levels, rewards, or persistent state belong in the art manifest.

## Small-size gate

- Safe minimum: every object silhouette remains identifiable at `600×400`.
- All four wheat stages remain distinguishable without labels.
- All three sprinkler levels remain distinguishable without changing their anchor or light.
- The pet stays recognizable without covering the field.
- Recipe and order surfaces retain usable visual hierarchy at the smaller review size.

## Full-scene family contracts

- Land uses five independent `256×192` transparent sprites: locked, eligible, and Levels 1–3. The runtime background remains continuous grass with no baked field.
- Every crop uses four `256×384` stages on a common baseline at y `338`, corresponding to root anchor `(0.5, 0.88)`.
- Every building body uses a `360×360` canvas on a common baseline at y `324`, corresponding to ground anchor `(0.5, 0.90)`.
- Each building family has one local work overlay reused over all three body levels.
- Bird frames use one camera, light, outline, and root family; frames 1–2 are restrained perching states and frames 3–4 are short claim/flight feedback.
- Transaction effects are isolated `256×256` transparent sprites. They are visual feedback only and never imply business success.
- `fallbacks/object.webp` is the project-owned neutral missing-object visual.

## Family gate record

The accepted full-scene sources are listed in `family-map.md`. Every family passed transparent white/black/checker inspection and the exact `800×600` / `600×400` composite check. Generated structure was never corrected by warping, painting, or crop-based concealment; deterministic post-processing was limited to chroma removal, land-matte opacity restoration, land-soil color correction, cell separation, scale-to-fit, fixed-anchor placement, color-profile export, and compositing. Processing masters were removed after the gate and are not part of the runtime skin.

## Workshop and order-board contracts

- All first-release item icons use a `192×192` transparent canvas, a common `152×152` safe content box, centered optical mass, and a silhouette readable at 32 logical pixels.
- Seeds, harvested crops, processed foods, and milk keep distinct identities without relying on labels. The neutral item fallback is an original empty wooden produce crate.
- The workshop machine uses honey wood, brass, cream, and restrained teal enamel. Machine base, work glow, completion flash, gear, and steam share the upper-left light and fixed overlay alignment.
- Gear and steam sheets each contain four horizontal `256×256` frames in a `1024×256` lossless WebP. Gear motion preserves one exact structure; steam shares one bottom-center origin.
- Running, queued, and empty slots share one footprint, scale, perspective, and anchor. Their state difference is structural rather than color-only.
- The order board is one continuous wide wooden surface suitable for three-column layout and center-cropped single-column layout. Paper, cooldown, ready, completion, and abandonment states remain distinguishable by silhouette or treatment.
- Text, item names, owned/required counts, rewards, countdowns, and button labels are always live DOM content and never rasterized into the art.
- Workshop/order alpha evidence uses dedicated `workshop-orders-alpha-*` files; the prior full-scene `alpha-*` reviews are immutable historical evidence.
