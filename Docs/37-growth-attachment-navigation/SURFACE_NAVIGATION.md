# Surface Navigation (13E.4)

## Graph

Built by `buildGrowthNavigationGraph(semantics, options)` from eligible semantic **patches**.

### Nodes

Patch centers (`patchId`) with world position, normal, eligibility, weight, area.

### Edges

| `transitionType` | When |
| --- | --- |
| `SAME_SURFACE` | Same surface, nearby patches |
| `ADJACENT_SURFACE` | Same component, nearby patches |
| `ARCHITECTURAL_EDGE` | Feature-graph adjacency / arch boundary |
| `STRUCTURAL_JUNCTION` | Pier↔buttress / structural junction |

Edges require geometric proximity (centroid distance vs patch radii + `growthNavigationGapTolerance`). Bounding-box overlap alone is insufficient.

### Void rejection

`segmentCrossesProtectedOpening` drops edges whose midpoint falls in a protected opening while endpoints stay outside — no shortcuts through window voids.

## Path query

```js
findSurfacePath(startAnchor, endAnchor, { graph, semantics, maxGapDistance, useGrowthCost })
```

Dijkstra over edge `growthCost` (distance / weight). Returns ordered points, surfaces, length, cost, violations.

Intermediate points are reprojected onto nearest eligible patches (`projectPathOntoSurfaces`).

`straightLinePathPreview` exists only as a negative-control probe for void shortcuts.

## Frames

`buildSurfaceFrame` — orthonormal right-handed `{N, T, B}` with component-aware tangent hints (vertical piers → +Y, arches → facade plane, etc.).

## Queries API (14A contract)

| API | Role |
| --- | --- |
| `projectToEligibleSurface` | Point → anchor on stone |
| `getSurfaceFrame` | Frame for an anchor |
| `findNearestValidAnchor` | Nearest live / projected anchor |
| `checkGrowthClearance` | CONTACT / PENETRATION / EMPTY / OPENING |
| `isInsideProtectedOpening` | Opening classifier |
| `findSurfacePath` | Surface-following path |

Moldings remain decorative unless `growthEnableMoldingAttachments` is enabled (structural meshes only in 13E.4).
