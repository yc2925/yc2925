/**
 * Procedural terrain height (Lithic Code world).
 * Uses the same noise core as LAB → Noise 2D / Noise 3D (noise/sample.js:
 * sampleNoise = noise type → shaping on simplex fBm) with one layer, so the
 * terrain is controlled by the same parameters. The world adds only two
 * things: metric scale (metres per noise unit) and a flat build plateau
 * around the origin where structures stand.
 */

import { createSimplex2D } from '../../noise/simplex2d.js'
import { sampleNoise } from '../../noise/sample.js'

/** The noise-lab layer fields the terrain uses (and can import from Noise 2D / 3D). */
export const TERRAIN_NOISE_KEYS = ['type', 'typeAmount', 'shaping', 'shapeAmount', 'octaves', 'persistence', 'lacunarity', 'seed']

export function createTerrainHeight(params) {
  const simplex = createSimplex2D(params.seed)
  const layer = {
    type: params.type,
    typeAmount: params.typeAmount,
    shaping: params.shaping,
    shapeAmount: params.shapeAmount,
    octaves: params.octaves,
    persistence: params.persistence,
    lacunarity: params.lacunarity,
    frequency: 1,
  }
  return function terrainHeight(x, z) {
    const r = Math.hypot(x, z)
    const t = Math.min(1, Math.max(0, (r - params.plateau) / (params.plateau * 0.6)))
    const mask = t * t * (3 - 2 * t)
    if (mask === 0 || params.height === 0) return 0
    const n = sampleNoise(x / params.scale, z / params.scale, layer, simplex) // ~[-1, 1]
    return mask * params.height * (0.55 + 0.45 * n) * (0.6 + 0.4 * mask)
  }
}

/** Terrain patch from a Noise 2D / 3D layer (frequency → metric scale). */
export function terrainFromNoiseLayer(layer, current) {
  const patch = {}
  for (const k of TERRAIN_NOISE_KEYS) if (layer[k] !== undefined) patch[k] = layer[k]
  // Lab maps its whole square (−1…1) to the view; one lab unit ≈ 200 m of world.
  if (layer.frequency > 0) patch.scale = Math.round(Math.min(500, Math.max(40, 200 / layer.frequency)) / 5) * 5
  return { ...current, ...patch }
}
