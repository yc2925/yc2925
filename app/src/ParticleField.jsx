import { useMemo } from 'react'
import * as THREE from 'three'

const PARTICLE_COUNT = 3600
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function fade(t) {
  return t * t * (3 - 2 * t)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function hashCorner(ix, iy, iz) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 2147483647)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

function valueNoise(x, y, z) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = fade(x - ix)
  const fy = fade(y - iy)
  const fz = fade(z - iz)

  const n000 = hashCorner(ix, iy, iz)
  const n100 = hashCorner(ix + 1, iy, iz)
  const n010 = hashCorner(ix, iy + 1, iz)
  const n110 = hashCorner(ix + 1, iy + 1, iz)
  const n001 = hashCorner(ix, iy, iz + 1)
  const n101 = hashCorner(ix + 1, iy, iz + 1)
  const n011 = hashCorner(ix, iy + 1, iz + 1)
  const n111 = hashCorner(ix + 1, iy + 1, iz + 1)

  const nx00 = lerp(n000, n100, fx)
  const nx10 = lerp(n010, n110, fx)
  const nx01 = lerp(n001, n101, fx)
  const nx11 = lerp(n011, n111, fx)
  const nxy0 = lerp(nx00, nx10, fy)
  const nxy1 = lerp(nx01, nx11, fy)
  return lerp(nxy0, nxy1, fz) * 2 - 1
}

function fbm(x, y, z) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  for (let octave = 0; octave < 4; octave += 1) {
    sum += amp * valueNoise(x * freq, y * freq, z * freq)
    freq *= 2.05
    amp *= 0.5
  }
  return sum
}

function buildPositions(spacing, shape) {
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const freq = 1.15 + shape * 2.8
  const scale = 3.4

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2
    const radiusXZ = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = GOLDEN_ANGLE * i
    const x = Math.cos(theta) * radiusXZ
    const z = Math.sin(theta) * radiusXZ
    const warp = fbm(x * freq, y * freq, z * freq)
    const radius = (1 + shape * 0.95 * warp) * spacing * scale
    const index = i * 3
    positions[index] = x * radius
    positions[index + 1] = y * radius
    positions[index + 2] = z * radius
  }

  return positions
}

export default function ParticleField({ spacing, hue, shape }) {
  const positions = useMemo(() => buildPositions(spacing, shape), [spacing, shape])
  const color = useMemo(() => new THREE.Color().setHSL(hue / 360, 0.72, 0.62), [hue])

  return (
    <points>
      <bufferGeometry key={`${spacing}-${shape}`}>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.07}
        sizeAttenuation
        transparent
        opacity={0.92}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
