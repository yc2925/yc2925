/**
 * Step 9 — L-system branching on ornamental particle trails.
 *
 * Post-process: primary trails → sample origins → context-sensitive turtle
 * interpreted relative to local parent tangents + architectural field.
 * Curves only — no solid meshes / leaves.
 */

import { V, seededRandom } from '../gothic/primitives.js'
import { rewrite } from '../lsystems/lsystem.js'
import { buildCurveGraph, locateOnGraph, pointAtS, tangentAtS } from './curveGraph.js'
import { createOccupancy } from './particles.js'
import { clamp01 } from './extract.js'

export const BRANCH_TERMINATION = {
  LENGTH: 'max-length',
  OCCUPANCY: 'occupancy',
  ENVELOPE: 'growth-envelope',
  ATTACHMENT: 'arch-distance',
  GRAMMAR: 'grammar-end',
  INVALID: 'invalid',
}

/** Ornament branching rules — extensible stochastic productions. */
export const ORNAMENT_BRANCH_RULES = {
  // B = growing side branch tip; C = short tendril; K = terminal knot/curl cue
  B: [
    { p: 0.34, s: 'F[+B]F' },
    { p: 0.34, s: 'F[-B]F' },
    { p: 0.18, s: 'FF[+C]' },
    { p: 0.14, s: 'FF[-C]' },
  ],
  C: [
    { p: 0.4, s: 'F[+K]' },
    { p: 0.4, s: 'F[-K]' },
    { p: 0.2, s: 'FK' },
  ],
  K: [{ p: 1, s: 'K' }],
}

const MAX_BRANCHES = 220
const MAX_POINTS_PER_BRANCH = 80
const MAX_SEGMENTS_TOTAL = 5000

function rotateAroundZ(heading, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const x = heading.x * c - heading.y * s
  const y = heading.x * s + heading.y * c
  const out = V(x, y, heading.z)
  if (out.lengthSq() < 1e-12) return V(0, 1, 0)
  return out.normalize()
}

function slerpDir(from, to, t) {
  const a = from.clone().normalize()
  const b = to.clone().normalize()
  return a.multiplyScalar(1 - t).addScaledVector(b, t).normalize()
}

function windowScale(bounds) {
  const half = bounds?.half ?? 1.5
  const spanY = Math.max(0.5, (bounds?.y1 ?? 6) - (bounds?.y0 ?? 0))
  return Math.max(1.2, Math.min(half, spanY) * 0.55 + half * 0.35)
}

function envelopeLimits(bounds, envelope) {
  const e = Math.max(0.05, Math.min(1.2, envelope ?? 0.28))
  const half = (bounds.half ?? 1.5) * (1 + e * 0.28)
  const y0 = (bounds.y0 ?? 0) - e * 0.15
  const spanY = Math.max(0.5, (bounds.y1 ?? 6) - (bounds.y0 ?? 0))
  const y1 = (bounds.y1 ?? 6) + e * spanY * 0.12
  return { half, y0, y1 }
}

function inEnvelope(pos, env) {
  return Math.abs(pos.x) <= env.half && pos.y >= env.y0 && pos.y <= env.y1
}

/**
 * Build arc-length parameterized polyline from trail positions.
 */
export function trailPolyline(trail) {
  const raw = trail.positions ?? []
  const pts = raw.map((p) => V(p.x, p.y, p.z ?? 0))
  if (pts.length < 2) {
    return { points: pts, cum: [0], length: 0, modes: [], times: [] }
  }
  const cum = [0]
  const modes = [raw[0]?.mode ?? 'constrained']
  const times = [raw[0]?.t ?? 0]
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
    modes.push(raw[i]?.mode ?? modes[i - 1])
    times.push(raw[i]?.t ?? times[i - 1])
  }
  return { points: pts, cum, length: cum[cum.length - 1], modes, times }
}

