# 01 — Particles

## Overview

This was the first Three.js experiment: replace a placeholder cube with a point cloud and drive it from a small side panel. The question was whether a few sliders could make an obviously procedural object without building terrain yet.

Tab: **Particles**. About 3600 points on a sphere, warped by 3D value noise.

## Concepts

A **particle** here is one vertex in a `THREE.Points` cloud, not a physics particle.

Positions start on a Fibonacci / golden-angle sphere so the cloud is even. **Value noise** (hashed lattice corners, interpolated) is evaluated in 3D and scaled by the Shape slider. That noise does not move points independently; it changes the radius of the whole hull.

Hue is content color. The UI stays grayscale + red; particle color is allowed to be something else.

## Implementation

| File | Role |
|---|---|
| `app/src/ParticleField.jsx` | Builds positions, `Points` material |
| `app/src/particleSettings.js` | Limits, defaults, tooltips |
| `app/src/views/ParticlesView.jsx` | Canvas + orbit camera |
| `app/src/ui/ParticlesPanel.jsx` | Spacing, Color, Shape |

`buildPositions(spacing, shape)` places each index `i` on a unit sphere, samples four octaves of value noise, then scales by `spacing`. Shape `0` keeps a sphere. Higher shape increases noise frequency and warp amplitude.

## Parameters / Controls

| Parameter | Default | Effect |
|---|---|---|
| Spacing | 0.28 | Distance between points. Higher expands the whole cloud. |
| Color (hue) | 214 | Hue of the points. Does not change the UI accent. |
| Shape | 0.20 | Irregularity of the outer hull. 0% is a sphere; higher makes a lumpy blob. |

## Experiments / Observations

- Spacing is a uniform scale. At low values the cloud reads as a dense ball; at high values it thins out and the sphere structure is easier to see.
- Shape is more interesting than hue. Small shape values add gentle lumps. Past roughly the middle of the slider, the hull breaks into a noisy blob because the warp frequency also increases (`1.15 + shape * 2.8`).
- Hue changes are immediate and cosmetic. They do not affect spacing or silhouette, which made this a good first control to prove the panel was wired to the mesh.

## Screenshots / Examples

![Particles tab with Firebase chrome](Images/0922_Doc_Firbase2.jpg)

*Top half: Particles tab. White/blue point cloud, Spacing / Color / Shape on the right. This still was taken while adding Firebase buttons; it is the only existing particle screenshot.*

## Key Takeaways

- A small set of parameters is enough if each one has a visible spatial effect.
- Noise on radius reads as “procedural form”; noise on color would have been a texture, not a shape.
- This tab stayed independent. Later terrain and voxels did not reuse the particle field.
