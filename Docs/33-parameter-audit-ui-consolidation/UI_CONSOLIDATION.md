# UI consolidation (13E.3.1)

## Control density

Workspace → **Control density**: Essential · Advanced · Debug.

| Tier | Shows |
|---|---|
| Essential | Preset, parent arch basics, Solid/Void (outer frame, min stone web), oculus height, hierarchical depth / trefoil heads, Upper Tracery vertical, assembly / supports / growth substrate |
| Advanced | Architectural proportions, master-frame ratios, Secondary Tracery, Oculus Refinement, mullion/child ratios |
| Debug | Path flags (skeleton / bar network / elaborate / oculus network toggles) |

Parameters are **hidden by density**, not deleted. Saved presets remain compatible.

## Canonical renames / aliases

| User-facing | Canonical key | Alias |
|---|---|---|
| Outer frame width | `outerFrameWidth` | `masterFrameWidth` |
| Oculus height | `oculusHeightRatio` | `oculusVerticalPosition` |
| Foil type / Trefoil heads | `trefoilHeads` (+ `foilType`) | synced |
| Min stone web | `minStoneWebWidth` | floors `minWebClearance` / `minOpeningClearance` |

## Essential section map (conceptual)

1. **Architecture** — preset, family, span, springing  
2. **Tracery** — depth, trefoil, oculus height/size, member thickness (outer frame)  
3. **Stone & detail** — stone depth, molding enable  
4. **Assembly** — bay count/spacing/variation  
5. **Structural supports** — style, shafts, buttress  
6. **Growth substrate** — overlay, zones, weights  
7. **View & inspection** — render mode, camera presets, semantic view  

## Redundancy handled

- Master frame width kept as Advanced alias of Outer frame width  
- Dual oculus height controls synced rather than deleted  
- Min stone web kept as constraint with clearer tip (not merged away without proof of full semantic equivalence)
