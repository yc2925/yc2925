/**
 * Step 9.5 — Shared growth timeline for primary trails + L-system branches.
 *
 * Deterministic target geometry is fixed; playback only reveals by arc length / timestamps.
 */

import { clamp01 } from './extract.js'

/**
 * Map arc length s along a gen-0 trail to the recorded particle timestamp.
 */
export function timeAtParentArc(branch, s) {
  const len = branch.length || 0
  if (len < 1e-8) return branch.birthTime ?? 0
  const d = Math.min(len, Math.max(0, s))

  if (branch.revealMode === 'timestamp' && branch.pointTimes?.length && branch.poly?.cum) {
    const cum = branch.poly.cum
    const times = branch.pointTimes
    let i = 1
    while (i < cum.length && cum[i] < d) i += 1
    const i0 = Math.max(0, i - 1)
    const i1 = Math.min(cum.length - 1, i)
    const seg = cum[i1] - cum[i0] || 1e-6
    const u = clamp01((d - cum[i0]) / seg)
    const t0 = times[i0] ?? 0
    const t1 = times[i1] ?? t0
    return t0 + (t1 - t0) * u
  }

  const birth = branch.birthTime ?? 0
  const dur = Math.max(1e-4, branch.growthDuration ?? 1)
  return birth + (d / len) * dur
}

/**
 * Assign birthTime / growthDuration after hierarchy is built.
 * Children wait until the parent has revealed the attachment arc length.
 *
 * Primaries often finish in ~1.5–3s (particle path budget). With
 * stretchTimeline (default), the whole sequence is scaled to fill
 * simulationDuration while preserving relative order.
 */
export function scheduleBranchTiming(network, params = {}) {
  const branchDelay = Math.max(0, params.branchDelay ?? 0.35)
  const growthSpeed = Math.max(0.15, Math.min(3, params.branchGrowthSpeed ?? 1))
  const duration = Math.max(1, params.simulationDuration ?? 12)
  const stretchTimeline = params.stretchTimeline !== false
  const byId = new Map((network.branches ?? []).map((b) => [b.id, b]))

  // Pass 1: primaries — timestamp reveal from particle recording
  for (const b of network.branches ?? []) {
    if (b.generation !== 0) continue
    const times = b.pointTimes ?? []
    const tEnd = times.length ? times[times.length - 1] : Math.max(0.5, b.length / (0.35 * growthSpeed))
    b.revealMode = times.length ? 'timestamp' : 'arc'
    b.birthTime = 0
    b.growthDuration = Math.max(0.2, tEnd)
    b.parentAttachmentS = 0
    b.naturalEndTime = b.growthDuration
  }

  // Pass 2+: children in generation order (natural times first)
  const sorted = [...(network.branches ?? [])].sort(
    (a, b) => (a.generation ?? 0) - (b.generation ?? 0),
  )
  for (const b of sorted) {
    if ((b.generation ?? 0) === 0) continue
    const parent = byId.get(b.parentId)
    const attachS = b.parentAttachmentS ?? 0
    let ready = branchDelay * (b.generation ?? 1)
    if (parent) {
      ready = timeAtParentArc(parent, attachS) + branchDelay
    }
    b.revealMode = 'arc'
    b.birthTime = ready
    // Slightly slower ornamental extension so gestures read while growing
    const rate = 0.32 * growthSpeed * (1 - (b.generation - 1) * 0.06)
    b.growthDuration = Math.max(0.45, (b.length || 0.5) / Math.max(0.08, rate))
    b.naturalEndTime = b.birthTime + b.growthDuration
  }

  let naturalEnd = 0
  for (const b of network.branches ?? []) {
    naturalEnd = Math.max(naturalEnd, b.naturalEndTime ?? 0)
  }

  // Stretch sequence across configured duration (keeps relative phasing)
  let stretch = 1
  if (stretchTimeline && naturalEnd > 0.15) {
    const target = duration * 0.94
    stretch = target / naturalEnd
    for (const b of network.branches ?? []) {
      b.birthTime = (b.birthTime ?? 0) * stretch
      b.growthDuration = (b.growthDuration ?? 0.2) * stretch
      if (b.pointTimes?.length) {
        b.pointTimes = b.pointTimes.map((t) => t * stretch)
        // Keep point.t in sync for debugging
        if (b.points) {
          for (let i = 0; i < b.points.length; i += 1) {
            if (b.points[i]) b.points[i].t = b.pointTimes[i]
          }
        }
      }
      b.naturalEndTime = (b.birthTime ?? 0) + (b.growthDuration ?? 0)
    }
    naturalEnd = duration * 0.94
  }

  // Exact sync: mirrored branches inherit master timing after scheduling / stretch
  for (const b of network.branches ?? []) {
    if ((b.compositionRole ?? '') !== 'mirror' || !b.sourceId) continue
    const src = byId.get(b.sourceId)
    if (!src) continue
    b.birthTime = src.birthTime
    b.growthDuration = src.growthDuration
    b.naturalEndTime = src.naturalEndTime
    b.revealMode = src.revealMode
    if (src.pointTimes?.length) {
      b.pointTimes = [...src.pointTimes]
      if (b.points) {
        for (let i = 0; i < b.points.length; i += 1) {
          if (b.points[i] && b.pointTimes[i] != null) b.points[i].t = b.pointTimes[i]
        }
      }
    }
  }

  network.timing = {
    branchDelay,
    branchGrowthSpeed: growthSpeed,
    duration,
    stretchTimeline,
    stretch,
    naturalEnd,
    endTime: stretchTimeline ? duration : Math.max(duration, naturalEnd),
  }
  return network
}

