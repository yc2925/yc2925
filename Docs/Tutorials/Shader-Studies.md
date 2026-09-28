# Shader Studies

A study notebook for shaders in relation to a procedural system that generates **vegetal ornament on religious architectural facades**.

This file is research only. Related primer: [Shaders.md](./Shaders.md). A **Shaders** tab now exists in the app as Shader Lab. Implemented experiments, observations, and screenshots: [08 — Shader Experiments](../08-shaders-experiments/README.md). The studies below were written first and are kept as the brief.

The current app already uses the GPU for terrain, water, voxels, and particles. Those experiments taught me that form can be generated on the CPU (noise, density, hydraulic grids) while appearance is decided later, per vertex or per pixel. For facade ornament, I want that second stage to be intentional: not a prettier default material, but another procedural layer that can talk about relief, stone, growth, and architectural position.

---

## 01 — What is a Shader?

A **shader** is a small program that runs on the GPU, once per vertex or once per visible fragment, instead of once per object on the CPU.

**Vertex shaders** operate on geometry. Each vertex arrives with position, normal, UV, and any extra attributes I attach (growth, extrusion depth, facade height). The vertex stage can move those points — displacement, animation, a slight swell of carved leaves — and it must output a clip-space position so the GPU knows where the triangle sits on screen.

**Fragment shaders** operate on the rasterized surface. After triangles are turned into fragments (usually pixels), this stage decides color, roughness, lighting response, and any overlay that visualizes a simulation value. It does not create the vine’s topology; it decides how that surface is read: as cut stone, as a growth front, as a cavity in shadow.

That split matters for a procedural system. Generating thousands of ornamental branches on the CPU is expensive if I also paint every visual variation in JavaScript. Shaders calculate that visual information in parallel on the GPU and can respond immediately to parameters, changing geometry, time, light, and data coming from the generator (growth 0–1, curvature, distance to a doorway). The mesh can stay the “score”; the shader becomes the performance.

---

## 02 — Why Shaders Matter for My Project

The project direction is vegetal ornament on religious facades: computational growth producing forms related to carved foliage, vines, and arabesque-like plant motifs on stone.

**Geometry determines the FORM** — where a branch goes, how a leaf sits on a pier, how dense the pattern becomes around a portal. If I stop there, the facade is a gray mesh. Religious ornament is rarely read as a silhouette alone. It is read through **relief** (what stands out from the wall), **material** (limestone vs marble vs weathered sandstone), **age**, **hierarchy** (door vs cornice), and **light** (raking sun, interior spill, night floodlight).

Shaders can help communicate:

- **depth** — carved vs flush vs undercut
- **material** — grain, roughness, mineral tint
- **age** — weathering concentrated in recesses
- **surface variation** — so instanced motifs do not look stamped
- **growth** — the generator’s time, not only its final mesh
- **hierarchy** — stronger or different treatment near an architectural anchor
- **light interaction** — rims, cavities, silhouettes
- **architectural relief** — wall plane vs ornament plane

The goal is not to make the model look prettier. A glossy PBR preset would hide the procedure. I want appearance to **respond to the generated ornament**: growth values coloring a front, curvature darkening the undercut of a leaf, world-height shifting density of weathering. The shader layer should be as parametric as the growth system, just later in the pipeline.

---

## 03 — Shader Studies to Explore

None of these are in the app yet. Each study is a direction I could implement later as a material experiment on facade geometry.

---

### Study A — Depth / Relief Shader

**Concept**

A shading model that exaggerates how far ornamental surfaces sit in front of or behind the wall plane. It can use surface normals, view-space or world-space depth, estimated curvature, light direction, and an extrusion-depth attribute from the generator. Raised ribs go lighter or catch a sharper terminator; recesses go darker. It is closer to a controlled raking-light drawing than to unbiased global illumination.

**Relevance**

Religious facade ornament often *is* the relationship between raised surfaces, recesses, light, and shadow. A vine that is geometrically correct can still read as a sticker if the material is lambertian and the light is frontal. Relief shading is a way to keep carved or extruded vegetal patterns readable at architectural scale, including on a dark studio viewport.

**Potential parameters**

| Control | Role |
|---|---|
| Relief contrast | How hard the raised/recessed split is |
| Depth intensity | How strongly extrusion depth tints the surface |
| Light direction | Fake or real raking angle |
| Shadow emphasis | How far cavities go toward black |

