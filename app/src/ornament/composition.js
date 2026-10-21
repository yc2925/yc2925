/**
 * Step 9.7 — Ornamental composition layer.
 *
 * Organizes existing particle trails + L-system branches with bilateral
 * symmetry, rhythmic motif repetition, and architectural growth regions.
 * Does not replace the particle simulator or L-system rewrite engine.
 */

import { V, seededRandom } from '../gothic/primitives.js'
import { clamp01 } from './extract.js'
import { createOccupancy } from './particles.js'
import { generateOrnamentBranches, trailPolyline } from './branching.js'
import { buildCurveGraph } from './curveGraph.js'

export const COMPOSITION_MODES = [
  { id: 'free', label: 'Free Growth' },
  { id: 'bilateral', label: 'Bilateral Symmetry' },
  { id: 'rhythmic', label: 'Rhythmic Repetition' },
]

export const GROWTH_REGIONS = [
  { id: 'upper-tracery', label: 'Upper Tracery' },
  { id: 'arch-shoulders', label: 'Arch Shoulders' },
  { id: 'vertical-mullions', label: 'Vertical Mullions' },
]

export const MOTIF_TYPES = [
  { id: 'scroll', label: 'Scroll' },
  { id: 'paired-tendril', label: 'Paired Tendril' },
  { id: 'terminal-flourish', label: 'Terminal Flourish' },
]

const AXIS_EPS = 0.045

/**
 * Vertical architectural centerline from window bounds / layout.
 * Local X of the specimen — not assumed world-origin.
 */
export function getArchitecturalSymmetryAxis(arch) {
  const half = arch?.bounds?.half ?? arch?.layout?.half ?? 1.5
  const minX = arch?.bounds?.min?.x ?? -half
  const maxX = arch?.bounds?.max?.x ?? half
  const axisX = (minX + maxX) * 0.5
  const y0 = arch?.bounds?.y0 ?? arch?.layout?.sill ?? 0
  const y1 = arch?.bounds?.y1 ?? arch?.layout?.apex ?? arch?.layout?.H ?? 6
  return {
    axisX,
    y0,
    y1,
    // Line segment for debug viz (local specimen space)
    a: { x: axisX, y: y0, z: 0.02 },
    b: { x: axisX, y: y1, z: 0.02 },
  }
}

export function mirrorX(x, axisX) {
  return 2 * axisX - x
}

export function mirrorPoint(p, axis) {
  return {
    x: mirrorX(p.x, axis.axisX),
    y: p.y,
    z: p.z ?? 0,
  }
}

export function mirrorTangent(t, axis) {
  return {
    x: -(t?.x ?? 0),
    y: t?.y ?? 0,
    z: t?.z ?? 0,
  }
}

function meanX(points) {
  if (!points?.length) return 0
  let s = 0
  for (const p of points) s += p.x
  return s / points.length
}

function trailCentroid(trail) {
  const pts = trail.positions ?? trail.points ?? []
  if (!pts.length) return V(0, 0, 0)
  let x = 0
  let y = 0
  let z = 0
  for (const p of pts) {
    x += p.x
    y += p.y
    z += p.z ?? 0
  }
  const n = pts.length
  return V(x / n, y / n, z / n)
}

/**
 * Classify a point / feature into growth regions using arch metadata.
 */
export function classifyGrowthRegion(position, featureType, arch) {
  const y0 = arch?.bounds?.y0 ?? 0
  const y1 = arch?.bounds?.y1 ?? 6
  const yNorm = clamp01((position.y - y0) / Math.max(0.2, y1 - y0))
  const type = featureType ?? ''

  if (
    (type === 'tracery' || type === 'foil' || type === 'cusp' || type === 'junction') &&
    yNorm >= 0.52
  ) {
    return 'upper-tracery'
  }
  if (
    (type === 'frame' || type === 'arch' || type === 'tracery') &&
    yNorm >= 0.35 &&
    yNorm < 0.72
  ) {
    return 'arch-shoulders'
  }
  if (type === 'mullion' || (type === 'frame' && yNorm < 0.45)) {
    return 'vertical-mullions'
  }
  if (yNorm >= 0.55) return 'upper-tracery'
  if (yNorm >= 0.32) return 'arch-shoulders'
  return 'vertical-mullions'
}

