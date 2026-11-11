/**
 * Step 14A.1.x — Foliate ornament types & defaults.
 * Construction preview — not final stone, not vegetation.
 */

import { mulberry32, normalize3, add3, scale3, sub3, cross3, dot3, dist3 } from '../growthAttachment/types.js'
import {
  COMPOSITION_MODES,
  DEFAULT_PARAMETRIC_MOTIF_SETTINGS,
} from './parametricMotif/types.js'

export const FOLIATE_WORKSPACE_ID = 'vegetation-growth' // saved-settings compatible
export const FOLIATE_WORKSPACE_LABEL = 'Foliate Ornament'

export { COMPOSITION_MODES }

export const BRANCH_ROLES = Object.freeze({
  PRIMARY: 'PRIMARY',
  SECONDARY: 'SECONDARY',
  MIRROR: 'MIRROR',
  INITIATION: 'INITIATION',
})

export const MOTIF_KINDS = Object.freeze({
  SPANDREL_SCROLL: 'SPANDREL_SCROLL',
  ARCH_SHOULDER: 'ARCH_SHOULDER',
  PIER_PANEL: 'PIER_PANEL',
})

export const TERMINATION_REASONS = Object.freeze({
  LENGTH: 'LENGTH',
  DEPTH: 'DEPTH',
  SURFACE: 'SURFACE',
  OPENING: 'OPENING',
  SEPARATION: 'SEPARATION',
  BUDGET: 'BUDGET',
  ROOT: 'ROOT',
  BOUNDARY: 'BOUNDARY',
  NORMAL: 'NORMAL',
})

/** Essential / Advanced / Debug defaults (lab + legacy growth). */
export const DEFAULT_FOLIATE_SETTINGS = Object.freeze({
  // 14A.1.2 composition laboratory (default)
  ...DEFAULT_PARAMETRIC_MOTIF_SETTINGS,
  compositionMode: COMPOSITION_MODES.SINGLE_MOTIF,

  // Legacy growth (14A.1 / 14A.1.1) — preserved
  growthProgress: 1,
  growthLength: 1.15,
  branchDensity: 0.55,
  curlStrength: 0.7,
  symmetryStrength: 1,
  creatureInfluence: 0.3,
  randomSeed: 42,

  architecturalAttraction: 0.65,
  branchAngle: 0.55,
  maxBranchDepth: 3,
  surfaceAdherence: 0.85,
  growthStepSize: 0.055,
  minBranchSeparation: 0.045,
  terminationThreshold: 0.04,
  maxMotifs: 12,
  maxAttachmentDistance: 0.12,

  preferSpandrelHost: true,
  allowRestrictedHost: true,

  showGrowthNodes: false,
  showBranchIds: false,
  showSurfaceNormals: false,
  showGrowthDirections: false,
  showInvalidSegments: true,
  showAttachmentAnchors: false,
  showMotifDebug: false,
  inspectMotifIndex: 0,
})

export function createGrowthNode(partial) {
  return {
    id: partial.id,
    parentId: partial.parentId ?? null,
    branchId: partial.branchId,
    motifId: partial.motifId ?? null,
    position: partial.position ?? [0, 0, 0],
    surfaceAttachment: partial.surfaceAttachment ?? null,
    localTangent: normalize3(partial.localTangent ?? [1, 0, 0]),
    surfaceNormal: normalize3(partial.surfaceNormal ?? [0, 0, 1]),
    growthDirection: normalize3(partial.growthDirection ?? [0, 1, 0]),
    generation: partial.generation ?? 0,
    distanceFromRoot: partial.distanceFromRoot ?? 0,
    growthProgress: partial.growthProgress ?? 0,
    role: partial.role ?? BRANCH_ROLES.PRIMARY,
    valid: partial.valid !== false,
    invalidReason: partial.invalidReason ?? null,
    mirrorOf: partial.mirrorOf ?? null,
    accepted: partial.accepted !== false,
  }
}

export function createGrowthBranch(partial) {
  return {
    id: partial.id,
    parentBranchId: partial.parentBranchId ?? null,
    motifId: partial.motifId ?? null,
    nodeIds: partial.nodeIds ?? [],
    depth: partial.depth ?? 0,
    length: partial.length ?? 0,
    curvature: partial.curvature ?? 0,
    terminationReason: partial.terminationReason ?? TERMINATION_REASONS.LENGTH,
    role: partial.role ?? BRANCH_ROLES.PRIMARY,
    rootAnchorId: partial.rootAnchorId ?? null,
    mirrorOf: partial.mirrorOf ?? null,
  }
}

export function createOrnamentMotif(partial) {
  return {
    id: partial.id,
    kind: partial.kind ?? MOTIF_KINDS.SPANDREL_SCROLL,
    primaryAnchorId: partial.primaryAnchorId ?? null,
    supportAnchorIds: partial.supportAnchorIds ?? [],
    unusedAnchorIds: partial.unusedAnchorIds ?? [],
    origin: partial.origin ?? [0, 0, 0],
    normal: normalize3(partial.normal ?? [0, 0, 1]),
    axisU: normalize3(partial.axisU ?? [1, 0, 0]),
    axisV: normalize3(partial.axisV ?? [0, 1, 0]),
    localSymmetryAxis: partial.localSymmetryAxis ?? [0, 1, 0],
    localSymmetryOrigin: partial.localSymmetryOrigin ?? partial.origin ?? [0, 0, 0],
    bounds: partial.bounds ?? null,
    branchIds: partial.branchIds ?? [],
    regionKey: partial.regionKey ?? null,
  }
}

export function emptyOrnamentSkeleton(meta = {}) {
  return {
    type: 'ORNAMENT_GROWTH_SKELETON',
    version: '14A.1.1',
    nodes: [],
    branches: [],
    motifs: [],
    rejectedSegments: [],
    initiationPointIds: [],
    diagnostics: {
      anchorCount: 0,
      anchorsAccepted: 0,
      anchorsRejected: 0,
      anchorsUnused: 0,
      anchorsZeroGrowth: 0,
      motifCount: 0,
      nodeCount: 0,
      branchCount: 0,
      invalidSegmentCount: 0,
      acceptedInvalidCount: 0,
      mirroredBranchCount: 0,
      maxDistanceFromRoot: 0,
      terminationCounts: {},
      rejectionCounts: {},
      cacheKey: null,
      emptyReason: meta.emptyReason ?? null,
    },
    parameters: meta.parameters ?? null,
    geometrySignature: meta.geometrySignature ?? '',
    label: 'ORNAMENT GROWTH SKELETON — CONSTRUCTION PREVIEW',
  }
}

export {
  mulberry32,
  normalize3,
  add3,
  scale3,
  sub3,
  cross3,
  dot3,
  dist3,
}
