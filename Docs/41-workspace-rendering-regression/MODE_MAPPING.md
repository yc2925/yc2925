# Mode mapping (13E.4.3.1)

Two-level navigation is preserved. Technical entries reuse host modes; they do not introduce a second incompatible ID space.

## Categories

| id | Label |
|---|---|
| `design` | Design |
| `technical` | Technical |

## Design → `workspaceMode`

| Nav id | Label | Renderer |
|---|---|---|
| `pointed-arch` | Pointed Arch | `GothicGrammarScene` (ortho) |
| `compare-arches` | Compare Arch Families | `GothicGrammarScene` |
| `tracery` | Tracery | `GothicGrammarScene` |
| `stone-3d` | Stone / 3D | `StoneMeshes` |
| `architectural-assembly` | Architectural Assembly | `AssemblyMeshes` |
| `vegetation-growth` | Vegetation Growth | **reserved / disabled** |

Design → Stone / 3D always forces `stone.inspectLayer = 'combined'` so a leftover Technical Graph inspect layer cannot hide solid stone.

## Technical → host + apply

| Nav id | Label | Host `workspaceMode` | Apply |
|---|---|---|---|
| `kernel-examples` | Kernel | `kernel-examples` | — |
| `geometry-graph` | Geometry Graph | `stone-3d` | `stone.inspectLayer = network-graph` |
| `surface-semantics` | Surface Semantics | `architectural-assembly` | semantic overlay on |
| `growth-navigation` | Growth Navigation | `architectural-assembly` | growth seed / nav overlays |
| `validation-diagnostics` | Validation Diagnostics | `architectural-assembly` | `uiControlTier = debug` |

## Compatibility

- Pre-13E.4.3 flat `workspaceMode` IDs still resolve via `resolveWorkspaceNavigation`.
- Additive fields: `workspaceCategory`, `technicalView`.
- Geometry Graph is **not** a new generator ID; it is Stone / 3D + Network Graph inspect layer.

## Renderer branch (view)

```
architectural-assembly → AssemblyMeshes (+ optional SurfaceSemantics / Growth overlays)
stone-3d                → StoneMeshes (+ NetworkGraphOverlay when inspectLayer=network-graph)
otherwise               → GothicGrammarScene (ortho construction / kernel)
```
