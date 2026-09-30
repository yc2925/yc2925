import * as THREE from 'three'

function fract(x) {
  return x - Math.floor(x)
}

function hash13(x, y, z) {
  let px = fract(x * 0.1031)
  let py = fract(y * 0.1031)
  let pz = fract(z * 0.1031)
  const k = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33)
  px = fract(px + k)
  py = fract(py + k)
  pz = fract(pz + k)
  return fract((px + py) * pz)
}

function valueNoise3(x, y, z) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const uz = fz * fz * (3 - 2 * fz)
  const n000 = hash13(ix, iy, iz)
  const n100 = hash13(ix + 1, iy, iz)
  const n010 = hash13(ix, iy + 1, iz)
  const n110 = hash13(ix + 1, iy + 1, iz)
  const n001 = hash13(ix, iy, iz + 1)
  const n101 = hash13(ix + 1, iy, iz + 1)
  const n011 = hash13(ix, iy + 1, iz + 1)
  const n111 = hash13(ix + 1, iy + 1, iz + 1)
  const nx00 = n000 * (1 - ux) + n100 * ux
  const nx10 = n010 * (1 - ux) + n110 * ux
  const nx01 = n001 * (1 - ux) + n101 * ux
  const nx11 = n011 * (1 - ux) + n111 * ux
  const nxy0 = nx00 * (1 - uy) + nx10 * uy
  const nxy1 = nx01 * (1 - uy) + nx11 * uy
  return nxy0 * (1 - uz) + nxy1 * uz
}

function fbm3(x, y, z, octaves = 4) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * valueNoise3(x * freq, y * freq, z * freq)
    freq *= 2.03
    amp *= 0.5
  }
  return sum
}

function ridge(x, y, z, octaves = 3) {
  return 1 - Math.abs(fbm3(x, y, z, octaves) * 2 - 1)
}

function rand(seed, i) {
  const t = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453
  return t - Math.floor(t)
}

function dirFrom(seed, i, yBias = 0) {
  const y = THREE.MathUtils.clamp(rand(seed, i) * 2 - 1 + yBias, -1, 1)
  const a = rand(seed, i + 17) * Math.PI * 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize()
}

function makeSpecimen(seed) {
  const nMass = 4 + Math.floor(rand(seed, 2) * 2)
  const masses = []
  for (let i = 0; i < nMass; i += 1) {
    const center = dirFrom(seed, 30 + i, i === 0 ? 0.2 : -0.05).multiplyScalar(0.12 + rand(seed, 40 + i) * 0.48)
    masses.push({
      center,
      radius: 0.42 + rand(seed, 50 + i) * 0.5,
      stretch: new THREE.Vector3(
        0.62 + rand(seed, 60 + i) * 0.7,
        0.55 + rand(seed, 70 + i) * 0.85,
        0.62 + rand(seed, 80 + i) * 0.7,
      ),
    })
  }

  const poles = [
    dirFrom(seed, 100, 0.55),
    dirFrom(seed, 104, 0.28),
    dirFrom(seed, 108, 0.12),
    dirFrom(seed, 112, -0.45),
  ]

  return {
    masses,
    poles,
    compress: dirFrom(seed, 90, -0.1),
    compressAmt: 0.1 + rand(seed, 93) * 0.16,
    breakNormal: dirFrom(seed, 96, 0.05),
    stretch: new THREE.Vector3(
      0.78 + rand(seed, 4) * 0.22,
      1.08 + rand(seed, 5) * 0.28,
      0.8 + rand(seed, 6) * 0.26,
    ),
    o1: new THREE.Vector3(rand(seed, 200) * 8, rand(seed, 201) * 8, rand(seed, 202) * 8),
    o2: new THREE.Vector3(rand(seed, 203) * 11 + 3, rand(seed, 204) * 11, rand(seed, 205) * 11 + 5),
    o3: new THREE.Vector3(rand(seed, 206) * 9, rand(seed, 207) * 9 + 4, rand(seed, 208) * 9),
    o4: new THREE.Vector3(17.1 + rand(seed, 209), 4.7, 9.2),
    o5: new THREE.Vector3(8.4, 21.6 + rand(seed, 210), 3.1),
    o6: new THREE.Vector3(31.2, 5.8, 14.9 + rand(seed, 211)),
  }
}

