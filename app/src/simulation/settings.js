export const EROSION_LIMITS = {
  rain: { min: 0, max: 0.08, step: 0.001 },
  rainScale: { min: 0.2, max: 6, step: 0.1 },
  flow: { min: 0.05, max: 1, step: 0.01 },
  capacity: { min: 0.1, max: 4, step: 0.05 },
  scour: { min: 0, max: 1, step: 0.01 },
  deposition: { min: 0, max: 1, step: 0.01 },
  evaporation: { min: 0, max: 0.3, step: 0.005 },
  iterations: { min: 1, max: 6, step: 1 },
}

export const DEFAULT_EROSION = {
  running: true,
  rainmap: true,
  showScour: true,
  showWater: true,
  wireframe: false,
  rain: 0.018,
  rainScale: 2.2,
  flow: 0.48,
  capacity: 1.5,
  scour: 0.34,
  deposition: 0.2,
  evaporation: 0.045,
  iterations: 2,
}

export const EROSION_TIPS = {
  running: 'Runs or pauses hydraulic erosion. Recording does not control simulation playback.',
  rainmap: 'Modulates rainfall across the terrain instead of applying uniform rain.',
  water: 'Shows accumulated surface water as a pale overlay.',
  scourView: 'Highlights recently eroded channels in the terrain color.',
  rain: 'Water added each simulation step. Higher rainfall creates faster, broader flow.',
  rainScale: 'Size of rainfall patches. Higher values create smaller, denser rain cells.',
  flow: 'Fraction of water moved downhill per step.',
  capacity: 'Maximum sediment water can carry. Higher values cut deeper channels.',
  scour: 'Rate at which undersaturated water removes terrain.',
  deposition: 'Rate at which excess sediment is deposited back onto terrain.',
  evaporation: 'Water removed after every step. Higher values dry channels faster.',
  iterations: 'Hydraulic solver steps per rendered frame. Higher is faster but more expensive.',
  wireframe: 'Shows the terrain mesh topology. Toggle with the W key.',
}
