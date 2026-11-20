/**
 * Gothic shape grammar for curve members (Step 47, round 2 — replaces the
 * L-system-like branching). Source: gothic_tracery_mathematics_analysis.md
 * §3–§8; REF-004, REF-006, REF-007, REF-008, REF-011, REF-013.
 *
 * Variation is compositional, never growth:
 *   Rib (arch-like)  → archivolts + tracery subdivision (Geometric / Y / Intersecting)
 *                      + lancet-head foils + mullions + gable (foil, crockets, finial) + keystone
 *   Rib (flat), Tracery → tracery band: rails + tangent circles + n-foils + spandrel circles
 *   Column           → compound pier: shafts (rotational symmetry) + capital + base + vault springers
 *   Buttress         → stepped pier + pinnacle + gargoyle + flyer tracery band
 * The seed only chooses between symmetric grammar alternatives.
 *
 * Debug trace (out.trace, pure data, always recorded): `steps` is the ordered
 * rule log (which rule fired, why, with its numbers); `geom` is the
 * construction geometry behind it in world space — full circles of every arc,
 * centres, springing / transom lines, tangency lines, foil lobe circles —
 * tagged by rule so a debug layer can draw and filter it.
 */

import { UP, add, dist, dot, norm, rotationMinimisingFrames, scale, sub, v3 } from '../curves/curve3.js'
import {
  buildFoil,
  gableFoil,
  inscribedInHead,
  intersectingArcs,
  oculusAbove,
  oculusBetween,
  offsetArch,
  sampleArch,
  spandrelRadius,
  subdivideArch,
  twoCentredArch,
  yBranch,
} from './construct2d.js'

const MAX_MEMBERS = 650
const TAU = Math.PI * 2

export const TRACERY_STYLES = ['auto', 'geometric', 'y', 'intersecting']

function circlePoints(c, r, n = 40) {
  const out = []
  for (let i = 0; i <= n; i += 1) {
    const a = (TAU * i) / n
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) })
  }
  return out
}

function dedupe(points) {
  const out = []
  for (const p of points) if (!out.length || dist(out[out.length - 1], p) > 1e-6) out.push(p)
  return out
}

function pathLength(points) {
  let L = 0
  for (let i = 1; i < points.length; i += 1) L += dist(points[i - 1], points[i])
  return L
}

/** Up-ish unit normal of tangent t (world up projected off the tangent). */
function upNormal(t, fallback) {
  const u = sub(UP, scale(t, dot(UP, t)))
  const l = Math.hypot(u.x, u.y, u.z)
  return l < 1e-3 ? fallback : scale(u, 1 / l)
}

/** Point + frame at arc length s along a polyline. */
function stationAt(points, cum, frames, s) {
  let i = 0
  while (i < cum.length - 2 && cum[i + 1] < s) i += 1
  const seg = Math.max(1e-9, cum[i + 1] - cum[i])
  const u = Math.max(0, Math.min(1, (s - cum[i]) / seg))
  const p = add(points[i], scale(sub(points[i + 1], points[i]), u))
  const t = norm(sub(points[i + 1], points[i]))
  return { p, t, n: upNormal(t, frames[i].up) }
}

