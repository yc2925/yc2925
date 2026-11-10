/**
 * Rayonnant Skeleton-first construction (Step 13D.5–13D.9).
 */

export {
  buildSkeletonGraph,
  validateSkeletonGraph,
  DEFAULT_SKELETON_PARAMS,
  SKELETON_WIDTH_DEFAULTS,
  sampleSkeletonPath,
} from './skeletonGraph.js'

export {
  buildOculusNetworkGraph,
  validateOculusNetworkGraph,
  DEFAULT_OCULUS_NETWORK_PARAMS,
  OCULUS_SUBDIVISION,
  solveSkeletonOculus,
  resolveOculusApexClearance,
  buildConnectorPath,
  arcThroughThreePoints,
} from './skeletonOculus.js'

export {
  buildSecondaryTraceryGraph,
  validateSecondaryTraceryGraph,
  DEFAULT_SECONDARY_TRACERY_PARAMS,
  SECONDARY_TRACERY_LEVEL,
  rayHitParentArch,
} from './skeletonSecondary.js'

export {
  buildHierarchicalTraceryGraph,
  validateHierarchicalTraceryGraph,
  DEFAULT_HIERARCHICAL_PARAMS,
  HIERARCHICAL_DEPTH,
  canSubdivideField,
} from './skeletonHierarchical.js'

export {
  CELL_KINDS,
  SUBDIVISION_RULES,
  createArchitecturalCell,
} from './architecturalCell.js'

export {
  buildSkeletonSolidVoid,
  unionSkeletonStrips,
  multipolygonToExtrusionRegions,
  skeletonHoleKeys,
} from './skeletonStone.js'
