/**
 * Navigable architectural curve graph for constrained particle travel.
 * Built from extracted window features (centerlines + junctions).
 */

import { V } from '../gothic/primitives.js'
import { clamp01 } from './extract.js'

const END_TOL = 0.14
const END_TOL2 = END_TOL * END_TOL

function buildCum(pts) {
  const cum = [0]
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
  }
  return cum
}

function pointAtS(pts, cum, s) {
  const len = cum[cum.length - 1]
  if (len < 1e-8) return pts[0].clone()
  const d = Math.min(len, Math.max(0, s))
  let i = 1
  while (i < cum.length && cum[i] < d) i += 1
  const i0 = Math.max(0, i - 1)
  const i1 = Math.min(pts.length - 1, i)
  const seg = cum[i1] - cum[i0] || 1e-6
  const t = clamp01((d - cum[i0]) / seg)
  return pts[i0].clone().lerp(pts[i1], t)
}

function tangentAtS(pts, cum, s) {
  const len = cum[cum.length - 1]
  const d = Math.min(len, Math.max(0, s))
  let i = 1
  while (i < cum.length && cum[i] < d) i += 1
  const i0 = Math.max(0, i - 1)
  const i1 = Math.min(pts.length - 1, Math.max(i0 + 1, i))
  const t = pts[i1].clone().sub(pts[i0])
  if (t.lengthSq() < 1e-12) return V(0, 1, 0)
  return t.normalize()
}

function nearestS(pts, cum, pos) {
  let bestS = 0
  let bestD = Infinity
  const len = cum[cum.length - 1]
  const samples = Math.max(8, Math.ceil(len / 0.08))
  for (let k = 0; k <= samples; k += 1) {
    const s = (k / samples) * len
    const p = pointAtS(pts, cum, s)
    const d = p.distanceToSquared(pos)
    if (d < bestD) {
      bestD = d
      bestS = s
    }
  }
  return { s: bestS, dist: Math.sqrt(bestD) }
}

/**
 * Build a graph: curves with arc-length params + junction adjacency.
 */
export function buildCurveGraph(arch) {
  const curves = []
  const curveById = new Map()

  for (const c of arch.curves ?? []) {
    if (!c.points || c.points.length < 2) continue
    const cum = buildCum(c.points)
    const length = cum[cum.length - 1]
    if (length < 1e-4) continue
    const entry = {
      id: c.id,
      featureType: c.featureType,
      layer: c.layer,
      points: c.points,
      cum,
      length,
      startJunction: null,
      endJunction: null,
    }
    curves.push(entry)
    curveById.set(c.id, entry)
  }

  const junctions = []
  const junctionById = new Map()

  for (const j of arch.junctions ?? []) {
    const entry = {
      id: j.id,
      position: j.position.clone(),
      edges: [], // { curveId, at: 'start'|'end', outDir }
    }
    junctions.push(entry)
    junctionById.set(j.id, entry)
  }

  // Link curve endpoints to nearest junctions
  for (const c of curves) {
    const start = c.points[0]
    const end = c.points[c.points.length - 1]
    let bestStart = null
    let bestStartD = END_TOL2
    let bestEnd = null
    let bestEndD = END_TOL2
    for (const j of junctions) {
      const ds = j.position.distanceToSquared(start)
      const de = j.position.distanceToSquared(end)
      if (ds < bestStartD) {
        bestStartD = ds
        bestStart = j
      }
      if (de < bestEndD) {
        bestEndD = de
        bestEnd = j
      }
    }
    if (bestStart) {
      c.startJunction = bestStart.id
      const outDir = c.points[1].clone().sub(start)
      if (outDir.lengthSq() > 1e-12) outDir.normalize()
      else outDir.set(0, 1, 0)
      bestStart.edges.push({ curveId: c.id, at: 'start', outDir })
    }
    if (bestEnd) {
      c.endJunction = bestEnd.id
      const outDir = c.points[c.points.length - 2].clone().sub(end)
      if (outDir.lengthSq() > 1e-12) outDir.normalize()
      else outDir.set(0, 1, 0)
      bestEnd.edges.push({ curveId: c.id, at: 'end', outDir })
    }
  }

  const bounds = arch.bounds ?? {
    y0: 0,
    y1: 6,
    half: 1.5,
    min: V(-1.5, 0, -0.5),
    max: V(1.5, 6, 0.5),
  }

  return {
    curves,
    curveById,
    junctions,
    junctionById,
    bounds,
    pointAtS,
    tangentAtS,
    nearestS,
  }
}

