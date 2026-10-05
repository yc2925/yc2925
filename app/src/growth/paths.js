import * as THREE from 'three'
import { fbm3 } from '../shaders/noise3.js'
import { ANCHOR, mulberry32 } from './distribution.js'

/**
 * 02 Paths. Surface-following splines grown from PRIMARY anchors.
 *
 * Each step:
 *   1. combine three influences into a target direction (tangent to the surface)
 *        vertical growth   · world up, projected onto the surface
 *        feature attraction· along the nearest arch / rib / ledge, pulled onto it
 *        organic drift     · low-frequency noise vector
 *   2. turn towards it, then curl (Curvature) around the surface normal
 *   3. move one step, press slightly into the surface, snap to the closest surface point
 * The raw points are then interpolated with CatmullRomCurve3 and every dense
 * sample is projected onto the surface again, so the spline cannot cut corners.
 */

const STEP = 0.06
const WALK_OFFSET = 0.02
const SAMPLES_PER_STEP = 5
const FEATURE_REACH = 0.45
const TURN_RATE = 0.3
const UP = new THREE.Vector3(0, 1, 0)

export const PATH_RADIUS = { primary: 0.032, tip: 0.004, branchScale: 0.6, study: 0.02 }

function tangentOf(v, n) {
  return v.clone().addScaledVector(n, -v.dot(n))
}

function rotateAround(v, axis, angle) {
  const cross = new THREE.Vector3().crossVectors(axis, v)
  return v.clone().multiplyScalar(Math.cos(angle)).addScaledVector(cross, Math.sin(angle))
}

function createFeatureSegments(facade) {
  const segments = []
  for (const lines of Object.values(facade.features)) {
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i += 1) {
        const dir = line[i + 1].clone().sub(line[i])
        const length = dir.length()
        if (length > 1e-6) segments.push({ a: line[i], dir: dir.divideScalar(length), length })
      }
    }
  }
  return segments
}

function nearestFeature(p, segments) {
  let best = Infinity
  let bestSeg = null
  let bestT = 0
  const ap = new THREE.Vector3()
  for (const seg of segments) {
    ap.subVectors(p, seg.a)
    const t = Math.min(seg.length, Math.max(0, ap.dot(seg.dir)))
    const d = ap.addScaledVector(seg.dir, -t).lengthSq()
    if (d < best) {
      best = d
      bestSeg = seg
      bestT = t
    }
  }
  return {
    distance: Math.sqrt(best),
    point: bestSeg.a.clone().addScaledVector(bestSeg.dir, bestT),
    tangent: bestSeg.dir,
  }
}

function driftVector(p, seed) {
  const f = 0.8
  const x = p.x * f
  const y = p.y * f
  const z = p.z * f
  return new THREE.Vector3(
    fbm3(x + seed * 1.37, y, z, 2) - 0.5,
    fbm3(x + 31.4, y + seed * 0.91, z + 5.2, 2) - 0.5,
    fbm3(x - 12.7, y + 7.3, z + seed * 0.53, 2) - 0.5,
  ).multiplyScalar(4)
}

function outside(p, facade) {
  if (Math.abs(p.x) > 2.7 || p.y < 0.05 || p.y > facade.bounds.maxY + 0.2) return true
  // Deep points are only allowed inside the portal recess, never behind the wall.
  const inPortal = Math.abs(p.x) < facade.portal.halfWidth + 0.1 && p.y < facade.portal.apex + 0.1
  return p.z < -0.35 && !inPortal
}

function growPath(ctx, start, normal, startDir, length, influence, spin) {
  const { surface, segments, facade, seed } = ctx
  const points = [start.clone()]
  const normals = [normal.clone()]
  let p = start.clone()
  let n = normal.clone()
  let dir = tangentOf(startDir, n).normalize()
  const steps = Math.max(3, Math.round(length / STEP))
  let stuck = 0

  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps

    const vertical = tangentOf(UP, n)

    const near = nearestFeature(p, segments)
    const along = tangentOf(near.tangent, n).normalize()
    if (along.dot(dir) < 0) along.negate()
    const onto = tangentOf(near.point.clone().sub(p), n).normalize()
    const feature = along
      .multiplyScalar(0.75)
      .addScaledVector(onto, 0.4 * Math.min(1, near.distance / 0.15))
      .multiplyScalar(Math.exp(-((near.distance / FEATURE_REACH) ** 2)))

    const drift = tangentOf(driftVector(p, seed), n)

    const target = dir
      .clone()
      .addScaledVector(vertical, influence.vertical)
      .addScaledVector(feature, influence.feature * 1.6)
      .addScaledVector(drift, influence.drift)
      .normalize()
    dir = tangentOf(dir.lerp(target, TURN_RATE), n).normalize()

    // Steady curl that tightens towards the tip, like a tendril.
    dir = rotateAround(dir, n, influence.curvature * 0.16 * spin * (0.35 + 1.5 * t * t))

    const probe = p.clone().addScaledVector(dir, STEP).addScaledVector(n, -STEP * 0.5)
    const hit = surface.project(probe)
    if (!hit || hit.distance > STEP * 2.5) break
    const next = hit.point.clone().addScaledVector(hit.normal, WALK_OFFSET)
    if (outside(next, facade)) break

    const travel = tangentOf(next.clone().sub(p), hit.normal)
    if (travel.length() < STEP * 0.25) {
      stuck += 1
      if (stuck > 2) break
    } else {
      stuck = 0
      dir = travel.normalize()
    }
    p = next
    n = hit.normal
    points.push(p.clone())
    normals.push(n.clone())
  }

  return { points, normals }
}

