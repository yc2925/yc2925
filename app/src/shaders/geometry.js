import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

function setScalarAttrs(geometry, growthFn, reliefFn) {
  const position = geometry.attributes.position
  const count = position.count
  const growth = new Float32Array(count)
  const relief = new Float32Array(count)
  const uv = geometry.attributes.uv

  for (let i = 0; i < count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const u = uv ? uv.getX(i) : 0
    const v = uv ? uv.getY(i) : 0
    growth[i] = growthFn(x, y, z, u, v)
    relief[i] = reliefFn(x, y, z, u, v)
  }

  geometry.setAttribute('aGrowth', new THREE.BufferAttribute(growth, 1))
  geometry.setAttribute('aRelief', new THREE.BufferAttribute(relief, 1))
  return geometry
}

function createPlane() {
  const geometry = new THREE.PlaneGeometry(2.4, 2.4, 72, 72)
  setScalarAttrs(
    geometry,
    (_x, _y, _z, u) => u,
    () => 0.08,
  )
  return geometry
}

function createSphere() {
  const geometry = new THREE.SphereGeometry(0.95, 64, 48)
  setScalarAttrs(
    geometry,
    (_x, y) => THREE.MathUtils.clamp((y + 0.95) / 1.9, 0, 1),
    (_x, _y, z) => THREE.MathUtils.clamp(z * 0.5 + 0.5, 0, 1),
  )
  return geometry
}

function createReliefPanel() {
  const geometry = new THREE.PlaneGeometry(2.2, 2.6, 96, 112)
  const position = geometry.attributes.position

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const nx = x / 1.1
    const ny = y / 1.3
    const edge = Math.max(Math.abs(nx), Math.abs(ny))
    const frame = THREE.MathUtils.smoothstep(edge, 0.72, 0.92)
    const inner =
      Math.sin(nx * 7.2) * Math.sin(ny * 9.4) * 0.11 +
      Math.sin(nx * 18.0 + ny * 14.0) * 0.035 +
      Math.sin((nx + ny) * 11.0) * 0.02
    const boss = Math.exp(-((nx * 1.1) ** 2 + ((ny + 0.15) * 1.3) ** 2) * 3.4) * 0.09
    const z = frame * 0.16 + (1 - frame) * (inner + boss)
    position.setZ(i, z)
  }

  geometry.computeVertexNormals()
  setScalarAttrs(
    geometry,
    (_x, _y, _z, u, v) => THREE.MathUtils.clamp(v * 0.72 + u * 0.28, 0, 1),
    (_x, _y, z) => THREE.MathUtils.clamp(z * 4.2 + 0.12, 0, 1),
  )
  return geometry
}

function cylinderAlong(origin, direction, length, radiusBottom, radiusTop, radial, growthStart, growthEnd) {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radial, 3)
  const position = geometry.attributes.position
  const growth = new Float32Array(position.count)
  const relief = new Float32Array(position.count)

  for (let i = 0; i < position.count; i += 1) {
    const t = THREE.MathUtils.clamp((position.getY(i) + length * 0.5) / length, 0, 1)
    growth[i] = growthStart + (growthEnd - growthStart) * t
    relief[i] = 0.28 + t * 0.55
  }

  geometry.setAttribute('aGrowth', new THREE.BufferAttribute(growth, 1))
  geometry.setAttribute('aRelief', new THREE.BufferAttribute(relief, 1))

  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  )
  const midpoint = origin.clone().add(direction.clone().normalize().multiplyScalar(length * 0.5))
  geometry.applyMatrix4(new THREE.Matrix4().compose(midpoint, quaternion, new THREE.Vector3(1, 1, 1)))
  return geometry
}

