/**
 * Step 14A.1.x — Foliate ornament (parametric lab + legacy growth).
 */

export {
  FOLIATE_WORKSPACE_ID,
  FOLIATE_WORKSPACE_LABEL,
  BRANCH_ROLES,
  MOTIF_KINDS,
  TERMINATION_REASONS,
  COMPOSITION_MODES,
  DEFAULT_FOLIATE_SETTINGS,
  createGrowthNode,
  createGrowthBranch,
  createOrnamentMotif,
  emptyOrnamentSkeleton,
} from './types.js'

export {
  selectOrnamentInitiationAnchors,
  groupAnchorsIntoMotifHosts,
  ornamentGrowthCacheKey,
  buildOrnamentGrowthSkeleton,
  revealOrnamentSkeleton,
  validateOrnamentSkeleton,
  skeletonMeanCurvature,
} from './skeleton.js'

export {
  COMPOSITION_MODES as PARAMETRIC_COMPOSITION_MODES,
  MOTIF_TYPES,
  HOST_KINDS,
  CURVE_ROLES,
  DEFAULT_PARAMETRIC_MOTIF_SETTINGS,
  discoverOrnamentHosts,
  buildHostFrameFromAnchor,
  buildHostsFromAnchors,
  classifyAnchorHost,
  selectHost,
  selectHostByAnchorId,
  buildGothicVolute,
  buildRibbedSpine,
  buildSecondaryCurl,
  mirrorCurveLocal,
  validateCurveContinuity,
  composeSymmetricalSpandrelScroll,
  buildParametricMotifs,
  parametricMotifCacheKey,
  measureMirrorDeviation,
  measureRootAnchorDistance,
  ROOT_ANCHOR_TOLERANCE,
  emptyParametricMotif,
} from './parametricMotif/index.js'
