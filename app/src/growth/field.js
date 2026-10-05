import * as THREE from 'three'
import { fbm3 } from '../shaders/noise3.js'

/**
 * 03 Vector field. Four forces, combined per particle:
 *   upward force       · vegetal tropism, world +Y
 *   surface follow     · pull onto a thin shell above the stone, and flatten motion along it
 *   feature attraction · run along / towards arches, ribs, columns, ledges
 *   curl noise         · divergence-free swirl from a noise potential
 *
 * Geometry-dependent data (nearest surface, nearest feature) is precomputed
 * once on a coarse grid; curl is recomputed only when Field Scale changes.
 * Runtime sampling is trilinear and allocation-free.
 */

const CELL = 0.12
const BOUNDS = { minX: -2.95, maxX: 2.95, minY: -0.05, maxY: 7.35, minZ: -1.15, maxZ: 0.95 }
const SHELL = 0.05
const FEATURE_REACH = 0.4
const FAR = 9

// Per-cell layout of the static array.
const S_TARGET = 0 // 3: vector to the shell point (surface + normal · SHELL)
const S_NORMAL = 3 // 3: surface normal
const S_DIST = 6 // 1: distance to the surface (FAR when out of reach)
const S_TANGENT = 7 // 3: feature direction · proximity weight
const S_ONTO = 10 // 3: unit vector towards the feature · proximity weight
const STRIDE = 13

export function createFieldCache(facade, surface, segments) {
  const nx = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / CELL) + 1
  const ny = Math.ceil((BOUNDS.maxY - BOUNDS.minY) / CELL) + 1
  const nz = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / CELL) + 1
  const data = new Float32Array(nx * ny * nz * STRIDE)
  const p = new THREE.Vector3()
  const probe = new THREE.Vector3()

  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const o = ((k * ny + j) * nx + i) * STRIDE
        p.x = BOUNDS.minX + i * CELL
        p.y = BOUNDS.minY + j * CELL
        p.z = BOUNDS.minZ + k * CELL

        const hit = surface.project(p)
        if (hit && hit.distance < 0.7) {
          data[o + S_TARGET] = hit.point.x + hit.normal.x * SHELL - p.x
          data[o + S_TARGET + 1] = hit.point.y + hit.normal.y * SHELL - p.y
          data[o + S_TARGET + 2] = hit.point.z + hit.normal.z * SHELL - p.z
          data[o + S_NORMAL] = hit.normal.x
          data[o + S_NORMAL + 1] = hit.normal.y
          data[o + S_NORMAL + 2] = hit.normal.z
          data[o + S_DIST] = hit.distance
        } else {
          data[o + S_DIST] = FAR
        }

        let best = Infinity
        let bestSeg = null
        let bestT = 0
        for (const seg of segments) {
          const ax = p.x - seg.a.x
          const ay = p.y - seg.a.y
          const az = p.z - seg.a.z
          const t = Math.min(seg.length, Math.max(0, ax * seg.dir.x + ay * seg.dir.y + az * seg.dir.z))
          const dx = ax - seg.dir.x * t
          const dy = ay - seg.dir.y * t
          const dz = az - seg.dir.z * t
          const d = dx * dx + dy * dy + dz * dz
          if (d < best) {
            best = d
            bestSeg = seg
            bestT = t
          }
        }
        const d = Math.sqrt(best)
        const w = Math.exp(-((d / FEATURE_REACH) ** 2))
        probe.x = bestSeg.a.x + bestSeg.dir.x * bestT - p.x
        probe.y = bestSeg.a.y + bestSeg.dir.y * bestT - p.y
        probe.z = bestSeg.a.z + bestSeg.dir.z * bestT - p.z
        const onto = Math.min(1, d / 0.12) / Math.max(d, 1e-6)
        data[o + S_TANGENT] = bestSeg.dir.x * w
        data[o + S_TANGENT + 1] = bestSeg.dir.y * w
        data[o + S_TANGENT + 2] = bestSeg.dir.z * w
        data[o + S_ONTO] = probe.x * onto * w
        data[o + S_ONTO + 1] = probe.y * onto * w
        data[o + S_ONTO + 2] = probe.z * onto * w
      }
    }
  }

  return { nx, ny, nz, data, curl: new Float32Array(nx * ny * nz * 3), curlKey: null, maxY: facade.bounds.maxY }
}

/** Curl of a 3-component noise potential, by central differences on the grid. RMS-normalised. */
export function updateCurl(cache, scale, seed) {
  const key = `${scale}:${seed}`
  if (cache.curlKey === key) return cache
  const { nx, ny, nz } = cache
  const count = nx * ny * nz
  const psi = new Float32Array(count * 3)
  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = (k * ny + j) * nx + i
        const x = (BOUNDS.minX + i * CELL) * scale
        const y = (BOUNDS.minY + j * CELL) * scale
        const z = (BOUNDS.minZ + k * CELL) * scale
        psi[c * 3] = fbm3(x + seed * 1.31, y, z, 2)
        psi[c * 3 + 1] = fbm3(x + 17.3, y + seed * 0.77, z - 4.1, 2)
        psi[c * 3 + 2] = fbm3(x - 9.2, y + 23.9, z + seed * 0.59, 2)
      }
    }
  }
  const curl = cache.curl
  let sum = 0
  const at = (i, j, k, comp) =>
    psi[(((Math.min(nz - 1, Math.max(0, k)) * ny + Math.min(ny - 1, Math.max(0, j))) * nx +
      Math.min(nx - 1, Math.max(0, i))) * 3) + comp]
  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = ((k * ny + j) * nx + i) * 3
        const dPzdy = at(i, j + 1, k, 2) - at(i, j - 1, k, 2)
        const dPydz = at(i, j, k + 1, 1) - at(i, j, k - 1, 1)
        const dPxdz = at(i, j, k + 1, 0) - at(i, j, k - 1, 0)
        const dPzdx = at(i + 1, j, k, 2) - at(i - 1, j, k, 2)
        const dPydx = at(i + 1, j, k, 1) - at(i - 1, j, k, 1)
        const dPxdy = at(i, j + 1, k, 0) - at(i, j - 1, k, 0)
        curl[c] = dPzdy - dPydz
        curl[c + 1] = dPxdz - dPzdx
        curl[c + 2] = dPydx - dPxdy
        sum += curl[c] ** 2 + curl[c + 1] ** 2 + curl[c + 2] ** 2
      }
    }
  }
  const rms = Math.sqrt(sum / count) || 1
  for (let c = 0; c < curl.length; c += 1) curl[c] /= rms
  cache.curlKey = key
  return cache
}

