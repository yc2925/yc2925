export const GROWTH_STUDIES = [
  { id: 'distribution', index: '01', label: 'Distribution', ready: true },
  { id: 'paths', index: '02', label: 'Paths', ready: true },
  { id: 'field', index: '03', label: 'Field', ready: true },
]

export const DISTRIBUTION_MODES = [
  { id: 'random', label: 'Random' },
  { id: 'noise', label: 'Noise' },
  { id: 'architectural', label: 'Architectural Data' },
]

export const MODE_NOTES = {
  random: 'Baseline. Every surface point is equally likely. No reading of the architecture.',
  noise: 'Clustered patches from an fBm field. Organic, but blind to the architecture.',
  architectural:
    'Suitability from height, nearness to arches, ribs, ledges and the recess, and surface orientation.',
}

export const DEFAULT_DISTRIBUTION = {
  study: 'distribution',
  mode: 'architectural',
  seed: 7,
  candidateCount: 6000,
  density: 0.35,
  noiseScale: 1.2,
  noiseThreshold: 0.5,
  heightBias: 0.3,
  featureAttraction: 0.8,
  orientationBias: 0.5,
  showCandidates: false,
  showSuitability: true,
  showAccepted: true,
}

export const DEFAULT_PATHS = {
  pathCount: 10,
  pathLength: 3,
  verticalGrowth: 0.6,
  pathFeature: 0.7,
  organicDrift: 0.35,
  curvature: 0.35,
  branchProbability: 0.5,
  surfaceOffset: 0.01,
  reliefWidth: 0.07,
  showAnchors: true,
  showSourceCurve: false,
  showPaths: true,
  showRelief: false,
}

export const PATH_NOTE =
  'Paths start at PRIMARY anchors and walk the surface: vertical growth, attraction to arches, ribs and ledges, and low-frequency drift. Each step snaps back to the closest surface point.'

export const DEFAULT_FIELD = {
  particleCount: 2500,
  particleSpeed: 0.6,
  trailLength: 48,
  upwardForce: 0.6,
  surfaceFollow: 0.8,
  fieldFeature: 0.7,
  curlStrength: 0.4,
  fieldScale: 0.8,
  paused: false,
  resetKey: 0,
  showParticles: true,
  showTrails: true,
  showVectorField: false,
  showSplines: false,
}

/** Architecture + anchors + a few splines + trails. No debugging layers. */
export const COMBINED_PRESET = {
  study: 'field',
  showAnchors: true,
  showSplines: true,
  pathCount: 6,
  showParticles: false,
  showTrails: true,
  showVectorField: false,
  showSourceCurve: false,
  showRelief: false,
}

export const FIELD_NOTE =
  'Tracers leave PRIMARY and SECONDARY anchors and follow four forces: upward tropism, surface follow, attraction to arches, ribs and ledges, and restrained curl noise. Spline = designed path. Trail = emergent path.'

export const PATH_COLORS = {
  primary: [0.86, 0.84, 0.8],
  secondary: [0.56, 0.55, 0.52],
  study: [0.91, 0.91, 0.91],
}

export const ANCHOR_STYLE = {
  primary: { color: '#ff2020', label: 'Primary', note: 'Major structural growth' },
  secondary: { color: '#e8e8e8', label: 'Secondary', note: 'Smaller branching' },
  terminal: { color: '#8a8a8a', label: 'Terminal', note: 'Fine detail' },
}
