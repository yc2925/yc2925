import * as THREE from 'three'

/**
 * Abstract Gothic test facade. Each part keeps a semantic kind so the
 * distribution study can ask architectural questions (arch, column, ledge…).
 * Facade faces +Z; ground at y = 0.
 */

export const PART_KINDS = ['wall', 'recess', 'arch', 'column', 'ledge', 'ring']

const WALL_HALF = 2.2
const WALL_BASE = 0.5
const WALL_TOP = 5.7
const GABLE_PEAK = 6.9
const WALL_DEPTH = 0.9
const ARCH_HALF = 0.95
const ARCH_SILL = 0.62
const ARCH_SPRING = 2.55
const ARCH_APEX = 4.0
const OCULUS_Y = 5.15
const OCULUS_R = 0.45

function V(x, y, z) {
  return new THREE.Vector3(x, y, z)
}

/** Pointed arch outline (2D) from left foot to right foot. */
function archOutline(half, foot, spring, apex, steps = 14) {
  const rise = apex - spring
  const c = (rise * rise - half * half) / (2 * half)
  const R = half + c
  const thetaApex = Math.atan2(rise, -c)
  const pts = [[-half, foot]]
  for (let i = 0; i <= steps; i += 1) {
    const th = Math.PI + (thetaApex - Math.PI) * (i / steps)
    pts.push([c + R * Math.cos(th), spring + R * Math.sin(th)])
  }
  for (let i = steps - 1; i >= 0; i -= 1) {
    const th = Math.PI + (thetaApex - Math.PI) * (i / steps)
    pts.push([-(c + R * Math.cos(th)), spring + R * Math.sin(th)])
  }
  pts.push([half, foot])
  return pts
}

function box(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  const contains = (p) =>
    p.x > x0 + 1e-3 && p.x < x1 - 1e-3 && p.y > y0 + 1e-3 && p.y < y1 - 1e-3 && p.z > z0 + 1e-3 && p.z < z1 - 1e-3
  return { geometry: g, contains }
}

function column(x, z, r, y0, y1) {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, 20, 1, true)
  g.translate(x, (y0 + y1) / 2, z)
  const contains = (p) => p.y > y0 && p.y < y1 && Math.hypot(p.x - x, p.z - z) < r - 1e-3
  return { geometry: g, contains }
}

function tubeAlong(points, radius, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal')
  const g = new THREE.TubeGeometry(curve, Math.max(24, points.length * 4), radius, 10, closed)
  return { geometry: g, curve }
}

