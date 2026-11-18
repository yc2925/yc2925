# Visual direction for procedural Gothic architecture

## Working direction
Start with a clear geometric bar-tracery system using REF-011 and construction studies REF-006 and REF-008. Treat “Rayonnant” as the working geometry family, not an authenticated attribution for every reference. Preserve pointed envelopes, hierarchical bars, circular foil modules and readable negative space.

## Geometry before decoration
Expose span, rise, arch-center positions, lancet count, circle radius, foil count, cusp depth, bar width and extrusion depth as controls. Derive vertices and curves from constraints, then build planar regions and 3D profiles. Keep seeds reproducible. Validate tangency, closed boundaries, minimum stone width and intersections before adding detail. A photograph is not a dimensioned drawing.

Separate the flowing/curvilinear family (REF-005 and 010) from the initial circular grammar. REF-001 is useful for comparing window families; do not merge its different types into a single undifferentiated style.

## Assembly and depth
Use REF-004 for repeated bays, ribs and springing relationships; REF-007 for canopy assemblies; REF-012 for vertical spire hierarchy. Use REF-008 and 010 for profile ideas, and REF-013 for visible relief and junctions. Exact dimensions, back surfaces and load paths need additional evidence.

## Presentation
Use REF-009 and 015 for a monochrome preview mode: light neutral surfaces, dark openings, controlled highlights and sufficient shadow to read the molding. This is a proposed presentation direction derived from the supplied references, not a historical claim. Keep the geometry readable before increasing ornament density.

REF-016 supports an optional speculative direction with exposed frames, dense vertical layers and oxidized materials. Keep these choices independently adjustable from the Gothic geometry. Its complexity is an aesthetic reference, not evidence of structural feasibility.

## Ornament boundaries
REF-002 and 014 offer dense ornament and pattern variation. REF-003 is an eclectic bracket catalog: use it for support profiles and motif variation only when intentionally appropriate, not as a source of core medieval Gothic rules.

## Procedural Gothic foliate ornament (primary artistic goal — Step 14+)

**We are not building a vegetation or ivy simulator.** Biological growth is a *computational strategy* only. The intended outcome is elaborate Gothic architectural **stone** ornamentation: carved foliate relief, grotesque / biomorphic sculpture, and architecturally integrated decoration.

Use REF-017–REF-020 together (do not copy any single sculpture literally):

| ID | Role |
|---|---|
| REF-017 | Geometric pattern grammar — symmetry, tracery, cusps, interlacing, diaper repetition |
| REF-018 | Biomorphic / creature morphology — antler branching, cavities, skeletal density |
| REF-019 | Integrated stone foliate carving — ornament emerging from host architecture |
| REF-020 | Symmetrical grotesque recursion — mirrored scrolls, dense controlled branching |

### Core principles

1. **Architectural integration** — ornament emerges from or connects to host geometry (edges, ribs, capitals, spandrels, piers).
2. **Stone materiality** — carved, extruded, perforated or sculpted stone; coherent thickness and depth.
3. **Growth-based generation** — recursive branching, directional fields, attraction, curling, controlled stochastic variation as *algorithms*, not plant colonization.
4. **Gothic grammar** — pointed envelopes, cusps, symmetry, tracery hierarchy, ornament density control.
5. **Biomorphic complexity** — anatomical, skeletal, alien and grotesque qualities are allowed when still stone and hierarchical.
6. **Sculptural depth** — relief layers, undercuts, ribs, perforations.
7. **Controlled ornament** — balance symmetry and variation; preserve readable architectural hierarchy.

### Explicit negatives

Do **not** generate: literal ivy covering buildings; green vines or leaves; generic climbing plants; random vegetation scatter; naturalistic botanical simulation; thin tubes as final ornament; unattached floating decorations; organic noise that ignores architectural hierarchy.

Existing growth anchors / surface navigation are **ornament initiation points** and attachment infrastructure — reuse them; reinterpret them away from “plant seeds.”

Pipeline target:

```
Architectural Host
→ Ornament Initiation Points
→ Growth Skeleton
→ Gothic Ornamental Grammar
→ Sculptural Stone Geometry
→ Architectural Integration
```

Detail: `Docs/42-gothic-foliate-ornament/`.

## Curve-driven futuristic Gothic world (REF-021–REF-029)

Pipeline: user-drawn curve → Gothic skeleton → lithic formation → detail → world. **The rocks become the architecture**: rock is accreted, carved and stratified *around a Gothic skeleton*, never scattered beside it.

Important: none of REF-021–029 is Gothic. REF-024, 026 and 029 are classical/Renaissance and are used only for skeleton presentation, member hierarchy and bay rhythm. Gothic grammar (pointed arches, ribs, bays, pinnacles, tracery) still comes from REF-001–REF-020, especially REF-004, 006, 007, 008, 011, 012.