export function trailInRegion(trail, region, arch) {
  const c = trailCentroid(trail)
  const ft =
    trail.sourceFeatureType ??
    trail.features?.[0] ??
    (trail.sourceFeatureId?.includes?.('mullion') ? 'mullion' : 'tracery')
  return classifyGrowthRegion(c, ft, arch) === region
}

/**
 * Keep trails whose centroid lies in the requested architectural zone.
 */
export function filterTrailsByRegion(trails, region, arch) {
  const id = region ?? 'upper-tracery'
  const hit = (trails ?? []).filter((t) => trailInRegion(t, id, arch))
  return hit.length ? hit : trails ?? []
}

/**
 * Prefer trails on the master half (x >= axis). Cap count.
 */
export function selectMasterTrails(trails, axis, maxCount) {
  const n = Math.max(1, Math.round(maxCount ?? 3))
  const scored = (trails ?? []).map((t) => {
    const c = trailCentroid(t)
    const onMaster = c.x >= axis.axisX - AXIS_EPS
    const score = (onMaster ? 2 : 0) + Math.max(0, c.x - axis.axisX) + (t.positions?.length ?? 0) * 0.001
    return { t, c, onMaster, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const masters = scored.filter((s) => s.onMaster).slice(0, n)
  if (masters.length >= Math.min(1, n)) return masters.map((s) => s.t)
  // Fallback: take highest-x trails
  return scored.slice(0, n).map((s) => s.t)
}

function rotate2(tx, ty, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: tx * c - ty * s, y: tx * s + ty * c }
}

function polylineLength(points) {
  let L = 0
  for (let i = 1; i < points.length; i += 1) {
    L += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return L
}

/**
 * Parametric ornamental motifs (curves only).
 */
export function generateMotif({
  type = 'scroll',
  origin,
  tangent,
  normal,
  scale = 0.55,
  curvature = 0.7,
  seed = 1,
  duration = 1.2,
  side = 1,
}) {
  const rand = seededRandom(seed, 717)
  const o = origin
  const T = V(tangent.x, tangent.y, 0)
  if (T.lengthSq() < 1e-12) T.set(0, 1, 0)
  else T.normalize()
  let N = normal
    ? V(normal.x, normal.y, 0)
    : V(-T.y, T.x, 0)
  if (N.lengthSq() < 1e-12) N = V(-T.y, T.x, 0)
  else N.normalize()
  N.multiplyScalar(side >= 0 ? 1 : -1)

  const points = []
  const times = []
  const sc = Math.max(0.12, scale)
  const curl = Math.max(0.15, Math.min(1.4, curvature))

  const push = (x, y, z, t, mode = 'motif') => {
    points.push({ x, y, z: z ?? o.z ?? 0, mode, t })
    times.push(t)
  }

  if (type === 'paired-tendril') {
    // Shared origin; two short tendrils — caller may call twice with side ±1
    const steps = 10
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps
      const ang = curl * 0.55 * u * u
      const dir = rotate2(T.x, T.y, ang * (side >= 0 ? 1 : -1))
      const fwd = sc * u * 0.85
      const out = sc * 0.22 * Math.sin(u * Math.PI) * (0.7 + curl * 0.3)
      const x = o.x + dir.x * fwd + N.x * out
      const y = o.y + dir.y * fwd + N.y * out
      push(x, y, o.z, u * duration)
    }
  } else if (type === 'terminal-flourish') {
    const steps = 8
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps
      const ang = curl * 1.1 * u * u * (0.85 + rand() * 0.1)
      const dir = rotate2(T.x, T.y, ang * side)
      const r = sc * (0.35 + 0.45 * u)
      const x = o.x + T.x * r * 0.55 + dir.x * r * 0.35 * u
      const y = o.y + T.y * r * 0.55 + dir.y * r * 0.35 * u
      push(x, y, o.z, u * duration * 0.75, 'curl')
    }
  } else {
    // scroll — smooth curling tendril
    const steps = 16
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps
      const spiral = curl * Math.PI * 1.15 * u
      const radius = sc * (0.12 + 0.72 * u)
      const dir = rotate2(T.x, T.y, spiral * side)
      const along = sc * u * 0.62
      const x = o.x + T.x * along + dir.x * radius * 0.55
      const y = o.y + T.y * along + dir.y * radius * 0.55
      push(x, y, o.z, u * duration)
    }
  }

  return {
    points,
    pointTimes: times,
    length: polylineLength(points),
    growthDuration: duration,
    type,
    scale: sc,
    curvature: curl,
    origin: { x: o.x, y: o.y, z: o.z ?? 0 },
    orientation: { x: T.x, y: T.y, z: 0 },
  }
}

