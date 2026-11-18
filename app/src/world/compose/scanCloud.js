/**
 * World stage "scan" look (REF-031): the built world as a photogrammetry
 * point cloud with survey stations. Pure functions, no rendering.
 *
 *  - surfacePool: area-weighted random samples (position + normal) on a
 *    prototype stone mesh (unit box), cached per geometry.
 *  - buildStonePoints: every placed stone → points at a world density
 *    (pts / m²), daylight baked into the colour, desaturated toward scan grey,
 *    coverage thinning with height and noise holes, depth noise + floaters,
 *    red survey paint around station targets.
 *  - buildGroundPoints: jittered-grid samples of the terrain inside a ragged
 *    radial scan patch, earth tones from the palette, optional lichen near
 *    the structure bases.
 *  - surveyStations: golden-angle stations around the structures, each with
 *    a target stone, capture time / date and coordinates.
 */

import { PALETTE_HEX } from '../lithic/palette.js'

export const SCAN_RED = '#ff2a2a'

// ------------------------------------------------------------------ helpers

function rng(seed) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hexRgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const linHex = (h) => hexRgb(h).map(toLin)
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return h - Math.floor(h)
}
/** Smooth value noise in [0, 1]. */
export function vnoise(x, y, z) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  let fx = x - ix
  let fy = y - iy
  let fz = z - iz
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  fz = fz * fz * (3 - 2 * fz)
  const l = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz)
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy), l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz)
}
const fbm2 = (x, z) => 0.5 * vnoise(x, 0.5, z) + 0.3 * vnoise(x * 2.1, 3.1, z * 2.1) + 0.2 * vnoise(x * 4.3, 7.7, z * 4.3)

// ------------------------------------------------------------------ surface pool

const POOL = 2000
const pools = new WeakMap()

/** Area-weighted surface samples of a mesh: { pos, nrm, area, count }. */
export function surfacePool(geometry, count = POOL, seed = 11) {
  const cached = pools.get(geometry)
  if (cached && cached.count === count) return cached
  const P = geometry.attributes.position
  const N = geometry.attributes.normal
  const I = geometry.index
  const tri = I ? I.count / 3 : P.count / 3
  const vi = (t, k) => (I ? I.getX(t * 3 + k) : t * 3 + k)
  const cum = new Float64Array(tri)
  let total = 0
  for (let t = 0; t < tri; t += 1) {
    const a = vi(t, 0)
    const b = vi(t, 1)
    const c = vi(t, 2)
    const ux = P.getX(b) - P.getX(a)
    const uy = P.getY(b) - P.getY(a)
    const uz = P.getZ(b) - P.getZ(a)
    const wx = P.getX(c) - P.getX(a)
    const wy = P.getY(c) - P.getY(a)
    const wz = P.getZ(c) - P.getZ(a)
    total += 0.5 * Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx)
    cum[t] = total
  }
  const rand = rng(seed)
  const pos = new Float32Array(count * 3)
  const nrm = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const r = rand() * total
    let lo = 0
    let hi = tri - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cum[mid] < r) lo = mid + 1
      else hi = mid
    }
    const su = Math.sqrt(rand())
    const v = rand()
    const w = [1 - su, su * (1 - v), su * v]
    let px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0
    for (let k = 0; k < 3; k += 1) {
      const j = vi(lo, k)
      px += P.getX(j) * w[k]
      py += P.getY(j) * w[k]
      pz += P.getZ(j) * w[k]
      if (N) {
        nx += N.getX(j) * w[k]
        ny += N.getY(j) * w[k]
        nz += N.getZ(j) * w[k]
      }
    }
    const nl = Math.hypot(nx, ny, nz) || 1
    pos.set([px, py, pz], i * 3)
    nrm.set([nx / nl, ny / nl, nz / nl], i * 3)
  }
  const pool = { pos, nrm, area: total, count }
  pools.set(geometry, pool)
  return pool
}

// ------------------------------------------------------------------ stones → points

