/**
 * Step 12A — Architectural / ornament / agent physical scale reference.
 * All lengths are world units (= meters). Small ornament dims documented in mm.
 */

import { meters, millimeters } from './units.js'

/** Typology reference envelopes (design assumptions). */
export const ARCHITECTURAL_SCALE_PRESETS = {
  window: {
    id: 'window',
    label: 'Tracery Window',
    height: meters(5.7),
    width: meters(3.0),
    note: 'Matches existing W=3.0 × aspect≈1.9 layout (H≈5.7).',
  },
  portal: {
    id: 'portal',
    label: 'Gothic Portal',
    height: meters(5.2),
    width: meters(4.2),
    note: 'Future scale preset; portal already uses overallHeight/Width.',
  },
  facade: {
    id: 'facade',
    label: 'Cathedral Façade',
    height: meters(8.5),
    width: meters(9.5),
    note: 'Future scale preset; façade already uses overallHeight/Width.',
  },
}

/** Default human silhouette height for scale reference. */
export const HUMAN_REFERENCE_HEIGHT = meters(1.7)

/** Ornament physical ranges (world units). */
export const ORNAMENT_PHYSICAL = {
  primaryThickness: { min: millimeters(15), max: millimeters(60), default: millimeters(32) },
  secondaryThickness: { min: millimeters(8), max: millimeters(30), default: millimeters(18) },
  reliefDepth: { min: millimeters(5), max: millimeters(40), default: millimeters(16) },
  rootEmbedding: { min: millimeters(4), max: millimeters(30), default: millimeters(14) },
  reliefProjection: { min: millimeters(4), max: millimeters(40), default: millimeters(18) },
  foliateDetail: { min: millimeters(20), max: millimeters(150), default: millimeters(55) },
  minBranchLength: { min: millimeters(40), max: millimeters(200), default: millimeters(85) },
  maxBranchLength: { min: meters(0.4), max: meters(3.5), default: meters(1.6) },
}

/** Agent / stigmergy physical defaults (world units = meters). */
export const AGENT_PHYSICAL = {
  movementSpeed: meters(0.55), // m/s along graph arc length
  sensingRadius: meters(0.28),
  depositionRadius: meters(0.18),
  minTrailSpacing: meters(0.1),
  minPathLength: meters(0.085),
  sampleSpacing: meters(0.09),
  minAnchorSpacing: meters(0.12),
}

/**
 * Dimensionless ratios: ornament vs supporting architecture.
 * Independent of absolute scale — keep proportions when dims change.
 */
export const PROPORTION_RATIOS = {
  /** Primary stem ≤ this × mullion / profile thickness */
  primaryToMullion: 0.72,
  /** Secondary stem ≤ this × primary */
  secondaryToPrimary: 0.62,
  /** Relief depth ≤ this × architecturalDepth */
  reliefToArchDepth: 0.35,
  /** Root embed ≤ this × architecturalDepth */
  embedToArchDepth: 0.28,
  /** Max branch length ≤ this × architectural height */
  branchToArchHeight: 0.32,
  /** Foliate detail ≤ this × primary thickness (world) mapped via knob */
  foliateToPrimary: 4.5,
  /** Agent sensing ≤ this × architectural width */
  sensingToArchWidth: 0.22,
}

/** Default UI / settings keys for physical scale (shared across tabs). */
export const DEFAULT_SCALE_SETTINGS = {
  worldUnitMeters: 1,
  architecturalScale: 1,
  overallHeight: meters(5.7),
  overallWidth: meters(3.0),
  showScaleReference: false,
  showDimensions: false,
  showHumanReference: false,
  fitToObjectToken: 0,
}
