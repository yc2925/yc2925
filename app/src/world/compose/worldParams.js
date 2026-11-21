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
  // Ground surface shader (REF-033): no effect on height.
  groundPalette: 'pale', // 'pale' stone greys · 'dark' black and greys, minimal white
  rubble: 0.6,
  dust: 0.35,
  relief: 0.6,
  surfaceScale: 1.5,
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

/** Ground surface shader controls (REF-033) — colour and relief only, never the height. */
export const TERRAIN_SURFACE_SPECS = Object.freeze([
  { key: 'groundPalette', label: 'Ground palette', options: [{ id: 'pale', label: 'Pale stone' }, { id: 'dark', label: 'Dark (black & greys)' }], tier: 'essential', help: 'Colour palette of the ground: pale stone greys with light dust, or a dark palette of near-black earth and rock, mid greys and only a little pale dust.' },
  { key: 'rubble', label: 'Rubble & rock', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Dark bumped rock on steep ground and in outcrops, plus scattered pebbles (REF-033).' },
  { key: 'dust', label: 'Dust cover', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Pale dust settling on flat ground in patches (REF-033 dust floor; reads as snow under the overcast sky).' },
  { key: 'relief', label: 'Surface relief', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Strength of the bump relief of rocks, crusts and pebbles (shading only).' },
  { key: 'surfaceScale', label: 'Surface detail size', min: 0.3, max: 6, step: 0.1, unit: 'm', tier: 'advanced', help: 'Size of rock grain, pebbles and crust features.' },
])

/** World environment controls (REF-032 ↔ REF-033). */
export const ENVIRONMENT_SPECS = Object.freeze([
  { key: 'skyTone', label: 'Sky tone', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Environment and lighting: 0 = dark studio gradient with a strong overhead key (REF-033), 1 = white overcast fog with soft shadowless sky light (REF-032). The fog, the ground fade and the sky horizon always share one colour.' },
])

export const DEFAULT_PRESENTATION = Object.freeze({
  explode: 0, // m of separation between fragments
  exposure: 1.35,
  xrayExposure: 1, // X-ray glow of the main subjects: minimal light → blown-out over-exposure
  xrayBackground: 0.75, // X-ray level of everything that is not a main subject
  xrayTerrain: 1.5, // X-ray terrain glow + grid level
  xraySubjects: 0.6, // prominence threshold for X-ray main subjects (1 = only the most prominent)
  fog: 0.25, // atmospheric depth fog in the World view (0 = clear)
  skyTone: 0.85, // 0 dark studio (REF-033) · 1 white overcast fog (REF-032)
  terrainGrid: true, // wire grid on the terrain (World view + X-ray)
  // Point Cloud view (REF-031): photogrammetry survey of the built world.
  pointDensity: 45, // points per m² of stone surface
  pointSize: 1,
  colorFidelity: 0.3, // 0 scan grey · 1 true stone palette
  scanNoise: 0.35, // depth noise + floating stray points
  coverage: 0.45, // thinning toward the top + noise holes
  scanRadius: 60, // m, ground scan patch
  groundDensity: 10, // points per m² of ground
  lichen: 0, // opt-in ground lichen (VISUAL_DIRECTION negative: off by default)
  stations: 7, // survey stations (photo frames + labels)
  thumbSize: 84, // px, photo frame height
  markers: 0.5, // red survey paint at station targets
  surveySeed: 3,
})

/** Point Cloud view controls (REF-031). */
export const SCAN_SPECS = Object.freeze([
  { key: 'pointDensity', label: 'Point density', min: 5, max: 150, step: 1, unit: 'pts/m²', tier: 'essential', help: 'Points sampled per square metre of stone surface (area-weighted on every stone).' },
  { key: 'pointSize', label: 'Point size', min: 0.3, max: 3, step: 0.05, tier: 'essential', help: 'Size of each point relative to the sample spacing (perspective-scaled, at least one pixel).' },
  { key: 'colorFidelity', label: 'Colour fidelity', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Scan grey (0) to the true limestone / sandstone palette (1). Daylight shading stays baked into each point.' },
  { key: 'scanNoise', label: 'Scan noise', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Depth jitter along the surface normal plus stray floater points that form a faint halo.' },
  { key: 'coverage', label: 'Coverage falloff', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'How much the scan thins toward the top of the structures and breaks into noise holes.' },
  { key: 'scanRadius', label: 'Ground scan radius', min: 20, max: 300, step: 5, unit: 'm', tier: 'essential', help: 'Radius of the scanned ground patch around the structures; beyond it the points dissolve into sparse dust.' },
  { key: 'groundDensity', label: 'Ground density', min: 1, max: 40, step: 0.5, unit: 'pts/m²', tier: 'advanced', help: 'Ground points per square metre inside the scan patch.' },
  { key: 'lichen', label: 'Ground lichen', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Green lichen patches on the ground that gather at the structure bases (REF-031 moss). Off by default.' },
  { key: 'stations', label: 'Survey stations', min: 0, max: 12, step: 1, tier: 'essential', help: 'Capture stations around the structures: a photograph rendered from each position, linked by the survey traverse, with id / time / date / coordinates.' },
  { key: 'markers', label: 'Survey paint', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Red survey paint sprayed on the stones each station aims at (size and strength).' },
  { key: 'thumbSize', label: 'Photo size', min: 40, max: 180, step: 2, unit: 'px', tier: 'advanced', help: 'On-screen height of the station photographs.' },
  { key: 'surveySeed', label: 'Survey seed', min: 1, max: 999, step: 1, tier: 'advanced', help: 'Re-draws the station positions, targets and capture times.' },
])

export const PRESENTATION_SPECS = Object.freeze([
  { key: 'explode', label: 'Explode', min: 0, max: 30, step: 0.5, unit: 'm', tier: 'essential', help: 'Pushes fragments (members, tracery motifs, carved pieces, stone courses) apart from the structure centre, suspended in space (REF-026).' },
  { key: 'exposure', label: 'Exposure', min: 0.5, max: 3, step: 0.05, tier: 'essential', help: 'Overall brightness of the 3D view.' },
  { key: 'fog', label: 'Fog', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Depth fog in the World view, normal and X-ray: distant structures and terrain fade into the background (0 = clear, 1 = dense).' },
  { key: 'xrayExposure', label: 'X-ray subject exposure', min: 0.05, max: 8, step: 0.05, tier: 'essential', help: 'X-ray glow of the main subjects only — the most prominent architecture curves (see Subject threshold) — from near-dark (low) to burnt-out white (high). Everything else keeps the X-ray background level.' },
  { key: 'xraySubjects', label: 'X-ray subject threshold', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Which structures count as main subjects. Prominence = 0.5 height + 0.3 plan extent + 0.2 tracery / carving, relative to the most prominent structure; structures at or above the threshold are highlighted (0 = all, 1 = only the most prominent).' },
  { key: 'xrayBackground', label: 'X-ray background level', min: 0.1, max: 1.5, step: 0.05, tier: 'essential', help: 'X-ray glow of everything that is not a main subject — the less prominent structures, plinths and footings (the terrain has its own X-ray terrain level). They stay visible, just darker than the subjects (1 = the normal X-ray look).' },
  { key: 'xrayTerrain', label: 'X-ray terrain', min: 0, max: 4, step: 0.05, tier: 'essential', help: 'Brightness of the terrain in X-ray: a glowing surface whose slopes catch the light (fresnel relief), with a 10 m grid and a brighter 50 m grid. The Grid toggle hides only the grid lines.' },
])
