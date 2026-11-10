# Study notebook

Documentation for experiments in this repository. Start at the root [README](../README.md). Each numbered folder is one study area.

The application code stays in `app/`. These notes describe what that code is doing and what was observed while using it.

## Study areas

| # | Topic | What was investigated |
|---|---|---|
| 01 | [Particles](01-particles/README.md) | Point cloud, spacing, hue, noise-warped hull |
| 02 | [Procedural Noise](02-procedural-noise/README.md) | Simplex, octaves, types, shaping, layered blend |
| 03 | [Terrain Generation](03-terrain-generation/README.md) | Heightmap → 3D mesh, island falloff, shared source |
| 04 | [Hydraulic Simulation](04-hydraulic-simulation/README.md) | Rain, flow, sediment, erosion, ocean |
| 05 | [Vegetation Simulation](05-vegetation-simulation/README.md) | Moisture/slope/elevation-driven growth |
| 06 | [Voxel Experiments](06-voxel-experiments/README.md) | Density, CSG, meshing, chunks |
| 07 | [Firebase](07-firebase/README.md) | Auth, Firestore, Hosting |
| 08 | [Shader Experiments](08-shaders-experiments/README.md) | Shader Lab: growth, relief, stone, curvature, position, light |
| 09 | [Growth Lab](09-growth-lab/README.md) | Where ornament emerges, how it travels (splines), which forces could drive it (particles + vector field) |
| 10 | [L-Systems and Levels of Detail](10-lsystems-lod/README.md) | Rule-based branching (tree, ivy, tracery) on the wall; High/Medium/Low LOD from one branch graph, with measured triangles and draw calls |
| 11 | [Gothic Architecture](11-gothic-architecture/README.md) | Tracery Window families (Geometric / Rayonnant / Flamboyant), shared 2D curve graph → stone sweeps, six curated presets |
| 12 | [Ornament System](12-ornament-system/README.md) | Growth conditions, trails, branching, composition, sculptural integration (Steps 7–10C) |
| 13 | [Agent Simulation](13-agent-simulation/README.md) | Surface agents, stigmergy, agent-built ornament (Steps 11A–11C) |
| 14 | [Architectural Scale](14-architectural-scale/README.md) | Shared meter scale, proportional ornament, scale reference (Step 12A) |
| 15 | [Camera LOD](15-camera-lod/README.md) | Screen-space LOD for Gothic / ornament / agent viz (Step 12B) |
| 16 | [Geometric Kernel](16-geometric-kernel/README.md) | Pure 2D math kernel for Gothic Grammar (Step 13A.1): points, arcs, intersections, regions |
| 17 | [Pointed Arch](17-pointed-arch/README.md) | Two-centered equilateral / lancet / depressed arches (Step 13B) |
| 18 | [Gothic Tracery Grammar](18-gothic-tracery-grammar/README.md) | Lancet subdivision, trefoil/quatrefoil, oculus, composed window (Step 13C) |
| 19 | [Constructible Tracery Regions](19-constructible-tracery-regions/README.md) | Solid/void planar regions + SECTION mode (Step 13C.1) |
| 20 | [Procedural 3D Stone](20-procedural-3d-stone/README.md) | Region extrusion, molding profiles/sweeps, Stone/3D workspace (Step 13D / 13D.1) |
| 21 | [Rayonnant Architectural Refinement](21-rayonnant-refinement/README.md) | Bar-tracery hierarchy, spandrel openings, Baseline ↔ Refined presets (Step 13D.2) |
| 22 | [Rayonnant Bar Network](22-rayonnant-bar-network/README.md) | Connected bar-tracery graph, stone-from-network, clipped-spandrel diagnosis (Step 13D.3) |
| 23 | [Rayonnant Elaborate](23-rayonnant-elaborate/README.md) | Hierarchical zones, nested lancets, dominant oculus, curved spandrels (Step 13D.4) |
| 24 | [Skeleton-First Rayonnant](24-skeleton-first-rayonnant/README.md) | Centerline graph → strip union stone; Rayonnant Skeleton preset (Step 13D.5) |
| 25 | [Connected Oculus Tracery](25-connected-oculus-tracery/README.md) | Skeleton + connected oculus ring / upper connectors; Rayonnant Oculus Network (Step 13D.6) |
| 26 | [Rayonnant Secondary Tracery](26-rayonnant-secondary-tracery/README.md) | Quatrefoil in oculus + symmetric side secondaries; Rayonnant Secondary Tracery (Step 13D.7) |
| 27 | [Oculus Junction Refinement](27-oculus-junction-refinement/README.md) | Tip-to-ring foils, apex clearance, junction scale; Rayonnant Oculus Refined (Step 13D.8) |
| 28 | [Hierarchical Rayonnant](28-hierarchical-rayonnant/README.md) | Recursive pointed-arch cells, nested lancets, trefoil heads; Rayonnant Hierarchical (Step 13D.9) |

