import { createSimplex2D } from './simplex2d.js'

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function toUnit(n) {
  return clamp01((n + 1) * 0.5)
}

function fromUnit(v) {
  return clamp01(v) * 2 - 1
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function gain(x, k) {
  const a = 0.5 * (2 * (x < 0.5 ? x : 1 - x)) ** (0.2 + k * 4)
  return x < 0.5 ? a : 1 - a
}

function smoothstep(x) {
  return x * x * (3 - 2 * x)
}

function octaveLoop(x, y, params, noise, combine) {
  let sum = 0
  let amp = 1
  let freq = 1
  let max = 0
  const octaves = Math.round(params.octaves)
  for (let i = 0; i < octaves; i += 1) {
    const n = noise(x * params.frequency * freq, y * params.frequency * freq)
    sum += combine(n, i) * amp
    max += amp
    amp *= params.persistence
    freq *= params.lacunarity
  }
  return max === 0 ? 0 : sum / max
}

function fbm(x, y, params, noise) {
  return octaveLoop(x, y, params, noise, (n) => n)
}

function ridged(x, y, params, noise) {
  const sharpness = 1 + params.typeAmount * 3
  return octaveLoop(x, y, params, noise, (n) => (1 - Math.abs(n)) ** sharpness)
}

function billow(x, y, params, noise) {
  const mix = params.typeAmount
  return octaveLoop(x, y, params, noise, (n) => lerp(n, Math.abs(n) * 2 - 1, mix))
}

function turbulence(x, y, params, noise) {
  const mix = 0.35 + params.typeAmount * 0.65
  return octaveLoop(x, y, params, noise, (n) => lerp(n, Math.abs(n), mix) * 2 - mix)
}

function terrace(n, amount) {
  const steps = Math.round(2 + amount * 14)
  const v = toUnit(n)
  return fromUnit(Math.floor(v * steps) / Math.max(1, steps - 1e-6))
}

function powerCurve(n, amount) {
  const exp = 0.3 + amount * 3.7
  return fromUnit(toUnit(n) ** exp)
}

function domainWarp(x, y, params, noise) {
  const warp = params.typeAmount * 1.8
  const qx = fbm(x + 17.2, y + 4.1, params, noise)
  const qy = fbm(x + 9.7, y + 22.4, params, noise)
  return fbm(x + warp * qx, y + warp * qy, params, noise)
}

function applyType(x, y, params, noise) {
  switch (params.type) {
    case 'ridged':
      return ridged(x, y, params, noise)
    case 'billow':
      return billow(x, y, params, noise)
    case 'turbulence':
      return turbulence(x, y, params, noise)
    case 'terracing':
      return terrace(fbm(x, y, params, noise), params.typeAmount)
    case 'power':
      return powerCurve(fbm(x, y, params, noise), params.typeAmount)
    case 'warp':
      return domainWarp(x, y, params, noise)
    default:
      return fbm(x, y, params, noise)
  }
}

function applyShaping(n, shaping, amount) {
  if (shaping === 'none') return fromUnit(toUnit(n))

  let v = toUnit(n)
  switch (shaping) {
    case 'gain':
      v = gain(v, amount)
      break
    case 'bias':
      v = clamp01(v + (amount - 0.5) * 1.2)
      break
    case 'contrast':
      v = clamp01((v - 0.5) * (1 + amount * 3.2) + 0.5)
      break
    case 'smooth':
      v = lerp(v, smoothstep(v), amount)
      break
    case 'invert':
      v = lerp(v, 1 - v, amount)
      break
    case 'gamma':
      v = clamp01(v) ** (0.25 + amount * 3)
      break
    default:
      break
  }
  return fromUnit(v)
}

export function sampleNoise(x, y, params, noise) {
  return applyShaping(applyType(x, y, params, noise), params.shaping, params.shapeAmount)
}

function blurHeightmap(source, size, passes) {
  if (passes <= 0) return source
  let input = source
  let output = new Float32Array(source.length)

  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let sum = 0
        let weight = 0
        for (let oy = -1; oy <= 1; oy += 1) {
          const sy = Math.min(size - 1, Math.max(0, y + oy))
          for (let ox = -1; ox <= 1; ox += 1) {
            const sx = Math.min(size - 1, Math.max(0, x + ox))
            const kernel = ox === 0 && oy === 0 ? 4 : ox === 0 || oy === 0 ? 2 : 1
            sum += input[sy * size + sx] * kernel
            weight += kernel
          }
        }
        output[y * size + x] = sum / weight
      }
    }
    const swap = input
    input = output
    output = swap
  }

  return input
}

export function fillHeightmap(params) {
  const size = Math.round(params.resolution)
  let data = new Float32Array(size * size)
  const last = Math.max(1, size - 1)
  const layers = params.layers ?? []
  const samplers = layers.map((layer) =>
    layer.enabled ? createSimplex2D(layer.seed) : null,
  )

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / last) * 2 - 1
      const v = (y / last) * 2 - 1
      let sum = 0
      let weight = 0

      for (let i = 0; i < layers.length; i += 1) {
        const layer = layers[i]
        if (!layer.enabled || layer.blend <= 0 || !samplers[i]) continue
        sum += sampleNoise(u, v, layer, samplers[i]) * layer.blend
        weight += layer.blend
      }

      data[y * size + x] = weight > 0 ? sum / weight : 0
    }
  }

  data = blurHeightmap(data, size, Math.round(params.smoothing ?? 0))

  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < data.length; i += 1) {
    min = Math.min(min, data[i])
    max = Math.max(max, data[i])
  }

  const range = Math.max(1e-6, max - min)
  const island = params.islandFalloff ?? 0
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / last) * 2 - 1
      const v = (y / last) * 2 - 1
      const distance = Math.sqrt(u * u + v * v)
      const edgeRaw = clamp01((distance - 0.5) / 0.58)
      const edge = edgeRaw * edgeRaw * (3 - 2 * edgeRaw)
      const normalized = ((data[y * size + x] - min) / range) * 1.6 - 0.72
      data[y * size + x] = Math.max(-1, Math.min(1, normalized - edge * island * 1.35))
    }
  }

  data = blurHeightmap(data, size, island > 0 ? 1 : 0)
  return data
}
