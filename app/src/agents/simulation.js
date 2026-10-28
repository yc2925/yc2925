/**
 * Steps 11A–11B — Fixed-timestep agents + graph-local stigmergy.
 *
 * Real-time updates (not a precomputed reveal). Deterministic seeded RNG.
 * Bilateral pairs share master decisions; mirrors reflect geometry / field.
 */

import * as THREE from 'three'
import { seededRandom } from '../gothic/primitives.js'
import { buildCurveGraph, locateOnGraph, pickOutgoing, pointAtS, tangentAtS } from '../ornament/curveGraph.js'
import { createAgent, roleForIndex, serializeAgent, STATE, agentRng } from './agentModel.js'
import {
  buildCompleteQuota,
  depositAcceptLength,
  depositAcceptSteps,
  energyCost,
  transition,
} from './fsm.js'
import { createStigmergyField, stigmergyEdgeScore } from './stigmergyField.js'
import { collectCompareSnapshot } from './compareMetrics.js'
import {
  ARCH_REGIONS,
  classifyArchitecturalRegion,
  regionForAnchor,
} from './architecturalRegions.js'

const FIXED_DT = 1 / 30
const TRAIL_MIN_STEP = 0.04
const MAX_TRAIL = 64

function trailLength(trail) {
  let len = 0
  for (let i = 1; i < trail.length; i += 1) {
    const a = trail[i - 1]
    const b = trail[i]
    len += Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0))
  }
  return len
}

function pushTrail(agent, maxPoints) {
  const p = agent.position
  const last = agent.trail[agent.trail.length - 1]
  if (
    last &&
    Math.hypot(p.x - last.x, p.y - last.y, p.z - (last.z ?? 0)) < TRAIL_MIN_STEP
  ) {
    return
  }
  agent.trail.push({ x: p.x, y: p.y, z: p.z })
  const cap = Math.max(8, maxPoints ?? MAX_TRAIL)
  if (agent.trail.length > cap) agent.trail.splice(0, agent.trail.length - cap)
}

/** Archive deposit/build samples for Step 11C ornament construction (masters). */
function pushConstructionSample(agent, time, field, maxPoints = 420) {
  if (agent.isMirror) return
  if (agent.state !== STATE.DEPOSITING && agent.state !== STATE.BUILDING) return
  const p = agent.position
  if (!agent.constructionPath) agent.constructionPath = []
  if (!agent.fieldAccum) {
    agent.fieldAccum = { attraction: 0, inhibition: 0, occupancy: 0, samples: 0 }
  }
  const path = agent.constructionPath
  const last = path[path.length - 1]
  if (
    last &&
    Math.hypot(p.x - last.x, p.y - last.y, p.z - (last.z ?? 0)) < TRAIL_MIN_STEP
  ) {
    return
  }
  path.push({
    x: p.x,
    y: p.y,
    z: p.z,
    t: time,
    curveId: agent.curveId ?? null,
    s: agent.s ?? 0,
  })
  if (path.length > maxPoints) path.splice(0, path.length - maxPoints)
  if (field && agent.curveId) {
    const sample = field.sampleAt(agent.curveId, agent.s)
    agent.fieldAccum.attraction += sample.attraction ?? 0
    agent.fieldAccum.inhibition += sample.inhibition ?? 0
    agent.fieldAccum.occupancy += sample.occupancy ?? 0
    agent.fieldAccum.samples += 1
  }
}

function mirrorVecX(v, axisX) {
  return new THREE.Vector3(axisX - (v.x - axisX), v.y, v.z)
}

function countByState(agents) {
  const counts = {
    dormant: 0,
    exploring: 0,
    depositing: 0,
    building: 0,
    blocked: 0,
    completed: 0,
  }
  for (const a of agents) {
    if (counts[a.state] != null) counts[a.state] += 1
  }
  return counts
}

/**
 * Pick spawn anchors with regional coverage (not suitability-only pile-up).
 * Deterministic: buckets sorted by suitability, round-robin by region order.
 */
