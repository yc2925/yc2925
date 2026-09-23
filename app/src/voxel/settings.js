export const DENSITY_MODES = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'sphere', label: 'Sphere' },
  { id: 'floatingIsland', label: 'Floating Island' },
  { id: 'strata', label: 'Strata' },
]

export const DEFAULT_VOXEL_TERRAIN = {
  densityMode: 'terrain',
  terrainScale: 6,
  terrainHeight: 0.32,
  noiseFrequency: 0.75,
  resolution: 24,
  enableCaves: false,
  caveFrequency: 1,
  caveThreshold: 0.58,
  caveStrength: 0.32,
}

export const VOXEL_LIMITS = {
  terrainScale: { min: 3, max: 9, step: 0.25 },
  terrainHeight: { min: 0.05, max: 0.65, step: 0.01 },
  noiseFrequency: { min: 0.2, max: 2.5, step: 0.05 },
  resolution: { min: 8, max: 32, step: 2 },
  caveFrequency: { min: 0.25, max: 3, step: 0.05 },
  caveThreshold: { min: 0.3, max: 0.85, step: 0.01 },
  caveStrength: { min: 0.05, max: 0.5, step: 0.01 },
}