/** Polyline prefix by arc length (includes interpolated tip). */
export function revealByArcLength(points, cum, length, visibleLen) {
  if (!points?.length) return { points: [], tip: null, visibleLength: 0 }
  if (visibleLen <= 0) return { points: [], tip: null, visibleLength: 0 }
  const L = length || cum?.[cum.length - 1] || 0
  if (visibleLen >= L - 1e-9) {
    const tip = points[points.length - 1]
    return {
      points: points.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0, mode: p.mode })),
      tip: { x: tip.x, y: tip.y, z: tip.z ?? 0 },
      visibleLength: L,
    }
  }

  let i = 1
  while (i < cum.length && cum[i] < visibleLen) i += 1
  const i0 = Math.max(0, i - 1)
  const i1 = Math.min(points.length - 1, i)
  const seg = cum[i1] - cum[i0] || 1e-6
  const u = clamp01((visibleLen - cum[i0]) / seg)
  const a = points[i0]
  const b = points[i1]
  const tip = {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * u,
  }
  const out = []
  for (let k = 0; k <= i0; k += 1) {
    out.push({ x: points[k].x, y: points[k].y, z: points[k].z ?? 0, mode: points[k].mode })
  }
  out.push({ ...tip, mode: b.mode ?? 'branch' })
  return { points: out, tip, visibleLength: visibleLen }
}

/** Reveal gen-0 trail using recorded timestamps. */
export function revealByTimestamps(branch, time) {
  const pts = branch.points ?? []
  const times = branch.pointTimes ?? []
  const cum = branch.poly?.cum
  if (!pts.length || !times.length || !cum) {
    return revealByArcLength(pts, cum, branch.length, 0)
  }
  if (time <= 1e-6) return { points: [], tip: null, visibleLength: 0, status: 'waiting' }

  // Find last point with t <= time; interpolate toward next
  let i = 0
  while (i < times.length && times[i] <= time) i += 1
  if (i === 0) {
    // Before any recorded sample after t=0
    return { points: [], tip: null, visibleLength: 0, status: 'waiting' }
  }
  const i0 = i - 1
  if (i >= times.length) {
    const r = revealByArcLength(pts, cum, branch.length, branch.length)
    return { ...r, status: 'done' }
  }
  const t0 = times[i0]
  const t1 = times[i]
  const u = t1 > t0 ? clamp01((time - t0) / (t1 - t0)) : 1
  const s0 = cum[i0]
  const s1 = cum[i]
  const s = s0 + (s1 - s0) * u
  const r = revealByArcLength(pts, cum, branch.length, s)
  return { ...r, status: s >= branch.length - 1e-6 ? 'done' : 'growing' }
}

export function revealBranchAtTime(branch, time) {
  if (!branch) return { points: [], tip: null, visibleLength: 0, status: 'waiting' }

  if (branch.revealMode === 'timestamp') {
    return revealByTimestamps(branch, time)
  }

  const birth = branch.birthTime ?? 0
  const dur = Math.max(1e-4, branch.growthDuration ?? 1)
  if (time < birth) {
    return { points: [], tip: null, visibleLength: 0, status: 'waiting' }
  }
  const u = clamp01((time - birth) / dur)
  const visibleLen = u * (branch.length || 0)
  const poly = branch.poly
  const r = revealByArcLength(
    branch.points,
    poly?.cum,
    branch.length,
    visibleLen,
  )
  let status = 'growing'
  if (u >= 1) status = 'done'
  else if (time < birth) status = 'waiting'
  return { ...r, status }
}

/**
 * Mutable playback clock shared by branching mode UI + renderer.
 */
