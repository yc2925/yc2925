/**
 * Growth anchor creation from semantic patches / ray hits (13E.4).
 */

import { GROWTH_ELIGIBILITY } from '../surfaceSemanticsTypes.js'
import {
  ANCHOR_STATUS,
  ATTACHMENT_METHODS,
  ANCHOR_SCOPES,
  createGrowthAnchor,
  dist3,
  normalize3,
} from './types.js'
import { buildSurfaceFrame } from './frames.js'

let _seq = 0
export function nextAnchorId(prefix = 'ga') {
  _seq += 1
  return `${prefix}-${_seq.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function resetAnchorIdCounter(n = 0) {
  _seq = n
}

function componentMap(semantics) {
  return new Map((semantics?.components ?? []).map((c) => [c.id, c]))
}

function surfaceMap(semantics) {
  return new Map((semantics?.surfaces ?? []).map((s) => [s.surfaceId, s]))
}

function patchMap(semantics) {
  return new Map((semantics?.patches ?? []).map((p) => [p.patchId, p]))
}

/**
 * Eligibility gate for placement.
 */
export function isPatchPlaceable(patch, options = {}) {
  if (!patch) return { ok: false, reason: 'missing patch' }
  const elig = patch.growthEligibility
  if (elig === GROWTH_ELIGIBILITY.PROHIBITED) {
    return { ok: false, reason: 'PROHIBITED surface — placement rejected' }
  }
  if (elig === GROWTH_ELIGIBILITY.RESTRICTED && !options.allowRestricted) {
    return {
      ok: false,
      reason: 'RESTRICTED surface — enable Restricted Surface Override to place',
    }
  }
  if (options.allowedSurfaceTypes?.length) {
    // surface type filter applied by caller with surface lookup
  }
  return { ok: true }
}

/**
 * Build an anchor at a patch-local offset (parametric / barycentric-ready).
 */
export function createAnchorOnPatch(semantics, patch, opts = {}) {
  if (!semantics || !patch) {
    return { ok: false, reason: 'missing semantics or patch', anchor: null }
  }
  const place = isPatchPlaceable(patch, opts)
  if (!place.ok) return { ok: false, reason: place.reason, anchor: null }

  const components = componentMap(semantics)
  const surfaces = surfaceMap(semantics)
  const component = components.get(patch.componentId)
  const surface = surfaces.get(patch.surfaceId)

  if (opts.allowedSurfaceTypes?.length && surface) {
    if (!opts.allowedSurfaceTypes.includes(surface.surfaceType)) {
      return { ok: false, reason: `surface type ${surface.surfaceType} not allowed`, anchor: null }
    }
  }

  const worldPos = opts.worldPosition ?? patch.worldTransform?.position ?? [0, 0, 0]
  const localPos = opts.localPosition ?? patch.localCoordinates?.centroid ?? [0, 0, 0]
  const worldNormal = normalize3(
    opts.worldNormal ?? patch.representativeNormal ?? patch.worldTransform?.normal ?? [0, 0, 1],
  )
  const localNormal = normalize3(opts.localNormal ?? patch.localCoordinates?.normal ?? worldNormal)

  const frame = buildSurfaceFrame({
    position: worldPos,
    normal: worldNormal,
    componentType: component?.componentType,
    surfaceType: surface?.surfaceType,
  })

  const zones = (semantics.zones ?? [])
    .filter((z) => (z.surfaceIds ?? []).includes(patch.surfaceId))
    .map((z) => z.zoneId)

  const method =
    opts.barycentricCoordinates != null
      ? ATTACHMENT_METHODS.SURFACE_BARYCENTRIC
      : opts.semanticFeatureId
        ? ATTACHMENT_METHODS.FEATURE_RELATIVE
        : ATTACHMENT_METHODS.SURFACE_PARAMETRIC

  const anchor = createGrowthAnchor({
    anchorId: opts.anchorId ?? nextAnchorId(),
    componentId: patch.componentId,
    surfaceId: patch.surfaceId,
    patchId: patch.patchId,
    geometrySignature: semantics.geometryVersion ?? '',
    localPosition: localPos,
    worldPosition: worldPos,
    localNormal,
    worldNormal: frame.normal,
    tangentU: frame.tangentU,
    tangentV: frame.tangentV,
    attachmentMethod: method,
    eligibility: patch.growthEligibility,
    status: opts.status ?? ANCHOR_STATUS.VALID,
    triangleIndex: opts.triangleIndex ?? null,
    barycentricCoordinates: opts.barycentricCoordinates ?? null,
    semanticFeatureId: opts.semanticFeatureId ?? null,
    growthZoneIds: zones,
    clearance: opts.clearance ?? null,
    seedType: opts.seedType ?? 'default',
    scope: opts.scope ?? ANCHOR_SCOPES.ASSEMBLY_INSTANCE,
    instanceId: opts.instanceId ?? component?.bayId ?? null,
    bayId: opts.bayId ?? component?.bayId ?? null,
    masterAnchorId: opts.masterAnchorId ?? null,
    metadata: {
      componentType: component?.componentType ?? null,
      surfaceType: surface?.surfaceType ?? null,
      growthWeight: patch.growthWeight ?? 0,
      area: patch.area ?? 0,
      ...(opts.metadata ?? {}),
    },
  })

  return { ok: true, anchor, frame }
}

/**
 * Map a world-space ray hit onto the nearest eligible semantic patch.
 */
export function attachFromWorldHit(semantics, hit, options = {}) {
  if (!semantics?.patches?.length) {
    return { ok: false, reason: 'no semantic patches', anchor: null }
  }
  const point = hit?.point
  const normal = hit?.normal
  if (!point) return { ok: false, reason: 'missing hit point', anchor: null }

  // Protected openings: reject if near opening centroid with no stone patch closer
  if (options.protectOpenings !== false) {
    const openingHit = isNearProtectedOpening(semantics, point, options.openingRadius ?? 0.18)
    if (openingHit) {
      return {
        ok: false,
        reason: `hit maps to protected opening ${openingHit.openingId}`,
        anchor: null,
      }
    }
  }

  const nearest = findNearestPatch(semantics, point, {
    ...options,
    preferNormal: normal,
  })
  if (!nearest.patch) {
    return { ok: false, reason: nearest.reason ?? 'no eligible patch near hit', anchor: null }
  }

  const maxDist = options.projectionTolerance ?? 0.08
  if (nearest.distance > maxDist * 4) {
    return {
      ok: false,
      reason: `hit too far from stone surface (d=${nearest.distance.toFixed(3)})`,
      anchor: null,
    }
  }

  // Project onto patch plane
  const n = normalize3(nearest.patch.representativeNormal ?? [0, 0, 1])
  const c = nearest.patch.worldTransform?.position ?? [0, 0, 0]
  const toP = [point[0] - c[0], point[1] - c[1], point[2] - c[2]]
  const signed = toP[0] * n[0] + toP[1] * n[1] + toP[2] * n[2]
  const projected = [point[0] - n[0] * signed, point[1] - n[1] * signed, point[2] - n[2] * signed]

  return createAnchorOnPatch(semantics, nearest.patch, {
    ...options,
    worldPosition: projected,
    worldNormal: normal ? normalize3(normal) : n,
    localPosition: [
      (nearest.patch.localCoordinates?.centroid?.[0] ?? 0) + (projected[0] - c[0]),
      (nearest.patch.localCoordinates?.centroid?.[1] ?? 0) + (projected[1] - c[1]),
      (nearest.patch.localCoordinates?.centroid?.[2] ?? 0) + (projected[2] - c[2]),
    ],
    triangleIndex: hit.faceIndex ?? null,
    barycentricCoordinates: hit.barycentric ?? null,
    clearance: Math.abs(signed),
  })
}

export function findNearestPatch(semantics, point, options = {}) {
  const allowRestricted = options.allowRestricted === true
  const allowedTypes = options.allowedSurfaceTypes
  const surfaces = surfaceMap(semantics)
  let best = null
  let bestD = Infinity
  let rejected = 0

  for (const patch of semantics.patches ?? []) {
    const gate = isPatchPlaceable(patch, { allowRestricted })
    if (!gate.ok) {
      rejected += 1
      continue
    }
    if (allowedTypes?.length) {
      const s = surfaces.get(patch.surfaceId)
      if (s && !allowedTypes.includes(s.surfaceType)) continue
    }
    const c = patch.worldTransform?.position
    if (!c) continue
    let d = dist3(point, c)
    // Soft preference for matching hit normal
    if (options.preferNormal) {
      const pn = patch.representativeNormal ?? [0, 0, 1]
      const align = Math.max(
        0,
        pn[0] * options.preferNormal[0] +
          pn[1] * options.preferNormal[1] +
          pn[2] * options.preferNormal[2],
      )
      d *= 1.15 - 0.15 * align
    }
    if (d < bestD) {
      bestD = d
      best = patch
    }
  }

  if (!best) {
    return {
      patch: null,
      distance: Infinity,
      reason: rejected ? 'only prohibited/restricted patches nearby' : 'empty patch set',
    }
  }
  return { patch: best, distance: bestD }
}

export function isNearProtectedOpening(semantics, point, radius = 0.18) {
  for (const op of semantics.openings ?? []) {
    if (op.growableSurface === true) continue
    const c = op.centroid
    if (!c) continue
    // openings may be 2D (x,y) — treat z≈0 facade plane
    const cx = c[0] ?? c.x ?? 0
    const cy = c[1] ?? c.y ?? 0
    const cz = c[2] ?? c.z ?? 0
    const d = Math.hypot(point[0] - cx, point[1] - cy, point[2] - cz)
    // Prefer XY distance for facade openings extruded in Z
    const dxy = Math.hypot(point[0] - cx, point[1] - cy)
    const thresh = Math.max(radius, Math.sqrt(Math.max(0, op.area ?? 0) / Math.PI) * 0.35)
    if (dxy < thresh && Math.abs(point[2] - cz) < 0.6) {
      return op
    }
    if (d < thresh * 0.5) return op
  }
  return null
}

export function listAnchorsByStatus(state, status) {
  return (state?.anchors ?? []).filter((a) => a.status === status)
}