/**
 * Locate a world position onto the graph (nearest curve + arc-length).
 */
export function locateOnGraph(graph, position) {
  let best = null
  for (const c of graph.curves) {
    const { s, dist } = nearestS(c.points, c.cum, position)
    if (!best || dist < best.dist) {
      best = { curveId: c.id, s, dist, featureType: c.featureType }
    }
  }
  return best
}

/**
 * Choose an outgoing edge at a junction, avoiding immediate backtrack.
 * opts.visitCounts: Map/object of curveId → visit count (for exploration bias)
 * opts.explorationBias: 0 = prefer familiar/smooth routes; 1 = prefer underexplored
 */
export function pickOutgoing(graph, junctionId, incomingCurveId, heading, rand, opts = {}) {
  const j = graph.junctionById.get(junctionId)
  if (!j || !j.edges.length) return null
  const upW = opts.upwardBias ?? 0.35
  const suitW = opts.suitability ?? 0.5
  const explore = clamp01(opts.explorationBias ?? 0.45)
  const visits = opts.visitCounts ?? null
  const fieldScoreFn = typeof opts.fieldScore === 'function' ? opts.fieldScore : null

  const candidates = []
  for (const e of j.edges) {
    if (e.curveId === incomingCurveId) continue // no immediate reverse onto same curve end
    const curve = graph.curveById.get(e.curveId)
    if (!curve) continue
    const travelSign = e.at === 'start' ? 1 : -1
    const dir = e.outDir.clone()
    const align = heading ? Math.max(0, dir.dot(heading)) : 0.5
    const up = Math.max(0, dir.y)
    const vCount = visits ? visits.get?.(e.curveId) ?? visits[e.curveId] ?? 0 : 0
    // High exploration → boost rarely visited edges; low → prefer smooth alignment.
    // Sqrt softens saturation so underexplored edges stay attractive longer.
    // vCount is accumulated arc travel; log keeps novelty meaningful over long sims
    const novelty = 1 / (1 + Math.log1p(vCount * 2.5))
    const field = fieldScoreFn ? fieldScoreFn(e.curveId, e.at, travelSign) : 0
    const score =
      0.12 +
      align * (0.62 - explore * 0.52) +
      up * upW * (0.3 - explore * 0.14) +
      novelty * (0.1 + explore * 1.05) +
      suitW * 0.05 +
      field +
      rand() * (0.03 + explore * 0.1)
    candidates.push({ edge: e, curve, travelSign, dir, score })
  }

  // If nothing left, allow reverse on incoming as last resort
  if (!candidates.length) {
    for (const e of j.edges) {
      if (e.curveId !== incomingCurveId) continue
      const curve = graph.curveById.get(e.curveId)
      if (!curve) continue
      const travelSign = e.at === 'start' ? 1 : -1
      return { curveId: e.curveId, travelSign, s: e.at === 'start' ? 0 : curve.length, dir: e.outDir.clone() }
    }
    return null
  }

  candidates.sort((a, b) => b.score - a.score)
  // With high exploration, consider nearly all outgoing options
  const poolN =
    explore > 0.7
      ? Math.min(candidates.length, Math.max(4, candidates.length))
      : explore > 0.4
        ? Math.min(4, candidates.length)
        : Math.min(2, candidates.length)
  let top = candidates.slice(0, poolN)

  // High exploration: periodically force the least-traveled outgoing among candidates
  if (explore > 0.55 && candidates.length > 1 && rand() < explore * 0.55) {
    let least = candidates[0]
    let leastV = Infinity
    for (const c of candidates) {
      const v = visits ? visits.get?.(c.edge.curveId) ?? visits[c.edge.curveId] ?? 0 : 0
      if (v < leastV) {
        leastV = v
        least = c
      }
    }
    top = [least, ...top.filter((c) => c.edge.curveId !== least.edge.curveId)].slice(0, poolN)
  }

  const total = top.reduce((n, c) => n + c.score, 0)
  let r = rand() * total
  let pick = top[0]
  for (const c of top) {
    r -= c.score
    if (r <= 0) {
      pick = c
      break
    }
  }
  const s = pick.edge.at === 'start' ? 0 : pick.curve.length
  return {
    curveId: pick.curveId,
    travelSign: pick.travelSign,
    s,
    dir: pick.dir.clone(),
  }
}

export { pointAtS, tangentAtS, nearestS, clamp01 }