**Visual experiment**

Place one generated motif on a flat wall. Light it from the side, then from the front. Toggle relief contrast. The test succeeds if the same mesh reads as incised when depth intensity is high and as a flat decal when it is low — without changing a single vertex.

---

### Study B — Stone / Material Shader

**Concept**

Procedural stone instead of a photographic texture: fine noise for grain, slower noise for mineral patches, roughness variation, slight hue shifts, optional weathering in recesses or on upward faces. Same UVs and same mesh; different parameter sets become limestone, marble, sandstone, or a colder concrete-like ground.

**Relevance**

Ornament on a church, mosque, temple, or tomb is not generic “rock.” Limestone absorbs light; marble veining competes with the plant motif; sandstone weathers into softness. If the generator can instance the same vegetal graph onto different buildings, the material shader is how that graph becomes *architecture* rather than a 3D print in gray plastic. Weathering also gives age without a second growth simulation.

**Potential parameters**

| Control | Role |
|---|---|
| Roughness | Specular tightness; polished vs open stone |
| Grain scale | Size of crystalline / sandy noise |
| Grain strength | How visible the grain is |
| Color variation | Mineral tint range |
| Weathering | Dirt and erosion in cavities or on rain-washed faces |

**Visual experiment**

Freeze one ornament mesh. Sweep grain scale and color variation through “pale limestone,” “warm sandstone,” and “cool marble.” Then raise weathering only in concave areas. The motif should stay identical in outline while the facade changes period and upkeep.

---

### Study C — Curvature / Edge Shader

**Concept**

Shade from how the surface bends. Convex ridges (leaf midribs, bead moldings) go lighter; concave cavities (between stems, drilled eyes of foliage) go darker. Implementation later might use screen-space curvature, baked curvature maps, or a cheap normal-based edge detect. This is a readability tool, not a material.

**Relevance**

Vegetal ornament is geometrically busy. From a distance, a procedural vine can collapse into noise. Curvature shading is how engravers and digital sculptors keep form: edges and hollows get a graphic bias so the plant structure stays parseable when textures are quiet or absent.

**Potential parameters**

| Control | Role |
|---|---|
| Edge intensity | Brightening of convex ridges |
| Cavity intensity | Darkening of concave regions |
| Curvature scale | What counts as a “tight” bend |
| Contrast | Overall graphic strength |

**Visual experiment**

A dense generated spray of leaves, lit evenly so ordinary Lambert lighting fails. Raise cavity intensity until leaf overlaps separate; raise edge intensity until stems read as lines. The failure mode to watch: the shader turning into a toon outline that fights stone material.

---

### Study D — Growth Visualization Shader

**Concept**

A shader driven by a **normalized growth value** on the mesh or in a field:

- `0` — not generated yet (wall only, or invisible ornament)
- `1` — fully developed

The fragment (or a vertex mask) reveals the pattern over time: a bright front along branches, a color shift from sap-green construction color to stone, progressive materialization, a thin glowing growth edge, older generations fading toward the wall material. This is visualization of the **procedure**, not a botanical simulation of chlorophyll.

**Relevance**

The project is about computational growth, not only a final carved panel. If I only show the finished mesh, the work looks like a static asset. Mapping growth 0–1 into the material makes the generator’s logic visible: order of branching, competition, and how the motif colonizes a bay or archivolt. That is the closest shader analogue to showing hydraulic channels form over time in the existing Simulation tab.

**Potential parameters**

| Control | Role |
|---|---|
| Growth progress | Global 0–1, or playback of a stored field |
| Growth speed | How fast playback advances |
| Growth edge width | Thickness of the live front |
| Growth contrast | Wall vs new ornament vs front |

**Visual experiment**

Scrub growth progress from 0 to 1 on a frozen mesh that already contains the final topology (or a vertex attribute per generation). Watch whether the front follows branches coherently or pops random islands. Then combine with stone: the front is graphic; behind it, material is already limestone. The test succeeds if someone can infer *rules* from the playback, not only that “it grew.”

---

### Study E — Height / Position Shader

**Concept**

