/**
 * Ornament particle trail simulation — Steps 8 / 8.5 + sparse refinement.
 *
 * Fixed-timestep, deterministic. Produces CURVES (trail paths), not meshes.
 * Sparse, architecturally guided ornamental paths (no L-system branching yet).
 */

import { V, seededRandom } from '../gothic/primitives.js'
import { buildCurveGraph, locateOnGraph, pickOutgoing, pointAtS, tangentAtS } from './curveGraph.js'
import { clamp01 } from './extract.js'

export const FIXED_DT = 1 / 30
export const MAX_CATCHUP = 5
export const MAX_PARTICLES = 80
export const MAX_PATH_POINTS = 400
export const MIN_POINT_DIST = 0.02

export const TERMINATION = {
  AGE: 'max-age',
  LENGTH: 'max-path-length',
  BOUNDS: 'left-bounds',
  ENVELOPE: 'growth-envelope',
  ATTACHMENT: 'arch-distance',
  OCCUPANCY: 'occupancy',
  INVALID: 'invalid-geometry',
  UNSTABLE: 'unstable',
  DURATION: 'sim-duration',
  POINTS: 'max-path-points',
}

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

/** Prefer junctions, upper tracery, and high-suitability mullion connections. */
function zoneWeight(anchor, bounds) {
  const y0 = bounds?.y0 ?? 0
  const y1 = bounds?.y1 ?? 6
  const yNorm = clamp01((anchor.position.y - y0) / Math.max(0.2, y1 - y0))
  const type = anchor.sourceFeatureType ?? ''
  let zone = 0.35
  if (type === 'junction') zone = 1.15
  else if (type === 'tracery' || type === 'foil' || type === 'cusp') zone = 0.85 + yNorm * 0.45
  else if (type === 'mullion') zone = 0.45 + yNorm * 0.55
  else if (type === 'frame' || type === 'arch') zone = 0.4 + yNorm * 0.5
  else zone = 0.35 + yNorm * 0.4
  // Upper third bonus
  if (yNorm > 0.55) zone *= 1.15
  if (yNorm < 0.25 && type !== 'junction') zone *= 0.55
  return zone
}

/**
 * Suitability × zone weighted spawn. Prefers ornamental growth zones.
 */
export function selectSpawnAnchors(anchors, count, spawnThreshold, seed, bounds) {
  const rand = seededRandom(seed, 103)
  const eligible = (anchors ?? []).filter((a) => a.suitability >= spawnThreshold)
  const pool = eligible.length
    ? eligible
    : [...(anchors ?? [])].sort((a, b) => b.suitability - a.suitability).slice(0, Math.max(count * 3, 1))
  if (!pool.length) return []

  const weights = pool.map((a) => {
    const suit = Math.max(0.02, a.suitability ** 1.6)
    return suit * zoneWeight(a, bounds)
  })
  const cum = []
  let total = 0
  for (const w of weights) {
    total += w
    cum.push(total)
  }

  const picked = []
  const used = new Set()
  const n = Math.min(count, pool.length)
  let guard = 0
  while (picked.length < n && guard < n * 12) {
    guard += 1
    const r = rand() * total
    let idx = 0
    while (idx < cum.length - 1 && cum[idx] < r) idx += 1
    if (used.has(idx)) continue
    // Spatial separation of spawn tips
    const cand = pool[idx]
    let tooClose = false
    for (const p of picked) {
      if (p.position.distanceToSquared(cand.position) < 0.14 * 0.14) {
        tooClose = true
        break
      }
    }
    if (tooClose) {
      used.add(idx)
      continue
    }
    used.add(idx)
    picked.push(cand)
  }
  for (let i = 0; i < pool.length && picked.length < n; i += 1) {
    if (!used.has(i)) {
      used.add(i)
      picked.push(pool[i])
    }
  }
  return picked
}

