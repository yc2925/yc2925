/**
 * Reusable geometric queries for growth attachment (13E.4).
 */

import { GROWTH_ELIGIBILITY } from '../surfaceSemanticsTypes.js'
import { dist3, normalize3, dot3, sub3 } from './types.js'
import { buildSurfaceFrame, validateSurfaceFrame } from './frames.js'
import {
  attachFromWorldHit,
  findNearestPatch,
  isNearProtectedOpening,
  createAnchorOnPatch,
} from './anchors.js'
import { findSurfacePath } from './pathQuery.js'

export function getSurfaceFrame(anchor, semantics = null) {
  if (!anchor) return { ok: false, reason: 'missing anchor' }
  let componentType = anchor.metadata?.componentType
  let surfaceType = anchor.metadata?.surfaceType
  if (semantics) {
    const c = semantics.components?.find((x) => x.id === anchor.componentId)
    const s = semantics.surfaces?.find((x) => x.surfaceId === anchor.surfaceId)
    componentType = c?.componentType ?? componentType
    surfaceType = s?.surfaceType ?? surfaceType
  }
  const frame = buildSurfaceFrame({
    position: anchor.worldPosition,
    normal: anchor.worldNormal,
    componentType,
    surfaceType,
    tangentHint: anchor.tangentU,
  })
  const validation = validateSurfaceFrame(frame)
  return { ok: validation.ok, frame, validation, anchorId: anchor.anchorId }
}

export function projectToEligibleSurface(point, options = {}) {
  const semantics = options.semantics
  if (!semantics) return { ok: false, reason: 'missing semantics' }
  const nearest = findNearestPatch(semantics, point, options)
  if (!nearest.patch) return { ok: false, reason: nearest.reason ?? 'no patch', distance: Infinity }

  const n = normalize3(nearest.patch.representativeNormal ?? [0, 0, 1])
  const c = nearest.patch.worldTransform?.position ?? [0, 0, 0]
  const toP = sub3(point, c)
  const signed = dot3(toP, n)
  const projected = [
    point[0] - n[0] * signed,
    point[1] - n[1] * signed,
    point[2] - n[2] * signed,
  ]
  const created = createAnchorOnPatch(semantics, nearest.patch, {
    ...options,
    worldPosition: projected,
    worldNormal: n,
    clearance: Math.abs(signed),
  })
  return {
    ok: created.ok,
    reason: created.reason,
    anchor: created.anchor,
    distance: Math.abs(signed),
    contact: Math.abs(signed) < (options.projectionTolerance ?? 0.08),
    penetration: signed < -1e-4,
  }
}

export function findNearestValidAnchor(point, options = {}) {
  const semantics = options.semantics
  const state = options.state
  if (state?.anchors?.length) {
    let best = null
    let bestD = Infinity
    for (const a of state.anchors) {
      if (a.status === 'ORPHANED' || a.status === 'BLOCKED') continue
      const d = dist3(a.worldPosition, point)
      if (d < bestD) {
        bestD = d
        best = a
      }
    }
    if (best && bestD <= (options.maxDistance ?? Infinity)) {
      return { ok: true, anchor: best, distance: bestD, source: 'existing' }
    }
  }
  const projected = projectToEligibleSurface(point, options)
  if (!projected.ok) return { ok: false, reason: projected.reason }
  return {
    ok: true,
    anchor: projected.anchor,
    distance: projected.distance,
    source: 'projected',
  }
}

export function isInsideProtectedOpening(point, semantics, options = {}) {
  const hit = isNearProtectedOpening(semantics, point, options.radius ?? 0.18)
  return { inside: Boolean(hit), opening: hit }
}

/**
 * Clearance check: sphere vs stone patches + openings.
 * Distinguishes contact / penetration / empty space / protected opening.
 */
export function checkGrowthClearance(position, radius, options = {}) {
  const semantics = options.semantics
  const r = Math.max(0, radius ?? 0.05)
  const opening = isInsideProtectedOpening(position, semantics, { radius: r })
  if (opening.inside) {
    return {
      ok: false,
      classification: 'PROTECTED_OPENING',
      clearance: 0,
      opening: opening.opening,
    }
  }

  const nearest = findNearestPatch(semantics, position, {
    allowRestricted: options.allowRestricted,
  })
  if (!nearest.patch) {
    return {
      ok: true,
      classification: 'EMPTY_SPACE',
      clearance: Infinity,
      note: 'no eligible stone nearby',
    }
  }

  const n = normalize3(nearest.patch.representativeNormal ?? [0, 0, 1])
  const c = nearest.patch.worldTransform?.position ?? [0, 0, 0]
  const toP = sub3(position, c)
  const signed = dot3(toP, n) // positive = outside along outward normal
  const planar = Math.hypot(
    toP[0] - n[0] * signed,
    toP[1] - n[1] * signed,
    toP[2] - n[2] * signed,
  )
  const patchR = Math.sqrt(Math.max(nearest.patch.area ?? 0, 1e-6) / Math.PI)

  if (planar > patchR * 1.8 && signed > r) {
    return {
      ok: true,
      classification: 'EMPTY_SPACE',
      clearance: signed,
      patchId: nearest.patch.patchId,
    }
  }

  if (signed < -r * 0.25) {
    return {
      ok: false,
      classification: 'PENETRATION',
      clearance: signed,
      patchId: nearest.patch.patchId,
      eligibility: nearest.patch.growthEligibility,
    }
  }

  if (Math.abs(signed) <= r * 1.25) {
    return {
      ok: true,
      classification: 'SURFACE_CONTACT',
      clearance: signed,
      patchId: nearest.patch.patchId,
      eligibility: nearest.patch.growthEligibility,
    }
  }

  return {
    ok: true,
    classification: 'CLEAR',
    clearance: signed - r,
    patchId: nearest.patch.patchId,
  }
}

export {
  attachFromWorldHit,
  findSurfacePath,
  projectToEligibleSurface as projectPoint,
}

/** Convenience: diagnose whether a component type is molding-like (decorative). */
export function isMoldingAttachmentEnabled(options = {}) {
  return options.enableMoldingAttachments === true
}

export function filterPatchesForMoldings(patches, options = {}) {
  if (options.enableMoldingAttachments) return patches
  // Structural semantics already exclude moldings; keep hook for future mesh groups.
  return (patches ?? []).filter((p) => p.metadata?.meshGroup !== 'molding')
}

export function classifyEligibility(elig) {
  if (elig === GROWTH_ELIGIBILITY.ALLOWED) return 'ALLOWED'
  if (elig === GROWTH_ELIGIBILITY.RESTRICTED) return 'RESTRICTED'
  return 'PROHIBITED'
}
