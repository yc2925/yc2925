# Root Cause — Broken Trefoil (13E.3.2.2)

## Symptom

Example **B. Trefoil** in Stone / 3D (Outer-with-Holes, Baseline 13D) produced a watertight mesh that still looked wrong: stacked circular openings, triangular stone shards inside the void, and excess solid between lobes. Watertight validation alone did not catch the failure.

## Failure chain

```
buildNFoil / buildTrefoil
  → pairwise circle intersections
  → INNER cusp selection (closerTo foil center)   ← defect
  → self-intersecting 2D boundary (N=3 bypasses nonAdjacentArcHits)
  → earcut triangulation invents internal triangles
  → extrude → watertight but architecturally invalid solid
```

The defect starts in **2D foil construction**, not in extrusion or rendering.

## Exact geometric error

Each pair of adjacent lobe circles intersects at two points:

| Intersection | Role |
| --- | --- |
| **Outer** (farther from foil center) | Belongs on the **union silhouette** — the true Gothic cusp |
| **Inner** (closer to foil center) | Lies inside neighboring disks — **must not** joint the boundary |

Pre-repair code selected the **inner** intersection (`closerTo`). For N=3 that yields a figure-eight / overlapping-arc path. `nonAdjacentArcHits` only checks non-adjacent arc pairs, so N=3 never tripped that guard. Earcut then filled crossed regions with stray triangles that extruded into the reported stone fragments.

## Secondary contributor

`applyArchitecturePreset(BASELINE_13D, …)` could overwrite Example B’s intended `cuspDepth` (0.85) with the preset default (~0.55), flattening lobe indent. Post-preset `exampleFoilOverrides` now re-assert Example B foil knobs after the preset merge.

## Why watertight still passed

The broken loop remained a single closed polyline of finite samples. Extrusion produced a manifold shell. Mesh integrity ≠ correct Gothic topology.

## Fix (summary)

1. Select **outer** intersections (`fartherFrom`) as cusps (`cuspConstruction: 'outer-intersection'`).
2. Require a simple sampled loop via `detectSelfIntersections` for all N (including 3).
3. Raise trefoil `minRc` so lobes remain recognizable; default `cuspDepth` 0.7; Example B uses 0.85.
4. Keep shared `buildTrefoil` for Tracery → Stone → Assembly (no parallel trefoil engine).

## References

- REF-006 — foil plates / cusped openings  
- REF-011 — trefoil / Rayonnant tracery motifs  
