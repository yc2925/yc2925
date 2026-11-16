/**
 * Skeleton → lithic signed distance field (Step 47, Phase C1).
 *
 *   d = smoothUnion( member capsules · thickness · hierarchy ,
 *                    anisotropic accretion lobes seeded along members )
 *   d += roughness · noise ; d += erosion · fbm⁺            (surface / carving)
 *   d += layering · fract(y / layerHeight) · layerHeight/2  (strata, REF-025)
 *   d  = max(d, pores) with an upward porosity gradient     (REF-022)
 *   d  = smoothSubtract(d, protected openings)              (REF-023 / 027)
 *
 * d < 0 inside rock. All randomness comes from the structure seed, so the
 * same curve + params + seed always produce the same field.
 * Pure JS — runs in the lithic worker and in node validation.
 */

import { createValueNoise3D } from '../../voxel/noise3d.js'
import { DEFAULT_LITHIC_PARAMS } from './params.js'

const HIERARCHY = {
  pier: 1.0,
  tower: 1.1,
  towerCrown: 0.9,
  spire: 1.0,
  transverseArch: 0.9,
  arcadeArch: 0.85,
  diagonalRib: 0.7,
  ridgeRib: 0.6,
  buttressPier: 0.85,
  flyingButtress: 0.7,
}

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

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const toA = (p) => [p.x, p.y, p.z]
function normA(a) {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
function crossA(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/**
 * Build the field description (plain data, structured-cloneable).
 */
export function buildLithicField(skeleton, inputParams = {}, seed = 1) {
  const P = { ...DEFAULT_LITHIC_PARAMS, ...inputParams }
  const rand = mulberry32((seed * 2654435761) >>> 0)
  const capsules = []
  const lobes = []
  const blend = P.cohesion

  for (const m of skeleton.members) {
    const w = HIERARCHY[m.kind] ?? 0.8
    const n = m.points.length
    for (let i = 1; i < n; i += 1) {
      const a = toA(m.points[i - 1])
      const b = toA(m.points[i])
      const ra = (m.r0 + ((m.r1 - m.r0) * (i - 1)) / Math.max(1, n - 1)) * P.formationThickness
      const rb = (m.r0 + ((m.r1 - m.r0) * i) / Math.max(1, n - 1)) * P.formationThickness
      const ab = sub(b, a)
      const segLen = len(ab)
      if (segLen < 1e-6) continue
      capsules.push({ a, b, ab, ab2: dot(ab, ab), ra, rb, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], br: segLen / 2 + Math.max(ra, rb) })

      // Accretion lobes along the segment (REF-023 / 028).
      const expected = (segLen * P.rockDensity * w) / Math.max(0.4, P.rockSize * 0.8)
      let count = Math.floor(expected)
      if (rand() < expected - count) count += 1
      const dir = normA(ab)
      const ref = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
      const u1 = normA(crossA(dir, ref))
      const u2 = crossA(dir, u1)
      for (let k = 0; k < count; k += 1) {
        const t = rand()
        const center = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]
        const ang = rand() * Math.PI * 2
        let off = [u1[0] * Math.cos(ang) + u2[0] * Math.sin(ang), u1[1] * Math.cos(ang) + u2[1] * Math.sin(ang), u1[2] * Math.cos(ang) + u2[2] * Math.sin(ang)]
        // Gravity: bias offsets toward the underside and droop the lobe (drips).
        off = normA([off[0], off[1] - P.gravity * 1.5, off[2]])
        const rLocal = ra + (rb - ra) * t
        const mag = rLocal * (0.4 + (1 - P.adherence) * 2.2) * (0.5 + rand())
        center[0] += off[0] * mag
        center[1] += off[1] * mag - P.gravity * P.rockSize * 0.6 * rand()
        center[2] += off[2] * mag
        const base = P.rockSize * (1 + P.sizeVariation * (rand() * 2 - 1)) * (0.6 + 0.4 * w)
        // Gravity also stretches some lobes vertically into pendants.
        const pendant = P.gravity > 0 && rand() < P.gravity * 0.35
        const axisU = pendant ? [0, 1, 0] : dir
        const ref2 = Math.abs(axisU[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
        const axisV = normA(crossA(axisU, ref2))
        const axisW = crossA(axisU, axisV)
        const r = [base * (pendant ? 1 + P.gravity * 2 : P.elongation), base, base * 0.85]
        lobes.push({ c: center, u: axisU, v: axisV, w: axisW, r, rmin: Math.min(r[0], r[1], r[2]), br: Math.max(r[0], r[1], r[2]) })
      }
    }
  }

  const protectedVols = (skeleton.protected ?? []).map((pv) => ({
    ...pv,
    o: toA(pv.origin),
    x: toA(pv.xAxis),
    y: toA(pv.yAxis),
    z: toA(pv.zAxis),
    br: Math.hypot(Math.max(pv.a, pv.R + Math.abs(pv.c)), pv.springY + pv.R + 2, pv.halfDepth),
  }))

  const groundY = (skeleton.sourcePolyline ?? []).reduce((lo, p) => Math.min(lo, p.y), Infinity)
  const b = skeleton.bounds
  const margin = P.rockSize * (1 + P.sizeVariation) * Math.max(P.elongation, 1 + P.gravity * 2) + blend + 1
  const bounds = {
    min: [b.min.x - margin, Math.max(b.min.y - margin, (Number.isFinite(groundY) ? groundY : 0) - 1.5), b.min.z - margin],
    max: [b.max.x + margin, b.max.y + margin, b.max.z + margin],
  }
  return {
    params: P,
    seed,
    capsules,
    lobes,
    protected: protectedVols,
    groundY: Number.isFinite(groundY) ? groundY : 0,
    bounds,
    // How far a primitive's influence can extend beyond its bounding radius.
    influence: blend + P.roughness * P.rockSize + P.layering * P.layerHeight + 0.5,
  }
}

function capsuleDist(x, y, z, c) {
  const pax = x - c.a[0]
  const pay = y - c.a[1]
  const paz = z - c.a[2]
  const ab = c.ab
  let h = (pax * ab[0] + pay * ab[1] + paz * ab[2]) / c.ab2
  h = h < 0 ? 0 : h > 1 ? 1 : h
  const dx = pax - ab[0] * h
  const dy = pay - ab[1] * h
  const dz = paz - ab[2] * h
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (c.ra + (c.rb - c.ra) * h)
}

function lobeDist(x, y, z, l) {
  // Inigo Quilez ellipsoid bound, in the lobe's local frame.
  const qx = x - l.c[0]
  const qy = y - l.c[1]
  const qz = z - l.c[2]
  const r = l.r
  const lx = (qx * l.u[0] + qy * l.u[1] + qz * l.u[2]) / r[0]
  const ly = (qx * l.v[0] + qy * l.v[1] + qz * l.v[2]) / r[1]
  const lz = (qx * l.w[0] + qy * l.w[1] + qz * l.w[2]) / r[2]
  const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz)
  const mx = lx / r[0]
  const my = ly / r[1]
  const mz = lz / r[2]
  const k1 = Math.sqrt(mx * mx + my * my + mz * mz)
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -l.rmin
}

/** Pointed-arch prism SDF (two-centred arch over a rectangle, extruded). */
export function archPrismDist(px, py, pz, v) {
  const qx = px - v.o[0]
  const qy = py - v.o[1]
  const qz = pz - v.o[2]
  const x = qx * v.x[0] + qy * v.x[1] + qz * v.x[2]
  const y = qx * v.y[0] + qy * v.y[1] + qz * v.y[2]
  const z = qx * v.z[0] + qy * v.z[1] + qz * v.z[2]
  const dA = Math.hypot(x - v.c, y - v.springY) - v.R
  const dB = Math.hypot(x + v.c, y - v.springY) - v.R
  const upper = Math.max(dA, dB, v.springY - y)
  const lower = Math.max(Math.abs(x) - v.a, y - v.springY, v.floorY - y)
  return Math.max(Math.min(upper, lower), Math.abs(z) - v.halfDepth)
}

function cellHash(ix, iy, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647) ^ seed
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function worleyF1(x, y, z, seed) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  let best = 9
  for (let dz = -1; dz <= 1; dz += 1)
    for (let dy = -1; dy <= 1; dy += 1)
      for (let dx = -1; dx <= 1; dx += 1) {
        const cx = ix + dx
        const cy = iy + dy
        const cz = iz + dz
        const fx = cx + cellHash(cx, cy, cz, seed) - x
        const fy = cy + cellHash(cx, cy, cz, seed + 17) - y
        const fz = cz + cellHash(cx, cy, cz, seed + 31) - z
        const d = fx * fx + fy * fy + fz * fz
        if (d < best) best = d
      }
  return Math.sqrt(best)
}

