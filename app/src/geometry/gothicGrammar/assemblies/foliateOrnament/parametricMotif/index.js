/**
 * Step 14A.1.2 — Parametric Gothic motif laboratory.
 */

export {
  COMPOSITION_MODES,
  MOTIF_TYPES,
  HOST_KINDS,
  CURVE_ROLES,
  DEFAULT_PARAMETRIC_MOTIF_SETTINGS,
  createCurveMember,
  emptyParametricMotif,
} from './types.js'

export {
  discoverOrnamentHosts,
  buildHostFrameFromPatches,
  buildHostFrameFromAnchor,
  buildHostsFromAnchors,
  classifyAnchorHost,
  hostKindForComponentType,
  selectHost,
  selectHostByAnchorId,
  hostContainsUV,
  localToWorld,
  worldToLocal,
} from './hostFrame.js'

export {
  buildGothicVolute,
  buildRibbedSpine,
  buildSecondaryCurl,
  mirrorCurveLocal,
  validateCurveContinuity,
  polylineLength,
  meanTurn,
} from './primitives.js'

export {
  composeSymmetricalSpandrelScroll,
  buildParametricMotifs,
  parametricMotifCacheKey,
  measureMirrorDeviation,
  measureRootAnchorDistance,
} from './composition.js'

export { ROOT_ANCHOR_TOLERANCE } from './types.js'