/** Lightweight 2D occupancy grid of trail segments (XY). Exported for Step 9 branching. */
export function createOccupancy(bounds, cellSize) {
  const cell = Math.max(0.06, cellSize)
  const map = new Map()
  const key = (ix, iy) => `${ix},${iy}`
  const toCell = (x, y) => [Math.floor(x / cell), Math.floor(y / cell)]

  let seqCounter = 0

  function insertSegment(ax, ay, bx, by, particleId, opts = {}) {
    const seq = seqCounter++
    const mode = opts.mode === 'free' ? 'free' : 'constrained'
    const allowJunction = !!opts.allowJunction
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (cell * 0.45)))
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      const x = ax + (bx - ax) * t
      const y = ay + (by - ay) * t
      const [ix, iy] = toCell(x, y)
      const k = key(ix, iy)
      let bucket = map.get(k)
      if (!bucket) {
        bucket = []
        map.set(k, bucket)
      }
      bucket.push({ x, y, particleId, allowJunction, seq, mode })
    }
    return seq
  }

  /**
   * Query nearby occupancy.
   * Ignores own immediately preceding segments.
   * Constrained-on-constrained sharing of stone centerlines is allowed;
   * free tips compete with everything except junction-tagged samples.
   */
  function query(x, y, particleId, spacing, opts = {}) {
    const recentSeqWindow = opts.recentSeqWindow ?? 18
    const tipMode = opts.mode === 'free' ? 'free' : 'constrained'
    const [cx, cy] = toCell(x, y)
    const r = Math.ceil(spacing / cell) + 1
    const ownRecentCut = seqCounter - recentSeqWindow
    let nearest = Infinity
    let away = V(0, 0, 0)
    let hits = 0
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        const bucket = map.get(key(cx + dx, cy + dy))
        if (!bucket) continue
        for (const s of bucket) {
          if (s.particleId === particleId && s.seq >= ownRecentCut) continue
          // Shared stone travel: constrained tips may overlap constrained trails
          if (tipMode === 'constrained' && s.mode === 'constrained') continue
          if (s.allowJunction && tipMode === 'constrained') continue
          const d = Math.hypot(x - s.x, y - s.y)
          if (d < nearest) nearest = d
          if (d < spacing && d > 1e-6) {
            hits += 1
            away.x += (x - s.x) / d
            away.y += (y - s.y) / d
          }
        }
      }
    }
    if (away.lengthSq() > 1e-10) away.normalize()
    const blockT = tipMode === 'free' ? 0.5 : 0.35
    return {
      blocked: nearest < spacing * blockT,
      crowded: nearest < spacing,
      nearestDist: nearest === Infinity ? 999 : nearest,
      steerAway: away,
      hits,
    }
  }

  function getDebugSegments(limit = 800) {
    const pts = []
    for (const bucket of map.values()) {
      for (const s of bucket) {
        pts.push(s)
        if (pts.length >= limit) return pts
      }
    }
    return pts
  }

  return { insertSegment, query, getDebugSegments, cell, map }
}

function createParticle(id, anchor, graph, rand, mode, role, pathBudget, maxArchDist) {
  const loc = locateOnGraph(graph, anchor.position)
  const curve = loc ? graph.curveById.get(loc.curveId) : null
  let heading = anchor.travelDirection?.clone?.() ?? anchor.direction?.clone?.() ?? V(0, 1, 0)
  if (heading.lengthSq() < 1e-12) heading = V(0, 1, 0)
  else heading.normalize()

  let travelSign = 1
  if (curve) {
    const tan = tangentAtS(curve.points, curve.cum, loc.s)
    travelSign = tan.dot(heading) >= 0 ? 1 : -1
    heading = tan.clone().multiplyScalar(travelSign)
  }

  const curlSign = rand() < 0.5 ? -1 : 1
  const pos = anchor.position.clone()
  const wantsTerminalCurl = role === 'secondary' ? rand() < 0.72 : rand() < 0.38
  const deviationScale = role === 'primary' ? 0.55 : 1.15

  return {
    id,
    role,
    pathBudget,
    maxArchDist,
    position: pos,
    heading: heading.clone(),
    velocity: heading.clone().multiplyScalar(0.4),
    curveId: curve?.id ?? null,
    s: loc?.s ?? 0,
    travelSign,
    mode: 'constrained',
    age: 0,
    pathLength: 0,
    active: true,
    terminationReason: null,
    sourceAnchorId: anchor.id,
    sourceFeatureId: anchor.sourceFeatureId,
    sourceFeatureType: anchor.sourceFeatureType,
    featureHistory: [anchor.sourceFeatureId],
    path: [{ x: pos.x, y: pos.y, z: pos.z, step: 0, t: 0, mode: 'constrained' }],
    curlSign,
    curlPhase: rand() * Math.PI * 2,
    curlRadius: 0.18 + rand() * 0.2,
    curlRadiusTarget: 0.18 + rand() * 0.25,
    freeBlend: 0,
    growthMode: mode,
    releaseAge: role === 'primary' ? 1.4 + rand() * 1.2 : 0.5 + rand() * 0.9,
    lastCurveId: curve?.id ?? null,
    wantsTerminalCurl,
    terminalCurlActive: false,
    deviationScale,
    occupancyStrikes: 0,
    archDistSum: 0,
    archDistSamples: 0,
  }
}

function pushPath(p, step, time, occupancy, nearJunc, minDist = MIN_POINT_DIST) {
  if (p.path.length >= MAX_PATH_POINTS) return false
  const last = p.path[p.path.length - 1]
  const dx = p.position.x - last.x
  const dy = p.position.y - last.y
  const dz = p.position.z - last.z
  const dist2 = dx * dx + dy * dy + dz * dz
  if (dist2 < minDist * minDist) return true
  const dist = Math.sqrt(dist2)
  const mode = p.mode === 'free' ? 'free' : 'constrained'
  const occOpts = { mode, allowJunction: !!nearJunc }
  if (dist > 0.16) {
    const n = Math.min(5, Math.ceil(dist / 0.1))
    for (let i = 1; i < n; i += 1) {
      if (p.path.length >= MAX_PATH_POINTS) return false
      const u = i / n
      const pt = {
        x: last.x + dx * u,
        y: last.y + dy * u,
        z: last.z + dz * u,
        step,
        t: time,
        mode,
      }
      const prevPt = p.path[p.path.length - 1]
      p.path.push(pt)
      occupancy.insertSegment(prevPt.x, prevPt.y, pt.x, pt.y, p.id, occOpts)
    }
  }
  const prev = p.path[p.path.length - 1]
  p.path.push({
    x: p.position.x,
    y: p.position.y,
    z: p.position.z,
    step,
    t: time,
    mode,
  })
  occupancy.insertSegment(prev.x, prev.y, p.position.x, p.position.y, p.id, occOpts)
  return true
}

