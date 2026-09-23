export const DENSITY_MODES = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'sphere', label: 'Sphere' },
  { id: 'floatingIsland', label: 'Floating Island' },
  { id: 'strata', label: 'Strata' },
]

export const MESHING_METHODS = [
  { id: 'marchingCubes', label: 'Marching Cubes' },
  { id: 'greedy', label: 'Greedy Meshing' },
  { id: 'surfaceNets', label: 'Surface Nets' },
  { id: 'dualContouring', label: 'Dual Contouring' },
]

export const RESOLUTION_PRESETS = [
  { id: '16', label: 'Low · 16³' },
  { id: '32', label: 'Medium · 32³' },
  { id: '48', label: 'High · 48³' },
]

export const CSG_OPERATIONS = [
  { id: 'none', label: 'None' },
  { id: 'union', label: 'Union' },
  { id: 'subtract', label: 'Subtract' },
  { id: 'intersection', label: 'Intersection' },
  { id: 'smoothUnion', label: 'Smooth Union' },
  { id: 'shell', label: 'Shell' },
]

export const CSG_SPHERE_RADIUS = 0.2

export function chunkSizeOptions(resolution) {
  return [8, 12, 16]
    .filter((size) => resolution % size === 0)
    .map((size) => ({ id: String(size), label: `${size}³` }))
}

export function compatibleChunkSize(resolution, chunkSize) {
  return resolution % chunkSize === 0 ? chunkSize : 8
}

export const DEFAULT_VOXEL_TERRAIN = {
  showVoxels: true,
  showMarchingCubes: false,
  meshingMethod: 'marchingCubes',
  densityMode: 'terrain',
  terrainScale: 6,
  terrainHeight: 0.32,
  noiseFrequency: 0.75,
  resolution: 32,
  chunkSize: 8,
  enableCaves: false,
  caveFrequency: 1,
  caveThreshold: 0.58,
  caveStrength: 0.32,
  csgOperation: 'none',
  csgX: 0,
  csgY: 0,
  csgZ: 0,
  blendStrength: 0.08,
  shellThickness: 0.06,
  showCsgWireframe: true,
  showChunkBoundaries: false,
}

export const VOXEL_LIMITS = {
  terrainScale: { min: 3, max: 9, step: 0.25 },
  terrainHeight: { min: 0.05, max: 0.65, step: 0.01 },
  noiseFrequency: { min: 0.2, max: 2.5, step: 0.05 },
  resolution: { min: 16, max: 48, step: 16 },
  caveFrequency: { min: 0.25, max: 3, step: 0.05 },
  caveThreshold: { min: 0.3, max: 0.85, step: 0.01 },
  caveStrength: { min: 0.05, max: 0.5, step: 0.01 },
  csgPosition: { min: -0.45, max: 0.45, step: 0.01 },
  blendStrength: { min: 0.01, max: 0.25, step: 0.01 },
  shellThickness: { min: 0.01, max: 0.2, step: 0.005 },
}
