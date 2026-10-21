/**
 * Growth conditions — anchors, suitability, direction field.
 * Deterministic. Architecture and growth seeds are independent.
 */

import { V, seededRandom } from '../gothic/primitives.js'
import { isInOpening, polylineLength, tangentAt, clamp01 } from './extract.js'

const TYPE_WEIGHT_KEY = {
  frame: 'frameAttraction',
  mullion: 'mullionAttraction',
  tracery: 'traceryAttraction',
  junction: 'junctionAttraction',
}

function nearestJunction(pos, junctions) {
  let best = null
  let bestD = Infinity
  for (const j of junctions) {
    const d = pos.distanceToSquared(j.position)
    if (d < bestD) {
      bestD = d
      best = j
    }
  }
  return { junction: best, dist: Math.sqrt(bestD) }
}

function sampleCurveCandidates(curve, spacing, rand) {
  const pts = curve.points
  const len = curve.length || polylineLength(pts)
  if (len < 1e-4 || pts.length < 2) return []
  const start = rand() * spacing * 0.9
  const out = []
  const cum = [0]
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
  }
  let dist = start
  while (dist < len) {
    let i = 1
    while (i < cum.length && cum[i] < dist) i += 1
    const i0 = Math.max(0, i - 1)
    const i1 = Math.min(pts.length - 1, i)
    const segLen = cum[i1] - cum[i0] || 1e-6
    const t = clamp01((dist - cum[i0]) / segLen)
    const pos = pts[i0].clone().lerp(pts[i1], t)
    // Raw curve tangent as sampled — do not force upward orientation here.
    const tangent = tangentAt(pts, i0)
    out.push({
      position: pos,
      tangent,
      sourceFeatureId: curve.id,
      sourceFeatureType: curve.featureType,
      orientation: curve.orientation?.clone?.() ?? V(0, 0, 1),
      priority: 0,
    })
    dist += spacing
  }
  return out
}

/**
 * Score a candidate. Weights change the actual score (wide dynamic range).
 *
 * Normalized blend so attraction knobs remaps relative importance:
 *   score = (typeW·1 + jW·jProx + hW·height) / (typeW + jW + hW)
 */
export function scoreSuitability(candidate, arch, weights) {
  const y0 = arch.bounds?.y0 ?? 0
  const y1 = arch.bounds?.y1 ?? 1
  const heightNorm = clamp01((candidate.position.y - y0) / Math.max(1e-4, y1 - y0))

  const typeKey = TYPE_WEIGHT_KEY[candidate.sourceFeatureType] ?? 'traceryAttraction'
  const typeW = clamp01(weights[typeKey] ?? 0.5)
  const jW = clamp01(weights.junctionAttraction ?? 0.5)
  const hW = clamp01(weights.heightPreference ?? 0.5)

  const { dist: jDist } = nearestJunction(candidate.position, arch.junctions)
  const jProx = clamp01(1 - jDist / 0.4)

  // Type membership: being on a high-attraction feature type scores high.
  // Low typeW → that feature class is unsuitable even if geometrically present.
  const typeTerm = typeW
  const jTerm = jProx
  const hTerm = heightNorm

  const denom = typeW + jW + hW + 1e-6
  let score = (typeW * typeTerm + jW * jTerm + hW * hTerm) / denom

  // Extra penalty when the candidate's type weight is near zero
  if (typeW < 0.15) score *= 0.35 + typeW * 2

  return clamp01(score)
}

/**
 * Preferred travel direction at an anchor (normalized).
 * Keeps curve tangent separate from travel direction.
 */
export function computeDirection(candidate, arch, weights) {
  const follow = clamp01(weights.architecturalFollowing ?? 0.75)
  const upW = clamp01(weights.upwardBias ?? 0.35)
  const jW = clamp01(weights.junctionPull ?? 0.4)
  const outW = clamp01(weights.outwardBias ?? 0.25)

  const tanRaw = candidate.tangent?.clone?.() ?? V(0, 1, 0)
  if (tanRaw.lengthSq() < 1e-12) tanRaw.set(0, 1, 0)
  else tanRaw.normalize()
  const tanOpp = tanRaw.clone().negate()

  // Choose which tangent orientation to follow for travel — bias by upward weight,
  // but do not hard-force every particle onto the same orientation when upW is low.
  let tanFollow = tanRaw
  if (upW > 1e-6) {
    const preferUp = tanRaw.y >= tanOpp.y ? tanRaw : tanOpp
    tanFollow = tanRaw.clone().multiplyScalar(1 - upW).addScaledVector(preferUp, upW)
    if (tanFollow.lengthSq() < 1e-12) tanFollow = preferUp.clone()
    else tanFollow.normalize()
  }

  const dir = V(0, 0, 0)
  dir.addScaledVector(tanFollow, follow)
  dir.addScaledVector(V(0, 1, 0), upW)

  const { junction, dist } = nearestJunction(candidate.position, arch.junctions)
  if (junction && dist > 1e-5 && jW > 1e-6) {
    const toJ = junction.position.clone().sub(candidate.position)
    if (toJ.lengthSq() > 1e-12) {
      toJ.normalize()
      dir.addScaledVector(toJ, jW * clamp01(1 - dist / 0.8))
    }
  }

  const cy = ((arch.bounds?.y0 ?? 0) + (arch.bounds?.y1 ?? 1)) * 0.5
  const outward = V(candidate.position.x, candidate.position.y - cy, 0.4)
  if (outward.lengthSq() > 1e-12) {
    dir.addScaledVector(outward.normalize(), outW)
  } else {
    dir.addScaledVector(V(0, 0, 1), outW)
  }

  if (dir.lengthSq() < 1e-12) return V(0, 1, 0)
  return dir.normalize()
}