function pickRegionalAnchors(anchors, graph, params, axisX, pairCount) {
  const threshold = params.spawnThreshold ?? 0.45
  const minSep2 = (params.minAnchorSpacing ?? 0.12) ** 2
  const arch = { bounds: graph?.bounds }
  const pool = (anchors ?? [])
    .filter((a) => (a.suitability ?? 0) >= threshold * 0.85)
    .slice()

  const buckets = Object.create(null)
  for (const r of ARCH_REGIONS) buckets[r.id] = []
  for (const a of pool) {
    const region = regionForAnchor(a, arch, graph)
    a._spawnRegion = region
    buckets[region].push(a)
  }
  for (const r of ARCH_REGIONS) {
    buckets[r.id].sort((a, b) => (b.suitability ?? 0) - (a.suitability ?? 0))
  }

  const picked = []
  const regionOrder = ARCH_REGIONS.map((r) => r.id)
  let guard = 0
  while (picked.length < pairCount && guard < pairCount * regionOrder.length * 4) {
    guard += 1
    const regionId = regionOrder[picked.length % regionOrder.length]
    const bucket = buckets[regionId] ?? []
    let chosen = null
    for (const a of bucket) {
      if (picked.includes(a)) continue
      let ok = true
      for (const p of picked) {
        if (a.position.distanceToSquared(p.position) < minSep2) {
          ok = false
          break
        }
      }
      if (ok) {
        chosen = a
        break
      }
    }
    // Fallback: any remaining in bucket / other regions
    if (!chosen) {
      for (const rid of regionOrder) {
        for (const a of buckets[rid] ?? []) {
          if (picked.includes(a)) continue
          let ok = true
          for (const p of picked) {
            if (a.position.distanceToSquared(p.position) < minSep2) {
              ok = false
              break
            }
          }
          if (ok) {
            chosen = a
            break
          }
        }
        if (chosen) break
      }
    }
    if (!chosen) break
    picked.push(chosen)
  }

  // Soften threshold fallback if still short
  if (picked.length < pairCount) {
    const rest = (anchors ?? [])
      .slice()
      .sort((a, b) => (b.suitability ?? 0) - (a.suitability ?? 0))
    for (const a of rest) {
      if (picked.length >= pairCount) break
      if (picked.includes(a)) continue
      let ok = true
      for (const p of picked) {
        if (a.position.distanceToSquared(p.position) < minSep2 * 0.7) {
          ok = false
          break
        }
      }
      if (ok) picked.push(a)
    }
  }
  return picked
}

/**
 * Spawn agents on high-suitability anchors, optionally as bilateral pairs.
 */
