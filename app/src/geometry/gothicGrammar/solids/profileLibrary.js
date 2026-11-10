/**
 * Parametric Gothic molding cross-sections (Step 13D).
 *
 * Local profile frame (s, t):
 *   s — outward from path into air / away from stone core (meters)
 *   t — along wall depth (aligned with world Z for planar XY paths)
 *
 * Profiles are open or closed polylines in the (s,t) plane.
 * Values are computational approximations of REF-008 / REF-012 moldings,
 * not historically surveyed dimensions.
 */

export const PROFILE_TYPES = Object.freeze({
  FLAT: 'flat',
  CHAMFERED: 'chamfered',
  ROUNDED: 'rounded',
  COMPOUND_GOTHIC: 'compound_gothic',
})

export const DEFAULT_PROFILE_PARAMS = Object.freeze({
  type: PROFILE_TYPES.COMPOUND_GOTHIC,
  profileWidth: 0.06,
  profileDepth: 0.08,
  chamferSize: 0.02,
  beadRadius: 0.012,
  recessDepth: 0.018,
})

/**
 * Validate profile dimensions — reject self-intersecting / impossible sections.
 */
export function validateProfileParams(params = {}) {
  const p = { ...DEFAULT_PROFILE_PARAMS, ...params }
  const errors = []
  const { profileWidth: w, profileDepth: d, chamferSize: c, beadRadius: r, recessDepth: rec } = p

  if (!(w > 0) || !Number.isFinite(w)) errors.push('profileWidth must be positive')
  if (!(d > 0) || !Number.isFinite(d)) errors.push('profileDepth must be positive')
  if (!(c >= 0) || !Number.isFinite(c)) errors.push('chamferSize must be ≥ 0')
  if (!(r >= 0) || !Number.isFinite(r)) errors.push('beadRadius must be ≥ 0')
  if (!(rec >= 0) || !Number.isFinite(rec)) errors.push('recessDepth must be ≥ 0')

  if (c > 0 && (c > w || c > d)) errors.push('chamferSize exceeds profile width or depth')
  if (r > 0 && (2 * r > w || 2 * r > d)) errors.push('beadRadius too large for profile')
  if (rec > 0 && rec >= d) errors.push('recessDepth must be < profileDepth')
  if (p.type === PROFILE_TYPES.COMPOUND_GOTHIC) {
    const used = c + 2 * r + rec
    if (used > d + 1e-9) errors.push('compound components exceed profileDepth')
    if (c + r > w + 1e-9) errors.push('compound components exceed profileWidth')
  }

  return { ok: errors.length === 0, errors, params: p }
}

/**
 * Sample a circular arc in the (s,t) plane.
 */
function arcPoints(cx, cy, radius, a0, a1, segs = 6) {
  const pts = []
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs
    const a = a0 + (a1 - a0) * t
    pts.push({ s: cx + radius * Math.cos(a), t: cy + radius * Math.sin(a) })
  }
  return pts
}

/**
 * Build polyline profile: array of {s, t}. Starts near path (s≈0) on front face.
 * Depth axis t runs from front (+tFront) toward back (−), matching +Z front.
 */
export function buildProfile(params = {}) {
  const { ok, errors, params: p } = validateProfileParams(params)
  if (!ok) throw new Error(`invalid profile: ${errors.join('; ')}`)

  const w = p.profileWidth
  const d = p.profileDepth
  const half = d / 2
  // Front of molding at +half, back at −half (matches centered stone depth frame locally)
  const tFront = half
  const tBack = -half

  let points
  switch (p.type) {
    case PROFILE_TYPES.FLAT:
      points = [
        { s: 0, t: tFront },
        { s: w, t: tFront },
        { s: w, t: tBack },
        { s: 0, t: tBack },
      ]
      break

    case PROFILE_TYPES.CHAMFERED: {
      const c = Math.min(p.chamferSize, w * 0.49, d * 0.49)
      points = [
        { s: 0, t: tFront },
        { s: w - c, t: tFront },
        { s: w, t: tFront - c },
        { s: w, t: tBack + c },
        { s: w - c, t: tBack },
        { s: 0, t: tBack },
      ]
      break
    }

    case PROFILE_TYPES.ROUNDED: {
      const r = Math.min(p.beadRadius || w * 0.35, w * 0.49, d * 0.49)
      // Convex bead on the outer front corner
      const arc = arcPoints(w - r, tFront - r, r, Math.PI / 2, 0, 8)
      points = [{ s: 0, t: tFront }, ...arc, { s: w, t: tBack + r }, { s: w - r, t: tBack }, { s: 0, t: tBack }]
      break
    }

    case PROFILE_TYPES.COMPOUND_GOTHIC:
    default: {
      // Computational approximation of multi-step Gothic edge (REF-008/012):
      // fillet face → chamfer → bead → recess → return.
      const c = Math.min(p.chamferSize, w * 0.4, d * 0.25)
      const r = Math.min(p.beadRadius, w * 0.35, d * 0.2)
      const rec = Math.min(p.recessDepth, d * 0.35)
      const sBead = Math.min(w * 0.55, w - r)
      const tBead = tFront - c - r
      const bead = arcPoints(sBead, tBead, r, Math.PI / 2, 0, 8)
      points = [
        { s: 0, t: tFront },
        { s: Math.max(0, sBead - c), t: tFront },
        { s: sBead, t: tFront - c },
        ...bead,
        { s: sBead + r, t: tBead - rec },
        { s: w, t: tBead - rec },
        { s: w, t: tBack },
        { s: 0, t: tBack },
      ]
      break
    }
  }

  // Self-intersection check: consecutive segments only (open profile as strip)
  const selfIntersect = profileSelfIntersects(points)
  if (selfIntersect) {
    throw new Error('profile self-intersects — reduce chamfer/bead/recess')
  }

  return {
    type: p.type,
    params: p,
    points,
    closed: false,
    bounds: {
      sMin: Math.min(...points.map((q) => q.s)),
      sMax: Math.max(...points.map((q) => q.s)),
      tMin: Math.min(...points.map((q) => q.t)),
      tMax: Math.max(...points.map((q) => q.t)),
    },
  }
}

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q.s - p.s) * (r.t - p.t) - (q.t - p.t) * (r.s - p.s)
  const d1 = cross(a, b, c)
  const d2 = cross(a, b, d)
  const d3 = cross(c, d, a)
  const d4 = cross(c, d, b)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  return false
}

function profileSelfIntersects(pts) {
  const n = pts.length
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = i + 2; j < n - 1; j += 1) {
      if (i === 0 && j === n - 2) continue // adjacent ends of open strip ok to nearly meet
      if (segmentsIntersect(pts[i], pts[i + 1], pts[j], pts[j + 1])) return true
    }
  }
  return false
}

export function listProfileTypes() {
  return Object.values(PROFILE_TYPES).map((id) => ({
    id,
    label: id
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
  }))
}
