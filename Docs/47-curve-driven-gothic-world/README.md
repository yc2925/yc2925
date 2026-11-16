# 47 — Curve-Driven Gothic World (architecture audit + design)

Status: **plan only, awaiting approval.** No generator code has been written for this step.

Goal: one integrated environment where user-drawn spatial curves are interpreted by a Gothic grammar into skeletons, the skeletons are turned into lithic (rock) architecture, and many such structures accumulate into a persistent, editable futuristic Gothic city. **The rocks become the architecture.** Everything is procedural; no AI-generated geometry.

```
USER-DRAWN CURVES → CURVE INTERPRETATION → GOTHIC SKELETON
→ LITHIC FORMATION → ARCHITECTURAL DETAIL → WORLD COMPOSITION
```

Companion: [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) (phases, acceptance tests, risks, open decisions).

---

## 1. References used

Registered this step: **REF-021–REF-029** in `references/futuristic-gothic-world/` (per-image analysis in `references/reference-index.json` → `analysis`; rules in `references/VISUAL_DIRECTION.md` → *Curve-driven futuristic Gothic world*). All nine images were inspected individually.

| Group | References | What it constrains |
|---|---|---|
| A Gothic grammar / skeleton | REF-004, 007, 011, 012 (Gothic) · REF-024, 026, 029 (hierarchy & bay rhythm only) · REF-025 (spire clusters) | Bays, piers, pointed arches, ribs, pinnacles, member hierarchy |
| B Geological morphology | REF-022, 023, 025, 027, 028 | Accretion lobes, strata, porosity gradient, erosion |
| C Biomorphic ornament | REF-021, 023, 027, 028 + REF-017–020 | Skeleton inside mass, banded lobes, drips |
| D Urban composition | REF-023, 026, 027, 029 | Inhabitable floors, circulation, exploded districts, colonnade rhythm |
| E Lighting / atmosphere | REF-021, 022, 024, 026, 029 · REF-023, 027, 028 | X-ray / contour / exploded inspection on black; clean daylight inspection |

Key finding: **the new set contains no Gothic architecture** (REF-024/026/029 are classical/Renaissance). Gothic structural grammar must keep coming from REF-001–020; the new set governs the *lithic* layer, presentation, and composition.

Derived procedural rules (summary — full text in VISUAL_DIRECTION.md):

1. Skeleton inside the mass (021, 023, 028).
2. Accretion, not scatter: fused lobes densest at edges, void rims, undersides; gravity + side bias (023, 027, 028).
3. Protected negative space: arches, floors, stairs, cores can't be filled (023, 027).
4. Strata & spires: height-quantised terraces; taper on verticals (025).
5. Porosity is a directional gradient, lattice survives where low (022).
6. Repeated bays along a spine with typology variation (029 + Gothic 004).
7. Human scale: storey ≈ 3–4 m (023, 027).

---

## 2. Existing systems audit

App: React 19 + R3F 9 + drei 10 + three 0.185, Vite 8. Tabs in `ui/AppTabs.jsx`; views switched in `App.jsx`.

