import { createPrecipitationField, samplePrecipitation } from './precipitation.js'

function createMetrics() {
  return {
    rainfall: 0,
    evaporation: 0,
    outflow: 0,
    eroded: 0,
    deposited: 0,
    sedimentOut: 0,
    sampleTime: 0,
    sampleRainfall: 0,
    sampleEvaporation: 0,
    sampleOutflow: 0,
  }
}

function createEcologyMetrics() {
  return {
    growth: 0,
    dieOff: 0,
    sampleTime: 0,
    sampleGrowth: 0,
    sampleDieOff: 0,
  }
}

function routeFlow(
  neighbor,
  drop,
  dropSum,
  outflow,
  sedimentOut,
  waterNext,
  sedimentNext,
  metrics,
  terrain,
  deposition,
  source,
  depositionRate,
) {
  if (drop <= 0) return
  const share = drop / dropSum
  const movedWater = outflow * share
  const movedSediment = sedimentOut * share
  if (neighbor >= 0) {
    waterNext[neighbor] += movedWater
    sedimentNext[neighbor] += movedSediment
    return
  }

  metrics.outflow += movedWater
  metrics.sedimentOut += movedSediment
  const coastalDeposit = movedSediment * depositionRate * 0.3
  terrain[source] += coastalDeposit
  deposition[source] = Math.min(1, deposition[source] + coastalDeposit * 40)
  metrics.deposited += coastalDeposit
}

export function createHydraulicState(baseHeights, size) {
  const count = size * size
  return {
    size,
    terrain: new Float32Array(baseHeights),
    water: new Float32Array(count),
    sediment: new Float32Array(count),
    scour: new Float32Array(count),
    deposition: new Float32Array(count),
    precipitation: new Float32Array(count),
    waterNext: new Float32Array(count),
    sedimentNext: new Float32Array(count),
    velocity: new Float32Array(count),
    slope: new Float32Array(count),
    vegetation: new Float32Array(count),
    vegetationNext: new Float32Array(count),
    vegetationType: new Uint8Array(count),
    soilMoisture: new Float32Array(count),
    disturbance: new Float32Array(count),
    precipitationNoise: createPrecipitationField(),
    time: 0,
    ecologyVersion: 0,
    metrics: createMetrics(),
    ecologyMetrics: createEcologyMetrics(),
  }
}

export function restoreHydraulicState(state, snapshot) {
  if (!snapshot || snapshot.size !== state.size) return
  state.terrain.set(snapshot.terrain)
  state.water.set(snapshot.water)
  state.scour.set(snapshot.scour)
  state.sediment.set(snapshot.sediment)
  state.deposition.set(snapshot.deposition)
  state.vegetation.set(snapshot.vegetation)
  state.vegetationType.set(snapshot.vegetationType)
  state.soilMoisture.set(snapshot.soilMoisture)
  state.disturbance.set(snapshot.disturbance)
}

export function captureHydraulicState(state, time) {
  return {
    time,
    size: state.size,
    terrain: new Float32Array(state.terrain),
    water: new Float32Array(state.water),
    sediment: new Float32Array(state.sediment),
    scour: new Float32Array(state.scour),
    deposition: new Float32Array(state.deposition),
    vegetation: new Float32Array(state.vegetation),
    vegetationType: new Uint8Array(state.vegetationType),
    soilMoisture: new Float32Array(state.soilMoisture),
    disturbance: new Float32Array(state.disturbance),
  }
}