function sampleAtS(poly, s) {
  const { points, cum, length, modes } = poly
  if (length < 1e-8 || points.length < 2) {
    return {
      position: points[0]?.clone?.() ?? V(0, 0, 0),
      tangent: V(0, 1, 0),
      mode: 'constrained',
    }
  }
  const d = Math.min(length, Math.max(0, s))
  let i = 1
  while (i < cum.length && cum[i] < d) i += 1
  const i0 = Math.max(0, i - 1)
  const i1 = Math.min(points.length - 1, i)
  const seg = cum[i1] - cum[i0] || 1e-6
  const t = clamp01((d - cum[i0]) / seg)
  const position = points[i0].clone().lerp(points[i1], t)
  const tangent = points[i1].clone().sub(points[i0])
  if (tangent.lengthSq() < 1e-12) tangent.set(0, 1, 0)
  else tangent.normalize()
  return { position, tangent, mode: modes[i0] ?? 'constrained' }
}

/**
 * Non-uniform origin samples along a parent polyline (avoids comb patterns).
 */
function sampleOrigins(poly, density, rand, generation) {
  const minLen = generation >= 2 ? 0.12 : 0.22
  if (poly.length < minLen) return []
  const baseGap = Math.max(0.1, 0.42 - density * 0.28) * (1 + generation * 0.08)
  const origins = []
  let s = poly.length * (0.1 + rand() * 0.08)
  const end = poly.length * (0.9 - rand() * 0.05)
  while (s < end) {
    const jitter = (rand() - 0.5) * baseGap * 0.55
    const at = Math.min(end, Math.max(0.05, s + jitter))
    const sample = sampleAtS(poly, at)
    // Prefer free segments and mid-height openings for visible gestures
    const prefer = (sample.mode === 'free' ? 0.22 : 0) + (sample.position.y > 1.5 ? 0.08 : 0)
    if (rand() < 0.4 + density * 0.5 + prefer) {
      origins.push({ s: at, ...sample })
    }
    s += baseGap * (0.7 + rand() * 0.65)
  }
  return origins
}

function suitabilityNear(pos, curveSamples, graph) {
  if (curveSamples?.length) {
    let best = 0
    let bestD = 0.35 * 0.35
    for (const c of curveSamples) {
      const d = pos.distanceToSquared(c.position)
      if (d < bestD) {
        bestD = d
        best = c.suitability ?? 0.5
      }
    }
    if (bestD < 0.35 * 0.35) return best
  }
  const loc = locateOnGraph(graph, pos)
  if (!loc) return 0.35
  // Distance proxy when no sample field
  return clamp01(1 - loc.dist / 0.45) * 0.55 + 0.25
}

function applyArchSteer(heading, pos, graph, attraction, dtScale = 1) {
  if (attraction < 0.02) return heading
  const loc = locateOnGraph(graph, pos)
  if (!loc) return heading
  const curve = graph.curveById.get(loc.curveId)
  if (!curve) return heading
  const target = pointAtS(curve.points, curve.cum, loc.s)
  const to = target.clone().sub(pos)
  const dist = to.length()
  if (dist < 1e-6) return heading
  to.multiplyScalar(1 / dist)
  // Soft pull — never a hard snap onto the parent stone
  const pull = attraction * Math.min(1.1, dist / 0.35) * dtScale
  const next = heading.clone().addScaledVector(to, pull * 0.28)
  if (loc.dist < 0.18) {
    const tan = tangentAtS(curve.points, curve.cum, loc.s)
    const sign = tan.dot(next) >= 0 ? 1 : -1
    next.addScaledVector(tan.multiplyScalar(sign), attraction * (1 - loc.dist / 0.18) * 0.18)
  }
  let bestJ = null
  let bestD = 0.45
  for (const j of graph.junctions) {
    const d = pos.distanceTo(j.position)
    if (d < bestD) {
      bestD = d
      bestJ = j
    }
  }
  if (bestJ) {
    next.addScaledVector(
      bestJ.position.clone().sub(pos).normalize(),
      attraction * (1 - bestD / 0.45) * 0.12,
    )
  }
  if (next.lengthSq() < 1e-12) return heading
  return next.normalize()
}