/** Raw walk → CatmullRom → dense samples re-projected onto the surface. */
function finalize(surface, rawPoints) {
  if (rawPoints.length < 2) return null
  const curve = new THREE.CatmullRomCurve3(rawPoints, false, 'centripetal')
  const count = Math.max(12, (rawPoints.length - 1) * SAMPLES_PER_STEP)
  const samples = curve.getSpacedPoints(count)
  const points = []
  const normals = []
  let lastNormal = new THREE.Vector3(0, 0, 1)
  for (const s of samples) {
    const hit = surface.project(s)
    if (hit && hit.distance < 0.25) {
      points.push(hit.point)
      normals.push(hit.normal)
      lastNormal = hit.normal
    } else {
      points.push(s.clone().addScaledVector(lastNormal, -WALK_OFFSET))
      normals.push(lastNormal.clone())
    }
  }

  // Smooth normals so frames do not flip at sharp architectural edges.
  for (let pass = 0; pass < 3; pass += 1) {
    const copy = normals.map((v) => v.clone())
    for (let i = 1; i < normals.length - 1; i += 1) {
      normals[i].copy(copy[i - 1]).add(copy[i]).add(copy[i]).add(copy[i + 1]).normalize()
    }
  }

  const tangents = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    return b.clone().sub(a).normalize()
  })
  let length = 0
  for (let i = 1; i < points.length; i += 1) length += points[i].distanceTo(points[i - 1])
  return { points, normals, tangents, length }
}

export function createPathContext(facade, surface) {
  return { facade, surface, segments: createFeatureSegments(facade) }
}

/** PRIMARY anchors from Assignment 1, most suitable first. */
export function primaryAnchors(candidates, selection, suitability) {
  const list = []
  for (let i = 0; i < candidates.count; i += 1) {
    if (selection.classes[i] === ANCHOR.PRIMARY) list.push(i)
  }
  return list.sort((a, b) => suitability[b] - suitability[a])
}

export function growPaths(context, candidates, anchors, params) {
  const ctx = { ...context, seed: params.seed }
  const rand = mulberry32(params.seed * 6151 + 29)
  const influence = {
    vertical: params.verticalGrowth,
    feature: params.pathFeature,
    drift: params.organicDrift,
    curvature: params.curvature,
  }
  const used = anchors.slice(0, params.pathCount)
  const paths = []

  for (const index of used) {
    const start = new THREE.Vector3().fromArray(candidates.positions, index * 3)
    const normal = new THREE.Vector3().fromArray(candidates.normals, index * 3)
    start.addScaledVector(normal, WALK_OFFSET)

    let startDir = tangentOf(UP, normal)
    if (startDir.length() < 0.2) startDir = tangentOf(new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5), normal)
    startDir = rotateAround(startDir.normalize(), normal, (rand() - 0.5) * 1.2)
    const spin = rand() < 0.5 ? -1 : 1
    const length = params.pathLength * (0.75 + 0.5 * rand())

    const raw = growPath(ctx, start, normal, startDir, length, influence, spin)
    const primary = finalize(ctx.surface, raw.points)
    if (!primary) continue
    paths.push({ kind: 'primary', anchor: index, ...primary, r0: PATH_RADIUS.primary, r1: PATH_RADIUS.tip })

    // 0–2 secondary paths departing on alternate sides.
    let side = rand() < 0.5 ? -1 : 1
    for (let k = 0; k < 2; k += 1) {
      if (rand() >= params.branchProbability) continue
      const at = Math.floor(raw.points.length * (0.3 + 0.4 * rand()))
      if (at < 1 || at >= raw.points.length - 2) continue
      const p = raw.points[at]
      const n = raw.normals[at]
      const parentDir = raw.points[at + 1].clone().sub(raw.points[at - 1]).normalize()
      const branchDir = rotateAround(tangentOf(parentDir, n).normalize(), n, side * 0.5)
      const branchLength = params.pathLength * (0.3 + 0.25 * rand())
      const branchRaw = growPath(
        ctx,
        p,
        n,
        branchDir,
        branchLength,
        { ...influence, vertical: influence.vertical * 0.6 },
        side,
      )
      // Prefix the parent's previous point so the spline leaves the parent tangentially.
      const branch = finalize(ctx.surface, [raw.points[at - 1], ...branchRaw.points])
      if (branch) {
        const tParent = at / Math.max(1, raw.points.length - 1)
        const parentRadius = PATH_RADIUS.primary + (PATH_RADIUS.tip - PATH_RADIUS.primary) * tParent ** 0.8
        paths.push({
          kind: 'secondary',
          anchor: index,
          ...branch,
          r0: parentRadius * PATH_RADIUS.branchScale,
          r1: PATH_RADIUS.tip * 0.75,
        })
      }
      side = -side
    }
  }

  return { paths, used }
}

