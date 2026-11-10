/**
 * Canonical two-centered Gothic pointed arch (Step 13B).
 *
 * Pure JS — uses gothicGrammar kernel only. No React / Three / legacy gothic.
 *
 * Construction (symmetric about x = 0):
 *   S = span, a = S/2, h = rise, y0 = springing elevation
 *   A = (−a, y0), B = (a, y0), P = (0, y0 + h)
 *   c = (h² − a²) / (2a)
 *   C_A = (c, y0),  C_B = (−c, y0)
 *   R = a + c = (h² + a²) / (2a)
 *   Left arc  A → P about C_A (minor upper sweep)
 *   Right arc P → B about C_B (minor upper sweep)
 *
 * Apex cusp is intentional — no tangent continuity required at P.
 *
 * References informing requirements: REF-008 (equilateral centers on springings),
 * REF-007 / REF-011 (pointed envelopes, springing line), REF-009 (presentation).
 */

import { point, distance, nearlyEqualPoints } from '../kernel/vector2.js'
import { createCircle } from '../kernel/circle2.js'
import { createArc, pointAt as arcPointAt, startPoint, endPoint } from '../kernel/arc2.js'
import { createSegment } from '../kernel/line2.js'
import { sampleArc } from '../kernel/sampling.js'
import { eps, nearlyEqual, nearlyZero } from '../kernel/tolerances.js'
import {
  ARCH_FAMILIES,
  ARCH_FAMILY_META,
  ARCH_SEMANTICS,
  DEFAULT_ARCH_PARAMS,
  EQUILATERAL_RISE_RATIO,
  resolveRise,
} from './archFamilies.js'
import { validatePointedArch } from './archValidation.js'

export { ARCH_SEMANTICS }

/**
 * Choose minor upper sweep from `from` → `to` about `center`.
 * Prefers |sweep| ≤ π with midpoint above the springing line.
 */
export function upperMinorSweep(center, from, to, springingY) {
  const twoPi = Math.PI * 2
  const start = Math.atan2(from.y - center.y, from.x - center.x)
  const end = Math.atan2(to.y - center.y, to.x - center.x)

  let ccw = end - start
  while (ccw <= 0) ccw += twoPi
  while (ccw > twoPi) ccw -= twoPi
  const cw = ccw - twoPi // ∈ (−2π, 0]

  const midAngle = (sweep) => start + sweep * 0.5
  const midY = (sweep) => center.y + Math.sin(midAngle(sweep)) * distance(center, from)

  const candidates = []
  if (Math.abs(ccw) <= Math.PI + 1e-12) candidates.push(ccw)
  if (Math.abs(cw) <= Math.PI + 1e-12) candidates.push(cw)
  // If both exceed π (shouldn't for valid pointed arches), still pick shorter
  if (!candidates.length) {
    candidates.push(Math.abs(ccw) <= Math.abs(cw) ? ccw : cw)
  }

  candidates.sort((a, b) => {
    const ya = midY(a)
    const yb = midY(b)
    const aUp = ya >= springingY - eps(1)
    const bUp = yb >= springingY - eps(1)
    if (aUp !== bUp) return aUp ? -1 : 1
    return Math.abs(a) - Math.abs(b)
  })

  const sweep = candidates[0]
  if (nearlyZero(sweep, 1)) {
    throw new Error('upperMinorSweep: degenerate zero sweep')
  }
  return { startAngle: start, sweepAngle: sweep }
}

/**
 * Build one pointed arch from family + parameters.
 *
 * @param {object} params
 * @param {string} [params.family]
 * @param {number} [params.span] meters
 * @param {number} [params.riseRatio] h/S (ignored when equilateral)
 * @param {number} [params.springingY] meters
 * @param {number} [params.samplingQuality] 0..1 → denser samples
 * @param {number} [params.offsetX] optional horizontal shift (compare mode)
 */