/**
 * Returns an evaluator restricted to the primitives that can influence the
 * axis-aligned box [min,max] (narrow-band culling). `null` = box is empty air.
 */
export function createLocalEvaluator(field, min, max, parent = null) {
  const cx = (min[0] + max[0]) / 2
  const cy = (min[1] + max[1]) / 2
  const cz = (min[2] + max[2]) / 2
  const half = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2
  const reach = half + field.influence
  const near = (c, br) => Math.hypot(c[0] - cx, c[1] - cy, c[2] - cz) < br + reach
  const src = parent ?? { caps: field.capsules, lobes: field.lobes, prot: field.protected }
  const caps = src.caps.filter((c) => near(c.c, c.br))
  const lobes = src.lobes.filter((l) => near(l.c, l.br))
  if (!caps.length && !lobes.length) return null
  const prot = src.prot.filter((v) => near(v.o, v.br))
  const P = field.params
  const k = P.cohesion
  const noise = createValueNoise3D((field.seed % 997) + 1)
  const noise2 = createValueNoise3D((field.seed % 991) + 7)
  const yMin = field.bounds.min[1]
  const yMax = field.bounds.max[1]
  const poreSeed = field.seed | 0

  function evaluate(x, y, z) {
    let d = 1e9
    for (let i = 0; i < caps.length; i += 1) d = smin(d, capsuleDist(x, y, z, caps[i]), k * 0.6)
    for (let i = 0; i < lobes.length; i += 1) d = smin(d, lobeDist(x, y, z, lobes[i]), k)
    if (d > field.influence + 2) return d // far outside: skip surface terms
    if (P.roughness > 0) {
      const f = 1.3 / P.rockSize
      d += (noise(x * f, y * f, z * f) - 0.5) * P.roughness * P.rockSize * 0.9
    }
    if (P.erosion > 0) {
      const f = 0.35 / P.rockSize
      const e = noise2(x * f, y * f, z * f) * 0.65 + noise2(x * f * 2.1, y * f * 2.1, z * f * 2.1) * 0.35
      d += Math.max(0, e - 0.45) * P.erosion * P.rockSize * 3
    }
    if (P.layering > 0) {
      const t = y / P.layerHeight
      d += (t - Math.floor(t)) * P.layering * P.layerHeight * 0.6
    }
    if (P.porosity > 0) {
      const grad = Math.min(1, Math.max(0, (y - yMin) / Math.max(1, yMax - yMin)))
      const amount = P.porosity * (0.25 + 0.75 * grad)
      const s = 1 / (P.rockSize * 0.9)
      const f1 = worleyF1(x * s, y * s, z * s, poreSeed)
      const pore = (amount * 0.55 - f1) / s
      d = Math.max(d, pore)
    }
    if (P.negativeSpace > 0 && prot.length) {
      let dp = 1e9
      for (let i = 0; i < prot.length; i += 1) dp = Math.min(dp, archPrismDist(x, y, z, prot[i]))
      const carved = -smin(-d, dp, 0.35)
      d = d + (carved - d) * P.negativeSpace
    }
    // Do not grow far below the curve's ground.
    d = Math.max(d, field.groundY - 1 - y)
    return d
  }
  evaluate.lists = { caps, lobes, prot }
  return evaluate
}