export function buildGrammar({ role, points, radii, P, rand, topLinked, baseOut, topOut }) {
  const members = []
  const ornaments = []
  const construction = []
  const out = { members, ornaments, construction, motifs: 0, style: null, archFrame: null }
  const trace = { steps: [], geom: [] }
  out.trace = trace
  const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3))
  const step = (rule, text, data = {}) => trace.steps.push({ n: trace.steps.length + 1, rule, text, data })
  const geo = (rule, kind, pts, extra = {}) => trace.geom.push({ rule, kind, points: pts, ...extra })
  // 2D construction (arch plane / band frame) → world, via a map function.
  const geoCircle = (rule, c, r, map, n = 48) => geo(rule, 'circle', circlePoints(c, r, n).map(map), { center: map(c), r })
  const geoPoint = (rule, c, map, label) => geo(rule, 'point', [map(c)], label ? { label } : {})
  const geoLine = (rule, a, b, map) => geo(rule, 'line', [map(a), map(b)])
  const geoFoil = (foil, map) => {
    for (const lc of foil.lobeCenters ?? []) {
      geoCircle('foil', lc, foil.lobeRadius, map, 24)
      geoPoint('foil', lc, map)
    }
    for (const cp of foil.cusps ?? []) geoPoint('cusp', cp, map)
  }
  let seq = 0
  const r0 = radii[Math.floor(radii.length / 2)] ?? P.thickness
  const addMember = (kind, depth, pts, r, piece) => {
    if (members.length >= MAX_MEMBERS) return
    const clean = dedupe(pts).map((p) => (p.y < 0 ? v3(p.x, 0, p.z) : p))
    const pp = dedupe(clean)
    if (pp.length < 2 || pathLength(pp) < 0.05) return
    const rad = Array.isArray(r) ? r : pp.map(() => r)
    members.push({ id: `g${seq++}`, kind, depth, points: pp, radii: rad, parent: 'main', piece })
  }
  const ornament = (type, p, x, y, size, extra = {}) => ornaments.push({ type, p, x: norm(x), y: norm(y), size, ...extra })
  const record = (type, residuals) => {
    for (const r of residuals) construction.push({ type, residual: r })
  }

  // -------------------------------------------------- tracery band (REF-013)
  const band = (pts, H, piecePrefix, barR) => {
    if (pts.length < 2 || H < 0.4) return
    const frames = rotationMinimisingFrames(pts)
    const cum = [0]
    for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]))
    const L = cum[cum.length - 1]
    const rho = H / 2
    const pitch = 2 * rho * (1 + P.bandSpacing * 0.8)
    const N = Math.floor((L - rho * 0.4) / pitch)
    if (N < 1) {
      step('band', `Band skipped: length ${fmt(L)} m holds no circle of ρ = ${fmt(rho)} m`, { L, rho })
      return
    }
    step('band', `Band: ${N} circles of ρ = H/2 = ${fmt(rho)} m at pitch 2ρ(1 + 0.8·spacing) = ${fmt(pitch)} m along ${fmt(L)} m`, { N, rho, pitch, L })
    // Top rail (offset of the curve by H along its up-normal) + end posts.
    const rail = []
    for (let i = 0; i < pts.length; i += 1) {
      const t = norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]))
      rail.push(add(pts[i], scale(upNormal(t, frames[i].up), H)))
    }
    addMember('rail', 1, rail, barR, `${piecePrefix}rail`)
    const s0 = (L - N * pitch) / 2
    const ends = [stationAt(pts, cum, frames, s0), stationAt(pts, cum, frames, s0 + N * pitch)]
    for (const e of ends) addMember('mullion', 1, [e.p, add(e.p, scale(e.n, H))], barR, `${piecePrefix}post`)
    const lobeA = Math.round(P.foilLobes)
    const lobeB = Math.max(3, lobeA - 1)
    const turn = rand() < 0.5
    for (let k = 0; k < N; k += 1) {
      const st = stationAt(pts, cum, frames, s0 + pitch * (k + 0.5))
      const C = add(st.p, scale(st.n, rho))
      const map = (q) => add(add(C, scale(st.t, q.x)), scale(st.n, q.y))
      addMember('oculus', 1, circlePoints({ x: 0, y: 0 }, rho, 40).map(map), barR, `${piecePrefix}c${k}`)
      const L2 = k % 2 === 0 ? lobeA : lobeB
      const phi = Math.PI / 2 + (turn ? Math.PI / L2 : 0)
      const foil = buildFoil({ x: 0, y: 0 }, rho - barR * 1.6, L2, P.cuspDepth, phi)
      if (k === 0 || k === N - 1) geoPoint('band', { x: 0, y: 0 }, map, `circle ${k + 1}/${N}`)
      if (foil) {
        geoFoil(foil, map)
        record('bandFoil', foil.residuals)
        for (const arc of foil.arcs) addMember('foil', 2, arc.map(map), barR * 0.7, `${piecePrefix}c${k}`)
        out.motifs += 1
      }
    }
    // Spandrel circles: tangent to both neighbours and to each rail (r = d²/4ρ).
    const d = pitch / 2
    const rs = spandrelRadius(rho, d)
    step('spandrel', rs > barR * 1.4 && rs < rho ? `Spandrel circles r = d²/4ρ = ${fmt(rs)} m, tangent to both neighbours and the rail` : `Spandrel circles skipped: r = d²/4ρ = ${fmt(rs)} m is too small for the bar (${fmt(barR * 1.4)} m)`, { rs, d, rho })
    if (rs > barR * 1.4 && rs < rho) {
      const resid = Math.abs(Math.hypot(d, rho - rs) - (rho + rs))
      for (let k = 0; k < N - 1; k += 1) {
        const st = stationAt(pts, cum, frames, s0 + pitch * (k + 1))
        for (const yc of [rs, H - rs]) {
          const C = add(st.p, scale(st.n, yc))
          addMember('oculus', 2, circlePoints({ x: 0, y: 0 }, rs, 24).map((q) => add(add(C, scale(st.t, q.x)), scale(st.n, q.y))), barR * 0.7, `${piecePrefix}s${k}`)
          record('spandrel', [resid])
        }
      }
    }
  }

  // -------------------------------------------------- arch frame for ribs
  const archFrame = () => {
    const A = points[0]
    const B = points[points.length - 1]
    const chord = sub(B, A)
    const Lc = Math.hypot(chord.x, chord.y, chord.z)
    if (Lc < 2) {
      step('archTest', `Arch test failed: chord ${fmt(Lc)} m < 2 m → tracery band`, { Lc })
      return null
    }
    const e1 = scale(chord, 1 / Lc)
    let best = null
    let h = 0
    for (const p of points) {
      const w = sub(p, A)
      const perp = sub(w, scale(e1, dot(w, e1)))
      const l = Math.hypot(perp.x, perp.y, perp.z)
      if (l > h) {
        h = l
        best = perp
      }
    }
    const a = Lc / 2
    const ratio = best ? h / a : 0
    const e2y = best ? best.y / h : 0
    out.archTest = { Lc, a, h, ratio, e2y }
    if (!best || ratio < 0.35) {
      step('archTest', `Arch test failed: rise / half-span = ${fmt(h)} / ${fmt(a)} = ${fmt(ratio)} < 0.35 → tracery band`, out.archTest)
      return null
    }
    const e2 = scale(best, 1 / h)
    if (e2.y < 0.5) {
      step('archTest', `Arch test failed: the rise points sideways (up-component ${fmt(e2y)} < 0.5) → tracery band`, out.archTest)
      return null
    }
    step('archTest', `Arch test passed: rise / half-span = ${fmt(h)} / ${fmt(a)} = ${fmt(ratio)} ≥ 0.35, rising (up ${fmt(e2y)})`, out.archTest)
    return { A, e1, e2, a, h }
  }

  step('role', `Role: ${role}`, { role })
  if (role === 'rib' || role === 'tracery') {
    if (role === 'tracery') step('archTest', 'Tracery role: always a tracery band (no arch test)')
    const F = role === 'rib' ? archFrame() : null
    if (!F) {
      out.style = 'band'
      band(points, P.bandHeight, 'band/', Math.max(0.06, r0 * 0.4))
    } else {
      out.archFrame = F
      const W = (q) => add(add(F.A, scale(F.e1, q.x + F.a)), scale(F.e2, q.y))
      const toW = (arr) => arr.map(W)
      const fit = (F.h * F.h - F.a * F.a) / (2 * F.a * F.a)
      const k = Math.max(-0.4, Math.min(4, fit))
      const main = twoCentredArch(0, F.a, k, 0)
      const delta = r0 * 2.1
      const bar = Math.max(0.06, r0 * 0.5)
      step('arch', `Two-centred arch fitted to the drawn rise: k = (h² − a²)/2a² = ${fmt(fit)}${k !== fit ? ` → clamped ${fmt(k)}` : ''}; centres ±c = ±${fmt(main.c)} m on the springing line, R = a + c = ${fmt(main.R)} m, apex h = √(R² − c²) = ${fmt(main.h)} m`, { a: F.a, h: F.h, k, c: main.c, R: main.R })
      geoLine('arch', { x: -F.a * 1.15, y: 0 }, { x: F.a * 1.15, y: 0 }, W)
      geoLine('arch', { x: 0, y: 0 }, main.apex, W)
      geoCircle('arch', main.left.center, main.R, W, 72)
      geoCircle('arch', main.right.center, main.R, W, 72)
      geoPoint('arch', main.left.center, W, 'left-arc centre')
      geoPoint('arch', main.right.center, W, 'right-arc centre')
      geoPoint('arch', main.apex, W, `apex · k ${fmt(k)}`)
      if (P.archivolts > 0) step('archivolt', `${P.archivolts} archivolt${P.archivolts > 1 ? 's' : ''}: same centres, R + j·${fmt(delta)} m`, { n: P.archivolts, delta })
      // Archivolts: concentric offset arcs (§2).
      for (let j = 1; j <= P.archivolts; j += 1) addMember('archivolt', 1, toW(sampleArch(offsetArch(main, j * delta), 24)), r0 * 0.55, `archivolt${j}`)
      // Keystone at the apex (radial axis = e2).
      ornament('keystone', W(main.apex), F.e1, F.e2, r0, { depth: r0 })
      const inner = offsetArch(main, -r0 * 1.6)
      const springY = (x) => W({ x, y: 0 })
      const dropMullion = (x, r, piece) => {
        if (P.screen <= 0) return
        const top = springY(x)
        const bottom = v3(top.x, Math.max(0, top.y - top.y * P.screen), top.z)
        if (top.y - bottom.y > 0.2) addMember('mullion', 1, [top, bottom], r, piece)
      }
      const styles = ['geometric', 'y', 'intersecting']
      const pick = rand()
      const style = P.style >= 1 ? styles[Math.round(P.style) - 1] : pick < 0.5 ? 'geometric' : pick < 0.75 ? 'y' : 'intersecting'
      out.style = style
      step('style', P.style >= 1 ? `Style ${style} (set by the Tracery style slider)` : `Style ${style} (Auto: seed roll ${fmt(pick)} → <0.5 geometric, <0.75 Y, else intersecting)`, { style, pick, source: P.style >= 1 ? 'slider' : 'seed' })
      const n = Math.max(1, Math.round(P.subdivision))
      const lobesTop = Math.round(P.foilLobes)
      const orientUp = rand() < 0.5
      const foilIn = (oc, L, depth, piece, parents = []) => {
        addMember('oculus', depth, toW(circlePoints(oc.center, oc.radius, 44)), bar * Math.pow(0.8, depth - 1), piece)
        record(oc.kind, oc.residuals)
        const res = Math.max(...oc.residuals)
        step(oc.kind, `${oc.kind === 'gableFoil' ? 'Gable foil' : 'Oculus'} (depth ${depth}): r = ${fmt(oc.radius)} m, ${L}-foil, tangency error ${res.toExponential(1)}`, { r: oc.radius, lobes: L, residual: res })
        geoPoint(oc.kind, oc.center, W, `${oc.kind === 'gableFoil' ? 'gable foil' : 'oculus'} r ${fmt(oc.radius)}`)
        // Tangency lines: from each parent arc centre through the oculus centre.
        for (const pc of parents) geoLine('tangency', pc, oc.center, W)
        const phi = Math.PI / 2 + (orientUp ? 0 : Math.PI / L)
        const foil = buildFoil(oc.center, oc.radius - bar * 1.5, L, P.cuspDepth, phi)
        if (foil) {
          geoFoil(foil, W)
          record('foil', foil.residuals)
          for (const arc of foil.arcs) addMember('foil', depth + 1, toW(arc), bar * 0.7 * Math.pow(0.8, depth - 1), piece)
          out.motifs += 1
        }
      }
      const headFoil = (arch, depth, piece) => {
        if (P.lancetFoil <= 0) return
        const yt = arch.y0 + arch.h * (0.62 - 0.3 * P.lancetFoil)
        const hc = inscribedInHead(arch, yt)
        if (!hc || hc.radius < bar * 2.5) {
          step('headFoil', `Lancet-head foil skipped: inscribed circle ${hc ? `r = ${fmt(hc.radius)} m` : 'not found'} < ${fmt(bar * 2.5)} m`, { r: hc?.radius ?? 0 })
          return
        }
        record('headFoil', hc.residuals)
        step('headFoil', `Lancet-head roundel: circle tangent to both arcs and the transom y = ${fmt(yt)}, r = (R² − c² − y²)/2(R + y) = ${fmt(hc.radius)} m`, { r: hc.radius, yt })
        geoLine('headFoil', { x: arch.m - arch.a, y: yt }, { x: arch.m + arch.a, y: yt }, W)
        geoPoint('headFoil', hc.center, W)
        // Ring tangent to both arcs (plate-tracery roundel) + cusped trefoil inside.
        addMember('oculus', depth + 1, toW(circlePoints(hc.center, hc.radius, 36)), bar * 0.6, piece)
        const foil = buildFoil(hc.center, hc.radius - bar * 1.1, 3, P.cuspDepth, Math.PI / 2 + (orientUp ? Math.PI / 3 : 0))
        if (foil) {
          geoFoil(foil, W)
          record('foil', foil.residuals)
          for (const arc of foil.arcs) addMember('foil', depth + 1, toW(arc), bar * 0.6, piece)
          out.motifs += 1
        }
      }

      if (style === 'geometric') {
        // S1 Subdivide → S2 InsertMotif (oculus + foil) → S3 Refine (recursion), §8.
        const kSub = Math.max(0.5, Math.min(2, (1 + k) / 2))
        const geometric = (parent, depth, count, prefix) => {
          if (count < 2) {
            headFoil(parent, depth, `${prefix}h`)
            return
          }
          const kids = subdivideArch(parent, count, kSub)
          const r = bar * Math.pow(0.78, depth - 1)
          step('subdivide', `Subdivide (depth ${depth}): ${count} lancets of half-span ${fmt(parent.a / count)} m on the springing line, sharpness k = ${fmt(kSub)}`, { depth, count, k: kSub })
          kids.forEach((kid) => {
            geoPoint('subdivide', kid.left.center, W)
            geoPoint('subdivide', kid.right.center, W)
          })
          kids.forEach((kid, i) => addMember('subarch', depth, toW(sampleArch(kid, 16)), r, `${prefix}${i}`))
          for (let i = 0; i < kids.length - 1; i += 1) {
            dropMullion(kids[i].m + kids[i].a, r, `${prefix}m${i}`)
          }
          const oculi = []
          for (let i = 0; i < kids.length - 1; i += 1) {
            const oc = oculusBetween(parent, kids[i], kids[i + 1])
            if (oc && oc.radius > bar * 2) oculi.push(oc)
          }
          const clash = oculi.some((o, i) => oculi.some((q, j) => j > i && Math.hypot(o.center.x - q.center.x, o.center.y - q.center.y) < o.radius + q.radius))
          const L = depth === 1 ? lobesTop : Math.max(3, lobesTop - depth + 1)
          if (clash) step('oculus', `Oculi between lancets clash (overlap) at depth ${depth} → ${kids.length % 2 === 1 ? 'one oculus on the axis' : 'none'}`, { depth })
          if (!clash) oculi.forEach((oc, i) => foilIn(oc, L, depth, `${prefix}o${i}`, [parent.left.center, parent.right.center, kids[i].left.center, kids[i + 1].right.center]))
          else if (kids.length % 2 === 1) {
            // Odd lancet count: one oculus on the axis above the middle lancet.
            const oc = oculusAbove(parent, kids[(kids.length - 1) / 2])
            if (oc && oc.radius > bar * 2) foilIn(oc, L, depth, `${prefix}oc`, [parent.left.center, parent.right.center])
          }
          kids.forEach((kid, i) => {
            if (depth <= P.refine) geometric(kid, depth + 1, 2, `${prefix}${i}.`)
            else headFoil(kid, depth, `${prefix}${i}h`)
          })
        }
        geometric(inner, 1, n, 't')
      } else if (style === 'y') {
        const m = Math.max(2, n)
        const ys = inner.h * 0.38
        step('yTracery', `Y-tracery: ${m - 1} mullion${m > 2 ? 's' : ''} fork at ${fmt(ys)} m; each branch is concentric with the opposite arc`, { m, ys })
        geoLine('yTracery', { x: inner.m - inner.a, y: ys }, { x: inner.m + inner.a, y: ys }, W)
        geoPoint('yTracery', inner.left.center, W, 'branch centre')
        geoPoint('yTracery', inner.right.center, W, 'branch centre')
        for (let j = 1; j < m; j += 1) {
          const x = inner.m - inner.a + (2 * inner.a * j) / m
          addMember('mullion', 1, [W({ x, y: 0 }), W({ x, y: ys })], bar, `y${j}`)
          dropMullion(x, bar, `y${j}`)
          for (const toLeft of [true, false]) {
            const br = yBranch(inner, x, ys, toLeft)
            if (br) {
              record('yBranch', [br.residual])
              addMember('subarch', 1, toW(br.points), bar * 0.85, `y${j}${toLeft ? 'l' : 'r'}`)
              out.motifs += 1
            }
          }
        }
      } else {
        const m = Math.max(2, n)
        step('intersecting', `Intersecting tracery: the main arcs (R = ${fmt(inner.R)} m) repeated from each of ${m + 1} mullion feet`, { m, R: inner.R })
        for (let j = 0; j <= m; j += 1) geoPoint('intersecting', { x: inner.m - inner.a + (2 * inner.a * j) / m, y: 0 }, W)
        intersectingArcs(inner, m, bar).forEach((run, i) => {
          addMember('subarch', 1, toW(run), bar * 0.85, `x${i}`)
          out.motifs += 1
        })
        record('intersecting', [0])
        for (let j = 1; j < m; j += 1) dropMullion(inner.m - inner.a + (2 * inner.a * j) / m, bar, `xm${j}`)
      }
      addMember('subarch', 1, toW(sampleArch(inner, 24)), bar, 'inner')

      // Gable with tangent foil, crockets and finial (REF-007, REF-012).
      if (P.gable > 0) {
        const ext = offsetArch(main, P.archivolts * delta + r0 * 1.2)
        const gy = ext.h * (1.12 + 0.9 * P.gable)
        const ga = ext.a
        const left = [W({ x: -ga, y: 0 }), W({ x: 0, y: gy })]
        const right = [W({ x: 0, y: gy }), W({ x: ga, y: 0 })]
        addMember('gable', 1, left, r0 * 0.5, 'gable')
        addMember('gable', 1, right, r0 * 0.5, 'gable')
        step('gable', `Gable: apex ${fmt(gy)} m (${fmt(1.12 + 0.9 * P.gable)} × extrados rise), half-width ${fmt(ga)} m`, { gy, ga })
        geoPoint('gable', { x: 0, y: gy }, W, 'gable apex')
        const gf = gableFoil(main, ext.R, gy, ga)
        if (gf && gf.radius > bar * 2) foilIn(gf, lobesTop === 4 ? 3 : 4, 1, 'gableFoil', [main.left.center, main.right.center])
        else step('gableFoil', 'Gable foil skipped: no room between the gable lines and the extrados')
        const edge = Math.hypot(ga, gy)
        const nCrockets = Math.round((P.crockets * edge) / 1.6)
        step('crockets', `${nCrockets * 2} crockets (${nCrockets} per edge = crockets × edge ${fmt(edge)} m / 1.6 m)`, { n: nCrockets * 2 })
        for (let i = 1; i <= nCrockets; i += 1) {
          const u = i / (nCrockets + 1)
          for (const sgn of [-1, 1]) {
            // Edge point, its upward direction and its outward normal (2D, arch plane).
            const q = { x: sgn * ga * (1 - u), y: gy * u }
            const along = { x: -sgn * ga, y: gy }
            const o2 = { x: sgn * gy, y: ga }
            ornament('crocket', W(q), add(scale(F.e1, o2.x), scale(F.e2, o2.y)), add(scale(F.e1, along.x), scale(F.e2, along.y)), r0 * 0.9)
          }
        }
        if (P.crockets > 0 || P.pinnacles > 0) ornament('finial', W({ x: 0, y: gy }), F.e1, UP, r0 * 1.6)
      }
      // Grotesque corbels at both springings (mirror pair or none).
      const gRoll = rand()
      step('grotesque', gRoll < P.grotesques ? `Grotesque pair: seed roll ${fmt(gRoll)} < chance ${fmt(P.grotesques)}` : `No grotesques: seed roll ${fmt(gRoll)} ≥ chance ${fmt(P.grotesques)}`, { roll: gRoll, chance: P.grotesques })
      if (gRoll < P.grotesques) {
        const variant = Math.floor(rand() * 3)
        for (const sgn of [-1, 1]) {
          const out3 = scale(F.e1, sgn)
          const horiz = norm(v3(out3.x, 0, out3.z))
          ornament('grotesque', W({ x: sgn * (main.a + r0 * 1.2), y: 0 }), horiz, UP, r0 * 3, { variant })
        }
      }
    }
  } else if (role === 'column') {
    const frames = rotationMinimisingFrames(points)
    const top = points[points.length - 1]
    const base = points[0]
    const rc = radii[0]
    const ns = Math.round(P.shafts)
    const rs = rc * 0.34
    const ringR = rc + rs * 0.9
    const phi0 = rand() < 0.5 ? 0 : Math.PI / Math.max(1, ns)
    for (let k = 0; k < ns; k += 1) {
      const a = phi0 + (TAU * k) / ns
      const pts = points.map((p, i) => add(p, scale(add(scale(frames[i].side, Math.cos(a)), scale(frames[i].up, Math.sin(a))), ringR)))
      addMember('shaft', 1, pts, rs, `shaft${k}`)
    }
    out.motifs += ns
    step('shafts', `Compound pier: ${ns} shafts at radius ${fmt(ringR)} m, rotational symmetry 360°/${ns || 1}`, { ns, ringR })
    const tTop = norm(sub(top, points[points.length - 2]))
    const capR = ns ? ringR + rs : rc * 1.15
    ornament('capital', top, frames[frames.length - 1].side, tTop, capR)
    if (base.y <= 0.35) ornament('base', base, frames[0].side, norm(sub(points[1], base)), capR * 1.08)
    const m = Math.round(P.springers)
    const H = Math.max(2, top.y - base.y)
    const Rsp = H * 0.35
    const sweep = (65 * Math.PI) / 180
    const ph = rand() < 0.5 ? Math.PI / 4 : 0
    for (let k = 0; k < m; k += 1) {
      const a = ph + (TAU * k) / m
      const d = norm(v3(Math.cos(a), 0, Math.sin(a)))
      const C = add(top, scale(d, Rsp))
      const arc = []
      for (let i = 0; i <= 16; i += 1) {
        const al = (sweep * i) / 16
        arc.push(add(sub(C, scale(d, Rsp * Math.cos(al))), scale(UP, Rsp * Math.sin(al))))
      }
      addMember('springer', 1, arc, rc * 0.45, `springer${k}`)
      record('springer', [Math.abs(dist(arc[8], C) - Math.hypot(Rsp, 0))])
    }
    out.motifs += m
    step('springers', m ? `${m} vault springers: circular arcs R = 0.35 × height = ${fmt(Rsp)} m, vertical tangent at the capital` : 'No vault springers', { m, R: Rsp })
    step('pinnacle', !topLinked && m === 0 && P.pinnacles > 0 ? 'Pinnacle on the free column top' : `No pinnacle (${topLinked ? 'top is linked' : m ? 'springers carry the top' : 'pinnacles = 0'})`)
    if (!topLinked && m === 0 && P.pinnacles > 0) ornament('pinnacle', add(top, scale(UP, rc * 0.2)), v3(1, 0, 0), UP, rc * 1.6, { height: rc * 8 * P.pinnacles })
    out.style = 'compound pier'
  } else if (role === 'buttress') {
    const base = points[0]
    const far = points[points.length - 1]
    const rp = radii[0] * 1.1
    const strutTop = points.reduce((m, p) => Math.max(m, p.y), 0)
    const hp = Math.max(2, P.pierHeight * strutTop)
    step('pier', base.y <= 0.35 && P.pierHeight > 0 ? `Buttress pier ${fmt(hp)} m with ${Math.round(P.setbacks)} setbacks` : 'No pier (base is not on the ground or pier height is 0)', { hp })
    if (base.y <= 0.35 && P.pierHeight > 0) {
      const k = Math.round(P.setbacks)
      for (let j = 0; j <= k; j += 1) {
        const y0 = (hp * j) / (k + 1)
        const y1 = (hp * (j + 1)) / (k + 1)
        addMember('pier', 1, [v3(base.x, y0, base.z), v3(base.x, y1, base.z)], rp * (1 - 0.16 * j), `pier${j}`)
      }
      const rTop = rp * (1 - 0.16 * k)
      if (P.pinnacles > 0) ornament('pinnacle', v3(base.x, hp, base.z), v3(1, 0, 0), UP, rTop * 1.1, { height: rTop * 7 * P.pinnacles })
      const outward = norm(v3(base.x - far.x, 0, base.z - far.z))
      if (rand() < P.grotesques) ornament('grotesque', v3(base.x + outward.x * rTop, hp * 0.82, base.z + outward.z * rTop), outward, UP, rTop * 2.6, { variant: Math.floor(rand() * 3) })
      out.motifs += 1
    }
    const above = points.filter((p) => p.y > hp * 0.6)
    if (above.length > 3) band(above, P.bandHeight * 0.6, 'flyer/', Math.max(0.06, r0 * 0.3))
    out.style = 'flying buttress'
  }

  // Bosses at linked ends (vault rib junctions, REF-004).
  step('boss', `Bosses: ${[baseOut, topOut].filter(Boolean).length} (one per end that links out to another curve)`)
  if (P.jointSize > 0) {
    // One boss per joint: placed by the curve that links out, not by its target.
    for (const [p, linked] of [
      [points[0], baseOut],
      [points[points.length - 1], topOut],
    ])
      if (linked) ornament('boss', p, v3(1, 0, 0), p.y > 3 ? scale(UP, -1) : UP, Math.max(r0, P.thickness) * P.jointSize, { lobes: Math.max(4, Math.round(P.foilLobes)) })
  }
  return out
}