/** Dense suitability samples along curves for coloured segment overlays. */
function buildCurveSuitabilitySamples(arch, weights, step = 0.1) {
  const samples = []
  for (const curve of arch.curves ?? []) {
    const pts = curve.points
    if (!pts || pts.length < 2) continue
    const cum = [0]
    for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
    const len = cum[cum.length - 1]
    if (len < 1e-4) continue
    for (let d = 0; d <= len; d += step) {
      let i = 1
      while (i < cum.length && cum[i] < d) i += 1
      const i0 = Math.max(0, i - 1)
      const i1 = Math.min(pts.length - 1, i)
      const segLen = cum[i1] - cum[i0] || 1e-6
      const t = clamp01((d - cum[i0]) / segLen)
      const position = pts[i0].clone().lerp(pts[i1], t)
      const tangent = tangentAt(pts, i0)
      const suitability = scoreSuitability(
        {
          position,
          tangent,
          sourceFeatureId: curve.id,
          sourceFeatureType: curve.featureType,
        },
        arch,
        weights,
      )
      samples.push({
        position,
        suitability,
        sourceFeatureId: curve.id,
        sourceFeatureType: curve.featureType,
      })
    }
  }
  return samples
}

/**
 * Generate growth anchors from extracted architectural features.
 */
export function generateGrowthConditions(arch, params = {}) {
  const anchorCount = Math.max(8, Math.min(400, Math.round(params.anchorCount ?? 120)))
  const minSpacing = Math.max(0.04, Math.min(0.5, params.minAnchorSpacing ?? 0.12))
  const growthSeed = Math.round(params.growthSeed ?? 11)
  const rand = seededRandom(growthSeed, 91)

  const weights = {
    frameAttraction: params.frameAttraction ?? 0.55,
    mullionAttraction: params.mullionAttraction ?? 0.7,
    traceryAttraction: params.traceryAttraction ?? 0.65,
    junctionAttraction: params.junctionAttraction ?? 0.8,
    heightPreference: params.heightPreference ?? 0.45,
    architecturalFollowing: params.architecturalFollowing ?? 0.75,
    upwardBias: params.upwardBias ?? 0.35,
    junctionPull: params.junctionPull ?? 0.4,
    outwardBias: params.outwardBias ?? 0.25,
  }

  const sampleSpacing = Math.max(0.04, minSpacing * 0.55)
  const candidates = []

  for (const curve of arch.curves ?? []) {
    const key = TYPE_WEIGHT_KEY[curve.featureType] ?? 'traceryAttraction'
    const attr = clamp01(weights[key] ?? 0.5)
    if (attr < 0.08 && (arch.curves?.length ?? 0) > 4) continue
    const spacing = sampleSpacing / (0.55 + attr * 0.9)
    for (const s of sampleCurveCandidates(curve, spacing, rand)) {
      if (isInOpening(s.position, arch)) continue
      candidates.push(s)
    }
  }

  // Junctions — dedupe by position first; higher priority so they win spacing ties.
  const seenJ = []
  const jDedup2 = (minSpacing * 0.45) ** 2
  for (const j of arch.junctions ?? []) {
    if (clamp01(weights.junctionAttraction) < 0.05) continue
    if (rand() > 0.4 + weights.junctionAttraction * 0.55) continue
    if (seenJ.some((p) => p.distanceToSquared(j.position) < jDedup2)) continue
    seenJ.push(j.position)
    // Mean tangent from outgoing curves if available
    let tangent = V(0, 1, 0)
    if (j.outgoing?.length) {
      const acc = V(0, 0, 0)
      for (const o of j.outgoing) acc.add(o.direction)
      if (acc.lengthSq() > 1e-12) tangent = acc.normalize()
    }
    candidates.push({
      position: j.position.clone(),
      tangent,
      sourceFeatureId: j.id,
      sourceFeatureType: 'junction',
      orientation: V(0, 0, 1),
      priority: 1,
      outgoing: j.outgoing ?? [],
    })
  }

  for (const c of candidates) {
    c.suitability = scoreSuitability(c, arch, weights)
  }

  // Junctions first (priority), then by suitability
  candidates.sort((a, b) => {
    if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0)
    const ds = b.suitability - a.suitability
    if (Math.abs(ds) > 1e-9) return ds
    return a.position.x + a.position.y * 10 - (b.position.x + b.position.y * 10)
  })

  const selected = []
  const minSp2 = minSpacing * minSpacing
  const makeAnchor = (c, index) => {
    const tanRaw = c.tangent.clone()
    if (tanRaw.lengthSq() < 1e-12) tanRaw.set(0, 1, 0)
    else tanRaw.normalize()
    const travel = computeDirection(c, arch, weights)
    const { junction } = nearestJunction(c.position, arch.junctions)
    const outgoing =
      c.outgoing ??
      (c.sourceFeatureType === 'junction'
        ? arch.junctions.find((j) => j.id === c.sourceFeatureId)?.outgoing ?? []
        : junction?.outgoing ?? [])
    return {
      id: `anchor-${index}`,
      position: c.position,
      sourceFeatureId: c.sourceFeatureId,
      sourceFeatureType: c.sourceFeatureType,
      /** Curve tangent as sampled (orientation for geometry). */
      tangent: tanRaw,
      /** Opposite tangent — alternate travel choice along the same curve. */
      tangentOpposite: tanRaw.clone().negate(),
      /** Blended preferred travel direction for future particles (unit length). */
      direction: travel,
      travelDirection: travel,
      normal: c.orientation?.clone?.() ?? V(0, 0, 1),
      suitability: c.suitability,
      outgoing: (outgoing ?? []).map((o) => ({
        curveId: o.curveId,
        featureType: o.featureType,
        direction: o.direction.clone(),
        end: o.end,
      })),
      seed: growthSeed,
    }
  }

  for (const c of candidates) {
    if (selected.length >= anchorCount) break
    let ok = true
    for (const s of selected) {
      if (c.position.distanceToSquared(s.position) < minSp2) {
        ok = false
        break
      }
    }
    if (!ok) continue
    selected.push(makeAnchor(c, selected.length))
  }

  const curveSamples = buildCurveSuitabilitySamples(arch, weights, Math.max(0.08, minSpacing * 0.7))

  const suitVals = selected.map((a) => a.suitability)
  const avgSuit = suitVals.length ? suitVals.reduce((n, v) => n + v, 0) / suitVals.length : 0
  const minSuit = suitVals.length ? Math.min(...suitVals) : 0
  const maxSuit = suitVals.length ? Math.max(...suitVals) : 0

  // Spacing / duplicate diagnostics
  let spacingViolations = 0
  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < selected.length; j += 1) {
      if (selected[i].position.distanceToSquared(selected[j].position) < minSp2 * 0.98) {
        spacingViolations += 1
      }
    }
  }
  const junctionAnchors = selected.filter((a) => a.sourceFeatureType === 'junction')
  let duplicateJunctions = 0
  for (let i = 0; i < junctionAnchors.length; i += 1) {
    for (let j = i + 1; j < junctionAnchors.length; j += 1) {
      if (junctionAnchors[i].position.distanceToSquared(junctionAnchors[j].position) < jDedup2) {
        duplicateJunctions += 1
      }
    }
  }

  // Direction magnitude check
  const dirNormOk = selected.every((a) => Math.abs(a.direction.length() - 1) < 1e-4)

  return {
    anchors: selected,
    curveSamples,
    candidates: candidates.length,
    stats: {
      featureCount: (arch.curves?.length ?? 0) + (arch.junctions?.length ?? 0),
      curveCount: arch.curves?.length ?? 0,
      junctionCount: arch.junctions?.length ?? 0,
      candidateCount: candidates.length,
      activeAnchorCount: selected.length,
      averageSuitability: avgSuit,
      minSuitability: minSuit,
      maxSuitability: maxSuit,
      growthSeed,
      family: arch.family ?? null,
      archSeed: arch.seed ?? null,
      spacingViolations,
      duplicateJunctions,
      directionNormalized: dirNormOk,
      openingExtractionFeasible: arch.openingAssessment?.feasible ?? false,
    },
    limitations: arch.limitations ?? [],
  }
}
