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
