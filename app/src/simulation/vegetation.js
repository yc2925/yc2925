function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function organicVariation(index) {
  const value = Math.sin(index * 12.9898 + 43.137) * 43758.5453
  return 0.78 + (value - Math.floor(value)) * 0.42
}

function neighborAverage(values, index, x, y, size) {
  let total = 0
  let count = 0
  if (x > 0) {
    total += values[index - 1]
    count += 1
  }
  if (x < size - 1) {
    total += values[index + 1]
    count += 1
  }
  if (y > 0) {
    total += values[index - size]
    count += 1
  }
  if (y < size - 1) {
    total += values[index + size]
    count += 1
  }
  return count > 0 ? total / count : 0
}

function terrainSlope(terrain, index, x, y, size) {
  const height = terrain[index]
  let slope = 0
  if (x > 0) slope = Math.max(slope, Math.abs(height - terrain[index - 1]))
  if (x < size - 1) slope = Math.max(slope, Math.abs(height - terrain[index + 1]))
  if (y > 0) slope = Math.max(slope, Math.abs(height - terrain[index - size]))
  if (y < size - 1) slope = Math.max(slope, Math.abs(height - terrain[index + size]))
  return slope
}

export function stepVegetation(state, settings, delta) {
  const {
    size,
    terrain,
    water,
    precipitation,
    scour,
    deposition,
    vegetation,
    vegetationNext,
    vegetationType,
    soilMoisture,
    disturbance,
    ecologyMetrics,
  } = state
  const preferredElevation = settings.oceanLevel + settings.elevationRange * 0.46
  const elevationWidth = Math.max(0.08, settings.elevationRange * 0.62)
  const moistureWidth = 0.48

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x
      const submerged = terrain[i] <= settings.oceanLevel
      const infiltrationCapacity =
        (0.012 + precipitation[i] * settings.rain * 0.8) * delta
      const absorbed = Math.min(water[i], infiltrationCapacity)
      water[i] -= absorbed

      const moistureGain = absorbed * 4.2
      const moistureLoss =
        soilMoisture[i] * (settings.evaporation * 0.24 + 0.018) * delta
      soilMoisture[i] = clamp01(
        soilMoisture[i] + moistureGain - moistureLoss + deposition[i] * 0.002 * delta,
      )
      if (submerged) soilMoisture[i] = 1

      disturbance[i] = Math.max(
        scour[i] * 1.55,
        disturbance[i] * Math.exp(-0.22 * delta) - deposition[i] * 0.01 * delta,
      )

      if (!settings.vegetationEnabled) {
        vegetationNext[i] = vegetation[i]
        continue
      }

      const density = vegetation[i]
      const slope = terrainSlope(terrain, i, x, y, size)
      const groundTolerance = settings.slopeTolerance * (1.35 - density * 0.35)
      const slopeSuitability = clamp01(1 - slope / groundTolerance)
      const elevationSuitability = clamp01(
        1 - Math.abs(terrain[i] - preferredElevation) / elevationWidth,
      )
      const preferredMoistureSuitability = clamp01(
        1 - Math.abs(soilMoisture[i] - settings.moisturePreference) / moistureWidth,
      )
      const groundMoistureSuitability = clamp01(
        1 - Math.abs(soilMoisture[i] - settings.moisturePreference * 0.55) / 0.58,
      )
      const succession = clamp01((density - 0.18) / 0.5)
      const moistureSuitability =
        groundMoistureSuitability * (1 - succession) +
        preferredMoistureSuitability * succession
      const stability = clamp01(1 - disturbance[i])
      const floodStress = clamp01((water[i] - 0.09) / 0.22)
      const suitability = submerged
        ? 0
        : moistureSuitability *
          slopeSuitability *
          elevationSuitability *
          stability *
          (1 - floodStress)
      const neighbors = neighborAverage(vegetation, i, x, y, size)
      const propagation = 0.055 + neighbors * settings.spread
      const variation = organicVariation(i)
      const growth =
        settings.growthRate *
        suitability *
        propagation *
        (1 - density) *
        variation *
        delta *
        2.8
      const unsuitable = 1 - suitability
      const erosionDamage = scour[i] * density * delta * 1.8
      const floodDamage = floodStress * density * delta * 0.8
      const death =
        settings.dieOffRate * unsuitable * density * delta +
        erosionDamage +
        floodDamage

      vegetationNext[i] = clamp01(density + growth - death)
      ecologyMetrics.growth += growth
      ecologyMetrics.dieOff += Math.min(density + growth, death)
    }
  }

  vegetation.set(vegetationNext)

  for (let i = 0; i < vegetation.length; i += 1) {
    const density = vegetation[i]
    if (density < 0.045 || terrain[i] <= settings.oceanLevel) {
      vegetationType[i] = 0
    } else if (
      density > 0.68 &&
      soilMoisture[i] > 0.34 &&
      disturbance[i] < 0.3
    ) {
      vegetationType[i] = 3
    } else if (density > 0.3 && soilMoisture[i] > 0.18) {
      vegetationType[i] = 2
    } else {
      vegetationType[i] = 1
    }
  }

  state.ecologyVersion += 1
}

export function readVegetationTelemetry(state, oceanLevel = -Infinity) {
  let covered = 0
  let totalMoisture = 0
  let landCells = 0
  for (let i = 0; i < state.vegetation.length; i += 1) {
    if (state.terrain[i] <= oceanLevel) continue
    landCells += 1
    if (state.vegetation[i] >= 0.05) covered += 1
    totalMoisture += state.soilMoisture[i]
  }

  const metrics = state.ecologyMetrics
  const elapsed = Math.max(1e-6, state.time - metrics.sampleTime)
  const cellCount = Math.max(1, state.vegetation.length)
  const telemetry = {
    vegetationCoverage: covered / Math.max(1, landCells),
    soilMoisture: totalMoisture / Math.max(1, landCells),
    vegetationGrowthRate:
      (metrics.growth - metrics.sampleGrowth) / elapsed / cellCount,
    vegetationDieOffRate:
      (metrics.dieOff - metrics.sampleDieOff) / elapsed / cellCount,
  }
  metrics.sampleTime = state.time
  metrics.sampleGrowth = metrics.growth
  metrics.sampleDieOff = metrics.dieOff
  return telemetry
}
