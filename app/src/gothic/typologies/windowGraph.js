/**
 * Compatibility shim — Phase 1 moved the window graph into windowDesign2d.js.
 * Kept so older imports resolve; prefer buildWindowDesign2d.
 */
export {
  DESIGN_LAYERS as SKELETON_COLORS_LIST,
  DESIGN_LAYER_COLORS as SKELETON_COLORS,
  buildWindowDesign2d as buildWindowGraph,
  sampleCurve,
  validateDesign2d,
} from './windowDesign2d.js'
