# 15 — Camera-Dependent Level of Detail

Session of 28 October 2026. Step 12B.

## Goal

Adapt **rendering tessellation** of Gothic stone and vegetation ornament to projected screen size, without changing canonical design, agents, stigmergy, or physical scale (Step 12A).

## Architecture

```
CANONICAL DESIGN DATA          RENDERED GEOMETRY
─────────────────────          ─────────────────
2D curve graph                 LOD 0 HIGH meshes
Branch hierarchy          →    LOD 1 MEDIUM meshes
Accepted agent paths           LOD 2 LOW meshes
FSM / stigmergy field
Physical meters (12A)
```

LOD never rewrites topology, spawn anchors, path acceptance, bilateral masters, growth timing, or field simulation buffers.

## Screen-space selection

`measureProjectedSize(camera, bounds)` estimates the object’s projected height as a fraction of the viewport (perspective and orthographic).

| Projected fraction | Level |
|---|---|
| ≥ ~0.42 (bias-adjusted) | HIGH |
| ≥ ~0.18 | MEDIUM |
| below | LOW |

**LOD Bias** shifts thresholds (positive → prefer higher detail).

## Hysteresis

`selectLodWithHysteresis` keeps the current level until the projection crosses the threshold by `LOD_HYSTERESIS` (default 0.06). Small orbit motions do not thrash rebuilds. Geometry packs are cached by design id + LOD + scale.

## Simplification

| Domain | HIGH | MEDIUM | LOW |
|---|---|---|---|
| Gothic | Full `detailResolution` / mold layers | ~0.5× resolution, −1 mold layer | ~0.18× resolution, −2 mold layers |
| Ornament | radial 12, curveRes 0.7 | radial 8, curveRes 0.4 | radial 5, curveRes 0.22; omit gen>1 tiny tips |
| Agents | Full markers / trails / field lines | Shorter trails, stride 2 | Minimal markers, field stride 4 |

Agent **count**, sensing, speed, and field **sample spacing** stay fixed.

## Growth animation

Ornament growth still uses `applyGrowthDrawRange` on whichever LOD pack is active. Switching LOD rebuilds the pack once and reapplies the current playback time — it does not reset the timeline.

## UI

Shared **Level of Detail** section (Gothic / Ornament / Agent): Enable Auto LOD, Mode (Auto/High/Medium/Low), Bias, Show LOD Debug. Fit to Object remains in Scale. Status strips show active LOD, projected size, triangle counts, geom memory estimate, FPS.

## Measured triangle counts

Preset: geometric twin-trefoil window, `detailResolution` 0.7, ornament seed trails → bilateral network.

| Level | Gothic tris | vs HIGH | Ornament tris | vs HIGH |
|---|---|---|---|---|
| HIGH | 31372 | 100% | 22944 | 100% |
| MEDIUM | 15200 | 48% | 11904 | 52% |
| LOW | 12178 | 39% | 6204 | 27% |

MEDIUM meets the ~40–60% soft target. Gothic LOW stays above the aspirational 10–25% band because arc sampling floors preserve pointed openings; ornament LOW is ~27%. Counts from `validate-lod.mjs` (measured, not estimated).

## Validation

```bash
cd app && node scripts/validate-lod.mjs
```

Checks: identical bounds/design graph, decreasing tris, hysteresis, perspective/ortho projection, agent/stigmergy invariance, manual override.

## Known limitations

- Gothic LOW cannot drop to ~15% without thinning arc floors that protect lancet/tracery silhouette.
- Portal/façade LOD regenerates solids with scaled `detailResolution` (no shared 2D design cache like the window).
- No cross-fade morph between packs — switch is discrete (cached).
- Draw-call / GPU memory HUD uses geometry attribute byte estimates, not renderer.info.
- Screenshots of LOD debug overlays were not captured in this headless session.
