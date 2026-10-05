import * as THREE from 'three'
import { fbm3 } from '../shaders/noise3.js'

export const ANCHOR = { NONE: 0, TERMINAL: 1, SECONDARY: 2, PRIMARY: 3 }

/** Runs a stage and reports its duration, so the view can show compute cost. */
export function timed(run) {
  const start = performance.now()
  const value = run()
  return { value, ms: performance.now() - start }
}

const FEATURE_RADIUS = 0.2
const FEATURE_WEIGHTS = { arch: 0.9, column: 0.7, ledge: 0.6, ring: 0.9 }
const SHELTER_WEIGHT = 0.5
const NOISE_WEIGHT = 0.15
const NORMAL_OFFSET = 0.012
const PRIMARY_SPACING = 0.6
const SECONDARY_SPACING = 0.2
const PRIMARY_MIN = 0.72
const SECONDARY_MIN = 0.5
const PRIMARY_FEATURE_MIN = 0.55

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Front-visible triangles of every part, with cumulative area for area-weighted sampling. */
export function buildSampler(facade) {
  const tris = []
  const cumulative = []
  let total = 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()

  facade.parts.forEach((part, partIndex) => {
    const pos = part.geometry.attributes.position
    const nrm = part.geometry.attributes.normal
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i)
      b.fromBufferAttribute(pos, i + 1)
      c.fromBufferAttribute(pos, i + 2)
      n.subVectors(c, b).cross(a.clone().sub(b))
      const area = n.length() * 0.5
      if (area < 1e-7) continue
      n.normalize()
      // Back of the wall and faces pointing away from the viewer are never visible.
      if (n.z < -0.3) continue
      total += area
      tris.push({ partIndex, i, pos, nrm })
      cumulative.push(total)
    }
  })

  return { tris, cumulative, total }
}

function segmentDistance(p, a, b) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const len2 = abx * abx + aby * aby + abz * abz
  let t = len2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len2 : 0
  t = Math.min(1, Math.max(0, t))
  const dx = p.x - (a.x + abx * t)
  const dy = p.y - (a.y + aby * t)
  const dz = p.z - (a.z + abz * t)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function featureDistance(p, polylines) {
  let best = Infinity
  for (const line of polylines) {
    for (let i = 0; i < line.length - 1; i += 1) {
      const d = segmentDistance(p, line[i], line[i + 1])
      if (d < best) best = d
    }
  }
  return best
}

/** Seed and count only: candidate positions do not depend on the distribution mode. */
export function sampleCandidates(facade, sampler, count, seed) {
  const rand = mulberry32(seed * 9973 + 17)
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const kinds = new Uint8Array(count)
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  const va = new THREE.Vector3()
  const vb = new THREE.Vector3()
  const vc = new THREE.Vector3()
  const na = new THREE.Vector3()
  const nb = new THREE.Vector3()
  const nc = new THREE.Vector3()
  const { tris, cumulative, total } = sampler

  let filled = 0
  let attempts = 0
  while (filled < count && attempts < count * 4) {
    attempts += 1
    const target = rand() * total
    let lo = 0
    let hi = cumulative.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cumulative[mid] < target) lo = mid + 1
      else hi = mid
    }
    const tri = tris[lo]
    let u = rand()
    let v = rand()
    if (u + v > 1) {
      u = 1 - u
      v = 1 - v
    }
    const w = 1 - u - v
    va.fromBufferAttribute(tri.pos, tri.i)
    vb.fromBufferAttribute(tri.pos, tri.i + 1)
    vc.fromBufferAttribute(tri.pos, tri.i + 2)
    na.fromBufferAttribute(tri.nrm, tri.i)
    nb.fromBufferAttribute(tri.nrm, tri.i + 1)
    nc.fromBufferAttribute(tri.nrm, tri.i + 2)
    p.set(0, 0, 0).addScaledVector(va, w).addScaledVector(vb, u).addScaledVector(vc, v)
    n.set(0, 0, 0).addScaledVector(na, w).addScaledVector(nb, u).addScaledVector(nc, v).normalize()

    // Reject points buried inside another solid (wall behind a column, etc.).
    const probe = p.clone().addScaledVector(n, 0.004)
    const buried = facade.parts.some(
      (part, index) => index !== tri.partIndex && part.contains && part.contains(probe),
    )
    if (buried) continue

    positions[filled * 3] = p.x + n.x * NORMAL_OFFSET
    positions[filled * 3 + 1] = p.y + n.y * NORMAL_OFFSET
    positions[filled * 3 + 2] = p.z + n.z * NORMAL_OFFSET
    normals[filled * 3] = n.x
    normals[filled * 3 + 1] = n.y
    normals[filled * 3 + 2] = n.z
    kinds[filled] = Math.max(0, ['wall', 'recess', 'arch', 'column', 'ledge', 'ring'].indexOf(facade.parts[tri.partIndex].kind))
    filled += 1
  }

  return {
    count: filled,
    positions: positions.subarray(0, filled * 3),
    normals: normals.subarray(0, filled * 3),
    kinds: kinds.subarray(0, filled),
  }
}

/**
 * Per-candidate architectural measurements, each 0–1.
 * Independent of sliders, so they are computed once per candidate set.
 */
