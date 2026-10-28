/**
 * Step 11C / 11C.1 — Accept / prune agent construction paths.
 * Region-aware quotas + rejection diagnostics. Hard geometric safety preserved.
 */

import { locateOnGraph } from '../ornament/curveGraph.js'
import {
  ARCH_REGIONS,
  REGION_COMPOSITION,
  classifyPathRegion,
  regionQuotas,
  regionalCoverageStats,
} from './architecturalRegions.js'
import { polylineMetrics } from './constructionPath.js'

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0))
}

function archScale(graph) {
  const b = graph?.bounds
  if (!b) return 1
  const h = Math.abs((b.y1 ?? 4) - (b.y0 ?? 0))
  const w = Math.abs((b.x1 ?? 2) - (b.x0 ?? -2))
  return Math.max(0.6, Math.min(4, Math.hypot(w, h) * 0.35))
}

export function meanTurning(points) {
  if (!points || points.length < 3) return 0
  let sum = 0
  let n = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const ax = points[i].x - points[i - 1].x
    const ay = points[i].y - points[i - 1].y
    const bx = points[i + 1].x - points[i].x
    const by = points[i + 1].y - points[i].y
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la < 1e-8 || lb < 1e-8) continue
    const dot = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))
    sum += Math.acos(dot)
    n += 1
  }
  return n ? sum / n : 0
}

export function abruptReversalCount(points) {
  if (!points || points.length < 3) return 0
  let count = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const ax = points[i].x - points[i - 1].x
    const ay = points[i].y - points[i - 1].y
    const bx = points[i + 1].x - points[i].x
    const by = points[i + 1].y - points[i].y
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la < 1e-8 || lb < 1e-8) continue
    const dot = (ax * bx + ay * by) / (la * lb)
    if (dot < -0.78) {
      const u = i / (points.length - 1)
      if (u < 0.85) count += 1
    }
  }
  return count
}

export function localLoopScore(points, cell = 0.12) {
  if (!points?.length) return 0
  const visits = new Map()
  for (const p of points) {
    const k = `${Math.round(p.x / cell)}:${Math.round(p.y / cell)}`
    visits.set(k, (visits.get(k) ?? 0) + 1)
  }
  let heavy = 0
  for (const v of visits.values()) if (v >= 4) heavy += 1
  return heavy / Math.max(1, visits.size)
}

export function pathOverlapScore(candidate, accepted, sampleStep = 3) {
  if (!accepted.length || !candidate.points?.length) return Infinity
  let sum = 0
  let n = 0
  for (let i = 0; i < candidate.points.length; i += sampleStep) {
    const p = candidate.points[i]
    let best = Infinity
    for (const other of accepted) {
      for (let j = 0; j < other.points.length; j += sampleStep) {
        const q = other.points[j]
        const d = dist(p, q)
        if (d < best) best = d
      }
    }
    sum += best
    n += 1
  }
  return n ? sum / n : Infinity
}

/**
 * Mean |dx|/(|dx|+|dy|) — low = vertical (mullion-like).
 */
function verticalness(points) {
  if (!points || points.length < 2) return 0.5
  let ax = 0
  let ay = 0
  for (let i = 1; i < points.length; i += 1) {
    ax += Math.abs(points[i].x - points[i - 1].x)
    ay += Math.abs(points[i].y - points[i - 1].y)
  }
  const s = ax + ay || 1
  return ay / s
}

/**
 * Map internal reasons to diagnostic categories requested by 11C.1.
 */
export function categorizeRejectReason(reason) {
  switch (reason) {
    case 'invalid_attachment':
    case 'far_from_architecture':
    case 'abrupt_reversals':
      return 'invalid_geometry'
    case 'too_short':
      return 'insufficient_length'
    case 'redundant_overlap':
      return 'redundant_overlap'
    case 'chaotic_curvature':
    case 'local_looping':
      return 'excessive_curvature'
    case 'field_inhibition':
      return 'field_inhibition'
    case 'regional_saturation':
    case 'density_cap':
      return 'regional_saturation'
    case 'below_threshold':
      return 'below_threshold'
    default:
      return reason || 'unknown'
  }
}

export function rejectionBreakdown(rejected) {
  const byReason = Object.create(null)
  const byCategory = Object.create(null)
  for (const r of rejected ?? []) {
    const reason = r.rejectReason ?? 'unknown'
    const cat = categorizeRejectReason(reason)
    byReason[reason] = (byReason[reason] ?? 0) + 1
    byCategory[cat] = (byCategory[cat] ?? 0) + 1
  }
  return { byReason, byCategory, total: rejected?.length ?? 0 }
}

/**
 * Evaluate a single candidate with optional region context.
 */