const SUN = (() => {
  const v = [90, 160, 70]
  const l = Math.hypot(...v)
  return v.map((c) => c / l)
})()
const RED = linHex(SCAN_RED)
/** Point budget per structure (the viewport also caps the whole world). */
export const MAX_STONE_POINTS = 600000
export const WORLD_STONE_POINTS = 1500000
export const MAX_GROUND_POINTS = 300000

/** Total surface area (m²) of a list of placed stones. */
export function stoneSurfaceArea(stones, prototypes) {
  const pools = prototypes.map((g) => surfacePool(g))
  let a = 0
  for (const st of stones) {
    const [sx, sy, sz] = st.s
    a += pools[st.proto % pools.length].area * ((sx * sy + sy * sz + sz * sx) / 3)
  }
  return a
}

/**
 * @param stones lithic stones ({ p, q, s, color, proto, piece })
 * @param prototypes BufferGeometry list (stone.proto % length)
 * @param offsets Map piece → {x,y,z} (explode)
 * @param o { density, fidelity, noise, coverage, yTop, markers: [{c:[x,y,z], r, k}], seed }
 * Allocation-free inner loop; output written straight into typed arrays.
 */
export function buildStonePoints(stones, prototypes, offsets, o) {
  const pools = prototypes.map((g) => surfacePool(g))
  const rand = rng(0x5ca9 + (o.seed ?? 0))
  const area = stoneSurfaceArea(stones, prototypes)
  const density = Math.min(o.density, MAX_STONE_POINTS / Math.max(1, area))
  // Pass 1: points per stone.
  const counts = new Int32Array(stones.length)
  let total = 0
  for (let si = 0; si < stones.length; si += 1) {
    const st = stones[si]
    const pool = pools[st.proto % pools.length]
    const [sx, sy, sz] = st.s
    const want = density * pool.area * ((sx * sy + sy * sz + sz * sx) / 3)
    const n = Math.min(pool.count, Math.floor(want) + (rand() < want % 1 ? 1 : 0))
    counts[si] = n
    total += n
  }
  const P = new Float32Array(total * 3)
  const C = new Float32Array(total * 3)
  let w = 0
  const yTop = Math.max(1, o.yTop ?? 30)
  const markers = o.markers ?? []
  const cov = o.coverage
  const noise = o.noise
  for (let si = 0; si < stones.length; si += 1) {
    const n = counts[si]
    if (!n) continue
    const st = stones[si]
    const pool = pools[st.proto % pools.length]
    const [sx, sy, sz] = st.s
    const off = offsets?.get(st.piece)
    const tx = st.p[0] + (off?.x ?? 0)
    const ty = st.p[1] + (off?.y ?? 0)
    const tz = st.p[2] + (off?.z ?? 0)
    const [qx, qy, qz, qw] = st.q
    // Rotation matrix from the quaternion.
    const m00 = 1 - 2 * (qy * qy + qz * qz), m01 = 2 * (qx * qy - qz * qw), m02 = 2 * (qx * qz + qy * qw)
    const m10 = 2 * (qx * qy + qz * qw), m11 = 1 - 2 * (qx * qx + qz * qz), m12 = 2 * (qy * qz - qx * qw)
    const m20 = 2 * (qx * qz - qy * qw), m21 = 2 * (qy * qz + qx * qw), m22 = 1 - 2 * (qx * qx + qy * qy)
    // Markers that can reach this stone.
    const reach = Math.hypot(sx, sy, sz)
    const near = markers.filter((m) => Math.hypot(tx - m.c[0], ty - m.c[1], tz - m.c[2]) < m.r * 1.4 + reach)
    const b0 = toLin(st.color[0]), b1 = toLin(st.color[1]), b2 = toLin(st.color[2])
    const grey = 0.5 * (0.2126 * b0 + 0.7152 * b1 + 0.0722 * b2) + 0.24
    const t0 = grey + (b0 - grey) * o.fidelity, t1 = grey + (b1 - grey) * o.fidelity, t2 = grey + (b2 - grey) * o.fidelity
    const start = Math.floor(rand() * pool.count)
    const pp = pool.pos
    const pn = pool.nrm
    for (let k = 0; k < n; k += 1) {
      const i = ((start + k) % pool.count) * 3
      const lx = pp[i] * sx, ly = pp[i + 1] * sy, lz = pp[i + 2] * sz
      let x = m00 * lx + m01 * ly + m02 * lz + tx
      let y = m10 * lx + m11 * ly + m12 * lz + ty
      let z = m20 * lx + m21 * ly + m22 * lz + tz
      // Coverage: photogrammetry thins toward the top and leaves noise holes.
      if (rand() < cov * smooth(0.25, 1.05, y / yTop) * 0.9) continue
      if (cov > 0 && vnoise(x * 0.45, y * 0.45, z * 0.45) < cov * 0.32) continue
      const ax = pn[i] / sx, ay = pn[i + 1] / sy, az = pn[i + 2] / sz
      let nx = m00 * ax + m01 * ay + m02 * az
      let ny = m10 * ax + m11 * ay + m12 * az
      let nz = m20 * ax + m21 * ay + m22 * az
      const nl = Math.hypot(nx, ny, nz) || 1
      nx /= nl
      ny /= nl
      nz /= nl
      // Depth noise along the normal, plus stray floaters (scanner halo).
      let d = (rand() - 0.5) * 0.05 * noise
      let dim = 1
      if (rand() < noise * 0.08) {
        d += -Math.log(rand() + 1e-6) * (0.12 + 0.5 * noise)
        dim = 0.55
      }
      x += nx * d
      y += ny * d
      z += nz * d
      // Baked daylight + grain.
      const lam = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2])
      const grain = 0.78 + 0.44 * hash3(Math.floor(x * 3.1), Math.floor(y * 3.1), Math.floor(z * 3.1)) * 0.5 + 0.22 * rand()
      const shade = 1.25 * (0.2 + 0.62 * lam + 0.2 * (0.5 + 0.5 * ny)) * grain * dim * (y < 1.5 ? 0.8 : 1)
      let r = t0 * shade
      let g = t1 * shade
      let b = t2 * shade
      for (const m of near) {
        const dm = Math.hypot(x - m.c[0], y - m.c[1], z - m.c[2])
        if (dm > m.r * 1.35) continue
        const edge = m.r * (0.65 + 0.7 * vnoise(x * 1.9 + m.c[0], y * 1.9, z * 1.9))
        if (dm < edge && rand() < 0.45 + 0.5 * m.k) {
          const t = smooth(edge, edge * 0.45, dm) * (0.55 + 0.45 * m.k)
          r += (RED[0] * 0.75 - r) * t
          g += (RED[1] * 0.75 - g) * t
          b += (RED[2] * 0.75 - b) * t
        }
      }
      P[w] = x
      P[w + 1] = y
      P[w + 2] = z
      C[w] = r
      C[w + 1] = g
      C[w + 2] = b
      w += 3
    }
  }
  return { position: P.subarray(0, w), color: C.subarray(0, w), count: w / 3 }
}

