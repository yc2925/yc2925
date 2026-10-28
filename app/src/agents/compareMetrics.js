/**
 * Step 11B.5 — Measurable comparison between two agent simulations.
 */

import { locateOnGraph } from '../ornament/curveGraph.js'

/**
 * Unique graph sample keys visited by agent trails.
 */
export function trailCoverageKeys(sim, graph) {
  const keys = new Set()
  const repeats = new Map()
  for (const a of sim.state.agents ?? []) {
    for (const p of a.trail ?? []) {
      const loc = locateOnGraph(graph, p)
      if (!loc || loc.dist > 0.2) continue
      const entry = sim.field?.curves?.get(loc.curveId)
      const idx = entry && sim.field.sToIndex ? sim.field.sToIndex(entry, loc.s) : Math.round(loc.s * 10)
      const k = `${loc.curveId}:${idx}`
      keys.add(k)
      repeats.set(k, (repeats.get(k) ?? 0) + 1)
    }
  }
  let repeated = 0
  for (const n of repeats.values()) if (n > 1) repeated += 1
  return { unique: keys.size, repeated, keys, repeats }
}

/**
 * Mean pairwise distance between active agent positions.
 */
export function meanAgentSeparation(sim) {
  const agents = (sim.state.agents ?? []).filter(
    (a) => a.state !== 'dormant' && a.state !== 'completed',
  )
  if (agents.length < 2) return 0
  let sum = 0
  let n = 0
  for (let i = 0; i < agents.length; i += 1) {
    for (let j = i + 1; j < agents.length; j += 1) {
      sum += agents[i].position.distanceTo(agents[j].position)
      n += 1
    }
  }
  return n ? sum / n : 0
}

/**
 * Snapshot metrics for comparison UI / validation.
 */
export function collectCompareSnapshot(sim, graph) {
  const stats = sim.getStats()
  const cov = trailCoverageKeys(sim, graph)
  const fieldAvg = sim.field?.averages?.() ?? {}
  return {
    time: stats.time,
    stepCount: stats.stepCount,
    exploring: stats.exploring ?? 0,
    depositing: stats.depositing ?? 0,
    building: stats.building ?? 0,
    blocked: stats.blocked ?? 0,
    completed: stats.completed ?? 0,
    totalDeposits: stats.totalDeposits ?? 0,
    redirected: stats.agentsRedirected ?? 0,
    uniqueCoverage: cov.unique,
    repeatedOccupancy: cov.repeated,
    occupiedPercent: fieldAvg.occupiedPercent ?? stats.occupiedPercent ?? 0,
    averageAttraction: fieldAvg.averageAttraction ?? 0,
    averageInhibition: fieldAvg.averageInhibition ?? 0,
    meanSeparation: meanAgentSeparation(sim),
  }
}

/**
 * Absolute deltas between ON and OFF snapshots.
 */
export function compareSnapshots(offSnap, onSnap) {
  const keys = [
    'uniqueCoverage',
    'repeatedOccupancy',
    'meanSeparation',
    'completed',
    'redirected',
    'totalDeposits',
    'occupiedPercent',
    'building',
    'exploring',
  ]
  const delta = {}
  for (const k of keys) {
    delta[k] = (onSnap?.[k] ?? 0) - (offSnap?.[k] ?? 0)
  }
  return delta
}
