import * as THREE from 'three'

/**
 * Levels of detail for one generated L-system.
 *
 * All three levels are built from the same branch graph (result.branches), so the
 * grammar, seed and turtle run once; a level only changes how the branches are meshed.
 *
 *   high    every generation · Catmull-Rom smoothing · 6 rings per segment · 10 sides · full knots
 *   medium  every generation · 2 rings per segment · 5 sides · low-poly knots
 *   low     generations 0–2 only (trunk, primary, secondary) · straight 3-sided tubes · no knots;
 *           every pruned generation-3 subtree is replaced by one straight proxy branch from its
 *           base to its farthest tip, so the crown keeps its outline
 *
 * Auto mode uses THREE.LOD: the level follows the camera's distance to the specimen centre,
 * with hysteresis so the level does not flicker at a threshold.
 */

export const LOD_LEVELS = ['high', 'medium', 'low']

export const LOD_SPEC = {
  high: { label: 'High', radial: 10, sub: 6, smooth: true, maxDepth: Infinity, knots: 'full' },
  medium: { label: 'Medium', radial: 5, sub: 2, smooth: true, maxDepth: Infinity, knots: 'simple' },
  low: { label: 'Low', radial: 3, sub: 1, smooth: false, maxDepth: 2, proxies: true, knots: 'none' },
}

/** Camera distance (to the specimen centre) where each level starts. */
export const LOD_DISTANCE = { high: 0, medium: 16, low: 24 }
/** A visible level is kept until the camera is this fraction closer than its threshold. */
export const LOD_HYSTERESIS = 0.1
export const LOD_CENTER = new THREE.Vector3(0, 2.6, 0)

const TAPER = 0.45
const BRANCH_COLOR = '#d9d4ca'
const KNOT_COLOR = '#b9b4aa'
const STONE_COLOR = '#7a7a75'

function createKnotGeometries() {
  return {
    full: { sphere: new THREE.SphereGeometry(1, 16, 12), ring: new THREE.TorusGeometry(1, 0.16, 12, 48) },
    simple: { sphere: new THREE.IcosahedronGeometry(1, 0), ring: new THREE.TorusGeometry(1, 0.16, 4, 12) },
  }
}

