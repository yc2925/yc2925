# 02 — Procedural Noise

## Overview

Noise 2D is the grayscale laboratory for the heightmap that later becomes 3D terrain and the hydraulic world. The investigation was how fractal noise, type transforms, shaping curves, and layered blending change a 2D field — and which combinations stay usable as landscape rather than texture noise.

Tab: **Noise 2D**. Shared settings object: `app/src/noise/settings.js`.

## Concepts

**Simplex noise** produces a continuous field in 2D. One sample is too smooth for terrain, so **octaves** stack copies at increasing frequency (**lacunarity**) and decreasing amplitude (**persistence**). That stack is often called fBm (fractal Brownian motion).

A **noise type** remaps that stack:

- Ridged — invert absolute value → sharp crests
- Terracing — quantize height into steps
- Billow — fold toward absolute noise → rounded mounds
- Turbulence — mix toward fractal absolute noise → roughness
- Power curve — raise normalized height to an exponent
- Domain warping — offset sample coordinates with a second fBm

**Shaping** is a second curve after the type: gain, bias, contrast, smoothstep, invert, gamma.

Up to **three layers** are sampled, weighted by Blend, then divided by total weight. Disabled layers are skipped.

## Implementation

| File | Role |
|---|---|
| `app/src/noise/simplex2d.js` | Simplex kernel |
| `app/src/noise/sample.js` | Types, shaping, `fillHeightmap()` |
| `app/src/noise/settings.js` | Defaults, limits, tooltips |
| `app/src/views/Noise2DView.jsx` | Grayscale preview |
| `app/src/ui/NoisePanel.jsx` | Shared controls (also used in Noise 3D and Simulation) |

`fillHeightmap()` walks every grid cell, blends enabled layers, optionally blurs (`smoothing`), normalizes, then subtracts an **island falloff** near the square boundary so the field can sit in an ocean.

Default layers (as currently shipped):

1. Billow + smoothstep, low frequency (broad mounds)
2. Domain warp + smoothstep, medium frequency
3. Ridged, finer, lower blend

## Parameters / Controls

Global (apply to the whole map, not one layer):

| Parameter | Effect |
|---|---|
| Resolution | Grid size of the 2D map and later 3D mesh. Higher is sharper and slower. Range 32–192, default 96. |
| Height | Vertical scale in 3D only. Does not change the 2D grayscale. |
| Smoothing | Low-pass blur passes on the blended field. Suppresses synthetic spikes. |
| Island falloff | Lowers values near the boundary so a landmass can sit in ocean. |

Per layer:

| Parameter | Effect |
|---|---|
| Enable | Include or skip the layer. |
| Blend | Weight when mixing with other enabled layers. |
| Type | Which remapping is applied to the octave stack. |
| Type amount | Ridge sharpness, terrace count, billow mix, roughness, power, or warp distance. |
| Shaping / amount | Curve after the type. |
| Frequency | Spatial scale. Higher packs more features into the same area. |
| Octaves | Number of stacked noise layers. More octaves add finer detail. |
| Persistence | How loud each extra octave stays. |
| Lacunarity | Frequency jump per octave. |
| Seed | Repeatable offset of the pattern. |

## Experiments / Observations

- Frequency is the fastest way to change “what size of hills I have.” Low frequency on layer 1 reads as continents or large ridges; high frequency turns the map into gravel.
- Octaves without lowering persistence make the field noisy and hard to read as land. The defaults keep persistence around 0.38–0.46 so extra octaves add texture, not a second mountain range.
- Ridged on a high-frequency layer cuts sharp drainage-like crests. Billow on a low-frequency layer is the opposite: fat, cloud-like hills.
- Domain warp does not add hills; it bends the ones that are already there. Too much warp looks like melted marble rather than terrain.
- Terracing is obvious in 2D as bands of gray. It is more useful after a smooth base layer than as the only type.
- Island falloff fights high frequency at the corners. If falloff is high and frequency is high, the edge still drops, but the interior can look busier than the silhouette suggests.
- Changing noise here immediately changes Noise 3D and the Simulation reset terrain, because they share the same `noise` state in `App.jsx`.

## Screenshots / Examples

<!-- TODO: Add screenshot of Noise 2D grayscale heightmap with layer controls visible -->

No dedicated Noise 2D still exists in `Images/0922`. Do not use voxel or Firebase screenshots as a substitute; they are a different field.

## Key Takeaways

- Terrain identity is mostly frequency + type + layer weights, not the simplex kernel itself.
- Layering is easier to control than one overloaded noise function: one broad form, one warp or roughness, one fine ridge.
- The 2D view is the right place to judge a heightmap. 3D lighting can hide a bad blend that is obvious in grayscale.
