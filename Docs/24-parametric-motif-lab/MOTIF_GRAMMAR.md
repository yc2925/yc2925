# Motif Grammar — Symmetrical Gothic Spandrel Scroll

## Intent

Replace disconnected growth curves with a **parametric composition grammar** that reads as a sculptural Gothic ornament drawing: clear primary structure, subordinate scrolls, balanced negative space.

## Hierarchy

| Level | Element | Line weight |
|---|---|---|
| 0 | Primary ribbed spine | Strongest |
| 1 | Primary volutes (paired) | Medium |
| 2 | Secondary curls | Thinner |
| 3 | Tertiary tip details | Finest |
| — | Construction / ribs | Dashed / tick marks |

## Composition steps

1. Resolve host UVN frame (origin, U, V, N, area, voids, symmetry axis = local V).  
2. Place primary spine along local V with mild Bezier curvature.  
3. Attach primary volutes near the tip, left/right of the symmetry axis.  
4. Spawn secondary curls at spine attachment slots; mirror locally at 100% symmetry.  
5. Optionally add tertiary curls at secondary tips when hierarchy and creature influence are high.  
6. Validate continuity, host containment, and void clearance — reject invalid curves (never silent clip).

## Symmetry (motif-local)

- **100%** — Exact geometric mirror across the host symmetry axis (not global facade X=0).  
- **~80%** — Soft asymmetry (scale / tip nudge on the mirrored side).  
- **0%** — Independent left/right generation.

## Creature influence

Morphological bias only — no noise fields:

- **0%** — Traditional Gothic order  
- **~30%** — Subtle skeletal variation  
- **~90%** — Stronger elongation / asymmetry while preserving smoothness and fit  

## Reveal stages

UI toggles for presentation: Primary Spine / Primary Volutes / Secondary Curls.
