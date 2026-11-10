/**
 * Structural stone extrusion of a validated polygon-with-holes region (Step 13D).
 *
 * Coordinate convention:
 *   2D X → 3D X
 *   2D Y → 3D Y
 *   Stone depth → 3D Z
 *   1 world unit = 1 meter
 *
 * Openings remain open (interior side walls only — no caps on voids).
 */

import { Earcut } from 'three/src/extras/Earcut.js'
import { createMeshData, validateMesh } from './meshValidation.js'
import { toHardEdgeMesh } from './hardEdgeNormals.js'

export const DEPTH_ALIGNMENTS = Object.freeze({
  FRONT: 'front',
  BACK: 'back',
  CENTERED: 'centered',
})

/**
 * Per-edge sample counts for tessellating exact 2D curves.
 * Values chosen so Earcut hole bridges stay manifold after extrusion
 * (some densities produce pinch artifacts — see Step 13D docs).
 */
export const TESSELLATION_QUALITY = Object.freeze({
  draft: { segments: 16, label: 'Draft' },
  standard: { segments: 28, label: 'Standard' },
  high: { segments: 56, label: 'High' },
})

/**
 * Map depth + alignment → [zBack, zFront] with front toward +Z.
 */
export function depthRange(depth, alignment = DEPTH_ALIGNMENTS.CENTERED) {
  const d = Number(depth)
  if (!(d > 0) || !Number.isFinite(d)) {
    throw new Error(`stone depth must be positive finite (got ${depth})`)
  }
  switch (alignment) {
    case DEPTH_ALIGNMENTS.FRONT:
      return { zBack: 0, zFront: d, alignment }
    case DEPTH_ALIGNMENTS.BACK:
      return { zBack: -d, zFront: 0, alignment }
    case DEPTH_ALIGNMENTS.CENTERED:
    default:
      return { zBack: -d / 2, zFront: d / 2, alignment: DEPTH_ALIGNMENTS.CENTERED }
  }
}

/**
 * Drop duplicate closing vertex if present.
 * @param {{x:number,y:number}[]} ring
 */
export function openRing(ring) {
  if (!ring?.length) return []
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (
    ring.length > 2 &&
    Math.abs(first.x - last.x) < 1e-12 &&
    Math.abs(first.y - last.y) < 1e-12
  ) {
    return ring.slice(0, -1)
  }
  return ring.slice()
}

function signedArea2(ring) {
  let a = 0
  const n = ring.length
  for (let i = 0; i < n; i += 1) {
    const p = ring[i]
    const q = ring[(i + 1) % n]
    a += p.x * q.y - q.x * p.y
  }
  return a * 0.5
}

/** Ensure CCW for outer (+area), CW for holes (−area). */
export function orientRing(ring, wantPositive) {
  const open = openRing(ring)
  const a = signedArea2(open)
  if (wantPositive && a < 0) return open.reverse()
  if (!wantPositive && a > 0) return open.reverse()
  return open
}

/**
 * Remove near-duplicate and collinear vertices so Earcut keeps a clean boundary.
 * Exact source curves are unchanged — this only affects the tessellation ring.
 */
export function cleanRing(ring, opts = {}) {
  const distEps = opts.distEps ?? 1e-9
  const colinearEps = opts.colinearEps ?? 1e-8
  let pts = orientRing(ring, opts.wantPositive !== false)
  // drop consecutive near-duplicates
  const dedup = []
  for (const p of pts) {
    const prev = dedup[dedup.length - 1]
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) <= distEps) continue
    dedup.push({ x: p.x, y: p.y })
  }
  if (
    dedup.length > 2 &&
    Math.hypot(dedup[0].x - dedup[dedup.length - 1].x, dedup[0].y - dedup[dedup.length - 1].y) <=
      distEps
  ) {
    dedup.pop()
  }

  // drop collinear middle vertices
  if (dedup.length < 3) return dedup
  let out = []
  const n0 = dedup.length
  for (let i = 0; i < n0; i += 1) {
    const a = dedup[(i - 1 + n0) % n0]
    const b = dedup[i]
    const c = dedup[(i + 1) % n0]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const bcx = c.x - b.x
    const bcy = c.y - b.y
    const cross = abx * bcy - aby * bcx
    const scale = Math.hypot(abx, aby) * Math.hypot(bcx, bcy) || 1
    if (Math.abs(cross) / scale <= colinearEps) continue
    out.push(b)
  }
  if (out.length < 3) out = dedup

  return out
}

