/**
 * Skeleton → carved Gothic masonry (Step 47, round 2).
 * References: REF-030 (voussoir coursing), REF-004 (drums, bosses, capitals),
 * REF-007 / REF-012 (pinnacles, crockets, finials), REF-008 (tracery bar
 * sections), REF-018 / REF-020 (grotesques).
 *
 * Order of placement (a spatial hash rejects later stones that would
 * overlap earlier ones, so carved pieces displace plain courses):
 *  1. Carved pieces at the skeleton's ornament sites — keystone at the arch
 *     apex, bosses at joints, capitals / moulded bases on columns, pinnacles,
 *     crockets and finial on gables, grotesques at springings and buttresses.
 *  2. Tracery members (sub-arches, mullions, oculi, foils, rails, gables) as
 *     carved bar segments with a hollow-chamfered section, laid along the
 *     exact construction curves.
 *  3. Structural members:
 *     - columns and shafts → drums (one per course);
 *     - arching members (main rib, archivolts, springers, flyers) →
 *       voussoirs: thin axis along the tangent, long axis toward the centre
 *       of curvature, wedged by curvature; a single-stone section uses the
 *       moulded rib profile;
 *     - piers → coursed ashlar with varied block lengths;
 *     - runs on the ground → coursed ashlar footings, varied block lengths.
 *  4. Plinths at ground contacts. (No loose gravel / pebbles: removed in Step 49.)
 * Colours come only from the ten-colour palette (palette.js).
 */

import { Matrix4, Quaternion, Vector3 } from 'three'
import { rotationMinimisingFrames } from '../curves/curve3.js'
import { mulberry32 } from '../skeleton/members.js'
import { DEFAULT_LITHIC_PARAMS } from './params.js'
import { stoneColor } from './palette.js'
import { BOSS_LOBES, CARVED, protoIndex } from './protos.js'

export { PROTOTYPE_COUNT } from './protos.js'

const TRACERY_KINDS = new Set(['subarch', 'mullion', 'oculus', 'foil', 'rail', 'gable'])

const m4 = new Matrix4()
const qt = new Quaternion()
const vx = new Vector3()
const vy = new Vector3()
const vz = new Vector3()

function quatFromAxes(x, y, z) {
  vx.set(x.x, x.y, x.z)
  vy.set(y.x, y.y, y.z)
  vz.set(z.x, z.y, z.z)
  m4.makeBasis(vx, vy, vz)
  qt.setFromRotationMatrix(m4)
  return [qt.x, qt.y, qt.z, qt.w]
}

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s })
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const len = (a) => Math.hypot(a.x, a.y, a.z)
const norm = (a) => {
  const l = len(a) || 1
  return { x: a.x / l, y: a.y / l, z: a.z / l }
}
const UPV = { x: 0, y: 1, z: 0 }
function rotate(v, k, a) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)))
}
/** Orthonormal basis keeping y exactly, x as close as possible to the hint. */
function basis(xHint, y) {
  const Y = norm(y)
  let X = sub(xHint, mul(Y, dot(xHint, Y)))
  if (len(X) < 1e-4) X = Math.abs(Y.y) < 0.9 ? cross(Y, UPV) : cross(Y, { x: 1, y: 0, z: 0 })
  X = norm(X)
  return { X, Y }
}

function resampleBySpacing(points, radii, spacing) {
  const out = [points[0]]
  const outR = [radii[0]]
  let carry = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const seg = len(sub(b, a))
    let t = spacing - carry
    while (t <= seg) {
      const u = t / seg
      out.push(add(a, mul(sub(b, a), u)))
      outR.push(radii[i - 1] + (radii[i] - radii[i - 1]) * u)
      t += spacing
    }
    carry = seg - (t - spacing)
  }
  if (len(sub(out[out.length - 1], points[points.length - 1])) > spacing * 0.3) {
    out.push(points[points.length - 1])
    outR.push(radii[radii.length - 1])
  }
  return { points: out, radii: outR }
}

function cumulative(points) {
  const cum = [0]
  for (let i = 1; i < points.length; i += 1) cum.push(cum[i - 1] + len(sub(points[i], points[i - 1])))
  return cum
}

