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
