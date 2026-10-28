# 14 — Architectural Scale and Proportional Geometry

Session of 28 October 2026. Step 12A.

## Goal

Introduce a consistent **physical scale** across Gothic architecture, ornament, and agents — without changing procedural complexity or camera-based LOD.

## Coordinate system

| Convention | Value |
|---|---|
| World unit | **1 meter** |
| Axes | Y-up; façades in XY; stone depth mostly −Z |
| Origin | Window sill at y = 0; bilateral axis at x = 0 |

Subsystems previously used the same numeric magnitudes without declaring units. Step 12A makes the meter convention explicit and centralizes conversions.

## Unit conversion

Helpers live in `app/src/scale/units.js`:

```js
meters(1)        // → 1
centimeters(10)  // → 0.1
millimeters(25)  // → 0.025
```

Avoid scattering ` / 1000` factors through feature code.

## Architectural dimensions

| Typology | Design width | Design height | Notes |
|---|---|---|---|
| Tracery Window | **3.0 m** | **≈5.7 m** at aspect 1.9 | Height follows `windowAspect` so family presets keep proportions |
| Gothic Portal | 4.2 m | 5.2 m | Already driven by `overallWidth` / `overallHeight` |
| Cathedral Façade | 9.5 m | 8.5 m | Same |

`architecturalScale` (0.5×–2×) multiplies envelope and profile depths **without** adding curves, branches, or density.

## Three independent axes

| Axis | Meaning | Example |
|---|---|---|
| **Physical scale** | Real-world meters | Window 3×5.7 m; stem 32 mm |
| **Procedural complexity** | Count / organization of elements | Lancet count, branch generations, agent count |
| **Rendering resolution** | Mesh tessellation / LOD | Radial segments, detailResolution |

Changing scale must not automatically add branches or raise ornament density.

## Ornament proportions

Physical ranges (design meters):

| Quantity | Range |
|---|---|
| Primary thickness | 15–60 mm |
| Secondary thickness | 8–30 mm |
| Relief depth | 5–40 mm |
| Foliate detail | 20–150 mm |

Dimensionless caps (`app/src/scale/config.js` → `PROPORTION_RATIOS`):

- Primary ≤ ~0.72 × mullion / profile thickness
- Secondary ≤ ~0.62 × primary
- Relief ≤ ~0.35 × architectural depth
- Max branch length ≤ ~0.32 × architectural height

Resolved in `resolveOrnamentPhysical()` before sweeps.

## Agent / stigmergy dimensions

Defaults already matched meters; they are now labeled and scaled:

| Parameter | Default (1×) |
|---|---|
| Movement speed | 0.55 m/s |
| Sensing radius | 0.28 m |
| Deposition radius | 0.18 m |
| Field sample spacing | 0.09 m |
| Min path length | 0.085 m |

Fixed timestep (`1/30 s`) and FSM transitions are unchanged. Sample spacing scales with `architecturalScale` so graph-local fields stay consistent.

## Scale reference visualization

Optional overlays (not exported with ornament):

- Metric scale bar + ground plane
- Height / width dimension markers
- Neutral ~1.7 m human silhouette

**Fit to Object** reframes the camera once; sliders do not auto-zoom.

## Validation

```bash
cd app && node scripts/validate-scale.mjs
```

Checks 0.5× / 1× / 2× Tracery Window: linear envelope, constant curve counts, proportional ornament, scaled sample spacing, bilateral symmetry, no NaN.

## Screenshots

App screenshots for Scale Reference / human silhouette were not captured in this session (validation ran headless). Capture from the Gothic or Ornament tab with **Scale Reference** and **Show Human Reference** enabled when documenting UI for review.

## Known limitations

- Window height remains aspect-driven; Architectural Height in the Scale panel documents the reference envelope and updates design width/scale, but family aspect still owns composition height unless `lockWindowAspect` is disabled.
- Portal / façade scale presets are registered for future work; their generators already consume `overall*` + `architecturalScale`.
- Camera-based LOD and adaptive tessellation are deferred (Step 12B+).
- Text labels for height/width are geometric markers, not full CAD dimension strings.