Color or modulate the facade from spatial position: world-space X, Y, Z, or distance to an architectural anchor (doorway, window, cornice, centerline). Example: base of the wall darker and more weathered; upper registers lighter; a radius around the portal with denser tint or stronger relief response.

**Relevance**

Religious facades are hierarchical. Ornament at an entrance is meant to be read at body scale; ornament at a roof-line is a silhouette. A growth system that ignores that hierarchy treats the wall as a texture plane. Position-based shading (and later, position-based generation) is a way to couple vegetal behavior to architecture: different treatment near the door than near the eaves, without modeling a second style by hand.

**Potential parameters**

| Control | Role |
|---|---|
| Gradient direction | Vertical, horizontal, radial, along a facade axis |
| Gradient scale | How quickly the effect changes with distance |
| Gradient contrast | Strength of the spatial bias |
| Anchor position | Door, window, or other feature in world space |

**Visual experiment**

A full bay with a marked portal. Drive weathering or growth contrast from distance-to-door vs from world Y. Compare: does the portal “collect” ornament visually, or does the roof become a second, lighter register? The useful failure is a gradient that looks like a studio backdrop instead of a tectonic rule.

---

### Study F — Light / Sacred Illumination Study

**Concept**

Lighting as a controlled instrument rather than only physically based sun + sky. Rim light on silhouettes of foliage, tight falloff so only relief catches, a halo-like bloom in cavities, a transmitted-looking edge on thin leaves, a restricted light color (warm flood vs cool moonlight). The study is **dramatic architectural illumination** — raking conservation lighting, night facade lighting, candle-adjacent interiors — applied to generated ornament.

This is **not** a claim that a glow is inherently sacred, or that a religion has a shader. It is a study of how theatrical and liturgical lighting conventions change how vegetal carving is perceived: more icon-like, more skeletal, more flattened, more precious.

**Relevance**

The same stone vine reads as documentation in noon sun and as a cult object under a single grazing fixture. If the project lives in a black viewport (this app’s default), default Three.js lights will under-explain the ornament. An experimental illumination shader is a way to test presentation, exhibition, and “night facade” readings without rebuilding geometry.

**Potential parameters**

| Control | Role |
|---|---|
| Light direction | Grazing vs frontal vs back-rim |
| Rim intensity | Brightness of silhouette edges |
| Light falloff | How fast the fixture dies across the wall |
| Glow intensity | Soft bloom in recesses or along rims |
| Light color | Warm / cool / restricted palette |

**Visual experiment**

One motif, relief shader on, stone roughness high. Sweep from museum-flat light to a single grazing rim. Then add a small glow only on cavities. Ask whether the plant still reads as masonry. If glow swallows grain, the illumination study is fighting the material study and should be turned down, not celebrated.

---

## 04 — Comparing the Studies

| Shader | Primary purpose | Geometry input | Simulation input | Visual effect | Why it matters |
|---|---|---|---|---|---|
| A Depth / Relief | Make extrusion readable | Normals, depth, extrusion | Optional depth attribute | Raking light, hard cavities | Carving is how facade ornament is seen |
| B Stone / Material | Architectural substance | UVs, normals, facing | Optional age / weather field | Grain, tint, roughness, dirt | Same mesh, different building material |
| C Curvature / Edge | Clarify busy plant form | Curvature, normals, edges | None required | Ridges light, hollows dark | Readability of dense vegetal geometry |
| D Growth visualization | Show the procedure | Branch UVs / vertices | Growth 0–1, generation | Fronts, fades, materialization | Makes computational growth visible |
| E Height / Position | Tie look to the building | World XYZ | Anchor positions | Gradients, portal emphasis | Ornament follows architectural hierarchy |
| F Light / illumination | Test dramatic presentation | Normals, silhouette | None required | Rim, falloff, glow, color | Perception changes with lighting convention |

Relief, curvature, and illumination all use normals; they overlap. Growth and position use data the generator or the facade layout must provide. Stone can sit under any of them as a base layer.

---

## 05 — Directions I Want to Develop

Three directions feel complementary rather than redundant:

1. **Growth Visualization Shader**
2. **Depth / Relief Shader**
3. **Stone / Material Shader**

The procedural system generates the **form**. That is the vegetal graph and its mesh.

The **growth shader** communicates the **process** — order, fronts, unfinished vs complete — so the work is not mistaken for a static asset library.