function spawnAgents({ anchors, graph, params, axisX }) {
  const count = Math.max(1, Math.round(params.agentCount ?? 16))
  const seed = params.agentSeed ?? 42
  const rand = seededRandom(seed, 501)
  const sensingRadius = params.sensingRadius ?? 0.28
  const energyBudget = params.energyBudget ?? 1.4
  const bilateral = params.bilateralSymmetry !== false && params.symmetry !== false
  const maxTrail = params.trailMaxPoints ?? 48

  const agents = []
  const pairCount = bilateral ? Math.ceil(count / 2) : count
  const picked = pickRegionalAnchors(anchors, graph, params, axisX, pairCount)

  for (let i = 0; i < pairCount; i += 1) {
    const anchor = picked[i % Math.max(1, picked.length)]
    const pos = anchor?.position?.clone?.() ?? new THREE.Vector3(0, 1, 0)
    // Keep masters on +X side when bilateral so mirrors land on −X
    if (bilateral && pos.x < axisX) pos.x = axisX + (axisX - pos.x)

    const loc = locateOnGraph(graph, pos)
    const agentSeed = (seed * 131 + i * 17) >>> 0
    const roleRand = seededRandom(seed, 700 + i)
    const role = roleForIndex(i, roleRand)
    const id = `a-${i}`

    const master = createAgent({
      id,
      role,
      position: loc
        ? pointAtS(
            graph.curveById.get(loc.curveId).points,
            graph.curveById.get(loc.curveId).cum,
            loc.s,
          )
        : pos,
      featureId: loc?.curveId ?? anchor?.sourceFeatureId ?? null,
      featureType: loc?.featureType ?? anchor?.featureType ?? null,
      curveId: loc?.curveId ?? null,
      s: loc?.s ?? 0,
      travelSign: 1,
      sensingRadius,
      energyBudget,
      seed: agentSeed,
      activationDelay: i * 0.08,
    })
    master.spawnRegion =
      anchor?._spawnRegion ??
      regionForAnchor(anchor ?? {}, { bounds: graph?.bounds }, graph)
    // Initial heading along curve
    if (master.curveId && graph.curveById.has(master.curveId)) {
      const c = graph.curveById.get(master.curveId)
      const T = tangentAtS(c.points, c.cum, master.s)
      master.velocity.copy(T).multiplyScalar(params.movementSpeed ?? 0.55)
    }
    agents.push(master)

    if (bilateral) {
      const mid = `a-${i}-m`
      const mPos = mirrorVecX(master.position, axisX)
      const mLoc = locateOnGraph(graph, mPos)
      const mirror = createAgent({
        id: mid,
        role,
        position: mLoc
          ? pointAtS(
              graph.curveById.get(mLoc.curveId).points,
              graph.curveById.get(mLoc.curveId).cum,
              mLoc.s,
            )
          : mPos,
        featureId: mLoc?.curveId ?? null,
        featureType: mLoc?.featureType ?? master.featureType,
        curveId: mLoc?.curveId ?? null,
        s: mLoc?.s ?? 0,
        travelSign: -master.travelSign,
        sensingRadius,
        energyBudget,
        seed: agentSeed, // shared seed — decisions come from master
        parentId: null,
        mirrorOf: id,
        activationDelay: master.activationDelay,
      })
      mirror.velocity.set(-master.velocity.x, master.velocity.y, master.velocity.z)
      agents.push(mirror)
    }

    void maxTrail
  }

  // Trim to requested count (pairs may overshoot by 1)
  while (agents.length > count) {
    // Prefer dropping a mirror
    const mir = agents.findIndex((a) => a.isMirror)
    if (mir >= 0) agents.splice(mir, 1)
    else agents.pop()
  }

  return agents
}

/**
 * Field-aware edge score at a candidate curve endpoint.
 * Optional spawn-region affinity keeps agents from all collapsing into upper tracery.
 */
function makeFieldScoreFn(field, params, graph, agent = null) {
  const stigOn = params.enableStigmergy && field
  return (curveId, at) => {
    let score = 0
    if (stigOn) {
      const entry = field.curves.get(curveId)
      if (entry) {
        const s = at === 'start' ? 0 : entry.length
        const sample = field.sampleAt(curveId, s)
        score += stigmergyEdgeScore(sample, params) * 2.6
      }
    }
    if (agent?.spawnRegion && graph?.curveById?.has(curveId)) {
      const c = graph.curveById.get(curveId)
      const mid = c.points?.[Math.floor((c.points.length - 1) / 2)] ?? agent.position
      const region = classifyArchitecturalRegion(mid, c.featureType, { bounds: graph.bounds })
      if (region === agent.spawnRegion) score += 0.55
      else if (
        (agent.spawnRegion === 'vertical-mullions' && region === 'outer-frame') ||
        (agent.spawnRegion === 'lancet-arches' && region === 'upper-tracery')
      ) {
        score += 0.12
      } else {
        score -= 0.18
      }
    }
    return score
  }
}

/**
 * Advance one agent along the graph for one fixed step.
 * Returns context flags for the FSM.
 */
