# Data model (14A.1)

## Growth node

| Field | Meaning |
|---|---|
| `id` | Stable id |
| `parentId` | Parent node or null at initiation |
| `branchId` | Owning branch |
| `position` | World position |
| `surfaceAttachment` | `{ patchId, surfaceId, componentId, distance, anchorId? }` |
| `localTangent` | Surface tangent |
| `surfaceNormal` | Host normal |
| `growthDirection` | Step direction |
| `generation` | Branch depth |
| `distanceFromRoot` | Path length from initiation |
| `growthProgress` | Normalized 0–1 for reveal |
| `role` | `INITIATION` · `PRIMARY` · `SECONDARY` · `MIRROR` |
| `valid` / `invalidReason` | Attachment success |
| `mirrorOf` | Source id when mirrored |

## Growth branch

| Field | Meaning |
|---|---|
| `id` | Stable branch id |
| `parentBranchId` | Parent branch or null |
| `nodeIds` | Ordered node list |
| `depth` | Hierarchy depth |
| `length` | Path length |
| `curvature` | Mean turn |
| `terminationReason` | Why growth stopped |
| `role` / `rootAnchorId` / `mirrorOf` | Provenance |

## Skeleton

`ORNAMENT_GROWTH_SKELETON` with `nodes`, `branches`, `initiationPointIds`, `diagnostics`, `parameters`, `geometrySignature`.

Cache key excludes `growthProgress`.
