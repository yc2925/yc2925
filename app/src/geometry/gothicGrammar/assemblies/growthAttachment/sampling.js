/**
 * Procedural area-aware seed distribution (13E.4).
 */

import { GROWTH_ELIGIBILITY, GROWTH_ZONES, SURFACE_TYPES } from '../surfaceSemanticsTypes.js'
import {
  SEED_DISTRIBUTION_MODES,
  mulberry32,
  dist3,
  scale3,
  add3,
  normalize3,
} from './types.js'
import { createAnchorOnPatch, isPatchPlaceable } from './anchors.js'
import { buildSurfaceFrame } from './frames.js'

function surfaceLookup(semantics) {
  return new Map((semantics?.surfaces ?? []).map((s) => [s.surfaceId, s]))
}

function componentLookup(semantics) {
  return new Map((semantics?.components ?? []).map((c) => [c.id, c]))
}

function zoneLookup(semantics) {
  return semantics?.zones ?? []
}

/**
 * Weight a patch for distribution modes.
 */
export function patchSampleWeight(patch, surface, component, semantics, options = {}) {
  const mode = options.distributionMode ?? SEED_DISTRIBUTION_MODES.WEIGHTED_BY_ELIGIBILITY
  const area = Math.max(0, patch.area ?? 0)
  if (!(area > 0)) return 0

  const gate = isPatchPlaceable(patch, { allowRestricted: options.allowRestricted })
  if (!gate.ok) return 0

  let w = area
  const elig = patch.growthEligibility
  const growthW = Math.max(0, patch.growthWeight ?? 0)

  if (mode === SEED_DISTRIBUTION_MODES.UNIFORM_SURFACE) {
    w = area
  } else if (mode === SEED_DISTRIBUTION_MODES.WEIGHTED_BY_ELIGIBILITY) {
    w = area * (0.15 + growthW)
    if (elig === GROWTH_ELIGIBILITY.RESTRICTED) w *= 0.35
  } else if (mode === SEED_DISTRIBUTION_MODES.FEATURE_BASED) {
    w = area * (0.2 + growthW)
    const zones = zoneLookup(semantics).filter((z) =>
      (z.surfaceIds ?? []).includes(patch.surfaceId),
    )
    if (zones.some((z) => z.zoneType === GROWTH_ZONES.STRUCTURAL_COLONIZATION)) w *= 1.4
    if (zones.some((z) => z.zoneType === GROWTH_ZONES.ARCH_FOLLOWING)) w *= 1.3
    if (options.preferJunctions) {
      const feats = (semantics.features ?? []).filter((f) =>
        (f.componentIds ?? []).includes(patch.componentId),
      )
      if (feats.length) w *= 1.5
    }
  } else if (mode === SEED_DISTRIBUTION_MODES.SACRED_FACADE) {
    w = area * (0.2 + growthW)
    const zones = zoneLookup(semantics).filter((z) =>
      (z.surfaceIds ?? []).includes(patch.surfaceId),
    )
    if (zones.some((z) => z.zoneType === GROWTH_ZONES.SACRED_FACADE)) w *= 2.2
    else w *= 0.45
    // Prefer front faces
    if (surface?.surfaceType === SURFACE_TYPES.FRONT_FACE) w *= 1.6
  } else {
    // MANUAL — no auto weight
    return 0
  }

  const n = normalize3(patch.representativeNormal ?? [0, 0, 1])
  if (options.preferVertical) {
    const verticality = 1 - Math.abs(n[1]) // normals facing outward horizontally score higher
    w *= 0.55 + 0.45 * Math.max(0, verticality)
  }
  if (options.preferRecesses) {
    if (
      surface?.surfaceType === SURFACE_TYPES.RECESS ||
      surface?.surfaceType === SURFACE_TYPES.INTRADOS
    ) {
      w *= 1.8
    }
  }

  if (options.allowedSurfaceTypes?.length && surface) {
    if (!options.allowedSurfaceTypes.includes(surface.surfaceType)) return 0
  }

  return Math.max(0, w)
}

/**
 * Jitter a sample within a patch using an orthonormal frame.
 */
