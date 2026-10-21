/**
 * FLAMBOYANT tracery — flowing ogee / flame networks.
 * S-curved connectors, dagger/mouchette forms, interlocking curvilinear cells.
 * Controlled asymmetry when Symmetry is off.
 */

import { TAU, lerp, packHeadCircle } from '../designShared.js'

export function composeFlamboyant(ctx) {
  ctx.buildOuterFrame()
  const lancetApices = ctx.buildMullionsAndLancets()
  const { headR, headCy } = packHeadCircle(ctx, lancetApices, 0.95)

  // Strategy: 0 = classic head-circle + flame connectors, 1 = paired mouchettes, 2 = interlocking ogee mesh
  const foilCount = ctx.subdiv < 0.3 ? 3 : ctx.subdiv < 0.65 ? 4 : 5

  ctx.addArc(
    'head-circle',
    'secondary',
    { cx: 0, cy: headCy, r: headR, a0: 0, a1: TAU },
    { hierarchy: 'secondary', featureType: 'head-circle' },
  )
  ctx.addJ('j-head-center', 0, headCy)
  ctx.addJ('j-head-bottom', 0, headCy - headR)
  ctx.addJ('j-head-top', 0, headCy + headR)

  // Flowing S-curve connectors from lancet apices → circle.
  for (let i = 0; i < lancetApices.length; i += 1) {
    const la = lancetApices[i]
    const vx = la.cx
    const vy = la.y - headCy
    const len = Math.hypot(vx, vy) || 1
    const onCircle = [(vx / len) * headR, headCy + (vy / len) * headR]
    const sign = la.cx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(la.cx)
    const flame = headR * (0.18 + ctx.curv * 0.28) * (ctx.symmetry ? sign : sign * (0.7 + ctx.rand() * 0.6))
    const c1 = [lerp(la.cx, onCircle[0], 0.35) + flame * 0.55, lerp(la.y, onCircle[1], 0.3)]
    const c2 = [lerp(la.cx, onCircle[0], 0.7) - flame * 0.35, lerp(la.y, onCircle[1], 0.65)]
    ctx.addBezier(`connector-${i}`, 'secondary', [la.cx, la.y], c1, c2, onCircle, {
      hierarchy: 'secondary',
      featureType: 'ogee',
      parent: 'head-circle',
    })
    ctx.addJ(`j-connector-on-circle-${i}`, onCircle[0], onCircle[1])
  }

  // Rim foils (cusped).
  const startAng = -Math.PI / 2
  const inset = 0.24 + ctx.subdiv * 0.18
  for (let i = 0; i < foilCount; i += 1) {
    const a0 = startAng + (i / foilCount) * TAU
    const a1 = startAng + ((i + 1) / foilCount) * TAU
    const span = ((a1 - a0) % TAU + TAU) % TAU
    const midA = a0 + span / 2
    const p0 = [headR * Math.cos(a0), headCy + headR * Math.sin(a0)]
    const p1 = [headR * Math.cos(a1), headCy + headR * Math.sin(a1)]
    const cuspPt = [headR * (1 - inset) * Math.cos(midA), headCy + headR * (1 - inset) * Math.sin(midA)]
    const foilArc = ctx.shortArcThrough(p0, cuspPt, p1)
    if (foilArc) {
      ctx.addArc(`foil-cusp-${i}`, 'secondary', foilArc, {
        hierarchy: 'tertiary',
        featureType: 'foil',
        parent: 'head-circle',
      })
    }
    ctx.addJ(`j-foil-${i}`, p0[0], p0[1])
  }

  // Flame / mouchette pairs — strategy dependent.
  if (ctx.strategy === 1 || ctx.subdiv > 0.45) {
    // Paired ogee daggers flanking the centreline under the head circle.
    const n = Math.min(2, Math.max(1, Math.floor(ctx.subdiv * 3)))
    for (let k = 0; k < n; k += 1) {
      const side = k === 0 ? -1 : 1
      // Snap base onto circle bottom-ish
      const bang = -Math.PI / 2 + side * 0.55
      const onB = [headR * Math.cos(bang), headCy + headR * Math.sin(bang)]
      const tipAng = -Math.PI / 2 + side * (0.15 + k * 0.08)
      const tip = [headR * 0.35 * Math.cos(tipAng), headCy + headR * 0.35 * Math.sin(tipAng)]
      const c1 = [onB[0] + side * headR * 0.25, lerp(onB[1], tip[1], 0.4)]
      const c2 = [tip[0] - side * headR * 0.1, lerp(onB[1], tip[1], 0.75)]
      ctx.addBezier(`mouchette-${k}`, 'secondary', onB, c1, c2, tip, {
        hierarchy: 'tertiary',
        featureType: 'mouchette',
        parent: 'head-circle',
      })
      ctx.addJ(`j-mouchette-${k}`, tip[0], tip[1])
    }
  }

  if (ctx.strategy === 2 || ctx.subdiv > 0.7) {
    // Interlocking ogee mesh: opposing S-curves across the head field.
    const pairs = 2 + (ctx.subdiv > 0.85 ? 1 : 0)
    for (let i = 0; i < pairs; i += 1) {
      const t0 = (i + 0.5) / pairs
      const angL = Math.PI * 0.75 - t0 * 0.9
      const angR = Math.PI * 0.25 + t0 * 0.9
      const A = [headR * Math.cos(angL), headCy + headR * Math.sin(angL)]
      const B = [headR * Math.cos(angR), headCy + headR * Math.sin(angR)]
      const mid = [0, headCy + (ctx.rand() - 0.5) * headR * (ctx.symmetry ? 0 : 0.12)]
      const bulge = headR * (0.25 + ctx.curv * 0.2)
      const c1 = [mid[0] - bulge, lerp(A[1], mid[1], 0.5)]
      const c2 = [mid[0] + bulge, lerp(B[1], mid[1], 0.5)]
      ctx.addBezier(`ogee-mesh-${i}`, 'secondary', A, c1, c2, B, {
        hierarchy: 'tertiary',
        featureType: 'ogee',
        parent: 'head-circle',
      })
    }
  }

  // Apex flame rib — slight S when strategy 0
  if (ctx.subdiv > 0.2) {
    const top = [0, headCy + headR]
    const end = [0, lerp(headCy + headR, ctx.apex, 0.88)]
    if (ctx.strategy === 0) {
      const sway = (ctx.symmetry ? 0 : (ctx.rand() - 0.5) * 0.08) * headR
      ctx.addBezier(
        'apex-rib',
        'secondary',
        top,
        [sway, lerp(top[1], end[1], 0.4)],
        [-sway * 0.5, lerp(top[1], end[1], 0.7)],
        end,
        { hierarchy: 'secondary', featureType: 'rib', parent: 'frame' },
      )
    } else {
      ctx.addLine('apex-rib', 'secondary', top, end, {
        hierarchy: 'secondary',
        featureType: 'rib',
        parent: 'frame',
      })
    }
    ctx.addJ('j-apex-rib', end[0], end[1])
  }

  // Spandrel flames for 3–4 lights
  if (ctx.lancetCount >= 3 && ctx.subdiv > 0.3) {
    for (const sign of [-1, 1]) {
      const outer = lancetApices[sign < 0 ? 0 : lancetApices.length - 1]
      const ang = Math.atan2(outer.y - headCy, outer.cx)
      const onC = [headR * Math.cos(ang), headCy + headR * Math.sin(ang)]
      const c1 = [outer.cx + sign * ctx.lightW * 0.12, lerp(outer.y, onC[1], 0.35)]
      const c2 = [lerp(outer.cx, onC[0], 0.65) + sign * headR * 0.1, lerp(outer.y, onC[1], 0.7)]
      ctx.addBezier(`spandrel-${sign < 0 ? 'L' : 'R'}`, 'secondary', [outer.cx, outer.y], c1, c2, onC, {
        hierarchy: 'tertiary',
        featureType: 'ogee',
        parent: 'head-circle',
      })
    }
  }

  return ctx.finish({
    headR,
    headCy,
    foilCount,
    note: 'Flamboyant: ogee connectors, flame/mouchette forms, interlocking curvilinear cells.',
  })
}
