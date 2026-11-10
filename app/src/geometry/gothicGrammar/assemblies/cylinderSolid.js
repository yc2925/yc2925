/**
 * Shared-vertex cylinder (vertical Y axis) for engaged pier shafts (Step 13E.2).
 */

import { createMeshData } from '../solids/meshValidation.js'

/**
 * Vertical cylinder centered at (cx, cy, cz), radius r, height sy, segments ≥ 6.
 */
export function buildCylinderMesh({
  cx = 0,
  cy = 0,
  cz = 0,
  radius = 0.08,
  height = 1,
  segments = 10,
  id = 'cylinder',
} = {}) {
  const n = Math.max(6, Math.min(24, Math.round(segments)))
  const hy = height * 0.5
  const r = Math.max(1e-4, radius)
  const positions = []
  // Bottom ring 0..n-1, top ring n..2n-1, bottom center 2n, top center 2n+1
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const x = cx + Math.cos(a) * r
    const z = cz + Math.sin(a) * r
    positions.push(x, cy - hy, z)
  }
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const x = cx + Math.cos(a) * r
    const z = cz + Math.sin(a) * r
    positions.push(x, cy + hy, z)
  }
  const botC = n * 2
  const topC = n * 2 + 1
  positions.push(cx, cy - hy, cz, cx, cy + hy, cz)

  const indices = []
  for (let i = 0; i < n; i += 1) {
    const i1 = (i + 1) % n
    const b0 = i
    const b1 = i1
    const t0 = n + i
    const t1 = n + i1
    // Side (outward)
    indices.push(b0, t0, t1, b0, t1, b1)
    // Bottom cap (outward -Y)
    indices.push(botC, b1, b0)
    // Top cap (outward +Y)
    indices.push(topC, t0, t1)
  }

  const volume = Math.PI * r * r * height
  const mesh = createMeshData(positions, indices, {
    id,
    kind: 'cylinder-solid',
    volume,
  })
  return {
    ok: true,
    mesh,
    volume,
    boundingMin: [cx - r, cy - hy, cz - r],
    boundingMax: [cx + r, cy + hy, cz + r],
    boundingSize: [r * 2, height, r * 2],
  }
}
