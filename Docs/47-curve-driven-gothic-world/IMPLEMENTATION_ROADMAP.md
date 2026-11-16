# 47 — Implementation roadmap

Design: [README.md](README.md). Rule: produce a **visible vertical slice early** — one curve → one Gothic skeleton → one lithic structure — before broadening any stage.

## Dependency graph

```
A1 model ─┬─ A2 curve math ─┬─ A3 minimal editor ─┐
          │                 └─ B1 spine skeleton ──┼─► SLICE (end of week-equivalent 1)
          │                                        └─ C1 lithic preview ─┘
          ├─ A4 full editor tools
          ├─ B2 footprint + typologies ── B3 params/overrides/debug
          ├─ C2 strata · erosion · porosity · modes ── C3 final quality + worker pool
          ├─ D  multi-structure world, outliner, caching, save/load
          └─ E  terrain/atmosphere, presets, ornament, performance polish
```

## Phases

### Phase A — Curve editor + shared model
| Step | Deliverable | Validation |
|---|---|---|
| A1 | `world/model`: project schema, ids, command store with undo/redo + drag coalescing, serialise/migrate, signatures | `validate:world-model` (round-trip, undo/redo, stable ids, signature stability) |
| A2 | `world/curves`: vec3, polyline / Catmull-Rom (centripetal) / cubic Bézier, arc-length resampling, RMF frames, curvature, closed curves, RDP freehand fit | `validate:world-curves` (frame continuity, no flips, length accuracy, closed seam) |
| A3 | **WorldView** tab with stage nav; left dock editor (top ortho, ground plane, click-to-place spline + polyline, select, move points, grid snap, undo) | browser: draw/edit curve, coordinates match world viewport |
| A4 | Freehand, closed, continue, join, insert/delete point, translate/rotate/scale/duplicate/delete, front/side/persp views, elevated planes, height editing, endpoint snap, fit | browser scripted checks + screenshots |

### Phase B — Curve → Gothic skeleton
| B1 | Spine interpreter: bays by arc length, pier lines, pointed arches (13B primitives), transverse + diagonal ribs; skeleton graph + protected volumes; skeleton render + debug overlay | `validate:world-skeleton` (connectivity, no zero-length members, arches within bays, determinism) |
| B2 | Footprint interpreter; typology rules (towers/spires at ends, buttresses at convex κ, apse clusters, branching supports) | typology coverage tests |
| B3 | Parameter set (height, spacing, verticality, arch rise/curvature, rib density, thickness, branching depth, symmetry, repetition, hierarchy, spire intensity, grotesque influence, seed); global + per-structure overrides; Essential/Advanced/Debug | parameter audit: each control changes geometry measurably |

### Phase C — Skeleton → lithic formation
| C1 | SDF composition (capsules + lobes, smooth union, protected subtraction), narrow-band sampling, Surface Nets via existing voxel mesher, Web Worker, preview quality | `validate:world-lithic` (watertight, openings stay open, deterministic) |
| C2 | Erosion, strata, porosity, fracture; skeletal ↔ geological ↔ biomorphic mode axis; stone shader with banding | morphology metrics per control |
| C3 | Final quality, cancel, keep-last-valid on failure, progress | browser perf capture |

**Vertical slice = A1 + A2 + A3 + B1 + C1.**

### Phase D — Multi-structure world
Outliner (full), selection sync, per-structure regeneration by signature, LRU cache + disposal, duplicate/lock/hide/delete, groups, save/load (`localStorage` autosave + Firebase `world` key), camera persistence per viewport, Fit to Structure (never automatic).
Acceptance = the 15-step workflow in the brief (§24), run in the real browser with screenshots and timings.

### Phase E — Refinement
Terrain tiles + fog/horizon, presentation modes (X-ray, contours, exploded, clean), presets derived from REF-021–029 (+ REF-004/011/012/016/018), connector role (bridges), ornament via foliate system on lithic anchors, instancing/LOD/frustum tuning, metrics panel.

## Provisional presets (to be tuned against references)
| Preset | Skeleton | Lithic | Refs |
|---|---|---|---|
| Skeletal Cathedral | tall bays, dense ribs, spires | thin, low accretion, X-ray friendly | 004, 012, 021, 029 |
| Lithic Megastructure | wide spacing, floors | thick cohesive mass, side-biased accretion, protected floors | 023, 027 |
| Stratified Spires | tower-heavy, high spire intensity | strong strata + inset | 025, 012 |
| Concretion Portal | portal/footprint frames | edge + gravity accretion, drips | 028 |
| Porous Citadel | footprint courts | high directional porosity, erosion | 022, 027, 016 |