function sampleOnPatch(patch, component, surface, rand, jitterScale = 0.35) {
  const c = patch.worldTransform?.position ?? [0, 0, 0]
  const frame = buildSurfaceFrame({
    position: c,
    normal: patch.representativeNormal ?? [0, 0, 1],
    componentType: component?.componentType,
    surfaceType: surface?.surfaceType,
  })
  // Approximate patch radius from area (disk)
  const r = Math.sqrt(Math.max(areaSafe(patch.area), 1e-6) / Math.PI) * jitterScale
  const u = (rand() * 2 - 1) * r
  const v = (rand() * 2 - 1) * r
  const world = add3(add3(c, scale3(frame.tangentU, u)), scale3(frame.tangentV, v))
  return { world, frame, localOffset: [u, v, 0] }
}

function areaSafe(a) {
  return Number.isFinite(a) && a > 0 ? a : 0
}

/**
 * Distribute seeds across eligible patches.
 * @returns {{ ok: boolean, anchors: object[], report: object }}
 */
export function distributeGrowthSeeds(semantics, options = {}) {
  const requested = Math.max(0, Math.floor(options.seedCount ?? 24))
  const rand = mulberry32(options.randomSeed ?? 13)
  const minSpacing = Math.max(0.01, options.minSpacing ?? 0.22)
  const mode = options.distributionMode ?? SEED_DISTRIBUTION_MODES.WEIGHTED_BY_ELIGIBILITY

  if (mode === SEED_DISTRIBUTION_MODES.MANUAL || requested === 0) {
    return {
      ok: true,
      anchors: [],
      report: {
        requested,
        accepted: 0,
        rejectedSpacing: 0,
        rejectedWeight: 0,
        mode,
        totalEligibleArea: 0,
      },
    }
  }

  const surfaces = surfaceLookup(semantics)
  const components = componentLookup(semantics)
  const candidates = []
  let totalW = 0
  let totalEligibleArea = 0

  for (const patch of semantics.patches ?? []) {
    const surface = surfaces.get(patch.surfaceId)
    const component = components.get(patch.componentId)
    const w = patchSampleWeight(patch, surface, component, semantics, { ...options, distributionMode: mode })
    if (w <= 0) continue
    totalW += w
    totalEligibleArea += areaSafe(patch.area)
    candidates.push({ patch, surface, component, weight: w, cumulative: totalW })
  }

  if (!candidates.length || !(totalW > 0)) {
    return {
      ok: false,
      anchors: [],
      report: {
        requested,
        accepted: 0,
        rejectedSpacing: 0,
        rejectedWeight: candidates.length ? 0 : requested,
        mode,
        totalEligibleArea: 0,
        reason: 'no eligible weighted patches',
      },
    }
  }

  const anchors = []
  let rejectedSpacing = 0
  const maxAttempts = requested * 40

  for (let attempt = 0; attempt < maxAttempts && anchors.length < requested; attempt += 1) {
    const r = rand() * totalW
    let pick = candidates[candidates.length - 1]
    for (const c of candidates) {
      if (r <= c.cumulative) {
        pick = c
        break
      }
    }
    const sample = sampleOnPatch(pick.patch, pick.component, pick.surface, rand)
    // Min spacing
    let okSpace = true
    for (const a of anchors) {
      if (dist3(a.worldPosition, sample.world) < minSpacing) {
        okSpace = false
        break
      }
    }
    if (!okSpace) {
      rejectedSpacing += 1
      continue
    }

    const created = createAnchorOnPatch(semantics, pick.patch, {
      worldPosition: sample.world,
      worldNormal: sample.frame.normal,
      seedType: 'procedural',
      allowRestricted: options.allowRestricted,
      allowedSurfaceTypes: options.allowedSurfaceTypes,
      metadata: {
        distributionMode: mode,
        randomSeed: options.randomSeed ?? 13,
      },
    })
    if (created.ok) anchors.push(created.anchor)
  }

  return {
    ok: anchors.length > 0,
    anchors,
    report: {
      requested,
      accepted: anchors.length,
      rejectedSpacing,
      rejectedWeight: 0,
      mode,
      totalEligibleArea,
      candidatePatches: candidates.length,
    },
  }
}
