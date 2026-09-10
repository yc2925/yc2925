export const NOISE_TYPES = [
  { id: 'ridged', label: 'Ridged' },
  { id: 'terracing', label: 'Terracing' },
  { id: 'billow', label: 'Billow' },
  { id: 'turbulence', label: 'Turbulence' },
  { id: 'power', label: 'Power curve' },
  { id: 'warp', label: 'Domain warping' },
]

export const SHAPING_OPS = [
  { id: 'none', label: 'None' },
  { id: 'gain', label: 'Gain' },
  { id: 'bias', label: 'Bias' },
  { id: 'contrast', label: 'Contrast' },
  { id: 'smooth', label: 'Smoothstep' },
  { id: 'invert', label: 'Invert' },
  { id: 'gamma', label: 'Gamma' },
]

export const NOISE_LIMITS = {
  resolution: { min: 32, max: 192, step: 8 },
  frequency: { min: 0.4, max: 8, step: 0.05 },
  octaves: { min: 1, max: 8, step: 1 },
  persistence: { min: 0.2, max: 0.95, step: 0.01 },
  lacunarity: { min: 1.4, max: 3.2, step: 0.05 },
  seed: { min: 1, max: 200, step: 1 },
  typeAmount: { min: 0, max: 1, step: 0.01 },
  shapeAmount: { min: 0, max: 1, step: 0.01 },
  amplitude: { min: 0.05, max: 2.4, step: 0.01 },
  blend: { min: 0, max: 1, step: 0.01 },
}

function defaultLayer(overrides = {}) {
  return {
    enabled: true,
    blend: 1,
    type: 'ridged',
    shaping: 'none',
    frequency: 1.8,
    octaves: 5,
    persistence: 0.5,
    lacunarity: 2,
    seed: 17,
    typeAmount: 0.55,
    shapeAmount: 0.5,
    ...overrides,
  }
}

export const DEFAULT_NOISE = {
  resolution: 96,
  amplitude: 0.85,
  activeLayer: 0,
  layers: [
    defaultLayer({ enabled: true, blend: 1, type: 'ridged', seed: 17 }),
    defaultLayer({
      enabled: false,
      blend: 0.45,
      type: 'billow',
      frequency: 3.2,
      octaves: 4,
      seed: 64,
      typeAmount: 0.7,
    }),
    defaultLayer({
      enabled: false,
      blend: 0.35,
      type: 'warp',
      frequency: 1.2,
      seed: 121,
      typeAmount: 0.4,
    }),
  ],
}

export function patchLayer(noise, index, patch) {
  return {
    ...noise,
    layers: noise.layers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer)),
  }
}

export function heightmapKey(noise) {
  return JSON.stringify({
    resolution: noise.resolution,
    layers: noise.layers,
  })
}

export function typeAmountLabel(type) {
  switch (type) {
    case 'ridged':
      return 'Ridge'
    case 'terracing':
      return 'Steps'
    case 'billow':
      return 'Billow'
    case 'turbulence':
      return 'Rough'
    case 'power':
      return 'Power'
    case 'warp':
      return 'Warp'
    default:
      return 'Amount'
  }
}

export function formatTypeAmount(type, amount) {
  if (type === 'terracing') return String(Math.round(2 + amount * 14))
  if (type === 'power') return (0.3 + amount * 3.7).toFixed(2)
  return `${Math.round(amount * 100)}%`
}

export function shapingAmountLabel(shaping) {
  switch (shaping) {
    case 'gain':
      return 'K'
    case 'bias':
      return 'Bias'
    case 'contrast':
      return 'Contrast'
    case 'smooth':
      return 'Mix'
    case 'invert':
      return 'Mix'
    case 'gamma':
      return 'Gamma'
    default:
      return 'Amount'
  }
}

export function typeAmountTip(type) {
  switch (type) {
    case 'ridged':
      return 'Sharpness of the ridges. Higher carves tighter peaks from inverted absolute noise.'
    case 'terracing':
      return 'Number of height steps. Higher flattens the field into more terraces.'
    case 'billow':
      return 'Mix toward absolute noise. Higher makes rounder, cloud-like mounds.'
    case 'turbulence':
      return 'Mix toward fractal absolute noise. Higher looks rougher and more chaotic.'
    case 'power':
      return 'Exponent on the height curve. Higher crushes lows and exaggerates peaks.'
    case 'warp':
      return 'How far sample coordinates are bent by a second noise field. Higher swirls the pattern.'
    default:
      return 'Strength of the selected noise type.'
  }
}

export function shapingAmountTip(shaping) {
  switch (shaping) {
    case 'gain':
      return 'S-curve contrast. Higher pushes values toward black and white.'
    case 'bias':
      return 'Shifts the whole field up or down around mid-gray.'
    case 'contrast':
      return 'Expands values around mid-gray. Higher makes features punchier.'
    case 'smooth':
      return 'Mixes in a smoothstep curve. Higher softens hard transitions.'
    case 'invert':
      return 'Mixes toward a flipped field. 100% is a full invert.'
    case 'gamma':
      return 'Power on the 0–1 field. Higher darkens midtones and opens highlights.'
    default:
      return 'Unused while shaping is set to none.'
  }
}

export const NOISE_TIPS = {
  type: 'Noise formula. Ridged makes sharp crests, billow makes clouds, warp bends the domain.',
  shaping: 'Curve applied after the noise type. Use the slider below to set its strength.',
  resolution: 'Grid density of the 2D map and 3D mesh. Higher is sharper and slower.',
  frequency: 'Spatial scale. Higher packs more features into the same area.',
  octaves: 'Number of stacked noise layers. More octaves add finer detail.',
  persistence: 'How loud each extra octave stays. Higher keeps fine detail stronger.',
  lacunarity: 'Frequency jump per octave. Higher spreads detail bands farther apart.',
  seed: 'Random offset of the pattern. The same seed repeats the same field.',
  amplitude: 'Vertical scale of the 3D grid. Does not change the 2D map.',
  layer: 'Which layer you are editing. Enable 2 and 3 to blend extra noise into the field.',
  enable: 'Include this layer in the blended heightmap. Off layers are skipped.',
  blend: 'Weight of this layer when mixing with the others. 0 is silent; 1 is full.',
}