| Group | Meaning | References |
|---|---|---|
| A | Gothic grammar / structural skeleton | REF-004, 007, 011, 012 (Gothic); REF-024, 026, 029 (skeleton hierarchy & bay rhythm only); REF-025 (spire hierarchy) |
| B | Geological morphology | REF-022, 023, 025, 027, 028 |
| C | Biomorphic ornament | REF-021, 023, 027, 028 with REF-017–020 |
| D | Urban composition | REF-023, 026, 027, 029 |
| E | Lighting and atmosphere | REF-021, 022, 024, 026, 029 (luminous lines on black); REF-023, 027, 028 (neutral daylight inspection) |

### Rules derived from the references

1. **Skeleton inside the mass** (REF-021, 023, 028) — skeleton members are always enclosed by or attached to rock; rock never floats free of its skeleton. Expose *skeleton adherence* and *formation thickness*.
2. **Accretion, not scatter** (REF-023, 027, 028) — rock forms as fused lobes on an implicit surface, densest at edges, void rims and undersides, with an optional gravity (drip) bias and a directional side bias. Lobes show concentric layered banding.
3. **Protected negative space** (REF-023, 027) — floors, stairs, circulation cores, arches and openings are protected volumes that erosion and accretion may not fill. Architectural order must stay legible.
4. **Strata and spires** (REF-025) — optional height quantisation of the lithic field (layer thickness, per-layer inset) produces terraced pinnacle clusters; spire intensity = taper along skeleton verticals.
5. **Porosity as a gradient** (REF-022, 027) — porosity is a field with a direction and falloff, not uniform noise; a regular lattice remains where porosity is low.
6. **Repeated bays along a spine** (REF-029, with Gothic REF-004) — a Structural Spine curve is sampled by arc length into bays; spacing, height and rib density visibly change the rhythm. Vary typology along the curve (curvature, height, ends) so the same window is not repeated everywhere.
7. **Human scale** (REF-023, 027) — storey height ≈ 3–4 m; keep a scale figure option in the world.

### Feedback round 1 (REF-026, REF-030)

- **Lithic = dry-stone stacking (REF-030)**, replacing the fused SDF mass: discrete faceted stones placed one by one along each skeleton member; thin axis along the member tangent (voussoirs radial on curves, flat courses on piers); staggered joints; larger stones low; gaps; tilt jitter; gravel at ground contacts; mixed grey / tan / rust / green.
- **X-ray = wire-mesh scrim (REF-026)**: semi-transparent white mesh on pure black, additive layering so overlaps glow, fresnel edges, exploded suspended fragments, thin horizontal light rings.

### World stage = point-cloud survey scan (REF-031, group E)

- The built world rendered as a photogrammetry point cloud on pure black: every stone surface sampled by area into points, daylight baked into point colour and desaturated toward scan grey; coverage thins toward the top and in noise holes; stray floater points form a faint halo.
- Ground = ragged radial scan patch, dense at the structures and dissolving into sparse points.
- Survey overlay: stations around the structures, each showing a photograph rendered from the solid model at its position, linked by a thin traverse line, with monospace id / time / date / coordinate labels and red survey paint at each target.
- Ground lichen tint is the one opt-in exception to the "no moss" negative below (slider, default 0).
- **Skeleton = the drawn curves themselves** (no repeated arch arrays) plus procedural branching.

### Presentation modes

- *Skeleton / X-ray* (REF-021, 024, 029): luminous additive lines on black, skeleton visible through semi-transparent rock.
- *Contour slices* (REF-022): iso-height lines of the lithic field.
- *Exploded* (REF-026): components offset along their local frames.
- *Clean inspection* (REF-023, 027, 028): neutral daylight, pale stone, no fog.
- *World*: dark stone, fog and depth (combine with REF-009/015 monochrome and REF-016 speculative assemblage).

### Explicit negatives (in addition to the foliate list)

No randomly scattered boulders along members; no grass, moss or plants (incidental in REF-023/027); no copying the classical orders of REF-024/029 as Gothic; no noise strong enough to erase slabs, arches or openings.

## Brief for Cursor
For each generated feature, name the reference IDs, the observed feature and the parameters that reproduce it. Distinguish observed geometry from inferred dimensions. Build the simple geometric skeleton first, then add thickness, moldings and optional ornament. Provide controls to inspect curves, surfaces and final solids separately. Never claim a historical attribution or exact reconstruction based solely on these images. For foliate ornament work, cite REF-017–REF-020 and keep stone / architectural integration primary. For curve-driven world work, also cite REF-021–REF-029 and say which group (A–E) each one informs.
