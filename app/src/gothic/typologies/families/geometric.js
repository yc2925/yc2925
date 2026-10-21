/**
 * GEOMETRIC tracery — precise bilateral construction.
 * Lancet subdivisions + circular head with trefoil / quatrefoil cusps.
 * Straight connectors (not flowing ogees). Strong symmetry.
 */

import { TAU, lerp, packHeadCircle } from '../designShared.js'

export function composeGeometric(ctx) {
  ctx.buildOuterFrame()
  const lancetApices = ctx.buildMullionsAndLancets()
  const { headR, headCy } = packHeadCircle(ctx, lancetApices, 1)

  // Strategy: 0 = trefoil head, 1 = quatrefoil, 2 = sexfoil (high subdiv)
  const foilBase = ctx.strategy === 0 ? 3 : ctx.strategy === 1 ? 4 : 6
  const foilCount = Math.min(6, Math.max(3, foilBase + (ctx.subdiv > 0.7 ? 1 : 0) - (ctx.subdiv < 0.25 ? 1 : 0)))

  ctx.addArc(
    'head-circle',
    'secondary',
    { cx: 0, cy: headCy, r: headR, a0: 0, a1: TAU },
    { hierarchy: 'secondary', featureType: 'head-circle' },
  )
  ctx.addJ('j-head-center', 0, headCy)
  ctx.addJ('j-head-bottom', 0, headCy - headR)
  ctx.addJ('j-head-top', 0, headCy + headR)

  // Straight radial connectors from each lancet apex to the circle.
  for (let i = 0; i < lancetApices.length; i += 1) {
    const la = lancetApices[i]
    const vx = la.cx
    const vy = la.y - headCy
    const len = Math.hypot(vx, vy) || 1
    const onCircle = [(vx / len) * headR, headCy + (vy / len) * headR]
    ctx.addLine(`connector-${i}`, 'secondary', [la.cx, la.y], onCircle, {
      hierarchy: 'secondary',
      featureType: 'connector',
      parent: 'head-circle',
    })
    ctx.addJ(`j-connector-on-circle-${i}`, onCircle[0], onCircle[1])
  }

  // Geometric foil cusps on the rim.
  const startAng = -Math.PI / 2
  const inset = 0.2 + ctx.subdiv * 0.2
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
    } else {
      ctx.addBezier(`foil-cusp-${i}`, 'secondary', p0, cuspPt, cuspPt, p1, {
        hierarchy: 'tertiary',
        featureType: 'foil',
        parent: 'head-circle',
      })
    }
    ctx.addJ(`j-foil-${i}`, p0[0], p0[1])
  }

  // High subdivision: concentric inner ring (still geometric).
  if (ctx.subdiv > 0.55) {
    const innerR = headR * (0.42 + ctx.strategy * 0.04)
    ctx.addArc(
      'inner-ring',
      'secondary',
      { cx: 0, cy: headCy, r: innerR, a0: 0, a1: TAU },
      { hierarchy: 'tertiary', featureType: 'ring', parent: 'head-circle' },
    )
    // Short spokes from inner ring to head circle at foil junctions.
    const spokeN = Math.min(foilCount, 4)
    for (let i = 0; i < spokeN; i += 1) {
      const a = startAng + (i / spokeN) * TAU
      const aIn = [innerR * Math.cos(a), headCy + innerR * Math.sin(a)]
      const aOut = [headR * Math.cos(a), headCy + headR * Math.sin(a)]
      ctx.addLine(`spoke-${i}`, 'secondary', aIn, aOut, {
        hierarchy: 'tertiary',
        featureType: 'spoke',
        parent: 'head-circle',
      })
    }
  }

  // Apex rib when subdivision mid+
  if (ctx.subdiv > 0.3) {
    ctx.addLine('apex-rib', 'secondary', [0, headCy + headR], [0, lerp(headCy + headR, ctx.apex, 0.85)], {
      hierarchy: 'secondary',
      featureType: 'rib',
      parent: 'frame',
    })
    ctx.addJ('j-apex-rib', 0, lerp(headCy + headR, ctx.apex, 0.85))
  }

  return ctx.finish({
    headR,
    headCy,
    foilCount,
    note: 'Geometric: lancets, circular head, trefoil/quatrefoil/sexfoil cusps, straight connectors.',
  })
}