function sampleCurveAt(curve, s) {
  const pts = curve.points
  const cum = curve.cum
  const L = curve.length
  const d = Math.min(L, Math.max(0, s))
  let i = 1
  while (i < cum.length && cum[i] < d) i += 1
  const i0 = Math.max(0, i - 1)
  const i1 = Math.min(pts.length - 1, i)
  const seg = cum[i1] - cum[i0] || 1e-6
  const t = clamp01((d - cum[i0]) / seg)
  const position = {
    x: pts[i0].x + (pts[i1].x - pts[i0].x) * t,
    y: pts[i0].y + (pts[i1].y - pts[i0].y) * t,
    z: (pts[i0].z ?? 0) + ((pts[i1].z ?? 0) - (pts[i0].z ?? 0)) * t,
  }
  const tangent = V(pts[i1].x - pts[i0].x, pts[i1].y - pts[i0].y, 0)
  if (tangent.lengthSq() < 1e-12) tangent.set(0, 1, 0)
  else tangent.normalize()
  const normal = V(-tangent.y, tangent.x, 0)
  return { position, tangent, normal }
}

function curvesForRegion(graph, region) {
  const id = region ?? 'upper-tracery'
  return graph.curves.filter((c) => {
    const mid = sampleCurveAt(c, c.length * 0.5)
    return classifyGrowthRegion(mid.position, c.featureType, { bounds: graph.bounds }) === id
  })
}

/**
 * Build a branch-like network from rhythmic motifs along architectural curves.
 */