export function buildPointedArch(params = {}) {
  const family = params.family ?? DEFAULT_ARCH_PARAMS.family
  const span = params.span ?? DEFAULT_ARCH_PARAMS.span
  const springingY = params.springingY ?? DEFAULT_ARCH_PARAMS.springingY
  const samplingQuality = params.samplingQuality ?? DEFAULT_ARCH_PARAMS.samplingQuality
  const offsetX = params.offsetX ?? 0

  if (!ARCH_FAMILY_META[family]) {
    return invalidResult(family, params, [`Unknown arch family: ${family}`])
  }
  if (!(span > 0) || !Number.isFinite(span)) {
    return invalidResult(family, params, ['Span must be positive and finite'])
  }
  if (!Number.isFinite(springingY)) {
    return invalidResult(family, params, ['Springing elevation must be finite'])
  }

  let riseInfo
  try {
    riseInfo = resolveRise(family, span, params.riseRatio ?? ARCH_FAMILY_META[family].defaultRiseRatio)
  } catch (err) {
    return invalidResult(family, params, [String(err.message ?? err)])
  }

  const h = riseInfo.rise
  const a = span / 2
  const c = (h * h - a * a) / (2 * a)
  const R = (h * h + a * a) / (2 * a)

  if (!(R > 0) || !Number.isFinite(R) || !Number.isFinite(c)) {
    return invalidResult(family, params, ['Degenerate radius / center offset'])
  }

  const A = point(-a + offsetX, springingY)
  const B = point(a + offsetX, springingY)
  const P = point(0 + offsetX, springingY + h)
  const CA = point(c + offsetX, springingY)
  const CB = point(-c + offsetX, springingY)

  const leftSweep = upperMinorSweep(CA, A, P, springingY)
  const rightSweep = upperMinorSweep(CB, P, B, springingY)

  const leftArc = createArc(CA, R, leftSweep.startAngle, leftSweep.sweepAngle)
  const rightArc = createArc(CB, R, rightSweep.startAngle, rightSweep.sweepAngle)

  const leftCircle = createCircle(CA, R)
  const rightCircle = createCircle(CB, R)
  const symmetryAxis = createSegment(point(offsetX, springingY - 0.15), point(offsetX, springingY + h + 0.25))

  const residuals = {
    leftSpringing: Math.abs(distance(CA, A) - R),
    leftApex: Math.abs(distance(CA, P) - R),
    rightSpringing: Math.abs(distance(CB, B) - R),
    rightApex: Math.abs(distance(CB, P) - R),
    apexJoin: distance(endPoint(leftArc), startPoint(rightArc)),
    symmetryA: Math.abs(A.x + B.x - 2 * offsetX),
    symmetryCenters: Math.abs(CA.x + CB.x - 2 * offsetX),
  }

  const quality = Math.min(1, Math.max(0, samplingQuality))
  const maxAngularStep = Math.PI / (12 + quality * 36)
  const maxChordError = Math.max(0.008, span * (0.02 - quality * 0.012))
  const sampleOpts = { maxAngularStep, maxChordError }

  const leftSamples = sampleArc(leftArc, sampleOpts)
  const rightSamples = sampleArc(rightArc, sampleOpts)

  const result = {
    type: 'pointedArch',
    family,
    parameters: {
      family,
      span,
      riseRatio: riseInfo.riseRatio,
      rise: h,
      springingY,
      samplingQuality: quality,
      offsetX,
      riseLocked: riseInfo.locked,
    },
    derived: {
      halfSpan: a,
      centerOffset: c,
      radius: R,
      equilateralRiseRatio: EQUILATERAL_RISE_RATIO,
      equilateralRise: EQUILATERAL_RISE_RATIO * span,
    },
    points: {
      [ARCH_SEMANTICS.LEFT_SPRINGING]: { ...A, semantic: ARCH_SEMANTICS.LEFT_SPRINGING, label: 'A' },
      [ARCH_SEMANTICS.RIGHT_SPRINGING]: { ...B, semantic: ARCH_SEMANTICS.RIGHT_SPRINGING, label: 'B' },
      [ARCH_SEMANTICS.APEX]: { ...P, semantic: ARCH_SEMANTICS.APEX, label: 'P' },
      [ARCH_SEMANTICS.LEFT_ARC_CENTER]: {
        ...CA,
        semantic: ARCH_SEMANTICS.LEFT_ARC_CENTER,
        label: 'Cₐ',
      },
      [ARCH_SEMANTICS.RIGHT_ARC_CENTER]: {
        ...CB,
        semantic: ARCH_SEMANTICS.RIGHT_ARC_CENTER,
        label: "Cᵦ",
      },
    },
    arcs: {
      [ARCH_SEMANTICS.LEFT_ARC]: { ...leftArc, semantic: ARCH_SEMANTICS.LEFT_ARC },
      [ARCH_SEMANTICS.RIGHT_ARC]: { ...rightArc, semantic: ARCH_SEMANTICS.RIGHT_ARC },
    },
    circles: {
      left: leftCircle,
      right: rightCircle,
    },
    symmetryAxis: { ...symmetryAxis, semantic: ARCH_SEMANTICS.SYMMETRY_AXIS },
    samples: {
      left: leftSamples,
      right: rightSamples,
    },
    residuals,
    semantics: { ...ARCH_SEMANTICS },
    metadata: {
      title: ARCH_FAMILY_META[family].label,
      references: ['REF-008', 'REF-007', 'REF-011', 'REF-009'],
      note: 'Two-centered pointed arch; apex cusp is intentional.',
      kernelVersion: '13A.1',
      units: 'meters',
    },
  }

  const validation = validatePointedArch(result)
  return { ...result, validation }
}

function invalidResult(family, params, errors) {
  return {
    type: 'pointedArch',
    family,
    parameters: { ...params, family },
    derived: {},
    points: {},
    arcs: {},
    circles: {},
    samples: { left: [], right: [] },
    residuals: {},
    semantics: { ...ARCH_SEMANTICS },
    validation: { ok: false, errors, warnings: [] },
    metadata: { title: 'Invalid pointed arch', references: ['REF-008'] },
  }
}

/** Convenience: equilateral / lancet / depressed with shared span. */
export function buildArchFamily(family, params = {}) {
  return buildPointedArch({ ...params, family })
}

export {
  ARCH_FAMILIES,
  ARCH_FAMILY_META,
  DEFAULT_ARCH_PARAMS,
  EQUILATERAL_RISE_RATIO,
  resolveRise,
  nearlyEqualPoints,
  arcPointAt,
}
