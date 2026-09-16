import { createSimplex2D } from '../noise/simplex2d.js'

export function createPrecipitationField(seed = 731) {
  return createSimplex2D(seed)
}

export function samplePrecipitation(noise, u, v, time, settings) {
  const movement = settings.rainMovement * time
  const scale = settings.rainScale
  const primary = noise((u + movement) * scale, (v + movement * 0.61) * scale)
  const detail = noise(
    (u - movement * 0.37 + 13.7) * scale * 0.53,
    (v + movement * 0.23 - 8.4) * scale * 0.53,
  )
  const normalized = Math.min(1, Math.max(0, primary * 0.36 + detail * 0.14 + 0.5))
  const storm = normalized * normalized * 1.85
  return Math.max(0.04, 1 + (storm - 1) * settings.rainVariation)
}
