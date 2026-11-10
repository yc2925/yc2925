/**
 * Mesh validation for Gothic Grammar solids (Step 13D).
 * Operates on plain { positions, indices } — no Three.js required.
 */

/**
 * @typedef {{ positions: Float64Array|number[], indices: Uint32Array|number[], groups?: object }} MeshData
 */

export function createMeshData(positions, indices, meta = {}) {
  return {
    positions: positions instanceof Float64Array ? positions : Float64Array.from(positions),
    indices: indices instanceof Uint32Array ? indices : Uint32Array.from(indices),
    meta: { ...meta },
  }
}

/**
 * Weld geometrically coincident vertices and drop degenerate / duplicate faces.
 * Fixes Earcut non-manifold artifacts when distinct ring indices share XY.
 */
export function weldMesh(mesh, tol = 1e-9) {
  const p = mesh.positions
  const idx = mesh.indices
  const keyOf = (i) => {
    const o = i * 3
    const qx = Math.round(p[o] / tol)
    const qy = Math.round(p[o + 1] / tol)
    const qz = Math.round(p[o + 2] / tol)
    return `${qx}|${qy}|${qz}`
  }
  const map = new Map()
  const newPos = []
  const remap = new Int32Array(p.length / 3)
  for (let i = 0; i < remap.length; i += 1) {
    const k = keyOf(i)
    if (map.has(k)) {
      remap[i] = map.get(k)
    } else {
      const ni = newPos.length / 3
      map.set(k, ni)
      remap[i] = ni
      newPos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2])
    }
  }
  const newIdx = []
  const faceSeen = new Set()
  for (let i = 0; i < idx.length; i += 3) {
    let a = remap[idx[i]]
    let b = remap[idx[i + 1]]
    let c = remap[idx[i + 2]]
    if (a === b || b === c || c === a) continue
    // Canonical face key (orientation-sensitive for opposite windings)
    const fk = `${a}|${b}|${c}`
    if (faceSeen.has(fk)) continue
    faceSeen.add(fk)
    // Skip zero-area
    const ax = newPos[a * 3]
    const ay = newPos[a * 3 + 1]
    const az = newPos[a * 3 + 2]
    const bx = newPos[b * 3]
    const by = newPos[b * 3 + 1]
    const bz = newPos[b * 3 + 2]
    const cx = newPos[c * 3]
    const cy = newPos[c * 3 + 1]
    const cz = newPos[c * 3 + 2]
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    if (nx * nx + ny * ny + nz * nz <= 1e-24) continue
    newIdx.push(a, b, c)
  }
  return createMeshData(newPos, newIdx, { ...mesh.meta, welded: true })
}

export function vertexCount(mesh) {
  return Math.floor((mesh.positions?.length ?? 0) / 3)
}

export function triangleCount(mesh) {
  return Math.floor((mesh.indices?.length ?? 0) / 3)
}

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Count boundary edges (appear once) and non-manifold edges (appear >2).
 */
export function analyzeEdges(mesh) {
  const idx = mesh.indices
  const counts = new Map()
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]
    const b = idx[i + 1]
    const c = idx[i + 2]
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const k = edgeKey(u, v)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  let boundary = 0
  let nonManifold = 0
  let manifold = 0
  for (const n of counts.values()) {
    if (n === 1) boundary += 1
    else if (n === 2) manifold += 1
    else nonManifold += 1
  }
  return {
    edgeCount: counts.size,
    boundaryEdgeCount: boundary,
    nonManifoldEdgeCount: nonManifold,
    manifoldEdgeCount: manifold,
    watertight: boundary === 0 && nonManifold === 0,
  }
}

/**
 * Degenerate / invalid faces and finite vertex check.
 */
