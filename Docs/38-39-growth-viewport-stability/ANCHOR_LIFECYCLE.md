# Anchor lifecycle

## Status rules

| Status | When |
| --- | --- |
| **VALID** | Fresh manual / automatic placement on eligible surface; or same-topology recompute from local |
| **REPROJECTED** | Existing anchor moved because geometry signature **meaningfully** changed but surface/patch still exists |
| **BLOCKED** | Surface now PROHIBITED |
| **ORPHANED** | Surface/patch/bay removed |

Never rename REPROJECTED→VALID in the UI. Fresh seeds must initialize as VALID in data.

## Geometry signature

Stable across rebuilds that only bump `facade-N` counters:

```text
facade-gg-b{bayCount}|bayCount|supportStyle|…|volume
```

`stableGeometrySignature()` normalizes legacy `facade-\d+` prefixes for comparisons.

## Reprojection triggers

Reproject **once** when `geometryVersion` / bay count identity changes.

Skip when:

- Hover / select / inspector open
- Camera move
- Panel rerender
- Unrelated controls
- Seed marker rendering
- Navigation options alone (graph refresh only, no status rewrite if signature matches)

Do not write identical anchor arrays back into React state.

## Placement interaction

- One click → one seed (raycast + nearest eligible patch).
- Drag (movement > 6 px) → orbit, no seed.
- Click existing seed → select only.
- Placement Mode OFF → no listeners.
- Listeners cleaned on deactivate / unmount.

## Inspector

Bounded panel (max ~220×200): Seed ID (truncated), Status, Eligibility, Component type, Surface type, Growth zone count. Full IDs / coordinates under **Debug…**.
