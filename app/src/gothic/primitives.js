import * as THREE from 'three'
import { FEATURE_TYPES } from './settings.js'

/** Shared Gothic primitives: curves, volumes, feature records. */

export const V = (x, y, z) => new THREE.Vector3(x, y, z)

const TYPE_COLOR = Object.fromEntries(FEATURE_TYPES.map((t) => [t.id, t.color]))

export function featureColor(type) {
  return TYPE_COLOR[type] ?? '#888888'
}

/** Deterministic 0–1 RNG (same helper family as Growth Lab). */
export function mulberry32(seed) {
  let t = (seed >>> 0) + 0x6d2b79f5
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Integer-safe seeded RNG. Avoids float precision loss from seed * largePrime.
 * salt lets each typology / stage have an independent stream from the same UI seed.
 */
export function seededRandom(seed = 1, salt = 0) {
  const s = Math.imul(seed | 0, 0x9e3779b9) + (salt | 0)
  return mulberry32(s >>> 0)
}

/** Two-centred pointed arch outline: left foot → apex → right foot. */
export function pointedArchOutline(half, foot, spring, apex, steps = 16) {
  const rise = Math.max(1e-4, apex - spring)
  const safeHalf = Math.max(1e-3, half)
  const c = (rise * rise - safeHalf * safeHalf) / (2 * safeHalf)
  const R = safeHalf + c
  const thetaApex = Math.atan2(rise, -c)
  const pts = [[-safeHalf, foot]]
  for (let i = 0; i <= steps; i += 1) {
    const th = Math.PI + (thetaApex - Math.PI) * (i / steps)
    pts.push([c + R * Math.cos(th), spring + R * Math.sin(th)])
  }
  for (let i = steps - 1; i >= 0; i -= 1) {
    const th = Math.PI + (thetaApex - Math.PI) * (i / steps)
    pts.push([-(c + R * Math.cos(th)), spring + R * Math.sin(th)])
  }
  pts.push([safeHalf, foot])
  return pts
}

export function pointedArchHalf(half, spring, apex, steps = 16, sign = 1) {
  const rise = Math.max(1e-4, apex - spring)
  const safeHalf = Math.max(1e-3, half)
  const c = (rise * rise - safeHalf * safeHalf) / (2 * safeHalf)
  const R = safeHalf + c
  const thetaApex = Math.atan2(rise, -c)
  const pts = []
  for (let i = 0; i <= steps; i += 1) {
    const th = Math.PI + (thetaApex - Math.PI) * (i / steps)
    pts.push([sign * (c + R * Math.cos(th)), spring + R * Math.sin(th)])
  }
  return pts
}

export function boxGeometry(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(Math.max(1e-4, x1 - x0), Math.max(1e-4, y1 - y0), Math.max(1e-4, z1 - z0))
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return g
}

export function tubeAlong(points, radius, tubular = null, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  const segs = tubular ?? Math.max(24, points.length * 3)
  return { geometry: new THREE.TubeGeometry(curve, segs, Math.max(0.008, radius), radial, false), curve }
}

export function frameAt(origin, tangent, upHint = V(0, 1, 0)) {
  const u = tangent.clone().normalize()
  let n = new THREE.Vector3().crossVectors(u, upHint)
  if (n.lengthSq() < 1e-8) n = new THREE.Vector3().crossVectors(u, V(0, 0, 1))
  n.normalize()
  const v = new THREE.Vector3().crossVectors(n, u).normalize()
  return { origin: origin.clone(), u, v, n }
}

export function makeFeature({ id, type, label, points = null, curve = null, localFrame = null, bounds = null, meta = {} }) {
  return {
    id,
    type,
    label,
    color: featureColor(type),
    points: points ? points.map((p) => p.clone()) : null,
    curve,
    localFrame,
    bounds,
    meta,
  }
}

export function normalizeGeometry(geometry) {
  let g = geometry.index ? geometry.toNonIndexed() : geometry
  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal') g.deleteAttribute(key)
  }
  if (!g.attributes.normal) g.computeVertexNormals()
  return g
}

