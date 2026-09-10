function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function rainAt(x, y, size, scale) {
  const u = x / Math.max(1, size - 1)
  const v = y / Math.max(1, size - 1)
  const a = Math.sin((u * scale + 0.17) * Math.PI * 2)
  const b = Math.sin((v * scale * 0.73 + 0.41) * Math.PI * 2)
  const c = Math.sin(((u + v) * scale * 0.47 + 0.63) * Math.PI * 2)
  return 0.18 + 0.82 * clamp((a + b + c) / 6 + 0.5, 0, 1)
}

export function createHydraulicState(baseHeights, size) {
  const count = size * size
  return {
    size,
    terrain: new Float32Array(baseHeights),
    water: new Float32Array(count),
    sediment: new Float32Array(count),
    scour: new Float32Array(count),
    waterNext: new Float32Array(count),
    sedimentNext: new Float32Array(count),
    velocity: new Float32Array(count),
    slope: new Float32Array(count),
  }
}

export function restoreHydraulicState(state, snapshot) {
  if (!snapshot || snapshot.size !== state.size) return
  state.terrain.set(snapshot.terrain)
  state.water.set(snapshot.water)
  state.scour.set(snapshot.scour)
  state.sediment.fill(0)
}

export function captureHydraulicState(state, time) {
  return {
    time,
    size: state.size,
    terrain: new Float32Array(state.terrain),
    water: new Float32Array(state.water),
    scour: new Float32Array(state.scour),
  }
}

export function stepHydraulic(state, settings, delta = 1) {
  if (!settings.running) return

  const { size, terrain, water, sediment, scour, waterNext, sedimentNext, velocity, slope } =
    state
  const rain = settings.rain * delta
  const evaporation = clamp(settings.evaporation * delta, 0, 0.95)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x
      const rainFactor = settings.rainmap ? rainAt(x, y, size, settings.rainScale) : 1
      water[i] += rain * rainFactor
      waterNext[i] = water[i]
      sedimentNext[i] = sediment[i]
      velocity[i] = 0
      slope[i] = 0
      scour[i] *= 0.965
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x
      const surface = terrain[i] + water[i]
      const neighbors = []
      let dropSum = 0

      if (x > 0) neighbors.push(i - 1)
      if (x < size - 1) neighbors.push(i + 1)
      if (y > 0) neighbors.push(i - size)
      if (y < size - 1) neighbors.push(i + size)

      for (const neighbor of neighbors) {
        const drop = Math.max(0, surface - (terrain[neighbor] + water[neighbor]))
        if (drop > 0) {
          dropSum += drop
          slope[i] = Math.max(slope[i], drop)
        }
      }

      if (dropSum <= 0 || water[i] <= 0) continue

      const outflow = Math.min(water[i], dropSum * settings.flow * delta)
      const sedimentOut = sediment[i] * (outflow / Math.max(water[i], 1e-6))
      waterNext[i] -= outflow
      sedimentNext[i] -= sedimentOut
      velocity[i] = outflow / Math.max(water[i], 1e-6)

      for (const neighbor of neighbors) {
        const drop = Math.max(0, surface - (terrain[neighbor] + water[neighbor]))
        if (drop <= 0) continue
        const share = drop / dropSum
        waterNext[neighbor] += outflow * share
        sedimentNext[neighbor] += sedimentOut * share
      }
    }
  }

  water.set(waterNext)
  sediment.set(sedimentNext)

  for (let i = 0; i < terrain.length; i += 1) {
    if (settings.showScour) {
      const capacity =
        Math.max(0.002, slope[i]) * velocity[i] * water[i] * settings.capacity * 5

      if (sediment[i] < capacity) {
        const eroded = Math.min(
          (capacity - sediment[i]) * settings.scour * delta,
          0.012 * delta,
        )
        terrain[i] -= eroded
        sediment[i] += eroded
        scour[i] = Math.min(1, scour[i] + eroded * 32)
      } else {
        const deposited = Math.min(
          (sediment[i] - capacity) * settings.deposition * delta,
          sediment[i],
        )
        terrain[i] += deposited
        sediment[i] -= deposited
      }
    }

    water[i] *= 1 - evaporation
    if (water[i] < 1e-5) water[i] = 0
  }
}