/**
 * Drop zero-area earcut triangles before extrusion topology is built.
 */
export function cleanTriangles(flatXY, triangles, areaEps = 1e-18) {
  const out = []
  for (let i = 0; i < triangles.length; i += 3) {
    const ia = triangles[i]
    const ib = triangles[i + 1]
    const ic = triangles[i + 2]
    const ax = flatXY[ia * 2]
    const ay = flatXY[ia * 2 + 1]
    const bx = flatXY[ib * 2]
    const by = flatXY[ib * 2 + 1]
    const cx = flatXY[ic * 2]
    const cy = flatXY[ic * 2 + 1]
    const area2 = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax))
    if (area2 > areaEps) out.push(ia, ib, ic)
  }
  return out
}

/**
 * Triangulate polygon with holes via Earcut.
 * Outer CCW, holes CW. Returns triangle index triplets into concatenated vertex list.
 */
export function triangulatePolygonWithHoles(outer, holes = []) {
  const o = cleanRing(outer, { wantPositive: true })
  const hs = holes.map((h) => cleanRing(h, { wantPositive: false }))
  if (o.length < 3) throw new Error('outer boundary needs ≥3 vertices')

  const flat = []
  const holeIndices = []
  for (const p of o) {
    flat.push(p.x, p.y)
  }
  let cursor = o.length
  for (const h of hs) {
    if (h.length < 3) throw new Error('hole needs ≥3 vertices')
    holeIndices.push(cursor)
    for (const p of h) flat.push(p.x, p.y)
    cursor += h.length
  }

  const tri = Earcut.triangulate(flat, holeIndices.length ? holeIndices : undefined, 2)
  if (!tri.length) throw new Error('earcut produced no triangles')
  // Do not strip near-zero earcut faces here — hole-bridge triangles can be
  // numerically thin; removing them leaves open bridge edges in 3D.
  return { vertices: flat, triangles: tri, outer: o, holes: hs }
}

function pushV(pos, x, y, z) {
  pos.push(x, y, z)
}

/**
 * Boundary edges of a planar triangulation (appear once).
 */
