/**
 * Step 12A — Physical scale system public API.
 */

export {
  WORLD_UNIT_METERS,
  meters,
  centimeters,
  millimeters,
  toMeters,
  toCentimeters,
  toMillimeters,
  formatMeters,
  formatMillimeters,
  formatCentimeters,
} from './units.js'

export {
  ARCHITECTURAL_SCALE_PRESETS,
  HUMAN_REFERENCE_HEIGHT,
  ORNAMENT_PHYSICAL,
  AGENT_PHYSICAL,
  PROPORTION_RATIOS,
  DEFAULT_SCALE_SETTINGS,
} from './config.js'

export {
  resolveOrnamentPhysical,
  resolveAgentPhysical,
  resolveArchitecturalEnvelope,
} from './proportions.js'

export { default as ScaleReference, fitCameraToEnvelope } from './ScaleReference.jsx'
