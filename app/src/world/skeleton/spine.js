/**
 * STRUCTURAL SPINE → Gothic skeleton (Step 47, Phase B1).
 *
 * Construction (all from the source curve, nothing hard-coded):
 *  1. Evaluate the curve, resample every ~0.5 m, build rotation-minimising
 *     frames {t, side, up} and signed curvature κ.
 *  2. Bay boundaries: n = round(L / spacing). Boundaries are placed at equal
 *     increments of ∫(1 + response·|κ|·spacing) ds, so bays compress on bends.
 *  3. Each boundary carries two piers at ±width/2 along `side` (nave), or one
 *     pier line when width = 0 (arcade).
 *  4. Springing S = H − rise_t, where H = height·verticality and
 *     rise_t = archRise·width (transverse arch rise). Height therefore sets
 *     the vault apex; archRise sets the proportion.
 *  5. Transverse arches across each boundary, arcade arches along each pier
 *     line, diagonal ribs crossing each bay to a boss (quadripartite vault,
 *     REF-004), optional ridge rib. Every arch is the two-centred pointed arch
 *     of the 13B primitive (REF-008 construction) placed in a vertical plane.
 *  6. Flying buttresses on the outside of each pier; reach grows on the outer
 *     side of bends (|κ|). Open-curve ends become towers with a tapered spire
 *     (REF-012 / REF-025 hierarchy).
 *  7. Protected volumes (pointed-arch prisms) for the nave tunnel and every
 *     arcade opening — the lithic stage may never fill them (REF-023 / 027).
 */

import { buildPointedArch } from '../../geometry/gothicGrammar/primitives/index.js'
import {
  UP,
  add,
  arcLengths,
  cross,
  dist,
  evaluateCurve,
  lerp3,
  norm,
  resampleByCount,
  rotationMinimisingFrames,
  scale,
  signedCurvature,
  sub,
  v3,
} from '../curves/curve3.js'
import { DEFAULT_SKELETON_PARAMS } from './params.js'

const EQUILATERAL = Math.sqrt(3) / 2
const horiz = (a) => norm(v3(a.x, 0, a.z))

/** Normalised pointed-arch profile: u ∈ [0,1] across span → height (m) for given span & rise. */
function archProfile(span, rise) {
  const ratio = Math.min(1.6, Math.max(0.35, rise / Math.max(span, 1e-6)))
  const family =
    Math.abs(ratio - EQUILATERAL) < 1e-3 ? 'equilateral' : ratio > EQUILATERAL ? 'lancet' : 'depressed'
  const arch = buildPointedArch({ family, span, riseRatio: ratio, springingY: 0, samplingQuality: 0.4 })
  const a = span / 2
  const h = ratio * span
  const c = (h * h - a * a) / (2 * a)
  const raw = [...(arch.samples?.left ?? []), ...(arch.samples?.right ?? []).slice(1)]
  // Down-sample to ~1 point per 0.6 m of span, keep apex.
  const target = Math.max(6, Math.ceil((span * 1.6) / 0.6))
  const step = Math.max(1, Math.floor(raw.length / target))
  const pts = raw.filter((_, i) => i % step === 0 || i === raw.length - 1)
  const apexIndex = (arch.samples?.left?.length ?? 1) - 1
  if (!pts.some((p) => Math.abs(p.x) < 1e-9) && raw[apexIndex]) {
    pts.push(raw[apexIndex])
    pts.sort((p, q) => p.x - q.x)
  }
  return {
    points: pts.map((p) => ({ u: (p.x + a) / span, y: p.y })),
    rise: h,
    a,
    c,
    R: a + c,
  }
}

/** 3D arch between A and B (both at springing), rising `rise` above the chord. */
function archBetween(A, B, rise) {
  const span = Math.hypot(B.x - A.x, B.z - A.z)
  if (span < 1e-3) return { points: [A, B], profile: null }
  const profile = archProfile(span, rise)
  const points = profile.points.map(({ u, y }) => {
    const base = lerp3(A, B, u)
    return add(base, scale(UP, y))
  })
  return { points, profile }
}

