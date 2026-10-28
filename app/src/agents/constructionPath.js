/**
 * Step 11C — Extract ornamental path candidates from agent construction archives.
 * Uses actual deposit/build history only — not random curves.
 */

import { locateOnGraph, tangentAtS } from '../ornament/curveGraph.js'

const EPS = 1e-6

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0))
}

/**
 * Drop consecutive near-duplicates.
 */
export function dedupePoints(points, minStep = 0.02) {
  if (!points?.length) return []
  const out = [{ ...points[0] }]
  for (let i = 1; i < points.length; i += 1) {
    if (dist(out[out.length - 1], points[i]) >= minStep) out.push({ ...points[i] })
  }
  return out
}

/**
 * Polyline length + cumulative arc lengths.
 */
export function polylineMetrics(points) {
  const cum = [0]
  for (let i = 1; i < points.length; i += 1) {
    cum.push(cum[i - 1] + dist(points[i - 1], points[i]))
  }
  return { cum, length: cum[cum.length - 1] || 0 }
}

/**
 * Resample by arc length so geometry is frame-rate independent.
 */
export function resampleByArcLength(points, spacing = 0.06) {
  const clean = dedupePoints(points, Math.min(0.015, spacing * 0.4))
  if (clean.length < 2) return clean
  const { cum, length } = polylineMetrics(clean)
  if (length < EPS) return [clean[0]]
  const step = Math.max(0.025, spacing)
  const n = Math.max(2, Math.ceil(length / step) + 1)
  const out = []
  for (let i = 0; i < n; i += 1) {
    const s = (i / (n - 1)) * length
    let j = 1
    while (j < cum.length && cum[j] < s) j += 1
    const j0 = Math.max(0, j - 1)
    const j1 = Math.min(clean.length - 1, j)
    const seg = cum[j1] - cum[j0] || EPS
    const t = (s - cum[j0]) / seg
    const a = clean[j0]
    const b = clean[j1]
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t,
      t: a.t != null && b.t != null ? a.t + (b.t - a.t) * t : a.t ?? b.t ?? 0,
      curveId: t < 0.5 ? a.curveId ?? null : b.curveId ?? null,
      sGraph: t < 0.5 ? a.s ?? null : b.s ?? null,
    })
  }
  return out
}

function sampleTangent(graph, point) {
  if (!graph || !point) return { x: 0, y: 1, z: 0 }
  const loc = locateOnGraph(graph, point)
  if (!loc || loc.dist > 0.35) {
    return { x: 0, y: 1, z: 0 }
  }
  const c = graph.curveById.get(loc.curveId)
  if (!c) return { x: 0, y: 1, z: 0 }
  const T = tangentAtS(c.points, c.cum, loc.s)
  return { x: T.x, y: T.y, z: T.z ?? 0 }
}

/**
 * Split archive where travel sharply reverses (keeps intentional curls at tips).
 */
export function splitConstructionSegments(raw) {
  const clean = dedupePoints(raw ?? [], 0.02)
  if (clean.length < 2) return []
  const segments = []
  let cur = [clean[0]]
  for (let i = 1; i < clean.length; i += 1) {
    cur.push(clean[i])
    if (cur.length < 4 || i >= clean.length - 2) continue
    const a = cur[cur.length - 3]
    const b = cur[cur.length - 2]
    const c = cur[cur.length - 1]
    const ax = b.x - a.x
    const ay = b.y - a.y
    const bx = c.x - b.x
    const by = c.y - b.y
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la < 1e-8 || lb < 1e-8) continue
    const dot = (ax * bx + ay * by) / (la * lb)
    // Hard mid-path reverse → new segment (preserve tip curls by requiring mid body)
    if (dot < -0.82 && cur.length >= 6) {
      const kept = cur.slice(0, -1)
      if (kept.length >= 2) segments.push(kept)
      cur = [b, c]
    }
  }
  if (cur.length >= 2) segments.push(cur)
  return segments.length ? segments : [clean]
}

