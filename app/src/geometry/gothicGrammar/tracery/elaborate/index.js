/**
 * Rayonnant Elaborate grammar (Step 13D.4).
 */

export { ELABORATE_ZONES, porosityMetrics } from './architecturalConstraints.js'
export { buildHierarchicalLancets, subdivideArchField } from './hierarchicalLancets.js'
export { buildOculusComposition } from './oculusComposition.js'
export { buildCurvedSpandrels } from './curvedSpandrels.js'
export {
  solveOpeningArrangement,
  DEFAULT_ELABORATE_PARAMS,
} from './openingArrangement.js'
export {
  buildElaborateSolidVoid,
  resolveElaborateWidths,
  elaborateHoleKeys,
  ELABORATE_MEMBER_RATIOS,
} from './elaborateSolidVoid.js'
