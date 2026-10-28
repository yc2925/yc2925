/**
 * Step 11C.1 — Architectural region classification for agent ornament composition.
 * Primary signal: existing featureType metadata. yNorm is documented fallback only.
 */

import { clamp01 } from '../ornament/extract.js'
import { locateOnGraph } from '../ornament/curveGraph.js'

export const ARCH_REGIONS = [
  { id: 'upper-tracery', label: 'Upper Tracery' },
  { id: 'lancet-arches', label: 'Lancet Arches' },
  { id: 'vertical-mullions', label: 'Vertical Mullions' },
  { id: 'structural-junctions', label: 'Structural Junctions' },
  { id: 'outer-frame', label: 'Outer Frame' },
]

/**
 * Composition targets per region (relative quotas among accepted masters).
 * preferredDir: unit preference for stem orientation scoring (0=horizontal bias, 1=vertical).
 */
export const REGION_COMPOSITION = {
  'upper-tracery': {
    targetCoverage: 0.26,
    preferredDir: 0.35,
    maxComplexity: 4,
    minClearance: 0.07,
    primaryBias: 0.35,
    acceptanceBias: 0.0,
  },
  'lancet-arches': {
    targetCoverage: 0.22,
    preferredDir: 0.55,
    maxComplexity: 3,
    minClearance: 0.08,
    primaryBias: 0.55,
    acceptanceBias: 0.04,
  },
  'vertical-mullions': {
    targetCoverage: 0.24,
    preferredDir: 0.95,
    maxComplexity: 3,
    minClearance: 0.1,
    primaryBias: 0.75,
    acceptanceBias: 0.06,
  },
  'structural-junctions': {
    targetCoverage: 0.16,
    preferredDir: 0.4,
    maxComplexity: 2,
    minClearance: 0.06,
    primaryBias: 0.25,
    acceptanceBias: 0.02,
  },
  'outer-frame': {
    targetCoverage: 0.12,
    preferredDir: 0.5,
    maxComplexity: 2,
    minClearance: 0.11,
    primaryBias: 0.6,
    acceptanceBias: 0.05,
  },
}

function yNormOf(position, arch) {
  const b = arch?.bounds ?? {}
  const y0 = b.y0 ?? b.min?.y ?? 0
  const y1 = b.y1 ?? b.max?.y ?? 6
  return clamp01((position.y - y0) / Math.max(0.2, y1 - y0))
}

/**
 * Classify a point + feature type into an architectural region.
 * Prefer featureType; use height band only as fallback / disambiguation.
 */
export function classifyArchitecturalRegion(position, featureType, arch) {
  const type = featureType ?? ''
  const yNorm = yNormOf(position ?? { y: 0 }, arch)

  if (type === 'junction') return 'structural-junctions'

  if (type === 'mullion') return 'vertical-mullions'

  if (type === 'tracery' || type === 'foil' || type === 'cusp') {
    return yNorm >= 0.42 ? 'upper-tracery' : 'lancet-arches'
  }

  if (type === 'arch') return 'lancet-arches'

  if (type === 'frame') {
    // Outer frame vs lancet head: outer at edges / lower; lancet mid-band arches
    if (yNorm >= 0.38 && yNorm < 0.78) return 'lancet-arches'
    return 'outer-frame'
  }

  // Documented fallback when feature metadata missing
  if (yNorm >= 0.62) return 'upper-tracery'
  if (yNorm >= 0.4) return 'lancet-arches'
  if (yNorm >= 0.18) return 'vertical-mullions'
  return 'outer-frame'
}

/**
 * Dominant region along a polyline (majority vote of located samples).
 * Optional spawnRegion soft-bias when vote is close (keeps quota attribution honest
 * for agents that briefly wander across region boundaries).
 */
