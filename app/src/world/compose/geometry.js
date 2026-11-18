/**
 * Render geometry for the curve world (Step 47, feedback round 1):
 *  - stone prototypes (carving.js: ashlar, drums, mouldings, carved pieces)
 *  - tapered member tubes with joint bosses and ornament-site markers
 *  - explode offsets per fragment ("piece")
 */

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rotationMinimisingFrames } from '../curves/curve3.js'

export { createStonePrototypes } from './carving.js'

/** One tapered tube per member (+ joint spheres), merged; uv.x = metres along, uv.y = around. */
export function buildMemberGeometry(skeleton, offsetOf = () => null, radial = 10) {
  const parts = []
  for (const m of skeleton.members) {
    if (m.points.length < 2) continue
    const frames = rotationMinimisingFrames(m.points)
    const off = offsetOf(m.piece) ?? { x: 0, y: 0, z: 0 }
    const pos = []
    const nor = []
    const uv = []
    const idx = []
    let along = 0
    for (let i = 0; i < frames.length; i += 1) {
      if (i > 0) along += Math.hypot(m.points[i].x - m.points[i - 1].x, m.points[i].y - m.points[i - 1].y, m.points[i].z - m.points[i - 1].z)
      const f = frames[i]
      const r = Math.max(0.02, m.radii[i])
      for (let j = 0; j <= radial; j += 1) {
        const a = (j / radial) * Math.PI * 2
        const nx = f.up.x * Math.cos(a) + f.side.x * Math.sin(a)
        const ny = f.up.y * Math.cos(a) + f.side.y * Math.sin(a)
        const nz = f.up.z * Math.cos(a) + f.side.z * Math.sin(a)
        pos.push(f.p.x + nx * r + off.x, f.p.y + ny * r + off.y, f.p.z + nz * r + off.z)
        nor.push(nx, ny, nz)
        uv.push(along, (j / radial) * Math.max(1, r * 2 * Math.PI))
      }
    }
    for (let i = 0; i < frames.length - 1; i += 1)
      for (let j = 0; j < radial; j += 1) {
        const a = i * (radial + 1) + j
        const b = a + radial + 1
        idx.push(a, b, a + 1, b, b + 1, a + 1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    parts.push(g)
  }
  const sites = [...skeleton.joints, ...(skeleton.ornaments ?? []).filter((o) => o.type !== 'crocket').map((o) => ({ p: o.p, r: Math.max(0.15, o.size * 0.45) }))]
  for (const j of sites) {
    const s = new THREE.IcosahedronGeometry(j.r, 1)
    s.deleteAttribute('uv')
    const n = s.attributes.position.count
    const uv = new Float32Array(n * 2)
    for (let i = 0; i < n; i += 1) {
      uv[i * 2] = s.attributes.position.getY(i) + j.p.y
      uv[i * 2 + 1] = Math.atan2(s.attributes.position.getZ(i), s.attributes.position.getX(i)) * j.r
    }
    s.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    s.translate(j.p.x, j.p.y, j.p.z)
    parts.push(s.index ? s : s)
  }
  if (!parts.length) return null
  const normalized = parts.map((g) => (g.index ? g : g))
  const allIndexed = normalized.every((g) => g.index)
  const merged = mergeGeometries(allIndexed ? normalized : normalized.map((g) => (g.index ? g.toNonIndexed() : g)))
  parts.forEach((g) => g.dispose())
  return merged
}

function hash01(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10007) / 10007
}

/**
 * Explode: each piece moves away from the structure centre along the
 * direction to its own centroid (horizontal emphasis, slight lift),
 * by explode × (0.5 … 1.3) — stable per piece name.
 */
export function computePieceOffsets(items, center, explode) {
  const map = new Map()
  if (!explode) return map
  const acc = new Map()
  for (const { piece, p } of items) {
    const a = acc.get(piece) ?? { x: 0, y: 0, z: 0, n: 0 }
    a.x += p.x
    a.y += p.y
    a.z += p.z
    a.n += 1
    acc.set(piece, a)
  }
  for (const [piece, a] of acc) {
    const c = { x: a.x / a.n, y: a.y / a.n, z: a.z / a.n }
    let d = { x: c.x - center.x, y: (c.y - center.y) * 0.6 + 0.35, z: c.z - center.z }
    const l = Math.hypot(d.x, d.y, d.z) || 1
    d = { x: d.x / l, y: d.y / l, z: d.z / l }
    const k = explode * (0.5 + 0.8 * hash01(piece))
    map.set(piece, { x: d.x * k, y: d.y * k, z: d.z * k })
  }
  return map
}
