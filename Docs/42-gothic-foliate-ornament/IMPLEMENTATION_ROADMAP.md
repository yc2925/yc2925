# Implementation roadmap — after Step 14.0

**14.0 status:** design direction + references only. Do not implement 14A.1 until explicitly started.

## Reusable existing systems (preserve)

| System | Location / notes | Foliate reuse |
|---|---|---|
| Gothic Grammar host | arches, tracery, stone solids, assemblies | Architectural host geometry |
| Surface semantics | `assemblies/surfaceSemantics*` | Eligibility, orientation, component type for initiation |
| Growth attachment | `assemblies/growthAttachment/` | Seeds → ornament initiation points; frames; nav graph |
| Growth overlays / Technical views | Assembly → Growth Navigation | Debug initiation + skeleton paths |
| Bar / skeleton graphs | tracery network / skeleton overlays | Precedent for ornament skeleton visualization |
| Stone profiles / sweeps | `solids/` molding sweeps | Profile language for carved members |
| Shared window module | Stone ↔ Assembly link | Ornament can later attach to shared module surfaces |
| Camera / viewport init | Fit / persistence policies | Keep; do not reintroduce reset bugs |
| Legacy Ornament System | separate app ornament stack | Do not overwrite; build foliate grammar under Gothic Grammar until validated |

## Recommended technical approach

1. **New module namespace** under Gothic Grammar, e.g. `assemblies/foliateOrnament/` or `ornament/gothicFoliate/` — separate from vegetation naming.
2. **Data contract:** `OrnamentInitiationPoint` wraps existing growth anchors + motif metadata.
3. **Skeleton first:** export inspectable graph (nodes / members) before solids — mirrors Geometry Graph discipline.
4. **Stone last:** sweep / relief / perforate from skeleton; validate min web, watertight structural host remains unchanged.
5. **Parameters:** expose density, symmetry, recursion, relief depth, creature intensity, perforation — all geometric.
6. **Validation scripts:** bounds nonempty, host attachment distance, symmetry residuals, no detached components.
7. **UI:** Design workspace reserved `vegetation-growth` should be renamed or replaced conceptually with **Foliate Ornament** when implemented (avoid “vegetation” in user-facing labels).

## Suggested staged sequence (future)

| Stage | Goal |
|---|---|
| 14A.1 | Initiation points + skeleton draw on host (no solids yet) |
| 14A.2 | Gothic grammar mapping (mirror, crocket markers, cusp cells) |
| 14A.3 | Stone profile sweeps / relief solids |
| 14A.4 | Perforation + layered undercut |
| 14A.5 | Biomorphic variation knobs + LOD |
| 14A.6 | Assembly-scale density control + diagnostics |

Exact step IDs may be reassigned when 14A starts.

## Design questions remaining

1. First host target: single pier / capital, window spandrel, or full facade band?
2. Default symmetry: force bilateral on assembly centerline, or local patch mirrors only?
3. How strong should “creature intensity” be in the default preset (subtle crocket vs REF-018 grotesque)?
4. Should foliate solids boolean into host stone, or remain a separate decorative layer (like moldings today)?
5. Rename reserved Design workspace `vegetation-growth` → `foliate-ornament` before exposing it?
6. Interaction with legacy Lab ornament system: parallel forever, or eventual bridge?

## Explicit non-goals until redirected

- Literal ivy / vine / leaf simulators
- Green materials as final look
- Image-to-mesh or AI mesh foundations
- Overwriting validated tracery / stone / assembly generators
