# Geometry Validation — Trefoil Topology

## Command

```bash
cd app && npm run validate:trefoil-topology
```

Script: `app/scripts/validate-trefoil-topology.mjs`

## What is asserted

| Check | Criterion |
| --- | --- |
| Lobe count | Exactly 3 cusps, 3 arcs, 3 lobe centers |
| Closure | Arc endpoints meet at cusps within tolerance |
| Simplicity | `detectSelfIntersections` → not self-intersecting |
| Construction | `derived.cuspConstruction === 'outer-intersection'` |
| Winding | Consistent CCW signed area |
| Indent | `indentRatio` increases with `cuspDepth` (monotonic Rc) |
| Matrix | sizes `{0.6,1.0,1.4}` × depths `{0.35,0.55,0.7,0.85}` |
| Quatrefoil | Outer-cusp path remains valid (no opposite-circle clash) |
| Example B | `cuspDepth` 0.85 survives preset merge |
| Outer-with-Holes | Foil void indent ≈ 0.484; single hole; no degenerate fragments |
| Extrusion | Watertight, non-manifold = 0, volume deterministic (≈ 0.9090 m³ @ depth 0.25) |
| Assembly sync | Linked facade uses same stone geometry key as Stone / 3D |
| Reactivity | Edits to `cuspDepth`, `foilScale`, `foilType` regenerate valid geometry |
| Semantics | Surface semantics remain valid after repair |

## Watertightness caveat

A mesh can be watertight while encoding the wrong silhouette. This suite therefore requires **simple 2D topology** before extrusion, not only 3D manifold checks.

## Affected functions

- `buildNFoil` / `buildTrefoil` / `foilCenterRadius` — `app/src/geometry/gothicGrammar/tracery/foils.js`
- `foilToVoidLoop` / solid-void Boolean — `…/tracery/solidVoid.js`
- `applyTraceryExample` (Example B foil overrides) — `…/tracery/traceryExamples.js`
- Shared extrusion — `buildStoneAssembly` → Tracery / Stone / Assembly

## Skeleton path

Connected strip-union (Example E / Facade Module) consumes the same `buildTrefoil` primitives for foil bars / trefoil heads. Skeleton massing differs from Outer-with-Holes by design; lobe topology and proportions agree via the shared foil kernel.

## Latest run

```
validate:trefoil-topology PASS
```

(All listed OK lines; exit 0.)
