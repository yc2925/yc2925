function meshIndex(x, y, z, resolution) {
  return x + y * resolution + z * resolution * resolution
}

function sampleMesh(chunk, x, y, z) {
  const resolution = chunk.meshResolution
  if (
    x < 0 ||
    y < 0 ||
    z < 0 ||
    x >= resolution ||
    y >= resolution ||
    z >= resolution
  ) {
    return -1
  }
  return chunk.meshDensity[meshIndex(x, y, z, resolution)]
}

function isSolid(value) {
  return value > 0
}

function interpolate(a, b) {
  const delta = b - a
  if (Math.abs(delta) < 1e-6) return 0.5
  return a / (a - b)
}

function gradient(chunk, x, y, z) {
  const nx = sampleMesh(chunk, x - 1, y, z) - sampleMesh(chunk, x + 1, y, z)
  const ny = sampleMesh(chunk, x, y - 1, z) - sampleMesh(chunk, x, y + 1, z)
  const nz = sampleMesh(chunk, x, y, z - 1) - sampleMesh(chunk, x, y, z + 1)
  const length = Math.hypot(nx, ny, nz) || 1
  return [nx / length, ny / length, nz / length]
}

function gridToWorld(gx, gy, gz, volume) {
  const cellSize = volume.worldSize / volume.resolution
  const half = (volume.resolution - 1) * 0.5
  return [(gx - half) * cellSize, (gy - half) * cellSize, (gz - half) * cellSize]
}

function pushQuad(positions, indices, corners, flip) {
  const start = positions.length / 3
  const order = flip ? [0, 1, 2, 0, 2, 3] : [0, 3, 2, 0, 2, 1]
  for (const corner of corners) positions.push(corner[0], corner[1], corner[2])
  for (const index of order) indices.push(start + index)
}

function createEmptyMesh() {
  return {
    positions: new Float32Array(0),
    indices: new Uint32Array(0),
  }
}

export function meshGreedy(chunk, volume) {
  const size = chunk.dimensions[0]
  const positions = []
  const indices = []

  function occupied(lx, ly, lz) {
    return isSolid(sampleMesh(chunk, lx + 1, ly + 1, lz + 1))
  }

  for (let axis = 0; axis < 3; axis += 1) {
    const u = (axis + 1) % 3
    const v = (axis + 2) % 3
    const cursor = [0, 0, 0]
    const offset = [0, 0, 0]
    offset[axis] = 1
    const mask = new Int8Array(size * size)

    for (cursor[axis] = -1; cursor[axis] < size; ) {
      let n = 0
      for (cursor[v] = 0; cursor[v] < size; cursor[v] += 1) {
        for (cursor[u] = 0; cursor[u] < size; cursor[u] += 1, n += 1) {
          const current = occupied(cursor[0], cursor[1], cursor[2])
          const neighbor = occupied(
            cursor[0] + offset[0],
            cursor[1] + offset[1],
            cursor[2] + offset[2],
          )
          mask[n] = current === neighbor ? 0 : current ? 1 : -1
        }
      }

      cursor[axis] += 1
      n = 0
      for (let j = 0; j < size; j += 1) {
        for (let i = 0; i < size; ) {
          const sign = mask[n]
          if (sign === 0) {
            i += 1
            n += 1
            continue
          }

          let width = 1
          while (i + width < size && mask[n + width] === sign) width += 1

          let height = 1
          outer: while (j + height < size) {
            for (let k = 0; k < width; k += 1) {
              if (mask[n + k + height * size] !== sign) break outer
            }
            height += 1
          }

          const origin = [0, 0, 0]
          origin[u] = i
          origin[v] = j
          origin[axis] = cursor[axis]
          const du = [0, 0, 0]
          const dv = [0, 0, 0]
          du[u] = width
          dv[v] = height

          const shift = [0, 0, 0]
          shift[axis] = -0.5
          const corners = [
            gridToWorld(
              chunk.origin[0] + origin[0] + shift[0],
              chunk.origin[1] + origin[1] + shift[1],
              chunk.origin[2] + origin[2] + shift[2],
              volume,
            ),
            gridToWorld(
              chunk.origin[0] + origin[0] + du[0] + shift[0],
              chunk.origin[1] + origin[1] + du[1] + shift[1],
              chunk.origin[2] + origin[2] + du[2] + shift[2],
              volume,
            ),
            gridToWorld(
              chunk.origin[0] + origin[0] + du[0] + dv[0] + shift[0],
              chunk.origin[1] + origin[1] + du[1] + dv[1] + shift[1],
              chunk.origin[2] + origin[2] + du[2] + dv[2] + shift[2],
              volume,
            ),
            gridToWorld(
              chunk.origin[0] + origin[0] + dv[0] + shift[0],
              chunk.origin[1] + origin[1] + dv[1] + shift[1],
              chunk.origin[2] + origin[2] + dv[2] + shift[2],
              volume,
            ),
          ]
          pushQuad(positions, indices, corners, sign < 0)

          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) mask[n + x + y * size] = 0
          }
          i += width
          n += width
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  }
}

function collectEdgeHits(chunk, x, y, z) {
  const corners = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ]
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ]
  const values = corners.map(([dx, dy, dz]) => sampleMesh(chunk, x + dx, y + dy, z + dz))
  const points = []
  const normals = []

  for (const [a, b] of edges) {
    if (isSolid(values[a]) === isSolid(values[b])) continue
    const t = interpolate(values[a], values[b])
    const ax = x + corners[a][0]
    const ay = y + corners[a][1]
    const az = z + corners[a][2]
    const bx = x + corners[b][0]
    const by = y + corners[b][1]
    const bz = z + corners[b][2]
    const px = ax + (bx - ax) * t
    const py = ay + (by - ay) * t
    const pz = az + (bz - az) * t
    points.push([px, py, pz])
    normals.push(gradient(chunk, Math.round(px), Math.round(py), Math.round(pz)))
  }

  return { points, normals, crossed: points.length > 0 }
}

