# App and Hydraulic Simulation Analysis

This document summarizes the application as of September 15, 2026, with emphasis on the procedural noise and hydraulic erosion systems.

## What we built

The project began as a Vite + React application and developed into an interactive procedural world-building tool rendered with Three.js through React Three Fiber.

The interface currently has four tabs:

1. **Particles** — a procedural particle cloud with controls for spacing, hue, and outer-shape distortion.
2. **Noise 2D** — a grayscale preview of a procedural heightmap.
3. **Noise 3D** — the same heightmap displaced into a 3D terrain, colored with a red height gradient.
4. **Simulation** — a real-time grid-based hydraulic erosion model built on the shared noise terrain.

The UI follows `Docs/style-guide.md`: near-black surfaces, square controls, thin borders, compact typography, and true red as the main interface signal color. Blue is reserved for simulated rain and water content.

## Procedural terrain source

The terrain starts as a two-dimensional height array generated from simplex noise. A grayscale value in the 2D view becomes the vertical position of a vertex in the 3D views.

Up to three noise layers can be combined. Each layer can be enabled independently and has a blend weight. Enabled layers are sampled separately, multiplied by their blend weights, added together, and divided by the total active weight.

The available noise types are:

- **Ridged** — inverts absolute noise to form narrow crests.
- **Terracing** — quantizes continuous heights into discrete steps.
- **Billow** — folds noise around zero to create rounded, cloud-like forms.
- **Turbulence** — emphasizes absolute fractal variation and roughness.
- **Power curve** — raises normalized height to an exponent, changing the balance between valleys and peaks.
- **Domain warping** — uses secondary noise values to distort sampling coordinates before evaluating the main field.

Post-noise shaping operations include Gain, Bias, Contrast, Smoothstep, Invert, and Gamma.

### Noise parameters

- **Resolution** controls the number of grid samples and terrain vertices. Higher values give finer detail but increase CPU, geometry, and recording-memory cost.
- **Height** scales the vertical displacement of the 3D terrain. It does not alter the source values.
- **Layer** chooses which of the three noise layers is being edited.
- **Enable** includes or excludes the selected layer.
- **Blend** controls the selected layer's contribution to the final weighted heightmap.
- **Type** selects the layer's noise transformation.
- **Type amount** changes meaning with the type: ridge sharpness, terrace count, billow amount, turbulence roughness, power exponent, or warp strength.
- **Shaping** selects a curve applied after the selected noise type.
- **Shaping amount** controls the strength of that curve.
- **Frequency** controls how many large-scale features fit into the terrain.
- **Octaves** controls how many progressively finer noise layers are stacked.
- **Persistence** controls how much amplitude each finer octave retains.
- **Lacunarity** controls the frequency increase between octaves.
- **Seed** selects a repeatable variation of the pattern.

Changing the noise parameters creates a new base terrain for the hydraulic simulation.

## Hydraulic erosion model

The simulation is a simplified Eulerian, grid-based hydraulic erosion model. It operates on fixed cells rather than tracking individual water droplets physically.

Every grid cell stores:

- Terrain height
- Water depth
- Suspended sediment
- Recent scour intensity
- Temporary next-step water and sediment values
- Estimated flow velocity
- Local downhill slope

One solver step performs the following sequence.

### 1. Add rainfall

Rain adds water depth to every grid cell. If Rainmap is enabled, each cell receives a different amount based on a deterministic pattern. Otherwise, rainfall is uniform.

### 2. Calculate downhill flow

The solver compares the combined terrain-and-water surface height of each cell with its four direct neighbors: left, right, up, and down.

Water is distributed only to lower neighboring surfaces. The amount moved depends on the height difference, available water, Flow setting, and simulation time step.

### 3. Transport sediment

Moving water carries a proportional amount of the cell's suspended sediment into neighboring cells.

### 4. Erode or deposit terrain

Sediment capacity is estimated from:

- Local slope
- Water velocity
- Water depth
- Capacity parameter

If the water carries less sediment than its capacity, it removes material from the terrain. This is scour.

If the water carries more sediment than its capacity, it deposits the excess onto the terrain.

### 5. Evaporate water

A fraction of water is removed from every cell. Small residual quantities are set to zero.

The cycle repeats for the selected number of Steps per frame.

## What the rain simulation does

Rain runs continuously whenever the Simulation view is active and Run is enabled. Recording is independent and only stores snapshots.

Two related systems run from the same precipitation field:

1. **Visible rainfall** — dark, desaturated rain particles fall where the moving precipitation field is locally active.
2. **Hydraulic rainfall** — the CPU solver adds numerical water depth to terrain cells. This is the water that flows, carries sediment, erodes slopes, and accumulates in low regions.

The points approximate the location and intensity of the solver's rain field, but do not individually collide with terrain vertices.