function stepAgentOnGraph(agent, graph, params, rand, sharedDecision = null, field = null) {
  const speed = Math.max(0.05, params.movementSpeed ?? 0.55)
  const step = speed * FIXED_DT
  let hasValidDirection = false
  let noValidPath = false
  let redirectSucceeded = false
  let usedFieldRedirect = false

  if (!agent.curveId || !graph.curveById.has(agent.curveId)) {
    const loc = locateOnGraph(graph, agent.position)
    if (!loc || loc.dist > (params.sensingRadius ?? 0.28) * 1.8) {
      noValidPath = true
      return { hasValidDirection, noValidPath, redirectSucceeded, usedFieldRedirect }
    }
    agent.curveId = loc.curveId
    agent.s = loc.s
    agent.featureId = loc.curveId
    agent.featureType = loc.featureType
  }

  const curve = graph.curveById.get(agent.curveId)
  if (!curve) {
    noValidPath = true
    return { hasValidDirection, noValidPath, redirectSucceeded, usedFieldRedirect }
  }

  // Move along arc length
  let nextS = agent.s + agent.travelSign * step
  let hitEnd = false
  if (nextS < 0) {
    nextS = 0
    hitEnd = true
  } else if (nextS > curve.length) {
    nextS = curve.length
    hitEnd = true
  }

  if (!hitEnd) {
    // Mid-path perception: high local inhibition can reverse travel (AVOID)
    if (params.enableStigmergy && field && (agent.state === STATE.EXPLORING || agent.state === STATE.BUILDING)) {
      const look = field.sampleAt(agent.curveId, nextS)
      const inhibW = params.inhibitionStrength ?? 0.45
      const attrW = params.attractionStrength ?? 0.55
      const pressure =
        inhibW * (look.inhibition * 0.85 + look.occupancy * 0.75) - attrW * look.attraction * 0.28
      if (pressure > 0.22 && rand() < 0.42 + (params.explorationBias ?? 0.35) * 0.2) {
        agent.travelSign *= -1
        nextS = agent.s + agent.travelSign * step
        nextS = Math.min(curve.length, Math.max(0, nextS))
        redirectSucceeded = true
        usedFieldRedirect = true
      }
    }
    agent.s = nextS
    const P = pointAtS(curve.points, curve.cum, agent.s)
    const T = tangentAtS(curve.points, curve.cum, agent.s)
    agent.velocity.copy(T).multiplyScalar(agent.travelSign * speed)
    agent.position.copy(P)
    // Slight Z lift so markers sit on stone face
    agent.position.z += 0.04
    hasValidDirection = true
    return { hasValidDirection, noValidPath, redirectSucceeded, usedFieldRedirect }
  }

  // Junction transfer
  const jId = agent.travelSign >= 0 ? curve.endJunction : curve.startJunction
  if (!jId) {
    // Reverse on same curve as soft redirect
    agent.travelSign *= -1
    agent.s = Math.min(curve.length, Math.max(0, agent.s))
    redirectSucceeded = true
    hasValidDirection = true
    const T = tangentAtS(curve.points, curve.cum, agent.s)
    agent.velocity.copy(T).multiplyScalar(agent.travelSign * speed)
    return { hasValidDirection, noValidPath, redirectSucceeded, usedFieldRedirect }
  }

  const heading = agent.velocity.lengthSq() > 1e-8
    ? agent.velocity.clone().normalize()
    : tangentAtS(curve.points, curve.cum, agent.s).multiplyScalar(agent.travelSign)

  const exploreBase =
    agent.role === 'explorer'
      ? 0.65
      : agent.role === 'regulator'
        ? 0.5
        : 0.4
  const exploreBias = params.enableStigmergy
    ? Math.min(1, exploreBase * 0.55 + (params.explorationBias ?? 0.35) * 0.7)
    : exploreBase

  let pick = sharedDecision
  if (!pick) {
    pick = pickOutgoing(graph, jId, agent.curveId, heading, rand, {
      upwardBias: 0.4,
      explorationBias: exploreBias,
      suitability: 0.55,
      fieldScore: makeFieldScoreFn(field, params, graph, agent),
    })
    agent.lastDecision = pick
      ? { curveId: pick.curveId, travelSign: pick.travelSign, s: pick.s }
      : null
    if (pick && params.enableStigmergy && field) usedFieldRedirect = true
  } else {
    // Apply shared master decision; mirror will flip travel after call
    agent.lastDecision = pick
  }

  if (!pick) {
    noValidPath = true
    return { hasValidDirection, noValidPath, redirectSucceeded, usedFieldRedirect }
  }

  agent.curveId = pick.curveId
  agent.s = pick.s
  agent.travelSign = pick.travelSign
  agent.featureId = pick.curveId
  const nc = graph.curveById.get(pick.curveId)
  if (nc) {
    agent.featureType = nc.featureType
    agent.position.copy(pointAtS(nc.points, nc.cum, agent.s))
    agent.position.z += 0.04
    const T = tangentAtS(nc.points, nc.cum, agent.s)
    agent.velocity.copy(T).multiplyScalar(agent.travelSign * speed)
  }
  hasValidDirection = true
  redirectSucceeded = agent.state === STATE.BLOCKED
  return { hasValidDirection, noValidPath, redirectSucceeded, usedFieldRedirect, decision: agent.lastDecision }
}

