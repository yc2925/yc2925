/**
 * Architectural feature extraction for Ornament System.
 *
 * Prefer semantic curve-graph data from the Gothic window design over
 * mesh-triangle inference. Interface is typology-agnostic for later
 * Portal / Façade support.
 */

import { V } from '../gothic/primitives.js'
import { sampleCenterline3d, curveRole, centerlineZ } from '../gothic/typologies/windowSolid3d.js'

const clamp01 = (v) => Math.min(1, Math.max(0, v))

function polylineLength(pts) {
  let len = 0
  for (let i = 1; i < pts.length; i += 1) {
    len += pts[i].distanceTo(pts[i - 1])
  }
  return len
}

function tangentAt(pts, index) {
  if (pts.length < 2) return V(0, 1, 0)
  const i0 = Math.max(0, index - 1)
  const i1 = Math.min(pts.length - 1, index + 1)
  const t = pts[i1].clone().sub(pts[i0])
  if (t.lengthSq() < 1e-12) return V(0, 1, 0)
  return t.normalize()
}

/**
 * Curves whose endpoints meet a junction — outgoing directions for path choice later.
 */
export function outgoingCurvesAt(junctionPos, curves, tol = 0.1) {
  const tol2 = tol * tol
  const out = []
  for (const c of curves ?? []) {
    const pts = c.points
    if (!pts || pts.length < 2) continue
    const start = pts[0]
    const end = pts[pts.length - 1]
    if (start.distanceToSquared(junctionPos) <= tol2) {
      const dir = pts[1].clone().sub(start)
      if (dir.lengthSq() > 1e-12) {
        out.push({
          curveId: c.id,
          featureType: c.featureType,
          direction: dir.normalize(),
          end: 'start',
        })
      }
    }
    if (end.distanceToSquared(junctionPos) <= tol2) {
      const dir = pts[pts.length - 2].clone().sub(end)
      if (dir.lengthSq() > 1e-12) {
        out.push({
          curveId: c.id,
          featureType: c.featureType,
          direction: dir.normalize(),
          end: 'end',
        })
      }
    }
  }
  return out
}

/**
 * Inspect whether closed planar openings can be derived from the curve graph.
 * Returns a structured assessment — does not invent polygons.
 */
export function assessOpeningExtraction(design) {
  const curves = design?.curves ?? []
  const closedLoops = curves.filter(
    (c) =>
      c.kind === 'arc' &&
      c.a0 != null &&
      c.a1 != null &&
      Math.abs(Math.abs(c.a1 - c.a0) - Math.PI * 2) < 0.08,
  )
  const openPolylines = curves.filter((c) => c.kind === 'line' || c.kind === 'bezier' || (c.kind === 'arc' && !closedLoops.includes(c)))
  // Lancet lights are bounded by combinations of mullions + lancet arcs + impost —
  // not encoded as single closed rings. A full planar-map face extraction would be needed.
  const feasible = false
  return {
    feasible,
    closedLoopCount: closedLoops.length,
    openPolylineCount: openPolylines.length,
    reason:
      'Window lights are regions bounded by multiple open curves (mullions, lancets, impost, connectors), not single closed polygons. Closed arcs (e.g. head-circle) exist but do not alone define the empty lights. Reliable point-in-opening needs a planar arrangement / face tracer, which is deferred.',
  }
}

/**
 * Extract a unified feature graph from a Gothic specimen.
 */
export function extractArchFeatures(specimen) {
  const typology = specimen?.meta?.typology ?? specimen?.typology?.id ?? 'unknown'
  if (typology === 'window' || specimen?.meta?.design2d) {
    return extractWindowFeatures(specimen)
  }
  return {
    typology,
    curves: [],
    junctions: [],
    openings: [],
    bounds: specimen?.bounds ?? null,
    layout: null,
    openingAssessment: { feasible: false, reason: 'Typology not supported in Step 7.' },
    limitations: [
      'Opening polygons and feature extraction for this typology are not implemented in Step 7.',
    ],
  }
}