/** Bias growth into nearby openings (away from stone, toward window centre). */
function applyOpeningBias(heading, pos, graph, bounds, strength) {
  if (strength < 0.02) return heading
  const loc = locateOnGraph(graph, pos)
  const next = heading.clone()
  if (loc && loc.dist < 0.4) {
    const curve = graph.curveById.get(loc.curveId)
    if (curve) {
      const target = pointAtS(curve.points, curve.cum, loc.s)
      const away = pos.clone().sub(target)
      if (away.lengthSq() > 1e-10) {
        away.normalize()
        // Stronger when still glued to stone
        const near = clamp01(1 - loc.dist / 0.35)
        next.addScaledVector(away, strength * (0.35 + near * 0.85))
      }
    }
  }
  const yMid = ((bounds?.y0 ?? 0) + (bounds?.y1 ?? 6)) * 0.5
  const toCentre = V(-pos.x * 0.15, (yMid - pos.y) * 0.35, 0)
  if (toCentre.lengthSq() > 1e-10) {
    next.addScaledVector(toCentre.normalize(), strength * 0.22)
  }
  if (next.lengthSq() < 1e-12) return heading
  return next.normalize()
}

/**
 * Context-sensitive axiom — prefer longer F-runs for visible ornamental gestures.
 */
function chooseAxiom(suit, rand, symmetryBias, sideSign, generation) {
  const long = generation <= 1
  if (long) {
    if (suit > 0.6) {
      return sideSign > 0 ? 'FFFF[+C]FFF' : 'FFFF[-C]FFF'
    }
    if (rand() < 0.4 + symmetryBias * 0.15) {
      return sideSign > 0 ? 'FFF[+B]FFFF' : 'FFF[-B]FFFF'
    }
    return sideSign > 0 ? 'FFFF[+C]FF[+K]' : 'FFFF[-C]FF[-K]'
  }
  if (suit > 0.55) {
    return rand() < 0.5 ? 'FFF[+C]' : 'FFF[-C]'
  }
  return sideSign > 0 ? 'FF[+B]F' : 'FF[-B]F'
}

/**
 * Grow one branch by interpreting a rewritten word relative to origin tangent.
 */