export function buildRhythmicMotifNetwork(arch, params = {}) {
  const graph = buildCurveGraph(arch)
  const axis = getArchitecturalSymmetryAxis(arch)
  const region = params.growthRegion ?? 'upper-tracery'
  const motifType = params.motifType ?? 'scroll'
  const spacing = Math.max(0.18, params.motifSpacing ?? 0.55)
  const scale = Math.max(0.15, params.motifScale ?? 0.55)
  const repetition = Math.max(1, Math.min(24, Math.round(params.repetitionCount ?? 4)))
  const seed = Math.round(params.growthSeed ?? 11)
  const strength = clamp01(params.symmetryStrength ?? 1)
  const mirrorMotifs = params.compositionMode !== 'free'
  const rand = seededRandom(seed, 421)

  let curves = curvesForRegion(graph, region)
  if (!curves.length) curves = graph.curves.slice(0, 4)

  // Prefer master-side samples when mirroring
  const branches = []
  const motifOrigins = []
  let nextId = 0
  const occupancy = createOccupancy(graph.bounds, Math.max(0.08, spacing * 0.35))

  for (const curve of curves) {
    if (branches.length >= repetition * 4) break
    const usable = Math.max(0.2, curve.length - spacing * 0.5)
    let s = spacing * (0.35 + rand() * 0.2)
    let placedOnCurve = 0
    while (s < usable && placedOnCurve < repetition && branches.length < 180) {
      const sample = sampleCurveAt(curve, s)
      // Master half only when we will mirror
      if (mirrorMotifs && sample.position.x < axis.axisX - AXIS_EPS) {
        s += spacing
        continue
      }
      // Skip near-axis duplicates
      const onAxis = Math.abs(sample.position.x - axis.axisX) < AXIS_EPS
      const side = sample.position.x >= axis.axisX ? 1 : -1
      const types =
        motifType === 'paired-tendril'
          ? [
              { type: 'paired-tendril', side: 1 },
              { type: 'paired-tendril', side: -1 },
            ]
          : [{ type: motifType, side }]

      const group = []
      for (const spec of types) {
        const motif = generateMotif({
          type: spec.type,
          origin: sample.position,
          tangent: sample.tangent,
          normal: sample.normal,
          scale: scale * (0.9 + rand() * 0.15),
          curvature: 0.55 + rand() * 0.4,
          seed: seed + nextId * 13,
          duration: 0.9 + scale * 0.5,
          side: spec.side,
        })
        if (motif.points.length < 3) continue

        // Occupancy on master
        let blocked = false
        for (let i = 1; i < motif.points.length; i += 1) {
          const a = motif.points[i - 1]
          const b = motif.points[i]
          const q = occupancy.query(b.x, b.y, `tmp${nextId}`, spacing * 0.55, { mode: 'free' })
          if (q.blocked) {
            blocked = true
            break
          }
        }
        if (blocked) continue

        const id = `motif${nextId++}`
        for (let i = 1; i < motif.points.length; i += 1) {
          const a = motif.points[i - 1]
          const b = motif.points[i]
          occupancy.insertSegment(a.x, a.y, b.x, b.y, id, { mode: 'free' })
        }

        const poly = trailPolyline({ positions: motif.points })
        const branch = {
          id,
          parentId: null,
          generation: 0,
          role: 'motif',
          compositionRole: 'master',
          motifType: spec.type,
          origin: motif.origin,
          originTangent: { x: sample.tangent.x, y: sample.tangent.y, z: 0 },
          points: motif.points,
          pointTimes: motif.pointTimes,
          length: motif.length,
          poly,
          birthTime: 0,
          growthDuration: motif.growthDuration,
          naturalEndTime: motif.growthDuration,
          revealMode: 'arc',
          children: [],
          parentAttachmentS: 0,
          attachmentPosition: { ...motif.origin },
          architecturalFeatureId: curve.id,
          terminationReason: 'motif',
          sourceId: null,
        }
        group.push(branch)
        motifOrigins.push({
          id,
          position: motif.origin,
          curveId: curve.id,
          role: 'master',
        })
      }

      if (group.length) {
        branches.push(...group)
        placedOnCurve += 1
      }
      s += spacing
    }
  }

  let network = {
    branches,
    roots: branches.map((b) => b.id),
    stats: {
      originsAttempted: motifOrigins.length,
      branchesAccepted: branches.length,
      branchesRejected: 0,
      occupancyTerminations: 0,
      byGeneration: { 0: branches.length, 1: 0, 2: 0, 3: 0 },
      elapsedMs: 0,
      generations: 0,
      totalSegments: branches.reduce((n, b) => n + Math.max(0, b.points.length - 1), 0),
      branchCount: branches.length,
      compositionMode: 'rhythmic',
    },
    params: {
      compositionMode: 'rhythmic',
      motifType,
      motifSpacing: spacing,
      motifScale: scale,
      repetitionCount: repetition,
      growthRegion: region,
    },
    composition: {
      mode: 'rhythmic',
      axis,
      motifOrigins,
      growthRegion: region,
    },
  }

  if (mirrorMotifs && strength > 0.02) {
    network = applyBilateralSymmetry(network, {
      axis,
      strength,
      seed,
      trailSpacing: spacing * 0.5,
      arch,
    })
    network.stats.compositionMode = 'rhythmic'
    network.composition.mode = 'rhythmic'
  }

  return network
}

function isNearAxis(points, axis) {
  if (!points?.length) return true
  let maxAbs = 0
  for (const p of points) {
    maxAbs = Math.max(maxAbs, Math.abs(p.x - axis.axisX))
  }
  return maxAbs < AXIS_EPS
}

/**
 * Subtle seeded variation on an already-mirrored polyline when strength < 1.
 * Keeps origin fixed; smooth length / curl tweaks only.
 */