function pointAt(points, cum, s) {
  let i = 0
  while (i < cum.length - 2 && cum[i + 1] < s) i += 1
  const seg = Math.max(1e-9, cum[i + 1] - cum[i])
  const u = Math.max(0, Math.min(1, (s - cum[i]) / seg))
  return { p: add(points[i], mul(sub(points[i + 1], points[i]), u)), i }
}

/**
 * Split a length into n ≈ total/target blocks of varied length (±variation),
 * rescaled to fill it exactly — no slivers, no brick rhythm.
 */
function blockLengths(total, target, variation, rand) {
  const n = Math.max(1, Math.round(total / target))
  const raw = []
  for (let i = 0; i < n; i += 1) raw.push(1 + (0.25 + variation) * (rand() * 2 - 1))
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map((r) => (r / sum) * total)
}

class SpatialHash {
  constructor(cell) {
    this.cell = cell
    this.map = new Map()
  }
  overlaps(p, r) {
    const c = this.cell
    const ix = Math.floor(p.x / c)
    const iy = Math.floor(p.y / c)
    const iz = Math.floor(p.z / c)
    const reach = Math.ceil(r / c)
    for (let dx = -reach; dx <= reach; dx += 1)
      for (let dy = -reach; dy <= reach; dy += 1)
        for (let dz = -reach; dz <= reach; dz += 1) {
          const list = this.map.get(`${ix + dx},${iy + dy},${iz + dz}`)
          if (!list) continue
          for (const o of list) if (Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z) < o.r + r) return o
        }
    return null
  }
  insert(p, r, idx = -1) {
    const k = `${Math.floor(p.x / this.cell)},${Math.floor(p.y / this.cell)},${Math.floor(p.z / this.cell)}`
    let list = this.map.get(k)
    if (!list) this.map.set(k, (list = []))
    list.push({ x: p.x, y: p.y, z: p.z, r, idx })
  }
}

