/**
 * Clearance / minimum web-width checks for solid-void tracery (Step 13C.1).
 * Warnings only — does not auto-rewrite user parameters.
 */

import { distance, point } from '../kernel/vector2.js'
import { ARCH_SEMANTICS } from '../primitives/archFamilies.js'
import { archHeightAtX, pointInsideArchOpening } from './archContainment.js'
import { sampleLoop } from './openingLoops.js'

/**
 * Minimum distance from foil samples to parent clear arch upper boundary.
 */
export function foilToParentClearance(foil, parentArch, samples = 36) {
  if (!foil?.samples?.length || !parentArch) return { ok: false, min: 0, unavailable: true }
  let min = Infinity
  const step = Math.max(1, Math.floor(foil.samples.length / samples))
  for (let i = 0; i < foil.samples.length; i += step) {
    const p = foil.samples[i]
    const yArch = archHeightAtX(parentArch, p.x)
    if (yArch == null) {
      min = 0
      break
    }
    min = Math.min(min, yArch - p.y)
  }
  for (const c of foil.cusps ?? []) {
    const yArch = archHeightAtX(parentArch, c.x)
    if (yArch != null) min = Math.min(min, yArch - c.y)
  }
  return { ok: Number.isFinite(min) && min > 0, min: Number.isFinite(min) ? min : 0 }
}

/**
 * Vertical stone above lancet apices before foil / residual (meters).
 */
export function stoneAboveLancets(leftChild, rightChild, foil) {
  const la = leftChild?.points?.[ARCH_SEMANTICS.APEX]
  const ra = rightChild?.points?.[ARCH_SEMANTICS.APEX]
  if (!la || !ra) return { ok: false, min: 0, unavailable: true }
  const apexY = Math.max(la.y, ra.y)
  if (!foil?.samples?.length) return { ok: false, min: 0, unavailable: true }
  let foilBottom = Infinity
  for (const p of foil.samples) foilBottom = Math.min(foilBottom, p.y)
  for (const c of foil.cusps ?? []) foilBottom = Math.min(foilBottom, c.y)
  const min = foilBottom - apexY
  return { ok: min > 0, min }
}

/**
 * Side jamb thickness: outer clear springing to child outer springing.
 */
export function sideJambClearances(parentArch, leftChild, rightChild) {
  const pA = parentArch?.points?.[ARCH_SEMANTICS.LEFT_SPRINGING]
  const pB = parentArch?.points?.[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const lA = leftChild?.points?.[ARCH_SEMANTICS.LEFT_SPRINGING]
  const rB = rightChild?.points?.[ARCH_SEMANTICS.RIGHT_SPRINGING]
  if (!pA || !pB || !lA || !rB) {
    return { ok: false, left: 0, right: 0, unavailable: true }
  }
  const left = lA.x - pA.x
  const right = pB.x - rB.x
  return { ok: left > 0 && right > 0, left, right, min: Math.min(left, right) }
}

/**
 * Mullion clear width between child inner springings.
 */
export function measuredMullionWidth(leftChild, rightChild) {
  const lB = leftChild?.points?.[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const rA = rightChild?.points?.[ARCH_SEMANTICS.LEFT_SPRINGING]
  if (!lB || !rA) return { ok: false, width: 0, unavailable: true }
  const width = rA.x - lB.x
  return { ok: width > 0, width }
}

/**
 * Voids must not overlap: sample midpoints of each hole must not lie in another.
 */
export function voidsOverlap(voidLoops, sampleOpts = { segments: 24 }) {
  const polylines = voidLoops.map((v) => sampleLoop(v.edges, sampleOpts))
  const hits = []
  for (let i = 0; i < voidLoops.length; i += 1) {
    for (let j = 0; j < voidLoops.length; j += 1) {
      if (i === j) continue
      const pts = polylines[i]
      // test a few interior-ish points (centroid of samples)
      let cx = 0
      let cy = 0
      for (const p of pts) {
        cx += p.x
        cy += p.y
      }
      cx /= pts.length
      cy /= pts.length
      if (pointInPolyline(polylines[j], { x: cx, y: cy })) {
        hits.push({ a: voidLoops[i].id, b: voidLoops[j].id, point: { x: cx, y: cy } })
      }
    }
  }
  return { ok: hits.length === 0, hits }
}

function pointInPolyline(pts, p) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i]
    const pj = pts[j]
    const intersect =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y + 0.0) + pi.x
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Opening samples must lie inside outer loop.
 */
export function openingsInsideOuter(outerEdges, voidLoops, sampleOpts = { segments: 20 }) {
  const outerPoly = sampleLoop(outerEdges, sampleOpts)
  const violations = []
  for (const v of voidLoops) {
    const pts = sampleLoop(v.edges, sampleOpts)
    const step = Math.max(1, Math.floor(pts.length / 24))
    for (let i = 0; i < pts.length; i += step) {
      if (!pointInPolyline(outerPoly, pts[i])) {
        violations.push({ voidId: v.id, point: pts[i] })
        if (violations.length > 12) break
      }
    }
  }
  return { ok: violations.length === 0, violations }
}

/**
 * Aggregate clearance report vs minStoneWebWidth.
 */
export function evaluateClearances(ctx, minWeb) {
  const warnings = []
  const errors = []
  const m = measuredMullionWidth(ctx.leftChild, ctx.rightChild)
  const jambs = sideJambClearances(ctx.parentArch, ctx.leftChild, ctx.rightChild)
  const above = stoneAboveLancets(ctx.leftChild, ctx.rightChild, ctx.foil)
  const foilClear = foilToParentClearance(ctx.foil, ctx.parentArch)

  const values = {
    mullionWidth: m.unavailable ? null : m.width,
    sideJambMin: jambs.unavailable ? null : jambs.min,
    stoneAboveLancets: above.unavailable ? null : above.min,
    foilToParent: foilClear.unavailable ? null : foilClear.min,
    minStoneWebWidth: minWeb,
  }

  const check = (name, v) => {
    if (v == null) return
    if (v < minWeb) warnings.push(`${name} ${v.toFixed(3)} m < min web ${minWeb.toFixed(3)} m`)
    if (!(v > 0)) errors.push(`${name} non-positive (${v})`)
  }

  check('mullion width', values.mullionWidth)
  check('side jamb', values.sideJambMin)
  check('stone above lancets', values.stoneAboveLancets)
  check('foil–parent clearance', values.foilToParent)

  const positives = [values.mullionWidth, values.sideJambMin, values.stoneAboveLancets, values.foilToParent].filter(
    (x) => x != null && Number.isFinite(x),
  )
  const minDetected = positives.length ? Math.min(...positives) : null

  return {
    values,
    minDetectedClearance: minDetected,
    warnings,
    errors,
    ok: errors.length === 0,
  }
}

export { pointInsideArchOpening, distance, point }