/** Mutable builder used by every typology. */
export function createBuilder() {
  const meshes = []
  const features = []
  return {
    meshes,
    features,
    addMesh(id, type, geometry) {
      meshes.push({ id, type, geometry: normalizeGeometry(geometry), color: featureColor(type) })
    },
    addFeature(desc) {
      features.push(makeFeature(desc))
    },
    addBox(id, type, x0, x1, y0, y1, z0, z1) {
      this.addMesh(id, type, boxGeometry(x0, x1, y0, y1, z0, z1))
    },
    addTube(id, type, points, radius, tubular, radial) {
      const { geometry, curve } = tubeAlong(points, radius, tubular, radial)
      this.addMesh(id, type, geometry)
      return curve
    },
    dispose() {
      for (const m of meshes) m.geometry?.dispose()
    },
  }
}

/** Clustered column: main shaft + two thinner shafts, base and capital junctions. */
export function addClusteredColumn(builder, { idPrefix, x, z, y0, y1, radius, side = 'left' }) {
  const shafts = [
    { dx: 0, rz: 0, radius },
    { dx: -radius * 0.85, rz: radius * 0.55, radius: radius * 0.55 },
    { dx: radius * 0.85, rz: radius * 0.55, radius: radius * 0.55 },
  ]
  shafts.forEach((s, si) => {
    const g = new THREE.CylinderGeometry(s.radius, s.radius * 1.05, y1 - y0, 14, 1, true)
    g.translate(x + s.dx, (y0 + y1) / 2, z + s.rz)
    builder.addMesh(`${idPrefix}-shaft-${si}`, 'column', g)
  })
  builder.addFeature({
    id: idPrefix,
    type: 'column',
    label: `Clustered column (${side})`,
    points: [V(x, y0, z), V(x, y1, z)],
    localFrame: frameAt(V(x, (y0 + y1) / 2, z), V(0, 1, 0), V(0, 0, 1)),
    bounds: { min: V(x - radius * 1.5, y0, z - radius), max: V(x + radius * 1.5, y1, z + radius * 1.6) },
    meta: { side, radius, cluster: 3 },
  })
  for (const [yy, role] of [
    [y0, 'base'],
    [y1, 'capital'],
  ]) {
    const torus = new THREE.TorusGeometry(radius * 1.12, radius * 0.2, 8, 18)
    torus.rotateX(Math.PI / 2)
    torus.translate(x, yy, z)
    builder.addMesh(`${idPrefix}-${role}`, 'junction', torus)
    builder.addFeature({
      id: `${idPrefix}-${role}`,
      type: 'junction',
      label: `Column ${role} (${side})`,
      points: [V(x, yy, z)],
      localFrame: frameAt(V(x, yy, z), V(0, 1, 0), V(0, 0, 1)),
      meta: { side, role },
    })
  }
}

/** Stable tapered pinnacle (pyramid), not a random spike. */
export function addPinnacle(builder, { id, x, y0, z, height, base = 0.18 }) {
  const g = new THREE.ConeGeometry(base, height, 4)
  g.translate(x, y0 + height / 2, z)
  builder.addMesh(id, 'pinnacle', g)
  builder.addFeature({
    id,
    type: 'pinnacle',
    label: 'Pinnacle',
    points: [V(x, y0, z), V(x, y0 + height, z)],
    localFrame: frameAt(V(x, y0 + height * 0.5, z), V(0, 1, 0), V(0, 0, 1)),
    meta: { height, base },
  })
}

/** Wall slab with a pointed-arch hole. Returns opening 2D points (already offset). */
export function addPiercedWall(builder, { id, x0, x1, y0, y1, zBack, depth, opening, gablePeak = null }) {
  const shape = new THREE.Shape()
  shape.moveTo(x0, y0)
  shape.lineTo(x1, y0)
  shape.lineTo(x1, y1)
  if (gablePeak != null) {
    shape.lineTo((x0 + x1) / 2, gablePeak)
  }
  shape.lineTo(x0, y1)
  shape.closePath()

  if (opening) {
    const hole = new THREE.Path()
    opening.forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)))
    hole.closePath()
    shape.holes.push(hole)
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 })
  geo.translate(0, 0, zBack)
  builder.addMesh(id, 'wall', geo)
}
