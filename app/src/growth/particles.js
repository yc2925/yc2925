import { ANCHOR, mulberry32 } from './distribution.js'
import { fieldForce } from './field.js'

/**
 * Growth tracers. All state lives in typed arrays; one step updates every
 * particle without allocating.
 *
 * Trails: each particle owns `trailLength` consecutive slots in one
 * Float32Array, newest first. Every frame the whole buffer is shifted by one
 * slot with a single copyWithin, then each particle writes its new head
 * (overwriting what spilled in from the previous particle).
 */

const SPAWN_LIFT = 0.04
const SPAWN_JITTER = 0.035
const MAX_SURFACE_DISTANCE = 0.55
const STEER = 5

/** PRIMARY and SECONDARY anchors from 01, PRIMARY weighted ×3. */
export function createEmitters(candidates, classes) {
  const list = []
  for (let i = 0; i < candidates.count; i += 1) {
    if (classes[i] === ANCHOR.PRIMARY) list.push([i, 3])
    else if (classes[i] === ANCHOR.SECONDARY) list.push([i, 1])
  }
  const count = list.length
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const cumulative = new Float32Array(count)
  const primary = new Uint8Array(count)
  let total = 0
  list.forEach(([index, weight], k) => {
    positions.set(candidates.positions.subarray(index * 3, index * 3 + 3), k * 3)
    normals.set(candidates.normals.subarray(index * 3, index * 3 + 3), k * 3)
    primary[k] = weight === 3 ? 1 : 0
    total += weight
    cumulative[k] = total
  })
  const primaryCount = primary.reduce((sum, v) => sum + v, 0)
  return { count, positions, normals, cumulative, total, primary, primaryCount }
}

export function createParticles(count, trailLength, seed) {
  return {
    count,
    trailLength,
    rand: mulberry32(seed * 2654435 + 101),
    position: new Float32Array(count * 3),
    velocity: new Float32Array(count * 3),
    age: new Float32Array(count),
    life: new Float32Array(count),
    fresh: new Uint8Array(count),
    trail: new Float32Array(count * trailLength * 3),
    resets: 0,
  }
}

function pickEmitter(emitters, r) {
  const target = r * emitters.total
  let lo = 0
  let hi = emitters.count - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (emitters.cumulative[mid] < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

function respawn(system, emitters, i) {
  const { rand, position, velocity } = system
  const e = pickEmitter(emitters, rand()) * 3
  const o = i * 3
  position[o] = emitters.positions[e] + emitters.normals[e] * SPAWN_LIFT + (rand() - 0.5) * SPAWN_JITTER
  position[o + 1] = emitters.positions[e + 1] + emitters.normals[e + 1] * SPAWN_LIFT + (rand() - 0.5) * SPAWN_JITTER
  position[o + 2] = emitters.positions[e + 2] + emitters.normals[e + 2] * SPAWN_LIFT + (rand() - 0.5) * SPAWN_JITTER
  velocity[o] = 0
  velocity[o + 1] = 0
  velocity[o + 2] = 0
  system.age[i] = 0
  system.life[i] = 2.5 + 4 * rand()
  system.fresh[i] = 1
  system.resets += 1
}

/** Spawn everyone, with staggered ages so the field fills in immediately. */
export function seedParticles(system, emitters) {
  if (!emitters.count) return
  for (let i = 0; i < system.count; i += 1) {
    respawn(system, emitters, i)
    system.age[i] = system.rand() * system.life[i] * 0.6
  }
  writeTrails(system)
}

const force = new Float32Array(4)

export function stepParticles(system, cache, emitters, params, dt) {
  if (!emitters.count) return
  const { count, position, velocity, age, life } = system
  const speed = params.speed
  const steer = Math.min(1, dt * STEER)
  const forces = params.forces

  for (let i = 0; i < count; i += 1) {
    const o = i * 3
    const x = position[o]
    const y = position[o + 1]
    const z = position[o + 2]
    let vx = velocity[o]
    let vy = velocity[o + 1]
    let vz = velocity[o + 2]

    const valid = fieldForce(cache, x, y, z, vx, vy + 1e-3, vz, forces, force)
    age[i] += dt
    if (!valid || force[3] > MAX_SURFACE_DISTANCE || age[i] > life[i] || y > cache.maxY + 0.3) {
      respawn(system, emitters, i)
      continue
    }

    const l = Math.hypot(force[0], force[1], force[2])
    if (l > 1e-6) {
      vx += ((force[0] / l) * speed - vx) * steer
      vy += ((force[1] / l) * speed - vy) * steer
      vz += ((force[2] / l) * speed - vz) * steer
    }
    velocity[o] = vx
    velocity[o + 1] = vy
    velocity[o + 2] = vz
    position[o] = x + vx * dt
    position[o + 1] = y + vy * dt
    position[o + 2] = z + vz * dt
  }

  writeTrails(system)
}

function writeTrails(system) {
  const { count, trailLength, trail, position, fresh } = system
  trail.copyWithin(3, 0, trail.length - 3)
  for (let i = 0; i < count; i += 1) {
    const base = i * trailLength * 3
    const o = i * 3
    if (fresh[i]) {
      // A respawned particle collapses its whole trail onto the new start.
      for (let s = 0; s < trailLength; s += 1) {
        trail[base + s * 3] = position[o]
        trail[base + s * 3 + 1] = position[o + 1]
        trail[base + s * 3 + 2] = position[o + 2]
      }
      fresh[i] = 0
    } else {
      trail[base] = position[o]
      trail[base + 1] = position[o + 1]
      trail[base + 2] = position[o + 2]
    }
  }
}