export function stepHydraulic(state, settings, delta = 1) {
  if (!settings.running) return

  const {
    size,
    terrain,
    water,
    sediment,
    scour,
    deposition,
    precipitation,
    waterNext,
    sedimentNext,
    velocity,
    slope,
    vegetation,
    precipitationNoise,
    metrics,
  } = state
  const last = Math.max(1, size - 1)
  const rain = settings.rain * delta
  const decay = Math.exp(-2.2 * delta)
  state.time += delta

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x
      const rainFactor = samplePrecipitation(
        precipitationNoise,
        (x / last) * 2 - 1,
        (y / last) * 2 - 1,
        state.time,
        settings,
      )
      const rainfall = rain * rainFactor
      precipitation[i] = rainFactor
      water[i] += rainfall
      metrics.rainfall += rainfall

      waterNext[i] = water[i]
      sedimentNext[i] = sediment[i]
      velocity[i] = 0
      slope[i] = 0
      scour[i] *= decay
      deposition[i] *= decay
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x
      const surface = terrain[i] + water[i]
      const left = x > 0 ? i - 1 : -1
      const right = x < size - 1 ? i + 1 : -1
      const down = y > 0 ? i - size : -1
      const up = y < size - 1 ? i + size : -1
      const dropLeft = Math.max(
        0,
        surface - (left >= 0 ? terrain[left] + water[left] : settings.oceanLevel),
      )
      const dropRight = Math.max(
        0,
        surface - (right >= 0 ? terrain[right] + water[right] : settings.oceanLevel),
      )
      const dropDown = Math.max(
        0,
        surface - (down >= 0 ? terrain[down] + water[down] : settings.oceanLevel),
      )
      const dropUp = Math.max(
        0,
        surface - (up >= 0 ? terrain[up] + water[up] : settings.oceanLevel),
      )
      const dropSum = dropLeft + dropRight + dropDown + dropUp
      slope[i] = Math.max(dropLeft, dropRight, dropDown, dropUp)

      if (dropSum <= 0 || water[i] <= 0) continue

      const flowResistance = 1 - vegetation[i] * settings.erosionResistance * 0.28
      const outflow = Math.min(
        water[i],
        dropSum * settings.flow * flowResistance * delta * 8,
      )
      const sedimentOut = sediment[i] * (outflow / Math.max(water[i], 1e-6))
      waterNext[i] -= outflow
      sedimentNext[i] -= sedimentOut
      velocity[i] = outflow / Math.max(water[i], 1e-6)

      routeFlow(
        left,
        dropLeft,
        dropSum,
        outflow,
        sedimentOut,
        waterNext,
        sedimentNext,
        metrics,
        terrain,
        deposition,
        i,
        settings.deposition,
      )
      routeFlow(
        right,
        dropRight,
        dropSum,
        outflow,
        sedimentOut,
        waterNext,
        sedimentNext,
        metrics,
        terrain,
        deposition,
        i,
        settings.deposition,
      )
      routeFlow(
        down,
        dropDown,
        dropSum,
        outflow,
        sedimentOut,
        waterNext,
        sedimentNext,
        metrics,
        terrain,
        deposition,
        i,
        settings.deposition,
      )
      routeFlow(
        up,
        dropUp,
        dropSum,
        outflow,
        sedimentOut,
        waterNext,
        sedimentNext,
        metrics,
        terrain,
        deposition,
        i,
        settings.deposition,
      )
    }
  }

  water.set(waterNext)
  sediment.set(sedimentNext)

  for (let i = 0; i < terrain.length; i += 1) {
    const erosionPotential =
      water[i] * velocity[i] * Math.max(0.001, slope[i]) * settings.erosionStrength
    const capacity = erosionPotential * settings.capacity * 18
    const rootProtection = Math.max(
      0.05,
      1 - vegetation[i] * settings.erosionResistance,
    )

    if (sediment[i] < capacity) {
      const maxErosion = 0.0015 * Math.max(0.1, settings.erosionStrength)
      const eroded = Math.min(
        (capacity - sediment[i]) * settings.scour * rootProtection * delta * 5,
        maxErosion * rootProtection,
      )
      terrain[i] -= eroded
      sediment[i] += eroded
      scour[i] = Math.min(1, scour[i] + eroded * 70)
      metrics.eroded += eroded
    } else {
      const deposited = Math.min(
        (sediment[i] - capacity) * settings.deposition * delta * 3,
        sediment[i],
      )
      terrain[i] += deposited
      sediment[i] -= deposited
      deposition[i] = Math.min(1, deposition[i] + deposited * 55)
      metrics.deposited += deposited
    }

    const x = i % size
    const y = Math.floor(i / size)
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
      const mergedWater = water[i] * (1 - Math.exp(-6 * delta))
      const sedimentRatio = mergedWater / Math.max(water[i], 1e-6)
      const exportedSediment = sediment[i] * sedimentRatio
      const coastalDeposit = exportedSediment * settings.deposition * 0.35
      water[i] -= mergedWater
      sediment[i] -= exportedSediment
      terrain[i] += coastalDeposit
      deposition[i] = Math.min(1, deposition[i] + coastalDeposit * 40)
      metrics.outflow += mergedWater
      metrics.sedimentOut += exportedSediment - coastalDeposit
      metrics.deposited += coastalDeposit
    }

    const evaporated = water[i] * (1 - Math.exp(-settings.evaporation * delta))
    water[i] -= evaporated
    metrics.evaporation += evaporated
    if (water[i] < 1e-5) water[i] = 0
  }
}

export function readHydrologyTelemetry(state) {
  let totalWater = 0
  let maxWater = 0
  let sedimentLoad = 0

  for (let i = 0; i < state.water.length; i += 1) {
    totalWater += state.water[i]
    maxWater = Math.max(maxWater, state.water[i])
    sedimentLoad += state.sediment[i]
  }

  const metrics = state.metrics
  const elapsed = Math.max(1e-6, state.time - metrics.sampleTime)
  const telemetry = {
    totalWater,
    averageWater: totalWater / state.water.length,
    maxWater,
    rainfallRate: (metrics.rainfall - metrics.sampleRainfall) / elapsed,
    evaporationRate: (metrics.evaporation - metrics.sampleEvaporation) / elapsed,
    outflowRate: (metrics.outflow - metrics.sampleOutflow) / elapsed,
    erodedMaterial: metrics.eroded,
    depositedMaterial: metrics.deposited,
    sedimentLoad,
  }

  metrics.sampleTime = state.time
  metrics.sampleRainfall = metrics.rainfall
  metrics.sampleEvaporation = metrics.evaporation
  metrics.sampleOutflow = metrics.outflow
  return telemetry
}