function averagePoint(points) {
  const sum = [0, 0, 0]
  for (const point of points) {
    sum[0] += point[0]
    sum[1] += point[1]
    sum[2] += point[2]
  }
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length]
}

function solveQef(points, normals, cellMin) {
  const mass = averagePoint(points)
  const ata = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  const atb = [0, 0, 0]

  for (let i = 0; i < points.length; i += 1) {
    const [nx, ny, nz] = normals[i]
    const px = points[i][0] - mass[0]
    const py = points[i][1] - mass[1]
    const pz = points[i][2] - mass[2]
    ata[0] += nx * nx
    ata[1] += nx * ny
    ata[2] += nx * nz
    ata[3] += ny * nx
    ata[4] += ny * ny
    ata[5] += ny * nz
    ata[6] += nz * nx
    ata[7] += nz * ny
    ata[8] += nz * nz
    const bias = nx * px + ny * py + nz * pz
    atb[0] += nx * bias
    atb[1] += ny * bias
    atb[2] += nz * bias
  }

  const solved = solve3x3(ata, atb)
  const vertex = solved ?? [0, 0, 0]
  return [
    clamp(mass[0] + vertex[0] * 1.35, cellMin[0] + 0.02, cellMin[0] + 0.98),
    clamp(mass[1] + vertex[1] * 1.35, cellMin[1] + 0.02, cellMin[1] + 0.98),
    clamp(mass[2] + vertex[2] * 1.35, cellMin[2] + 0.02, cellMin[2] + 0.98),
  ]
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function solve3x3(m, b) {
  const a = m.slice()
  const x = b.slice()
  for (let pivot = 0; pivot < 3; pivot += 1) {
    let best = pivot
    for (let row = pivot + 1; row < 3; row += 1) {
      if (Math.abs(a[row * 3 + pivot]) > Math.abs(a[best * 3 + pivot])) best = row
    }
    if (Math.abs(a[best * 3 + pivot]) < 1e-6) return null
    if (best !== pivot) {
      for (let column = 0; column < 3; column += 1) {
        const index = pivot * 3 + column
        const swap = a[index]
        a[index] = a[best * 3 + column]
        a[best * 3 + column] = swap
      }
      const swapB = x[pivot]
      x[pivot] = x[best]
      x[best] = swapB
    }
    const scale = 1 / a[pivot * 3 + pivot]
    for (let column = pivot; column < 3; column += 1) a[pivot * 3 + column] *= scale
    x[pivot] *= scale
    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue
      const factor = a[row * 3 + pivot]
      for (let column = pivot; column < 3; column += 1) {
        a[row * 3 + column] -= factor * a[pivot * 3 + column]
      }
      x[row] -= factor * x[pivot]
    }
  }
  return x
}

