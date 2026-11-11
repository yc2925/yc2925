# Root cause — blank Stone / 3D and Geometry Graph

## Classification

Both failures were type **C**: geometry was not regenerated after navigation switched into the Stone host mode, so the renderer received `null` (blank viewport). Not frustum, material, or WebGL context loss as the primary cause.

## Shared mechanism

`GothicGrammarView` gates stone generation behind `stoneMode`:

```js
const stoneMode = settings.workspaceMode === 'stone-3d'

const stoneAssembly = useMemo(() => {
  if (!stoneMode) return null
  return buildStoneAssembly(...)
}, [geomKey /*, missing: stoneMode */])
```

After Step 13E.4.3, Technical → Geometry Graph resolves to:

| Field | Value |
|---|---|
| `technicalView` | `geometry-graph` |
| `workspaceMode` (host) | `stone-3d` |
| `stone.inspectLayer` | `network-graph` |

Design → Stone / 3D also sets `workspaceMode = stone-3d`.

### Failure sequence

1. User starts on Pointed Arch / Tracery / Kernel (`stoneMode === false`).
2. `stoneAssembly` memo runs once, returns `null`, caches against `geomKey`.
3. User switches to Stone / 3D or Geometry Graph.
4. `workspaceMode` becomes `stone-3d` → `stoneMode` becomes `true`.
5. `geomKey` is unchanged (same tracery / stone parameters).
6. Because `stoneMode` was **not** in the dependency list, React keeps the cached `null`.
7. `StoneMeshes` mounts with no assembly → blank viewport.

Geometry Graph blanked for the same reason: it hosts on `stone-3d` and needs `stoneAssembly` (or the graph fallback assembly) before `NetworkGraphOverlay` can draw.

## Secondary findings

| Observation | Role |
|---|---|
| Baseline 13D has no skeleton/network members | Graph would be empty even after generation; repair uses display-only bar-network fallback with an explicit banner, or “Graph unavailable for this preset” |
| Design Stone after Technical Graph left `inspectLayer=network-graph` | Separate UX bug; `applyWorkspaceNavigation` now resets Design Stone to `combined` |
| Cursor browser screenshots sometimes black under `frameloop="demand"` | Canvas set to `frameloop="always"` + `preserveDrawingBuffer` for reliable redraw / capture; not the original user-facing root cause |

## Fix

1. Add `stoneMode` to the `stoneAssembly` `useMemo` dependency list.
2. Keep Geometry Graph → host `stone-3d` + `inspectLayer: network-graph` mapping.
3. Graph fallback: if active preset has no network, build display-only Rayonnant Bar Network via existing `buildStoneAssembly` (no duplicate generator).
4. Reset Design Stone inspect layer to `combined` when leaving Technical Graph.