## Technical risks
| Risk | Mitigation |
|---|---|
| SDF meshing too slow in browser | narrow band + capsule BVH, worker, preview/final grids, per-structure chunks, triangle budget |
| Smooth union fills arches/openings | protected volumes subtracted *after* union; validator checks openings |
| Frame flipping on space curves | rotation-minimising frames, explicit up vector, tests |
| Pointer conflicts drawing vs orbit | explicit modes; controls disabled during draw/drag |
| Two viewports = two GL contexts | drei `<View>` on one canvas |
| Non-determinism across workers | seeded PRNG only (no `Math.random`), fixed-precision signatures |
| Undo with expensive regeneration | undo operates on source data only; derived geometry via cache |
| `GothicGrammarView.jsx` is 1887 lines | do not extend it; new `WorldView` imports only pure modules |
| `firebase` missing from `app/package.json` (resolves from `~/node_modules`) | add it as a dependency before Phase D, or rely on `localStorage` |
| Visual drift into "rocks scattered on buildings" | skeleton-adherence + cohesion defaults; reference screenshot review per phase |

## Open design decisions (need your call)
1. Should **World** become the primary tab (replacing Gothic Grammar as the default), or sit beside it?
2. Default drawing plane: flat ground at y = 0 with optional drape, or always drape to terrain?
3. World scale: is ~200 m editing field with 3–4 m storeys right, or larger megastructures (km-scale)?
4. Lithic look default: closer to REF-023/027 (pale limestone, frame still visible) or darker REF-009/016 world palette?
5. Save target: `localStorage` autosave only for now, or also Firebase (requires adding the dependency)?
6. Curve Sandbox tab: keep as is, fix its colours to the style guide, or remove once the World editor exists?

---

## Vertical slice — status (A1 + A2 + A3-minimal + B1 + C1)

Implemented in `app/src/world/` + `app/src/views/WorldView.jsx` (Lab → *Curve World (Step 47)*). Existing generators untouched; voxel Surface Nets mesher and 13B pointed-arch primitive are imported, not modified.

| File | Role |
|---|---|
| `world/model/project.js` · `history.js` · `signature.js` | Project document, commands, undo/redo with drag coalescing, schema migration, signatures |
| `world/curves/curve3.js` | Centripetal Catmull-Rom, polyline, arc-length resampling, rotation-minimising frames, signed curvature |
| `world/skeleton/spine.js` · `params.js` | Structural Spine → bays, piers, transverse/arcade arches, diagonal/ridge ribs, flying buttresses, end towers + spires, protected openings |
| `world/lithic/field.js` · `mesh.js` · `lithic.worker.js` · `params.js` | Skeleton SDF (capsules + seeded lobes, erosion, strata, porosity, protected subtraction), narrow-band chunked Surface Nets, Web Worker |
| `world/editor/CurveEditor.jsx` | Top-ortho editor: Draw / Edit / Pan modes, ground-plane raycast, grid snap |
| `world/compose/WorldViewport.jsx` | Independent perspective camera, stage presentation, X-ray, explicit Fit |
| `world/ui/*` | Project hook + localStorage autosave, generation hook, outliner, Essential/Advanced panel |
| `scripts/validate-world.mjs` | `npm run validate:world` — 38 checks |

Measured (this machine, in-app browser, 139 m spine, 21 bays): skeleton 3 ms; lithic preview ≈ 0.7 s / ~100–130 k tris; final ≈ 6 s / ~620 k tris (in worker).

Browser-verified: draw → skeleton → lithic; second curve; edit first curve (only its structure re-meshed — one worker job); delete / undo / redo; refine to final; reload restores identical curves from autosave.

Known limitations → next steps: lithic mass caps the vault top (reads as arcaded viaduct more than cathedral); spires get absorbed by tower mass; lobe morphology fairly uniform; one worker serialises jobs; no mesh cache across delete/undo; skeleton drawn as one line object per member; editor lacks front/side views, freehand, closed curves, transforms (A4); Footprint role (B2); presets, terrain, atmosphere (E).
