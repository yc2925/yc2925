/**
 * Close pointed-arch curves into ordered opening / frame loops (Step 13C.1).
 *
 * INTERPRETATION (documented):
 * Step 13B/13C pointed-arch arcs are treated as *clear opening edges*
 * (inner face of the surrounding stone), not bar centerlines.
 * Outer frame thickness is applied by rebuilding a larger parent arch
 * (span + 2·outerFrameWidth) with the same family / rise rules — not by
 * silently offsetting a centerline into a finished edge.
 */

import { point } from '../kernel/vector2.js'
import { createSegment } from '../kernel/line2.js'
import { reverseArc, startPoint, endPoint } from '../kernel/arc2.js'
import {
  validateClosure,
  detectSelfIntersections,
  signedArea,
  windingOrientation,
  loopPolyline,
  createPlanarRegion,
} from '../kernel/planarRegions.js'
import { ARCH_SEMANTICS } from '../primitives/archFamilies.js'
import { buildPointedArch } from '../primitives/pointedArch.js'

/**
 * Reverse segment a→b becomes b→a.
 */
export function reverseSegment(seg) {
  return createSegment(seg.b, seg.a)
}

/**
 * Reverse an ordered edge list (arcs / segments) for opposite winding.
 */
export function reverseEdges(edges) {
  const out = []
  for (let i = edges.length - 1; i >= 0; i -= 1) {
    const e = edges[i]
    if (e.type === 'arc' || e.sweepAngle != null) out.push(reverseArc(e))
    else if (e.a && e.b) out.push(reverseSegment(e))
    else throw new Error('reverseEdges: unknown edge')
  }
  return out
}

/**
 * Ensure positive (CCW) signed area by reversing if needed.
 */
export function ensureCcw(edges, sampleOpts) {
  const a = signedArea(edges, sampleOpts)
  if (a >= 0) return { edges, flipped: false, signedArea: a }
  const rev = reverseEdges(edges)
  return { edges: rev, flipped: true, signedArea: signedArea(rev, sampleOpts) }
}

/**
 * Ensure negative (CW) signed area — typical hole winding for Shape holes.
 */
export function ensureCw(edges, sampleOpts) {
  const a = signedArea(edges, sampleOpts)
  if (a <= 0) return { edges, flipped: false, signedArea: a }
  const rev = reverseEdges(edges)
  return { edges: rev, flipped: true, signedArea: signedArea(rev, sampleOpts) }
}

/**
 * Build a closed clear-opening loop from a pointed arch:
 * left jamb (base→left springing) → left arc → right arc → right jamb (down) → sill.
 *
 * Loop order is CCW when y increases upward (standard screen math with +Y up).
 *
 * @param {object} arch — buildPointedArch result
 * @param {number} baseY — sill elevation
 */
export function closedLoopFromArch(arch, baseY) {
  if (!arch?.validation?.ok) {
    return { ok: false, errors: arch?.validation?.errors ?? ['invalid arch'], edges: [] }
  }
  const A = arch.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const B = arch.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const leftArc = arch.arcs[ARCH_SEMANTICS.LEFT_ARC]
  const rightArc = arch.arcs[ARCH_SEMANTICS.RIGHT_ARC]
  if (!A || !B || !leftArc || !rightArc) {
    return { ok: false, errors: ['missing arch primitives'], edges: [] }
  }
  if (!(baseY < A.y - 1e-9)) {
    return {
      ok: false,
      errors: [`windowBaseElevation (${baseY}) must be below springing (${A.y})`],
      edges: [],
    }
  }

  const bl = point(A.x, baseY)
  const br = point(B.x, baseY)

  // CCW: sill L→R, right jamb up, then we need arcs from B→P→A (reversed), left jamb down
  // Simpler CCW with +Y up: start BL → left jamb up → left arc A→P → right arc P→B → right jamb down → sill B←BL
  // Wait: left jamb BL→A, left arc A→P, right arc P→B, right jamb B→BR, sill BR→BL (right to left = negative x)
  const leftJamb = createSegment(bl, A)
  const rightJamb = createSegment(B, br)
  const sill = createSegment(br, bl)

  const edges = [leftJamb, leftArc, rightArc, rightJamb, sill]
  const scale = Math.max(1, arch.parameters.span, Math.abs(A.y - baseY))
  const closure = validateClosure(edges, scale)
  const self = detectSelfIntersections(edges, { segments: 18 })
  const sampleOpts = { segments: 20 }
  const oriented = ensureCcw(edges, sampleOpts)

  const errors = []
  if (!closure.ok) errors.push(`arch loop not closed: ${closure.reason}`)
  if (self.selfIntersecting) errors.push('arch loop self-intersects')

  // Endpoint checks
  if (Math.hypot(endPoint(leftArc).x - startPoint(rightArc).x, endPoint(leftArc).y - startPoint(rightArc).y) > 1e-6) {
    errors.push('arch apex join broken in loop')
  }

  return {
    ok: errors.length === 0,
    errors,
    edges: oriented.edges,
    signedArea: oriented.signedArea,
    orientation: windingOrientation(oriented.edges, sampleOpts),
    closure,
    selfIntersection: self,
    arch,
    baseY,
    corners: { bl, br, A, B },
  }
}

/**
 * Outer frame loop: rebuild parent with span' = span + 2·frameWidth (same family rules).
 */
export function buildOuterBoundaryLoop(parentParams, outerFrameWidth, baseY) {
  const f = Math.max(0, outerFrameWidth)
  const outerArch = buildPointedArch({
    ...parentParams,
    span: parentParams.span + 2 * f,
    offsetX: parentParams.offsetX ?? 0,
  })
  if (!outerArch.validation?.ok) {
    return {
      ok: false,
      errors: outerArch.validation?.errors ?? ['outer arch invalid'],
      edges: [],
      arch: outerArch,
    }
  }
  const loop = closedLoopFromArch(outerArch, baseY)
  return {
    ...loop,
    arch: outerArch,
    frameWidth: f,
    clearSpan: parentParams.span,
  }
}

/**
 * Sample a loop to a Three.js-friendly polyline (closed: first≠last; caller may close).
 */
export function sampleLoop(edges, sampleOpts = { segments: 28 }) {
  return loopPolyline(edges, sampleOpts)
}

/**
 * Absolute area of a closed edge loop.
 */
export function loopArea(edges, sampleOpts) {
  return Math.abs(signedArea(edges, sampleOpts))
}

/**
 * Build a planar region from exact outer + hole edge lists.
 */
export function regionFromLoops(outerEdges, holeEdgeLists, opts = {}) {
  const holes = holeEdgeLists.map((h) => ensureCw(h, opts).edges)
  const outer = ensureCcw(outerEdges, opts).edges
  return createPlanarRegion(outer, holes, opts)
}

export { startPoint, endPoint }
