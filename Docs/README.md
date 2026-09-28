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

Screenshot originals stay in [`Images/0922`](../Images/0922). Topic folders hold copies next to the notes that use them. Shader Lab stills are in [`08-shaders-experiments/Images`](08-shaders-experiments/Images).

## Screenshots that do not exist yet

Noise 2D and Noise 3D have no dedicated stills. Those notebooks use placeholders instead of invented images.