function leafAt(origin, normal, size, growth) {
  const geometry = new THREE.SphereGeometry(size, 16, 12)
  geometry.scale(1, 0.22, 1.55)
  const position = geometry.attributes.position
  const growthAttr = new Float32Array(position.count)
  const relief = new Float32Array(position.count)
  growthAttr.fill(growth)
  relief.fill(0.82)
  geometry.setAttribute('aGrowth', new THREE.BufferAttribute(growthAttr, 1))
  geometry.setAttribute('aRelief', new THREE.BufferAttribute(relief, 1))

  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normal.clone().normalize(),
  )
  geometry.applyMatrix4(new THREE.Matrix4().compose(origin, quaternion, new THREE.Vector3(1, 1, 1)))
  return geometry
}

function createVegetal() {
  const pieces = []

  const wall = new THREE.BoxGeometry(2.2, 2.7, 0.1, 1, 1, 1)
  wall.translate(0, 0, -0.14)
  setScalarAttrs(wall, () => 2, () => 0.04)
  pieces.push(wall)

  const up = new THREE.Vector3(0, 1, 0)
  const stemOrigin = new THREE.Vector3(0, -1.15, 0.02)
  pieces.push(cylinderAlong(stemOrigin, up, 2.05, 0.07, 0.045, 8, 0.02, 0.34))

  const branches = [
    { t: 0.28, yaw: 0.72, pitch: 0.18, length: 0.62, start: 0.32, end: 0.58 },
    { t: 0.28, yaw: -0.78, pitch: 0.12, length: 0.58, start: 0.33, end: 0.6 },
    { t: 0.52, yaw: 0.95, pitch: 0.22, length: 0.7, start: 0.48, end: 0.74 },
    { t: 0.52, yaw: -0.88, pitch: 0.16, length: 0.66, start: 0.5, end: 0.76 },
    { t: 0.74, yaw: 0.55, pitch: 0.32, length: 0.52, start: 0.68, end: 0.88 },
    { t: 0.74, yaw: -0.62, pitch: 0.28, length: 0.5, start: 0.7, end: 0.9 },
    { t: 0.9, yaw: 0.18, pitch: 0.42, length: 0.36, start: 0.84, end: 0.96 },
  ]

  for (const branch of branches) {
    const origin = stemOrigin.clone().add(up.clone().multiplyScalar(2.05 * branch.t))
    const direction = new THREE.Vector3(
      Math.sin(branch.yaw) * Math.cos(branch.pitch),
      Math.sin(branch.pitch) + 0.35,
      Math.cos(branch.yaw) * 0.45 + 0.35,
    ).normalize()
    pieces.push(
      cylinderAlong(origin, direction, branch.length, 0.038, 0.018, 6, branch.start, branch.end),
    )
    const tip = origin.clone().add(direction.clone().multiplyScalar(branch.length))
    pieces.push(leafAt(tip, direction, 0.11 + branch.length * 0.04, Math.min(1, branch.end + 0.08)))

    if (branch.length > 0.55) {
      const side = new THREE.Vector3(-direction.x, 0.4, 0.5).normalize()
      const forkOrigin = origin.clone().add(direction.clone().multiplyScalar(branch.length * 0.55))
      pieces.push(cylinderAlong(forkOrigin, side, 0.28, 0.02, 0.012, 5, branch.end - 0.06, branch.end + 0.08))
      pieces.push(
        leafAt(
          forkOrigin.clone().add(side.multiplyScalar(0.28)),
          side,
          0.09,
          Math.min(1, branch.end + 0.12),
        ),
      )
    }
  }

  const merged = mergeGeometries(pieces, false)
  if (!merged) {
    return wall
  }
  const growth = merged.getAttribute('aGrowth')
  const position = merged.getAttribute('position')
  if (growth && position) {
    for (let i = 0; i < position.count; i += 1) {
      if (position.getZ(i) < -0.06) growth.setX(i, 2)
    }
    growth.needsUpdate = true
  }
  merged.computeVertexNormals()
  return merged
}

const BUILDERS = {
  plane: createPlane,
  sphere: createSphere,
  relief: createReliefPanel,
  vegetal: createVegetal,
}

export function createTestGeometry(id) {
  return (BUILDERS[id] ?? createVegetal)()
}