// ------------------------------------------------------------------ ground

const EARTH = ['#363331', '#525050', '#5b513f', '#7a7772'].map((h) => {
  if (!PALETTE_HEX.includes(h)) throw new Error(`earth tone ${h} not in palette`)
  return linHex(h)
})
const LICHEN = ['#4f5b2c', '#7c8f3a', '#c2d270'].map(linHex)
const MAX_GROUND_CELLS = 900000

/** Proximity to structure bases (0 … 1) from low stones: a blurred 2 m count field, O(1) lookup. */
export function baseProximity(stoneLists) {
  const cell = 2
  const low = []
  for (const list of stoneLists) for (const st of list) if (st.p[1] <= 4) low.push(st.p)
  if (!low.length) return () => 0
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
  for (const p of low) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2])
  }
  const pad = 4
  const ox = Math.floor(x0 / cell) - pad
  const oz = Math.floor(z0 / cell) - pad
  const nx = Math.floor(x1 / cell) - ox + pad + 1
  const nz = Math.floor(z1 / cell) - oz + pad + 1
  const count = new Float32Array(nx * nz)
  for (const p of low) count[(Math.floor(p[0] / cell) - ox) * nz + (Math.floor(p[2] / cell) - oz)] += 1
  const field = new Float32Array(nx * nz)
  for (let i = 0; i < nx; i += 1)
    for (let j = 0; j < nz; j += 1) {
      let sum = 0
      for (let a = -3; a <= 3; a += 1)
        for (let b = -3; b <= 3; b += 1) {
          const ii = i + a, jj = j + b
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue
          const c = count[ii * nz + jj]
          if (c) sum += Math.min(4, c) / (1 + a * a + b * b)
        }
      field[i * nz + j] = Math.min(1, sum / 6)
    }
  return (x, z) => {
    const i = Math.floor(x / cell) - ox
    const j = Math.floor(z / cell) - oz
    return i < 0 || j < 0 || i >= nx || j >= nz ? 0 : field[i * nz + j]
  }
}

