/**
 * Step 12B — Shared LOD configuration.
 * LOD affects rendering tessellation only — never topology, agents, or stigmergy simulation.
 */

export const LOD_LEVELS = ['high', 'medium', 'low']

export const LOD_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/**
 * Screen-space projected height as a fraction of viewport height.
 * LARGE → high, MEDIUM → medium, SMALL → low.
 */
export const LOD_SCREEN_THRESHOLDS = {
  /** projectedFrac >= this → HIGH */
  highMin: 0.42,
  /** projectedFrac >= this → MEDIUM (else LOW) */
  mediumMin: 0.18,
}

/** Hysteresis band as fraction of viewport (must cross further to switch). */
export const LOD_HYSTERESIS = 0.06

/** Bias shifts thresholds: positive → prefer higher detail. Range typically -1..1. */
export const DEFAULT_LOD_BIAS = 0

/**
 * Gothic stone tessellation multipliers applied to design-time detailResolution / mold layers.
 * Physical sizes (thickness, depth) stay from scale system.
 */
export const GOTHIC_LOD_SPEC = {
  high: {
    detailResolutionScale: 1,
    moldingComplexityDelta: 0,
    profileSimplify: 1,
  },
  medium: {
    detailResolutionScale: 0.5,
    moldingComplexityDelta: -1,
    profileSimplify: 0.85,
  },
  low: {
    detailResolutionScale: 0.18,
    moldingComplexityDelta: -2,
    profileSimplify: 0.65,
  },
}

/**
 * Ornament sweep tessellation (same network / hierarchy).
 */
export const ORNAMENT_LOD_SPEC = {
  high: {
    radialResolution: 12,
    curveResolution: 0.7,
    tipCurlScale: 1,
    flutingScale: 1,
    maxGeneration: Infinity,
    minBranchLength: 0,
  },
  medium: {
    radialResolution: 8,
    curveResolution: 0.4,
    tipCurlScale: 0.65,
    flutingScale: 0.55,
    maxGeneration: Infinity,
    minBranchLength: 0.04,
  },
  low: {
    radialResolution: 5,
    curveResolution: 0.22,
    tipCurlScale: 0.25,
    flutingScale: 0.2,
    maxGeneration: 1,
    minBranchLength: 0.1,
  },
}

/**
 * Agent / field visualization only (simulation unchanged).
 */
export const AGENT_VIZ_LOD_SPEC = {
  high: {
    trailWindow: 40,
    trailStride: 1,
    fieldStride: 1,
    showDirections: true,
    markerScale: 1,
  },
  medium: {
    trailWindow: 24,
    trailStride: 2,
    fieldStride: 2,
    showDirections: true,
    markerScale: 0.85,
  },
  low: {
    trailWindow: 12,
    trailStride: 3,
    fieldStride: 4,
    showDirections: false,
    markerScale: 0.65,
  },
}

export const DEFAULT_LOD_SETTINGS = {
  enableAutoLod: true,
  lodMode: 'auto', // auto | high | medium | low
  lodBias: 0,
  showLodDebug: false,
}

export function normalizeLodLevel(id) {
  if (id === 'high' || id === 'medium' || id === 'low') return id
  return 'high'
}
