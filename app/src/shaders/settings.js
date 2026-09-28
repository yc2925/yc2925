export const TEST_GEOMETRIES = [
  { id: 'plane', label: 'Plane' },
  { id: 'sphere', label: 'Sphere' },
  { id: 'relief', label: 'Relief' },
  { id: 'vegetal', label: 'Vegetal' },
]

export const SHADER_STRATEGIES = [
  { id: 'baseline', label: '01 — Baseline' },
  { id: 'relief', label: '02 — Relief' },
  { id: 'stone', label: '03 — Stone' },
  { id: 'curvature', label: '04 — Curvature' },
  { id: 'growth', label: '05 — Growth' },
  { id: 'position', label: '06 — Position' },
  { id: 'illumination', label: '07 — Illumination' },
]

export const POSITION_AXES = [
  { id: 'x', label: 'X' },
  { id: 'y', label: 'Y' },
  { id: 'z', label: 'Z' },
]

export const STONE_PRESETS = [
  { id: 'custom', label: 'Custom' },
  { id: 'limestone', label: 'Limestone' },
  { id: 'marble', label: 'Marble' },
  { id: 'sandstone', label: 'Sandstone' },
  { id: 'concrete', label: 'Concrete' },
]

export const STONE_PRESET_VALUES = {
  limestone: {
    baseColor: '#cfc6b0',
    grainScale: 9.5,
    grainStrength: 0.22,
    roughness: 0.74,
    colorVariation: 0.07,
    weathering: 0.28,
  },
  marble: {
    baseColor: '#ece7de',
    grainScale: 3.4,
    grainStrength: 0.42,
    roughness: 0.28,
    colorVariation: 0.16,
    weathering: 0.08,
  },
  sandstone: {
    baseColor: '#c4a06a',
    grainScale: 7.2,
    grainStrength: 0.34,
    roughness: 0.82,
    colorVariation: 0.14,
    weathering: 0.36,
  },
  concrete: {
    baseColor: '#8d8c88',
    grainScale: 6.5,
    grainStrength: 0.26,
    roughness: 0.88,
    colorVariation: 0.05,
    weathering: 0.18,
  },
}

export const SHADER_NOTES = {
  baseline: {
    testing: 'An unmodified standard surface: color, roughness, metalness only.',
    why: 'Comparison plate for vegetal ornament so later shaders are judged against a plain architectural ground, not against each other.',
  },
  relief: {
    testing: 'Raking light, normals, and extrusion depth that exaggerate raised vs recessed form.',
    why: 'Facade carving is read through light and shadow. This asks whether a vine still looks incised when the mesh is unchanged.',
  },
  stone: {
    testing: 'Procedural grain, tint, roughness, and weathering without a photograph.',
    why: 'The same generated ornament can read as limestone, marble, sandstone, or concrete — materiality without new geometry.',
  },
  curvature: {
    testing: 'Screen-space normal derivatives as a stand-in for ridges and cavities.',
    why: 'Dense vegetal relief collapses at a distance. Curvature bias keeps stems and hollows parseable.',
  },
  growth: {
    testing: 'A 0–1 growth attribute revealed by a traveling front, not a global fade.',
    why: 'The project is computational growth. This makes PROCESS visible on religious-facade ornament, not only the finished mesh.',
  },
  position: {
    testing: 'World-space axis or distance-to-anchor coloring.',
    why: 'Ornament near a portal should not behave like ornament at the roof. Hierarchy is architectural, not only botanical.',
  },
  illumination: {
    testing: 'Directional light, rim, falloff, and glow as presentation, not as physically based sun.',
    why: 'Dramatic architectural lighting changes how carved plants are perceived. The study is illumination convention, not a sacred effect.',
  },
}

const BASELINE = {
  baseColor: '#c8c2b6',
  roughness: 0.62,
  metalness: 0.04,
}

const RELIEF = {
  reliefContrast: 0.72,
  depthIntensity: 0.68,
  lightX: 0.65,
  lightY: 0.42,
  lightZ: 0.38,
  shadowEmphasis: 0.7,
}

const STONE = {
  preset: 'limestone',
  ...STONE_PRESET_VALUES.limestone,
}

const CURVATURE = {
  edgeIntensity: 0.7,
  cavityIntensity: 0.82,
  curvatureScale: 1.4,
  contrast: 0.65,
}

const GROWTH = {
  progress: 0.42,
  edgeWidth: 0.08,
  contrast: 0.85,
  growthColor: '#d4c48a',
  dormantColor: '#3a3834',
  autoGrow: false,
  speed: 0.18,
}

const POSITION = {
  axis: 'y',
  gradientScale: 0.45,
  gradientContrast: 0.7,
  gradientOffset: 0.5,
  colorA: '#2a241c',
  colorB: '#d8c9a6',
  anchorMode: false,
  anchorX: 0,
  anchorY: -0.4,
  anchorZ: 0.2,
}

const ILLUMINATION = {
  lightX: -0.35,
  lightY: 0.55,
  lightZ: 0.75,
  lightIntensity: 1.15,
  rimIntensity: 1.35,
  rimWidth: 2.4,
  falloff: 1.6,
  lightColor: '#f2d9a8',
  surfaceColor: '#5c5348',
}

export const DEFAULT_SHADER_LAB = {
  geometry: 'vegetal',
  strategy: 'growth',
  rotateModel: false,
  compare: false,
  baseline: { ...BASELINE },
  relief: { ...RELIEF },
  stone: { ...STONE },
  curvature: { ...CURVATURE },
  growth: { ...GROWTH },
  position: { ...POSITION },
  illumination: { ...ILLUMINATION },
}

export function resetShaderParams(settings) {
  const id = settings.strategy
  if (id === 'baseline') return { ...settings, baseline: { ...BASELINE } }
  if (id === 'relief') return { ...settings, relief: { ...RELIEF } }
  if (id === 'stone') return { ...settings, stone: { ...STONE } }
  if (id === 'curvature') return { ...settings, curvature: { ...CURVATURE } }
  if (id === 'growth') return { ...settings, growth: { ...GROWTH } }
  if (id === 'position') return { ...settings, position: { ...POSITION } }
  if (id === 'illumination') return { ...settings, illumination: { ...ILLUMINATION } }
  return settings
}

export function applyStonePreset(stone, presetId) {
  const preset = STONE_PRESET_VALUES[presetId]
  if (!preset) return { ...stone, preset: 'custom' }
  return { ...stone, preset: presetId, ...preset }
}