/**
 * @param o { height(x,z), centre:{x,z}, radius, density, lichen, fidelity, noise, near(x,z), seed }
 */
export function buildGroundPoints(o) {
  const rand = rng(0x9e37 + (o.seed ?? 0))
  const R = o.radius
  const Rout = R * 1.8
  // Point budget: the dense core is ~π(0.7R)², plus a 5 % dust tail.
  const area = Math.PI * (0.7 * R) ** 2 + 0.05 * Math.PI * (Rout * Rout - R * R)
  const density = Math.min(o.density, MAX_GROUND_POINTS / area)
  const cell = Math.max(1 / Math.sqrt(density), (2 * Rout) / Math.sqrt(MAX_GROUND_CELLS))
  const steps = Math.ceil((2 * Rout) / cell)
  const P = new Float32Array(steps * steps * 3)
  const C = new Float32Array(steps * steps * 3)
  let w = 0
  const f = 0.4 + 0.6 * o.fidelity
  for (let i = 0; i < steps; i += 1)
    for (let j = 0; j < steps; j += 1) {
      const x = o.centre.x - Rout + (i + rand()) * cell
      const z = o.centre.z - Rout + (j + rand()) * cell
      // Ragged patch edge: the scan radius wobbles with 2D noise.
      const r = Math.hypot(x - o.centre.x, z - o.centre.z) / (0.8 + 0.4 * fbm2(x * 0.025, z * 0.025))
      const keep = Math.max(1 - smooth(R * 0.4, R, r), 0.05 * (1 - smooth(R, Rout, r)))
      if (rand() >= keep) continue
      const near = o.near ? o.near(x, z) : 0
      const h0 = o.height(x, z)
      const y = h0 + (rand() - 0.5) * 0.06 + (rand() < o.noise * 0.03 ? -Math.log(rand() + 1e-6) * 0.6 * o.noise : 0)
      // Continuous blend between neighbouring palette earth tones.
      const e = Math.min(0.999, Math.max(0, fbm2(x * 0.07, z * 0.07) * 1.6 - 0.35)) * (EARTH.length - 1)
      const e0 = Math.floor(e)
      const A = EARTH[e0]
      const B = EARTH[Math.min(EARTH.length - 1, e0 + 1)]
      const t = e - e0
      let c0 = A[0] + (B[0] - A[0]) * t
      let c1 = A[1] + (B[1] - A[1]) * t
      let c2 = A[2] + (B[2] - A[2]) * t
      const lum = 0.2126 * c0 + 0.7152 * c1 + 0.0722 * c2
      // Baked daylight on the slope (forward differences).
      const hx = (o.height(x + 0.8, z) - h0) * 2
      const hz = (o.height(x, z + 0.8) - h0) * 2
      const lam = Math.max(0, (-hx * SUN[0] + 1.6 * SUN[1] - hz * SUN[2]) / Math.hypot(hx, 1.6, hz))
      const sp = rand()
      const light = (0.4 + 0.6 * lam) * (0.75 + 0.7 * keep + 0.6 * near) * (0.35 + 0.9 * sp * sp + (sp > 0.97 ? 1.2 : 0))
      c0 = (lum + (c0 - lum) * f) * light
      c1 = (lum + (c1 - lum) * f) * light
      c2 = (lum + (c2 - lum) * f) * light
      // Lichen patches (opt-in): noise patches that gather at structure bases.
      if (o.lichen > 0) {
        const m = smooth(1 - o.lichen * 0.85, 1.12 - o.lichen * 0.85, fbm2(x * 0.09 + 31, z * 0.09) * 0.75 + near * 0.55)
        if (m > 0 && rand() < m) {
          const L = LICHEN[Math.min(2, Math.floor(rand() * 2 + near * 1.3))]
          const k = (0.75 + 0.6 * rand()) * (0.7 + 0.5 * keep)
          c0 = L[0] * k
          c1 = L[1] * k
          c2 = L[2] * k
        }
      }
      P[w] = x
      P[w + 1] = y
      P[w + 2] = z
      C[w] = c0
      C[w + 1] = c1
      C[w + 2] = c2
      w += 3
    }
  return { position: P.slice(0, w), color: C.slice(0, w), count: w / 3 }
}