function growFromGrammar({
  id,
  parentId,
  generation,
  origin,
  originTangent,
  axiom,
  string,
  stepLen,
  angleRad,
  maxLen,
  curlInfluence,
  archAttraction,
  symmetryBias,
  graph,
  occupancy,
  spacing,
  env,
  bounds,
  maxArchDist,
  rand,
  wantCurl,
  curlStyle,
}) {
  const points = [{ x: origin.x, y: origin.y, z: origin.z, mode: 'branch' }]
  let heading = originTangent.clone().normalize()
  let pos = origin.clone()
  let length = 0
  let terminationReason = BRANCH_TERMINATION.GRAMMAR
  const stack = []
  let curlPhase = rand() * Math.PI * 2
  let segmentsAccepted = 0
  // Longer grace so tip can leave the parent before occupancy / arch pull engage
  let grace = Math.min(10, Math.floor(5 + (3 - generation) * 2))

  const turn = (sign) => {
    const jitter = (rand() - 0.5) * 0.18
    const sym = 1 + (symmetryBias - 0.5) * 0.12 * sign
    heading = rotateAroundZ(heading, sign * angleRad * sym * (1 + jitter))
  }

  for (const symbol of string) {
    if (length >= maxLen || points.length >= MAX_POINTS_PER_BRANCH) {
      terminationReason = BRANCH_TERMINATION.LENGTH
      break
    }
    switch (symbol) {
      case 'F': {
        const progress = clamp01(length / Math.max(0.1, maxLen))
        // First steps follow originTangent so the branch leaves the parent smoothly
        const committed = segmentsAccepted >= 2
        const depart = progress < 0.38
        const archW = !committed
          ? 0
          : depart
            ? archAttraction * 0.12
            : archAttraction * (0.45 + progress * 0.4)
        const openW = !committed ? 0 : depart ? 0.85 : 0.35 * (1 - progress * 0.5)

        if (committed) {
          heading = applyOpeningBias(heading, pos, graph, bounds, openW)
          heading = applyArchSteer(heading, pos, graph, archW, 1)
        }

        // Mid-path flowing curvature (S / tendril), not a constant circle
        if (curlInfluence > 0.04 && progress > 0.15 && progress < 0.75) {
          curlPhase += 0.28 + curlInfluence * 0.2
          const sCurve = Math.sin(curlPhase * 0.7) * Math.cos(curlPhase * 0.31)
          const curlAng = curlInfluence * 0.1 * sCurve * (curlStyle === 's' ? 1.35 : 0.7)
          heading = rotateAroundZ(heading, curlAng * (rand() < 0.5 ? 1 : -1) * 0.15 + curlAng)
        }

        // Terminal flourish intensifies near the tip when requested
        if (wantCurl && progress > 0.62) {
          curlPhase += 0.45
          const hook =
            curlInfluence *
            0.16 *
            (curlStyle === 'hook' ? 1.4 : curlStyle === 'spiral' ? 1.1 : 0.85) *
            Math.sin(curlPhase * (curlStyle === 'spiral' ? 1.1 : 0.55))
          heading = rotateAroundZ(heading, hook * (curlStyle === 'hook' ? 1 : heading.x >= 0 ? 1 : -1))
        }

        const prev =
          points.length >= 2
            ? V(
                points[points.length - 1].x - points[points.length - 2].x,
                points[points.length - 1].y - points[points.length - 2].y,
                0,
              )
            : heading.clone()
        if (prev.lengthSq() > 1e-10) {
          const pn = prev.normalize()
          const ang = Math.acos(Math.min(1, Math.max(-1, pn.dot(heading))))
          const maxAng = 0.48
          if (ang > maxAng) heading = slerpDir(pn, heading, maxAng / ang)
        }

        const moveLen = stepLen * (0.9 + rand() * 0.25)
        const next = pos.clone().addScaledVector(heading, moveLen)

        if (!inEnvelope(next, env)) {
          // Soft inward steer once before terminating
          const inward = V(-Math.sign(next.x) * 0.4, next.y > env.y1 ? -0.5 : next.y < env.y0 ? 0.5 : 0, 0)
          if (inward.lengthSq() > 1e-8) {
            heading = slerpDir(heading, inward.normalize(), 0.55)
            next.copy(pos).addScaledVector(heading, moveLen * 0.7)
          }
          if (!inEnvelope(next, env)) {
            terminationReason = BRANCH_TERMINATION.ENVELOPE
            break
          }
        }

        const loc = locateOnGraph(graph, next)
        if (loc && loc.dist > maxArchDist) {
          // Soft return — do not snap; allow a little overshoot then terminate gracefully
          heading = applyArchSteer(heading, pos, graph, Math.max(0.35, archAttraction * 0.7), 1.1)
          const retry = pos.clone().addScaledVector(heading, moveLen * 0.65)
          const loc2 = locateOnGraph(graph, retry)
          if (!loc2 || loc2.dist > maxArchDist * 1.15) {
            terminationReason = BRANCH_TERMINATION.ATTACHMENT
            break
          }
          next.copy(retry)
        }

        grace = Math.max(0, grace - 1)
        if (grace === 0) {
          const q = occupancy.query(next.x, next.y, id, spacing, {
            mode: 'free',
            recentSeqWindow: 14,
          })
          if (q.blocked) {
            if (q.steerAway.lengthSq() > 1e-8) {
              heading = slerpDir(heading, q.steerAway, 0.5)
              const alt = pos.clone().addScaledVector(heading, moveLen * 0.75)
              const q2 = occupancy.query(alt.x, alt.y, id, spacing * 0.9, {
                mode: 'free',
                recentSeqWindow: 14,
              })
              if (q2.blocked) {
                terminationReason = BRANCH_TERMINATION.OCCUPANCY
                break
              }
              next.copy(alt)
            } else {
              terminationReason = BRANCH_TERMINATION.OCCUPANCY
              break
            }
          } else if (q.crowded && q.steerAway.lengthSq() > 1e-8) {
            heading = slerpDir(heading, heading.clone().add(q.steerAway).normalize(), 0.3)
          }
        }

        occupancy.insertSegment(pos.x, pos.y, next.x, next.y, id, { mode: 'free' })
        pos.copy(next)
        length += moveLen
        points.push({ x: pos.x, y: pos.y, z: pos.z, mode: 'branch' })
        segmentsAccepted += 1
        break
      }
      case 'f': {
        pos.addScaledVector(heading, stepLen * 0.6)
        break
      }
      case '+':
        turn(1)
        break
      case '-':
        turn(-1)
        break
      case '[':
        stack.push({
          pos: pos.clone(),
          heading: heading.clone(),
          length,
        })
        break
      case ']':
        if (stack.length) {
          const st = stack.pop()
          pos.copy(st.pos)
          heading.copy(st.heading)
        }
        break
      case 'K': {
        if (wantCurl || curlInfluence > 0.2) {
          const hooks =
            curlStyle === 'spiral' ? 5 + Math.floor(rand() * 3) : curlStyle === 's' ? 4 : 3 + Math.floor(rand() * 2)
          const sign = rand() < 0.5 ? 1 : -1
          for (let h = 0; h < hooks && length < maxLen * 1.05; h += 1) {
            const taper = 1 - h / (hooks + 1)
            const ang =
              (0.28 + curlInfluence * 0.35) *
              sign *
              (curlStyle === 'spiral' ? 0.85 + h * 0.08 : curlStyle === 's' ? (h % 2 === 0 ? 1 : -0.7) : 1) *
              taper
            heading = rotateAroundZ(heading, ang)
            const tip = pos.clone().addScaledVector(heading, stepLen * (0.5 + taper * 0.2))
            if (!inEnvelope(tip, env)) break
            const q = occupancy.query(tip.x, tip.y, id, spacing * 0.8, { mode: 'free' })
            if (q.blocked) break
            occupancy.insertSegment(pos.x, pos.y, tip.x, tip.y, id, { mode: 'free' })
            pos.copy(tip)
            length += stepLen * 0.55
            points.push({ x: pos.x, y: pos.y, z: pos.z, mode: 'curl' })
          }
        }
        break
      }
      default:
        break
    }
    if (
      terminationReason === BRANCH_TERMINATION.OCCUPANCY ||
      terminationReason === BRANCH_TERMINATION.ATTACHMENT ||
      terminationReason === BRANCH_TERMINATION.ENVELOPE
    ) {
      break
    }
  }

  const locEnd = locateOnGraph(graph, pos)
  return {
    id,
    parentId,
    generation,
    origin: { x: origin.x, y: origin.y, z: origin.z },
    originTangent: { x: originTangent.x, y: originTangent.y, z: originTangent.z },
    points,
    length,
    terminationReason: points.length < 2 ? BRANCH_TERMINATION.INVALID : terminationReason,
    architecturalFeatureId: locEnd?.curveId ?? null,
    axiom,
    string,
    children: [],
    segmentsAccepted,
  }
}

