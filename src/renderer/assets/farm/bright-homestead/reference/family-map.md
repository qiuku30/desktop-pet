# Bright Homestead Family Map

| Gate | Runtime family | Source | Result |
|---|---|---|---|
| Land | `locked`, `eligible`, `level1`–`level3` | `masters/land-master.png` | Adopted after one 1 px matte contraction; all five cells structurally accepted |
| Crops | `wheat` stages 1–4 | Existing approved vertical-slice WebP assets | Adopted unchanged |
| Crops | `carrot` stages 1–4 | `masters/carrot-master.png` | Adopted; approved second, crop-only carrot master |
| Crops | `corn` stages 1–4 | `masters/corn-master.png` | Adopted |
| Crops | `strawberry` stages 1–4 | `masters/strawberry-master.png` | Adopted |
| Crops | `pumpkin` stages 1–4 | `masters/pumpkin-master.png` | Adopted |
| Crops | `star-dew-fruit` stages 1–4 | `masters/star-dew-fruit-master.png` | Adopted |
| Buildings | `sprinkler` levels 1–3 | Existing approved vertical-slice WebP assets | Adopted unchanged |
| Buildings | `scarecrow` levels 1–3 | `masters/scarecrow-master.png` | Adopted |
| Buildings | `compost-bin` levels 1–3 | `masters/compost-bin-master.png` | Adopted |
| Building overlays | sprinkler/scarecrow/compost-bin | `masters/overlays-fallback-master.png` cells 1–3 | Adopted |
| Character | Cream Star farm idle | Existing approved vertical-slice WebP asset | Adopted unchanged |
| Character | bird frames 1–4 | `masters/bird-master.png` | Adopted |
| Effects | plant/harvest/coins/unlock-land | `masters/effects-a-master.png` | Adopted; plant and harvest supersede vertical-slice poses |
| Effects | upgrade-land/building-change/processing-complete/order-complete | `masters/effects-b-master.png` | Adopted |
| Fallback | `fallbacks.object` | `masters/overlays-fallback-master.png` cell 4 | Adopted |

All twelve candidate masters were inspected. No master was assumed valid before the family gate. After final sprites and review evidence passed, the non-runtime motherboards were deliberately removed from the skin so they cannot inflate `app.asar`; the source names above remain provenance labels, not live paths. No external generated-image file was required, and no CLI or native-transparency fallback was used.

## Workshop and order-board extension (`farm-art-03`)

| Gate | Runtime family | Source | Result |
|---|---|---|---|
| Item icons | six seed icons | grouped green-key seed board | Adopted on structural attempt 1; exact 3×2 mapping |
| Item icons | five standard harvested crop icons | grouped green-key crop board | Adopted on structural attempt 1; identities matched existing mature crop art |
| Item icon | harvested `star-dew-fruit` | dedicated magenta-key identity correction | Attempt 1 rejected because the round blueberry silhouette contradicted the mature crop and seed identity; focused attempt 2 adopted with three dark five-point star fruits, pale speckles, curved stems, and green leaves |
| Item icons | five processed foods + milk | grouped green-key food board | Adopted on structural attempt 1; glass edges passed three-background review |
| Item fallback | neutral produce crate | single green-key fallback board | Adopted on structural attempt 1 |
| Workshop static | machine, glow, completion flash, lock mask, gear identity | grouped green-key workshop board | Adopted on structural attempt 1 |
| Workshop shelf | five-position recipe shelf | dedicated magenta-key shelf board | Attempt 1 rejected because only four supports read clearly and the exported edge contaminated review composition; focused structural attempt 2 adopted with exactly five complete, separated support bays |
| Workshop slots | running / queued / empty | corrected dedicated three-slot board | Attempt 1 rejected because the shelf crossed a fixed cell boundary and contaminated the running slot; attempt 2 adopted with matched footprint and no cell bleed |
| Workshop animation | four gear frames | accepted workshop gear identity | Deterministic rotations assembled into one exact horizontal sheet; no structure drift |
| Workshop animation | four steam frames | grouped magenta-key steam board | Adopted on structural attempt 1; common bottom-center origin |
| Order board | continuous wooden board | single wide green-key board | Adopted on structural attempt 1 |
| Order states | paper, ready, cooldown, pin, completion, abandon | grouped green-key order board | Adopted on structural attempt 1; second alpha pass used the official helper with 1 px edge contraction to remove one residual chroma pixel |

All accepted boards were generated with the built-in image tool, processed with the official `remove_chroma_key.py`, and exported with bundled Pillow. No CLI/native-transparency model, third-party asset, warp, paint-over, or crop-based structural concealment was used. Candidate boards and temporary scripts are not present under the runtime skin.

## Legacy cross-page food extension (`farm-art-04`)

| Gate | Runtime family | Source | Result |
|---|---|---|---|
| Legacy food icon | `food-apple.webp` | grouped magenta-key legacy-food board | Structural attempt 1 adopted: fresh red apple with short stem and leaf, distinct from a tomato at 32 px |
| Legacy food icon | `food-cake.webp` | grouped magenta-key legacy-food board | Structural attempt 1 adopted: individual layered cake slice with cream and strawberry garnish, distinct from bread or pie at 32 px |
| Legacy food icon | `food-fish.webp` | grouped magenta-key legacy-food board | Structural attempt 1 adopted: tied golden-tan dried-fish bundle with preserved-food texture and no live-fish motion cues |

The three accepted cells were processed once with the official `remove_chroma_key.py` soft-matte/despill path and required no edge contraction. Bundled Pillow separated the cells without reshaping, fit each alpha extent into the common `152×152` safe box, aligned the optical centers, embedded sRGB ICC, and exported transparent `192×192` lossless WebP files. White, black, checker, and exact 32 px reviews passed with zero detected green or magenta key pixels. These cross-page assets are not `farm.json` records; the later shared item catalog references them directly. The accepted board and temporary scripts remain outside the shipped skin.
