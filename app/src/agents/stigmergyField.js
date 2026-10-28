/**
 * Step 11B — Graph-local stigmergy field on the architectural curve graph.
 *
 * Attraction + inhibition sampled along curve arc length.
 * Diffusion only along graph connections (curve neighbours + junctions).
 * No volumetric 3D grid.
 */

import { pointAtS } from '../ornament/curveGraph.js'

const SAMPLE_SPACING = 0.09
const MAX_SIGNAL = 1
const CENTERLINE_EPS = 0.04

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function sampleCountForLength(length) {
  return Math.max(2, Math.ceil(length / SAMPLE_SPACING) + 1)
}

/**
 * Build reusable field buffers + graph-local neighbour lists.
 */
export function createStigmergyField(graph, opts = {}) {
  const spacing = opts.sampleSpacing ?? SAMPLE_SPACING
  const curves = new Map()
  const indexOf = new Map() // `${curveId}:${i}` → flat meta (optional)

  for (const c of graph.curves ?? []) {
    const n = sampleCountForLength(c.length)
    const step = c.length / Math.max(1, n - 1)
    curves.set(c.id, {
      id: c.id,
      featureType: c.featureType,
      length: c.length,
      n,
      step,
      attraction: new Float32Array(n),
      inhibition: new Float32Array(n),
      occupancy: new Float32Array(n),
      // scratch for diffusion
      attrNext: new Float32Array(n),
      inhibNext: new Float32Array(n),
    })
  }

  // Neighbours: within-curve adjacent + junction endpoint links
  const neighbors = new Map() // key "curveId:i" → [{curveId, i, w}]

  const key = (curveId, i) => `${curveId}:${i}`
  const addN = (a, b, w = 1) => {
    if (!neighbors.has(a)) neighbors.set(a, [])
    neighbors.get(a).push({ ...b, w })
  }

  for (const entry of curves.values()) {
    for (let i = 0; i < entry.n; i += 1) {
      const k = key(entry.id, i)
      if (i > 0) addN(k, { curveId: entry.id, i: i - 1 }, 1)
      if (i < entry.n - 1) addN(k, { curveId: entry.id, i: i + 1 }, 1)
    }
  }

  // Junction links: connect endpoint samples of curves sharing a junction
  for (const j of graph.junctions ?? []) {
    const ends = []
    for (const e of j.edges ?? []) {
      const entry = curves.get(e.curveId)
      if (!entry) continue
      const i = e.at === 'start' ? 0 : entry.n - 1
      ends.push({ curveId: e.curveId, i })
    }
    for (let a = 0; a < ends.length; a += 1) {
      for (let b = 0; b < ends.length; b += 1) {
        if (a === b) continue
        addN(key(ends[a].curveId, ends[a].i), ends[b], 0.85)
      }
    }
  }

  const state = {
    totalDeposits: 0,
    depositEvents: 0,
    redirected: 0,
  }

  const sToIndex = (entry, s) => {
    if (entry.n <= 1) return 0
    const u = clamp01(s / Math.max(1e-6, entry.length))
    return Math.min(entry.n - 1, Math.round(u * (entry.n - 1)))
  }

  const indexToS = (entry, i) => (entry.n <= 1 ? 0 : (i / (entry.n - 1)) * entry.length)

  const sampleAt = (curveId, s) => {
    const entry = curves.get(curveId)
    if (!entry) return { attraction: 0, inhibition: 0, occupancy: 0, index: -1 }
    const i = sToIndex(entry, s)
    return {
      attraction: entry.attraction[i],
      inhibition: entry.inhibition[i],
      occupancy: entry.occupancy[i],
      index: i,
      entry,
    }
  }

  /**
   * Graph-local deposit: BFS along neighbours within arc-length radius.
   */
  const depositLocal = (curveId, s, amountAttr, amountInhib, radius) => {
    const entry = curves.get(curveId)
    if (!entry) return 0
    const startI = sToIndex(entry, s)
    const r = Math.max(entry.step, radius ?? entry.step * 2)
    const visited = new Set()
    const queue = [{ curveId, i: startI, dist: 0 }]
    let touched = 0

    while (queue.length) {
      const cur = queue.shift()
      const k = key(cur.curveId, cur.i)
      if (visited.has(k)) continue
      visited.add(k)
      const e = curves.get(cur.curveId)
      if (!e || cur.i < 0 || cur.i >= e.n) continue

      const falloff = 1 - cur.dist / r
      if (falloff <= 0) continue
      const w = falloff * falloff
      if (amountAttr) {
        e.attraction[cur.i] = Math.min(MAX_SIGNAL, e.attraction[cur.i] + amountAttr * w)
      }
      if (amountInhib) {
        e.inhibition[cur.i] = Math.min(MAX_SIGNAL, e.inhibition[cur.i] + amountInhib * w)
      }
      e.occupancy[cur.i] = Math.min(MAX_SIGNAL, e.occupancy[cur.i] + 0.35 * w)
      touched += 1

      const nbrs = neighbors.get(k) ?? []
      for (const n of nbrs) {
        const ne = curves.get(n.curveId)
        if (!ne) continue
        const step = (ne.step + e.step) * 0.5
        const nd = cur.dist + step / Math.max(0.5, n.w)
        if (nd <= r && !visited.has(key(n.curveId, n.i))) {
          queue.push({ curveId: n.curveId, i: n.i, dist: nd })
        }
      }
    }
    return touched
  }

  /**
   * Deposit at agent location. Masters only when bilateral; mirrored field
   * write via locateFn. Centerline deposits once (no double-count).
   */
  const depositWithMirror = (agent, params, axisX, locateFn) => {
    if (!params.enableStigmergy) return
    if (!agent.curveId) return
    // Only masters deposit when bilateral — mirrors share via field mirror
    if (params.bilateralSymmetry !== false && agent.isMirror) return

    const rate = Math.max(0, params.depositionRate ?? 0.35)
    const radius = Math.max(0.04, params.depositionRadius ?? 0.16)
    const attrAmt = rate * 0.55
    const inhibAmt = rate * 0.4
    const touched = depositLocal(agent.curveId, agent.s, attrAmt, inhibAmt, radius)
    state.totalDeposits += touched
    state.depositEvents += 1

    if (params.bilateralSymmetry === false || !locateFn) return
    const x = agent.position?.x ?? 0
    if (Math.abs(x - axisX) <= CENTERLINE_EPS) return // centerline: single deposit

    const mirrored = {
      x: axisX - (x - axisX),
      y: agent.position?.y ?? 0,
      z: agent.position?.z ?? 0,
    }
    const loc = locateFn(mirrored)
    if (loc && loc.curveId) {
      depositLocal(loc.curveId, loc.s, attrAmt, inhibAmt, radius)
    }
  }

  /**
   * Decay + graph-local diffusion for one fixed step.
   */
  const stepField = (params, dt) => {
    if (!params.enableStigmergy) return
    const decay = clamp01(params.signalDecay ?? 0.12)
    const diff = clamp01(params.signalDiffusion ?? 0.25)
    const decayFactor = Math.exp(-decay * 3 * dt)
    const occDecay = Math.exp(-0.8 * dt)

    // Decay
    for (const e of curves.values()) {
      for (let i = 0; i < e.n; i += 1) {
        e.attraction[i] *= decayFactor
        e.inhibition[i] *= decayFactor
        e.occupancy[i] *= occDecay
        if (e.attraction[i] < 1e-5) e.attraction[i] = 0
        if (e.inhibition[i] < 1e-5) e.inhibition[i] = 0
        if (e.occupancy[i] < 1e-5) e.occupancy[i] = 0
      }
    }

    if (diff < 1e-4) return

    // Diffuse into scratch, then swap
    const mix = diff * 0.45
    for (const e of curves.values()) {
      for (let i = 0; i < e.n; i += 1) {
        const k = key(e.id, i)
        const nbrs = neighbors.get(k) ?? []
        let aSum = e.attraction[i]
        let iSum = e.inhibition[i]
        let wSum = 1
        for (const n of nbrs) {
          const ne = curves.get(n.curveId)
          if (!ne) continue
          const w = n.w
          aSum += ne.attraction[n.i] * w
          iSum += ne.inhibition[n.i] * w
          wSum += w
        }
        const aAvg = aSum / wSum
        const iAvg = iSum / wSum
        e.attrNext[i] = e.attraction[i] * (1 - mix) + aAvg * mix
        e.inhibNext[i] = e.inhibition[i] * (1 - mix) + iAvg * mix
      }
    }
    for (const e of curves.values()) {
      e.attraction.set(e.attrNext)
      e.inhibition.set(e.inhibNext)
      for (let i = 0; i < e.n; i += 1) {
        e.attraction[i] = Math.min(MAX_SIGNAL, e.attraction[i])
        e.inhibition[i] = Math.min(MAX_SIGNAL, e.inhibition[i])
      }
    }
  }

  const averages = () => {
    let aSum = 0
    let iSum = 0
    let occ = 0
    let n = 0
    let occupied = 0
    for (const e of curves.values()) {
      for (let i = 0; i < e.n; i += 1) {
        aSum += e.attraction[i]
        iSum += e.inhibition[i]
        n += 1
        if (e.occupancy[i] > 0.05 || e.attraction[i] > 0.05 || e.inhibition[i] > 0.05) {
          occupied += 1
        }
      }
    }
    return {
      averageAttraction: n ? aSum / n : 0,
      averageInhibition: n ? iSum / n : 0,
      occupiedPercent: n ? (100 * occupied) / n : 0,
      sampleCount: n,
    }
  }

  /**
   * Peak values for normalization (heatmap legibility).
   */
  const peaks = () => {
    let a = 1e-6
    let ih = 1e-6
    let o = 1e-6
    for (const e of curves.values()) {
      for (let i = 0; i < e.n; i += 1) {
        if (e.attraction[i] > a) a = e.attraction[i]
        if (e.inhibition[i] > ih) ih = e.inhibition[i]
        if (e.occupancy[i] > o) o = e.occupancy[i]
      }
    }
    return { attraction: a, inhibition: ih, occupancy: o }
  }

  /**
   * Build coloured polyline segments from the real field.
   * mode: 'attraction' | 'inhibition' | 'occupancy' | 'combined'
   * Always draws architectural curves; intensity maps real sample values.
   */
  const buildVizSegments = (mode = 'attraction') => {
    const positions = []
    const colors = []
    const pk = peaks()
    for (const c of graph.curves ?? []) {
      const entry = curves.get(c.id)
      if (!entry || !c.points) continue
      for (let i = 0; i < entry.n - 1; i += 1) {
        const s0 = indexToS(entry, i)
        const s1 = indexToS(entry, i + 1)
        const p0 = pointAtS(c.points, c.cum, s0)
        const p1 = pointAtS(c.points, c.cum, s1)
        const raw0 = sampleValue(entry, i, mode)
        const raw1 = sampleValue(entry, i + 1, mode)
        const norm =
          mode === 'inhibition'
            ? pk.inhibition
            : mode === 'occupancy'
              ? pk.occupancy
              : mode === 'combined'
                ? Math.max(pk.attraction, pk.inhibition)
                : pk.attraction
        // Gamma boost so mid-field values read clearly on dark stone
        const v0 = Math.pow(clamp01(raw0 / norm), 0.65)
        const v1 = Math.pow(clamp01(raw1 / norm), 0.65)
        positions.push(p0.x, p0.y, (p0.z ?? 0) + 0.055, p1.x, p1.y, (p1.z ?? 0) + 0.055)
        const c0 = signalColor(v0, mode)
        const c1 = signalColor(v1, mode)
        colors.push(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2])
      }
    }
    return { positions, colors, peaks: pk }
  }

  function sampleValue(entry, i, mode) {
    if (mode === 'inhibition') return entry.inhibition[i]
    if (mode === 'occupancy') return entry.occupancy[i]
    if (mode === 'combined') {
      // Competing effects: attraction positive, inhibition subtracts
      return Math.max(0, entry.attraction[i] * 0.75 - entry.inhibition[i] * 0.45 + entry.occupancy[i] * 0.15)
    }
    return entry.attraction[i]
  }

  const reset = () => {
    for (const e of curves.values()) {
      e.attraction.fill(0)
      e.inhibition.fill(0)
      e.occupancy.fill(0)
    }
    state.totalDeposits = 0
    state.depositEvents = 0
    state.redirected = 0
  }

  /** Deterministic fingerprint of field for seed tests. */
  const fingerprint = () => {
    const parts = []
    for (const e of curves.values()) {
      let a = 0
      let ih = 0
      for (let i = 0; i < e.n; i += 1) {
        a += e.attraction[i]
        ih += e.inhibition[i]
      }
      parts.push(`${e.id}:${a.toFixed(4)}:${ih.toFixed(4)}`)
    }
    parts.sort()
    return parts.join('|')
  }

  return {
    curves,
    neighbors,
    state,
    sampleAt,
    deposit: depositWithMirror,
    // keep internal for tests
    depositLocal,
    stepField,
    averages,
    buildVizSegments,
    reset,
    fingerprint,
    sToIndex,
    indexToS,
  }
}