/**
 * Generate hierarchical ornamental network from completed particle trails.
 */
export function generateOrnamentBranches({ trails, arch, curveSamples, params = {} }) {
  const t0 =
    typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()

  const generations = Math.max(0, Math.min(3, Math.round(params.branchGenerations ?? 1)))
  const density = clamp01(params.branchDensity ?? 0.4)
  const angleDeg = Math.max(8, Math.min(55, params.branchAngle ?? 34))
  const lengthDecay = Math.max(0.3, Math.min(0.85, params.lengthDecay ?? 0.48))
  const archAttraction = clamp01(params.architecturalAttraction ?? 0.55)
  const curlInfluence = clamp01(params.curlInfluence ?? 0.42)
  const symmetryBias = clamp01(params.symmetryBias ?? 0.55)
  const growthSeed = Math.round(params.growthSeed ?? params.branchSeed ?? 11)
  const trailSpacing = Math.max(0.06, params.trailSpacing ?? 0.14)
  const growthEnvelope = params.growthEnvelope ?? 0.32

  const graph = buildCurveGraph(arch)
  const scale = windowScale(graph.bounds)
  const env = envelopeLimits(graph.bounds, growthEnvelope)
  // Wider leash so branches can occupy openings without clinging to stone
  const maxArchDist =
    params.maxArchDistance > 0 ? Number(params.maxArchDistance) : scale * 0.55
  const occupancy = createOccupancy(graph.bounds, trailSpacing * 0.75)
  const rand = seededRandom(growthSeed, 211)

  const branches = []
  let nextId = 0
  let totalSegments = 0
  const stats = {
    originsAttempted: 0,
    branchesAccepted: 0,
    branchesRejected: 0,
    occupancyTerminations: 0,
    byGeneration: { 0: 0, 1: 0, 2: 0, 3: 0 },
  }

  // --- Generation 0: primary trails ---
  const gen0 = []
  for (const trail of trails ?? []) {
    const poly = trailPolyline(trail)
    if (poly.length < 0.12 || poly.points.length < 2) continue
    const id = `p${trail.particleId ?? nextId}`
    nextId += 1
    // Seed occupancy from primary path
    for (let i = 1; i < poly.points.length; i += 1) {
      const a = poly.points[i - 1]
      const b = poly.points[i]
      occupancy.insertSegment(a.x, a.y, b.x, b.y, id, {
        mode: trail.positions?.[i]?.mode === 'free' ? 'free' : 'constrained',
      })
      totalSegments += 1
    }
    const branch = {
      id,
      parentId: null,
      generation: 0,
      role: trail.role ?? 'primary',
      origin: {
        x: poly.points[0].x,
        y: poly.points[0].y,
        z: poly.points[0].z,
      },
      originTangent: sampleAtS(poly, 0.05).tangent,
      points: poly.points.map((p, i) => ({
        x: p.x,
        y: p.y,
        z: p.z,
        mode: poly.modes[i] ?? 'constrained',
        t: poly.times[i] ?? 0,
      })),
      pointTimes: [...poly.times],
      length: poly.length,
      pathBudget: trail.pathBudget,
      sourceAnchorId: trail.sourceAnchorId,
      sourceFeatureId: trail.sourceFeatureId,
      architecturalFeatureId: trail.sourceFeatureId ?? trail.features?.[0] ?? null,
      features: trail.features ?? [],
      terminationReason: trail.terminationReason ?? 'primary-trail',
      children: [],
      poly,
      particleId: trail.particleId,
      parentAttachmentS: 0,
      birthTime: 0,
      growthDuration: 0,
      revealMode: 'timestamp',
    }
    branches.push(branch)
    gen0.push(branch)
    stats.byGeneration[0] += 1
    stats.branchesAccepted += 1
  }

  if (generations === 0) {
    const ms =
      (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0
    return {
      branches,
      roots: gen0.map((b) => b.id),
      stats: {
        ...stats,
        elapsedMs: ms,
        generations,
        totalSegments,
        branchCount: branches.length,
      },
      params: {
        branchGenerations: generations,
        branchDensity: density,
        branchAngle: angleDeg,
        lengthDecay,
        architecturalAttraction: archAttraction,
        curlInfluence,
        symmetryBias,
      },
    }
  }

  // Rewrite depth for turtle words — keep small; hierarchy comes from gen loop
  const rewriteIters = 1

  let parents = gen0
  for (let gen = 1; gen <= generations; gen += 1) {
    if (branches.length >= MAX_BRANCHES || totalSegments >= MAX_SEGMENTS_TOTAL) break
    const nextParents = []
    // Gen-1: prominent gestures (~1.6–2.0× window scale unit); later gens decay
    const lenScale = gen === 1 ? 1.75 : 1.75 * Math.pow(lengthDecay, gen - 1)
    const baseLen = scale * lenScale
    const stepLen = Math.max(0.05, baseLen / (gen === 1 ? 14 : 11))
    const angleRad = (angleDeg * Math.PI) / 180 * (1 - (gen - 1) * 0.06)
    const spacing = trailSpacing * (0.9 + gen * 0.1)

    for (const parent of parents) {
      if (branches.length >= MAX_BRANCHES) break
      const poly = parent.poly ?? trailPolyline({ positions: parent.points })
      const origins = sampleOrigins(poly, density * (1.1 - gen * 0.12), rand, gen)
      const maxPerParent = Math.max(
        1,
        Math.round(1 + density * (gen === 1 ? 3.5 : 2.4) - gen * 0.3),
      )
      const picked = []
      const minSep = gen >= 2 ? 0.1 : 0.14
      // Prefer free-mode samples first for opening exploration
      const ordered = [...origins].sort((a, b) => {
        const af = a.mode === 'free' ? 1 : 0
        const bf = b.mode === 'free' ? 1 : 0
        return bf - af
      })
      for (const o of ordered) {
        if (picked.length >= maxPerParent) break
        if (picked.some((p) => Math.abs(p.s - o.s) < minSep)) continue
        picked.push(o)
      }
      if (!picked.length && origins.length && density > 0.12) {
        picked.push(origins[Math.floor(rand() * origins.length)])
      }

      for (const o of picked) {
        stats.originsAttempted += 1
        const suit = suitabilityNear(o.position, curveSamples, graph)
        if (suit < 0.12 && density < 0.55) {
          stats.branchesRejected += 1
          continue
        }
        const sideSign = rand() < 0.5 + (symmetryBias - 0.5) * 0.3 ? 1 : -1
        const axiom = chooseAxiom(suit, rand, symmetryBias, sideSign, gen)
        const { string } = rewrite(
          axiom,
          ORNAMENT_BRANCH_RULES,
          rewriteIters,
          growthSeed + nextId * 17 + gen * 31,
        )

        // Clear departure from parent tangent (still continuous at origin)
        const departAngle = angleRad * (0.95 + rand() * 0.35)
        const branchHeading = rotateAroundZ(o.tangent, sideSign * departAngle)

        const id = `b${nextId++}`
        const wantCurl =
          gen >= 2
            ? rand() < 0.55 + curlInfluence * 0.3
            : rand() < 0.38 + curlInfluence * 0.35
        const curlRoll = rand()
        const curlStyle =
          curlRoll < 0.34 ? 'hook' : curlRoll < 0.62 ? 's' : curlRoll < 0.82 ? 'spiral' : 'none'
        const grown = growFromGrammar({
          id,
          parentId: parent.id,
          generation: gen,
          origin: o.position,
          originTangent: branchHeading,
          axiom,
          string,
          stepLen,
          angleRad,
          maxLen: baseLen * (0.85 + suit * 0.35),
          curlInfluence: curlInfluence * (gen === 1 ? 1.05 : gen === 3 ? 1.3 : 1.15),
          archAttraction: archAttraction * (0.75 + suit * 0.15),
          symmetryBias,
          graph,
          occupancy,
          spacing,
          env,
          bounds: graph.bounds,
          maxArchDist: maxArchDist * (gen === 1 ? 1.05 : 0.9),
          rand,
          wantCurl: wantCurl && curlStyle !== 'none',
          curlStyle: wantCurl ? curlStyle : 'none',
        })

        if (grown.points.length < 4 || grown.length < stepLen * 2.5) {
          stats.branchesRejected += 1
          continue
        }
        if (grown.terminationReason === BRANCH_TERMINATION.OCCUPANCY) {
          stats.occupancyTerminations += 1
        }

        grown.poly = trailPolyline({ positions: grown.points })
        grown.role = gen === 1 ? 'secondary' : 'tertiary'
        grown.parentAttachmentS = o.s
        grown.attachmentPosition = { x: o.position.x, y: o.position.y, z: o.position.z }
        grown.birthTime = 0
        grown.growthDuration = 0
        grown.revealMode = 'arc'
        parent.children.push(grown.id)
        branches.push(grown)
        nextParents.push(grown)
        stats.branchesAccepted += 1
        stats.byGeneration[gen] = (stats.byGeneration[gen] ?? 0) + 1
        totalSegments += Math.max(0, grown.points.length - 1)

        if (totalSegments >= MAX_SEGMENTS_TOTAL) break
      }
    }
    parents = nextParents
    if (!parents.length) break
  }

  const ms =
    (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0

  return {
    branches,
    roots: gen0.map((b) => b.id),
    stats: {
      ...stats,
      elapsedMs: ms,
      generations,
      totalSegments,
      branchCount: branches.length,
    },
    params: {
      branchGenerations: generations,
      branchDensity: density,
      branchAngle: angleDeg,
      lengthDecay,
      architecturalAttraction: archAttraction,
      curlInfluence,
      symmetryBias,
    },
  }
}

/**
 * Run particle sim to completion and return trails (for branching post-process).
 */
export function completeParticleTrails(sim) {
  if (!sim) return []
  if (!sim.state.finished) {
    sim.start()
    let guard = 0
    while (!sim.state.finished && guard < 20000) {
      sim.tick()
      guard += 1
    }
  }
  return sim.getTrails().filter((t) => (t.positions?.length ?? 0) >= 2)
}
