# 04 — Hydraulic Simulation

## Overview

Simulation asks what happens when a procedural heightmap is treated as soil and water is allowed to move. The model is a simplified Eulerian grid: each cell stores height, water, sediment, and a few overlays. It is not CFD and not a droplet particle system.

Tab: **Simulation**. Solver: `stepHydraulic()` in `app/src/simulation/hydraulic.js`.

The relationship that was being studied:

```text
Rainfall
  → water accumulation
    → downhill flow
      → sediment transport
        → erosion (scour)
        → deposition
          → evaporation
```

Ocean level is a boundary: low terrain is submerged, and water/sediment at the map edge drain toward that reservoir.

## Concepts

**Heightfield hydrology** — water is a depth on top of terrain. Surface height for flow is `terrain + water`. Water only moves to lower neighboring surfaces (four-connected: left, right, up, down). Diagonal flow happens indirectly over multiple steps.

**Capacity** — moving water can carry a limited amount of sediment, estimated from water depth, velocity, slope, and the Capacity slider. Undersaturated water **erodes**; oversaturated water **deposits**.

**Spatial rainfall** — intensity comes from a moving simplex field (`precipitation.js`), not a uniform tap. Visible rain particles sample the same field; they do not collide as individual hydraulic masses.

**Ocean** — `oceanLevel` clips the island and is the comparison height for out-of-bounds neighbors. Ocean waves in the renderer are visual (`shaderMaterial` in `HydraulicWorld.jsx`) and do not erode the island.

Vegetation shares this solver’s arrays and is documented in [05 — Vegetation](../05-vegetation-simulation/README.md). Roots reduce flow and scour when erosion resistance is high.

## Implementation

| File | Role |
|---|---|
| `app/src/simulation/hydraulic.js` | One solver step, telemetry |
| `app/src/simulation/precipitation.js` | Moving rainmap |
| `app/src/simulation/settings.js` | Limits, defaults, tooltips |
| `app/src/simulation/HydraulicWorld.jsx` | Terrain, inland water, ocean, rain points, recording |
| `app/src/views/SimulationView.jsx` | Wires noise terrain → hydraulic state |
| `app/src/ui/SimulationPanel.jsx` | Run, rain, flow, erosion, ocean, timeline |

One step, in order:

1. **Add rainfall** — `water[i] += rain * rainFactor * delta`. `rainFactor` is the precipitation field.
2. **Route flow** — compare surface to four neighbors (or ocean if off-map). Move a fraction of water (`flow`) and a matching fraction of suspended sediment.
3. **Erode or deposit** — compare sediment load to capacity. Scour lowers terrain and loads sediment; deposition raises terrain and unloads sediment. Vegetation can scale this down (`rootProtection`).
4. **Coastal drain** — edge cells leak water into the ocean reservoir and can drop a little sediment as coastal deposit.
5. **Evaporate** — exponential decay of remaining water. Tiny residual depths are zeroed.

`iterations` (Steps / frame) repeats this inside one rendered frame. `simulationSpeed` scales the time step, not the display FPS.

Recording copies terrain, water, sediment, scour, deposition, and vegetation into memory about every 0.1s. Timeline review does not pause the live solver. Recordings are not saved to disk.

## Parameters / Controls

Values below are the **current** defaults in `settings.js`.

### Time

| Parameter | Default | Effect |
|---|---|---|
| Run / Pause | on | Enables or pauses rain, flow, erosion, vegetation. |
| Simulation speed | 1.0 | Multiplier on the fixed step. Faster weathering, same render rate. |
| Steps / frame | 3 | Hydraulic substeps per frame. Higher = faster landscape change, more CPU. |

### Precipitation

| Parameter | Default | Effect |
|---|---|---|
| Rain intensity | 0.014 | Water added per second (scaled by the rainmap). |
| Rain variation | 0.68 | Contrast between wet cells and dry cells. 0 approaches uniform rain. |
| Rain scale | 1.5 | Spatial size of storm cells. Higher → smaller, more frequent patches. |
| Rain movement | 0.035 | How fast the rainmap drifts. |