/**
 * Create a runnable agent simulation.
 */
export function createAgentSimulation({ arch, anchors, params = {} }) {
  const graph = buildCurveGraph(arch)
  const axisX = 0
  const fixedDt = params.fixedDt ?? FIXED_DT

  /** Design-space params (meters at 1×). Physical lengths applied once via architecturalScale. */
  let designParams = { ...params }

  const mergePhysicalParams = (raw) => {
    const scale = Math.max(0.05, raw.architecturalScale ?? 1)
    // Arch bounds are already world-scaled; cap sensing against actual width.
    const archW = Math.abs((arch?.bounds?.x1 ?? 1.5) - (arch?.bounds?.x0 ?? -1.5))
    const sensingCap = Math.max(0.08, archW * 0.22)
    return {
      ...raw,
      sensingRadius: Math.min((raw.sensingRadius ?? 0.28) * scale, sensingCap),
      movementSpeed: (raw.movementSpeed ?? 0.55) * scale,
      depositionRadius: (raw.depositionRadius ?? 0.18) * scale,
      minAnchorSpacing: (raw.minAnchorSpacing ?? 0.12) * scale,
      minTrailSpacing: (raw.minTrailSpacing ?? 0.1) * scale,
      minPathLength: (raw.minPathLength ?? 0.085) * scale,
      sampleSpacing: (raw.sampleSpacing ?? 0.09) * scale,
    }
  }

  let physicalParams = mergePhysicalParams(designParams)
  let field = createStigmergyField(graph, {
    sampleSpacing: physicalParams.sampleSpacing,
  })

  const state = {
    running: false,
    time: 0,
    stepCount: 0,
    accumulator: 0,
    agents: [],
    params: physicalParams,
    axisX,
    metrics: {
      redirected: 0,
      blockedEvents: 0,
    },
    /** Peak live field averages — decays after deposits stop; construction uses path fieldAccum. */
    fieldPeak: {
      averageAttraction: 0,
      averageInhibition: 0,
      occupiedPercent: 0,
      time: 0,
    },
  }

  const locatePos = (p) => {
    const v = p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y, p.z ?? 0)
    return locateOnGraph(graph, v)
  }

  const rebuild = (nextParams) => {
    if (nextParams) designParams = { ...designParams, ...nextParams }
    physicalParams = mergePhysicalParams(designParams)
    state.params = physicalParams
    state.agents = spawnAgents({
      anchors,
      graph,
      params: state.params,
      axisX,
    })
    field = createStigmergyField(graph, {
      sampleSpacing: state.params.sampleSpacing,
    })
    state.time = 0
    state.stepCount = 0
    state.accumulator = 0
    state.running = false
    state.metrics.redirected = 0
    state.metrics.blockedEvents = 0
    state.fieldPeak = {
      averageAttraction: 0,
      averageInhibition: 0,
      occupiedPercent: 0,
      time: 0,
    }
  }

  rebuild()

  const byId = () => {
    const m = new Map()
    for (const a of state.agents) m.set(a.id, a)
    return m
  }

  const fixedStep = () => {
    const p = state.params
    if (!p.enableAgentSimulation) return

    // Field decay / diffusion before agent action this tick
    if (p.enableStigmergy) {
      field.stepField(p, fixedDt)
    }

    const map = byId()
    const speedMul = Math.max(0.1, p.simulationSpeed ?? 1)
    // Process masters first so mirrors can copy decisions
    const ordered = [...state.agents].sort((a, b) => Number(a.isMirror) - Number(b.isMirror))

    for (const agent of ordered) {
      if (agent.state === STATE.COMPLETED) continue

      const activated = state.time >= agent.activationDelay
      let hasValidDirection = false
      let noValidPath = false
      let redirectSucceeded = false

      if (agent.isMirror && agent.mirrorOf) {
        const master = map.get(agent.mirrorOf)
        // Mirror follows master's state machine outcomes geometrically
        if (master) {
          if (master.state === STATE.DORMANT && !activated) {
            agent.state = STATE.DORMANT
            continue
          }
          const rand = agentRng(p.agentSeed ?? 42, agent.seed)
          const ctxMove = stepAgentOnGraph(agent, graph, p, rand, null, field)

          // Override position to reflected master for strict bilateral geometry
          agent.position.copy(mirrorVecX(master.position, axisX))
          agent.velocity.set(-master.velocity.x, master.velocity.y, master.velocity.z)
          agent.state = master.state
          agent.energy = master.energy
          agent.exploreSteps = master.exploreSteps
          agent.depositSteps = master.depositSteps
          agent.buildSteps = master.buildSteps ?? 0
          agent.blockedTicks = master.blockedTicks
          agent.featureType = master.featureType
          agent.curveId = master.curveId
          agent.s = master.s
          // Mirror does not deposit — master's deposit already mirrored into the field
          const trailCap = p.showFullTrailHistory ? 240 : p.trailMaxPoints
          pushTrail(agent, trailCap)
          void ctxMove
          continue
        }
      }

      const rand = agentRng(p.agentSeed ?? 42, agent.seed)

      if (agent.state === STATE.DORMANT) {
        const next = transition(agent, {
          activated,
          hasValidDirection: false,
          noValidPath: false,
          redirectSucceeded: false,
          trailAccepted: false,
          budgetExhausted: false,
          stillBlocked: false,
        })
        agent.state = next
        continue
      }

      // Active locomotion for exploring / depositing / building / blocked
      if (
        agent.state === STATE.EXPLORING ||
        agent.state === STATE.DEPOSITING ||
        agent.state === STATE.BUILDING ||
        agent.state === STATE.BLOCKED
      ) {
        const moveCtx = stepAgentOnGraph(agent, graph, p, rand, null, field)
        hasValidDirection = moveCtx.hasValidDirection
        noValidPath = moveCtx.noValidPath
        redirectSucceeded = moveCtx.redirectSucceeded
        if (moveCtx.usedFieldRedirect) state.metrics.redirected += 1

        if (agent.state === STATE.BLOCKED && !redirectSucceeded) {
          agent.blockedTicks += 1
          state.metrics.blockedEvents += 1
          // Sense for alternative: re-locate and try pickOutgoing from nearest junction
          const loc = locateOnGraph(graph, agent.position)
          if (loc && loc.dist <= agent.sensingRadius) {
            const c = graph.curveById.get(loc.curveId)
            const jId = c?.startJunction || c?.endJunction
            if (jId) {
              const heading = agent.velocity.clone().normalize()
              const pick = pickOutgoing(graph, jId, loc.curveId, heading, rand, {
                explorationBias: Math.min(
                  1,
                  0.85 * 0.5 + (p.explorationBias ?? 0.35) * 0.6,
                ),
                upwardBias: 0.35,
                fieldScore: makeFieldScoreFn(field, p, graph, agent),
              })
              if (pick) {
                agent.curveId = pick.curveId
                agent.s = pick.s
                agent.travelSign = pick.travelSign
                agent.lastDecision = {
                  curveId: pick.curveId,
                  travelSign: pick.travelSign,
                  s: pick.s,
                }
                redirectSucceeded = true
                noValidPath = false
                agent.blockedTicks = 0
                state.metrics.redirected += 1
              }
            }
          }
        } else if (hasValidDirection) {
          agent.blockedTicks = 0
        }

        if (agent.state === STATE.EXPLORING && hasValidDirection) agent.exploreSteps += 1
        if (agent.state === STATE.DEPOSITING && hasValidDirection) agent.depositSteps += 1
        if (agent.state === STATE.BUILDING && hasValidDirection) {
          agent.buildSteps = (agent.buildSteps ?? 0) + 1
        }

        // Stigmergic deposition while depositing / building
        if (
          p.enableStigmergy &&
          (agent.state === STATE.DEPOSITING || agent.state === STATE.BUILDING) &&
          hasValidDirection
        ) {
          field.deposit(agent, p, axisX, locatePos)
        }

        // Construction archive for ornamental geometry (11C)
        if (
          hasValidDirection &&
          (agent.state === STATE.DEPOSITING || agent.state === STATE.BUILDING)
        ) {
          pushConstructionSample(agent, state.time, field)
        }

        const trailCap = p.showFullTrailHistory ? 240 : p.trailMaxPoints
        pushTrail(agent, trailCap)
      }

      // Energy drain (scaled lightly by simulationSpeed so UI speed feels responsive)
      const drain = energyCost(agent) * speedMul
      agent.energy = Math.max(0, agent.energy - drain)
      const budgetExhausted = agent.energy <= 1e-6

      const trailAccepted =
        agent.state === STATE.DEPOSITING &&
        trailLength(agent.trail) >= depositAcceptLength(agent) &&
        agent.depositSteps >= depositAcceptSteps(agent)

      const buildComplete =
        agent.state === STATE.BUILDING && (agent.buildSteps ?? 0) >= buildCompleteQuota(agent)

      // Local inhibition pressure → re-scout (stigmergy only)
      let reexplore = false
      if (p.enableStigmergy && agent.state === STATE.BUILDING && agent.curveId) {
        const local = field.sampleAt(agent.curveId, agent.s)
        const pressure =
          (p.inhibitionStrength ?? 0.55) * (local.inhibition * 0.9 + local.occupancy * 0.7)
        if (pressure > 0.55 && (agent.buildSteps ?? 0) > 12) reexplore = true
      }

      const next = transition(agent, {
        activated: true,
        hasValidDirection,
        noValidPath,
        redirectSucceeded,
        trailAccepted,
        budgetExhausted,
        stillBlocked: noValidPath && !redirectSucceeded,
        buildComplete,
        reexplore,
      })

      if (next === STATE.DEPOSITING && agent.state === STATE.EXPLORING) {
        agent.depositSteps = 0
        if (agent.constructionStartTime == null) agent.constructionStartTime = state.time
        // Seed construction path with current locus
        if (!agent.constructionPath?.length) {
          agent.constructionPath = [
            {
              x: agent.position.x,
              y: agent.position.y,
              z: agent.position.z,
              t: state.time,
              curveId: agent.curveId,
              s: agent.s,
            },
          ]
        }
      }
      if (next === STATE.BUILDING && agent.state === STATE.DEPOSITING) {
        agent.buildSteps = 0
      }
      if (next === STATE.EXPLORING && agent.state === STATE.BUILDING) {
        agent.exploreSteps = Math.max(6, Math.floor((agent.exploreSteps ?? 0) * 0.4))
      }
      if (next === STATE.EXPLORING && agent.state === STATE.BLOCKED) {
        agent.exploreSteps = Math.max(0, agent.exploreSteps - 2)
      }
      if (next === STATE.COMPLETED && agent.state !== STATE.COMPLETED) {
        agent.constructionEndTime = state.time
      }
      agent.state = next
    }

    state.time += fixedDt
    state.stepCount += 1

    // Track peak field while deposits are active (live averages decay after COMPLETED)
    if (p.enableStigmergy) {
      const avg = field.averages()
      if (
        avg.averageAttraction + avg.averageInhibition + avg.occupiedPercent * 0.01 >
        state.fieldPeak.averageAttraction +
          state.fieldPeak.averageInhibition +
          state.fieldPeak.occupiedPercent * 0.01
      ) {
        state.fieldPeak = {
          averageAttraction: avg.averageAttraction,
          averageInhibition: avg.averageInhibition,
          occupiedPercent: avg.occupiedPercent,
          time: state.time,
        }
      }
    }
  }

  return {
    state,
    graph,
    get field() {
      return field
    },
    get fixedDt() {
      return fixedDt
    },
    start() {
      state.running = true
    },
    pause() {
      state.running = false
    },
    toggle() {
      state.running = !state.running
    },
    reset() {
      rebuild()
    },
    regenerate(nextParams) {
      if (nextParams) Object.assign(state.params, nextParams)
      rebuild(state.params)
    },
    setParams(next) {
      Object.assign(state.params, next)
    },
    /** Advance wall-clock dt with fixed internal steps. */
    advance(dt) {
      if (!state.running) return
      const speed = Math.max(0.05, state.params.simulationSpeed ?? 1)
      state.accumulator += Math.max(0, dt) * speed
      let guard = 0
      while (state.accumulator >= fixedDt && guard < 8) {
        fixedStep()
        state.accumulator -= fixedDt
        guard += 1
      }
    },
    /** Exactly one fixed timestep (works while paused). */
    stepOnce() {
      fixedStep()
      state.accumulator = 0
    },
    getStats() {
      const counts = countByState(state.agents)
      const active =
        counts.exploring + counts.depositing + counts.building + counts.blocked
      const avg = field.averages()
      return {
        time: state.time,
        stepCount: state.stepCount,
        running: state.running,
        agentCount: state.agents.length,
        activeAgents: active,
        ...counts,
        seed: state.params.agentSeed ?? 42,
        bilateral: state.params.bilateralSymmetry !== false,
        stigmergy: state.params.enableStigmergy !== false,
        totalDeposits: field.state.depositEvents,
        averageAttraction: avg.averageAttraction,
        averageInhibition: avg.averageInhibition,
        occupiedPercent: avg.occupiedPercent,
        peakAttraction: state.fieldPeak.averageAttraction,
        peakInhibition: state.fieldPeak.averageInhibition,
        peakOccupiedPercent: state.fieldPeak.occupiedPercent,
        peakFieldTime: state.fieldPeak.time,
        agentsRedirected: state.metrics.redirected,
        agentsBlocked: counts.blocked,
        agentsCompleted: counts.completed,
      }
    },
    /** Deterministic fingerprint for seed equality tests. */
    fingerprint() {
      return {
        agents: state.agents.map(serializeAgent),
        field: field.fingerprint(),
      }
    },
    /** Coverage / separation snapshot for comparison mode. */
    getCompareSnapshot() {
      const self = {
        state,
        field,
        getStats: () => {
          const counts = countByState(state.agents)
          const avg = field.averages()
          return {
            time: state.time,
            stepCount: state.stepCount,
            exploring: counts.exploring,
            depositing: counts.depositing,
            building: counts.building,
            blocked: counts.blocked,
            completed: counts.completed,
            totalDeposits: field.state.depositEvents,
            agentsRedirected: state.metrics.redirected,
            occupiedPercent: avg.occupiedPercent,
            averageAttraction: avg.averageAttraction,
            averageInhibition: avg.averageInhibition,
          }
        },
      }
      return collectCompareSnapshot(self, graph)
    },
  }
}

export { FIXED_DT, serializeAgent, countByState }
