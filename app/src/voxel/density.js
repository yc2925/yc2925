import { createSimplex2D } from '../noise/simplex2d.js'
import { createValueNoise3D } from './noise3d.js'

export function voxelIndex(x, y, z, resolution) {
  return x + y * resolution + z * resolution * resolution
}

function sampleRollingTerrain(noise, x, z, frequency) {
  let value = 0
  let weight = 0
  let amplitude = 1
  let octaveFrequency = frequency

  for (let octave = 0; octave < 3; octave += 1) {
    value += noise(x * octaveFrequency, z * octaveFrequency) * amplitude
    weight += amplitude
    amplitude *= 0.5
    octaveFrequency *= 2
  }

  return value / weight
}

function smoothstep(edge0, edge1, value) {
  const amount = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return amount * amount * (3 - 2 * amount)
}

function sampleCaveNoise(noise, x, y, z, frequency) {
  let value = 0
  let weight = 0
  let amplitude = 1
  let octaveFrequency = frequency * 5

  for (let octave = 0; octave < 3; octave += 1) {
    value +=
      noise(
        (x + 1.7) * octaveFrequency,
        (y - 2.3) * octaveFrequency,
        (z + 0.9) * octaveFrequency,
      ) * amplitude
    weight += amplitude
    amplitude *= 0.5
    octaveFrequency *= 2
  }

  return value / weight * 0.5 + 0.5
}

function terrainSurface(noise, x, z, terrainHeight, noiseFrequency) {
  const terrain = sampleRollingTerrain(noise, x * 3.2, z * 3.2, noiseFrequency)
  return -0.08 + terrain * terrainHeight
}

function densityAt(mode, noise, x, y, z, settings) {
  const { terrainHeight, noiseFrequency } = settings

  if (mode === 'sphere') {
    const radius = 0.24 + terrainHeight * 0.3
    return radius - Math.sqrt(x * x + y * y + z * z)
  }

  if (mode === 'floatingIsland') {
    const radialDistance = Math.sqrt(x * x + z * z)
    const top =
      0.16 +
      sampleRollingTerrain(noise, x * 3.2, z * 3.2, noiseFrequency) *
        terrainHeight *
        0.55
    const normalizedRadius = radialDistance / 0.48
    const underside = -0.43 + Math.pow(normalizedRadius, 1.65) * 0.4
    return Math.min(top - y, y - underside, 0.48 - radialDistance)
  }

  const surface = terrainSurface(noise, x, z, terrainHeight, noiseFrequency)
  if (mode === 'strata') {
    const warp =
      sampleRollingTerrain(noise, x * 2.1 + 13, z * 2.1 - 7, noiseFrequency * 0.55) *
      0.035
    const layer = Math.sin((y + x * 0.07 + warp + 0.5) * Math.PI * 12) + 0.18
    return Math.min(surface - y, layer * 0.12)
  }

  return surface - y
}

export function createDensityVolume(settings) {
  const {
    densityMode,
    resolution,
    terrainScale,
    enableCaves,
    caveFrequency,
    caveThreshold,
    caveStrength,
  } = settings
  const density = new Float32Array(resolution ** 3)
  const surfaceNoise = createSimplex2D(84)
  const caveNoise = createValueNoise3D(137)
  const last = Math.max(1, resolution - 1)
  const voxelStep = 1 / last

  for (let z = 0; z < resolution; z += 1) {
    const normalizedZ = z / last - 0.5
    for (let x = 0; x < resolution; x += 1) {
      const normalizedX = x / last - 0.5

      for (let y = 0; y < resolution; y += 1) {
        const normalizedY = y / last - 0.5
        const baseDensity = densityAt(
          densityMode,
          surfaceNoise,
          normalizedX,
          normalizedY,
          normalizedZ,
          settings,
        )
        let finalDensity = baseDensity

        if (enableCaves && baseDensity > 0) {
          const caveValue = sampleCaveNoise(
            caveNoise,
            normalizedX,
            normalizedY,
            normalizedZ,
            caveFrequency,
          )
          const caveMask = smoothstep(
            caveThreshold,
            Math.min(1, caveThreshold + 0.18),
            caveValue,
          )
          const interiorMask = smoothstep(voxelStep * 1.1, voxelStep * 2.6, baseDensity)
          finalDensity -= caveMask * caveStrength * interiorMask
        }

        density[voxelIndex(x, y, z, resolution)] = finalDensity
      }
    }
  }

  return { density, resolution, worldSize: terrainScale }
}