function envelopeLimits(bounds, envelope) {
  const e = Math.max(0.05, Math.min(1.5, envelope ?? 0.28))
  const half = (bounds.half ?? 1.5) * (1 + e * 0.28)
  const y0 = (bounds.y0 ?? 0) - e * 0.15
  const spanY = Math.max(0.5, (bounds.y1 ?? 6) - (bounds.y0 ?? 0))
  const y1 = (bounds.y1 ?? 6) + e * spanY * 0.12
  const zMax = 0.4 + e * 0.25
  return { half, y0, y1, zMax, margin: 0.16 + e * 0.1 }
}

function envelopeOutside(pos, env) {
  const ox = Math.max(0, Math.abs(pos.x) - env.half)
  const oyLo = Math.max(0, env.y0 - pos.y)
  const oyHi = Math.max(0, pos.y - env.y1)
  const oz = Math.max(0, Math.abs(pos.z) - env.zMax)
  return ox + oyLo + oyHi + oz
}

function envelopePressure(pos, env) {
  const soft = env.margin ?? 0.2
  const nx = Math.max(0, Math.abs(pos.x) - (env.half - soft)) / soft
  const nyLo = Math.max(0, env.y0 + soft - pos.y) / soft
  const nyHi = Math.max(0, pos.y - (env.y1 - soft)) / soft
  const nz = Math.max(0, Math.abs(pos.z) - (env.zMax - soft * 0.6)) / (soft * 0.6)
  return Math.min(1.5, Math.max(nx, nyLo, nyHi, nz))
}

function envelopeInward(pos, env) {
  const steer = V(0, 0, 0)
  const soft = env.margin ?? 0.2
  const edgeX = env.half - soft
  if (Math.abs(pos.x) > edgeX) {
    steer.x -= Math.sign(pos.x) * ((Math.abs(pos.x) - edgeX) / soft)
  }
  if (pos.y < env.y0 + soft) steer.y += (env.y0 + soft - pos.y) / soft
  if (pos.y > env.y1 - soft) steer.y -= (pos.y - (env.y1 - soft)) / soft
  if (Math.abs(pos.z) > env.zMax - soft * 0.5) {
    steer.z -= Math.sign(pos.z) * 0.9
  }
  return steer
}

function nearJunction(graph, pos, tol = 0.16) {
  for (const j of graph.junctions) {
    if (pos.distanceToSquared(j.position) < tol * tol) return true
  }
  return false
}

function terminate(p, reason) {
  p.active = false
  p.terminationReason = reason
}

/**
 * Create a simulation instance (mutable, outside React).
 */