export function triangulationBoundaryEdges(triangles) {
  const counts = new Map()
  const directed = new Map()
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i]
    const b = triangles[i + 1]
    const c = triangles[i + 2]
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const k = u < v ? `${u}|${v}` : `${v}|${u}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
      if (!directed.has(k)) directed.set(k, [u, v])
    }
  }
  const edges = []
  for (const [k, n] of counts) {
    if (n === 1) {
      const [u, v] = directed.get(k)
      edges.push([u, v])
    }
  }
  return edges
}

/**
 * Ring id for a concatenated-contour vertex index.
 */
export function ringIdAt(index, ringLengths) {
  let base = 0
  for (let r = 0; r < ringLengths.length; r += 1) {
    if (index < base + ringLengths[r]) return r
    base += ringLengths[r]
  }
  return -1
}

/**
 * Split planar vertices whose triangulation-boundary degree exceeds 2.
 * Earcut hole bridges can create pinch points; duplicating the vertex by
 * angular sectors restores manifold side walls after extrusion.
 */
export function splitBoundaryPinches(flatXY, triangles) {
  let verts = flatXY.slice()
  let tris = triangles.slice()
  const maxPasses = 8
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const boundary = triangulationBoundaryEdges(tris)
    const adj = new Map()
    for (const [u, v] of boundary) {
      if (!adj.has(u)) adj.set(u, new Set())
      if (!adj.has(v)) adj.set(v, new Set())
      adj.get(u).add(v)
      adj.get(v).add(u)
    }
    const pinch = [...adj.entries()].find(([, ns]) => ns.size > 2)
    if (!pinch) break
    const [v, neighborSet] = pinch
    const vx = verts[v * 2]
    const vy = verts[v * 2 + 1]
    const ns = [...neighborSet].sort(
      (a, b) =>
        Math.atan2(verts[a * 2 + 1] - vy, verts[a * 2] - vx) -
        Math.atan2(verts[b * 2 + 1] - vy, verts[b * 2] - vx),
    )
    // Keep first two neighbors on v; move the next pair onto a duplicate.
    if (ns.length < 4) break
    const nA = ns[2]
    const nB = ns[3]
    const newIdx = verts.length / 2
    verts.push(vx, vy)
    for (let t = 0; t < tris.length; t += 3) {
      const face = [tris[t], tris[t + 1], tris[t + 2]]
      if (!face.includes(v)) continue
      const others = face.filter((x) => x !== v)
      if (others.some((o) => o === nA || o === nB)) {
        for (let k = 0; k < 3; k += 1) {
          if (face[k] === v) face[k] = newIdx
        }
        tris[t] = face[0]
        tris[t + 1] = face[1]
        tris[t + 2] = face[2]
      }
    }
  }
  return { flatXY: verts, triangles: tris, vertexCount: verts.length / 2 }
}

/**
 * Weld planar triangulation vertices by XY and remap triangles.
 * Prevents stacked side walls when ring samples revisit the same point.
 */
export function weldPlanarTriangulation(flatXY, triangles, snapEps = 1e-7) {
  const n = flatXY.length / 2
  const remap = new Int32Array(n)
  const unique = []
  const keyMap = new Map()
  const quant = snapEps
  for (let i = 0; i < n; i += 1) {
    const x = flatXY[i * 2]
    const y = flatXY[i * 2 + 1]
    const k = `${Math.round(x / quant)}|${Math.round(y / quant)}`
    if (keyMap.has(k)) {
      remap[i] = keyMap.get(k)
    } else {
      const ni = unique.length / 2
      keyMap.set(k, ni)
      remap[i] = ni
      unique.push(x, y)
    }
  }
  const remapped = []
  const seen = new Set()
  for (let i = 0; i < triangles.length; i += 3) {
    let a = remap[triangles[i]]
    let b = remap[triangles[i + 1]]
    let c = remap[triangles[i + 2]]
    if (a === b || b === c || c === a) continue
    const ax = unique[a * 2]
    const ay = unique[a * 2 + 1]
    const bx = unique[b * 2]
    const by = unique[b * 2 + 1]
    const cx = unique[c * 2]
    const cy = unique[c * 2 + 1]
    const area2 = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax))
    if (area2 <= 1e-18) continue
    // keep consistent winding (positive area in XY)
    const signed = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    if (signed < 0) {
      const t = b
      b = c
      c = t
    }
    const fk = `${a}|${b}|${c}`
    if (seen.has(fk)) continue
    seen.add(fk)
    remapped.push(a, b, c)
  }
  return { flatXY: unique, triangles: remapped, vertexCount: unique.length / 2 }
}

/**
 * Extrude a stone region (outer + holes) into a watertight solid.
 *
 * @param {{ outer: {x,y}[], holes?: {x,y}[][], depth: number, alignment?: string }} input
 * @returns {{ mesh: MeshData, validation: object, meta: object }}
 */
export function extrudeRegion(input) {
  const {
    outer,
    holes = [],
    depth = 0.25,
    alignment = DEPTH_ALIGNMENTS.CENTERED,
  } = input ?? {}

  if (!outer?.length) throw new Error('extrudeRegion: missing outer boundary')
  for (const h of holes) {
    if (!h?.length) throw new Error('extrudeRegion: empty hole ring')
  }

  const { zBack, zFront } = depthRange(depth, alignment)
  const { vertices, triangles: rawTris, outer: o, holes: hs } = triangulatePolygonWithHoles(
    outer,
    holes,
  )
  if (!rawTris.length) throw new Error('extrudeRegion: no triangles')

  // Optional pinch split when Earcut creates degree>2 boundary verts.
  let triangles = rawTris
  let flat = vertices
  let splitApplied = false
  {
    const boundary = triangulationBoundaryEdges(rawTris)
    const deg = new Map()
    for (const [u, v] of boundary) {
      deg.set(u, (deg.get(u) ?? 0) + 1)
      deg.set(v, (deg.get(v) ?? 0) + 1)
    }
    const needsSplit = [...deg.values()].some((d) => d > 2)
    if (needsSplit) {
      const split = splitBoundaryPinches(vertices, rawTris)
      triangles = split.triangles
      flat = split.flatXY
      splitApplied = true
    }
  }
  const vCount = flat.length / 2

  /** Manifold shared-vertex extrusion; display uses hard-edge normals separately. */
  function buildExtrusionMesh(flatXY, tris, vc) {
    const positions = []
    const indices = []
    const backOffset = vc
    for (let i = 0; i < vc; i += 1) pushV(positions, flatXY[i * 2], flatXY[i * 2 + 1], zFront)
    for (let i = 0; i < vc; i += 1) pushV(positions, flatXY[i * 2], flatXY[i * 2 + 1], zBack)

    for (let i = 0; i < tris.length; i += 3) {
      indices.push(tris[i], tris[i + 1], tris[i + 2])
    }
    for (let i = 0; i < tris.length; i += 3) {
      indices.push(backOffset + tris[i], backOffset + tris[i + 2], backOffset + tris[i + 1])
    }

    const walls = triangulationBoundaryEdges(tris)
    const seen = new Set()
    for (const [u, v] of walls) {
      const k = u < v ? `${u}|${v}` : `${v}|${u}`
      if (seen.has(k)) continue
      seen.add(k)
      indices.push(u, backOffset + u, backOffset + v)
      indices.push(u, backOffset + v, v)
    }

    return {
      mesh: createMeshData(positions, indices, {
        kind: 'structural_extrusion',
        depth,
        alignment,
        zBack,
        zFront,
        holeCount: hs.length,
        frontVertexCount: vc,
      }),
      sideWallEdgeCount: seen.size,
    }
  }

  let built = buildExtrusionMesh(flat, triangles, vCount)
  let mesh = built.mesh
  let validation = validateMesh(mesh, { requireWatertight: true })

  // If pinch-split hurt topology, fall back to unsplit extrusion.
  if (!validation.ok && splitApplied) {
    const fallback = buildExtrusionMesh(vertices, rawTris, vertices.length / 2)
    const validation2 = validateMesh(fallback.mesh, { requireWatertight: true })
    if (
      validation2.ok ||
      (validation2.edges?.nonManifoldEdgeCount ?? 99) < (validation.edges?.nonManifoldEdgeCount ?? 99)
    ) {
      built = fallback
      mesh = fallback.mesh
      validation = validation2
      splitApplied = false
    }
  }

  // Display mesh: hard-edge normals so planar front/back stay flat.
  const displayMesh = toHardEdgeMesh(mesh)

  return {
    mesh,
    displayMesh,
    validation,
    meta: {
      depth,
      alignment,
      zBack,
      zFront,
      holeCount: hs.length,
      outerVertexCount: o.length,
      holeVertexCounts: hs.map((h) => h.length),
      sideWallEdgeCount: built.sideWallEdgeCount,
      planarVertexCount: vCount,
      pinchSplit: splitApplied,
      hardEdgeDisplay: true,
    },
  }
}
