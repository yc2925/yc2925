/**
 * Shared 2D design utilities for Tracery Window families.
 * Frame + mullions + lancets are common; upper network differs by family.
 */

import { seededRandom } from '../primitives.js'

export const DESIGN_LAYERS = [
  { id: 'frame', label: 'Outer frame', color: '#f0ebe3' },
  { id: 'mullion', label: 'Primary mullions', color: '#5eb0ff' },
  { id: 'secondary', label: 'Secondary tracery', color: '#7dcea0' },
  { id: 'junction', label: 'Junctions', color: '#ff2020' },
]

export const DESIGN_LAYER_COLORS = Object.fromEntries(DESIGN_LAYERS.map((l) => [l.id, l.color]))

export const TAU = Math.PI * 2
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t

export function archHalves(half, spring, apex) {
  const rise = Math.max(1e-4, apex - spring)
  const h = Math.max(1e-3, half)
  const c = (rise * rise - h * h) / (2 * h)
  const R = h + c
  const thetaApex = Math.atan2(rise, -c)
  return {
    c,
    R,
    thetaApex,
    leftArc: { cx: c, cy: spring, r: R, a0: Math.PI, a1: thetaApex },
    rightArc: { cx: -c, cy: spring, r: R, a0: 0, a1: Math.PI - thetaApex },
  }
}

function sampleArc({ cx, cy, r, a0, a1 }, steps = 24) {
  const pts = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const a = a0 + (a1 - a0) * t
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

function sampleBezier(p0, p1, p2, p3, steps = 20) {
  const pts = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const u = 1 - t
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
    pts.push([x, y])
  }
  return pts
}

export function sampleCurve(curve, steps = 24) {
  if (curve.kind === 'line') return [curve.a, curve.b]
  if (curve.kind === 'arc') return sampleArc(curve, steps)
  if (curve.kind === 'bezier') return sampleBezier(curve.p0, curve.p1, curve.p2, curve.p3, steps)
  if (curve.kind === 'polyline') return curve.points
  return []
}

function circumcircle(p0, mid, p1) {
  const [x1, y1] = p0
  const [x2, y2] = mid
  const [x3, y3] = p1
  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))
  if (Math.abs(d) < 1e-10) return null
  const ux =
    ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / d
  const uy =
    ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / d
  const r = Math.hypot(x1 - ux, y1 - uy)
  return { cx: ux, cy: uy, r }
}

export function shortArcThrough(p0, mid, p1) {
  const circ = circumcircle(p0, mid, p1)
  if (!circ) return null
  const { cx, cy, r } = circ
  const ang = (p) => Math.atan2(p[1] - cy, p[0] - cx)
  const a0 = ang(p0)
  const am = ang(mid)
  const a1 = ang(p1)
  const ccw = (from, to) => ((to - from) % TAU + TAU) % TAU
  if (ccw(a0, am) <= ccw(a0, a1) + 1e-9) {
    const end = a0 + ccw(a0, a1)
    if (ccw(a0, a1) <= Math.PI + 0.05) return { cx, cy, r, a0, a1: end }
  }
  const cwSpan = ccw(a1, a0)
  if (ccw(a0, am) >= ccw(a0, a1) - 1e-9 || cwSpan <= Math.PI + 0.05) {
    return { cx, cy, r, a0, a1: a0 - cwSpan }
  }
  const ccwSpan = ccw(a0, a1)
  if (ccwSpan <= cwSpan) return { cx, cy, r, a0, a1: a0 + ccwSpan }
  return { cx, cy, r, a0, a1: a0 - cwSpan }
}

/**
 * Create a design builder with shared frame / mullion / lancet construction.
 */
