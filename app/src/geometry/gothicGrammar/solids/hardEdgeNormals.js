/**
 * Hard-edge normal assignment for Gothic stone meshes (Step 13D.1).
 *
 * Planar front/back faces must not share vertices with side walls —
 * otherwise computeVertexNormals averages +Z with outward XY normals
 * and produces the shattered triangular shading seen in the 13D screenshot.
 */

import { createMeshData } from './meshValidation.js'

/**
 * Expand an indexed mesh to a non-indexed hard-edge mesh with per-face normals.
 * Each triangle gets three unique vertices carrying the face normal.
 *
 * @param {{ positions: ArrayLike<number>, indices: ArrayLike<number>, meta?: object }} mesh
 * @returns {import('./meshValidation.js').MeshData & { normals: Float64Array }}
 */
export function toHardEdgeMesh(mesh) {
  const p = mesh.positions
  const idx = mesh.indices
  const positions = []
  const normals = []
  const indices = []

  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i] * 3
    const ib = idx[i + 1] * 3
    const ic = idx[i + 2] * 3
    const ax = p[ia]
    const ay = p[ia + 1]
    const az = p[ia + 2]
    const bx = p[ib]
    const by = p[ib + 1]
    const bz = p[ib + 2]
    const cx = p[ic]
    const cy = p[ic + 1]
    const cz = p[ic + 2]
    const abx = bx - ax
    const aby = by - ay
    const abz = bz - az
    const acx = cx - ax
    const acy = cy - ay
    const acz = cz - az
    let nx = aby * acz - abz * acy
    let ny = abz * acx - abx * acz
    let nz = abx * acy - aby * acx
    const len = Math.hypot(nx, ny, nz)
    if (len > 0) {
      nx /= len
      ny /= len
      nz /= len
    } else {
      nx = 0
      ny = 0
      nz = 1
    }
    const base = positions.length / 3
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz)
    normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz)
    indices.push(base, base + 1, base + 2)
  }

  const out = createMeshData(positions, indices, {
    ...(mesh.meta ?? {}),
    hardEdgeNormals: true,
  })
  out.normals = Float64Array.from(normals)
  return out
}

/**
 * Assign explicit normals for a structural extrusion that uses the
 * layout: [front verts][back verts] then side quads sharing those verts.
 * Prefer toHardEdgeMesh for display; this keeps topology for validation.
 *
 * Front → (0,0,+1), back → (0,0,−1), sides → face normal.
 */
export function assignExtrusionNormals(mesh, frontVertexCount) {
  const p = mesh.positions
  const idx = mesh.indices
  const nVert = Math.floor(p.length / 3)
  const normals = new Float64Array(nVert * 3)
  const counts = new Float64Array(nVert)

  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]
    const b = idx[i + 1]
    const c = idx[i + 2]
    const ax = p[a * 3]
    const ay = p[a * 3 + 1]
    const az = p[a * 3 + 2]
    const bx = p[b * 3]
    const by = p[b * 3 + 1]
    const bz = p[b * 3 + 2]
    const cx = p[c * 3]
    const cy = p[c * 3 + 1]
    const cz = p[c * 3 + 2]
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len
    ny /= len
    nz /= len
    for (const v of [a, b, c]) {
      normals[v * 3] += nx
      normals[v * 3 + 1] += ny
      normals[v * 3 + 2] += nz
      counts[v] += 1
    }
  }

  // Force planar front / back banks (authoritative for extrusion layout).
  for (let i = 0; i < frontVertexCount; i += 1) {
    normals[i * 3] = 0
    normals[i * 3 + 1] = 0
    normals[i * 3 + 2] = 1
    counts[i] = 1
  }
  for (let i = frontVertexCount; i < Math.min(frontVertexCount * 2, nVert); i += 1) {
    normals[i * 3] = 0
    normals[i * 3 + 1] = 0
    normals[i * 3 + 2] = -1
    counts[i] = 1
  }

  for (let i = 0; i < nVert; i += 1) {
    if (counts[i] <= 0) continue
    // Skip forced front/back
    if (i < frontVertexCount * 2) continue
    const o = i * 3
    const len = Math.hypot(normals[o], normals[o + 1], normals[o + 2]) || 1
    normals[o] /= len
    normals[o + 1] /= len
    normals[o + 2] /= len
  }

  return { ...mesh, normals, meta: { ...(mesh.meta ?? {}), normals: 'extrusion-forced-planar' } }
}

/**
 * Check triangles that lie entirely on plane z=zRef have normals ≈ (0,0,sign).
 * Side-wall verts can sit on the same z without being planar-face verts.
 */
export function planarFaceNormalReport(mesh, zRef, sign = 1, eps = 1e-9) {
  if (!mesh?.normals) {
    return { ok: false, checked: 0, errors: ['no normals on mesh'] }
  }
  const p = mesh.positions
  const n = mesh.normals
  const idx = mesh.indices
  let checked = 0
  let bad = 0
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]
    const b = idx[i + 1]
    const c = idx[i + 2]
    if (
      Math.abs(p[a * 3 + 2] - zRef) > eps ||
      Math.abs(p[b * 3 + 2] - zRef) > eps ||
      Math.abs(p[c * 3 + 2] - zRef) > eps
    ) {
      continue
    }
    checked += 1
    const nx = n[a * 3]
    const ny = n[a * 3 + 1]
    const nz = n[a * 3 + 2]
    if (Math.abs(nx) > 0.02 || Math.abs(ny) > 0.02 || nz * sign < 0.98) bad += 1
  }
  return {
    ok: bad === 0 && checked > 0,
    checked,
    bad,
    errors: bad ? [`${bad}/${checked} planar face tris have non-planar normals`] : [],
  }
}
