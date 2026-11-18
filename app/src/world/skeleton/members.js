/**
 * Curve → structural member skeleton (Step 47, round 2).
 *
 * 1. The drawn curve (links resolved) is evaluated and resampled every
 *    ~0.5 m; that polyline IS the main member — it follows the exact path.
 * 2. Radius profile: thickness × role radius, tapering from the base end
 *    (the lower endpoint for columns / buttresses, the start otherwise).
 * 3. Variation: a Gothic shape grammar (grammar.js) built from exact
 *    circles, arcs, tangencies and symmetry — arch tracery, compound piers,
 *    buttress piers, tracery bands — plus carved-ornament sites (keystones,
 *    bosses, capitals, pinnacles, crockets, finials, grotesques).
 *    No L-system / branching growth.
 * 4. Joints: linked endpoints; endpoints at y ≈ 0 are ground contacts.
 * 5. Pieces: the main member is cut into ~12 m pieces and every motif is its
 *    own piece — the units the Explode control separates (REF-026).
 */

import { dist, evaluateCurve, resampleByCount, v3 } from '../curves/curve3.js'
import { DEFAULT_SKELETON_PARAMS, ROLE_RULES } from './params.js'
import { buildGrammar } from './grammar.js'

const GROUND_EPS = 0.35

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pathLength(points) {
  let L = 0
  for (let i = 1; i < points.length; i += 1) L += dist(points[i - 1], points[i])
  return L
}

export function buildCurveSkeleton(curve, resolvedPoints, inputParams = {}, seed = 1, links = {}) {
  const P = { ...DEFAULT_SKELETON_PARAMS, ...inputParams }
  const role = ROLE_RULES[curve.curveRole] ?? ROLE_RULES.rib
  const rand = mulberry32((seed * 2654435761) >>> 0)
  const result = {
    kind: 'curveMember',
    role: curve.curveRole ?? 'rib',
    sourceCurveId: curve.curveId,
    members: [],
    ornaments: [],
    construction: [],
    joints: [],
    groundContacts: [],
    sourcePolyline: [],
    stats: {},
    warnings: [],
  }
  const dense = evaluateCurve({ ...curve, controlPoints: resolvedPoints })
  result.sourcePolyline = dense.points
  if (dense.points.length < 2 || dense.length < 0.5) {
    result.warnings.push('Curve needs at least 2 points.')
    result.bounds = null
    return result
  }

  let points = resampleByCount(dense.points, Math.max(3, Math.ceil(dense.length / 0.5) + 1))
  // Base end: lower endpoint for supports, otherwise the curve start.
  const baseAtEnd = (result.role === 'column' || result.role === 'buttress') && points[points.length - 1].y < points[0].y - 0.01
  if (baseAtEnd) points = points.slice().reverse()
  const L = pathLength(points)
  const r0 = P.thickness * role.radius
  // Supports taper from their base; arches and bands from both springings toward the crown.
  const supports = result.role === 'column' || result.role === 'buttress'
  const radii = points.map((_, i) => {
    const u = i / (points.length - 1)
    return r0 * (1 - P.taper * (supports ? u : 1 - Math.abs(2 * u - 1)))
  })

  let seq = 0
  const addMember = (kind, depth, pts, rad, parent, piece) => {
    const id = `m${seq++}`
    result.members.push({ id, kind, depth, points: pts, radii: rad, parent, piece })
    return id
  }

  // Main member, cut into ~12 m pieces for explode.
  const pieceLen = 12
  const pieceCount = Math.max(1, Math.round(L / pieceLen))
  const per = Math.ceil((points.length - 1) / pieceCount)
  const mainIds = []
  for (let k = 0; k < pieceCount; k += 1) {
    const a = k * per
    const b = Math.min(points.length - 1, (k + 1) * per)
    if (b <= a) continue
    mainIds.push(addMember('main', 0, points.slice(a, b + 1), radii.slice(a, b + 1), null, `main${k}`))
  }

  // ---- Gothic shape grammar (exact construction, see grammar.js)
  const baseLink = baseAtEnd ? links.end : links.start
  const topLink = baseAtEnd ? links.start : links.end
  const baseLinked = Boolean(baseLink)
  const topLinked = Boolean(topLink)
  const g = buildGrammar({ role: result.role, points, radii, P, rand, baseLinked, topLinked, baseOut: baseLinked && !baseLink.incoming, topOut: topLinked && !topLink.incoming })
  for (const m of g.members) result.members.push({ ...m, parent: mainIds[0] })
  result.ornaments = g.ornaments
  result.construction = g.construction
  result.style = g.style
  result.archFrame = g.archFrame
  for (const m of g.members) {
    const tip = m.points[m.points.length - 1]
    if (m.kind === 'pier' && m.points[0].y <= GROUND_EPS) result.groundContacts.push({ p: m.points[0], r: m.radii[0] })
    if (m.kind === 'mullion' && tip.y <= GROUND_EPS) result.groundContacts.push({ p: tip, r: m.radii[0] * 1.5 })
  }

  // ---- joints + ground contacts of the main member
  const ends = [
    { p: points[0], r: radii[0], linked: baseLinked && !baseLink.incoming },
    { p: points[points.length - 1], r: radii[radii.length - 1], linked: topLinked && !topLink.incoming },
  ]
  for (const e of ends) {
    if (e.linked && P.jointSize > 0) result.joints.push({ p: e.p, r: Math.max(e.r, P.thickness) * P.jointSize })
    if (e.p.y <= GROUND_EPS) result.groundContacts.push({ p: e.p, r: e.r })
  }
  // Long runs along the ground count as footings (coursed walls).
  result.groundRun = points.filter((p) => p.y <= GROUND_EPS).length / points.length

  result.stats = {
    length: L,
    members: result.members.length,
    motifs: g.motifs,
    ornaments: result.ornaments.length,
    style: g.style,
    maxDepth: result.members.reduce((d, m) => Math.max(d, m.depth), 0),
    maxResidual: result.construction.reduce((d, c) => Math.max(d, c.residual), 0),
    joints: result.joints.length,
    groundContacts: result.groundContacts.length,
  }
  result.bounds = skeletonBounds(result)
  return result
}