### Hydrology and sediment

| Parameter | Default | Effect |
|---|---|---|
| Flow | 0.62 | Fraction of water that can move downhill in a step. |
| Sediment capacity | 1.65 | How much soil water may carry. Higher → deeper cuts before deposition. |
| Erosion strength | 0.90 | Scales terrain change from depth × velocity × slope. |
| Scour rate | 0.48 | How quickly undersaturated water removes soil. |
| Deposition rate | 0.24 | How quickly excess sediment is put back. |
| Evaporation | 0.085 | Continuous loss from the same water field rain fills. |

### Ocean (visual + boundary)

| Parameter | Default | Effect |
|---|---|---|
| Ocean level | −0.26 | Sea-level plane. Also the off-map comparison height. |
| Wave height / scale / speed | 0.055 / 0.55 / 0.32 | Appearance of the surrounding ocean only. |

### View toggles

Terrain, rain particles, inland water surface, erosion overlay, vegetation, soil-moisture overlay, wireframe (`W`). Hiding water does not remove it from the solver.

## Experiments / Observations

- **Rain intensity** is the main “how wet is this world” knob. Too low and channels never connect; too high and the island floods into a sheet that erodes broadly instead of cutting streams.
- **Rain variation** is what makes patchy storms. With variation near 0, the whole interior weathers evenly. With variation high, one side of the island can stay relatively dry while the other incises.
- **Rain scale** changes storm size, not total rain as strongly as intensity does. Low scale → large wet/dry regions. High scale → speckled showers that do not organize long rivers.
- **Flow** vs **evaporation** decides whether water lives long enough to leave the highlands. High flow + low evaporation sends water to the coast quickly and can export sediment off-map. Low flow + low evaporation leaves persistent pools in every dimple.
- **Capacity** and **scour** together control channel depth. High capacity with high scour carves quickly and can destabilize slopes (which then kills vegetation). Low capacity deposits early — fans and infill rather than canyons.
- **Deposition** is easy to under-notice until capacity drops in flats. Raising deposition builds visible fills at slope breaks and along the coast.
- **Steps / frame** is a performance/quality stand-in for “how much simulation time per second of watching.” At resolution 96, 3 steps stayed interactive; pushing both resolution and steps made recording memory and frame time worse together.
- **Ocean level** is not only visual. Raising it shrinks the catchment and shortens rivers. Lowering it exposes more land and gives vegetation more area, but also more edge drain.
- Ocean waves do not feed the solver. Changing wave height never changed channels.

Limitations that showed up in use: four-neighbor flow makes diagonal valleys look stepped; rain points are a visualization of the rainmap; long recordings hold several full-resolution arrays in RAM.

## Screenshots / Examples

![Simulation tab with vegetation and Firebase buttons](Images/0922_Doc_Firbase2.jpg)

*Bottom half: Simulation after the heightmap has been running. Red island, inland water, green vegetation instances, rain/erosion/vegetation sliders. Same still as the Particles chapter (top half).*

![Public hosted Simulation](Images/0922_Doc_Firbase3.jpg)

*Firebase Hosting build of the same tab. Ocean surrounds the island; vegetation clusters on milder, wetter ground rather than the steepest red slopes.*

<!-- TODO: Add screenshot showing isolated hydraulic erosion channels with vegetation hidden -->

## Key Takeaways

- The interesting landscape is the **coupling**: rain pattern × slope × how long water survives (flow vs evaporation) × how much soil it may carry.
- A heightmap cannot grow new mountain ranges under this solver; erosion only redistributes what Noise 3D provided.
- Spatial rain matters as much as rain amount. Uniform rain weathers; a moving rainmap organizes.
- Keep ocean, inland water, and rain particles conceptually separate: one is a boundary, one is solver water, one is a diagram of precipitation.
