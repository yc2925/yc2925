/**
 * Step 14A.1.2 — Parametric Gothic motif laboratory types.
 * Construction curves only — not final stone, not vegetation.
 */

import { mulberry32, normalize3, add3, scale3, sub3, cross3, dot3, dist3 } from '../../growthAttachment/types.js'

export const COMPOSITION_MODES = Object.freeze({
  SINGLE_MOTIF: 'single-motif',
  FULL_FACADE: 'full-facade',
  LEGACY_GROWTH: 'legacy-growth',
})

export const MOTIF_TYPES = Object.freeze({
  SYMMETRICAL_SPANDREL_SCROLL: 'symmetrical-spandrel-scroll',
})

export const HOST_KINDS = Object.freeze({
  SPANDREL: 'spandrel',
  ARCH_SHOULDER: 'arch-shoulder',
  PIER_PANEL: 'pier-panel',
})

export const CURVE_ROLES = Object.freeze({
  PRIMARY_SPINE: 'PRIMARY_SPINE',
  PRIMARY_VOLUTE: 'PRIMARY_VOLUTE',
  SECONDARY_CURL: 'SECONDARY_CURL',
  TERTIARY: 'TERTIARY',
  MIRROR: 'MIRROR',
  CONSTRUCTION: 'CONSTRUCTION',
  RIB_MARK: 'RIB_MARK',
})

export const ROOT_ANCHOR_TOLERANCE = 2e-3

export const DEFAULT_PARAMETRIC_MOTIF_SETTINGS = Object.freeze({
  compositionMode: COMPOSITION_MODES.SINGLE_MOTIF,
  motifType: MOTIF_TYPES.SYMMETRICAL_SPANDREL_SCROLL,
  hostKind: HOST_KINDS.SPANDREL,
  /** @deprecated Independent host index — motifs must select shared anchors. */
  selectedHostIndex: 0,
  /** Shared GrowthAttachment anchor id (Assembly ↔ Foliate). */
  selectedAnchorId: null,
  maxMotifs: 12,

  // Essential
  motifScale: 1,
  scrollTurns: 1.25,
  curlStrength: 0.7,
  symmetryStrength: 1,
  branchHierarchy: 0.65,
  creatureInfluence: 0.3,
  randomSeed: 42,

  // Advanced
  primarySpineCurvature: 0.35,
  voluteRadius: 0.42,
  voluteTightness: 0.75,
  secondaryCurlScale: 0.45,
  branchAttachmentPosition: 0.55,
  negativeSpaceClearance: 0.06,
  motifRotation: 0,
  motifOffsetU: 0,
  motifOffsetV: 0.05,

  // Reveal stages (presentation)
  showPrimarySpine: true,
  showPrimaryVolutes: true,
  showSecondaryCurls: true,

  // Debug
  showHostBoundary: false,
  showLocalAxes: false,
  showConstructionCurves: false,
  showControlPoints: false,
  showBranchHierarchy: false,
  showInvalidGeometry: true,
  showClearanceZones: false,
  showAnchorLinkDebug: false,

  // Camera
  fitMotifToken: 0,
})

export function createCurveMember(partial) {
  return {
    id: partial.id,
    role: partial.role ?? CURVE_ROLES.PRIMARY_SPINE,
    parentId: partial.parentId ?? null,
    hierarchy: partial.hierarchy ?? 0,
    points: partial.points ?? [],
    controlPoints: partial.controlPoints ?? [],
    length: partial.length ?? 0,
    valid: partial.valid !== false,
    invalidReason: partial.invalidReason ?? null,
    mirrorOf: partial.mirrorOf ?? null,
    hostId: partial.hostId ?? null,
    attachmentT: partial.attachmentT ?? null,
    meta: partial.meta ?? null,
  }
}

export function emptyParametricMotif(meta = {}) {
  return {
    type: 'PARAMETRIC_GOTHIC_MOTIF',
    version: '14A.1.2.1',
    motifs: [],
    hosts: [],
    anchors: meta.anchors ?? [],
    diagnostics: {
      motifCount: 0,
      curveCount: 0,
      invalidCurveCount: 0,
      hostCount: 0,
      anchorCount: meta.anchorCount ?? 0,
      unusedAnchorCount: meta.unusedAnchorCount ?? 0,
      invalidAnchorCount: meta.invalidAnchorCount ?? 0,
      fitOk: false,
      emptyReason: meta.emptyReason ?? null,
      cacheKey: null,
      unusedAnchors: meta.unusedAnchors ?? [],
      invalidAnchors: meta.invalidAnchors ?? [],
    },
    parameters: meta.parameters ?? null,
    geometrySignature: meta.geometrySignature ?? '',
    label: 'PARAMETRIC GOTHIC MOTIF — CONSTRUCTION PREVIEW',
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