/**
 * 2D → 3D study. A running scroll (looping trochoid) drawn in a plane parallel
 * to the facade, projected along the plane normal (−Z) onto the architecture.
 */
export const PROJECTION_PLANE = { z: 1.6, x0: -1.95, x1: 1.95, yCenter: 2.15, loop: 0.3, turns: 4 }

export function projectionStudy(surface) {
  const { z, x0, x1, yCenter, loop, turns } = PROJECTION_PLANE
  const samples = 420
  const sweep = turns * Math.PI * 2
  const c = (x1 - x0) / sweep
  const source = []
  for (let i = 0; i <= samples; i += 1) {
    const s = i / samples
    const theta = s * sweep
    const d = loop * Math.sqrt(Math.sin(Math.PI * s))
    source.push(new THREE.Vector3(x0 + c * theta - d * Math.sin(theta), yCenter + d * Math.cos(theta), z))
  }

  const direction = new THREE.Vector3(0, 0, -1)
  const runs = []
  const rays = []
  let run = []
  source.forEach((point, i) => {
    const hit = surface.raycast(point, direction)
    if (!hit) {
      if (run.length > 3) runs.push(run)
      run = []
      return
    }
    run.push(hit.point.addScaledVector(hit.normal, WALK_OFFSET))
    if (i % 14 === 0) rays.push([point, hit.point])
  })
  if (run.length > 3) runs.push(run)

  const projected = runs
    .map((points) => finalize(surface, points))
    .filter(Boolean)
    .map((path) => ({ kind: 'study', ...path, r0: PATH_RADIUS.study, r1: PATH_RADIUS.study }))

  const pad = loop + 0.25
  const frame = [
    new THREE.Vector3(x0 - pad, yCenter - pad, z),
    new THREE.Vector3(x1 + pad, yCenter - pad, z),
    new THREE.Vector3(x1 + pad, yCenter + pad, z),
    new THREE.Vector3(x0 - pad, yCenter + pad, z),
  ]
  return { source, rays, projected, frame }
}

function radiusAt(path, t) {
  if (path.kind === 'study') return path.r0 * Math.min(1, t / 0.03, (1 - t) / 0.03 + 0.3)
  return path.r0 + (path.r1 - path.r0) * t ** 0.8
}

/**
 * Sweeps a profile along each path using the surface normal as the frame
 * (no Frenet twisting).
 *   round  tapered tube resting on the surface (the spline itself)
 *   relief half-ellipse rising out of the surface (spline → architectural relief)
 */
export function sweepPaths(paths, { profile, offset = 0, width = 0, colors = {} }) {
  const radial = profile === 'relief' ? 10 : 8
  const ringSize = radial + 1
  const positions = []
  const normals = []
  const vertexColors = []
  const indices = []
  const b = new THREE.Vector3()
  const nn = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const center = new THREE.Vector3()
  const normal = new THREE.Vector3()
  let base = 0

  for (const path of paths) {
    const count = path.points.length
    const color = colors[path.kind] ?? [1, 1, 1]
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1)
      const T = path.tangents[i]
      b.crossVectors(T, path.normals[i]).normalize()
      nn.crossVectors(b, T).normalize()
      let rx
      let ry
      if (profile === 'relief') {
        const taper = (path.r0 > 0 ? radiusAt(path, t) / path.r0 : 1) * Math.min(1, t / 0.05 + 0.15)
        rx = width * taper * (path.kind === 'secondary' ? 0.65 : 1)
        ry = rx * 0.45
        center.copy(path.points[i])
      } else {
        rx = radiusAt(path, t)
        ry = rx
        center.copy(path.points[i]).addScaledVector(nn, offset + rx)
      }
      for (let k = 0; k <= radial; k += 1) {
        const a = profile === 'relief' ? -Math.PI / 2 + (k / radial) * Math.PI : (k / radial) * Math.PI * 2
        dir.copy(nn).multiplyScalar(Math.cos(a) * ry).addScaledVector(b, Math.sin(a) * rx)
        positions.push(center.x + dir.x, center.y + dir.y, center.z + dir.z)
        normal
          .copy(nn)
          .multiplyScalar(Math.cos(a) / Math.max(ry, 1e-5))
          .addScaledVector(b, Math.sin(a) / Math.max(rx, 1e-5))
          .normalize()
        normals.push(normal.x, normal.y, normal.z)
        vertexColors.push(color[0], color[1], color[2])
      }
    }
    for (let i = 0; i < count - 1; i += 1) {
      for (let k = 0; k < radial; k += 1) {
        const a = base + i * ringSize + k
        const c = a + ringSize
        indices.push(a, a + 1, c, a + 1, c + 1, c)
      }
    }
    base += count * ringSize
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3))
  geometry.setIndex(indices)
  return geometry
}
