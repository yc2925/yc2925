# 03 — Terrain Generation

## Overview

Noise 3D takes the 2D heightmap and displaces a grid in Y. The study was how a scalar field becomes a landscape you can orbit, and which extra parameters (height, smoothing, island falloff) belong to the mesh rather than the noise type.

The same mesh recipe is the **starting terrain** for hydraulic simulation. Voxel Lab is a different generator (3D density), documented separately.

Tab: **Noise 3D**. Source heightmap: `fillHeightmap()` in `app/src/noise/sample.js`.

## Concepts

A **heightmap** stores one elevation per grid cell. In 3D, each cell becomes a vertex. That is 2.5D terrain: one surface, no caves, no overhangs.

**Island falloff** subtracts a radial edge term after normalization so the square domain reads as a landmass in water rather than a tiled noise patch.

**Smoothing** is a small blur on the height array. It is not an extra octave; it removes one-cell spikes that look synthetic once they are extruded.

**Amplitude (Height)** scales vertex Y. It does not recompute noise. The 2D preview stays the same while the 3D relief grows or flattens.

## Implementation

| File | Role |
|---|---|
| `app/src/noise/sample.js` | `fillHeightmap()` — blend, blur, island |
| `app/src/views/Noise3DView.jsx` | Displaced mesh, red height gradient, slow auto-rotate |
| `app/src/ui/NoisePanel.jsx` | Same panel as Noise 2D |
| `app/src/views/SimulationView.jsx` | Rebuilds hydraulic state from this heightmap on reset / noise change |

After blending layers, heights are normalized, then:

```text
normalized - edge * islandFalloff
```

`edge` is a smoothstep of radial distance from the center of the square. A last blur pass runs if island falloff is greater than zero.

The 3D material uses a red height gradient (dark low, bright high) per the style guide. Blue is reserved for water in Simulation, not for dry terrain.

## Parameters / Controls

All Noise 2D layer controls apply. Additional mesh-facing parameters:

| Parameter | Effect |
|---|---|
| Height (amplitude) | Vertical exaggeration. Default 0.72. Range 0.05–2.4. |
| Smoothing | Blur passes before and (if island) after falloff. Default 2. |
| Island falloff | How hard the edges drop toward ocean. Default 0.78. |
| Resolution | Vertex count is `resolution × resolution`. Default 96. |

Default three-layer mix: broad billow, warped mid-frequency, light ridged detail.

## Experiments / Observations

- Height and frequency interact. High frequency + high amplitude produces spiky, un-walkable relief. The same frequency at low amplitude reads as surface texture on a hill.
- Island falloff is what makes Simulation’s ocean make sense. With falloff at 0, the mesh is a noisy square slab and the sea-level plane cuts arbitrarily through the corners.
- Smoothing 0 keeps terrace and ridge edges crisp but also keeps simplex grid artifacts. Two passes was enough for the default billow/warp mix; more than that starts to erase the ridged layer.
- Resolution 96 is a compromise: fine enough for later channels, cheap enough for several hydraulic substeps per frame. 192 looks better in Noise 3D and is noticeably heavier once Simulation records snapshots.
- Because Simulation reset copies this heightmap, “designing terrain” happens in Noise 2D/3D first. Erosion cannot invent a mountain range that was not in the source field; it can only cut and deposit on it.

## Screenshots / Examples

<!-- TODO: Add screenshot of Noise 3D red-gradient terrain with orbit view -->

No dedicated Noise 3D still is in the image archive. The Simulation screenshots in [Hydraulic Simulation](../04-hydraulic-simulation/README.md) show this heightmap **after** rain and vegetation, not the dry generated mesh.

## Key Takeaways

- This project’s “terrain generator” is a layered 2D heightmap, not a voxel volume.
- Island falloff is a domain-shaping trick, not a noise type. It decides whether the world is an island.
- Keep Noise 3D in the loop when judging blends: grayscale shows structure; the mesh shows whether that structure is too steep or too flat to erode well.