| System | Location | Reuse for this step | Notes |
|---|---|---|---|
| 2D geometry kernel (lines, circles, arcs, intersections, tangency, offsets, planar regions) | `geometry/gothicGrammar/kernel/` (13A) | **Yes** — arch construction inside each bay's local plane | 2D only (`vector2`). New 3D curve math needed. |
| Pointed arch families | `geometry/gothicGrammar/primitives/` (13B) | **Yes** — arch profiles for bays, ARCH PROFILE role later | Returns 2D construction; place via bay frame. |
| Tracery / window module | `…/tracery/`, `…/assemblies/windowModule.js` | Detail stage (Phase E) | Expensive; cached by `windowDesignSignature`. |
| Profile sweep, region extrusion, mesh validation | `…/solids/` (13D) | Partly — `meshValidation` yes; `profileSweep` is **planar (XY) only** | Need 3D RMF sweep for ribs along space curves. |
| Bay layout / facade elevation | `…/assemblies/facadeElevation.js` (`computeBayLayout`) | Pattern reused; straight-line only | Generalise to arc-length along a curve. |
| Clustered piers, stepped buttress | `…/assemblies/articulatedSupport.js`, `pierSupport.js` | **Yes** for skeleton-only/articulated mode | |
| Surface semantics + growth anchors + persistence | `…/assemblies/surfaceSemantics*.js`, `growthAttachment/` (13E.4) | Ornament initiation (Phase E); its stable-key reprojection model informs our ID strategy | Expects facade semantics; needs an adapter for lithic surfaces. |
| Foliate ornament skeleton | `…/assemblies/foliateOrnament/` (Step 14) | Phase E detail | |
| Legacy Gothic Architecture | `src/gothic/` | Not reused (separate older generator) | Preserve untouched. |
| Voxel lab: density volume, chunked incremental update, **Surface Nets / Dual Contouring / greedy** meshers | `src/voxel/` | **Yes** — mesher core for lithic SDF | Currently tied to its own density sampler & cube volume; extract a pure `(sampler, bounds, res) → mesh` path. |
| Organic rock | `shaders/organicRock.js` | Material/shader ideas only | Displaced icosphere = single blob; cannot coalesce into architecture. |
| LOD (screen-space selection, hysteresis, geometry cache) | `src/lod/` | **Yes** — preview/final tiers per structure | |
| Scale system (units, fit camera, scale figure) | `src/scale/` | **Yes** — metres, human figure, fit-to-structure | |
| Noise (simplex2d, value noise 3D) | `src/noise/`, `voxel/noise3d.js` | **Yes** — terrain + lithic fields (seeded) | Need cellular/Worley for porosity. |
| Save / load | `App.jsx` → Firebase (`tab`, `particles`, `noise` only) | Extend with a `world` key | Requires Google login; no local autosave; no `localStorage` anywhere. **`firebase` is not in `app/package.json`** — it resolves from `~/node_modules`. |
| Panel tiers Essential / Advanced / Debug | `ui/GothicGrammarPanel.jsx` (`controlTier`) | **Yes** — same pattern for right panel | |
| Curve Sandbox | `views/CurveSandboxView.jsx` | Not the editor; stays as a 2D test tab | Uses two non-accent colors — violates `Docs/style-guide.md` single-highlight rule; fix separately. |
| Web Workers | none | New | |

**Nothing existing needs to be modified** for Phases A–C except: a new tab entry, a new view, and (Phase D) extending `saveConfig/loadConfig` with an optional `world` key. Voxel meshers will be *wrapped*, not rewritten.

---

## 3. New systems

All new code lives in a separate namespace until validated (AGENTS.md):

```
app/src/world/
  model/        project store, ids, commands (undo/redo), schema + migration, signatures
  curves/       3D vec utils, spline evaluation, arc-length sampling, RMF frames, curvature
  editor/       curve editor viewport, tools, snapping, construction planes
  skeleton/     role interpreters (spine, footprint, …), typology rules, skeleton graph
  lithic/       SDF field composition, narrow-band sampling, worker, meshing adapter
  terrain/      deterministic height function, tiles, contours
  compose/      world scene, structure meshes, selection highlighting, atmosphere
  ui/           stage nav, dock, outliner, context panel
app/src/views/WorldView.jsx
app/scripts/validate-world-*.mjs
```

---

## 4. Shared data model

Single authoritative **project document** (plain JSON, serialisable). Derived geometry is never stored in it.