export function buildSpineSkeleton(curve, inputParams = {}) {
  const P = { ...DEFAULT_SKELETON_PARAMS, ...inputParams }
  const result = {
    kind: 'spine',
    sourceCurveId: curve.curveId,
    nodes: [],
    members: [],
    protected: [],
    bays: [],
    frames: [],
    sourcePolyline: [],
    stats: {},
    warnings: [],
  }
  const dense = evaluateCurve(curve)
  result.sourcePolyline = dense.points
  if (dense.points.length < 2 || dense.length < 1) {
    result.warnings.push('Curve too short for a skeleton (needs ≥ 2 points, ≥ 1 m).')
    return result
  }

  const sampleCount = Math.max(3, Math.ceil(dense.length / 0.5) + 1)
  const samples = resampleByCount(dense.points, sampleCount)
  const frames = rotationMinimisingFrames(samples)
  const kappa = signedCurvature(frames)
  const table = arcLengths(samples)
  const L = table[table.length - 1]

  // --- 2. bay boundaries by curvature-weighted arc length
  const bayCount = Math.max(1, Math.round(L / P.spacing))
  const W = [0]
  for (let i = 1; i < samples.length; i += 1) {
    const k = (Math.abs(kappa[i]) + Math.abs(kappa[i - 1])) / 2
    W.push(W[i - 1] + (table[i] - table[i - 1]) * (1 + P.curvatureResponse * k * P.spacing))
  }
  const boundaryIdx = []
  for (let b = 0, j = 0; b <= bayCount; b += 1) {
    const target = (W[W.length - 1] * b) / bayCount
    while (j < W.length - 1 && W[j + 1] < target) j += 1
    const pick = j < W.length - 1 && target - W[j] > W[j + 1] - target ? j + 1 : j
    boundaryIdx.push(b === bayCount ? samples.length - 1 : pick)
  }

  const H = P.height * P.verticality
  const halfW = P.width / 2
  const nave = P.width > 0.5
  const riseT = nave ? Math.min(P.archRise * P.width, H * 0.6) : 0
  const S = Math.max(2.5, H - riseT)
  const r = P.thickness

  let nodeSeq = 0
  let memberSeq = 0
  const node = (p, kind) => {
    const id = `n${nodeSeq++}`
    result.nodes.push({ id, p, kind })
    return id
  }
  const member = (kind, points, r0, r1 = r0, extra = {}) => {
    const id = `m${memberSeq++}`
    result.members.push({ id, kind, points, r0, r1, ...extra })
    return id
  }

  // --- 3. pier lines
  const boundaries = boundaryIdx.map((idx, b) => {
    const f = frames[idx]
    const side = horiz(f.side)
    const base = f.p
    const piers = nave
      ? [
          { sign: 1, base: add(base, scale(side, halfW)) },
          { sign: -1, base: add(base, scale(side, -halfW)) },
        ]
      : [{ sign: 0, base }]
    for (const pier of piers) {
      pier.top = add(pier.base, scale(UP, S))
      pier.baseNode = node(pier.base, 'pierBase')
      pier.topNode = node(pier.top, 'springing')
      member('pier', [pier.base, pier.top], r * 1.25, r, { boundary: b })
    }
    return { b, idx, frame: f, side, base, piers, kappa: kappa[idx] }
  })

  // --- 5a. transverse arches + their protected nave section
  const transverseApex = []
  for (const bd of boundaries) {
    if (!nave) {
      transverseApex.push(null)
      continue
    }
    const [left, right] = bd.piers
    const arch = archBetween(right.top, left.top, riseT)
    member('transverseArch', arch.points, r * 0.85, r * 0.85, { boundary: bd.b })
    const apex = arch.points.reduce((m, p) => (p.y > m.y ? p : m), arch.points[0])
    node(apex, 'apex')
    transverseApex.push(apex)
  }

  // --- 5b. per-bay arcades, diagonal ribs, boss, ridge; protected volumes
  for (let i = 0; i < bayCount; i += 1) {
    const A = boundaries[i]
    const B = boundaries[i + 1]
    const bayLength = table[B.idx] - table[A.idx]
    const kMid = kappa[Math.round((A.idx + B.idx) / 2)]
    result.bays.push({ index: i, s0: table[A.idx], s1: table[B.idx], length: bayLength, kappa: kMid })

    for (let p = 0; p < A.piers.length; p += 1) {
      const a = A.piers[p]
      const b = B.piers[p]
      const span = Math.hypot(b.top.x - a.top.x, b.top.z - a.top.z)
      const riseA = nave ? Math.min(P.archRise * span, riseT * 0.85) : P.archRise * span
      const arch = archBetween(a.top, b.top, riseA)
      member('arcadeArch', arch.points, r * 0.75, r * 0.75, { bay: i })
      if (arch.profile) {
        const xAxis = horiz(sub(b.base, a.base))
        const zAxis = norm(cross(xAxis, UP))
        result.protected.push({
          kind: 'archPrism',
          role: 'arcadeOpening',
          bay: i,
          origin: lerp3(a.base, b.base, 0.5),
          xAxis,
          yAxis: UP,
          zAxis,
          a: Math.max(0.2, arch.profile.a - r * 1.4),
          c: arch.profile.c,
          R: arch.profile.R - r * 1.4,
          springY: S,
          floorY: -2,
          halfDepth: Math.max(1.2, r * 3.5),
        })
      }
    }

    if (nave) {
      const boss = add(lerp3(A.base, B.base, 0.5), scale(UP, S + riseT * 1.02))
      node(boss, 'boss')
      if (P.ribDensity >= 1) {
        for (const [from, to] of [
          [A.piers[0].top, B.piers[1].top],
          [A.piers[1].top, B.piers[0].top],
        ]) {
          const half1 = archBetween(from, to, riseT * 1.02)
          member('diagonalRib', half1.points, r * 0.6, r * 0.6, { bay: i })
        }
      }
      if (P.ribDensity >= 2 && transverseApex[i] && transverseApex[i + 1]) {
        member('ridgeRib', [transverseApex[i], boss, transverseApex[i + 1]], r * 0.45, r * 0.45, { bay: i })
      }
      // Nave tunnel protected volume (pointed-arch prism through the bay).
      const prof = archProfile(P.width, riseT)
      const xAxis = norm(lerp3(A.side, B.side, 0.5))
      result.protected.push({
        kind: 'archPrism',
        role: 'naveTunnel',
        bay: i,
        origin: lerp3(A.base, B.base, 0.5),
        xAxis,
        yAxis: UP,
        zAxis: norm(cross(xAxis, UP)),
        a: Math.max(0.3, prof.a - r * 1.4),
        c: prof.c,
        R: prof.R - r * 1.4,
        springY: S,
        floorY: -2,
        halfDepth: bayLength / 2 + r * 2,
      })
    }
  }

  // --- 6a. flying buttresses
  if (P.buttressDepth > 0) {
    for (const bd of boundaries) {
      for (const pier of bd.piers) {
        const outward = pier.sign === 0 ? bd.side : scale(bd.side, pier.sign)
        // Outer side of a bend = opposite to the turning direction.
        const outer = pier.sign !== 0 && Math.sign(bd.kappa) === -pier.sign
        const grow = outer ? 1 + P.curvatureResponse * Math.abs(bd.kappa) * P.width * 2 : 1
        const reach = P.buttressDepth * H * Math.min(grow, 2.5)
        if (reach < 0.5) continue
        const foot = add(pier.base, scale(outward, reach))
        const footTop = add(foot, scale(UP, S * 0.62))
        node(foot, 'buttressFoot')
        member('buttressPier', [foot, footTop], r * 1.1, r * 0.8, { boundary: bd.b })
        const flyerEnd = add(pier.base, scale(UP, S * 0.95))
        const mid = add(lerp3(footTop, flyerEnd, 0.5), scale(UP, S * 0.06))
        member('flyingButtress', [footTop, mid, flyerEnd], r * 0.55, r * 0.45, { boundary: bd.b })
      }
    }
  }

  // --- 6b. end towers + spires (open curves only)
  if (P.spireIntensity > 0 && !curve.closed) {
    for (const bd of [boundaries[0], boundaries[boundaries.length - 1]]) {
      const towerTop = H * (1 + 0.25 * P.spireIntensity)
      for (const pier of bd.piers) {
        member('tower', [pier.top, add(pier.base, scale(UP, towerTop))], r * 1.1, r * 0.9, {
          boundary: bd.b,
        })
      }
      const centre = add(bd.base, scale(UP, towerTop))
      const tops = bd.piers.map((pier) => add(pier.base, scale(UP, towerTop)))
      member('towerCrown', tops.length > 1 ? [tops[0], centre, tops[1]] : [tops[0], add(centre, scale(UP, r))], r * 0.8, r * 0.8, {
        boundary: bd.b,
      })
      const tip = add(bd.base, scale(UP, towerTop + H * 0.9 * P.spireIntensity))
      node(tip, 'spireTip')
      member('spire', [centre, tip], r * (1.2 + halfW * 0.12), r * 0.12, { boundary: bd.b })
    }
  }

  result.frames = frames.filter((_, i) => i % 4 === 0)
  result.stats = {
    length: L,
    bayCount,
    springing: S,
    vaultApex: S + riseT,
    nodes: result.nodes.length,
    members: result.members.length,
    protected: result.protected.length,
  }
  result.bounds = skeletonBounds(result)
  return result
}