export function createDesignBuilder(params = {}) {
  const family = params.traceryFamily ?? 'geometric'
  const aspect = clamp(params.windowAspect ?? params.aspectRatio ?? 1.9, 1.2, 2.8)
  const lancetCount = clamp(Math.round(params.lancetCount ?? 2), 2, 4)
  const upperFrac = clamp(params.upperTraceryHeight ?? 0.36, 0.22, 0.48)
  const curv = clamp(params.curvature ?? 0.55, 0, 1)
  const subdiv = clamp(params.subdivisionComplexity ?? params.cuspingComplexity ?? 0.5, 0, 1)
  const symmetry = params.symmetry !== false
  const seed = Math.round(params.variationSeed ?? 7)
  const rand = seededRandom(seed, family === 'geometric' ? 41 : family === 'rayonnant' ? 43 : 47)

  // Seed selects among a finite set of composition strategies (0..2).
  // Deterministic mapping so seed steps change grammar, not jitter.
  const strategy = ((seed % 3) + 3) % 3

  const W = 3.0
  const H = W * aspect
  const half = W * 0.5
  const sill = 0
  const apex = H
  const margin = half * 0.02
  const impostY = apex - H * upperFrac
  const outerSpring = impostY
  const lancetRise = (apex - impostY) * (0.4 + curv * 0.12)
  const lancetApexY = impostY + lancetRise
  const clearHalf = half - margin
  const lightW = (2 * clearHalf) / lancetCount
  const left = -clearHalf

  const curves = []
  const junctions = []

  const addLine = (id, layer, a, b, meta = {}) => {
    curves.push({
      id,
      layer,
      kind: 'line',
      a: [...a],
      b: [...b],
      color: DESIGN_LAYER_COLORS[layer],
      hierarchy: meta.hierarchy ?? layer,
      featureType: meta.featureType ?? layer,
      parent: meta.parent ?? null,
    })
  }
  const addArc = (id, layer, arc, meta = {}) => {
    curves.push({
      id,
      layer,
      kind: 'arc',
      ...arc,
      color: DESIGN_LAYER_COLORS[layer],
      hierarchy: meta.hierarchy ?? layer,
      featureType: meta.featureType ?? layer,
      parent: meta.parent ?? null,
    })
  }
  const addBezier = (id, layer, p0, p1, p2, p3, meta = {}) => {
    curves.push({
      id,
      layer,
      kind: 'bezier',
      p0: [...p0],
      p1: [...p1],
      p2: [...p2],
      p3: [...p3],
      color: DESIGN_LAYER_COLORS[layer],
      hierarchy: meta.hierarchy ?? layer,
      featureType: meta.featureType ?? layer,
      parent: meta.parent ?? null,
    })
  }
  const addJ = (id, x, y, meta = {}) => {
    junctions.push({
      id,
      layer: 'junction',
      x,
      y,
      color: DESIGN_LAYER_COLORS.junction,
      featureType: meta.featureType ?? 'junction',
      parent: meta.parent ?? null,
    })
  }

  const buildOuterFrame = () => {
    const L = [-half, sill]
    const R = [half, sill]
    const Ls = [-half, outerSpring]
    const Rs = [half, outerSpring]
    addLine('frame-sill', 'frame', L, R, { hierarchy: 'primary', featureType: 'frame' })
    addLine('frame-jamb-L', 'frame', L, Ls, { hierarchy: 'primary', featureType: 'frame' })
    addLine('frame-jamb-R', 'frame', R, Rs, { hierarchy: 'primary', featureType: 'frame' })
    const outer = archHalves(half, outerSpring, apex)
    addArc('frame-arch-L', 'frame', outer.leftArc, { hierarchy: 'primary', featureType: 'frame' })
    addArc('frame-arch-R', 'frame', outer.rightArc, { hierarchy: 'primary', featureType: 'frame' })
    addJ('j-sill-L', L[0], L[1])
    addJ('j-sill-R', R[0], R[1])
    addJ('j-spring-L', Ls[0], Ls[1])
    addJ('j-spring-R', Rs[0], Rs[1])
    addJ('j-apex', 0, apex)
  }

  const buildMullionsAndLancets = () => {
    const lancetApices = []
    for (let i = 1; i < lancetCount; i += 1) {
      const x = left + i * lightW
      addLine(`mullion-${i}`, 'mullion', [x, sill], [x, impostY], {
        hierarchy: 'primary',
        featureType: 'mullion',
      })
      addJ(`j-mullion-base-${i}`, x, sill)
      addJ(`j-mullion-top-${i}`, x, impostY)
    }
    addLine('impost', 'mullion', [left, impostY], [clearHalf, impostY], {
      hierarchy: 'primary',
      featureType: 'impost',
    })
    addJ('j-impost-L', left, impostY)
    addJ('j-impost-R', clearHalf, impostY)

    for (let i = 0; i < lancetCount; i += 1) {
      const x0 = left + i * lightW
      const x1 = left + (i + 1) * lightW
      let cx = (x0 + x1) / 2
      // Controlled asymmetry: nudge light centres slightly when symmetry off.
      if (!symmetry) cx += (rand() - 0.5) * lightW * 0.06
      const lh = (x1 - x0) / 2 * 0.98
      const la = archHalves(lh, impostY, lancetApexY)
      addArc(
        `lancet-${i}-L`,
        'mullion',
        { cx: la.leftArc.cx + cx, cy: la.leftArc.cy, r: la.leftArc.r, a0: la.leftArc.a0, a1: la.leftArc.a1 },
        { hierarchy: 'primary', featureType: 'lancet', parent: 'impost' },
      )
      addArc(
        `lancet-${i}-R`,
        'mullion',
        { cx: la.rightArc.cx + cx, cy: la.rightArc.cy, r: la.rightArc.r, a0: la.rightArc.a0, a1: la.rightArc.a1 },
        { hierarchy: 'primary', featureType: 'lancet', parent: 'impost' },
      )
      addJ(`j-lancet-apex-${i}`, cx, lancetApexY)
      addJ(`j-lancet-foot-L-${i}`, x0, impostY)
      addJ(`j-lancet-foot-R-${i}`, x1, impostY)
      lancetApices.push({ cx, y: lancetApexY, x0, x1, half: lh })
    }
    return lancetApices
  }

  const finish = (extras = {}) => {
    const layout = {
      W,
      H,
      half,
      sill,
      apex,
      outerSpring,
      impostY,
      lancetApexY,
      lancetCount,
      clearHalf,
      lightW,
      left,
      upperFrac,
      curv,
      subdiv,
      cusp: subdiv,
      aspect,
      family,
      strategy,
      symmetry,
      seed,
      ...extras,
    }
    return {
      curves,
      junctions,
      layout,
      layers: DESIGN_LAYERS,
      meta: {
        phase: 4,
        family,
        strategy,
        note: extras.note ?? `Tracery family: ${family}`,
      },
    }
  }

  return {
    family,
    aspect,
    lancetCount,
    upperFrac,
    curv,
    subdiv,
    symmetry,
    seed,
    strategy,
    rand,
    W,
    H,
    half,
    sill,
    apex,
    impostY,
    outerSpring,
    lancetApexY,
    clearHalf,
    lightW,
    left,
    curves,
    junctions,
    addLine,
    addArc,
    addBezier,
    addJ,
    buildOuterFrame,
    buildMullionsAndLancets,
    shortArcThrough,
    finish,
  }
}

/** Head circle packing under apex / above lancets. */
export function packHeadCircle(ctx, lancetApices, scale = 1) {
  const topOfLancets = Math.max(...lancetApices.map((a) => a.y))
  const headClear = ctx.apex - topOfLancets
  const headR = headClear * (0.4 + (1 - ctx.curv) * 0.06) * scale
  const headCy = Math.min(topOfLancets + headR + headClear * 0.08, ctx.apex - headR - ctx.H * 0.02)
  return { headR, headCy, topOfLancets, headClear }
}
