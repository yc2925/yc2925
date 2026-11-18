# Regression tests — workspace rendering

## Script

```bash
cd app
npm run validate:workspace-rendering
```

File: `app/scripts/validate-workspace-rendering.mjs`

## Coverage

1. Enumerates `DESIGN_WORKSPACES` (enabled) + `TECHNICAL_WORKSPACES`.
2. Resolves each nav id → canonical `workspaceMode` + renderer branch.
3. Verifies nonempty construction / stone / facade / graph output.
4. Checks valid stone bounding sizes (`metrics.boundingSize`).
5. Saved-ID compatibility for all `WORKSPACE_MODES`.
6. Design Stone resets leftover `network-graph` inspect layer.
7. Memo-gate contract: `geomKey` can be unchanged across pointed-arch → stone-3d; generation must still run when `stoneMode` becomes true.

## Explicit regression cases

| Case | Expectation |
|---|---|
| Design / Stone / 3D | `buildStoneAssembly` ok, positive bbox, tris > 0 |
| Technical / Geometry Graph | host `stone-3d`, `inspectLayer=network-graph`, graph nodes/members (or explicit unavailable / bar-network fallback) |
| Pointed Arch | construction curves > 0 |
| Tracery | construction curves > 0 |
| Architectural Assembly | facade window modules ≥ 1 |
| Kernel | construction primitives/curves > 0 |

## Companion scripts (also run)

| Script | Status |
|---|---|
| `validate:workspace-rendering` | **added** |
| `validate:viewport-initialization` | present |
| `validate:construction-overlay` | present |
| `validate:shared-window-module` | present |
| `validate:camera-persistence` | present |
| `npm run build` | present |