/**
 * Field force at (x, y, z). vx/vy/vz orient the feature direction (a line has no
 * preferred sense, so it follows the particle's current motion, or up).
 * Writes the force into out[0..2] and the surface distance into out[3].
 * Returns false outside the grid.
 */
export function fieldForce(cache, x, y, z, vx, vy, vz, forces, out) {
  const { nx, ny, nz, data, curl } = cache
  const fx = (x - BOUNDS.minX) / CELL
  const fy = (y - BOUNDS.minY) / CELL
  const fz = (z - BOUNDS.minZ) / CELL
  if (fx < 0 || fy < 0 || fz < 0 || fx >= nx - 1 || fy >= ny - 1 || fz >= nz - 1) return false
  const i0 = Math.floor(fx)
  const j0 = Math.floor(fy)
  const k0 = Math.floor(fz)
  const tx = fx - i0
  const ty = fy - j0
  const tz = fz - k0

  let gx = 0
  let gy = 0
  let gz = 0
  let nnx = 0
  let nny = 0
  let nnz = 0
  let dist = 0
  let ftx = 0
  let fty = 0
  let ftz = 0
  let fox = 0
  let foy = 0
  let foz = 0
  let cx = 0
  let cy = 0
  let cz = 0

  for (let c = 0; c < 8; c += 1) {
    const di = c & 1
    const dj = (c >> 1) & 1
    const dk = (c >> 2) & 1
    const w = (di ? tx : 1 - tx) * (dj ? ty : 1 - ty) * (dk ? tz : 1 - tz)
    if (w === 0) continue
    const cell = ((k0 + dk) * ny + (j0 + dj)) * nx + (i0 + di)
    const o = cell * STRIDE
    gx += data[o] * w
    gy += data[o + 1] * w
    gz += data[o + 2] * w
    nnx += data[o + 3] * w
    nny += data[o + 4] * w
    nnz += data[o + 5] * w
    dist += data[o + 6] * w
    const tdx = data[o + 7]
    const tdy = data[o + 8]
    const tdz = data[o + 9]
    const sense = tdx * vx + tdy * vy + tdz * vz < 0 ? -w : w
    ftx += tdx * sense
    fty += tdy * sense
    ftz += tdz * sense
    fox += data[o + 10] * w
    foy += data[o + 11] * w
    foz += data[o + 12] * w
    const co = cell * 3
    cx += curl[co] * w
    cy += curl[co + 1] * w
    cz += curl[co + 2] * w
  }

  let ox = ftx * 0.8 * forces.feature + fox * 0.6 * forces.feature + cx * 0.35 * forces.curl
  let oy = forces.up + fty * 0.8 * forces.feature + foy * 0.6 * forces.feature + cy * 0.35 * forces.curl
  let oz = ftz * 0.8 * forces.feature + foz * 0.6 * forces.feature + cz * 0.35 * forces.curl

  const sf = forces.surface
  if (sf > 0 && dist < FAR * 0.5) {
    const nl = Math.hypot(nnx, nny, nnz) || 1
    nnx /= nl
    nny /= nl
    nnz /= nl
    const along = (ox * nnx + oy * nny + oz * nnz) * Math.min(1, sf)
    ox += gx * sf * 5 - nnx * along
    oy += gy * sf * 5 - nny * along
    oz += gz * sf * 5 - nnz * along
  }

  out[0] = ox
  out[1] = oy
  out[2] = oz
  out[3] = dist
  return true
}

/** Sparse lattice of short segments near the surface, dark tail → light head. */
export function fieldArrows(cache, forces) {
  const positions = []
  const colors = []
  const out = new Float32Array(4)
  const length = 0.16
  for (let z = -0.85; z <= 0.7; z += 0.3) {
    for (let y = 0.35; y <= 7.1; y += 0.36) {
      for (let x = -2.7; x <= 2.7; x += 0.36) {
        if (!fieldForce(cache, x, y, z, 0, 1, 0, forces, out)) continue
        if (out[3] > 0.18 || out[3] < 0.015) continue
        const l = Math.hypot(out[0], out[1], out[2])
        if (l < 1e-4) continue
        const dx = (out[0] / l) * length * 0.5
        const dy = (out[1] / l) * length * 0.5
        const dz = (out[2] / l) * length * 0.5
        positions.push(x - dx, y - dy, z - dz, x + dx, y + dy, z + dz)
        colors.push(0.16, 0.16, 0.16, 0.78, 0.78, 0.76)
      }
    }
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors) }
}