function applyAsymmetryWarp(points, strength, rand) {
  const asym = 1 - clamp01(strength)
  if (asym < 0.02 || points.length < 3) return points
  const out = points.map((p) => ({ ...p }))
  const lenScale = 1 - asym * (0.08 + rand() * 0.12)
  const curlAmp = asym * (0.04 + rand() * 0.06)
  const phase = rand() * Math.PI * 2
  const o = out[0]
  for (let i = 1; i < out.length; i += 1) {
    const u = i / (out.length - 1)
    const dx = out[i].x - o.x
    const dy = out[i].y - o.y
    const px = -dy
    const py = dx
    const plen = Math.hypot(px, py) || 1
    const wave = Math.sin(phase + u * Math.PI * 1.6) * curlAmp * u
    out[i].x = o.x + dx * lenScale + (px / plen) * wave
    out[i].y = o.y + dy * lenScale + (py / plen) * wave
  }
  // Optionally trim tip for shorter mirrored gestures
  if (asym > 0.35 && out.length > 4) {
    const keep = Math.max(3, Math.floor(out.length * (1 - asym * 0.2)))
    return out.slice(0, keep)
  }
  return out
}

/**
 * Reflect master network across architectural axis. Exact at strength=1.
 */
export function applyBilateralSymmetry(network, opts = {}) {
  const axis = opts.axis ?? getArchitecturalSymmetryAxis(opts.arch)
  const strength = clamp01(opts.strength ?? 1)
  const seed = Math.round(opts.seed ?? 11)
  const rand = seededRandom(seed, 808)
  const spacing = Math.max(0.06, opts.trailSpacing ?? 0.14)
  const arch = opts.arch
  const graph = arch ? buildCurveGraph(arch) : null
  const occupancy = graph
    ? createOccupancy(graph.bounds, spacing * 0.75)
    : null

  const masters = []
  const idMap = new Map()

  for (const b of network.branches ?? []) {
    const role = b.compositionRole ?? 'master'
    if (role === 'mirror') continue
    b.compositionRole = 'master'
    b.sourceId = b.sourceId ?? null
    masters.push(b)
    if (!isNearAxis(b.points, axis)) {
      idMap.set(b.id, `m:${b.id}`)
    }
  }

  // Seed occupancy with master geometry
  if (occupancy) {
    for (const b of masters) {
      for (let i = 1; i < (b.points?.length ?? 0); i += 1) {
        const a = b.points[i - 1]
        const bpt = b.points[i]
        occupancy.insertSegment(a.x, a.y, bpt.x, bpt.y, b.id, { mode: 'free' })
      }
    }
  }

  const mirrors = []
  const rejectedPairs = []

  for (const b of masters) {
    const mid = idMap.get(b.id)
    if (!mid) continue // on-axis — no duplicate

    let pts = (b.points ?? []).map((p) => ({
      ...mirrorPoint(p, axis),
      mode: p.mode,
      t: p.t,
    }))
    pts = applyAsymmetryWarp(pts, strength, rand)

    // Register mirrored geometry in occupancy. Near-axis samples are skipped so
    // centerline coincidence is not double-counted. Do not reject the pair —
    // moving only one half would break exact symmetry.
    if (occupancy) {
      for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1]
        const c = pts[i]
        if (Math.abs(c.x - axis.axisX) < AXIS_EPS && Math.abs(a.x - axis.axisX) < AXIS_EPS) {
          continue
        }
        occupancy.insertSegment(a.x, a.y, c.x, c.y, mid, { mode: 'free' })
      }
    }

    const poly = trailPolyline({ positions: pts })
    // If parent was on-axis (no mirror id), keep attachment to the shared parent
    const parentId = b.parentId
      ? idMap.has(b.parentId)
        ? idMap.get(b.parentId)
        : b.parentId
      : null

    const mirror = {
      ...b,
      id: mid,
      parentId,
      sourceId: b.id,
      compositionRole: 'mirror',
      origin: mirrorPoint(b.origin ?? pts[0], axis),
      originTangent: mirrorTangent(b.originTangent ?? { x: 1, y: 0 }, axis),
      points: pts,
      pointTimes: b.pointTimes ? [...b.pointTimes] : undefined,
      poly,
      length: poly.length,
      birthTime: b.birthTime ?? 0,
      growthDuration: b.growthDuration ?? 0,
      naturalEndTime: b.naturalEndTime,
      revealMode: b.revealMode ?? 'arc',
      parentAttachmentS: b.parentAttachmentS ?? 0,
      attachmentPosition: b.attachmentPosition
        ? mirrorPoint(b.attachmentPosition, axis)
        : mirrorPoint(b.origin ?? pts[0], axis),
      children: (b.children ?? []).map((cid) => idMap.get(cid)).filter(Boolean),
      role: b.role,
      generation: b.generation,
    }
    mirrors.push(mirror)
  }

  const rejected = new Set(rejectedPairs)
  // Drop rejected masters and their descendants so hierarchy stays valid
  const drop = new Set(rejected)
  let grew = true
  while (grew) {
    grew = false
    for (const b of masters) {
      if (drop.has(b.id)) continue
      if (b.parentId && drop.has(b.parentId)) {
        drop.add(b.id)
        idMap.delete(b.id)
        grew = true
      }
    }
  }
  const finalMasters = masters.filter((b) => !drop.has(b.id))
  const finalMirrors = mirrors.filter((m) => !drop.has(m.sourceId))

  for (const b of finalMasters) {
    b.children = (b.children ?? []).filter(
      (cid) => finalMasters.some((x) => x.id === cid) || idMap.has(cid),
    )
  }

  const branches = [...finalMasters, ...finalMirrors]
  const byGeneration = { 0: 0, 1: 0, 2: 0, 3: 0 }
  for (const b of branches) {
    const g = b.generation ?? 0
    byGeneration[g] = (byGeneration[g] ?? 0) + 1
  }

  return {
    ...network,
    branches,
    roots: branches.filter((b) => !b.parentId).map((b) => b.id),
    stats: {
      ...network.stats,
      branchCount: branches.length,
      byGeneration,
      masterCount: finalMasters.length,
      mirrorCount: finalMirrors.length,
      rejectedPairs: rejectedPairs.length,
      totalSegments: branches.reduce((n, b) => n + Math.max(0, (b.points?.length ?? 1) - 1), 0),
    },
    composition: {
      ...(network.composition ?? {}),
      mode: network.composition?.mode ?? 'bilateral',
      axis,
      strength,
      masterCount: finalMasters.length,
      mirrorCount: finalMirrors.length,
      idMap: Object.fromEntries(idMap),
      motifOrigins: [
        ...(network.composition?.motifOrigins ?? []),
        ...finalMirrors
          .filter((m) => m.role === 'motif')
          .map((m) => ({
            id: m.id,
            position: m.origin,
            role: 'mirror',
            sourceId: m.sourceId,
          })),
      ],
    },
  }
}