The **relief shader** communicates the **geometry** — what is carved forward, what is the wall — which is the architectural fact of facade ornament.

The **material shader** communicates **architectural materiality** — this is limestone on a portal, not a shader toy and not a plastic 3D print.

Together they cover what was generated, how it grew, how its depth is perceived, and what it is made of. Curvature can later fold into relief. Position can later modulate growth or weathering. Illumination can stay a presentation mode on top, once the first three are honest.

---

## 06 — Possible Combined Shader System

These studies do not have to remain six materials. A later pipeline could be one system:

```text
PROCEDURAL GROWTH
        ↓
VEGETAL GEOMETRY
        ↓
RELIEF / CURVATURE INFORMATION
        ↓
PROCEDURAL MATERIAL
        ↓
LIGHTING
        ↓
FINAL FACADE
```

Vertex stage: subtle displacement from relief or a growth swell; pass growth, extrusion, and world position to the fragment stage.

Fragment stage: stone variation + curvature/relief + growth mask + lighting.

That is still conceptual. Implementation would start with one mesh, one material, and a few uniforms — not a shader-switching tab in the current app.

---

## 07 — Screenshots / Future Experiments

Implemented Shader Lab stills live in [08 — Shader Experiments](../08-shaders-experiments/README.md).

This page stays the brief: what to test, which knobs matter, and why the first three to build were growth, relief, and stone.

---

## Implementation

Study notebook with screenshots: [08 — Shader Experiments](../08-shaders-experiments/README.md).

Shader Lab is the **Shaders** tab. It does not touch Particles, Noise, Simulation, or Voxel Lab. Chrome follows the style guide; the viewport does not — the point is to try different materials and lights.

### What was implemented

| Strategy | Role |
|---|---|
| 01 Baseline | `MeshStandardMaterial`: color, roughness, metalness |
| 02 Relief | Custom: raking light, N·L contrast, baked `aRelief` |
| 03 Stone | Procedural fBm grain, veins, weathering; limestone / marble / sandstone / concrete presets |
| 04 Curvature | Screen-space `dFdx`/`dFdy` of world normals (not a 1-ring mesh Laplacian) |
| 05 Growth | Vertex `aGrowth` 0–1, traveling front, Auto Grow |
| 06 Position | World X/Y/Z gradient or distance to an anchor |
| 07 Illumination | Directional + rim + falloff; presentation, not a physical sun |

Compare mode draws Baseline on the left and the current strategy on the right, same mesh, same orbit.

### Geometry tested

- **Plane** — subdivided card; growth travels in U
- **Sphere** — lighting / curvature
- **Relief** — displaced architectural panel (frame + inner bosses)
- **Vegetal** — merged wall + stem + branches + leaves, with `aGrowth` increasing toward the tips

There is no full facade generator here. Vegetal is a readable stand-in for carved branching ornament.

### Controls

Uniforms update every frame from a settings ref. Changing a slider does not rebuild the React tree’s GPU resources; switching **strategy** or **geometry** does recreate the material or mesh.

Reset Shader restores only the active strategy’s defaults.

### Observations

- Growth is the experiment that actually shows *process*. At progress ~0.4 the stem and lower forks read as grown and the outer leaves stay dormant; near 1.0 the whole vine is lit and a bright front sits on the last generation. A uniform fade would not do that.
- The backing panel is easy to misread as “already grown” if its growth attribute is near 0. Growth is about the ornament, not the wall.
- Stone presets change the same mesh without new topology. Limestone vs marble is mostly grain scale + roughness; weathering only shows if there is recessed `aRelief`.
- Relief needs a raking light. Frontal light (high Z, low X) flattens the vine back into a sticker, which is the point of the study.
- Curvature is a derivative approximation. It is noisy on the low-poly leaves and clearer on the relief panel. That is acceptable for a lab; a baked curvature map would be the next step on real facade meshes.
- Compare is the fastest way to argue that a shader is not a filter: left is clay, right is the study.

### Files

`app/src/views/ShaderLabView.jsx`, `app/src/ui/ShaderLabPanel.jsx`, `app/src/shaders/` (`settings.js`, `geometry.js`, `materials.js`, `common.glsl.js`, `ShaderScene.jsx`).

Screenshots of the running lab are in [08 — Shader Experiments](../08-shaders-experiments/README.md).