function warpPoint(x, y, z, specimen, amp) {
  const w1 = fbm3(x * 0.52 + specimen.o1.x, y * 0.52 + specimen.o1.y, z * 0.52 + specimen.o1.z, 3)
  const w2 = fbm3(x * 0.52 + specimen.o2.x, y * 0.48 + specimen.o2.y, z * 0.52 + specimen.o2.z, 3)
  const w3 = fbm3(x * 0.5 + specimen.o3.x, y * 0.52 + specimen.o3.y, z * 0.5 + specimen.o3.z, 3)
  return {
    x: x + (w1 - 0.5) * amp * 1.35,
    y: y + (w2 - 0.5) * amp * 0.85,
    z: z + (w3 - 0.5) * amp * 1.2,
  }
}

function poleFalloff(dir, pole, width) {
  const d = 1 - Math.max(-1, Math.min(1, dir.dot(pole)))
  return Math.exp(-(d * d) / (width * width))
}

function corridorBand(dir, a, b, tightness) {
  const n = a.clone().cross(b)
  if (n.lengthSq() < 1e-5) return 0
  n.normalize()
  const dist = Math.abs(dir.dot(n))
  const between = dir.dot(a) > -0.08 && dir.dot(b) > -0.12
  if (!between) return 0
  return Math.exp(-dist * dist * tightness)
}

export function veinPotential(dir, specimen, complexity) {
  const freq = 1.05 + complexity * 2.35
  const w = warpPoint(dir.x, dir.y, dir.z, specimen, 0.28 + complexity * 0.18)
  const px = w.x * freq
  const py = w.y * freq * 0.62
  const pz = w.z * freq

  const primary = ridge(px, py, pz, 3) ** (2.4 + (1 - complexity) * 1.2)
  const secondary = ridge(px * 1.85 + 9.1, py * 1.4 + 2.4, pz * 1.85 + 4.7, 3) ** 3.1
  const tendril = ridge(px * 3.15 + 21, py * 2.2 + 8, pz * 3.15 + 11, 2) ** 3.6

  let poles = 0
  for (const pole of specimen.poles) {
    poles = Math.max(poles, poleFalloff(dir, pole, 0.2 + complexity * 0.1))
  }

  const tightness = 52 - complexity * 24
  let corridors = 0
  for (let i = 0; i < specimen.poles.length; i += 1) {
    for (let j = i + 1; j < specimen.poles.length; j += 1) {
      corridors = Math.max(corridors, corridorBand(dir, specimen.poles[i], specimen.poles[j], tightness))
    }
  }

  let v =
    primary * 0.5 +
    primary * secondary * (0.22 + complexity * 0.38) +
    primary * tendril * complexity * 0.28 +
    corridors * 0.72 +
    poles * 0.48

  v = THREE.MathUtils.clamp(v, 0, 1)
  return THREE.MathUtils.smoothstep(v, 0.1, 0.82)
}