export function createFacade() {
  const parts = []
  const features = { arch: [], column: [], ledge: [], ring: [] }
  const add = (kind, geometry, contains = null) => parts.push({ kind, geometry, contains })

  // Wall with a pointed-arch opening and a gable.
  const shape = new THREE.Shape()
  shape.moveTo(-WALL_HALF, WALL_BASE)
  shape.lineTo(WALL_HALF, WALL_BASE)
  shape.lineTo(WALL_HALF, WALL_TOP)
  shape.lineTo(0, GABLE_PEAK)
  shape.lineTo(-WALL_HALF, WALL_TOP)
  shape.closePath()
  const opening = archOutline(ARCH_HALF, ARCH_SILL, ARCH_SPRING, ARCH_APEX)
  const hole = new THREE.Path()
  opening.forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)))
  hole.closePath()
  shape.holes.push(hole)
  const wall = new THREE.ExtrudeGeometry(shape, { depth: WALL_DEPTH, bevelEnabled: false, curveSegments: 8 })
  wall.translate(0, 0, -WALL_DEPTH)
  add('wall', wall, (p) => {
    if (p.z > -1e-3 || p.z < -WALL_DEPTH + 1e-3) return false
    if (Math.abs(p.x) > WALL_HALF || p.y < WALL_BASE || p.y > GABLE_PEAK) return false
    if (p.y > WALL_TOP && p.y > GABLE_PEAK - (Math.abs(p.x) / WALL_HALF) * (GABLE_PEAK - WALL_TOP)) return false
    return !(Math.abs(p.x) < ARCH_HALF && p.y > ARCH_SILL && p.y < ARCH_APEX)
  })
  features.arch.push(opening.map(([x, y]) => V(x, y, 0)))

  // Recess: door plane at the back of the portal.
  const door = box(-ARCH_HALF, ARCH_HALF, WALL_BASE, ARCH_APEX, -WALL_DEPTH - 0.08, -WALL_DEPTH + 0.02)
  add('recess', door.geometry, door.contains)

  // Archivolts stepping back into the reveal, plus a hood mould on the face.
  for (let i = 0; i < 3; i += 1) {
    const half = ARCH_HALF - 0.1 - i * 0.14
    const z = -0.14 - i * 0.26
    const pts = archOutline(half, ARCH_SILL, ARCH_SPRING - i * 0.04, ARCH_APEX - 0.1 - i * 0.16, 10).map(
      ([x, y]) => V(x, y, z),
    )
    add('arch', tubeAlong(pts, 0.055).geometry)
    features.arch.push(pts)
  }
  const hoodPts = archOutline(ARCH_HALF + 0.14, ARCH_SPRING, ARCH_SPRING, ARCH_APEX + 0.16, 12)
    .slice(1, -1)
    .map(([x, y]) => V(x, y, 0.05))
  add('arch', tubeAlong(hoodPts, 0.05).geometry)
  features.arch.push(hoodPts)

  // Corner pilasters and engaged colonnettes.
  for (const s of [-1, 1]) {
    const pil = box(s * WALL_HALF - 0.2, s * WALL_HALF + 0.2, WALL_BASE, WALL_TOP + 0.15, -0.25, 0.32)
    add('column', pil.geometry, pil.contains)
    features.column.push([V(s * (WALL_HALF - 0.2), WALL_BASE, 0.32), V(s * (WALL_HALF - 0.2), WALL_TOP + 0.15, 0.32)])
    features.column.push([V(s * (WALL_HALF + 0.2), WALL_BASE, 0.32), V(s * (WALL_HALF + 0.2), WALL_TOP + 0.15, 0.32)])

    const col = column(s * 1.42, 0.03, 0.11, WALL_BASE, 5.25)
    add('column', col.geometry, col.contains)
    features.column.push([V(s * 1.42, WALL_BASE, 0.14), V(s * 1.42, 5.25, 0.14)])
  }

  // Ledges: plinth, split string course, course above the arch, cornice.
  const plinth = box(-2.55, 2.55, 0, WALL_BASE, -WALL_DEPTH - 0.1, 0.42)
  add('ledge', plinth.geometry, plinth.contains)
  features.ledge.push([V(-2.55, WALL_BASE, 0.42), V(2.55, WALL_BASE, 0.42)])
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -2.42 : ARCH_HALF + 0.08
    const x1 = s < 0 ? -ARCH_HALF - 0.08 : 2.42
    const course = box(x0, x1, 1.55, 1.68, -0.05, 0.2)
    add('ledge', course.geometry, course.contains)
    features.ledge.push([V(x0, 1.68, 0.2), V(x1, 1.68, 0.2)])
  }
  for (const [y0, y1, depth] of [
    [4.32, 4.47, 0.22],
    [WALL_TOP - 0.02, WALL_TOP + 0.13, 0.26],
  ]) {
    const ledge = box(-2.42, 2.42, y0, y1, -0.05, depth)
    add('ledge', ledge.geometry, ledge.contains)
    features.ledge.push([V(-2.42, y1, depth), V(2.42, y1, depth)])
  }

  // Gable coping.
  const coping = [V(-WALL_HALF - 0.05, WALL_TOP + 0.15, 0.06), V(0, GABLE_PEAK + 0.06, 0.06), V(WALL_HALF + 0.05, WALL_TOP + 0.15, 0.06)]
  for (let i = 0; i < 2; i += 1) {
    const seg = [coping[i], coping[i].clone().lerp(coping[i + 1], 0.5), coping[i + 1]]
    add('ledge', tubeAlong(seg, 0.07).geometry)
    features.ledge.push(seg)
  }

  // Oculus: two concentric rings.
  for (const r of [OCULUS_R, OCULUS_R * 0.42]) {
    const torus = new THREE.TorusGeometry(r, r === OCULUS_R ? 0.075 : 0.05, 12, 64)
    torus.translate(0, OCULUS_Y, 0.03)
    add('ring', torus)
    const ring = []
    for (let i = 0; i <= 48; i += 1) {
      const a = (i / 48) * Math.PI * 2
      ring.push(V(Math.cos(a) * r, OCULUS_Y + Math.sin(a) * r, 0.03))
    }
    features.ring.push(ring)
  }

  // Normalise every part to non-indexed position + normal for merging and sampling.
  for (const part of parts) {
    let g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry
    for (const key of Object.keys(g.attributes)) {
      if (key !== 'position' && key !== 'normal') g.deleteAttribute(key)
    }
    if (!g.attributes.normal) g.computeVertexNormals()
    part.geometry = g
  }

  return {
    parts,
    features,
    bounds: { minY: 0, maxY: GABLE_PEAK + 0.1, frontZ: 0, recessDepth: WALL_DEPTH },
    portal: { halfWidth: ARCH_HALF, apex: ARCH_APEX },
  }
}
