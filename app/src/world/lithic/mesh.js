/**
 * Lithic field → triangle mesh (Step 47, Phase C1).
 *
 * Wraps the existing voxel-lab Surface Nets mesher (src/voxel/meshing.js)
 * without modifying it: the field is sampled into padded density chunks in a
 * virtual cubic grid, chunk by chunk, and chunks whose neighbourhood holds no
 * skeleton primitive are skipped (narrow-band culling).
 *
 * Output vertices are welded and given area-weighted normals.
 */

import { meshSurfaceNets } from '../../voxel/meshing.js'
import { createLocalEvaluator } from './field.js'
import { LITHIC_QUALITY } from './params.js'

const CHUNK = 16
const SUB = 5 // samples per sub-block axis
const VIRTUAL_RES = 4096 // only defines the virtual cube used by gridToWorld

export function chooseCellSize(field, quality = 'preview') {
  const q = LITHIC_QUALITY[quality] ?? LITHIC_QUALITY.preview
  const { min, max } = field.bounds
  const volume = (max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2])
  // Coarsen if the box would exceed the cell budget.
  const minCell = Math.cbrt(volume / q.maxCells)
  return Math.max(q.cellSize, minCell)
}

export function meshLithicField(field, { quality = 'preview', cellSize, isCancelled } = {}) {
  const t0 = performance.now()
  const h = cellSize ?? chooseCellSize(field, quality)
  const { min, max } = field.bounds
  const dims = [0, 1, 2].map((i) => Math.max(1, Math.ceil((max[i] - min[i]) / h)))
  const chunkCounts = dims.map((d) => Math.ceil(d / CHUNK))
  const volume = { worldSize: h * VIRTUAL_RES, resolution: VIRTUAL_RES }
  const half = (VIRTUAL_RES - 1) / 2
  const offset = [min[0] + half * h, min[1] + half * h, min[2] + half * h]
  const mr = CHUNK + 3
  const parts = []
  let chunksMeshed = 0
  let chunksSkipped = 0
  let samples = 0

  for (let cz = 0; cz < chunkCounts[2]; cz += 1) {
    for (let cy = 0; cy < chunkCounts[1]; cy += 1) {
      for (let cx = 0; cx < chunkCounts[0]; cx += 1) {
        if (isCancelled?.()) return null
        const origin = [cx * CHUNK, cy * CHUNK, cz * CHUNK]
        const lo = origin.map((o, i) => min[i] + (o - 1) * h)
        const hi = origin.map((o, i) => min[i] + (o + CHUNK + 1) * h)
        const evaluate = createLocalEvaluator(field, lo, hi)
        if (!evaluate) {
          chunksSkipped += 1
          continue
        }
        const meshDensity = new Float32Array(mr * mr * mr)
        let inside = 0
        // Sub-block culling: each SUB³ block of samples gets its own short
        // primitive list; blocks with nothing in reach are air.
        for (let bz = 0; bz < mr; bz += SUB) {
          for (let by = 0; by < mr; by += SUB) {
            for (let bx = 0; bx < mr; bx += SUB) {
              const ex = Math.min(mr, bx + SUB)
              const ey = Math.min(mr, by + SUB)
              const ez = Math.min(mr, bz + SUB)
              const blo = [bx, by, bz].map((g, i) => min[i] + (origin[i] + g - 1) * h)
              const bhi = [ex, ey, ez].map((g, i) => min[i] + (origin[i] + g - 2) * h)
              const sub = createLocalEvaluator(field, blo, bhi, evaluate.lists)
              for (let z = bz; z < ez; z += 1) {
                const wz = min[2] + (origin[2] + z - 1) * h
                for (let y = by; y < ey; y += 1) {
                  const wy = min[1] + (origin[1] + y - 1) * h
                  for (let x = bx; x < ex; x += 1) {
                    const wx = min[0] + (origin[0] + x - 1) * h
                    const v = sub ? -sub(wx, wy, wz) : -2 * h // mesher convention: > 0 = solid
                    meshDensity[x + y * mr + z * mr * mr] = v
                    if (v > 0) inside += 1
                  }
                }
              }
            }
          }
        }
        samples += mr * mr * mr
        if (inside === 0 || inside === mr * mr * mr) {
          chunksSkipped += 1
          continue
        }
        const chunk = { origin, dimensions: [CHUNK, CHUNK, CHUNK], meshDensity, meshResolution: mr }
        const part = meshSurfaceNets(chunk, volume)
        if (part.indices.length) parts.push(part)
        chunksMeshed += 1
      }
    }
  }

  const welded = weld(parts, offset)
  return {
    ...welded,
    stats: {
      ms: performance.now() - t0,
      cellSize: h,
      triangles: welded.indices.length / 3,
      vertices: welded.positions.length / 3,
      chunksMeshed,
      chunksSkipped,
      samples,
    },
  }
}

function weld(parts, offset) {
  const map = new Map()
  const positions = []
  const indices = []
  for (const part of parts) {
    const local = new Array(part.positions.length / 3)
    for (let i = 0; i < local.length; i += 1) {
      const x = part.positions[i * 3]
      const y = part.positions[i * 3 + 1]
      const z = part.positions[i * 3 + 2]
      const key = `${x},${y},${z}`
      let id = map.get(key)
      if (id === undefined) {
        id = positions.length / 3
        positions.push(x + offset[0], y + offset[1], z + offset[2])
        map.set(key, id)
      }
      local[i] = id
    }
    for (let i = 0; i < part.indices.length; i += 3) {
      const a = local[part.indices[i]]
      const b = local[part.indices[i + 1]]
      const c = local[part.indices[i + 2]]
      if (a !== b && b !== c && a !== c) indices.push(a, b, c)
    }
  }
  const pos = new Float32Array(positions)
  const idx = new Uint32Array(indices)
  const normals = new Float32Array(pos.length)
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3
    const b = idx[i + 1] * 3
    const c = idx[i + 2] * 3
    const e1x = pos[b] - pos[a]
    const e1y = pos[b + 1] - pos[a + 1]
    const e1z = pos[b + 2] - pos[a + 2]
    const e2x = pos[c] - pos[a]
    const e2y = pos[c + 1] - pos[a + 1]
    const e2z = pos[c + 2] - pos[a + 2]
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    for (const v of [a, b, c]) {
      normals[v] += nx
      normals[v + 1] += ny
      normals[v + 2] += nz
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1
    normals[i] /= l
    normals[i + 1] /= l
    normals[i + 2] /= l
  }
  return { positions: pos, normals, indices: idx }
}
