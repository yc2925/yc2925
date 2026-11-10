# Option inventory

Dropdowns discovered: **1** (GothicGrammarPanel → Tracery Parameters → Tracery example).

Source enum: `TRACERY_EXAMPLES` in `tracery/roles.js`. Configurator: `applyTraceryExample` in `traceryExamples.js`.

| Value | Label | Intended geometry | Modes | Generator deltas | Distinct stone |
| --- | --- | --- | --- | --- | --- |
| `lancet-subdivision` | A. Lancet Subdivision | Parent arch + mullion + child lancets; smaller upper foil | tracery, stone-3d, assembly | Baseline 13D; clear hierarchical flags; `oculusRadiusRatio` 0.55; `foilScale` 0.72 | yes · vol 0.9580 |
| `trefoil` | B. Trefoil | Composed window, threefold cusped foil | same | Baseline; `foilType=trefoil`; `oculusRadiusRatio` 0.88 | yes · vol 0.9219 |
| `quatrefoil` | C. Quatrefoil | Composed window, fourfold diagonal foil | same | Baseline; `foilType=quatrefoil`; `foilOrientation=π/4`; radius 0.90 | yes · vol 0.9090 |
| `oculus-placement` | D. Oculus Placement | Skeleton + oculus ring, no foil subdivision | same | Rayonnant Oculus Network; `oculusSubdivision=none`; height 0.55 | yes · vol 0.3635 |
| `composed-window` | E. Composed Window | Full Rayonnant Facade Module (13D.9) | same | Rayonnant Facade Module; hierarchical ON; trefoil heads | yes · vol 0.5011 |

No options were deleted. A–C are intentionally related Baseline variants (foil / oculus emphasis), not duplicates — geometry keys and volumes differ.
