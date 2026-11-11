# 44 — Ornament Grammar & Surface Attachment Repair (Step 14A.1.1)

Critical repair of the 14A.1 ornamental growth skeleton. **No stone geometry** in this step.

Growth remains a construction skeleton for future Gothic foliate / grotesque stone carving (REF-017–020). Not vegetation.

## Root causes (14A.1)

| Failure | Cause |
|---|---|
| Sparse growth / unused anchors | Hard cap `maxRoots = 8` + one independent random-walk per seed |
| Antenna / zigzags | Step-wise random walk with weak curl (~0.08 rad/step) |
| Premature death | Global `SEPARATION` occupancy killed most branches early |
| Invisible / floating look | Many paths attached to **back faces** (`n.z = -1`) |
| No Gothic motif reading | No host-region motif grammar — only disconnected paths |

## Repair summary

Replaced random-walk composition with a **motif-based parametric grammar**:

1. Group anchors into architectural hosts (spandrel / pier / shoulder)
2. Generate a primary smooth spine (scroll or crocket lead-in)
3. Spawn hierarchical secondary / tertiary scrolls
4. Apply **motif-local** bilateral symmetry
5. Project every sample onto eligible front-facing stone; reject failures into debug segments (never accepted as ornament)

## Screenshots

![Spandrel motif debug](Images/spandrel-motif.png)

*Single spandrel motif with Motif Debug (host label + inspect index).*

![Full facade](Images/full-facade.png)

*Multi-motif facade composition on Architectural Assembly host.*

![Low curl](Images/curl-low.png)

*Low Curl Strength — straighter spines / weaker winding.*

![High curl](Images/curl-high.png)

*High Curl Strength — stronger scroll winding.*

![Low density](Images/density-low.png)

*Low Branch Density — fewer secondary scrolls.*

![High density](Images/density-high.png)

*High Branch Density — denser hierarchical offshoots.*

![Symmetric](Images/symmetric.png)

*Symmetry Strength 100% — motif-local mirrored scrolls.*

![Asymmetric](Images/asymmetric.png)

*Symmetry Strength 0% — no mirror branches.*

![Pier motif](Images/pier-motif.png)

*Pier-panel crocket spine motif.*

![Surface debug](Images/surface-attachment-debug.png)

*Debug: rejected segments, attachment anchors, motif bounds / axes.*

## Docs in this folder

| File | Contents |
|---|---|
| [ROOT_CAUSES.md](ROOT_CAUSES.md) | Diagnosis counts |
| [MOTIF_GRAMMAR.md](MOTIF_GRAMMAR.md) | New grammar |
| [SURFACE_VALIDATION.md](SURFACE_VALIDATION.md) | Attachment rules |
| [PARAMETERS.md](PARAMETERS.md) | Control effects |
| [VALIDATION.md](VALIDATION.md) | Scripts + parity |

## STOP

Do not implement stone solids / Boolean carving from this step.