```js
Project {
  schemaVersion: 1,
  world:   { seed, units: 'm', presetId, globals: {skeleton, lithic, atmosphere} },
  terrain: { seed, amplitude, frequency, octaves, seaLevel },
  curves:  { [curveId]: Curve },
  groups:  { [groupId]: { groupId, name, curveIds[], role } },
  structures: { [structureId]: Structure },
  order:   [ids for outliner],
  editor:  { camera, view, plane, snap },   // UI state saved separately from geometry
  viewport:{ camera, mode },
}

Curve {
  curveId, name,
  curveType: 'polyline' | 'catmullRom' | 'bezier' | 'freehand',
  controlPoints: [{x,y,z}],          // world metres, editable source of truth
  handles?: [...],                   // bezier only
  closed, transform: {t,r,s},        // non-destructive transform
  constructionPlane: { kind:'ground'|'horizontal'|'vertical', elevation, origin, normal },
  drapeToTerrain: bool,
  curveRole: 'spine'|'footprint'|'archProfile'|'connector'|'boundary',
  architecturalParameters: {...overrides}, lithicParameters: {...overrides},
  randomSeed, visibility, locked,
  generatedStructureIds: [structureId]
}

Structure {
  structureId, name, source: { kind:'curve'|'group', id },
  stages: {
    skeleton: { status, signature, error? },
    lithic:   { status, signature, quality:'preview'|'final', error? },
    ornament: { status, signature }
  },
  overrides: {...}, visibility, locked
}
```

- **IDs**: `crv_xxxxxx`, `grp_…`, `str_…` — random base36, never reused; names are separate and editable.
- **Signatures**: stable hash of (resolved curve samples at fixed precision + resolved params + seed + terrain signature for draped curves). Cache key for every derived artefact; a structure regenerates only when its signature changes.
- **Undo/redo**: command pattern over the project document (`addCurve`, `movePoint`, `setParam`, …) with coalescing for drags. Derived geometry follows from the document, so undo never touches meshes.
- **Freehand** strokes are simplified (Ramer–Douglas–Peucker) and fitted to Catmull-Rom control points on mouse-up; raw strokes are not kept.

---

## 5. Curve editing strategy

- Rendering: one WebGL context using drei `<View>` for **two independent cameras** (editor dock + main viewport). Shared geometry, no camera coupling.
- Mouse → 3D: ray–plane intersection with the **active construction plane** only (ground at terrain base, horizontal at elevation h, or vertical through a picked line). Optional *drape*: replace y with terrain height after drawing. Height editing in front/side ortho views or with a vertical drag handle. No screen-to-depth guessing.
- Views: Top (default, ortho), Front, Side, Perspective; ortho/persp toggle; pan/zoom; fit selection.
- Snapping: grid (size param), endpoints (radius in px), optional angle.
- Explicit **interaction modes**: Navigate · Draw (polyline / spline / freehand / click-points) · Select · Edit points · Transform. Cursor changes per mode; orbit is disabled while drawing/dragging, so pointer events never conflict.
- Editor field: square spatial field (default 200 m), contours from the same `terrainHeight(x,z)`, axes, existing curves, footprints of generated structures; field pans/expands — it is a view, not a world limit.

## 6. Gothic interpretation strategy (Sandbox B)

Curve → arc-length samples → **rotation-minimising frames** (double-reflection; up = world Y) → curvature κ(s) and elevation. Interpreters by role:

**Structural Spine** (first)
1. Bay division by arc length with `structuralSpacing`; bays compress where κ is high (pitch ∝ 1/(1+k·κ)).
2. Two pier lines offset ±width/2 along the frame normal (nave) — or one line (arcade) if width = 0.
3. Each bay: pointed arch from the existing 13B primitives in the bay's local plane; transverse arch + diagonal ribs between pier pairs (quadripartite vault, REF-004).
4. Height = base height × verticality, modulated by curve y and by an end/centre emphasis.
5. Typology variation along the curve: ends → tower/spire nodes (taper, `spireIntensity`, REF-012/025); convex side at high κ → flying buttress members; long straight runs → arcade; sharp turn → apse-like radial rib cluster.
6. Branching supports: recursive Y-split of piers (`branchingDepth`) for the biomorphic end of the range.

**Footprint** (closed)
Inward offset ring → perimeter piers at spacing → radial ribs to a central boss (chapter-house vault) for small/compact footprints; ring cloister + open court for large ones; tower if area small and height high.

