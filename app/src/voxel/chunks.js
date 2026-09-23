import { createDensitySampler } from './density.js'
import { CSG_SPHERE_RADIUS } from './settings.js'

export const CHUNK_SIZE = 8

const LOCALIZED_CSG = new Set(['union', 'subtract', 'smoothUnion'])

const GLOBAL_DENSITY_KEYS = [
  'densityMode',
  'terrainScale',
  'terrainHeight',
  'noiseFrequency',
  'resolution',
  'chunkSize',
  'enableCaves',
  'caveFrequency',
  'caveThreshold',
  'caveStrength',
  'csgOperation',
  'blendStrength',
  'shellThickness',
]

function chunkSizeForSettings(settings) {
  const requested = settings.chunkSize ?? CHUNK_SIZE
  return settings.resolution % requested === 0 ? requested : CHUNK_SIZE
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function createDensityChunk(settings, coordinate, sampleDensity, chunkSize) {
  const resolution = settings.resolution
  const last = Math.max(1, resolution - 1)
  const origin = coordinate.map((value) => value * chunkSize)
  const meshResolution = chunkSize + 3
  const density = new Float32Array(chunkSize ** 3)
  const meshDensity = new Float32Array(meshResolution ** 3)
  let solidVoxelCount = 0

  for (let z = 0; z < chunkSize; z += 1) {
    for (let y = 0; y < chunkSize; y += 1) {
      for (let x = 0; x < chunkSize; x += 1) {
        const value = sampleDensity(
          (origin[0] + x) / last - 0.5,
          (origin[1] + y) / last - 0.5,
          (origin[2] + z) / last - 0.5,
        )
        density[x + y * chunkSize + z * chunkSize * chunkSize] = value
        if (value > 0) solidVoxelCount += 1
      }
    }
  }

  for (let z = 0; z < meshResolution; z += 1) {
    const sourceZ = clamp(origin[2] + z - 1, 0, resolution - 1)
    for (let y = 0; y < meshResolution; y += 1) {
      const sourceY = clamp(origin[1] + y - 1, 0, resolution - 1)
      for (let x = 0; x < meshResolution; x += 1) {
        const sourceX = clamp(origin[0] + x - 1, 0, resolution - 1)
        meshDensity[x + y * meshResolution + z * meshResolution * meshResolution] =
          sampleDensity(
            sourceX / last - 0.5,
            sourceY / last - 0.5,
            sourceZ / last - 0.5,
          )
      }
    }
  }

  return {
    id: coordinate.join(':'),
    coordinate,
    origin,
    dimensions: [chunkSize, chunkSize, chunkSize],
    density,
    meshDensity,
    meshResolution,
    solidVoxelCount,
  }
}

function createAllChunks(settings) {
  const chunkSize = chunkSizeForSettings(settings)
  const chunksPerAxis = settings.resolution / chunkSize
  const sampleDensity = createDensitySampler(settings)
  const chunks = []

  for (let z = 0; z < chunksPerAxis; z += 1) {
    for (let y = 0; y < chunksPerAxis; y += 1) {
      for (let x = 0; x < chunksPerAxis; x += 1) {
        chunks.push(createDensityChunk(settings, [x, y, z], sampleDensity, chunkSize))
      }
    }
  }

  return chunks
}

function sphereIntersectsChunk(chunk, settings, position) {
  const last = Math.max(1, settings.resolution - 1)
  const radius =
    CSG_SPHERE_RADIUS +
    (settings.csgOperation === 'smoothUnion' ? settings.blendStrength : 0) +
    1 / last
  let distanceSquared = 0

  for (let axis = 0; axis < 3; axis += 1) {
    const min = (chunk.origin[axis] - 1) / last - 0.5
    const max = (chunk.origin[axis] + chunk.dimensions[axis]) / last - 0.5
    const closest = clamp(position[axis], min, max)
    const distance = position[axis] - closest
    distanceSquared += distance * distance
  }

  return distanceSquared <= radius * radius
}

function requiresGlobalRegeneration(previousSettings, nextSettings) {
  return GLOBAL_DENSITY_KEYS.some((key) => previousSettings[key] !== nextSettings[key])
}

function sphereMoved(previousSettings, nextSettings) {
  return (
    previousSettings.csgX !== nextSettings.csgX ||
    previousSettings.csgY !== nextSettings.csgY ||
    previousSettings.csgZ !== nextSettings.csgZ
  )
}

function createVolume(settings) {
  return {
    resolution: settings.resolution,
    worldSize: settings.terrainScale,
    sampleCount: settings.resolution ** 3,
  }
}

export function createChunkedWorld(settings, updateVersion = 1) {
  const start = performance.now()
  const chunks = createAllChunks(settings)
  return {
    chunks,
    volume: createVolume(settings),
    updatedChunkIds: chunks.map((chunk) => chunk.id),
    updateTime: performance.now() - start,
    updateVersion,
  }
}

export function updateChunkedWorld(previousWorld, previousSettings, nextSettings) {
  if (requiresGlobalRegeneration(previousSettings, nextSettings)) {
    return createChunkedWorld(nextSettings, previousWorld.updateVersion + 1)
  }

  if (!sphereMoved(previousSettings, nextSettings)) {
    return previousWorld
  }

  if (!LOCALIZED_CSG.has(nextSettings.csgOperation)) {
    return previousWorld
  }

  const start = performance.now()
  const previousPosition = [
    previousSettings.csgX,
    previousSettings.csgY,
    previousSettings.csgZ,
  ]
  const nextPosition = [nextSettings.csgX, nextSettings.csgY, nextSettings.csgZ]
  const affectedIds = new Set(
    previousWorld.chunks
      .filter(
        (chunk) =>
          sphereIntersectsChunk(chunk, nextSettings, previousPosition) ||
          sphereIntersectsChunk(chunk, nextSettings, nextPosition),
      )
      .map((chunk) => chunk.id),
  )
  const sampleDensity = createDensitySampler(nextSettings)
  const chunks = previousWorld.chunks.map((chunk) =>
    affectedIds.has(chunk.id)
      ? createDensityChunk(
          nextSettings,
          chunk.coordinate,
          sampleDensity,
          chunk.dimensions[0],
        )
      : chunk,
  )

  return {
    chunks,
    volume: createVolume(nextSettings),
    updatedChunkIds: [...affectedIds],
    updateTime: performance.now() - start,
    updateVersion: previousWorld.updateVersion + 1,
  }
}