function sampleRadius(dir, specimen, form) {
  const mass = form.massVariation
  const warpAmp = 0.09 + mass * 0.36
  const w = warpPoint(dir.x, dir.y, dir.z, specimen, warpAmp)
  const px = w.x
  const py = w.y
  const pz = w.z

  let blob = 0
  const q = new THREE.Vector3()
  for (const m of specimen.masses) {
    q.set(px, py, pz).sub(m.center)
    q.x /= m.stretch.x
    q.y /= m.stretch.y
    q.z /= m.stretch.z
    const t = Math.max(0, 1 - q.length() / m.radius)
    blob += t * t * (3 - 2 * t)
  }
  blob = THREE.MathUtils.smoothstep(blob, 0.12, 1.28)

  let radius = 0.8 + blob * (0.2 + mass * 0.44)

  const compressed = dir.dot(specimen.compress)
  radius *= 1 - specimen.compressAmt * compressed * compressed * (0.35 + mass * 0.55)

  const face = Math.max(0, dir.dot(specimen.breakNormal) - 0.12)
  radius *= 1 - THREE.MathUtils.smoothstep(face, 0.04, 0.52) * 0.11

  const med = fbm3(px * 1.65 + specimen.o4.x, py * 1.65 + specimen.o4.y, pz * 1.65 + specimen.o4.z, 3)
  radius += (THREE.MathUtils.smoothstep(med, 0.3, 0.7) - 0.5) * (0.028 + mass * 0.05)

  const caveN = fbm3(px * 1.12 + specimen.o5.x, py * 1.12 + specimen.o5.y, pz * 1.12 + specimen.o5.z, 3)
  const underside = THREE.MathUtils.smoothstep(-dir.y, -0.12, 0.5)
  const cavity = (1 - THREE.MathUtils.smoothstep(caveN, 0.2, 0.48)) * (0.4 + underside * 0.6)
  radius -= cavity * form.erosion * 0.155

  const vein = veinPotential(dir, specimen, form.growthComplexity)
  radius += vein * (0.018 + form.growthComplexity * 0.038)

  const fine = fbm3(px * 6.2 + specimen.o6.x, py * 6.2 + specimen.o6.y, pz * 6.2 + specimen.o6.z, 3)
  const fineShaped = THREE.MathUtils.smoothstep(fine, 0.4, 0.6)
  radius += (fineShaped - 0.5) * (0.005 + form.surfaceRoughness * 0.026)

  return THREE.MathUtils.clamp(radius, 0.5, 1.68)
}

export const DEFAULT_ROCK_FORM = {
  seed: 17,
  massVariation: 0.64,
  erosion: 0.42,
  surfaceRoughness: 0.26,
  growthComplexity: 0.58,
}

export function createOrganicRock(form = DEFAULT_ROCK_FORM) {
  const specimen = makeSpecimen(form.seed)
  const geometry = new THREE.IcosahedronGeometry(1, 6)
  const position = geometry.attributes.position
  const count = position.count
  const growth = new Float32Array(count)
  const relief = new Float32Array(count)
  const uv = new Float32Array(count * 2)
  const dir = new THREE.Vector3()
  const radii = new Float32Array(count)

  for (let i = 0; i < count; i += 1) {
    dir.fromBufferAttribute(position, i).normalize()
    const radius = sampleRadius(dir, specimen, form)
    radii[i] = radius
    position.setXYZ(
      i,
      dir.x * radius * specimen.stretch.x,
      dir.y * radius * specimen.stretch.y,
      dir.z * radius * specimen.stretch.z,
    )

    const potential = veinPotential(dir, specimen, form.growthComplexity)
    growth[i] = potential < 0.13 ? 1.2 : THREE.MathUtils.lerp(0.07, 0.96, 1 - potential)

    const mean = 0.92
    relief[i] = THREE.MathUtils.clamp((radius - mean) / 0.38 + 0.48 + potential * 0.16, 0, 1)

    uv[i * 2] = 0.5 + Math.atan2(dir.z, dir.x) / (Math.PI * 2)
    uv[i * 2 + 1] = 0.5 + Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) / Math.PI
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setAttribute('aGrowth', new THREE.BufferAttribute(growth, 1))
  geometry.setAttribute('aRelief', new THREE.BufferAttribute(relief, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  const fit = 1.42 / (geometry.boundingSphere?.radius || 1)
  geometry.scale(fit, fit, fit)
  geometry.center()
  return geometry
}