export function createParticleSimulation({ arch, anchors, params }) {
  const growthSeed = Math.round(params.growthSeed ?? 11)
  const rand = seededRandom(growthSeed, 107)
  const graph = buildCurveGraph(arch)
  const scale = windowScale(graph.bounds)

  const particleCount = Math.max(1, Math.min(MAX_PARTICLES, Math.round(params.particleCount ?? 8)))
  const spawnThreshold = clamp01(params.spawnThreshold ?? 0.55)
  const growthMode = params.growthMode === 'hybrid' ? 'hybrid' : 'constrained'
  const duration = Math.max(1, Math.min(60, params.simulationDuration ?? 12))
  const speed = Math.max(0.1, Math.min(3, params.growthSpeed ?? 1))

  const behavior = {
    architecturalFollowing: clamp01(params.architecturalFollowing ?? 0.9),
    upwardBias: clamp01(params.upwardBias ?? 0.35),
    gravity: clamp01(params.gravity ?? 0.25),
    curlStrength: clamp01(params.curlStrength ?? 0.2),
    organicDeviation: clamp01(params.organicDeviation ?? 0.15),
    junctionAttraction: clamp01(params.junctionAttraction ?? 0.55),
    explorationBias: clamp01(params.explorationBias ?? 0.45),
    architecturalProximity: clamp01(params.architecturalProximity ?? 0.82),
    growthEnvelope: Math.max(0.05, Math.min(1.2, params.growthEnvelope ?? 0.28)),
    trailSpacing: Math.max(0.04, Math.min(0.45, params.trailSpacing ?? 0.14)),
    maxArchDistance: Math.max(
      0.06,
      Math.min(
        1.2,
        params.maxArchDistance > 0 ? Number(params.maxArchDistance) : scale * 0.22,
      ),
    ),
  }

  // Path budgets relative to window scale — independent of simulation duration
  const primaryBudget = Math.max(
    1.8,
    params.maximumPathLength > 0 ? Number(params.maximumPathLength) : scale * 2.4,
  )
  const secondaryBudget = Math.max(1.0, primaryBudget * 0.42)

  const env = envelopeLimits(graph.bounds, behavior.growthEnvelope)
  const occupancy = createOccupancy(graph.bounds, behavior.trailSpacing * 0.85)

  const counters = {
    acceptedSegments: 0,
    rejectedGrowth: 0,
    occupancyTerminations: 0,
    attachmentTerminations: 0,
  }

  const spawnAnchors = selectSpawnAnchors(
    anchors,
    particleCount,
    spawnThreshold,
    growthSeed,
    graph.bounds,
  )

  // First ~half are primary (longer, more structural); rest secondary
  const primaryN = Math.max(1, Math.ceil(spawnAnchors.length * 0.45))
  const particles = spawnAnchors.map((a, i) => {
    const role = i < primaryN ? 'primary' : 'secondary'
    const budget = role === 'primary' ? primaryBudget : secondaryBudget
    const maxDist =
      role === 'primary'
        ? behavior.maxArchDistance * 0.85
        : behavior.maxArchDistance * (1.05 + behavior.organicDeviation * 0.4)
    return createParticle(i, a, graph, rand, growthMode, role, budget, maxDist)
  })

  // Seed occupancy lightly at spawn (junction-friendly) so tips don't stack
  for (const p of particles) {
    occupancy.insertSegment(p.position.x, p.position.y, p.position.x, p.position.y, p.id, {
      mode: 'constrained',
      allowJunction: true,
    })
  }

  const visitCounts = new Map()

  const state = {
    graph,
    particles,
    visitCounts,
    occupancy,
    rand,
    growthSeed,
    growthMode,
    duration,
    speed,
    behavior,
    env,
    scale,
    primaryBudget,
    secondaryBudget,
    maxPathLength: primaryBudget,
    time: 0,
    step: 0,
    running: false,
    finished: false,
    accumulator: 0,
    counters,
  }

  function markVisit(curveId, amount = 1) {
    if (!curveId) return
    visitCounts.set(curveId, (visitCounts.get(curveId) ?? 0) + amount)
  }

  function sampleArchDist(p) {
    const loc = locateOnGraph(graph, p.position)
    const d = loc ? loc.dist : behavior.maxArchDistance * 2
    p.archDistSum += d
    p.archDistSamples += 1
    return { loc, dist: d }
  }

  function handleOccupancy(p, _stepLen) {
    const atJ = nearJunction(graph, p.position)
    if (atJ) return { speedScale: 1, ok: true }

    const tipMode = p.mode === 'free' || p.terminalCurlActive ? 'free' : 'constrained'
    // Constrained stone travel: only soft competition with free trails
    const spacing =
      tipMode === 'constrained' ? behavior.trailSpacing * 0.55 : behavior.trailSpacing

    const q = occupancy.query(p.position.x, p.position.y, p.id, spacing, { mode: tipMode })
    if (!q.crowded) return { speedScale: 1, ok: true }

    if (q.steerAway.lengthSq() > 1e-8) {
      p.heading.addScaledVector(q.steerAway, tipMode === 'free' ? 1.0 : 0.45)
      if (p.heading.lengthSq() > 1e-12) p.heading.normalize()
    }

    if (q.blocked && tipMode === 'free') {
      p.occupancyStrikes += 1
      counters.rejectedGrowth += 1
      if (p.occupancyStrikes >= 8) {
        terminate(p, TERMINATION.OCCUPANCY)
        counters.occupancyTerminations += 1
        return { speedScale: 0, ok: false }
      }
      return { speedScale: 0.3, ok: true }
    }

    const t = clamp01(1 - q.nearestDist / spacing)
    return { speedScale: Math.max(tipMode === 'free' ? 0.35 : 0.55, 1 - t * 0.5), ok: true }
  }

  function handleAttachment(p, dist) {
    const limit = p.maxArchDist
    if (dist <= limit * 0.72) return true
    // Soft steer back
    const loc = locateOnGraph(graph, p.position)
    if (loc) {
      const curve = graph.curveById.get(loc.curveId)
      if (curve) {
        const target = pointAtS(curve.points, curve.cum, loc.s)
        const to = target.clone().sub(p.position)
        if (to.lengthSq() > 1e-10) {
          to.normalize()
          const pressure = clamp01((dist - limit * 0.72) / Math.max(0.04, limit * 0.28))
          p.heading.addScaledVector(to, 0.9 + pressure * 1.8)
          if (p.heading.lengthSq() > 1e-12) p.heading.normalize()
        }
      }
    }
    if (dist > limit) {
      terminate(p, TERMINATION.ATTACHMENT)
      counters.attachmentTerminations += 1
      return false
    }
    return true
  }

  function maybeStartTerminalCurl(p) {
    if (!p.wantsTerminalCurl || p.terminalCurlActive) return
    const remain = p.pathBudget - p.pathLength
    const trigger = p.role === 'secondary' ? p.pathBudget * 0.28 : p.pathBudget * 0.18
    if (remain <= trigger && remain > 0.08) {
      p.terminalCurlActive = true
      p.mode = 'free'
    }
  }

  function applyTerminalCurl(p, dt, scaleMul) {
    if (!p.terminalCurlActive) return
    // Localized hook — proportional to window scale, consistent with heading
    const radius = scale * (0.08 + behavior.curlStrength * 0.1) * (p.role === 'secondary' ? 1.15 : 0.9)
    const omega = Math.min(2.2, (0.9 + behavior.curlStrength * 1.4) / Math.max(0.06, radius))
    const remain = Math.max(0, p.pathBudget - p.pathLength)
    const fade = clamp01(remain / Math.max(0.05, p.pathBudget * 0.22))
    const angle = omega * dt * p.curlSign * (0.55 + fade * 0.45) * scaleMul
    if (Math.abs(angle) > 1e-6) {
      p.heading.copy(rotateAroundZ(p.heading, angle))
    }
  }

  function stepParticle(p, dt) {
    if (!p.active) return
    let stepLen = 0.08 * state.speed * (dt / FIXED_DT)

    p.age += dt
    // Duration is a global ceiling only — individual paths end by budget / other reasons
    if (p.pathLength >= p.pathBudget) {
      terminate(p, TERMINATION.LENGTH)
      return
    }

    maybeStartTerminalCurl(p)

    const { dist: archDist } = sampleArchDist(p)
    if (!handleAttachment(p, archDist)) return

    const occ = handleOccupancy(p, stepLen)
    if (!occ.ok || !p.active) return
    stepLen *= occ.speedScale

    if (growthMode === 'constrained' && !p.terminalCurlActive) {
      stepConstrained(p, stepLen, dt)
    } else {
      stepHybrid(p, stepLen, dt)
    }

    if (!p.active) return

    if (!Number.isFinite(p.position.x) || !Number.isFinite(p.position.y)) {
      terminate(p, TERMINATION.UNSTABLE)
      return
    }

    const outside = envelopeOutside(p.position, state.env)
    if (outside > 0.01) {
      const inward = envelopeInward(p.position, state.env)
      if (inward.lengthSq() > 1e-10) {
        const inDir = inward.normalize()
        const outward = Math.max(0, -p.heading.dot(inDir))
        p.heading.addScaledVector(inDir, outward + Math.min(1.6, 0.5 + outside * 2.2))
        if (p.heading.lengthSq() > 1e-12) p.heading.normalize()
      }
      if (outside > 0.75) {
        terminate(p, TERMINATION.ENVELOPE)
        return
      }
    }

    const atJ = nearJunction(graph, p.position)
    const tipMode = p.mode === 'free' || p.terminalCurlActive ? 'free' : 'constrained'
    if (!atJ && tipMode === 'free') {
      const q = occupancy.query(p.position.x, p.position.y, p.id, behavior.trailSpacing * 0.75, {
        mode: 'free',
      })
      if (q.blocked && q.nearestDist < behavior.trailSpacing * 0.4) {
        counters.rejectedGrowth += 1
        p.occupancyStrikes += 1
        if (p.occupancyStrikes >= 7) {
          terminate(p, TERMINATION.OCCUPANCY)
          counters.occupancyTerminations += 1
          return
        }
        return
      }
    }

    const before = p.path.length
    const ok = pushPath(p, state.step, state.time, occupancy, atJ)
    if (!ok) {
      terminate(p, TERMINATION.POINTS)
      return
    }
    if (p.path.length > before) counters.acceptedSegments += p.path.length - before
  }

  function stepConstrained(p, stepLen, _dt) {
    let curve = p.curveId ? graph.curveById.get(p.curveId) : null
    if (!curve) {
      const loc = locateOnGraph(graph, p.position)
      if (!loc || loc.dist > 0.25) {
        terminate(p, TERMINATION.INVALID)
        return
      }
      p.curveId = loc.curveId
      p.s = loc.s
      curve = graph.curveById.get(loc.curveId)
      const tan = tangentAtS(curve.points, curve.cum, loc.s)
      p.travelSign = tan.dot(p.heading) >= 0 ? 1 : -1
      if (!visitCounts.has(p.curveId)) markVisit(p.curveId)
    }

    const nextS = p.s + p.travelSign * stepLen

    if (nextS < 0 || nextS > curve.length) {
      const atStart = nextS < 0
      const jId = atStart ? curve.startJunction : curve.endJunction
      const endS = atStart ? 0 : curve.length
      const endPos = pointAtS(curve.points, curve.cum, endS)
      p.pathLength += p.position.distanceTo(endPos)
      p.position.copy(endPos)
      pushPath(p, state.step, state.time, occupancy, true)

      const tanAtEnd = tangentAtS(curve.points, curve.cum, endS).multiplyScalar(p.travelSign)
      if (jId) {
        const j = graph.junctionById.get(jId)
        if (j) {
          p.pathLength += p.position.distanceTo(j.position)
          p.position.copy(j.position)
          pushPath(p, state.step, state.time, occupancy, true)
        }
        const next = pickOutgoing(graph, jId, curve.id, tanAtEnd, state.rand, {
          upwardBias: behavior.upwardBias,
          suitability: 0.55,
          explorationBias: behavior.explorationBias,
          visitCounts,
        })
        if (next) {
          const nc = graph.curveById.get(next.curveId)
          p.curveId = next.curveId
          p.s = next.s
          p.travelSign = next.travelSign
          p.heading.copy(slerpDir(tanAtEnd, next.dir, 0.72))
          if (nc) {
            const attach = pointAtS(nc.points, nc.cum, next.s)
            p.pathLength += p.position.distanceTo(attach)
            p.position.copy(attach)
            pushPath(p, state.step, state.time, occupancy, true)
          }
          markVisit(next.curveId)
          if (!p.featureHistory.includes(next.curveId)) p.featureHistory.push(next.curveId)
          p.mode = 'constrained'
          p.lastCurveId = next.curveId
          return
        }
        // Prefer terminal curl over reverse thrashing
        if (p.wantsTerminalCurl) {
          p.terminalCurlActive = true
          p.mode = 'free'
          return
        }
        terminate(p, TERMINATION.INVALID)
        return
      }
      if (p.wantsTerminalCurl) {
        p.terminalCurlActive = true
        p.mode = 'free'
        return
      }
      p.s = endS
      p.travelSign *= -1
      p.heading.copy(tangentAtS(curve.points, curve.cum, p.s).multiplyScalar(p.travelSign))
      p.mode = 'constrained'
      return
    }

    p.s = nextS
    const pos = pointAtS(curve.points, curve.cum, p.s)
    const tan = tangentAtS(curve.points, curve.cum, p.s).multiplyScalar(p.travelSign)
    const traveled = p.position.distanceTo(pos)
    p.pathLength += traveled
    markVisit(curve.id, traveled)
    p.position.copy(pos)
    p.heading.copy(tan)
    p.velocity.copy(tan).multiplyScalar(stepLen / Math.max(1e-4, FIXED_DT))
    p.mode = 'constrained'
  }

  function applyLocalizedCurl(p, dt, scaleMul) {
    const b = behavior
    if (b.curlStrength < 0.02 || scaleMul < 0.01) return
    p.curlPhase += dt * (0.3 + b.curlStrength * 0.9)
    const drift = Math.sin(p.curlPhase * 0.4) * 0.45
    p.curlRadiusTarget = scale * (0.06 + b.curlStrength * 0.12) + drift * scale * 0.04
    p.curlRadius += (p.curlRadiusTarget - p.curlRadius) * Math.min(1, dt * 1.2)
    const radius = Math.max(scale * 0.05, p.curlRadius)
    const omega = (b.curlStrength * scaleMul * state.speed * 0.4) / radius
    const turn = Math.min(0.9 + b.curlStrength, omega) * dt * p.curlSign
    const envelope = 0.4 + 0.6 * Math.sin(p.curlPhase * 0.5)
    if (Math.abs(turn * envelope) > 1e-6) {
      p.heading.copy(rotateAroundZ(p.heading, turn * envelope))
    }
  }

  function applyProximityPull(p, dt, scaleMul) {
    const prox = behavior.architecturalProximity
    if (prox < 0.02 || scaleMul < 0.01) return null
    const loc = locateOnGraph(graph, p.position)
    if (!loc) return null
    const curve = graph.curveById.get(loc.curveId)
    if (!curve) return null
    const target = pointAtS(curve.points, curve.cum, loc.s)
    const to = target.clone().sub(p.position)
    const dist = to.length()
    if (dist < 1e-6) return loc
    to.multiplyScalar(1 / dist)
    const falloff = Math.min(2.4, 0.4 + dist / 0.18)
    const pull =
      prox * scaleMul * falloff * (1.1 + behavior.architecturalFollowing * 0.7) * (p.role === 'primary' ? 1.15 : 1)
    p.heading.addScaledVector(to, pull * dt * 8.5)
    if (dist < 0.3) {
      const tan = tangentAtS(curve.points, curve.cum, loc.s)
      const alignSign = tan.dot(p.heading) >= 0 ? 1 : -1
      p.heading.addScaledVector(tan.multiplyScalar(alignSign), prox * (1 - dist / 0.3) * dt * 4.5 * scaleMul)
    }
    if (behavior.junctionAttraction > 0.05) {
      let bestJ = null
      let bestD = 0.55
      for (const j of graph.junctions) {
        const d = p.position.distanceTo(j.position)
        if (d < bestD) {
          bestD = d
          bestJ = j
        }
      }
      if (bestJ) {
        const toJ = bestJ.position.clone().sub(p.position).normalize()
        p.heading.addScaledVector(
          toJ,
          behavior.junctionAttraction * (1 - bestD / 0.55) * dt * 4 * scaleMul * prox,
        )
      }
    }
    if (dist < 0.05 && prox > 0.4 && p.freeBlend < 0.75) {
      p.curveId = loc.curveId
      p.s = loc.s
      if (!p.featureHistory.includes(loc.curveId)) p.featureHistory.push(loc.curveId)
    }
    return loc
  }

  function stepHybrid(p, stepLen, dt) {
    if (p.terminalCurlActive) {
      p.mode = 'free'
      applyTerminalCurl(p, dt, 1)
      applyProximityPull(p, dt, 0.55 + behavior.architecturalProximity * 0.4)
      if (p.heading.lengthSq() < 1e-12) p.heading.set(0, 1, 0)
      else p.heading.normalize()
      const move = p.heading.clone().multiplyScalar(stepLen * 0.65)
      p.position.add(move)
      p.pathLength += move.length()
      p.velocity.copy(p.heading).multiplyScalar(move.length() / Math.max(1e-4, FIXED_DT))
      return
    }

    const releaseT = clamp01((p.age - p.releaseAge * 0.6) / Math.max(1.0, p.releaseAge * 1.6))
    const maxFree =
      (0.08 + behavior.organicDeviation * 0.28) * p.deviationScale * (1.15 - behavior.architecturalFollowing * 0.35)
    const targetBlend = maxFree * releaseT * releaseT
    p.freeBlend += (targetBlend - p.freeBlend) * Math.min(1, dt * 0.9)

    const pressure = envelopePressure(p.position, state.env)
    const onArch = p.freeBlend < 0.12 && p.curveId && pressure < 0.25

    if (onArch) {
      stepConstrained(p, stepLen * (1 - p.freeBlend * 0.2), dt)
      if (!p.active) return
      applyLocalizedCurl(p, dt, p.freeBlend * 0.15 * p.deviationScale)
      applyProximityPull(p, dt, 0.08)
      p.mode = 'constrained'
      return
    }

    p.mode = 'free'
    const envLocal = state.env
    const yMid = (envLocal.y0 + envLocal.y1) * 0.5
    const ySpan = Math.max(0.5, envLocal.y1 - envLocal.y0)
    const yNorm = (p.position.y - yMid) / (ySpan * 0.5)
    const edgeMute = 1 - clamp01(pressure * 0.95)

    p.heading.y += behavior.upwardBias * dt * 0.7 * edgeMute * clamp01(1.05 - Math.max(0, yNorm))
    p.heading.y -= behavior.gravity * dt * 1.6

    applyLocalizedCurl(p, dt, (0.18 + p.freeBlend * 0.2) * edgeMute * p.deviationScale)
    applyTerminalCurl(p, dt, 0.35)
    const loc = applyProximityPull(
      p,
      dt,
      (1.2 + (1 - p.freeBlend) * 0.5) * (1 + pressure * 2) * behavior.architecturalFollowing,
    )

    const inward = envelopeInward(p.position, envLocal)
    if (inward.lengthSq() > 1e-8) {
      const inDir = inward.normalize()
      p.heading.addScaledVector(inDir, dt * (4 + pressure * 7))
      if (pressure > 0.3) {
        const outComp = Math.max(0, -p.heading.dot(inDir))
        p.heading.addScaledVector(inDir, outComp * (0.9 + pressure))
      }
    }

    if (p.heading.lengthSq() < 1e-12) p.heading.set(0, 1, 0)
    else p.heading.normalize()

    const maxTurn = 0.5 + behavior.curlStrength * 0.85
    const prev = p.velocity.lengthSq() > 1e-10 ? p.velocity.clone().normalize() : p.heading.clone()
    const ang = Math.acos(Math.min(1, Math.max(-1, prev.dot(p.heading))))
    const maxAng = maxTurn * dt
    if (ang > maxAng && ang > 1e-5) {
      p.heading.copy(slerpDir(prev, p.heading, maxAng / ang))
    }

    const far = loc ? Math.min(1, loc.dist / Math.max(0.12, p.maxArchDist)) : 1
    const speedScale =
      (0.42 + (1 - p.freeBlend) * 0.28) *
      (1 - far * 0.55 * behavior.architecturalProximity) *
      (1 - pressure * 0.45)
    const move = p.heading.clone().multiplyScalar(stepLen * Math.max(0.22, speedScale))
    const prevX = p.position.x
    const prevY = p.position.y
    const prevZ = p.position.z
    p.position.add(move)

    const out = envelopeOutside(p.position, envLocal)
    if (out > 0) {
      const back = envelopeInward(p.position, envLocal)
      if (back.lengthSq() > 1e-10) {
        p.position.addScaledVector(back.normalize(), Math.min(out, move.length() * 1.2 + 0.015))
      }
    }

    const dx = p.position.x - prevX
    const dy = p.position.y - prevY
    const dz = p.position.z - prevZ
    p.pathLength += Math.hypot(dx, dy, dz)
    p.velocity.set(dx, dy, dz).multiplyScalar(1 / Math.max(1e-4, FIXED_DT))
  }

  function tick() {
    if (state.finished || !state.running) return false
    state.time += FIXED_DT
    state.step += 1
    for (const p of state.particles) {
      stepParticle(p, FIXED_DT)
    }
    // Sim ends when all particles done OR duration ceiling — particles should usually
    // finish earlier via path budget / occupancy / attachment.
    if (state.time >= state.duration || state.particles.every((p) => !p.active)) {
      state.finished = true
      state.running = false
      for (const p of state.particles) {
        if (p.active) terminate(p, TERMINATION.DURATION)
      }
    }
    return true
  }

  function advance(wallDt) {
    if (!state.running || state.finished) return getStats()
    state.accumulator += Math.min(0.1, wallDt)
    let steps = 0
    while (state.accumulator >= FIXED_DT && steps < MAX_CATCHUP && !state.finished) {
      state.accumulator -= FIXED_DT
      tick()
      steps += 1
    }
    return getStats()
  }

  function getTrails() {
    return state.particles.map((p) => ({
      particleId: p.id,
      role: p.role,
      positions: p.path,
      sourceAnchorId: p.sourceAnchorId,
      sourceFeatureId: p.sourceFeatureId,
      features: p.featureHistory,
      mode: p.growthMode,
      active: p.active,
      terminationReason: p.terminationReason,
      pathLength: p.pathLength,
      pathBudget: p.pathBudget,
      age: p.age,
    }))
  }

  function terminationBreakdown() {
    const byReason = {}
    for (const p of state.particles) {
      if (!p.terminationReason) continue
      byReason[p.terminationReason] = (byReason[p.terminationReason] ?? 0) + 1
    }
    return byReason
  }

  function getStats() {
    const trails = getTrails()
    const active = state.particles.filter((p) => p.active).length
    const terminated = state.particles.length - active
    const lengths = state.particles.map((p) => p.pathLength)
    const totalLen = lengths.reduce((n, v) => n + v, 0)
    const totalPoints = state.particles.reduce((n, p) => n + p.path.length, 0)
    const freeSegs = state.particles.reduce(
      (n, p) => n + p.path.filter((pt) => pt.mode === 'free').length,
      0,
    )
    const primary = state.particles.filter((p) => p.role === 'primary')
    const secondary = state.particles.filter((p) => p.role === 'secondary')
    const avgArchDist = (() => {
      let s = 0
      let n = 0
      for (const p of state.particles) {
        if (p.archDistSamples) {
          s += p.archDistSum / p.archDistSamples
          n += 1
        }
      }
      return n ? s / n : 0
    })()
    return {
      time: state.time,
      step: state.step,
      running: state.running,
      finished: state.finished,
      growthMode: state.growthMode,
      growthSeed: state.growthSeed,
      activeParticles: active,
      terminatedParticles: terminated,
      totalTrailCount: trails.filter((t) => t.positions.length > 1).length,
      totalTrailLength: totalLen,
      averageTrailLength: state.particles.length ? totalLen / state.particles.length : 0,
      totalPoints,
      constrainedPoints: totalPoints - freeSegs,
      freePoints: freeSegs,
      particleCount: state.particles.length,
      duration: state.duration,
      maxPathLength: state.primaryBudget,
      primaryBudget: state.primaryBudget,
      secondaryBudget: state.secondaryBudget,
      primaryCount: primary.length,
      secondaryCount: secondary.length,
      avgPrimaryLength: primary.length
        ? primary.reduce((n, p) => n + p.pathLength, 0) / primary.length
        : 0,
      avgSecondaryLength: secondary.length
        ? secondary.reduce((n, p) => n + p.pathLength, 0) / secondary.length
        : 0,
      terminationByReason: terminationBreakdown(),
      acceptedSegments: counters.acceptedSegments,
      rejectedGrowth: counters.rejectedGrowth,
      occupancyTerminations: counters.occupancyTerminations,
      attachmentTerminations: counters.attachmentTerminations,
      averageArchDistance: avgArchDist,
      trailSpacing: behavior.trailSpacing,
      maxArchDistance: behavior.maxArchDistance,
      explorationBias: behavior.explorationBias,
      architecturalProximity: behavior.architecturalProximity,
      growthEnvelope: behavior.growthEnvelope,
      env: state.env,
    }
  }

  function getHeads() {
    return state.particles
      .filter((p) => p.active)
      .map((p) => ({
        id: p.id,
        role: p.role,
        position: p.position.clone(),
        heading: p.heading.clone(),
        mode: p.mode,
      }))
  }

  function getDebug() {
    return {
      env: state.env,
      occupancyPoints: occupancy.getDebugSegments(1200),
      trailSpacing: behavior.trailSpacing,
      maxArchDistance: behavior.maxArchDistance,
    }
  }

  return {
    state,
    start() {
      state.running = true
    },
    pause() {
      state.running = false
    },
    toggle() {
      if (state.finished) return
      state.running = !state.running
    },
    tick,
    advance,
    getTrails,
    getStats,
    getHeads,
    getDebug,
    rebuild(nextParams, nextAnchors) {
      return createParticleSimulation({
        arch,
        anchors: nextAnchors ?? anchors,
        params: { ...params, ...nextParams },
      })
    },
  }
}