/**
 * Main composition entry — wraps trail → branch generation.
 */
export function composeOrnamentNetwork({ trails, arch, curveSamples, params = {} }) {
  const mode = params.compositionMode ?? 'bilateral'
  const region = params.growthRegion ?? 'upper-tracery'
  const axis = getArchitecturalSymmetryAxis(arch)
  const seed = Math.round(params.growthSeed ?? 11)
  const strength = clamp01(params.symmetryStrength ?? 1)
  const masterCount = Math.max(1, Math.round(params.masterPathCount ?? params.particleCount ?? 3))

  if (mode === 'rhythmic') {
    return buildRhythmicMotifNetwork(arch, params)
  }

  let working = filterTrailsByRegion(trails, region, arch)

  if (mode === 'bilateral') {
    working = selectMasterTrails(working, axis, masterCount)
    // If region filter emptied the master side, fall back to all trails
    if (!working.length) {
      working = selectMasterTrails(trails, axis, masterCount)
    }
    if (!working.length) {
      working = (trails ?? []).slice(0, masterCount)
    }
  }

  const network = generateOrnamentBranches({
    trails: working,
    arch,
    curveSamples,
    params,
  })

  // Tag masters
  for (const b of network.branches ?? []) {
    b.compositionRole = 'master'
    b.sourceId = null
  }

  network.composition = {
    mode,
    axis,
    strength: mode === 'bilateral' ? strength : 0,
    growthRegion: region,
    masterTrailCount: working.length,
    motifOrigins: [],
  }

  if (mode === 'free') {
    network.stats = { ...network.stats, compositionMode: 'free' }
    return network
  }

  // bilateral
  const composed = applyBilateralSymmetry(network, {
    axis,
    strength,
    seed,
    trailSpacing: params.trailSpacing ?? 0.14,
    arch,
  })
  composed.stats.compositionMode = 'bilateral'
  composed.params = {
    ...composed.params,
    compositionMode: 'bilateral',
    symmetryStrength: strength,
    growthRegion: region,
  }
  return composed
}
