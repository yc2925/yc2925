/**
 * Step 14A.1.2 — Parametric Gothic motif primitives.
 * Volute / Ribbed Spine / Secondary Curl — smooth construction curves.
 *
 * Refs: REF-017 geometric organization · REF-020 symmetrical scrolls ·
 *       REF-019 architectural crocket hierarchy · REF-018 creature morphology
 */

import {
  CURVE_ROLES,
  createCurveMember,
  normalize3,
  add3,
  scale3,
  sub3,
  cross3,
  dot3,
  dist3,
} from './types.js'
import { localToWorld, hostContainsUV } from './hostFrame.js'

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function polylineLength(pts) {
  let L = 0
  for (let i = 1; i < pts.length; i += 1) L += dist3(pts[i - 1], pts[i])
  return L
}

function meanTurn(pts) {
  if (pts.length < 3) return 0
  let sum = 0
  let n = 0
  for (let i = 2; i < pts.length; i += 1) {
    const v1 = sub3(pts[i - 1], pts[i - 2])
    const v2 = sub3(pts[i], pts[i - 1])
    const n1 = Math.hypot(v1[0], v1[1], v1[2]) || 1
    const n2 = Math.hypot(v2[0], v2[1], v2[2]) || 1
    const c = clamp01((v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (n1 * n2))
    // use acos of clamped dot — allow negative for turns
    const d = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (n1 * n2)))
    sum += Math.acos(d)
    n += 1
    void c
  }
  return n ? sum / n : 0
}

/**
 * Attach UV samples to world + validate host fit.
 */
function sampleLocalPolyline(host, uvSamples, options = {}) {
  const margin = options.clearance ?? host.clearance ?? 0.04
  const points = []
  const localPts = []
  let invalid = 0
  let firstInvalid = null

  for (const s of uvSamples) {
    const ok = hostContainsUV(host, s.u, s.v, margin * 0.35)
    const world = localToWorld(host.origin, host.axisU, host.axisV, host.normal, s.u, s.v, 0.025)
    if (!ok) {
      invalid += 1
      if (!firstInvalid) firstInvalid = { u: s.u, v: s.v, world }
      if (options.stopOnInvalid) break
      continue
    }
    points.push(world)
    localPts.push([s.u, s.v])
  }

  const valid = points.length >= 3 && invalid / Math.max(1, uvSamples.length) < 0.45
  return {
    points,
    localPts,
    length: polylineLength(points),
    meanTurn: meanTurn(points),
    valid,
    invalidReason: valid ? null : firstInvalid ? 'BOUNDARY' : 'SPARSE',
    invalidCount: invalid,
  }
}

/**
 * A. Gothic Volute — smooth Archimedean / logarithmic scroll in host UV.
 */
export function buildGothicVolute(host, params = {}) {
  const outerRadius = Math.max(0.04, params.outerRadius ?? 0.35)
  const innerRadius = Math.max(0.01, Math.min(outerRadius * 0.95, params.innerRadius ?? outerRadius * 0.18))
  const turns = Math.max(0.35, params.turns ?? 1.25)
  const tightness = clamp01(params.tightness ?? 0.75)
  const taper = clamp01(params.taper ?? 0.55)
  const orientation = params.orientation ?? 1 // +1 / -1 wind
  const startAngle = params.startAngle ?? 0
  const centerU = params.centerU ?? 0
  const centerV = params.centerV ?? 0
  const samples = Math.max(16, Math.floor(params.samples ?? 48))
  const creature = clamp01(params.creatureInfluence ?? 0)

  const uv = []
  const controls = []
  for (let i = 0; i < samples; i += 1) {
    const t = i / (samples - 1)
    // Ease outward→inward spiral
    const wind = orientation * turns * Math.PI * 2 * Math.pow(t, lerp(0.85, 1.15, 1 - tightness))
    const theta = startAngle + wind
    const radius =
      lerp(outerRadius, innerRadius, Math.pow(t, lerp(0.7, 1.4, taper))) *
      (1 + creature * 0.08 * Math.sin(theta * 3.1))
    const u = centerU + Math.cos(theta) * radius
    const v = centerV + Math.sin(theta) * radius
    uv.push({ u, v, t })
    if (i === 0 || i === samples - 1 || i % Math.floor(samples / 4) === 0) {
      controls.push(
        localToWorld(host.origin, host.axisU, host.axisV, host.normal, u, v, 0.03),
      )
    }
  }

  const sampled = sampleLocalPolyline(host, uv, {
    clearance: params.clearance ?? host.clearance,
    stopOnInvalid: false,
  })

  return createCurveMember({
    id: params.id ?? 'volute',
    role: params.role ?? CURVE_ROLES.PRIMARY_VOLUTE,
    parentId: params.parentId ?? null,
    hierarchy: params.hierarchy ?? 1,
    points: sampled.points,
    controlPoints: controls,
    length: sampled.length,
    valid: sampled.valid,
    invalidReason: sampled.invalidReason,
    hostId: host.id,
    mirrorOf: params.mirrorOf ?? null,
    attachmentT: params.attachmentT ?? null,
    meta: {
      kind: 'GOTHIC_VOLUTE',
      outerRadius,
      innerRadius,
      turns,
      tightness,
      meanTurn: sampled.meanTurn,
      localEnd: uv[uv.length - 1],
      localStart: uv[0],
      endTangentUV: tangentUV(uv),
    },
  })
}