Output: **skeleton graph** — nodes `{id, p, kind}`, members `{id, a, b, kind: pier|arch|rib|buttress|spire|floor, radius, polyline}`, frames, and **protected volumes** (arch openings, floor slabs, circulation cores) consumed by the lithic stage. Same output schema for all roles. Debug overlays: source curve, frames, nodes, members by kind.

## 7. Lithic formation strategy (Sandbox C)

Evaluated: `organicRock` (single displaced sphere — rejected for coalescence), voxel density + Surface Nets (reusable mesher), metaballs alone (blobby, loses Gothic order), mesh boolean fusion (slow, fragile). **Chosen: signed distance field composed from the skeleton, meshed with the existing Surface Nets mesher inside a Web Worker, narrow-band only.**

```
d = smoothUnion( capsule SDFs of members (radius = thickness × hierarchy weight),
                 anisotropic ellipsoid lobes seeded along members )   // accretion
d = d + erosion(noise) · mask(!protected)                             // erosion
d = smoothSubtract(d, protected volumes)                              // keep openings
d = strata(d, y)       // optional height quantisation + per-layer inset (REF-025)
d = porosity(d, Worley, directional gradient)                         // REF-022
```

- Lobe seeding: deterministic PRNG per structure seed; density weighted by member hierarchy, edge/void-rim proximity, undersides (gravity bias), and a side-bias vector (REF-023/028).
- **Mode slider** A → B → C: skeletal stone (thin capsules, few lobes) → geological mass (thick, cohesive) → biomorphic/alien (many lobes, high porosity, branching).
- Performance: sample only within a narrow band around a capsule BVH; preview grid (~0.5 m) during editing, final (~0.15–0.25 m) on Generate; per-structure chunks so edits regenerate locally.
- Vertex attributes (distance-to-skeleton, layer index, lobe id) drive a stone shader with banding — not textures from outside.

## 8. UI layout

New top-level tab **World** with stage nav **Curves · Gothic Skeleton · Lithic Formation · World** (stages of one project, not separate scenes).

```
┌ stage nav ──────────────────────────────────────────────┐
│ LEFT DOCK          │ CENTER 3D VIEWPORT      │ RIGHT     │
│ curve editor (sq.) │ orbit/pan/zoom, views,  │ context   │
│ resizable/collapse │ fit, presentation,      │ params    │
│ ─────────────────  │ skeleton / lithic /     │ Essential │
│ World Outliner     │ contour / exploded      │ Advanced  │
│                    │ inspection modes        │ Debug     │
└─────────────────────────────────────────────────────────┘
```

Outliner: World → Terrain → Curve → {Skeleton, Lithic, Ornament}; selection syncs both ways (highlight, no camera move); status dots (up to date / stale / generating / error); rename, multi-select, hide, lock, duplicate, delete, regenerate. Follows `Docs/style-guide.md` (one highlight color, hairlines).

## 9. Generation workflow & performance

- **Live preview**: skeleton recomputed on every edit (cheap, main thread, < ~5 ms target).
- **Lithic**: debounced (≈300 ms after edit) preview-quality job in worker; **Generate/Refine** for final quality; Regenerate selected / all; Cancel (job tokens, stale results discarded).
- On failure keep the last valid mesh and mark the stage `error`.
- Caching: LRU keyed by signature; mesh disposal on eviction/delete; instanced members in skeleton mode; LOD = preview vs final mesh by screen size (reuse `src/lod`); frustum culling per structure; spatial hash for snapping/picking.
- Metrics panel: per-stage ms, triangles, cache hits, memory estimate.

## 10. Terrain, atmosphere, persistence

- `terrainHeight(x,z)` — one seeded function used by editor contours, draping, and world tiles. World: camera-centred tile ring with LOD + exponential fog + horizon colour so no square edge is visible.
- Presentation modes per REF group E; clean inspection mode with no fog.
- Persistence: project JSON (no meshes) → `localStorage` autosave + optional Firebase via a new `world` key in the existing config (old configs load unchanged; missing key ⇒ empty world). `schemaVersion` + migration function.
