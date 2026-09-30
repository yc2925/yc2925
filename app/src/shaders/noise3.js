export function rand(seed, key) {
  const t = Math.sin(seed * 12.9898 + key * 78.233) * 43758.5453
  return t - Math.floor(t)
}

function hash(ix, iy, iz) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export function valueNoise3(x, y, z) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hash(ix, iy, iz)
  const b = hash(ix + 1, iy, iz)
  const c = hash(ix, iy + 1, iz)
  const d = hash(ix + 1, iy + 1, iz)
  const e = hash(ix, iy, iz + 1)
  const f = hash(ix + 1, iy, iz + 1)
  const g = hash(ix, iy + 1, iz + 1)
  const h = hash(ix + 1, iy + 1, iz + 1)
  const x00 = a + (b - a) * ux
  const x10 = c + (d - c) * ux
  const x01 = e + (f - e) * ux
  const x11 = g + (h - g) * ux
  const y0 = x00 + (x10 - x00) * uy
  const y1 = x01 + (x11 - x01) * uy
  return y0 + (y1 - y0) * uz
}

/** Normalized to roughly 0–1 with mean 0.5 regardless of octave count. */
export function fbm3(x, y, z, octaves = 3) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let freq = 1
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * valueNoise3(x * freq, y * freq, z * freq)
    norm += amp
    freq *= 2.03
    amp *= 0.5
  }
  return sum / norm
}

export function ridge3(x, y, z, octaves = 3) {
  return 1 - Math.abs(fbm3(x, y, z, octaves) * 2 - 1)
}