function extractWindowFeatures(specimen) {
  const design = specimen.meta?.design2d
  const skeleton = specimen.meta?.skeleton ?? []
  const skelById = Object.fromEntries(skeleton.map((e) => [e.id, e]))
  const layout = design?.layout
  const res = specimen.meta?.solid?.detailResolution ?? 0.55
  const depth = specimen.meta?.solid?.architecturalDepth ?? 0.14
  const moldingDepth = specimen.meta?.solid?.moldingDepth ?? 0.55

  const curves = []
  for (const curve of design?.curves ?? []) {
    const role = curveRole(curve)
    const featureType =
      curve.layer === 'frame' ? 'frame' : curve.layer === 'mullion' ? 'mullion' : 'tracery'
    let points
    const sk = skelById[curve.id]
    if (sk?.points?.length >= 2) {
      points = sk.points.map((p) => p.clone())
    } else {
      const z = centerlineZ(role, depth, moldingDepth)
      points = sampleCenterline3d(curve, res, z)
    }
    if (points.length < 2) continue
    const length = polylineLength(points)
    curves.push({
      id: curve.id,
      featureType,
      layer: curve.layer,
      hierarchy: curve.hierarchy ?? curve.layer,
      parent: curve.parent ?? null,
      kind: curve.kind,
      points,
      length,
      orientation: V(0, 0, 1),
    })
  }

  const junctions = (design?.junctions ?? []).map((j) => {
    let z = 0
    const skHit = skeleton.find((e) => e.layer === 'secondary' || e.layer === 'mullion')
    if (skHit?.points?.[0]) z = skHit.points[0].z
    const position = V(j.x, j.y, z)
    return {
      id: j.id,
      featureType: 'junction',
      position,
      parent: j.parent ?? null,
      outgoing: outgoingCurvesAt(position, curves, 0.12),
    }
  })

  const openingAssessment = assessOpeningExtraction(design)
  const openings = [] // do not fabricate
  const limitations = [
    openingAssessment.reason,
    'Anchors remain curve-constrained on stone centerlines and junctions.',
    'isInOpening() returns false until a planar face tracer exists (Step 8+).',
  ]

  const y0 = layout?.sill ?? 0
  const y1 = layout?.apex ?? layout?.H ?? 1
  const half = layout?.half ?? 1.5

  return {
    typology: 'window',
    curves,
    junctions,
    openings,
    openingAssessment,
    bounds: {
      min: V(-half, y0, -0.3),
      max: V(half, y1, 0.3),
      y0,
      y1,
      half,
    },
    layout,
    family: layout?.family ?? specimen.meta?.family,
    seed: layout?.seed ?? specimen.meta?.design2d?.layout?.seed,
    limitations,
    stats: {
      curveCount: curves.length,
      junctionCount: junctions.length,
      frameCount: curves.filter((c) => c.featureType === 'frame').length,
      mullionCount: curves.filter((c) => c.featureType === 'mullion').length,
      traceryCount: curves.filter((c) => c.featureType === 'tracery').length,
      totalLength: curves.reduce((n, c) => n + c.length, 0),
    },
  }
}

/** Future particle helper: true if a world point lies in an empty opening. */
export function isInOpening(_point, archFeatures) {
  if (!archFeatures?.openings?.length) return false
  return false
}

/** True if a point is within `tol` of any stone centerline or junction. */
export function isOnStone(point, archFeatures, tol = 0.08) {
  const tol2 = tol * tol
  for (const j of archFeatures.junctions ?? []) {
    if (point.distanceToSquared(j.position) <= tol2) return true
  }
  for (const c of archFeatures.curves ?? []) {
    const pts = c.points
    for (let i = 0; i < pts.length - 1; i += 1) {
      const d2 = distPointSegmentSq(point, pts[i], pts[i + 1])
      if (d2 <= tol2) return true
    }
  }
  return false
}

function distPointSegmentSq(p, a, b) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const len2 = abx * abx + aby * aby + abz * abz
  let t = len2 > 1e-12 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len2 : 0
  t = clamp01(t)
  const dx = p.x - (a.x + abx * t)
  const dy = p.y - (a.y + aby * t)
  const dz = p.z - (a.z + abz * t)
  return dx * dx + dy * dy + dz * dz
}

export { polylineLength, tangentAt, clamp01 }