function tangentUV(uv) {
  if (uv.length < 2) return { u: 1, v: 0 }
  const a = uv[uv.length - 2]
  const b = uv[uv.length - 1]
  const du = b.u - a.u
  const dv = b.v - a.v
  const L = Math.hypot(du, dv) || 1
  return { u: du / L, v: dv / L }
}

/**
 * B. Ribbed Spine — primary ornamental axis with mild curvature + rib marks.
 */
export function buildRibbedSpine(host, params = {}) {
  const length = Math.max(0.15, params.length ?? host.height * 0.75)
  const curvature = clamp01(params.curvature ?? 0.35)
  const taper = clamp01(params.taper ?? 0.2)
  const ribSpacing = Math.max(0.06, params.ribSpacing ?? 0.14)
  const baseU = params.baseU ?? 0
  const baseV = params.baseV ?? host.area.vMin + 0.04
  const tipU = params.tipU ?? baseU + curvature * length * 0.22 * (params.side ?? 0)
  const tipV = params.tipV ?? baseV + length
  const samples = Math.max(12, Math.floor(params.samples ?? 36))
  const creature = clamp01(params.creatureInfluence ?? 0)

  // Quadratic Bezier through mid control for smooth curvature
  const midU = lerp(baseU, tipU, 0.5) + curvature * length * 0.28
  const midV = lerp(baseV, tipV, 0.5)
  const uv = []
  for (let i = 0; i < samples; i += 1) {
    const t = i / (samples - 1)
    const omt = 1 - t
    let u = omt * omt * baseU + 2 * omt * t * midU + t * t * tipU
    let v = omt * omt * baseV + 2 * omt * t * midV + t * t * tipV
    // Creature: gentle S-warp, not noise
    u += Math.sin(t * Math.PI) * creature * length * 0.06
    v += Math.sin(t * Math.PI * 2) * creature * length * 0.015 * taper
    uv.push({ u, v, t })
  }

  const sampled = sampleLocalPolyline(host, uv, {
    clearance: params.clearance ?? host.clearance,
  })

  // Rib marks — short perpendicular ticks along the spine
  const ribs = []
  const ribCount = Math.max(0, Math.floor(sampled.length / ribSpacing) - 1)
  for (let r = 1; r <= ribCount; r += 1) {
    const t = r / (ribCount + 1)
    const idx = Math.min(uv.length - 2, Math.floor(t * (uv.length - 1)))
    const a = uv[idx]
    const b = uv[idx + 1]
    const du = b.u - a.u
    const dv = b.v - a.v
    const L = Math.hypot(du, dv) || 1
    const pu = -dv / L
    const pv = du / L
    const ribLen = lerp(0.035, 0.018, t) * (1 - taper * 0.4)
    const cu = a.u
    const cv = a.v
    const ribUV = [
      { u: cu - pu * ribLen, v: cv - pv * ribLen },
      { u: cu + pu * ribLen, v: cv + pv * ribLen },
    ]
    const ribSample = sampleLocalPolyline(host, ribUV, { clearance: 0 })
    if (ribSample.points.length >= 2) {
      ribs.push(
        createCurveMember({
          id: `${params.id ?? 'spine'}-rib-${r}`,
          role: CURVE_ROLES.RIB_MARK,
          parentId: params.id ?? 'spine',
          hierarchy: 0,
          points: ribSample.points,
          length: ribSample.length,
          valid: true,
          hostId: host.id,
        }),
      )
    }
  }

  const spine = createCurveMember({
    id: params.id ?? 'spine',
    role: CURVE_ROLES.PRIMARY_SPINE,
    parentId: null,
    hierarchy: 0,
    points: sampled.points,
    controlPoints: [
      localToWorld(host.origin, host.axisU, host.axisV, host.normal, baseU, baseV, 0.03),
      localToWorld(host.origin, host.axisU, host.axisV, host.normal, midU, midV, 0.03),
      localToWorld(host.origin, host.axisU, host.axisV, host.normal, tipU, tipV, 0.03),
    ],
    length: sampled.length,
    valid: sampled.valid,
    invalidReason: sampled.invalidReason,
    hostId: host.id,
    meta: {
      kind: 'RIBBED_SPINE',
      length,
      curvature,
      meanTurn: sampled.meanTurn,
      uv,
      attachmentSlots: [0.35, 0.55, 0.75].map((t) => {
        const idx = Math.min(uv.length - 1, Math.floor(t * (uv.length - 1)))
        return { t, ...uv[idx], tangent: tangentUV(uv.slice(0, idx + 1)) }
      }),
    },
  })

  return { spine, ribs }
}