// ------------------------------------------------------------------ survey stations

const pad = (n) => String(n).padStart(2, '0')

/** Signature of the inputs to surveyStations, so stations only move when they must. */
export function stationKey(bounds, count, seed, stoneCount) {
  if (!bounds) return 'none'
  const r = (v) => v.toFixed(1)
  return [r(bounds.min.x), r(bounds.min.y), r(bounds.min.z), r(bounds.max.x), r(bounds.max.y), r(bounds.max.z), count, seed, stoneCount].join('|')
}

/**
 * Survey stations around the structures (golden-angle azimuths, varied
 * heights). Each aims at the stone nearest a point 30 % of the way from the
 * centre toward it; the camera stands 42 % of the way from that stone back
 * toward the station ring. Everything reported is measured from the world:
 * camera position, target stone (kind, curve, palette colour, position) and range.
 * @param o { bounds:{min,max}, stones: [{ p, kind, paletteIndex, curve }], count, seed }
 */
export function surveyStations(o) {
  const { bounds, count } = o
  if (!bounds || !count) return []
  const rand = rng(0x51a7 + (o.seed ?? 0) * 7919)
  const cx = (bounds.min.x + bounds.max.x) / 2
  const cz = (bounds.min.z + bounds.max.z) / 2
  const H = Math.max(4, bounds.max.y - bounds.min.y)
  const R = Math.max(8, Math.hypot(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2)
  const stones = o.stones ?? []
  const stride = Math.max(1, Math.floor(stones.length / 4000))
  const az0 = rand() * Math.PI * 2
  const out = []
  for (let i = 0; i < count; i += 1) {
    const az = az0 + i * 2.399963
    const hy = bounds.min.y + H * (0.08 + 0.85 * ((i * 0.618034 + rand() * 0.35) % 1))
    const dist = R * (1.05 + 0.55 * rand())
    const ring = [cx + Math.cos(az) * dist, hy, cz + Math.sin(az) * dist]
    const aim = [cx + Math.cos(az) * R * 0.3, hy, cz + Math.sin(az) * R * 0.3]
    let hit = null
    let best = Infinity
    for (let k = 0; k < stones.length; k += stride) {
      const p = stones[k].p
      const d = (p[0] - aim[0]) ** 2 + (p[1] - aim[1]) ** 2 + (p[2] - aim[2]) ** 2
      if (d < best) {
        best = d
        hit = stones[k]
      }
    }
    if (!hit) continue
    const target = [hit.p[0], hit.p[1], hit.p[2]]
    const pos = ring.map((v, k) => target[k] + (v - target[k]) * 0.42)
    pos[1] = Math.max(1.5, pos[1])
    out.push({
      id: out.length + 1,
      code: `S-${pad(out.length + 1)}`,
      pos,
      target,
      kind: hit.kind ?? 'stone',
      curve: hit.curve ?? '',
      color: hit.paletteIndex != null ? PALETTE_HEX[hit.paletteIndex] : '',
      range: Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]),
    })
  }
  return out
}
