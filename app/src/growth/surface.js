import * as THREE from 'three'

/**
 * Surface access for the facade: closest-point projection (paths stay attached)
 * and raycasting (2D → 3D projection study). Back faces are ignored and
 * triangles buried inside another part are avoided through part.contains().
 */

const CELL = 0.2
const BURIED_PROBE = 0.01

function cellKey(ix, iy, iz) {
  return (ix + 512) * 1048576 + (iy + 512) * 1024 + (iz + 512)
}

const ab = new THREE.Vector3()
const ac = new THREE.Vector3()
const ap = new THREE.Vector3()
const bp = new THREE.Vector3()
const cp = new THREE.Vector3()

/** Ericson, Real-Time Collision Detection 5.1.5. Writes barycentric weights into out. */
function closestBarycentric(p, a, b, c, out) {
  ab.subVectors(b, a)
  ac.subVectors(c, a)
  ap.subVectors(p, a)
  const d1 = ab.dot(ap)
  const d2 = ac.dot(ap)
  if (d1 <= 0 && d2 <= 0) return out.set(1, 0, 0)
  bp.subVectors(p, b)
  const d3 = ab.dot(bp)
  const d4 = ac.dot(bp)
  if (d3 >= 0 && d4 <= d3) return out.set(0, 1, 0)
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3)
    return out.set(1 - v, v, 0)
  }
  cp.subVectors(p, c)
  const d5 = ab.dot(cp)
  const d6 = ac.dot(cp)
  if (d6 >= 0 && d5 <= d6) return out.set(0, 0, 1)
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6)
    return out.set(1 - w, 0, w)
  }
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6))
    return out.set(0, 1 - w, w)
  }
  const denom = 1 / (va + vb + vc)
  const v = vb * denom
  const w = vc * denom
  return out.set(1 - v - w, v, w)
}

export function createSurface(facade) {
  const positions = []
  const normals = []
  const partOf = []
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
      n.subVectors(b, a).cross(ac.subVectors(c, a))
      if (n.lengthSq() < 1e-12) continue
      n.normalize()
      if (n.z < -0.3) continue
      for (let k = 0; k < 3; k += 1) {
        positions.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k))
        normals.push(nrm.getX(i + k), nrm.getY(i + k), nrm.getZ(i + k))
      }
      partOf.push(partIndex)
    }
  })

  const triPos = new Float32Array(positions)
  const triNrm = new Float32Array(normals)
  const triPart = new Uint16Array(partOf)
  const triCount = triPart.length
  const grid = new Map()

  for (let t = 0; t < triCount; t += 1) {
    let minX = Infinity
    let minY = Infinity
    let minZ = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let maxZ = -Infinity
    for (let k = 0; k < 3; k += 1) {
      const o = t * 9 + k * 3
      minX = Math.min(minX, triPos[o])
      maxX = Math.max(maxX, triPos[o])
      minY = Math.min(minY, triPos[o + 1])
      maxY = Math.max(maxY, triPos[o + 1])
      minZ = Math.min(minZ, triPos[o + 2])
      maxZ = Math.max(maxZ, triPos[o + 2])
    }
    for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix += 1) {
      for (let iy = Math.floor(minY / CELL); iy <= Math.floor(maxY / CELL); iy += 1) {
        for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz += 1) {
          const key = cellKey(ix, iy, iz)
          const list = grid.get(key)
          if (list) list.push(t)
          else grid.set(key, [t])
        }
      }
    }
  }

  const seen = new Uint32Array(triCount)
  let stamp = 0
  const va = new THREE.Vector3()
  const vb = new THREE.Vector3()
  const vc = new THREE.Vector3()
  const bary = new THREE.Vector3()
  const q = new THREE.Vector3()

  function nearest(p, onlyPart, rings = 1) {
    stamp += 1
    const cx = Math.floor(p.x / CELL)
    const cy = Math.floor(p.y / CELL)
    const cz = Math.floor(p.z / CELL)
    let best = Infinity
    let bestTri = -1
    let bu = 0
    let bv = 0
    let bw = 0
    for (let dx = -rings; dx <= rings; dx += 1) {
      for (let dy = -rings; dy <= rings; dy += 1) {
        for (let dz = -rings; dz <= rings; dz += 1) {
          const list = grid.get(cellKey(cx + dx, cy + dy, cz + dz))
          if (!list) continue
          for (const t of list) {
            if (seen[t] === stamp) continue
            seen[t] = stamp
            if (onlyPart >= 0 && triPart[t] !== onlyPart) continue
            const o = t * 9
            va.fromArray(triPos, o)
            vb.fromArray(triPos, o + 3)
            vc.fromArray(triPos, o + 6)
            closestBarycentric(p, va, vb, vc, bary)
            q.set(0, 0, 0).addScaledVector(va, bary.x).addScaledVector(vb, bary.y).addScaledVector(vc, bary.z)
            const d = q.distanceToSquared(p)
            if (d < best) {
              best = d
              bestTri = t
              bu = bary.x
              bv = bary.y
              bw = bary.z
            }
          }
        }
      }
    }
    if (bestTri < 0) return rings < 3 ? nearest(p, onlyPart, rings + 1) : null

    const o = bestTri * 9
    const point = new THREE.Vector3()
      .addScaledVector(va.fromArray(triPos, o), bu)
      .addScaledVector(vb.fromArray(triPos, o + 3), bv)
      .addScaledVector(vc.fromArray(triPos, o + 6), bw)
    const normal = new THREE.Vector3()
      .addScaledVector(va.fromArray(triNrm, o), bu)
      .addScaledVector(vb.fromArray(triNrm, o + 3), bv)
      .addScaledVector(vc.fromArray(triNrm, o + 6), bw)
      .normalize()
    return { point, normal, distance: Math.sqrt(best), part: triPart[bestTri] }
  }

  function insidePart(p, exclude = -1) {
    for (let i = 0; i < facade.parts.length; i += 1) {
      if (i !== exclude && facade.parts[i].contains && facade.parts[i].contains(p)) return i
    }
    return -1
  }

  /** Closest visible surface point. Inside a solid, only that solid's faces count. */
  function project(p) {
    let hit = nearest(p, insidePart(p))
    if (!hit) return null
    const probe = hit.point.clone().addScaledVector(hit.normal, BURIED_PROBE)
    const buriedIn = insidePart(probe, hit.part)
    if (buriedIn >= 0) {
      const alt = nearest(p, buriedIn)
      if (alt) hit = alt
    }
    return hit
  }

  const meshes = facade.parts.map((part) => {
    part.geometry.computeBoundingSphere()
    return new THREE.Mesh(part.geometry, new THREE.MeshBasicMaterial({ side: THREE.FrontSide }))
  })
  const raycaster = new THREE.Raycaster()

  /** First front-facing hit along a ray. */
  function raycast(origin, direction) {
    raycaster.set(origin, direction)
    const hits = raycaster.intersectObjects(meshes, false)
    const hit = hits.find((h) => h.face && h.face.normal.dot(direction) < 0)
    if (!hit) return null
    return { point: hit.point.clone(), normal: hit.face.normal.clone().normalize() }
  }

  return { project, raycast, triangleCount: triCount }
}
