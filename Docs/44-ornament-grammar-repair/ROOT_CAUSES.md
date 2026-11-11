# Root causes (14A.1 → 14A.1.1)

## Headless diagnosis (47 distributed anchors)

| Metric | 14A.1 random-walk | Notes |
|---|---|---|
| Anchors distributed | 47 VALID | All eligible |
| Selected initiation | 26 preferred | Spandrel/shoulder/pier ranking |
| Actually used as roots | **8** | Hard `maxRoots` cap |
| Unused | ~39 | Silent |
| Branches | ~14 | Mostly primary + few secondary |
| Dominant termination | **SEPARATION** (11/14) | Shared occupancy killed growth |
| Invalid recorded | OPENING stubs | Rendered with accepted paths |
| Mean polyline turn | ~50° | Zigzag walk |
| Curl effect | Weak | `curl * 0.18` rad/step |

## Browser observation

- Thin disconnected antennae on piers / arch edges
- Many anchors with zero ornament
- Back-face attachment (`surfaceNormal.z ≈ -1`) hid curves from default camera
- No coherent scroll / crocket motif reading (REF-017 / REF-020)

## Repair targets

1. Motif host grouping (not one path per seed)
2. Parametric smooth spines + recursive scrolls
3. Front-face preference (+Z)
4. Rejected segments debug-only; never accepted
5. Measurable Curl / Density / Symmetry effects
