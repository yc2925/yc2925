# Anchor Data Flow

## Authoritative source

`GrowthAttachment` state in `GothicGrammarView` (shared across Architectural Assembly and Foliate Ornament).

Each `GROWTH_ANCHOR` carries:

- `anchorId` (stable)
- `componentId` / `surfaceId` / `patchId`
- `worldPosition` / `localPosition`
- `worldNormal` / `tangentU` / `tangentV`
- `geometrySignature`
- `eligibility` / `status`

Persistence / reprojection: `growthAttachment/persistence.js` (`rebindGrowthAnchors`).

## Foliate consumption

```
growthAttachment.anchors
  → buildHostsFromAnchors(semantics, anchors)
  → buildHostFrameFromAnchor(anchor)   // origin = worldPosition
  → composeSymmetricalSpandrelScroll   // spine base UV = (0,0)
```

Motif record fields:

- `motifId`
- `sourceAnchorId`
- `hostComponentId`
- `hostSurfaceId`
- `localFrame`
- `motifParameters`
- `geometrySignature`

## Cross-workspace sync

- Place / delete / select anchors in either workspace — same React state.
- `selectedGrowthAnchorId` ↔ `foliate.selectedAnchorId` kept bidirectional.
- Deleting an anchor removes it from the array → motif rebuild omits it (no silent replacement).