[Shader Studies](Tutorials/Shader-Studies.md) is the research brief that preceded Shader Lab. [Style guide](style-guide.md) is the visual authority for the interface, not a simulation study.

## How the app is organized

| Tab | Source |
|---|---|
| Particles | `app/src/views/ParticlesView.jsx`, `ParticleField.jsx` |
| Noise 2D | `app/src/views/Noise2DView.jsx`, `app/src/noise/` |
| Noise 3D | `app/src/views/Noise3DView.jsx`, same noise stack |
| Simulation | `app/src/views/SimulationView.jsx`, `app/src/simulation/` |
| Voxel Lab | `app/src/views/VoxelLabView.jsx`, `app/src/voxel/` |
| Shaders | `app/src/views/ShaderLabView.jsx`, `app/src/shaders/` |
| Growth Lab | `app/src/views/GrowthLabView.jsx`, `app/src/growth/` |
| L-Systems | `app/src/views/LSystemView.jsx`, `app/src/lsystems/` (reuses the Growth Lab wall and surface) |
| Gothic Architecture | `app/src/views/GothicArchitectureView.jsx`, `app/src/gothic/` |
| Gothic Grammar | `app/src/views/GothicGrammarView.jsx`, `app/src/geometry/gothicGrammar/` (independent of legacy gothic) |
| Ornament System | `app/src/views/OrnamentSystemView.jsx`, `app/src/ornament/` (reuses Gothic window generator) |
| Agent Simulation | `app/src/views/AgentSimulationView.jsx`, `app/src/agents/` (reuses Gothic window + ornament anchors/graph) |

Noise 2D, Noise 3D, and Simulation share one heightmap from `fillHeightmap()` in `app/src/noise/sample.js`. Voxel Lab does not; it uses its own 3D density sampler.

## Weekly notes and tutorials

These are earlier write-ups, kept because they still describe the work:

- [Week 4 — Voxel Exercise and Firebase](Documentation/Week4.md)
- [Hydraulic simulation analysis (15 Sep)](Analysis/Hydraulic%20Simulation%200909.md)
- [Installing React](Tutorials/Installing%20React.md)
- [React](Tutorials/React.md)
- [Git and GitHub](Tutorials/Git%20%26%20Github.md)
- [Firebase tutorial](Tutorials/Firebase_Tutorial.md)
- [Voxels (concept note)](Tutorials/Voxels.md)
- [Shaders (concept note)](Tutorials/Shaders.md)
- [Shader Studies](Tutorials/Shader-Studies.md)
- [08 — Shader Experiments](08-shaders-experiments/README.md)
- [09 — Growth Lab](09-growth-lab/README.md) (session of 4 October 2026)
- [10 — L-Systems and Levels of Detail](10-lsystems-lod/README.md) (session of 10 October 2026)
- [11 — Gothic Architecture](11-gothic-architecture/README.md) (session of 20 October 2026)
- [12 — Ornament System](12-ornament-system/README.md) (session of 21 October 2026)
- [13 — Agent Simulation](13-agent-simulation/README.md) (session of 28 October 2026)
- [14 — Architectural Scale](14-architectural-scale/README.md) (session of 28 October 2026)
- [15 — Camera LOD](15-camera-lod/README.md) (session of 28 October 2026)
- [16 — Geometric Kernel](16-geometric-kernel/README.md) (session of 8 November 2026)
- [17 — Pointed Arch](17-pointed-arch/README.md) (session of 8 November 2026)
- [18 — Gothic Tracery Grammar](18-gothic-tracery-grammar/README.md) (session of 8 November 2026)
- [19 — Constructible Tracery Regions](19-constructible-tracery-regions/README.md) (session of 8 November 2026)
- [20 — Procedural 3D Stone](20-procedural-3d-stone/README.md) (session of 8 November 2026)
- [21 — Rayonnant Architectural Refinement](21-rayonnant-refinement/README.md) (session of 9 November 2026)
- [22 — Rayonnant Bar Network](22-rayonnant-bar-network/README.md) (session of 9 November 2026)
- [23 — Rayonnant Elaborate](23-rayonnant-elaborate/README.md) (session of 9 November 2026)
- [24 — Skeleton-First Rayonnant](24-skeleton-first-rayonnant/README.md) (session of 9 November 2026)

Screenshot originals stay in [`Images/0922`](../Images/0922). Topic folders hold copies next to the notes that use them. Shader Lab stills are in [`08-shaders-experiments/Images`](08-shaders-experiments/Images).

## Screenshots that do not exist yet

Noise 2D and Noise 3D have no dedicated stills. Those notebooks use placeholders instead of invented images.
