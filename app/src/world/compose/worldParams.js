/**
 * World-level parameters: procedural terrain (noise core shared with
 * LAB → Noise 2D / Noise 3D) and presentation.
 */

import { NOISE_TIPS, NOISE_TYPES, SHAPING_OPS } from '../../noise/settings.js'

// Noise options shared with LAB → Noise 2D / Noise 3D (noise/settings.js).
const TYPE_OPTIONS = [{ id: 'fbm', label: 'Plain fBm' }, ...NOISE_TYPES]
const SHAPING_OPTIONS = SHAPING_OPS

export const DEFAULT_TERRAIN_PARAMS = Object.freeze({
  scale: 160, // m per noise unit (major landform size)
  height: 34, // m peak relief outside the build plateau
  plateau: 115, // m radius of the flat build field around the origin
  type: 'ridged', // noise type (as in Noise 2D / 3D)
  typeAmount: 0.4,
  shaping: 'smooth',
  shapeAmount: 0.5,
  octaves: 5,
  persistence: 0.5, // roughness: gain per octave
  lacunarity: 2,
  seed: 7,
})

export const TERRAIN_PARAM_SPECS = Object.freeze([
  { key: 'type', label: 'Noise type', options: TYPE_OPTIONS, tier: 'essential', help: NOISE_TIPS.type },
  { key: 'typeAmount', label: 'Type amount', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Strength of the noise type (ridge sharpness, terrace steps, billow, roughness, power, warp).' },
  { key: 'shaping', label: 'Shaping', options: SHAPING_OPTIONS, tier: 'essential', help: NOISE_TIPS.shaping },
  { key: 'shapeAmount', label: 'Shaping amount', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Strength of the shaping curve (unused when shaping is None).' },
  { key: 'scale', label: 'Terrain scale', min: 40, max: 500, step: 5, unit: 'm', tier: 'essential', help: 'Horizontal size of hills and valleys — larger = broader landforms (the inverse of Frequency in Noise 2D / 3D).' },
  { key: 'height', label: 'Terrain height', min: 0, max: 120, step: 1, unit: 'm', tier: 'essential', help: 'Vertical relief of the surrounding terrain (0 = flat).' },
  { key: 'octaves', label: 'Octaves', min: 1, max: 8, step: 1, tier: 'essential', help: NOISE_TIPS.octaves },
  { key: 'persistence', label: 'Roughness (persistence)', min: 0.2, max: 0.95, step: 0.01, tier: 'essential', help: NOISE_TIPS.persistence },
  { key: 'lacunarity', label: 'Lacunarity', min: 1.4, max: 3.2, step: 0.05, tier: 'advanced', help: NOISE_TIPS.lacunarity },
  { key: 'plateau', label: 'Build plateau', min: 40, max: 300, step: 5, unit: 'm', tier: 'advanced', help: 'Radius of the flat ground the structures stand on; terrain rises beyond it.' },
  { key: 'seed', label: 'Terrain seed', min: 1, max: 999, step: 1, tier: 'advanced', help: NOISE_TIPS.seed },
])

export const DEFAULT_PRESENTATION = Object.freeze({
  explode: 0, // m of separation between fragments
  exposure: 1.35,
  xrayExposure: 1, // X-ray glow gain: minimal light → blown-out over-exposure
  fog: 0.25, // atmospheric depth fog in the World view (0 = clear)
})

export const PRESENTATION_SPECS = Object.freeze([
  { key: 'explode', label: 'Explode', min: 0, max: 30, step: 0.5, unit: 'm', tier: 'essential', help: 'Pushes fragments (members, tracery motifs, carved pieces, stone courses) apart from the structure centre, suspended in space (REF-026).' },
  { key: 'exposure', label: 'Exposure', min: 0.5, max: 3, step: 0.05, tier: 'essential', help: 'Overall brightness of the 3D view.' },
  { key: 'fog', label: 'Fog', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Depth fog in the World view, normal and X-ray: distant structures and terrain fade into the background (0 = clear, 1 = dense).' },
  { key: 'xrayExposure', label: 'X-ray exposure', min: 0.05, max: 8, step: 0.05, tier: 'essential', help: 'Brightness of the X-ray wire-mesh glow: near-dark minimal light (low) to extreme over-exposure where overlapping mesh burns out to white (high). The normal view uses Exposure.' },
])
