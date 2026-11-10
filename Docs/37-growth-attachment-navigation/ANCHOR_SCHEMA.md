# GROWTH_ANCHOR Schema (13E.4)

## Required fields

| Field | Type | Notes |
| --- | --- | --- |
| `anchorId` | string | Stable per seed instance |
| `componentId` | string | Semantic component id |
| `surfaceId` | string | Semantic surface id |
| `patchId` | string | Semantic patch id |
| `geometrySignature` | string | `surfaceSemantics.geometryVersion` at attach time |
| `localPosition` | `[x,y,z]` | Component/patch-local |
| `worldPosition` | `[x,y,z]` | World |
| `localNormal` | `[x,y,z]` | Unit |
| `worldNormal` | `[x,y,z]` | Unit, outward |
| `tangentU` | `[x,y,z]` | Primary tangent |
| `tangentV` | `[x,y,z]` | Secondary tangent (right-handed with N) |
| `attachmentMethod` | enum | see below |
| `eligibility` | enum | `ALLOWED` / `RESTRICTED` / `PROHIBITED` |
| `status` | enum | `VALID` / `REPROJECTED` / `BLOCKED` / `ORPHANED` |

## Optional fields

`triangleIndex`, `barycentricCoordinates`, `uvCoordinates`, `semanticFeatureId`, `growthZoneIds`, `clearance`, `seedType`, `scope` (`MASTER_MODULE` \| `ASSEMBLY_INSTANCE`), `instanceId`, `bayId`, `masterAnchorId`, `metadata`

## Attachment methods

- **SURFACE_BARYCENTRIC** — preferred when triangle + barycentrics available from a mesh hit
- **SURFACE_PARAMETRIC** — patch-local / centroid + tangential offset (default procedural)
- **FEATURE_RELATIVE** — relative to a semantic feature id

Do not store world-only points. Local + world are always paired.

## Status machine

See [PERSISTENCE_RULES.md](./PERSISTENCE_RULES.md).

## Module

`app/src/geometry/gothicGrammar/assemblies/growthAttachment/types.js` → `createGrowthAnchor`