function meshDualField(chunk, volume, placeVertex) {
  const size = chunk.dimensions[0]
  const stride = size + 2
  const vertices = new Array(stride ** 3)
  const positions = []
  const indices = []

  function cellKey(cx, cy, cz) {
    return cx + 1 + (cy + 1) * stride + (cz + 1) * stride * stride
  }

  for (let cz = -1; cz < size; cz += 1) {
    for (let cy = -1; cy < size; cy += 1) {
      for (let cx = -1; cx < size; cx += 1) {
        const mx = cx + 1
        const my = cy + 1
        const mz = cz + 1
        const hits = collectEdgeHits(chunk, mx, my, mz)
        if (!hits.crossed) continue
        const local = placeVertex(hits.points, hits.normals, [mx, my, mz])
        vertices[cellKey(cx, cy, cz)] = gridToWorld(
          chunk.origin[0] + local[0] - 1,
          chunk.origin[1] + local[1] - 1,
          chunk.origin[2] + local[2] - 1,
          volume,
        )
      }
    }
  }

  function emitQuad(cells, flip) {
    const corners = cells.map(([cx, cy, cz]) => vertices[cellKey(cx, cy, cz)])
    if (corners.some((corner) => !corner)) return
    pushQuad(positions, indices, corners, flip)
  }

  for (let cz = 0; cz < size; cz += 1) {
    for (let cy = 0; cy < size; cy += 1) {
      for (let cx = 0; cx < size; cx += 1) {
        const mx = cx + 1
        const my = cy + 1
        const mz = cz + 1
        const xSolid = isSolid(sampleMesh(chunk, mx, my, mz))
        if (xSolid !== isSolid(sampleMesh(chunk, mx + 1, my, mz))) {
          emitQuad(
            [
              [cx, cy - 1, cz - 1],
              [cx, cy, cz - 1],
              [cx, cy, cz],
              [cx, cy - 1, cz],
            ],
            !xSolid,
          )
        }
        if (xSolid !== isSolid(sampleMesh(chunk, mx, my + 1, mz))) {
          emitQuad(
            [
              [cx - 1, cy, cz - 1],
              [cx, cy, cz - 1],
              [cx, cy, cz],
              [cx - 1, cy, cz],
            ],
            xSolid,
          )
        }
        if (xSolid !== isSolid(sampleMesh(chunk, mx, my, mz + 1))) {
          emitQuad(
            [
              [cx - 1, cy - 1, cz],
              [cx, cy - 1, cz],
              [cx, cy, cz],
              [cx - 1, cy, cz],
            ],
            !xSolid,
          )
        }
      }
    }
  }

  if (positions.length === 0) return createEmptyMesh()
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  }
}

export function meshSurfaceNets(chunk, volume) {
  return meshDualField(chunk, volume, (points, _normals, cellMin) => {
    const avg = averagePoint(points)
    return [
      avg[0] * 0.65 + (cellMin[0] + 0.5) * 0.35,
      avg[1] * 0.65 + (cellMin[1] + 0.5) * 0.35,
      avg[2] * 0.65 + (cellMin[2] + 0.5) * 0.35,
    ]
  })
}

export function meshDualContouring(chunk, volume) {
  return meshDualField(chunk, volume, (points, normals, cellMin) =>
    solveQef(points, normals, cellMin),
  )
}

export function createMeshGeometry(method, chunk, volume) {
  if (method === 'greedy') return meshGreedy(chunk, volume)
  if (method === 'surfaceNets') return meshSurfaceNets(chunk, volume)
  if (method === 'dualContouring') return meshDualContouring(chunk, volume)
  return createEmptyMesh()
}