/**
 * Restrained but legible heatmap colours on dark architecture.
 * Uses the single signal-red family + cool gray contrast for inhibition.
 */
export function signalColor(t, mode = 'attraction') {
  const u = clamp01(t)
  if (mode === 'inhibition') {
    // charcoal → cool slate (contrasts with signal red)
    return [0.12 + u * 0.25, 0.14 + u * 0.35, 0.18 + u * 0.55]
  }
  if (mode === 'occupancy') {
    // mute → warm stone amber
    return [0.16 + u * 0.7, 0.14 + u * 0.45, 0.1 + u * 0.12]
  }
  if (mode === 'combined') {
    // low gray → mid terracotta → high signal
    return [0.14 + u * 0.86, 0.12 + u * 0.08, 0.12 * (1 - u)]
  }
  // attraction: near-black → signal red
  return [0.14 + u * 0.86, 0.08 * (1 - u), 0.08 * (1 - u) + u * 0.02]
}

/**
 * Weighted edge score contribution from stigmergy perception.
 */
export function stigmergyEdgeScore(sample, params) {
  if (!params?.enableStigmergy) return 0
  const attrW = params.attractionStrength ?? 0.7
  const inhibW = params.inhibitionStrength ?? 0.65
  const explore = clamp01(params.explorationBias ?? 0.4)
  const attr = sample?.attraction ?? 0
  const inhib = sample?.inhibition ?? 0
  const occ = sample?.occupancy ?? 0
  // FOLLOW attraction; AVOID inhibition + occupancy (stronger occupancy to reduce path pile-up)
  const follow = attrW * attr * (1 - explore * 0.3)
  const avoid = inhibW * (inhib * 0.7 + occ * 0.85) * (1 - explore * 0.2)
  // Continuity soft-floor: never fully cancel architectural guidance
  return follow - avoid
}

export { MAX_SIGNAL, SAMPLE_SPACING, clamp01 }