export function classifyPathRegion(points, graph, arch, spawnRegion = null) {
  if (!points?.length) return spawnRegion || 'upper-tracery'
  const counts = Object.create(null)
  const step = Math.max(1, Math.floor(points.length / 10))
  let samples = 0
  for (let i = 0; i < points.length; i += step) {
    const p = points[i]
    let ft = p.curveId && graph?.curveById?.get(p.curveId)?.featureType
    if (!ft && graph) {
      const loc = locateOnGraph(graph, p)
      ft = loc?.featureType
    }
    const region = classifyArchitecturalRegion(p, ft, arch)
    counts[region] = (counts[region] ?? 0) + 1
    samples += 1
  }
  let best = 'upper-tracery'
  let n = -1
  let second = 0
  for (const [k, v] of Object.entries(counts)) {
    if (v > n) {
      second = n
      n = v
      best = k
    } else if (v > second) {
      second = v
    }
  }
  if (
    spawnRegion &&
    counts[spawnRegion] &&
    (best !== spawnRegion) &&
    n - (counts[spawnRegion] ?? 0) <= Math.max(1, Math.floor(samples * 0.25))
  ) {
    return spawnRegion
  }
  if (spawnRegion && !counts[best] && counts[spawnRegion]) return spawnRegion
  return best
}

/**
 * Tag anchors with architectural region using sourceFeatureType metadata.
 */
export function regionForAnchor(anchor, arch, graph = null) {
  const ft = anchor?.sourceFeatureType ?? anchor?.featureType ?? null
  const pos = anchor?.position ?? { x: 0, y: 0, z: 0 }
  if (graph && !ft) {
    const loc = locateOnGraph(graph, pos)
    return classifyArchitecturalRegion(pos, loc?.featureType, arch)
  }
  return classifyArchitecturalRegion(pos, ft, arch)
}

/**
 * Build curve-id → region map for debug overlays.
 */
export function buildRegionCurveMap(graph, arch) {
  const map = new Map()
  for (const c of graph?.curves ?? []) {
    const mid =
      c.points?.[Math.floor((c.points.length - 1) / 2)] ??
      { x: 0, y: (arch?.bounds?.y0 ?? 0) + (arch?.bounds?.y1 ?? 4) * 0.5, z: 0 }
    map.set(c.id, classifyArchitecturalRegion(mid, c.featureType, arch))
  }
  return map
}

/**
 * Target accepted-master quotas from density + region table.
 */
export function regionQuotas(maxAccept, density = 0.55) {
  const total = Math.max(2, Math.round(maxAccept))
  const soft = 0.85 + density * 0.3
  const quotas = {}
  let assigned = 0
  const ids = ARCH_REGIONS.map((r) => r.id)
  for (const id of ids) {
    const t = REGION_COMPOSITION[id]?.targetCoverage ?? 0.2
    const q = Math.max(1, Math.round(total * t * soft))
    quotas[id] = q
    assigned += q
  }
  // Normalize if overshot
  while (assigned > total + ids.length) {
    let richest = ids[0]
    for (const id of ids) if (quotas[id] > quotas[richest]) richest = id
    if (quotas[richest] <= 1) break
    quotas[richest] -= 1
    assigned -= 1
  }
  return quotas
}

/**
 * Coverage stats: actual accepted counts vs targets.
 */
export function regionalCoverageStats(accepted, quotas) {
  const actual = Object.create(null)
  for (const r of ARCH_REGIONS) actual[r.id] = 0
  for (const a of accepted ?? []) {
    const id = a.region ?? 'upper-tracery'
    actual[id] = (actual[id] ?? 0) + 1
  }
  const rows = ARCH_REGIONS.map((r) => {
    const target = quotas?.[r.id] ?? 0
    const got = actual[r.id] ?? 0
    return {
      id: r.id,
      label: r.label,
      target,
      actual: got,
      deficit: Math.max(0, target - got),
      saturated: target > 0 && got >= target,
    }
  })
  const regionsHit = rows.filter((r) => r.actual > 0).length
  return { byRegion: actual, rows, regionsHit, quotas }
}

/**
 * Debug colours for region overlay (restrained brutalist palette).
 */
export function regionDebugColor(regionId) {
  switch (regionId) {
    case 'upper-tracery':
      return [0.82, 0.22, 0.18]
    case 'lancet-arches':
      return [0.78, 0.55, 0.22]
    case 'vertical-mullions':
      return [0.55, 0.62, 0.72]
    case 'structural-junctions':
      return [0.85, 0.78, 0.55]
    case 'outer-frame':
      return [0.4, 0.4, 0.38]
    default:
      return [0.35, 0.35, 0.35]
  }
}
