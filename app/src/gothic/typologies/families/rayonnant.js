/**
 * RAYONNANT tracery — radial / rose organization.
 * Concentric rings, radiating spokes, foils on the outer wheel.
 * Hierarchical radial connections from lancets into the rose.
 */

import { TAU, lerp, packHeadCircle } from '../designShared.js'

export function composeRayonnant(ctx) {
  ctx.buildOuterFrame()
  const lancetApices = ctx.buildMullionsAndLancets()
  // Slightly larger rose relative to Geometric.
  const { headR, headCy } = packHeadCircle(ctx, lancetApices, 1.08)

  // Strategy: 0 = 8-spoke single rose, 1 = 12-spoke dense, 2 = double ring + 10 spokes
  const spokeCount = ctx.strategy === 0 ? 8 : ctx.strategy === 1 ? 12 : 10
  const ringCount = ctx.strategy === 2 || ctx.subdiv > 0.6 ? 2 : 1
  const foilCount = Math.min(12, Math.max(6, spokeCount))

  // Outer rose ring (= head-circle for validation / pipeline compatibility)
  ctx.addArc(
    'head-circle',
    'secondary',
    { cx: 0, cy: headCy, r: headR, a0: 0, a1: TAU },
    { hierarchy: 'secondary', featureType: 'rose-ring' },
  )
  ctx.addJ('j-head-center', 0, headCy)
  ctx.addJ('j-head-bottom', 0, headCy - headR)
  ctx.addJ('j-head-top', 0, headCy + headR)

  // Inner concentric rings
  for (let r = 1; r <= ringCount; r += 1) {
    const t = r / (ringCount + 1)
    const rr = headR * (0.35 + t * 0.35)
    ctx.addArc(
      `rose-ring-${r}`,
      'secondary',
      { cx: 0, cy: headCy, r: rr, a0: 0, a1: TAU },
      { hierarchy: 'tertiary', featureType: 'rose-ring', parent: 'head-circle' },
    )
  }

  // Radiating spokes from centre through rings to outer rim.
  const startAng = -Math.PI / 2 + (ctx.strategy === 1 ? Math.PI / spokeCount : 0)
  for (let i = 0; i < spokeCount; i += 1) {
    const a = startAng + (i / spokeCount) * TAU
    const outer = [headR * Math.cos(a), headCy + headR * Math.sin(a)]
    // Hub offset — leave a tiny clear oculus at centre (spokes start slightly out).
    const hub = headR * 0.08
    const inner = [hub * Math.cos(a), headCy + hub * Math.sin(a)]
    ctx.addLine(`spoke-${i}`, 'secondary', inner, outer, {
      hierarchy: 'secondary',
      featureType: 'spoke',
      parent: 'head-circle',
    })
    ctx.addJ(`j-spoke-outer-${i}`, outer[0], outer[1])
  }
  ctx.addJ('j-rose-hub', 0, headCy)

  // Foils on outer rim between spokes (rayonnant petal cells).
  const inset = 0.18 + ctx.subdiv * 0.15
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

  // Hierarchical links: each lancet apex → nearest spoke tip on the rose.
  for (let i = 0; i < lancetApices.length; i += 1) {
    const la = lancetApices[i]
    // Nearest angle on rose toward this lancet.
    const ang = Math.atan2(la.y - headCy, la.cx - 0)
    const onCircle = [headR * Math.cos(ang), headCy + headR * Math.sin(ang)]
    // Straight hierarchical connector (rayonnant, not flame).
    ctx.addLine(`connector-${i}`, 'secondary', [la.cx, la.y], onCircle, {
      hierarchy: 'secondary',
      featureType: 'connector',
      parent: 'head-circle',
    })
    ctx.addJ(`j-connector-on-circle-${i}`, onCircle[0], onCircle[1])
  }

  // High subdivision: short chords between mid-ring and outer (lattice).
  if (ctx.subdiv > 0.65 && ringCount >= 1) {
    const midR = headR * 0.55
    const n = Math.min(spokeCount, 8)
    for (let i = 0; i < n; i += 1) {
      const a0 = startAng + (i / n) * TAU
      const a1 = startAng + ((i + 0.5) / n) * TAU
      const p0 = [midR * Math.cos(a0), headCy + midR * Math.sin(a0)]
      const p1 = [headR * 0.92 * Math.cos(a1), headCy + headR * 0.92 * Math.sin(a1)]
      ctx.addLine(`lattice-${i}`, 'secondary', p0, p1, {
        hierarchy: 'tertiary',
        featureType: 'lattice',
        parent: 'head-circle',
      })
    }
  }

  if (ctx.subdiv > 0.25) {
    ctx.addLine('apex-rib', 'secondary', [0, headCy + headR], [0, lerp(headCy + headR, ctx.apex, 0.8)], {
      hierarchy: 'secondary',
      featureType: 'rib',
      parent: 'frame',
    })
  }

  return ctx.finish({
    headR,
    headCy,
    foilCount,
    spokeCount,
    ringCount,
    note: 'Rayonnant: concentric rose rings, radiating spokes, rim foils, hierarchical radial links.',
  })
}