function candidateFromPoints(agent, pointsIn, graph, field, suffix = '') {
  const points = resampleByArcLength(pointsIn, 0.055)
  if (points.length < 2) return null
  const { length } = polylineMetrics(points)
  if (length < 1e-4) return null

  const start = points[0]
  const end = points[points.length - 1]
  const attachStart = graph ? locateOnGraph(graph, start) : null
  const attachEnd = graph ? locateOnGraph(graph, end) : null
  const tangentStart = sampleTangent(graph, start)
  const tangentEnd = sampleTangent(graph, end)

  const accum = agent.fieldAccum ?? { attraction: 0, inhibition: 0, occupancy: 0, samples: 0 }
  const n = Math.max(1, accum.samples)
  let fieldAlong = {
    attraction: accum.attraction / n,
    inhibition: accum.inhibition / n,
    occupancy: accum.occupancy / n,
  }
  if (field && attachEnd?.curveId) {
    const tip = field.sampleAt(attachEnd.curveId, attachEnd.s)
    fieldAlong = {
      attraction: (fieldAlong.attraction + (tip.attraction ?? 0)) * 0.5,
      inhibition: (fieldAlong.inhibition + (tip.inhibition ?? 0)) * 0.5,
      occupancy: (fieldAlong.occupancy + (tip.occupancy ?? 0)) * 0.5,
    }
  }

  const t0 = points[0].t ?? agent.constructionStartTime ?? 0
  const t1 = points[points.length - 1].t ?? agent.constructionEndTime ?? t0

  return {
    id: `path-${agent.id}${suffix}`,
    agentId: agent.id,
    role: agent.role,
    isMirror: !!agent.isMirror,
    mirrorOf: agent.mirrorOf ?? null,
    parentAgentId: agent.parentId ?? null,
    parentPathId: null,
    points,
    length,
    spawnRegion: agent.spawnRegion ?? null,
    featureRefs: [...new Set(points.map((p) => p.curveId).filter(Boolean))],
    attachmentStart: attachStart,
    attachmentEnd: attachEnd,
    tangentStart,
    tangentEnd,
    accumulatedAttraction: fieldAlong.attraction,
    accumulatedInhibition: fieldAlong.inhibition,
    accumulatedOccupancy: fieldAlong.occupancy,
    growthStartTime: t0,
    growthCompletionTime: Math.max(t0 + 0.2, t1),
    valid: true,
    agentState: agent.state,
  }
}

/**
 * Convert one agent's construction archive into candidate path record(s).
 */
export function extractCandidateFromAgent(agent, graph, field = null) {
  const raw = agent.constructionPath ?? []
  if (raw.length < 2) return null
  const segments = splitConstructionSegments(raw)
  const out = []
  for (let i = 0; i < segments.length; i += 1) {
    const c = candidateFromPoints(agent, segments[i], graph, field, segments.length > 1 ? `-${i}` : '')
    if (c) out.push(c)
  }
  if (!out.length) return null
  return out.length === 1 ? out[0] : out
}

/**
 * Extract candidates from a live simulation (masters preferred for bilateral).
 */
export function extractCandidates(sim, opts = {}) {
  const graph = sim?.graph
  const field = sim?.field ?? null
  const preferMasters = opts.preferMasters !== false
  const agents = sim?.state?.agents ?? []
  const candidates = []
  for (const a of agents) {
    if (preferMasters && a.isMirror) continue
    // Only paths that entered deposit/build work
    if (!(a.constructionPath?.length >= 2)) continue
    const c = extractCandidateFromAgent(a, graph, field)
    if (!c) continue
    if (Array.isArray(c)) candidates.push(...c)
    else candidates.push(c)
  }
  return candidates
}

/**
 * Stable fingerprint of construction archives (for rebuild gating).
 */
export function constructionFingerprint(sim) {
  const parts = []
  for (const a of sim?.state?.agents ?? []) {
    if (a.isMirror) continue
    const n = a.constructionPath?.length ?? 0
    if (n < 2) continue
    const last = a.constructionPath[n - 1]
    parts.push(
      `${a.id}:${n}:${a.state}:${(a.constructionStartTime ?? 0).toFixed(2)}:${last.x.toFixed(3)},${last.y.toFixed(3)}`,
    )
  }
  parts.sort()
  return parts.join('|')
}
