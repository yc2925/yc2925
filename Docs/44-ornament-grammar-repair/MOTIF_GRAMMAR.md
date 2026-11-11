# Motif grammar (14A.1.1)

## Host regions

Anchors are clustered by component family + bay/height band:

| Kind | Components | Spine |
|---|---|---|
| `SPANDREL_SCROLL` | OUTER_ARCH, CAPITAL | Lead-in along arch + Archimedean scroll |
| `ARCH_SHOULDER` | OUTER_ARCH, SILL, CAPITAL | Scroll with upward lift |
| `PIER_PANEL` | PIER_CORE, PRIMARY_MULLION, BUTTRESS* | Vertical crocket spine + side scrolls |

Each motif uses **one primary initiation anchor** and optional supporting anchors for frame hints. Nearby seeds are supports — not independent random walks.

## Operators

1. **Primary spine** — parametric samples in the local tangent frame, then surface projection
2. **Secondary scrolls** — density-gated C-scrolls off the spine (REF-020)
3. **Tertiary tip curls** — depth-limited recursion
4. **Local mirror** — bilateral reflection across the motif’s local V axis (not only global X=0)
5. **Creature warp** — controlled angle / radius noise (REF-018)

## Continuity

Sharp projection corners are re-blended and re-projected. Mean turn is validated (~0.6 rad typical after repair vs ~0.9+ before smoothing).
