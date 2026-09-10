const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6
const GRAD = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function dot(g, x, y) {
  return g[0] * x + g[1] * y
}

export function createSimplex2D(seed) {
  const source = new Uint8Array(256)
  for (let i = 0; i < 256; i += 1) source[i] = i

  let state = (Math.floor(seed * 1024) + 1) >>> 0
  for (let i = 255; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    const swap = source[i]
    source[i] = source[j]
    source[j] = swap
  }

  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i += 1) perm[i] = source[i & 255]

  return function simplex2(xin, yin) {
    const s = (xin + yin) * F2
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const t = (i + j) * G2
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)

    const i1 = x0 > y0 ? 1 : 0
    const j1 = x0 > y0 ? 0 : 1
    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2

    const ii = i & 255
    const jj = j & 255
    const gi0 = perm[ii + perm[jj]] % 8
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 8
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 8

    let n0 = 0
    let t0 = 0.5 - x0 * x0 - y0 * y0
    if (t0 >= 0) {
      t0 *= t0
      n0 = t0 * t0 * dot(GRAD[gi0], x0, y0)
    }

    let n1 = 0
    let t1 = 0.5 - x1 * x1 - y1 * y1
    if (t1 >= 0) {
      t1 *= t1
      n1 = t1 * t1 * dot(GRAD[gi1], x1, y1)
    }

    let n2 = 0
    let t2 = 0.5 - x2 * x2 - y2 * y2
    if (t2 >= 0) {
      t2 *= t2
      n2 = t2 * t2 * dot(GRAD[gi2], x2, y2)
    }

    return 70 * (n0 + n1 + n2)
  }
}