export function skeletonBounds(skeleton) {
  const min = v3(Infinity, Infinity, Infinity)
  const max = v3(-Infinity, -Infinity, -Infinity)
  for (const m of skeleton.members) {
    m.points.forEach((p, i) => {
      const r = m.radii[i]
      min.x = Math.min(min.x, p.x - r)
      min.y = Math.min(min.y, p.y - r)
      min.z = Math.min(min.z, p.z - r)
      max.x = Math.max(max.x, p.x + r)
      max.y = Math.max(max.y, p.y + r)
      max.z = Math.max(max.z, p.z + r)
    })
  }
  return Number.isFinite(min.x) ? { min, max } : null
}

/** Finite, no zero segments, nothing below ground, every tangency solved exactly. */
export function validateSkeleton(skeleton) {
  const errors = []
  for (const m of skeleton.members) {
    for (const p of m.points) if (![p.x, p.y, p.z].every(Number.isFinite)) errors.push(`${m.id}: non-finite`)
    for (let i = 1; i < m.points.length; i += 1) if (dist(m.points[i - 1], m.points[i]) < 1e-7) errors.push(`${m.id}: zero segment`)
    for (const p of m.points) if (p.y < -1e-6) errors.push(`${m.id}: below ground`)
    if (m.points.length !== m.radii.length) errors.push(`${m.id}: radii mismatch`)
  }
  for (const c of skeleton.construction ?? []) if (!(c.residual < 1e-6)) errors.push(`${c.type}: tangency residual ${c.residual}`)
  for (const o of skeleton.ornaments ?? []) if (![o.p.x, o.p.y, o.p.z, o.size].every(Number.isFinite)) errors.push(`${o.type}: non-finite ornament`)
  return { valid: errors.length === 0, errors }
}