export function evaluateCandidate(candidate, ctx) {
  const {
    graph,
    arch = null,
    accepted = [],
    scale = 1,
    acceptanceThreshold = 0.45,
    density = 0.55,
    enableStigmergy = true,
    regionCounts = null,
    quotas = null,
  } = ctx

  const region =
    candidate.region ??
    classifyPathRegion(candidate.points, graph, arch, candidate.spawnRegion)
  const composition = REGION_COMPOSITION[region] ?? REGION_COMPOSITION['upper-tracery']

  let score = 0.52 + (composition.acceptanceBias ?? 0)

  // --- Hard geometric safety (not relaxed) ---
  const minLenBase = region === 'structural-junctions' || region === 'upper-tracery' ? 0.065 : 0.085
  const minLen = minLenBase * scale * (region === 'vertical-mullions' ? 1.15 : 1)
  if (candidate.length < minLen) {
    return { accepted: false, reason: 'too_short', score: 0, tierHint: null, region }
  }

  const attachDist = Math.min(
    candidate.attachmentStart?.dist ?? 99,
    candidate.attachmentEnd?.dist ?? 99,
  )
  if (attachDist > 0.35 * scale) {
    return { accepted: false, reason: 'invalid_attachment', score: 0, tierHint: null, region }
  }
  score += Math.max(0, 0.14 - attachDist) * 0.7

  const turn = meanTurning(candidate.points)
  // Hard ceiling — Gothic cusps allowed, noise not
  if (turn > 1.85) {
    return { accepted: false, reason: 'chaotic_curvature', score: 0, tierHint: null, region }
  }
  if (turn > 1.15) score -= 0.06
  else score += 0.05

  const reversals = abruptReversalCount(candidate.points)
  if (reversals >= 5) {
    return { accepted: false, reason: 'abrupt_reversals', score: 0, tierHint: null, region }
  }
  if (reversals >= 3) score -= 0.05

  // Region-aware loop tolerance: mullions/frames revisit cells when traversing length
  const loopCell = (region === 'vertical-mullions' ? 0.05 : 0.06) * scale
  const loopHard = region === 'vertical-mullions' || region === 'outer-frame' ? 0.82 : 0.7
  const loops = localLoopScore(candidate.points, loopCell)
  if (loops > loopHard) {
    return { accepted: false, reason: 'local_looping', score: 0, tierHint: null, region }
  }
  if (loops > loopHard * 0.55) score -= 0.07

  if (graph) {
    let far = 0
    const step = Math.max(1, Math.floor(candidate.points.length / 8))
    for (let i = 0; i < candidate.points.length; i += step) {
      const loc = locateOnGraph(graph, candidate.points[i])
      if (!loc || loc.dist > 0.4 * scale) far += 1
    }
    if (far >= 4) {
      return { accepted: false, reason: 'far_from_architecture', score: 0, tierHint: null, region }
    }
    score += 0.03 * (4 - far)
  }

  // Regional clearance / redundancy
  const clearance = (composition.minClearance ?? 0.08) * scale
  const sep = pathOverlapScore(candidate, accepted)
  const minSep = clearance * (0.55 + (1 - density) * 0.45)
  if (sep < minSep * 0.38) {
    return { accepted: false, reason: 'redundant_overlap', score: 0, tierHint: null, region }
  }
  if (sep < minSep) score -= 0.1
  else score += Math.min(0.1, (sep - minSep) * 0.35)

  // Regional saturation (soft capacity)
  if (regionCounts && quotas) {
    const used = regionCounts[region] ?? 0
    const cap = quotas[region] ?? 1
    if (used >= cap) {
      // Still allow if composition would stay single-region only — handled by caller prefer
      return { accepted: false, reason: 'regional_saturation', score, tierHint: null, region }
    }
    // Prefer underfilled regions
    const fill = used / Math.max(1, cap)
    score += (1 - fill) * 0.12
  }

  // Direction affinity (mullions prefer vertical stems)
  const vert = verticalness(candidate.points)
  const prefer = composition.preferredDir ?? 0.5
  score += (1 - Math.abs(vert - prefer)) * 0.08

  // Stigmergy historical accumulators (not live decayed averages)
  if (enableStigmergy) {
    const attr = candidate.accumulatedAttraction ?? 0
    const inhib = candidate.accumulatedInhibition ?? 0
    const occ = candidate.accumulatedOccupancy ?? 0
    score += attr * 0.18
    score -= inhib * 0.16
    score -= occ * 0.12
    if (inhib > 0.92 && occ > 0.85 && attr < 0.35) {
      return { accepted: false, reason: 'field_inhibition', score, tierHint: null, region }
    }
  }

  const lenNorm = candidate.length / (scale * 1.1)
  let tierHint = 'secondary'
  const primaryNeed = composition.primaryBias ?? 0.5
  if (lenNorm >= 0.55 + (1 - primaryNeed) * 0.25 && turn < 1.1) tierHint = 'primary'
  else if (lenNorm < 0.32 || turn > 1.2) tierHint = 'tertiary'

  // Region-aware acceptance threshold (valid paths only — never below hard geometry)
  const regionThresh =
    Math.max(0.12, Math.min(0.8, acceptanceThreshold - (composition.acceptanceBias ?? 0) * 0.5))
  score = Math.max(0, Math.min(1, score))
  if (score < regionThresh) {
    return { accepted: false, reason: 'below_threshold', score, tierHint, region }
  }
  return { accepted: true, reason: null, score, tierHint, region }
}