export function buildStones(skeleton, inputParams = {}, seed = 1) {
  const P = { ...DEFAULT_LITHIC_PARAMS, ...inputParams }
  const rand = mulberry32(((seed + 101) * 2246822519) >>> 0)
  const stones = []
  const stats = { slots: 0, rejected: 0, skipped: 0, carved: 0 }
  // Debug trace (pure data; never changes placement): every slot that did NOT
  // become a stone (skipped by density, rejected by overlap — with the stone
  // that blocked it), and per-phase counts and timings. Placed stones carry
  // their phase; their order in `stones` is the placement order.
  const trace = { slots: [], phases: {} }
  let phase = 'carved'
  let phaseT0 = 0
  const ph = () => (trace.phases[phase] ??= { slots: 0, placed: 0, rejected: 0, skipped: 0, ms: 0 })
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const enter = (name) => {
    const t = now()
    if (trace.phases[phase]) trace.phases[phase].ms += t - phaseT0
    phase = name
    phaseT0 = t
    ph()
  }
  if (!skeleton?.members?.length || !skeleton.bounds) return { stones, stats, trace }
  phaseT0 = now()
  ph()
  const hash = new SpatialHash(Math.max(0.5, P.stoneSize * 1.2))
  const yTop = Math.max(1, skeleton.bounds.max.y)
  const grade = (y) => 1 + P.sizeGrading * (0.45 - 0.85 * Math.min(1, Math.max(0, y / yTop)))
  const vary = () => 1 + P.sizeVariation * (rand() * 2 - 1)
  const tilt = (P.tiltJitter * Math.PI) / 180
  const gapF = P.gap
  const role = skeleton.role ?? 'rib'

  /**
   * Place one stone. opts: { proto, kind, piece, allowGround, check, insert, carved, noTilt }.
   */
  function place(center, X, Y, size, opts) {
    const { proto, kind, piece, allowGround = false, check = true, insert = true, noTilt = false } = opts
    stats.slots += 1
    ph().slots += 1
    if (!CARVED.has(kind) && kind !== 'gravel' && rand() > P.density) {
      stats.skipped += 1
      ph().skipped += 1
      trace.slots.push({ p: [center.x, center.y, center.z], outcome: 'skipped', phase, kind, piece })
      return false
    }
    let x = X
    let y = Y
    if (tilt > 0 && !noTilt) {
      const axis = norm({ x: rand() - 0.5, y: rand() - 0.5, z: rand() - 0.5 })
      const a = (rand() * 2 - 1) * tilt
      x = rotate(x, axis, a)
      y = rotate(y, axis, a)
    }
    const z = norm(cross(x, y))
    const g = CARVED.has(kind) ? gapF * 0.3 : gapF
    const s = [Math.max(0.03, size[0] - g), Math.max(0.03, size[1] - g), Math.max(0.03, size[2] - g)]
    const halfY = Math.abs(x.y) * s[0] * 0.5 + Math.abs(y.y) * s[1] * 0.5 + Math.abs(z.y) * s[2] * 0.5
    const c = { ...center }
    if (c.y - halfY < 0 && (allowGround || c.y < halfY)) c.y = halfY
    const inner = Math.min(s[0], s[1], s[2]) * 0.48
    const hit = check ? hash.overlaps(c, inner) : null
    if (hit) {
      stats.rejected += 1
      ph().rejected += 1
      trace.slots.push({ p: [c.x, c.y, c.z], outcome: 'rejected', phase, kind, piece, r: inner, blockedBy: hit.idx, blockerKind: stones[hit.idx]?.kind ?? null })
      return false
    }
    // Carved pieces reserve only their own core, so drums / voussoirs still fill up to them.
    if (insert) hash.insert(c, inner, stones.length)
    ph().placed += 1
    // One quarry batch per structure (material), tone per group of courses.
    const col = stoneColor(rand, { stoneMix: P.stoneMix, weathering: P.weathering, y: c.y, yTop, carved: CARVED.has(kind), light: TRACERY_KINDS.has(kind), materialKey: skeleton.sourceCurveId ?? '', courseKey: piece, seed })
    if (CARVED.has(kind)) stats.carved += 1
    stones.push({ p: [c.x, c.y, c.z], q: quatFromAxes(x, y, z), s, proto, color: col.color, paletteIndex: col.paletteIndex, piece, kind, phase })
    return true
  }

  // ------------------------------------------------ 1. carved pieces
  const C = P.carvingScale
  for (const [i, o] of (skeleton.ornaments ?? []).entries()) {
    const piece = `orn${i}`
    const { X, Y } = basis(o.x, o.y)
    const opts = (kind, variant = 0) => ({ proto: protoIndex(kind, variant), kind, piece: `${piece}/${kind}`, check: false, noTilt: true, allowGround: true })
    if (o.type === 'keystone') {
      const R = o.size * P.formationWidth
      const s = [R * 1.5 * C, R * 2.9 * C, R * 2.3 * C]
      place(sub(o.p, mul(Y, s[1] * 0.18)), X, Y, s, opts('keystone'))
    } else if (o.type === 'boss') {
      const d = o.size * 2 * C
      const lobes = o.lobes ?? 4
      const v = Math.max(0, BOSS_LOBES.indexOf(Math.min(6, Math.max(4, lobes))))
      place(add(o.p, mul(Y, d * 0.12)), X, Y, [d, d * 0.5, d], opts('boss', v))
    } else if (o.type === 'capital') {
      // Formation width widens the capital to cap the masonry; its height follows the member.
      const c = o.size * P.formationWidth * 1.2 * C
      const ch = o.size * 1.2 * C * 0.9
      place(sub(o.p, mul(Y, ch * 0.47)), X, Y, [2 * c, ch, 2 * c], opts('capital'))
    } else if (o.type === 'base') {
      const b = o.size * P.formationWidth * 1.1 * C
      const bh = o.size * 1.1 * C * 0.76
      place(add(o.p, mul(Y, bh * 0.5)), X, Y, [2 * b, bh, 2 * b], opts('base'))
    } else if (o.type === 'pinnacle') {
      const w = o.size * 2 * P.formationWidth * Math.min(1.4, C)
      const H = (o.height ?? o.size * 6) * C
      place(add(o.p, mul(Y, H / 2)), X, Y, [w, H, w], opts('pinnacle'))
    } else if (o.type === 'crocket') {
      const k = o.size * C
      place(add(o.p, mul(X, k * 0.45)), X, Y, [k, k * 1.15, k * 0.55], opts('crocket'))
    } else if (o.type === 'finial') {
      const f = o.size * C
      place(add(o.p, mul(Y, f)), X, Y, [f, f * 2, f], opts('finial'))
    } else if (o.type === 'grotesque') {
      const L = o.size * C
      place(add(o.p, mul(X, L * 0.42)), X, Y, [L, L * 0.62, L * 0.5], opts('grotesque', o.variant ?? 0))
    }
  }

  // ------------------------------------------------ 2. tracery bars
  enter('tracery')
  for (const m of skeleton.members) {
    if (!TRACERY_KINDS.has(m.kind)) continue
    // Split at sharp corners (arch apex, foil cusps): each run is cut separately,
    // so no bar bridges a cusp.
    const runs = [[m.points[0]]]
    for (let i = 1; i < m.points.length; i += 1) {
      runs[runs.length - 1].push(m.points[i])
      if (i < m.points.length - 1) {
        const u = norm(sub(m.points[i], m.points[i - 1]))
        const v = norm(sub(m.points[i + 1], m.points[i]))
        if (dot(u, v) < Math.cos((25 * Math.PI) / 180)) runs.push([m.points[i]])
      }
    }
    const meanR = m.radii.reduce((a, b) => a + b, 0) / m.radii.length
    // Every stone slider (except Gravel, which is ground scatter) acts on the
    // carved tracery, scaled so bars stay bars:
    //  stoneSize → bar length (and how faceted circles get), formationWidth → section
    //  width (√ so 5 ≈ 2.2×), thickness / wallDepth → section depth, sizeGrading →
    //  thicker low, sizeVariation / courseRegularity → uneven joints, irregularity →
    //  chipped / displaced bars (also low dressing), tiltJitter → tilt, gap → open joints,
    //  density → missing bars, carvingScale → section, stoneMix / weathering → colour.
    const w0 = 2 * meanR * 1.1 * Math.sqrt(P.formationWidth) * P.carvingScale
    const depthF = (0.8 + P.thickness * 1.1) * (1 + 0.35 * (P.wallDepth - 1))
    const segTarget = Math.max(0.1, P.stoneSize * 1.4)
    const maxTurn = Math.max(6, Math.min(60, 15 * (P.stoneSize / 0.85))) * (Math.PI / 180)
    const variant = m.kind === 'mullion' || m.kind === 'gable' || m.kind === 'rail' ? 1 : 0
    runs.forEach((pts, ri) => {
      const cum = cumulative(pts)
      const total = cum[cum.length - 1]
      if (total < 0.05) return
      let turning = 0
      for (let i = 1; i < pts.length - 1; i += 1) {
        const u = norm(sub(pts[i], pts[i - 1]))
        const v = norm(sub(pts[i + 1], pts[i]))
        turning += Math.acos(Math.max(-1, Math.min(1, dot(u, v))))
      }
      const count = Math.max(1, Math.round(total / segTarget), Math.ceil(turning / maxTurn))
      // Joint positions: even (regular) or jittered (irregular / varied sizes).
      const cuts = [0]
      const jitter = (1 - P.courseRegularity) * 0.35 + P.sizeVariation * 0.4
      for (let k = 1; k < count; k += 1) cuts.push(Math.min(count - 0.15, Math.max(cuts[k - 1] + 0.15, k + (rand() * 2 - 1) * jitter)))
      cuts.push(count)
      for (let k = 0; k < count; k += 1) {
        const a = pointAt(pts, cum, (total * cuts[k]) / count)
        const b = pointAt(pts, cum, (total * cuts[k + 1]) / count)
        const d = sub(b.p, a.p)
        const l = len(d)
        if (l < 1e-4) continue
        const X = mul(d, 1 / l)
        let up = sub(UPV, mul(X, dot(UPV, X)))
        if (len(up) < 1e-3) up = { x: 1, y: 0, z: 0 }
        // Section plane: width in the tracery plane, depth across it.
        const Y = basis(X, up).Y
        let center = mul(add(a.p, b.p), 0.5)
        const w = w0 * grade(center.y) * (1 + P.sizeVariation * 0.3 * (rand() * 2 - 1))
        const rough = P.irregularity + (1 - P.dressing) * 0.5
        if (rough > 0) {
          const kick = rough * w * 0.12
          center = add(center, { x: (rand() - 0.5) * kick, y: (rand() - 0.5) * kick, z: (rand() - 0.5) * kick })
        }
        place(center, X, Y, [l + w * 0.12, w, w * depthF * 0.9], { proto: protoIndex('bar', variant), kind: m.kind, piece: `${m.piece}/t${ri}.${Math.floor(k / 6)}`, check: false, insert: false })
      }
    })
  }

  // ------------------------------------------------ 3. structural members
  enter('structural')
  const footingRuns = []
  // Piers and shafts first, so the strut / core give way where they overlap.
  const structural = skeleton.members.filter((m) => !TRACERY_KINDS.has(m.kind))
  const rank = (m) => (m.kind === 'pier' ? 0 : m.kind === 'shaft' ? 1 : m.kind === 'main' ? 2 : 3)
  structural.sort((a, b) => rank(a) - rank(b))
  for (const m of structural) {
    const rowT0 = Math.max(0.12, P.stoneSize * P.thickness)
    const sample = resampleBySpacing(m.points, m.radii, Math.min(rowT0, 0.4) * 0.5)
    const frames = rotationMinimisingFrames(sample.points)
    if (frames.length < 2) continue
    const isDrum = m.kind === 'shaft' || (m.kind === 'main' && role === 'column')
    const isPier = m.kind === 'pier'
    const cum = cumulative(sample.points)
    const total = cum[cum.length - 1]
    let s = 0
    let row = 0
    let fi = 0
    let footing = null
    while (s < total) {
      while (fi < cum.length - 2 && cum[fi + 1] < s) fi += 1
      const f = frames[fi]
      // Exact position at arc length s (courses meet without gaps or overlaps).
      const p = pointAt(sample.points, cum, s).p
      const R = sample.radii[fi] * P.formationWidth
      const g = grade(p.y)
      const T = rowT0 * g * vary() * (0.85 + 0.3 * P.courseRegularity)
      const horizontal = Math.abs(f.t.y) < 0.35
      const onGround = p.y <= Math.max(0.5, R * 0.6)
      const piece = `${m.piece}/c${Math.floor(row / 10)}`

      if (horizontal && onGround && m.kind === 'main') {
        // Collect ground runs; coursed footings are laid in a separate pass.
        if (!footing) footingRuns.push((footing = { points: [], radius: R, piece: m.piece }))
        footing.points.push(p)
        footing.radius = Math.max(footing.radius, R)
        s += Math.min(rowT0, 0.4) * 0.5
        continue
      }
      footing = null

      if (isDrum) {
        // Shafts are engaged in the core (compound pier): drums interpenetrate by design.
        place(add(p, mul(f.t, T * 0.5)), f.up, f.t, [2 * R, T, 2 * R], { proto: protoIndex('drum', row), kind: 'drum', piece, check: false })
        s += T
        row += 1
        continue
      }

      // Curvature vector for voussoir wedging.
      const fPrev = frames[Math.max(0, fi - 1)]
      const fNext = frames[Math.min(frames.length - 1, fi + 1)]
      const ds = Math.max(1e-6, len(sub(fNext.p, fPrev.p)))
      const kv = mul(sub(fNext.t, fPrev.t), 1 / ds)
      const blockW = P.stoneSize * g * (isPier ? 1.3 : 1)
      const nD = Math.max(1, P.wallDepth)
      const wD = (2 * R) / nD
      // Across the section: varied block widths, staggered row to row.
      const widths = blockLengths(2 * R, blockW, P.sizeVariation, rand)
      if (row % 2 === 1 && widths.length > 1 && P.courseRegularity > 0.3) widths.reverse()
      const single = widths.length === 1 && nD === 1
      let a0 = -R
      for (const w of widths) {
        const a = a0 + w / 2
        a0 += w
        for (let j = 0; j < nD; j += 1) {
          const b = (j - (nD - 1) / 2) * wD
          const offset = add(mul(f.up, a), mul(f.side, b))
          const wedge = Math.max(0.5, Math.min(1.35, 1 - dot(offset, kv)))
          const thick = T * wedge
          const jit = (1 - P.courseRegularity) * (rand() - 0.5) * T * 0.4
          const center = add(add(p, offset), mul(f.t, thick * 0.5 + jit))
          const kind = isPier ? 'ashlar' : onGround ? 'base' : 'voussoir'
          const proto = single && !isPier ? protoIndex('ribVoussoir', row) : protoIndex('ashlar', Math.floor(rand() * 12))
          place(center, f.up, f.t, [w * (single ? 1 : vary()), thick, wD * (nD > 1 ? vary() : 1)], { proto, kind, piece })
        }
      }
      s += T
      row += 1
    }
  }

  // Coursed ashlar footings along ground runs: courses of varied block lengths.
  enter('footing')
  for (const run of footingRuns) {
    if (run.points.length < 2) continue
    const cum = cumulative(run.points)
    const total = cum[cum.length - 1]
    const H = Math.max(P.stoneSize * 0.8, 2 * run.radius)
    let y = 0
    let course = 0
    while (y < H - 1e-3) {
      const ch = Math.min(H - y, P.stoneSize * P.thickness * grade(y) * vary())
      const lengths = blockLengths(total, P.stoneSize * 1.5, P.sizeVariation, rand)
      if (course % 2 === 1 && lengths.length > 1) lengths.push(lengths.shift())
      const nD = Math.max(1, P.wallDepth)
      const depth = Math.max(P.stoneSize * 0.8, (2 * run.radius) / 1.2)
      let s = 0
      for (const L of lengths) {
        const mid = pointAt(run.points, cum, s + L / 2)
        const a = pointAt(run.points, cum, s)
        const b = pointAt(run.points, cum, s + L)
        const along = norm({ x: b.p.x - a.p.x, y: 0, z: b.p.z - a.p.z })
        const across = norm(cross(UPV, along))
        for (let j = 0; j < nD; j += 1) {
          const off = (j - (nD - 1) / 2) * (depth / nD)
          const center = add({ x: mid.p.x, y: y + ch / 2, z: mid.p.z }, mul(across, off))
          place(center, along, UPV, [Math.max(0.1, L), ch, depth / nD], { proto: protoIndex('ashlar', Math.floor(rand() * 12)), kind: 'footing', piece: `${run.piece}/f${course}`, allowGround: true })
        }
        s += L
      }
      y += ch
      course += 1
    }
  }

  // ------------------------------------------------ 4. plinths
  enter('plinth')
  for (const gc of skeleton.groundContacts) {
    const R = Math.max(gc.r * P.formationWidth * 1.35, P.stoneSize * 0.8)
    const big = P.stoneSize * (1 + P.sizeGrading * 0.6)
    const n = Math.max(2, Math.round((2.2 * R) / big))
    const h = big * 0.4
    for (let i = 0; i < n; i += 1)
      for (let j = 0; j < n; j += 1) {
        const step = (2.2 * R) / n
        const x = (i - (n - 1) / 2) * step
        const z = (j - (n - 1) / 2) * step
        place({ x: gc.p.x + x, y: h * 0.5, z: gc.p.z + z }, { x: 1, y: 0, z: 0 }, UPV, [step * vary(), h, step * vary()], { proto: protoIndex('ashlar', i * n + j), kind: 'plinth', piece: `plinth${Math.round(gc.p.x)}_${Math.round(gc.p.z)}`, allowGround: true })
      }
  }

  enter('done')
  delete trace.phases.done
  return { stones, stats: { ...stats, stones: stones.length }, trace }
}