/**
 * C. Secondary Curl — smaller volute with tangent continuity at attachment.
 */
export function buildSecondaryCurl(host, params = {}) {
  const attachU = params.attachU ?? 0
  const attachV = params.attachV ?? 0
  const tangent = params.tangentUV ?? { u: 0, v: 1 }
  const branchAngle = params.branchAngle ?? 0.9 // radians from tangent
  const side = params.side ?? 1
  const scale = Math.max(0.08, params.scale ?? 0.2)
  const turns = Math.max(0.4, params.turns ?? 0.9)
  const creature = clamp01(params.creatureInfluence ?? 0)

  // Rotate tangent by branchAngle for initial volute orientation
  const cos = Math.cos(side * branchAngle)
  const sin = Math.sin(side * branchAngle)
  const dirU = tangent.u * cos - tangent.v * sin
  const dirV = tangent.u * sin + tangent.v * cos
  const startAngle = Math.atan2(dirV, dirU)

  // Offset center so the volute starts near the attachment with continuous entry
  const centerU = attachU + dirU * scale * 0.55
  const centerV = attachV + dirV * scale * 0.55

  const volute = buildGothicVolute(host, {
    id: params.id ?? 'sec-curl',
    role: params.role ?? CURVE_ROLES.SECONDARY_CURL,
    parentId: params.parentId ?? null,
    hierarchy: params.hierarchy ?? 2,
    outerRadius: scale,
    innerRadius: scale * lerp(0.12, 0.28, creature),
    turns,
    tightness: params.tightness ?? 0.8,
    taper: 0.6,
    orientation: side,
    startAngle,
    centerU,
    centerV,
    samples: params.samples ?? 36,
    creatureInfluence: creature,
    clearance: params.clearance ?? host.clearance,
    attachmentT: params.attachmentT ?? null,
    mirrorOf: params.mirrorOf ?? null,
  })

  // Prepend attachment point for continuity
  const attachWorld = localToWorld(
    host.origin,
    host.axisU,
    host.axisV,
    host.normal,
    attachU,
    attachV,
    0.025,
  )
  if (volute.points.length && dist3(volute.points[0], attachWorld) > 1e-4) {
    volute.points = [attachWorld, ...volute.points]
    volute.length = polylineLength(volute.points)
  }

  return volute
}

/**
 * Exact local bilateral mirror of a curve across host symmetry axis (V through origin).
 */
export function mirrorCurveLocal(host, curve, idSuffix = '-m') {
  if (!curve?.points?.length) return null
  const mirrored = curve.points.map((p) => {
    const d = sub3(p, host.symmetryOrigin)
    const along = scale3(host.symmetryAxis, dot3(d, host.symmetryAxis))
    const perp = sub3(d, along)
    return add3(host.symmetryOrigin, sub3(along, perp))
  })
  // Re-project slightly along normal for front bias
  const points = mirrored.map((p) => add3(p, scale3(host.normal, 0.002)))
  return createCurveMember({
    id: `${curve.id}${idSuffix}`,
    role: CURVE_ROLES.MIRROR,
    parentId: curve.parentId,
    hierarchy: curve.hierarchy,
    points,
    controlPoints: (curve.controlPoints ?? []).map((p) => {
      const d = sub3(p, host.symmetryOrigin)
      const along = scale3(host.symmetryAxis, dot3(d, host.symmetryAxis))
      const perp = sub3(d, along)
      return add3(host.symmetryOrigin, sub3(along, perp))
    }),
    length: polylineLength(points),
    valid: curve.valid,
    invalidReason: curve.invalidReason,
    hostId: host.id,
    mirrorOf: curve.id,
    attachmentT: curve.attachmentT,
  })
}

export function validateCurveContinuity(curve, maxMeanTurn = 0.75) {
  if (!curve?.points || curve.points.length < 3) {
    return { ok: false, reason: 'too-few-points', meanTurn: 0 }
  }
  const mt = meanTurn(curve.points)
  return { ok: mt <= maxMeanTurn, reason: mt > maxMeanTurn ? 'sharp-turns' : null, meanTurn: mt }
}

export { polylineLength, meanTurn }
