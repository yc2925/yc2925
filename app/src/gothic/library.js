import * as THREE from 'three'
import {
  V,
  boxGeometry,
  frameAt,
  makeFeature,
  normalizeGeometry,
  pointedArchHalf,
  pointedArchOutline,
} from './primitives.js'

/**
 * High-quality Gothic geometry library.
 *
 * Curve-driven sweeps with custom molding profiles replace uniform tubes.
 * Detail Resolution controls tessellation only; Structural / Tracery /
 * Molding Layers control architectural hierarchy.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const lerp = (a, b, t) => a + (b - a) * t

/** Map detail params → tessellation budgets (with hard caps). */
export function resolveDetail(params = {}) {
  const res = clamp01(params.detailResolution ?? 0.55)
  const structural = clamp01(params.structuralComplexity ?? params.structuralDensity ?? 0.55)
  const tracery = clamp01(params.traceryComplexity ?? params.ornamentDensity ?? 0.55)
  const moldLayers = Math.max(1, Math.min(5, Math.round(params.moldingLayers ?? lerp(1, 4, params.ornamentDensity ?? 0.5))))
  return {
    res,
    structural,
    tracery,
    moldLayers,
    archSteps: Math.round(lerp(14, 40, res)),
    sweepSegs: Math.round(lerp(28, 72, res)),
    radial: Math.round(lerp(6, 14, res)),
    columnRadial: Math.round(lerp(10, 24, res)),
    foilSegs: Math.round(lerp(16, 36, res)),
  }
}

// ─── Profiles (2D cross-sections in the sweep frame: x = binormal, y = normal) ───

/** Roll / torus molding — rounded bead. */
export function profileRoll(scale = 0.05) {
  const pts = []
  const n = 10
  for (let i = 0; i <= n; i += 1) {
    const a = Math.PI + (i / n) * Math.PI
    pts.push(new THREE.Vector2(Math.cos(a) * scale, Math.sin(a) * scale * 0.85 + scale * 0.15))
  }
  return pts
}

/** Fillet + scotia — stepped Gothic archivolt section. */
export function profileArchivolt(scale = 0.05) {
  const s = scale
  return [
    new THREE.Vector2(-s * 1.1, -s * 0.2),
    new THREE.Vector2(-s * 0.9, 0),
    new THREE.Vector2(-s * 0.35, s * 0.15),
    new THREE.Vector2(0, s * 0.55),
    new THREE.Vector2(s * 0.35, s * 0.15),
    new THREE.Vector2(s * 0.9, 0),
    new THREE.Vector2(s * 1.1, -s * 0.2),
    new THREE.Vector2(s * 0.4, -s * 0.55),
    new THREE.Vector2(-s * 0.4, -s * 0.55),
  ]
}

/** Rectangular mullion / bar section with slight chamfer. */
export function profileMullion(w = 0.03, d = 0.05) {
  const c = Math.min(w, d) * 0.2
  return [
    new THREE.Vector2(-w, -d + c),
    new THREE.Vector2(-w + c, -d),
    new THREE.Vector2(w - c, -d),
    new THREE.Vector2(w, -d + c),
    new THREE.Vector2(w, d - c),
    new THREE.Vector2(w - c, d),
    new THREE.Vector2(-w + c, d),
    new THREE.Vector2(-w, d - c),
  ]
}

/** Keel / pointed molding for hoods. */
export function profileKeel(scale = 0.04) {
  const s = scale
  return [
    new THREE.Vector2(-s, -s * 0.3),
    new THREE.Vector2(-s * 0.4, s * 0.2),
    new THREE.Vector2(0, s * 0.85),
    new THREE.Vector2(s * 0.4, s * 0.2),
    new THREE.Vector2(s, -s * 0.3),
    new THREE.Vector2(s * 0.3, -s * 0.7),
    new THREE.Vector2(-s * 0.3, -s * 0.7),
  ]
}

// ─── Sweep engine ───

/**
 * Sweep a closed 2D profile along a Curve3.
 * Uses parallel transport to avoid twisting on pointed arches.
 */
