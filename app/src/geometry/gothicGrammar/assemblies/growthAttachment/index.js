/**
 * Step 13E.4 — Growth-ready surface attachment & architectural navigation.
 * Public API for attachment, distribution, navigation, queries, persistence.
 */

export {
  ANCHOR_STATUS,
  ATTACHMENT_METHODS,
  SEED_DISTRIBUTION_MODES,
  NAV_TRANSITION_TYPES,
  ANCHOR_SCOPES,
  GROWTH_ATTACHMENT_TYPE,
  DEFAULT_GROWTH_ATTACHMENT_SETTINGS,
  createGrowthAnchor,
  emptyGrowthAttachmentState,
  normalize3,
  cross3,
  dot3,
  dist3,
  mulberry32,
} from './types.js'

export {
  preferredTangentHint,
  buildSurfaceFrame,
  validateSurfaceFrame,
} from './frames.js'

export {
  nextAnchorId,
  resetAnchorIdCounter,
  isPatchPlaceable,
  createAnchorOnPatch,
  attachFromWorldHit,
  findNearestPatch,
  isNearProtectedOpening,
  listAnchorsByStatus,
} from './anchors.js'

export {
  patchSampleWeight,
  distributeGrowthSeeds,
} from './sampling.js'

export {
  buildGrowthNavigationGraph,
  segmentCrossesProtectedOpening,
} from './navigationGraph.js'

export {
  findSurfacePath,
  projectPathOntoSurfaces,
  straightLinePathPreview,
} from './pathQuery.js'

export {
  getSurfaceFrame,
  projectToEligibleSurface,
  findNearestValidAnchor,
  isInsideProtectedOpening,
  checkGrowthClearance,
} from './queries.js'

export {
  rebindGrowthAnchors,
  instantiateMasterAnchors,
  stableSemanticKey,
  stableGeometrySignature,
} from './persistence.js'

import {
  emptyGrowthAttachmentState,
  DEFAULT_GROWTH_ATTACHMENT_SETTINGS,
} from './types.js'
import { rebindGrowthAnchors } from './persistence.js'
import { buildGrowthNavigationGraph } from './navigationGraph.js'

/**
 * Build a full attachment runtime package for a semantics model.
 */
export function buildGrowthAttachmentContext(semantics, settings = {}, previousState = null) {
  const cfg = { ...DEFAULT_GROWTH_ATTACHMENT_SETTINGS, ...settings }
  let state
  if (previousState?.anchors?.length) {
    state = rebindGrowthAnchors(previousState, semantics, {
      bayCountChanged:
        previousState.bayCount != null && settings.bayCount != null
          ? previousState.bayCount !== settings.bayCount
          : false,
    })
  } else {
    state = emptyGrowthAttachmentState(semantics?.geometryVersion ?? '')
  }

  const graph = buildGrowthNavigationGraph(semantics, {
    navigationGapTolerance: cfg.growthNavigationGapTolerance,
    allowRestricted: cfg.growthAllowRestricted,
  })

  return {
    semantics,
    settings: cfg,
    state: {
      ...state,
      navigationGraph: graph,
      bayCount: settings.bayCount ?? previousState?.bayCount ?? null,
      geometrySignature: semantics?.geometryVersion ?? '',
    },
    graph,
  }
}
