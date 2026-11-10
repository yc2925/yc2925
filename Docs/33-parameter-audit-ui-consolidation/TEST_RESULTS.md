# Test results (13E.3.1)

## Automated harness

```text
npm run validate:parameter-audit
TOTAL PARAMETERS (registry sample): 46
TESTED: 33
PASS: 30
CONDITIONAL: 2
REDUNDANT: 1
BROKEN: 0
UNTESTED: 13
PARAMETER AUDIT VALIDATION PASSED
```

## Full suite

| Script | Result |
|---|---|
| validate:parameter-audit | PASS |
| validate:solid-void | PASS |
| validate:stone-3d | PASS |
| validate:architectural-assembly | PASS |
| validate:structural-controls | PASS |
| validate:camera-persistence | PASS |
| validate:surface-semantics | PASS |
| build | PASS |

## Geometry measurement highlights

| Control | Metric | A → B |
|---|---|---|
| Trefoil heads | head foil bars | 6 → 0 (off) / 8 (quatrefoil) |
| Oculus height (skeleton) | center Y | 1.767 → 2.334 m |
| Outer frame width | structural volume | 0.266 → 1.022 m³ |
| Min stone web | clearance floor | 0.05 (inactive) → 0.22 (rejects secondary) |
| Molding enable | decorative meshes | 0 → 20 |

## Browser-level testing

Vite app exercised for mode switch to Architectural Assembly and control panel presence (Control density select). Full per-slider browser screenshot matrix for all 175 labels was **not** completed in this pass; geometry deltas above are generator-level with real UI wiring fixes. Do not treat this as a complete browser sweep of every control.

## Camera

`validate:camera-persistence` PASS. Semantic / density / growth-weight edits do not bump `fitToken`.
