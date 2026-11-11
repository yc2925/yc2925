# Navigation structure (13E.4.3)

## Previous (flat)

Single **Mode** select:

- Pointed Arch (`pointed-arch`)
- Compare Arch Families (`compare-arches`)
- Tracery (`tracery`)
- Stone / 3D (`stone-3d`)
- Architectural Assembly (`architectural-assembly`)
- Kernel Examples (`kernel-examples`)

## Current (two-level)

### Category

| id | Label |
|---|---|
| `design` | Design |
| `technical` | Technical |

### Design workspaces

| id | Label | Notes |
|---|---|---|
| `pointed-arch` | Pointed Arch | Construction overlay available |
| `compare-arches` | Compare Arch Families | |
| `tracery` | Tracery | Construction overlay available |
| `stone-3d` | Stone / 3D | |
| `architectural-assembly` | Architectural Assembly | |
| `vegetation-growth` | Vegetation Growth | **Reserved / disabled** — not shown |

### Technical / Inspection

These reuse host modes + existing inspect overlays (no duplicate scene graphs):

| Nav id | Label | Host `workspaceMode` | Apply |
|---|---|---|---|
| `kernel-examples` | Kernel | `kernel-examples` | — |
| `geometry-graph` | Geometry Graph | `stone-3d` | `stone.inspectLayer = network-graph` |
| `surface-semantics` | Surface Semantics | `architectural-assembly` | semantic overlay on |
| `growth-navigation` | Growth Navigation | `architectural-assembly` | seed / nav graph / normals |
| `validation-diagnostics` | Validation Diagnostics | `architectural-assembly` | `uiControlTier = debug` |

### Compatibility

- All previous `workspaceMode` IDs remain valid.
- `workspaceCategory` + `technicalView` are additive settings.
- Switching Design ↔ Technical uses `applyWorkspaceNavigation()`; camera `fitToken` bumps only when leaving the shared Stone↔Assembly perspective pair (same policy as before).