export function analyzeFaces(mesh, areaEps = 1e-14) {
  const p = mesh.positions
  const idx = mesh.indices
  let degenerate = 0
  let invalid = 0
  for (let i = 0; i < p.length; i += 1) {
    if (!Number.isFinite(p[i])) invalid += 1
  }
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3
    const b = idx[i + 1] * 3
    const c = idx[i + 2] * 3
    const ax = p[a]
    const ay = p[a + 1]
    const az = p[a + 2]
    const bx = p[b]
    const by = p[b + 1]
    const bz = p[b + 2]
    const cx = p[c]
    const cy = p[c + 1]
    const cz = p[c + 2]
    if (![ax, ay, az, bx, by, bz, cx, cy, cz].every(Number.isFinite)) {
      invalid += 1
      continue
    }
    const abx = bx - ax
    const aby = by - ay
    const abz = bz - az
    const acx = cx - ax
    const acy = cy - ay
    const acz = cz - az
    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx
    const area2 = nx * nx + ny * ny + nz * nz
    if (area2 <= areaEps) degenerate += 1
  }
  return { degenerateFaceCount: degenerate, invalidFaceCount: invalid, finite: invalid === 0 }
}

/**
 * Signed volume via divergence theorem (closed mesh). Absolute volume = |signed|.
 */
export function signedVolume(mesh) {
  const p = mesh.positions
  const idx = mesh.indices
  let vol = 0
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3
    const b = idx[i + 1] * 3
    const c = idx[i + 2] * 3
    const ax = p[a]
    const ay = p[a + 1]
    const az = p[a + 2]
    const bx = p[b]
    const by = p[b + 1]
    const bz = p[b + 2]
    const cx = p[c]
    const cy = p[c + 1]
    const cz = p[c + 2]
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
  }
  return vol / 6
}

/**
 * Surface area (sum of triangle areas).
 */
export function surfaceArea(mesh) {
  const p = mesh.positions
  const idx = mesh.indices
  let area = 0
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3
    const b = idx[i + 1] * 3
    const c = idx[i + 2] * 3
    const abx = p[b] - p[a]
    const aby = p[b + 1] - p[a + 1]
    const abz = p[b + 2] - p[a + 2]
    const acx = p[c] - p[a]
    const acy = p[c + 1] - p[a + 1]
    const acz = p[c + 2] - p[a + 2]
    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx
    area += 0.5 * Math.hypot(nx, ny, nz)
  }
  return area
}

export function boundingBox(mesh) {
  const p = mesh.positions
  if (!p.length) {
    return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] }
  }
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (let i = 0; i < p.length; i += 3) {
    minX = Math.min(minX, p[i])
    minY = Math.min(minY, p[i + 1])
    minZ = Math.min(minZ, p[i + 2])
    maxX = Math.max(maxX, p[i])
    maxY = Math.max(maxY, p[i + 1])
    maxZ = Math.max(maxZ, p[i + 2])
  }
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
  }
}

/**
 * Full validation report for a structural solid.
 */
export function validateMesh(mesh, opts = {}) {
  const errors = []
  const warnings = []
  if (!mesh?.positions?.length || !mesh?.indices?.length) {
    return {
      ok: false,
      errors: ['empty mesh'],
      warnings: [],
      edges: null,
      faces: null,
      volume: null,
      surfaceArea: null,
      watertight: false,
    }
  }

  const faces = analyzeFaces(mesh, opts.areaEps)
  const edges = analyzeEdges(mesh)
  if (!faces.finite) errors.push('non-finite vertex coordinates')
  if (faces.degenerateFaceCount) errors.push(`${faces.degenerateFaceCount} degenerate triangles`)
  if (faces.invalidFaceCount) errors.push(`${faces.invalidFaceCount} invalid faces`)
  if (edges.boundaryEdgeCount && opts.requireWatertight !== false) {
    errors.push(`${edges.boundaryEdgeCount} open boundary edges (not watertight)`)
  }
  if (edges.nonManifoldEdgeCount) {
    errors.push(`${edges.nonManifoldEdgeCount} non-manifold edges`)
  }

  let vol = null
  let area = null
  if (edges.watertight && faces.finite) {
    vol = Math.abs(signedVolume(mesh))
    if (!(vol > 0)) errors.push('non-positive volume on closed mesh')
  } else {
    warnings.push('volume unavailable — mesh not closed/watertight')
  }
  area = surfaceArea(mesh)

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    edges,
    faces,
    volume: vol,
    surfaceArea: area,
    watertight: edges.watertight,
    triangleCount: triangleCount(mesh),
    vertexCount: vertexCount(mesh),
    boundingBox: boundingBox(mesh),
  }
}