/**
 * Accept/prune with regional composition quotas.
 * Prefers underfilled regions while keeping geometric safety hard.
 */
export function acceptPaths(candidates, opts = {}) {
  const graph = opts.graph
  const arch = opts.arch ?? null
  const scale = opts.scale ?? archScale(graph)
  const density = opts.ornamentDensity ?? 0.55
  const maxAccept = Math.max(
    2,
    Math.round((opts.maxPaths ?? 14) * (0.5 + density * 0.85)),
  )
  const quotas = regionQuotas(maxAccept, density)

  // Tag regions first (spawnRegion soft-bias when path vote is close)
  const tagged = (candidates ?? []).map((c) => ({
    ...c,
    region: c.region ?? classifyPathRegion(c.points, graph, arch, c.spawnRegion),
  }))

  // Score-aware ranking: length + underfilled-region bonus
  const regionNeed = Object.create(null)
  for (const r of ARCH_REGIONS) regionNeed[r.id] = quotas[r.id] ?? 1

  const ranked = [...tagged].sort((a, b) => {
    const needA = regionNeed[a.region] ?? 1
    const needB = regionNeed[b.region] ?? 1
    const la = (a.length ?? 0) + needA * 0.15
    const lb = (b.length ?? 0) + needB * 0.15
    return lb - la
  })

  const accepted = []
  const rejected = []
  const regionCounts = Object.create(null)
  for (const r of ARCH_REGIONS) regionCounts[r.id] = 0

  // Pass 1: fill underfilled regions preferentially
  for (const c of ranked) {
    if (accepted.length >= maxAccept) {
      rejected.push({ ...c, valid: false, rejectReason: 'density_cap' })
      continue
    }
    const result = evaluateCandidate(c, {
      graph,
      arch,
      accepted,
      scale,
      acceptanceThreshold: opts.pathAcceptanceThreshold ?? 0.42,
      density,
      enableStigmergy: opts.enableStigmergy !== false,
      regionCounts,
      quotas,
    })
    if (result.accepted) {
      const node = {
        ...c,
        region: result.region,
        valid: true,
        acceptScore: result.score,
        tierHint: result.tierHint,
        rejectReason: null,
      }
      accepted.push(node)
      regionCounts[result.region] = (regionCounts[result.region] ?? 0) + 1
    } else if (result.reason === 'regional_saturation') {
      // Defer saturated-region candidates to pass 2 if we still need diversity elsewhere
      rejected.push({
        ...c,
        region: result.region,
        valid: false,
        rejectReason: result.reason,
        acceptScore: result.score,
        deferred: true,
      })
    } else {
      rejected.push({
        ...c,
        region: result.region,
        valid: false,
        rejectReason: result.reason,
        acceptScore: result.score,
      })
    }
  }

  // Pass 2: if we have capacity and underfilled regions, retry deferred with soft quota bump
  const deferred = rejected.filter((r) => r.deferred)
  for (const r of deferred) {
    delete r.deferred
  }
  if (accepted.length < maxAccept && deferred.length) {
    const softQuotas = { ...quotas }
    for (const id of Object.keys(softQuotas)) {
      softQuotas[id] = softQuotas[id] + 1
    }
    for (const c of deferred) {
      if (accepted.length >= maxAccept) break
      // Remove from rejected temporarily
      const idx = rejected.indexOf(c)
      if (idx >= 0) rejected.splice(idx, 1)
      const result = evaluateCandidate(c, {
        graph,
        arch,
        accepted,
        scale,
        acceptanceThreshold: (opts.pathAcceptanceThreshold ?? 0.42) * 0.92,
        density,
        enableStigmergy: opts.enableStigmergy !== false,
        regionCounts,
        quotas: softQuotas,
      })
      if (result.accepted) {
        accepted.push({
          ...c,
          region: result.region,
          valid: true,
          acceptScore: result.score,
          tierHint: result.tierHint,
          rejectReason: null,
        })
        regionCounts[result.region] = (regionCounts[result.region] ?? 0) + 1
      } else {
        rejected.push({
          ...c,
          region: result.region,
          valid: false,
          rejectReason: result.reason,
          acceptScore: result.score,
        })
      }
    }
  }

  const coverage = regionalCoverageStats(accepted, quotas)
  const diagnostics = rejectionBreakdown(rejected)

  return {
    accepted,
    rejected,
    scale,
    quotas,
    regionCounts,
    coverage,
    diagnostics,
  }
}

export { archScale, polylineMetrics, regionQuotas, regionalCoverageStats }
