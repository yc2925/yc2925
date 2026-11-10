/**
 * Shared assembly constants (no imports from settings — avoids cycles).
 */

export const ASSEMBLY_TYPES = Object.freeze({
  SINGLE_BAY: 'single-bay',
  REPEATED_BAYS: 'repeated-bays',
  FACADE_ELEVATION: 'facade-elevation',
})

export const VARIATION_MODES = Object.freeze({
  UNIFORM: 'uniform',
  SYMMETRIC: 'symmetric',
  CENTER_EMPHASIS: 'center-emphasis',
})

export const SUPPORT_STYLES = Object.freeze({
  SIMPLE: 'simple',
  CLUSTERED_PIER: 'clustered-pier',
  STEPPED_BUTTRESS: 'stepped-buttress',
  COMBINED: 'combined',
})

export const SHAFT_ARRANGEMENTS = Object.freeze({
  SIMPLE: 'simple',
  FOUR_SHAFT: 'four-shaft',
  MULTI_SHAFT: 'multi-shaft',
})

export const WINDOW_LINK_MODES = Object.freeze({
  LINKED_TO_MASTER: 'linked-to-master',
  CUSTOM_OVERRIDE: 'custom-override',
})

export const DEFAULT_ASSEMBLY_PARAMS = Object.freeze({
  assemblyType: ASSEMBLY_TYPES.FACADE_ELEVATION,
  bayCount: 3,
  baySpacing: 0.05,
  bayWidth: 3.0,
  windowScale: 1.0,
  variationMode: VARIATION_MODES.UNIFORM,
  pierWidth: 0.28,
  pierDepth: 0.45,
  buttressProjection: 0.35,
  showStructuralSupports: true,
  /** Mirrored from shared tracery; source of truth is settings.tracery.hierarchicalDepth. */
  hierarchicalDepth: 1,
  stoneDepth: 0.25,
  centerEmphasisScale: 1.18,
  groundElevation: -0.35,
  /** 13E.3.2 — Assembly windows consume Stone / 3D design by default. */
  windowLinkMode: WINDOW_LINK_MODES.LINKED_TO_MASTER,
  // Step 13E.2 / 13E.2.1 structural articulation
  supportStyle: SUPPORT_STYLES.COMBINED,
  shaftArrangement: SHAFT_ARRANGEMENTS.FOUR_SHAFT,
  shaftRadiusRatio: 0.28,
  shaftProjection: 0.55,
  baseHeight: 0.22,
  capitalHeight: 0.14,
  buttressSetbackCount: 3,
  buttressSetbackRatio: 0.72,
  showBases: true,
  showCapitalTransitions: true,
})