export function skeletonBounds(skeleton) {
  const min = v3(Infinity, Infinity, Infinity)
  const max = v3(-Infinity, -Infinity, -Infinity)
  for (const m of skeleton.members) {
    const pad = Math.max(m.r0, m.r1)
    for (const p of m.points) {
      min.x = Math.min(min.x, p.x - pad)
      min.y = Math.min(min.y, p.y - pad)
      min.z = Math.min(min.z, p.z - pad)
      max.x = Math.max(max.x, p.x + pad)
      max.y = Math.max(max.y, p.y + pad)
      max.z = Math.max(max.z, p.z + pad)
    }
  }
  return { min, max }
}

/** Connectivity check: every member endpoint lies near another member or the ground. */
export function validateSkeleton(skeleton, tol = 0.05) {
  const errors = []
  for (const m of skeleton.members) {
    for (let i = 1; i < m.points.length; i += 1) {
      if (dist(m.points[i - 1], m.points[i]) < 1e-6) errors.push(`${m.id}: zero-length segment`)
    }
    for (const p of m.points) {
      if (![p.x, p.y, p.z].every(Number.isFinite)) errors.push(`${m.id}: non-finite point`)
    }
  }
  const segDist = (p, a, b) => {
    const ab = sub(b, a)
    const l2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / l2)) : 0
    return dist(p, add(a, scale(ab, t)))
  }
  const groundY = skeleton.sourcePolyline.reduce((lo, q) => Math.min(lo, q.y), Infinity)
  const touches = (p, self) =>
    p.y <= groundY + tol ||
    skeleton.members.some((m) => {
      if (m === self) return false
      const reach = tol + Math.max(m.r0, m.r1)
      for (let i = 1; i < m.points.length; i += 1) if (segDist(p, m.points[i - 1], m.points[i]) < reach) return true
      return false
    })
  for (const m of skeleton.members) {
    if (m.kind === 'spire') continue // tip is free by design
    for (const p of [m.points[0], m.points[m.points.length - 1]]) {
      if (!touches(p, m)) errors.push(`${m.id} (${m.kind}): disconnected endpoint`)
    }
  }
  return { valid: errors.length === 0, errors }
}