export function triangleCount(geometry) {
  return (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3
}

/** Ring centres along one branch: smoothed Catmull-Rom or straight, `sub` rings per segment. */
function sampleBranch(branch, spec) {
  const { points } = branch
  const rings = (points.length - 1) * spec.sub + 1
  const curve = spec.smooth && points.length > 2 ? new THREE.CatmullRomCurve3(points, false, 'centripetal') : null
  const centres = []
  for (let j = 0; j < rings; j += 1) {
    const t = j / (rings - 1)
    if (curve) {
      centres.push(curve.getPoint(t))
    } else {
      const k = Math.min(Math.floor(j / spec.sub), points.length - 2)
      const local = j / spec.sub - k
      centres.push(points[k].clone().lerp(points[k + 1], local))
    }
  }
  return centres
}

/**
 * One merged, indexed tube mesh for every kept branch.
 * Triangles are grouped per original segment ("piece") and sorted by distance from the root,
 * so the Growth slider is a draw range: count = pieces revealed × triangles per piece.
 */
function buildTubes(branches, spec) {
  const kept = []
  let proxies = 0
  for (const b of branches) {
    if (b.depth <= spec.maxDepth) {
      kept.push(b)
    } else if (spec.proxies && b.depth === spec.maxDepth + 1) {
      kept.push({ points: [b.points[0], b.tip], radii: [b.radii[0]], dists: [b.dists[0]], depth: b.depth })
      proxies += 1
    }
  }
  const { radial, sub } = spec
  let vertexCount = 0
  let pieceCount = 0
  for (const b of kept) {
    vertexCount += ((b.points.length - 1) * sub + 1) * radial
    pieceCount += b.points.length - 1
  }

  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const pieces = []
  const tangent = new THREE.Vector3()
  const previousTangent = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const binormal = new THREE.Vector3()
  const turn = new THREE.Quaternion()
  const direction = new THREE.Vector3()
  let vertex = 0

  for (const branch of kept) {
    const centres = sampleBranch(branch, spec)
    const rings = centres.length
    const base = vertex
    for (let j = 0; j < rings; j += 1) {
      const ahead = centres[Math.min(j + 1, rings - 1)]
      const behind = centres[Math.max(j - 1, 0)]
      tangent.subVectors(ahead, behind)
      if (tangent.lengthSq() < 1e-14) tangent.copy(previousTangent.lengthSq() ? previousTangent : THREE.Object3D.DEFAULT_UP)
      tangent.normalize()
      if (j === 0) {
        // Any perpendicular starts the frame; parallel transport keeps it from twisting.
        normal.set(0, 0, 1).cross(tangent)
        if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0).cross(tangent)
        normal.normalize()
      } else {
        turn.setFromUnitVectors(previousTangent, tangent)
        normal.applyQuaternion(turn).normalize()
      }
      binormal.crossVectors(tangent, normal)
      previousTangent.copy(tangent)

      const k = Math.min(Math.floor(j / sub), branch.radii.length - 1)
      const radius = branch.radii[k] * (1 - TAPER * (j / (rings - 1)))
      for (let s = 0; s < radial; s += 1) {
        const a = (s / radial) * Math.PI * 2
        direction.copy(normal).multiplyScalar(Math.cos(a)).addScaledVector(binormal, Math.sin(a))
        positions[vertex * 3] = centres[j].x + direction.x * radius
        positions[vertex * 3 + 1] = centres[j].y + direction.y * radius
        positions[vertex * 3 + 2] = centres[j].z + direction.z * radius
        normals[vertex * 3] = direction.x
        normals[vertex * 3 + 1] = direction.y
        normals[vertex * 3 + 2] = direction.z
        vertex += 1
      }
    }
    for (let k = 0; k < branch.dists.length; k += 1) pieces.push({ dist: branch.dists[k], ring: base + k * sub * radial })
  }

  pieces.sort((a, b) => a.dist - b.dist)
  const perPiece = sub * radial * 6
  const index = new Uint32Array(pieceCount * perPiece)
  const pieceDists = new Float32Array(pieceCount)
  let i = 0
  pieces.forEach((piece, p) => {
    pieceDists[p] = piece.dist
    for (let r = 0; r < sub; r += 1) {
      const row = piece.ring + r * radial
      for (let s = 0; s < radial; s += 1) {
        const a = row + s
        const b = row + ((s + 1) % radial)
        const c = a + radial
        const d = b + radial
        index[i++] = a
        index[i++] = c
        index[i++] = b
        index[i++] = b
        index[i++] = c
        index[i++] = d
      }
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  geometry.computeBoundingSphere()
  return { geometry, pieceDists, perPiece, branchCount: kept.length, proxies }
}

function upperBound(sorted, value) {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] <= value) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * The specimen as a THREE.LOD with one group per level (tube mesh + knot instances).
 * Level geometry is built on first use and cached until the L-system result changes;
 * materials and knot geometries are shared by all levels and live as long as this object.
 */
export class SpecimenLOD {
  constructor() {
    this.object = new THREE.LOD()
    this.object.position.copy(LOD_CENTER)
    this.materials = {
      branch: new THREE.MeshStandardMaterial({ color: BRANCH_COLOR, roughness: 0.55, metalness: 0 }),
      knot: new THREE.MeshStandardMaterial({ color: KNOT_COLOR, roughness: 0.55, metalness: 0 }),
    }
    this.knotGeometries = createKnotGeometries()
    this.empty = new THREE.BufferGeometry()
    this.levels = {}
    for (const id of LOD_LEVELS) {
      const group = new THREE.Group()
      group.position.copy(LOD_CENTER).negate()
      const tubes = new THREE.Mesh(this.empty, this.materials.branch)
      tubes.visible = false
      group.add(tubes)
      this.object.addLevel(group, LOD_DISTANCE[id], LOD_HYSTERESIS)
      this.levels[id] = { group, tubes, knots: null, built: null }
    }
    this.result = null
    this.isTracery = false
    this.mode = 'auto'
    this.growth = 1
    this.showKnots = true
  }

  setResult(result, isTracery) {
    if (result === this.result && isTracery === this.isTracery) return
    this.clearLevels()
    this.result = result
    this.knotDists = result.knots.map((k) => k.dist)
    this.isTracery = isTracery
    this.materials.branch.color.set(isTracery ? STONE_COLOR : BRANCH_COLOR)
    this.materials.branch.roughness = isTracery ? 0.85 : 0.55
    this.materials.knot.color.set(isTracery ? STONE_COLOR : KNOT_COLOR)
    this.materials.knot.roughness = this.materials.branch.roughness
    this.applyMode()
  }

  setMode(mode) {
    this.mode = mode
    this.applyMode()
  }

  applyMode() {
    if (!this.result) return
    const auto = this.mode === 'auto'
    this.object.autoUpdate = auto
    for (const id of LOD_LEVELS) {
      if (auto || id === this.mode) this.build(id)
      if (!auto) this.levels[id].group.visible = id === this.mode
    }
  }

  build(id) {
    const level = this.levels[id]
    if (level.built) return level.built
    const spec = LOD_SPEC[id]
    const built = buildTubes(this.result.branches, spec)
    level.tubes.geometry = built.geometry
    level.tubes.visible = true

    if (spec.knots !== 'none' && this.result.knots.length) {
      const set = this.knotGeometries[spec.knots]
      const geometry = this.isTracery ? set.ring : set.sphere
      const knots = new THREE.InstancedMesh(geometry, this.materials.knot, this.result.knots.length)
      const matrix = new THREE.Matrix4()
      const quaternion = new THREE.Quaternion()
      const scale = new THREE.Vector3()
      const z = new THREE.Vector3(0, 0, 1)
      this.result.knots.forEach((knot, i) => {
        quaternion.setFromUnitVectors(z, knot.n.clone().normalize())
        matrix.compose(knot.p, quaternion, scale.setScalar(knot.size))
        knots.setMatrixAt(i, matrix)
      })
      knots.instanceMatrix.needsUpdate = true
      knots.computeBoundingSphere()
      level.group.add(knots)
      level.knots = knots
      built.knotTriangles = triangleCount(geometry)
    } else {
      built.knotTriangles = 0
    }
    level.built = built
    this.applyGrowth(id)
    return built
  }

  setGrowth(growth) {
    this.growth = growth
    for (const id of LOD_LEVELS) this.applyGrowth(id)
  }

  setShowKnots(show) {
    this.showKnots = show
    for (const id of LOD_LEVELS) if (this.levels[id].knots) this.levels[id].knots.visible = show
  }

  setWireframe(on) {
    this.materials.branch.wireframe = on
    this.materials.knot.wireframe = on
  }

  applyGrowth(id) {
    const level = this.levels[id]
    if (!level.built || !this.result) return
    const cutoff = this.result.maxDist * this.growth
    const pieces = upperBound(level.built.pieceDists, cutoff + 1e-6)
    level.tubes.geometry.setDrawRange(0, pieces * level.built.perPiece)
    level.built.visiblePieces = pieces
    if (level.knots) {
      level.knots.count = upperBound(this.knotDists, cutoff + 1e-6)
      level.knots.visible = this.showKnots
    }
  }

  /** Level currently drawn: the manual choice, or the one THREE.LOD picked last frame. */
  currentLevel() {
    return this.mode === 'auto' ? LOD_LEVELS[this.object.getCurrentLevel()] : this.mode
  }

  /** Exact counts of the specimen at one level, read from the built geometry. */
  stats(id) {
    const level = this.levels[id]
    if (!level.built) return null
    const tubeTriangles = (level.built.visiblePieces * level.built.perPiece) / 3
    const knotTriangles = level.knots && level.knots.visible ? level.knots.count * level.built.knotTriangles : 0
    return { branches: level.built.branchCount, proxies: level.built.proxies, triangles: tubeTriangles + knotTriangles }
  }

  clearLevels() {
    for (const id of LOD_LEVELS) {
      const level = this.levels[id]
      if (level.built) level.built.geometry.dispose()
      level.tubes.geometry = this.empty
      level.tubes.visible = false
      if (level.knots) {
        level.group.remove(level.knots)
        level.knots.dispose()
        level.knots = null
      }
      level.built = null
    }
  }

  dispose() {
    this.clearLevels()
    this.result = null
    this.empty.dispose()
    Object.values(this.materials).forEach((m) => m.dispose())
    Object.values(this.knotGeometries).forEach((set) => Object.values(set).forEach((g) => g.dispose()))
  }
}
