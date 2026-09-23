function fade(value) {
  return value * value * value * (value * (value * 6 - 15) + 10)
}

function lerp(a, b, amount) {
  return a + (b - a) * amount
}

function hash3D(x, y, z, seed) {
  let value = Math.imul(x, 374761393)
  value = Math.imul(value ^ Math.imul(y, 668265263), 1274126177)
  value = Math.imul(value ^ Math.imul(z, 2147483647), 2246822519)
  value = Math.imul(value ^ seed, 3266489917)
  value ^= value >>> 13
  return (value >>> 0) / 4294967295
}

export function createValueNoise3D(seed = 1) {
  const integerSeed = Math.floor(seed * 8192)

  return function valueNoise3D(x, y, z) {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const z0 = Math.floor(z)
    const tx = fade(x - x0)
    const ty = fade(y - y0)
    const tz = fade(z - z0)

    const c000 = hash3D(x0, y0, z0, integerSeed)
    const c100 = hash3D(x0 + 1, y0, z0, integerSeed)
    const c010 = hash3D(x0, y0 + 1, z0, integerSeed)
    const c110 = hash3D(x0 + 1, y0 + 1, z0, integerSeed)
    const c001 = hash3D(x0, y0, z0 + 1, integerSeed)
    const c101 = hash3D(x0 + 1, y0, z0 + 1, integerSeed)
    const c011 = hash3D(x0, y0 + 1, z0 + 1, integerSeed)
    const c111 = hash3D(x0 + 1, y0 + 1, z0 + 1, integerSeed)

    const x00 = lerp(c000, c100, tx)
    const x10 = lerp(c010, c110, tx)
    const x01 = lerp(c001, c101, tx)
    const x11 = lerp(c011, c111, tx)
    return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz) * 2 - 1
  }
}