export function createGrowthPlayback(network, params = {}) {
  scheduleBranchTiming(network, params)
  const duration = Math.max(
    params.simulationDuration ?? 12,
    network.timing?.endTime ?? 12,
  )

  const state = {
    time: 0,
    running: false,
    finished: false,
    duration,
    network,
    speed: 1,
  }

  function recomputeFinished() {
    const allDone = (network.branches ?? []).every((b) => {
      const end = (b.birthTime ?? 0) + (b.growthDuration ?? 0)
      return state.time >= end - 1e-4
    })
    // With timeline stretch, respect configured duration; otherwise allow early completion.
    const stretch = network.timing?.stretchTimeline !== false
    state.finished = stretch
      ? state.time >= state.duration - 1e-4
      : state.time >= state.duration - 1e-4 || allDone
    if (state.finished) state.running = false
  }

  function setTime(t) {
    state.time = Math.max(0, Math.min(duration, t))
    recomputeFinished()
    return getStats()
  }

  function getVisible() {
    const tips = []
    const origins = []
    const visible = []
    let waiting = 0
    let growing = 0
    let done = 0
    for (const b of network.branches ?? []) {
      const r = revealBranchAtTime(b, state.time)
      if (r.status === 'waiting') waiting += 1
      else if (r.status === 'growing') growing += 1
      else done += 1
      if (r.points.length >= 1) {
        visible.push({
          id: b.id,
          generation: b.generation,
          role: b.role,
          compositionRole: b.compositionRole ?? 'master',
          sourceId: b.sourceId ?? null,
          parentId: b.parentId,
          points: r.points,
          status: r.status,
          visibleLength: r.visibleLength,
          length: b.length,
        })
      }
      if (r.status === 'growing' && r.tip) {
        tips.push({
          id: b.id,
          generation: b.generation,
          position: r.tip,
          primary: (b.generation ?? 0) === 0,
        })
      }
      if ((b.generation ?? 0) >= 1) {
        origins.push({
          id: b.id,
          generation: b.generation,
          position: b.origin,
          waiting: r.status === 'waiting',
        })
      }
    }
    return { branches: visible, tips, origins, waiting, growing, done }
  }

  function getStats() {
    const vis = getVisible()
    return {
      time: state.time,
      duration: state.duration,
      running: state.running,
      finished: state.finished,
      waitingBranches: vis.waiting,
      growingBranches: vis.growing,
      completedBranches: vis.done,
      activePrimaryTips: vis.tips.filter((t) => t.primary).length,
      activeSecondaryTips: vis.tips.filter((t) => !t.primary).length,
      branchCount: network.branches?.length ?? 0,
      generations: network.stats?.generations,
      byGeneration: network.stats?.byGeneration,
      originsAttempted: network.stats?.originsAttempted,
      branchesAccepted: network.stats?.branchesAccepted,
      branchesRejected: network.stats?.branchesRejected,
      occupancyTerminations: network.stats?.occupancyTerminations,
      totalSegments: network.stats?.totalSegments,
      elapsedMs: network.stats?.elapsedMs,
      endTime: network.timing?.endTime,
      stretchTimeline: network.timing?.stretchTimeline !== false,
      stretch: network.timing?.stretch ?? 1,
      naturalEnd: network.timing?.naturalEnd,
      compositionMode: network.composition?.mode ?? network.stats?.compositionMode,
      symmetryStrength: network.composition?.strength,
      growthRegion: network.composition?.growthRegion,
      masterCount: network.stats?.masterCount ?? network.composition?.masterCount,
      mirrorCount: network.stats?.mirrorCount ?? network.composition?.mirrorCount,
      symmetryAxisX: network.composition?.axis?.axisX,
    }
  }

  return {
    state,
    network,
    start() {
      if (state.finished && state.time >= state.duration - 1e-4) return
      state.running = true
      state.finished = false
    },
    pause() {
      state.running = false
    },
    toggle() {
      if (state.finished && state.time >= state.duration - 1e-4) {
        setTime(0)
        state.running = true
        state.finished = false
        return
      }
      state.running = !state.running
    },
    reset() {
      state.running = false
      state.finished = false
      setTime(0)
    },
    setTime,
    advance(wallDt) {
      if (!state.running || state.finished) return getStats()
      setTime(state.time + Math.min(0.1, wallDt) * state.speed)
      return getStats()
    },
    getVisible,
    getStats,
    reschedule(nextParams) {
      const merged = { ...params, ...nextParams }
      scheduleBranchTiming(network, merged)
      state.duration = Math.max(
        merged.simulationDuration ?? 12,
        network.timing?.endTime ?? 12,
      )
      setTime(Math.min(state.time, state.duration))
    },
  }
}