export function sweepProfile(curve, profile, tubularSegments = 48, closed = false) {
  const segs = Math.max(8, tubularSegments)
  const ring = profile.length
  const positions = []
  const normals = []
  const indices = []

  const tangents = []
  const normalsF = []
  const binormals = []

  let prevT = new THREE.Vector3()
  let N = new THREE.Vector3()
  let B = new THREE.Vector3()

  const ringCount = closed ? segs : segs + 1
  for (let i = 0; i < ringCount; i += 1) {
    const u = i / segs
    const t = closed ? u % 1 : Math.min(1, u)
    const T = (curve.getTangentAt ? curve.getTangentAt(t) : curve.getTangent(t)).normalize()
    if (i === 0) {
      N.set(0, 1, 0).cross(T)
      if (N.lengthSq() < 1e-8) N.set(0, 0, 1).cross(T)
      N.normalize()
      B.crossVectors(T, N).normalize()
    } else {
      const axis = new THREE.Vector3().crossVectors(prevT, T)
      const sin = axis.length()
      if (sin > 1e-8) {
        axis.multiplyScalar(1 / sin)
        const cos = THREE.MathUtils.clamp(prevT.dot(T), -1, 1)
        const q = new THREE.Quaternion().setFromAxisAngle(axis, Math.acos(cos))
        N.applyQuaternion(q)
        B.applyQuaternion(q)
      }
      B.crossVectors(T, N).normalize()
      N.crossVectors(B, T).normalize()
    }
    tangents.push(T.clone())
    normalsF.push(N.clone())
    binormals.push(B.clone())
    prevT.copy(T)
  }

  for (let i = 0; i < ringCount; i += 1) {
    const u = i / segs
    const t = closed ? u % 1 : Math.min(0.9999, u)
    const P = curve.getPointAt ? curve.getPointAt(t) : curve.getPoint(t)
    const Nf = normalsF[i]
    const Bf = binormals[i]
    for (let j = 0; j < ring; j += 1) {
      const pr = profile[j]
      positions.push(P.x + Bf.x * pr.x + Nf.x * pr.y, P.y + Bf.y * pr.x + Nf.y * pr.y, P.z + Bf.z * pr.x + Nf.z * pr.y)
      const nx = Bf.x * pr.x + Nf.x * pr.y
      const ny = Bf.y * pr.x + Nf.y * pr.y
      const nz = Bf.z * pr.x + Nf.z * pr.y
      const len = Math.hypot(nx, ny, nz) || 1
      normals.push(nx / len, ny / len, nz / len)
    }
  }

  const quadRings = closed ? segs : segs
  for (let i = 0; i < quadRings; i += 1) {
    const i0 = i
    const i1 = closed ? (i + 1) % segs : i + 1
    for (let j = 0; j < ring; j += 1) {
      const j2 = (j + 1) % ring
      const a = i0 * ring + j
      const b = i0 * ring + j2
      const c = i1 * ring + j
      const d = i1 * ring + j2
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Catmull-Rom through world points → Curve3. */
export function curveThrough(points, closed = false) {
  return new THREE.CatmullRomCurve3(points, closed, 'centripetal')
}

/** Pointed arch as Curve3 (left foot → apex → right foot), with profile sharpness. */
export function pointedArchCurve(half, foot, spring, apex, steps = 24, offsetX = 0, z = 0) {
  const outline = pointedArchOutline(half, foot, spring, apex, steps).map(([x, y]) => V(x + offsetX, y, z))
  return curveThrough(outline, false)
}

/** Crown only (left spring → apex → right spring). */
export function pointedArchCrownCurve(half, spring, apex, steps = 24, offsetX = 0, z = 0) {
  const left = pointedArchHalf(half, spring, apex, steps, -1).map(([x, y]) => V(x + offsetX, y, z))
  const right = pointedArchHalf(half, spring, apex, steps, 1)
    .map(([x, y]) => V(x + offsetX, y, z))
    .reverse()
  return curveThrough([...left, ...right.slice(1)], false)
}

// ─── Primitive builders (return { geometry, curve?, points? }) ───

export function createArchivolt({ half, foot, spring, apex, offsetX = 0, z = 0, scale = 0.05, detail, profile = 'archivolt' }) {
  const curve = pointedArchCurve(half, foot, spring, apex, detail.archSteps, offsetX, z)
  const prof = profile === 'keel' ? profileKeel(scale) : profile === 'roll' ? profileRoll(scale) : profileArchivolt(scale)
  const geometry = sweepProfile(curve, prof, detail.sweepSegs, false)
  const points = pointedArchOutline(half, foot, spring, apex, detail.archSteps).map(([x, y]) => V(x + offsetX, y, z))
  return { geometry: normalizeGeometry(geometry), curve, points }
}

export function createHoodMould({ half, spring, apex, offsetX = 0, z = 0.04, scale = 0.04, detail }) {
  const crown = pointedArchCrownCurve(half, spring, apex + 0.12, detail.archSteps, offsetX, z)
  const geometry = sweepProfile(crown, profileKeel(scale), detail.sweepSegs, false)
  const points = [
    ...pointedArchHalf(half, spring, apex + 0.12, detail.archSteps, -1).map(([x, y]) => V(x + offsetX, y, z)),
    ...pointedArchHalf(half, spring, apex + 0.12, detail.archSteps, 1)
      .map(([x, y]) => V(x + offsetX, y, z))
      .reverse(),
  ]
  return { geometry: normalizeGeometry(geometry), curve: crown, points }
}

/**
 * Clustered column: core + attached shafts, torus base/capital with molded necks.
 */
export function createClusteredColumn({ x, z, y0, y1, radius, shafts = 3, detail, side = 'left' }) {
  const meshes = []
  const features = []
  const h = y1 - y0
  const radial = detail.columnRadial
  const count = Math.max(1, Math.min(5, shafts))

  // Core shaft — slight entasis (wider at base).
  const core = new THREE.CylinderGeometry(radius * 0.92, radius, h, radial, 1, true)
  core.translate(x, (y0 + y1) / 2, z)
  meshes.push({ idSuffix: 'core', type: 'column', geometry: normalizeGeometry(core) })

  for (let i = 0; i < count - 1; i += 1) {
    const a = (i / Math.max(1, count - 1)) * Math.PI * 0.9 - Math.PI * 0.45
    const sr = radius * 0.48
    const dx = Math.sin(a) * radius * 0.95
    const dz = Math.cos(a) * radius * 0.55
    const shaft = new THREE.CylinderGeometry(sr * 0.95, sr, h * 0.98, Math.max(8, radial - 4), 1, true)
    shaft.translate(x + dx, (y0 + y1) / 2, z + dz)
    meshes.push({ idSuffix: `shaft-${i}`, type: 'column', geometry: normalizeGeometry(shaft) })
  }

  // Base & capital — stacked torus moldings (not a single fat ring).
  for (const [yy, role, scales] of [
    [y0, 'base', [1.35, 1.15, 1.0]],
    [y1, 'capital', [1.0, 1.2, 1.35]],
  ]) {
    scales.forEach((sc, mi) => {
      const tube = radius * (0.1 + mi * 0.04)
      const torus = new THREE.TorusGeometry(radius * sc, tube, Math.max(6, Math.floor(radial / 2)), radial)
      torus.rotateX(Math.PI / 2)
      const yOff = role === 'base' ? mi * tube * 1.1 : -mi * tube * 1.1
      torus.translate(x, yy + yOff, z)
      meshes.push({ idSuffix: `${role}-${mi}`, type: 'junction', geometry: normalizeGeometry(torus) })
    })
    features.push(
      makeFeature({
        id: `${side}-${role}`,
        type: 'junction',
        label: `Column ${role} (${side})`,
        points: [V(x, yy, z)],
        localFrame: frameAt(V(x, yy, z), V(0, 1, 0), V(0, 0, 1)),
        meta: { side, role },
      }),
    )
  }

  features.push(
    makeFeature({
      id: `${side}-column`,
      type: 'column',
      label: `Clustered column (${side})`,
      points: [V(x, y0, z), V(x, y1, z)],
      localFrame: frameAt(V(x, (y0 + y1) / 2, z), V(0, 1, 0), V(0, 0, 1)),
      bounds: { min: V(x - radius * 1.6, y0, z - radius), max: V(x + radius * 1.6, y1, z + radius * 1.5) },
      meta: { side, radius, cluster: count },
    }),
  )

  return { meshes, features }
}

/** Straight mullion with rectangular profile. */
export function createMullion({ a, b, width = 0.028, depth = 0.045, detail }) {
  const points = [a.clone(), b.clone()]
  const curve = curveThrough(points, false)
  const geometry = sweepProfile(curve, profileMullion(width, depth), Math.max(4, Math.floor(detail.sweepSegs / 8)), false)
  return { geometry: normalizeGeometry(geometry), curve, points }
}

/** Trefoil: three overlapping cusped lobes as swept rings. */
export function createTrefoil({ cx, cy, cz, radius, scale = 0.018, detail }) {
  const meshes = []
  const points = []
  const lobeR = radius * 0.55
  const centres = [
    [0, lobeR * 0.55],
    [-lobeR * 0.55, -lobeR * 0.35],
    [lobeR * 0.55, -lobeR * 0.35],
  ]
  centres.forEach(([dx, dy], i) => {
    const ring = []
    for (let k = 0; k <= detail.foilSegs; k += 1) {
      const a = (k / detail.foilSegs) * Math.PI * 2
      ring.push(V(cx + dx + Math.cos(a) * lobeR, cy + dy + Math.sin(a) * lobeR, cz))
    }
    const curve = curveThrough(ring, true)
    const geo = sweepProfile(curve, profileRoll(scale), detail.foilSegs, true)
    meshes.push({ idSuffix: `lobe-${i}`, geometry: normalizeGeometry(geo) })
    points.push(...ring)
  })
  return { meshes, points }
}

/** Quatrefoil: four lobes around a centre. */
export function createQuatrefoil({ cx, cy, cz, radius, scale = 0.016, detail }) {
  const meshes = []
  const points = []
  const lobeR = radius * 0.48
  for (let i = 0; i < 4; i += 1) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4
    const dx = Math.cos(ang) * lobeR * 0.7
    const dy = Math.sin(ang) * lobeR * 0.7
    const ring = []
    for (let k = 0; k <= detail.foilSegs; k += 1) {
      const a = (k / detail.foilSegs) * Math.PI * 2
      ring.push(V(cx + dx + Math.cos(a) * lobeR * 0.85, cy + dy + Math.sin(a) * lobeR * 0.85, cz))
    }
    const curve = curveThrough(ring, true)
    const geo = sweepProfile(curve, profileRoll(scale), detail.foilSegs, true)
    meshes.push({ idSuffix: `lobe-${i}`, geometry: normalizeGeometry(geo) })
    points.push(...ring)
  }
  return { meshes, points }
}

/**
 * Cusped arch: pointed arch with inward cusp notches along the intrados.
 * Built as a swept keel along a modified crown polyline.
 */
export function createCuspedArch({ half, spring, apex, offsetX = 0, z = 0, cusps = 3, scale = 0.03, detail }) {
  const steps = detail.archSteps
  const left = pointedArchHalf(half, spring, apex, steps, -1)
  const right = pointedArchHalf(half, spring, apex, steps, 1).reverse()
  const raw = [...left, ...right.slice(1)]
  // Pull alternate samples inward toward the opening centre for cusps.
  const cusped = raw.map(([x, y], i) => {
    const t = i / (raw.length - 1)
    const cuspWave = Math.abs(Math.sin(t * Math.PI * cusps))
    const pull = cuspWave * half * 0.08
    const nx = x === 0 ? 0 : -Math.sign(x)
    return V(x + offsetX + nx * pull, y, z)
  })
  const curve = curveThrough(cusped, false)
  const geometry = sweepProfile(curve, profileKeel(scale), detail.sweepSegs, false)
  return { geometry: normalizeGeometry(geometry), curve, points: cusped }
}

/**
 * Stepped buttress: stacked boxes with setbacks + molded cap.
 */
export function createButtress({ x0, x1, y0, y1, zBack, zFront, steps = 3, detail }) {
  const meshes = []
  const n = Math.max(2, Math.min(5, steps))
  const depth = zFront - zBack
  for (let i = 0; i < n; i += 1) {
    const t0 = i / n
    const t1 = (i + 1) / n
    const yy0 = lerp(y0, y1, t0)
    const yy1 = lerp(y0, y1, t1)
    const inset = i * 0.04
    const zF = zFront - i * depth * 0.12
    const g = boxGeometry(x0 + inset, x1 - inset, yy0, yy1, zBack, zF)
    meshes.push({ idSuffix: `step-${i}`, type: 'buttress', geometry: normalizeGeometry(g) })
  }
  // Cap molding as a short horizontal sweep.
  const mid = (x0 + x1) / 2
  const capY = y1
  const capPts = [V(x0 + 0.02, capY, zFront * 0.7), V(mid, capY, zFront * 0.85), V(x1 - 0.02, capY, zFront * 0.7)]
  const curve = curveThrough(capPts, false)
  const cap = sweepProfile(curve, profileRoll(0.035 + detail.res * 0.02), 12, false)
  meshes.push({ idSuffix: 'cap', type: 'buttress', geometry: normalizeGeometry(cap) })
  return {
    meshes,
    feature: makeFeature({
      id: 'buttress',
      type: 'buttress',
      label: 'Buttress',
      points: [V(mid, y0, zFront), V(mid, y1, zFront)],
      localFrame: frameAt(V(mid, (y0 + y1) / 2, zFront), V(0, 1, 0), V(0, 0, 1)),
      meta: { steps: n },
    }),
  }
}

/**
 * Pinnacle: square tapered body, molded neck, pyramidal finial, optional crockets.
 */
export function createPinnacle({ x, y0, z, height, base = 0.16, crockets = false, detail }) {
  const meshes = []
  const bodyH = height * 0.62
  const neckH = height * 0.12
  const finialH = height * 0.26

  // Square taper via extruded shrinking boxes (2 stages).
  const g1 = boxGeometry(x - base, x + base, y0, y0 + bodyH * 0.55, z - base, z + base)
  const g2 = boxGeometry(x - base * 0.7, x + base * 0.7, y0 + bodyH * 0.5, y0 + bodyH, z - base * 0.7, z + base * 0.7)
  meshes.push({ idSuffix: 'body-a', geometry: normalizeGeometry(g1) })
  meshes.push({ idSuffix: 'body-b', geometry: normalizeGeometry(g2) })

  // Neck roll.
  const neck = new THREE.TorusGeometry(base * 0.55, base * 0.12, 6, detail.columnRadial)
  neck.rotateX(Math.PI / 2)
  neck.translate(x, y0 + bodyH + neckH * 0.3, z)
  meshes.push({ idSuffix: 'neck', geometry: normalizeGeometry(neck) })

  // Finial — steep pyramid.
  const finial = new THREE.ConeGeometry(base * 0.45, finialH, 4)
  finial.translate(x, y0 + bodyH + neckH + finialH / 2, z)
  meshes.push({ idSuffix: 'finial', geometry: normalizeGeometry(finial) })

  if (crockets && detail.tracery > 0.35) {
    const count = Math.round(lerp(3, 7, detail.tracery))
    const crookGeos = []
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count
      const yy = y0 + bodyH * t
      const side = i % 2 === 0 ? 1 : -1
      const tip = V(x + side * base * 1.1, yy + 0.08, z)
      const root = V(x + side * base * 0.5, yy, z)
      const mid = V(x + side * base * 0.9, yy + 0.1, z + 0.02)
      const curve = curveThrough([root, mid, tip], false)
      crookGeos.push(sweepProfile(curve, profileRoll(0.012), 8, false))
    }
    // Merge crockets into one mesh.
    const merged = mergeGeometries(crookGeos)
    if (merged) meshes.push({ idSuffix: 'crockets', geometry: normalizeGeometry(merged) })
    crookGeos.forEach((g) => g.dispose())
  }

  return {
    meshes,
    feature: makeFeature({
      id: 'pinnacle',
      type: 'pinnacle',
      label: 'Pinnacle',
      points: [V(x, y0, z), V(x, y0 + height, z)],
      localFrame: frameAt(V(x, y0 + height * 0.5, z), V(0, 1, 0), V(0, 0, 1)),
      meta: { height, base, crockets },
    }),
  }
}

function mergeGeometries(geos) {
  if (!geos.length) return null
  let offset = 0
  const positions = []
  const normals = []
  const indices = []
  for (const g of geos) {
    const pos = g.attributes.position
    const nor = g.attributes.normal
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      if (nor) normals.push(nor.getX(i), nor.getY(i), nor.getZ(i))
      else normals.push(0, 1, 0)
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i += 1) indices.push(g.index.getX(i) + offset)
    } else {
      for (let i = 0; i < pos.count; i += 1) indices.push(offset + i)
    }
    offset += pos.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  out.setIndex(indices)
  out.computeVertexNormals()
  return out
}

/** Helper: attach library mesh parts onto a typology builder. */
export function addLibraryMeshes(builder, idPrefix, type, parts) {
  for (const part of parts) {
    builder.addMesh(`${idPrefix}-${part.idSuffix}`, part.type ?? type, part.geometry)
  }
}

export { pointedArchOutline, pointedArchHalf, boxGeometry, V, frameAt, makeFeature }
