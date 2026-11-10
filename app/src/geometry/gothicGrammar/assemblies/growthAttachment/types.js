/**
 * Growth attachment schema (Step 13E.4).
 * Attachment + navigation substrate only — no vegetation geometry.
 */

import { GROWTH_ELIGIBILITY } from '../surfaceSemanticsTypes.js'

export const ANCHOR_STATUS = Object.freeze({
  VALID: 'VALID',
  REPROJECTED: 'REPROJECTED',
  BLOCKED: 'BLOCKED',
  ORPHANED: 'ORPHANED',
})

export const ATTACHMENT_METHODS = Object.freeze({
  SURFACE_BARYCENTRIC: 'SURFACE_BARYCENTRIC',
  SURFACE_PARAMETRIC: 'SURFACE_PARAMETRIC',
  FEATURE_RELATIVE: 'FEATURE_RELATIVE',
})

export const SEED_DISTRIBUTION_MODES = Object.freeze({
  MANUAL: 'MANUAL',
  UNIFORM_SURFACE: 'UNIFORM_SURFACE',
  WEIGHTED_BY_ELIGIBILITY: 'WEIGHTED_BY_ELIGIBILITY',
  FEATURE_BASED: 'FEATURE_BASED',
  SACRED_FACADE: 'SACRED_FACADE',
})

export const NAV_TRANSITION_TYPES = Object.freeze({
  SAME_SURFACE: 'SAME_SURFACE',
  ADJACENT_SURFACE: 'ADJACENT_SURFACE',
  ARCHITECTURAL_EDGE: 'ARCHITECTURAL_EDGE',
  STRUCTURAL_JUNCTION: 'STRUCTURAL_JUNCTION',
})

export const ANCHOR_SCOPES = Object.freeze({
  MASTER_MODULE: 'MASTER_MODULE',
  ASSEMBLY_INSTANCE: 'ASSEMBLY_INSTANCE',
})

export const GROWTH_ATTACHMENT_TYPE = 'GROWTH_ATTACHMENT_STATE'

/** Default UI / runtime settings for growth attachment (merged into assembly). */
export const DEFAULT_GROWTH_ATTACHMENT_SETTINGS = Object.freeze({
  // Essential
  growthPlacementMode: 'manual', // manual | automatic
  growthSeedCount: 24,
  growthDistributionMode: SEED_DISTRIBUTION_MODES.WEIGHTED_BY_ELIGIBILITY,
  growthRandomSeed: 13,
  growthPlaceSeedActive: false,
  showGrowthSeeds: true,
  showGrowthNavPaths: false,

  // Advanced
  growthMinSeedSpacing: 0.22,
  growthAllowRestricted: false,
  growthPreferVertical: true,
  growthPreferRecesses: false,
  growthPreferJunctions: true,
  growthEnableMoldingAttachments: false,
  growthAllowedSurfaceTypes: null, // null = all non-prohibited by policy

  // Debug
  showGrowthNormals: false,
  showGrowthTangents: false,
  showGrowthNavGraph: false,
  showInvalidGrowthAnchors: true,
  showGrowthCollisionDiagnostics: false,
  growthProjectionTolerance: 0.08,
  growthNavigationGapTolerance: 0.35,
})

export { GROWTH_ELIGIBILITY }

/**
 * @typedef {object} GrowthAnchor
 * @property {string} anchorId
 * @property {string} componentId
 * @property {string} surfaceId
 * @property {string} patchId
 * @property {string} geometrySignature
 * @property {[number,number,number]} localPosition
 * @property {[number,number,number]} worldPosition
 * @property {[number,number,number]} localNormal
 * @property {[number,number,number]} worldNormal
 * @property {[number,number,number]} tangentU
 * @property {[number,number,number]} tangentV
 * @property {string} attachmentMethod
 * @property {string} eligibility
 * @property {string} status
 */

/**
 * Create a GROWTH_ANCHOR with required fields.
 * @param {Partial<GrowthAnchor> & { anchorId: string, componentId: string, surfaceId: string, patchId: string }} partial
 */
export function createGrowthAnchor(partial) {
  const worldNormal = normalize3(partial.worldNormal ?? [0, 0, 1])
  const frame = partial.tangentU && partial.tangentV
    ? {
        tangentU: normalize3(partial.tangentU),
        tangentV: normalize3(partial.tangentV),
      }
    : null

  return {
    type: 'GROWTH_ANCHOR',
    anchorId: partial.anchorId,
    componentId: partial.componentId,
    surfaceId: partial.surfaceId,
    patchId: partial.patchId,
    geometrySignature: partial.geometrySignature ?? '',
    localPosition: partial.localPosition ?? [0, 0, 0],
    worldPosition: partial.worldPosition ?? [0, 0, 0],
    localNormal: normalize3(partial.localNormal ?? worldNormal),
    worldNormal,
    tangentU: frame?.tangentU ?? [1, 0, 0],
    tangentV: frame?.tangentV ?? [0, 1, 0],
    attachmentMethod: partial.attachmentMethod ?? ATTACHMENT_METHODS.SURFACE_PARAMETRIC,
    eligibility: partial.eligibility ?? GROWTH_ELIGIBILITY.ALLOWED,
    status: partial.status ?? ANCHOR_STATUS.VALID,
    // Optional
    triangleIndex: partial.triangleIndex ?? null,
    barycentricCoordinates: partial.barycentricCoordinates ?? null,
    uvCoordinates: partial.uvCoordinates ?? null,
    semanticFeatureId: partial.semanticFeatureId ?? null,
    growthZoneIds: partial.growthZoneIds ?? [],
    clearance: partial.clearance ?? null,
    seedType: partial.seedType ?? 'default',
    scope: partial.scope ?? ANCHOR_SCOPES.ASSEMBLY_INSTANCE,
    instanceId: partial.instanceId ?? null,
    bayId: partial.bayId ?? null,
    masterAnchorId: partial.masterAnchorId ?? null,
    metadata: partial.metadata ?? {},
  }
}

export function emptyGrowthAttachmentState(geometrySignature = '') {
  return {
    type: GROWTH_ATTACHMENT_TYPE,
    geometrySignature,
    anchors: [],
    navigationGraph: null,
    lastPath: null,
    distributionReport: null,
    diagnostics: {
      acceptedSeeds: 0,
      requestedSeeds: 0,
      orphaned: 0,
      blocked: 0,
      reprojected: 0,
    },
  }
}

export function normalize3(v) {
  const x = v?.[0] ?? 0
  const y = v?.[1] ?? 0
  const z = v?.[2] ?? 0
  const len = Math.hypot(x, y, z)
  if (!(len > 1e-12)) return [0, 0, 1]
  return [x / len, y / len, z / len]
}

export function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

export function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function scale3(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s]
}

export function dist3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

export function mulberry32(seed) {
  let t = seed >>> 0
  return function rand() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