Accumulated water is rendered as a separate dynamic transparent heightfield at `terrainHeight + waterDepth`. A large procedural ocean surface surrounds and submerges the island.

When **Stop** is pressed:

- Snapshot recording stops.
- Rainfall and hydraulic simulation continue.
- Dragging the timeline reviews stored terrain, water, sediment, scour, and deposition without stopping the live solver.
- Pressing Live returns the display to current simulation state.

Pressing **Reset** clears recorded frames and restores the current procedural noise terrain.

## Hydraulic controls

### Run

Pauses or enables the complete environmental solver: rain input, flow, erosion, deposition, outflow, and evaporation.

### Rain variation and movement

Rainfall uses a continuous simplex-noise precipitation field. Variation blends between nearly uniform rain and distinct wet/dry storm cells. Movement drifts that field through time.

### Scour

The Erosion Strength control scales terrain change from water depth, velocity, and slope. The Erosion Overlay toggle only controls visual feedback.

### Water

Shows or hides the independent inland water surface. It does not remove water from the simulation.

### Wireframe / W

Switches the terrain material between solid and wireframe rendering. Pressing `W` toggles it unless focus is inside an input, select menu, text area, or editable field.

### Rain

Controls precipitation volume added to the shared water array per second.

Higher values:

- Fill depressions faster
- Create broader flows
- Increase potential sediment transport
- Raise the visible inland water surface more quickly

Range: `0.000–0.080`. Default: `0.014`.

### Rain scale

Controls the spatial frequency of the procedural rainmap.

- Lower values produce broad wet and dry regions.
- Higher values produce smaller, more frequent rain patches.

Range: `0.2–5.0`. Default: `1.5`.

### Flow

Controls the fraction of available water that can move downhill during a solver step.

- Low values create slow, persistent pools.
- High values move water rapidly and may form channels sooner.

Range: `0.05–1.00`. Default: `0.48`.

### Capacity

Scales how much sediment moving water is allowed to carry.

- Low capacity causes earlier deposition.
- High capacity allows water to remove and transport more terrain, producing deeper cuts.

Range: `0.10–4.00`. Default: `1.50`.

### Scour rate

Controls how quickly undersaturated water removes terrain material.

- Low values erode gradually.
- High values cut channels quickly.

The solver also caps erosion per step to reduce numerical instability.

Range: `0.00–1.00`. Default: `0.34`.

### Deposit

Controls how quickly water carrying excess sediment returns material to the terrain.

- Low values keep sediment suspended longer.
- High values build deposits quickly when flow loses capacity.

Range: `0.00–1.00`. Default: `0.20`.

### Evaporate

Controls the fraction of water removed after each solver step.

- Low values allow long-lived pools and streams.
- High values dry the terrain rapidly and shorten flow paths.

Range: `0.000–0.300`. Default: `0.045`.

### Steps per frame

Controls how many hydraulic solver iterations run for each rendered frame.

- Higher values make erosion advance faster.
- Higher values also increase CPU usage.

Range: `1–6`. Default: `2`.

## Recording and timeline

Recording has no fixed duration limit.

While recording:

- A hydraulic snapshot is captured approximately every `0.1` seconds.
- The timeline cursor follows the current recording time.
- Terrain, water, sediment, scour, and deposition arrays are copied into each snapshot.

After recording:

- The timeline spans from zero to the final recorded time.
- Moving the timeline selects the nearest stored snapshot.
- Timeline review changes only the rendered snapshot; the live simulation continues underneath.

Recordings currently exist only in browser memory. They are not exported to a file or saved across page reloads. Because every snapshot contains several full-resolution arrays, memory usage grows with recording length and terrain resolution. “No duration limit” therefore means there is no artificial timer cutoff, not that memory is infinite.

## Rendering

- The simulation terrain uses a dark-red to bright-red height gradient.
- Recently scoured areas receive additional red emphasis.
- Inland water is a separate dark, translucent heightfield.
- Rain is rendered as restrained desaturated particles driven by the precipitation map.
- A large ocean surface surrounds the terrain and uses subtle procedural waves.
- The simulation camera does not auto-rotate. Orbit, zoom, and pan remain manual.

## Current approximation and limitations

This implementation is useful for interactive visual experimentation, but it is not a full fluid-dynamics model.

- Flow uses four grid neighbors, so diagonal flow is indirect.
- Rain particles sample the precipitation field but are not individual hydraulic droplets.
- Inland flow remains a heightfield approximation rather than full CFD.
- Ocean waves are visual and do not feed back into inland erosion.
- Boundary cells drain to an ocean reservoir rather than a full ocean solver.
- Long, high-resolution recordings can consume substantial memory.
- The simulation runs on the CPU and performance depends on Resolution and Steps per frame.

These constraints keep the model responsive enough for a browser-based design tool while preserving the main hydraulic relationships between rain, downhill flow, sediment capacity, erosion, deposition, and evaporation.
