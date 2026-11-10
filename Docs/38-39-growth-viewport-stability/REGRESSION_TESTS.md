# Regression tests

## Scripts

| Command | Role |
| --- | --- |
| `npm run validate:seed-placement` | Anchor VALID init, no spurious reproject, distribute, delete |
| `npm run validate:viewport-initialization` | World-unit ortho math, mode coverage, invalid pose rejection |
| `npm run validate:growth-attachment` | Existing 13E.4 attachment suite |
| `npm run validate:camera-persistence` | Geometry edits must not move camera helpers |
| `npm run build` | Production bundle |

## Seed suite coverage

1. Stable geometryVersion across rebuilds  
2. Fresh create → VALID  
3. Unchanged geometry → 0 REPROJECTED  
4. Distribute 45 → all VALID  
5. Identical rebuild → 0 reprojection  
6. Bay-count edit → one rebind pass, stable ids  
7. Place 10 manual → VALID; delete one  
8. Placement helpers (`attachFromWorldHit` / `findNearestPatch`)  
9. Deterministic nav graph for unchanged geometry  

Browser (manual / probe): one-click placement via raycast; inspector opens without freeze; orbit does not reproject; distribute shows valid N / reproj 0.

## Viewport suite coverage

1. All workspace modes listed  
2. Arch bounds sane; frustum O(geometry) not O(pixels)  
3. Nonzero viewport gate  
4. Assembly/stone default three-quarter  
5. Invalid pose rejection  
6. Resize preserves half-extent  

Browser: Fit / Reset move perspective pose; seed distribute does not move camera; pointed-arch dim labels span the viewport (not clustered at center).

## Results (this repair)

```
validate:seed-placement            PASS
validate:viewport-initialization   PASS
validate:growth-attachment         PASS
validate:camera-persistence        PASS
npm run build                      PASS
```