export function measureArchitecture(facade, candidates) {
  const { count, positions, normals } = candidates
  const height = new Float32Array(count)
  const feature = new Float32Array(count)
  const orientation = new Float32Array(count)
  const subtle = new Float32Array(count)
  const p = new THREE.Vector3()
  const { minY, maxY, frontZ, recessDepth } = facade.bounds
  const types = Object.keys(FEATURE_WEIGHTS)

  for (let i = 0; i < count; i += 1) {
    p.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    const ny = normals[i * 3 + 1]

    height[i] = (p.y - minY) / (maxY - minY)

    // Feature proximity: soft union of nearness to each feature family,
    // plus shelter (depth into the portal). Intersections score highest.
    let miss = 1
    for (const type of types) {
      const d = featureDistance(p, facade.features[type])
      miss *= 1 - FEATURE_WEIGHTS[type] * Math.exp(-((d / FEATURE_RADIUS) ** 2))
    }
    const shelter = Math.min(1, Math.max(0, (frontZ - p.z) / recessDepth))
    miss *= 1 - SHELTER_WEIGHT * shelter
    feature[i] = 1 - miss

    // Upward faces collect growth, vertical faces are neutral, soffits are avoided.
    orientation[i] = ny >= 0 ? 0.7 + 0.3 * ny : 0.7 * (1 + ny)

    subtle[i] = fbm3(p.x * 1.3 + 11.7, p.y * 1.3 + 3.1, p.z * 1.3 + 7.9, 3)
  }

  return { height, feature, orientation, subtle }
}

function normalise(values) {
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min || 1
  for (let i = 0; i < values.length; i += 1) values[i] = (values[i] - min) / span
  return values
}

/**
 * growthSuitability (0–1) for every candidate, depending on the mode:
 *  random        white noise (no evaluation)
 *  noise         fBm field at Noise Scale
 *  architectural weighted mean of height and feature (+ subtle noise), scaled by orientation
 * Values are normalised across the candidate set.
 */
export function evaluateSuitability(candidates, measures, settings) {
  const { count, positions } = candidates
  const suitability = new Float32Array(count)
  const rand = mulberry32(settings.seed * 7919 + 3)

  if (settings.mode === 'random') {
    for (let i = 0; i < count; i += 1) suitability[i] = rand()
    return suitability
  }

  if (settings.mode === 'noise') {
    const s = settings.noiseScale
    for (let i = 0; i < count; i += 1) {
      suitability[i] = fbm3(
        positions[i * 3] * s + settings.seed * 3.17,
        positions[i * 3 + 1] * s,
        positions[i * 3 + 2] * s,
        4,
      )
    }
    return normalise(suitability)
  }

  // Height and features are averaged; orientation scales the result,
  // so a soffit stays poor however close it is to an arch.
  const wh = Math.abs(settings.heightBias)
  const wf = settings.featureAttraction
  const wo = settings.orientationBias
  const total = wh + wf + NOISE_WEIGHT
  for (let i = 0; i < count; i += 1) {
    const h = settings.heightBias >= 0 ? measures.height[i] : 1 - measures.height[i]
    const base = (wh * h + wf * measures.feature[i] + NOISE_WEIGHT * measures.subtle[i]) / total
    suitability[i] = base * (1 - wo + wo * measures.orientation[i])
  }
  return normalise(suitability)
}

/**
 * Acceptance per mode, then classification of accepted anchors.
 *  random        accept with probability = Density
 *  noise         suitability above Threshold, thinned by Density
 *  architectural accept with probability Density · suitability²
 * Classification walks anchors from most to least suitable:
 *  PRIMARY    high suitability (and on a feature, in architectural mode), widely spaced
 *  SECONDARY  medium suitability, moderately spaced
 *  TERMINAL   everything else that was accepted
 */
export function selectAnchors(candidates, measures, suitability, settings) {
  const { count, positions } = candidates
  const rand = mulberry32(settings.seed * 104729 + 11)
  const accepted = []

  for (let i = 0; i < count; i += 1) {
    const r = rand()
    const s = suitability[i]
    let keep
    if (settings.mode === 'random') keep = r < settings.density
    else if (settings.mode === 'noise') keep = s > settings.noiseThreshold && r < settings.density
    else keep = r < settings.density * s * s
    if (keep) accepted.push(i)
  }

  accepted.sort((a, b) => suitability[b] - suitability[a])
  const classes = new Uint8Array(count)
  const cell = PRIMARY_SPACING
  const grid = new Map()
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`

  const nearby = (i, minDist, kinds) => {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    const cx = Math.floor(x / cell)
    const cy = Math.floor(y / cell)
    const cz = Math.floor(z / cell)
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`)
          if (!list) continue
          for (const j of list) {
            if (!kinds.includes(classes[j])) continue
            const d = Math.hypot(x - positions[j * 3], y - positions[j * 3 + 1], z - positions[j * 3 + 2])
            if (d < minDist) return true
          }
        }
      }
    }
    return false
  }

  const architectural = settings.mode === 'architectural'
  const counts = { primary: 0, secondary: 0, terminal: 0 }
  for (const i of accepted) {
    const s = suitability[i]
    const structural = !architectural || measures.feature[i] >= PRIMARY_FEATURE_MIN
    let kind = ANCHOR.TERMINAL
    if (s >= PRIMARY_MIN && structural && !nearby(i, PRIMARY_SPACING, [ANCHOR.PRIMARY])) {
      kind = ANCHOR.PRIMARY
    } else if (s >= SECONDARY_MIN && !nearby(i, SECONDARY_SPACING, [ANCHOR.PRIMARY, ANCHOR.SECONDARY])) {
      kind = ANCHOR.SECONDARY
    }
    classes[i] = kind
    if (kind === ANCHOR.PRIMARY) counts.primary += 1
    else if (kind === ANCHOR.SECONDARY) counts.secondary += 1
    else counts.terminal += 1
    if (kind !== ANCHOR.TERMINAL) {
      const k = key(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      const list = grid.get(k)
      if (list) list.push(i)
      else grid.set(k, [i])
    }
  }

  return { classes, accepted: accepted.length, counts }
}
