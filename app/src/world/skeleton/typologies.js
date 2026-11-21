/**
 * Step 48 typologies: new Gothic structures chosen by the curve signature.
 * Source: gothic_tracery_mathematics_analysis.md §2–§8; REF-001 (window
 * families), REF-004 (ribbed vaults), REF-005 (flamboyant), REF-007 (canopy),
 * REF-011 (Rayonnant circles), REF-012 (spire, gallery).
 *
 * Every builder works in an explicit 2D construction plane (arch plane,
 * window plane, developed band, plan) and maps to world space. Members reuse
 * the Step 47 kinds (subarch, mullion, oculus, foil, rail, gable, archivolt,
 * springer, shaft, pier) so lithic formation, debug and LOD keep working.
 * The Step 47 grammar (grammar.js) is untouched and still runs for "classic".
 */

import { UP, add, dist, dot, norm, scale, sub, v3, rotationMinimisingFrames } from '../curves/curve3.js'
import { buildFoil, gableFoil, inscribedInHead, oculusBetween, offsetArch, sampleArch, sampleArcBetween, subdivideArch, twoCentredArch, circleCircle } from './construct2d.js'
import { archOrder, archYAt, cuspedIntrados, distToPoly, fitsInside, fromTwoCentred, offsetCArch, ogeeArch, pointInPoly, rampantArch, roundArch, sampleCArch, tudorArch } from './arches2d.js'
import { bisectRoot, circleBetween, circleInsideThree, circlePoints2, mouchette, reverseCurve, vesica } from './tracery2d.js'
import { fitCircle2 } from './signature.js'

const TAU = Math.PI * 2
const SQ3 = Math.sqrt(3)
const pt = (x, y) => ({ x, y })
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Shift a composite arch by (dx, dy). */
function shiftArch(arch, dx, dy = 0) {
  const sh = (s) => ({ ...s, c: pt(s.c.x + dx, s.c.y + dy) })
  return { ...arch, left: arch.left.map(sh), right: arch.right.map(sh), apex: pt(arch.apex.x + dx, arch.apex.y + dy), feet: arch.feet.map((f) => pt(f.x + dx, f.y + dy)), openApex: arch.openApex?.map((p) => pt(p.x + dx, p.y + dy)) ?? null }
}

/** Point + frame at arc length s along a polyline (same as the band in grammar.js). */
function stationAt(points, cum, frames, s) {
  let i = 0
  while (i < cum.length - 2 && cum[i + 1] < s) i += 1
  const seg = Math.max(1e-9, cum[i + 1] - cum[i])
  const u = clamp((s - cum[i]) / seg, 0, 1)
  const p = add(points[i], scale(sub(points[i + 1], points[i]), u))
  const t = norm(sub(points[i + 1], points[i]))
  let n = sub(UP, scale(t, dot(UP, t)))
  const l = Math.hypot(n.x, n.y, n.z)
  n = l < 1e-3 ? frames[i].up : scale(n, 1 / l)
  return { p, t, n }
}

/** Developed plane along a curve: x = arc length, y = height along the up-normal. */
function developed(points) {
  const frames = rotationMinimisingFrames(points)
  const cum = [0]
  for (let i = 1; i < points.length; i += 1) cum.push(cum[i - 1] + dist(points[i - 1], points[i]))
  const L = cum[cum.length - 1]
  const D = (q) => {
    const st = stationAt(points, cum, frames, clamp(q.x, 0, L))
    return add(st.p, scale(st.n, q.y))
  }
  return { L, D, at: (s) => stationAt(points, cum, frames, clamp(s, 0, L)) }
}

/** Classic arch frame: chord e1, rise direction e2 (perpendicular, in the curve's plane). */
function archFrameOf(points) {
  const A = points[0]
  const B = points[points.length - 1]
  const chord = sub(B, A)
  const Lc = Math.hypot(chord.x, chord.y, chord.z)
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
  return { A, e1, e2: scale(best, 1 / h), a: Lc / 2, h }
}

/** Plan frame for curves on the ground: centroid, major horizontal axis u, w ⟂ u. */
function planFrame(points, sig) {
  const c = points.reduce((s, p) => add(s, p), v3(0, 0, 0))
  const c0 = v3(c.x / points.length, 0, c.z / points.length)
  let u = v3(sig.plane.major.x, 0, sig.plane.major.z)
  const l = Math.hypot(u.x, u.z)
  u = l > 0.2 ? scale(u, 1 / l) : v3(1, 0, 0)
  const w = v3(-u.z, 0, u.x)
  const M = (x, y, z) => add(add(add(c0, scale(u, x)), scale(UP, y)), scale(w, z))
  const local = points.map((p) => pt(dot(sub(p, c0), u), dot(sub(p, c0), w)))
  return { c0, u, w, M, local }
}

export function buildTypology(ctx, typ) {
  const { P, r0, step, fmt, addMember, ornament, record, geoCircle, geoPoint, geoLine, geoFoil, out, rand, sig, points } = ctx
  const bar = Math.max(0.06, r0 * 0.5)
  const delta = r0 * 2.1

  // ------------------------------------------------ shared kit
  const ring = (c, r, map, depth, piece, barR = bar) => addMember('oculus', depth, circlePoints2(c, r, clamp(Math.round(r * 10), 18, 64)).map(map), barR, piece)
  const foil = (c, r, L, map, depth, piece, barR = bar, phi = Math.PI / 2) => {
    if (!(r > barR * 1.2)) return null
    const f = buildFoil(c, r, L, P.cuspDepth, phi)
    if (!f) return null
    geoFoil(f, map)
    record('foil', f.residuals)
    for (const arc of f.arcs) addMember('foil', depth + 1, arc.map(map), barR * 0.7, piece)
    out.motifs += 1
    return f
  }
  const ringFoil = (rule, c, r, L, map, depth, piece, barR = bar, phi = Math.PI / 2) => {
    ring(c, r, map, depth, piece, barR)
    geoPoint(rule, c, map)
    return foil(c, r - barR * 1.5, L, map, depth, piece, barR, phi)
  }
  const sampleTC = (tc, n = 14) => sampleArch(tc, n)
  const lobes = Math.round(P.foilLobes)
  const constructionOf = (rule, arch, map) => {
    for (const s of [...arch.left, ...arch.right]) {
      geoCircle(rule, s.c, s.r, map, 64)
      geoPoint(rule, s.c, map)
    }
    geoPoint(rule, arch.apex, map, 'apex')
  }
  const grotesquePair = (map, e1, a) => {
    const roll = rand()
    step('grotesque', roll < P.grotesques ? `Grotesque pair: seed roll ${fmt(roll)} < chance ${fmt(P.grotesques)}` : `No grotesques: seed roll ${fmt(roll)} ≥ chance ${fmt(P.grotesques)}`, { roll })
    if (roll >= P.grotesques) return
    const variant = Math.floor(rand() * 3)
    for (const sgn of [-1, 1]) {
      const o3 = scale(e1, sgn)
      ornament('grotesque', map(pt(sgn * (a + r0 * 1.2), 0)), norm(v3(o3.x, 0, o3.z)), UP, r0 * 3, { variant })
    }
  }
  /** Two lancets + tangent oculus + foil inside a two-centred opening (cloister / apse bays). */
  const traceriedOpening = (tc, map, piece) => {
    if (tc.a < 1.1) return
    const inner = offsetArch(tc, -bar * 1.4)
    addMember('subarch', 1, sampleTC(inner).map(map), bar * 0.8, `${piece}i`)
    const kids = subdivideArch(inner, 2, 1)
    kids.forEach((k, i) => addMember('subarch', 2, sampleTC(k, 10).map(map), bar * 0.65, `${piece}l${i}`))
    const oc = oculusBetween(inner, kids[0], kids[1])
    if (oc && oc.radius > bar * 1.6) {
      record('oculus', oc.residuals)
      ringFoil('oculus', oc.center, oc.radius, Math.max(3, lobes - 1), map, 2, `${piece}o`, bar * 0.7)
    }
  }

  out.style = typ.id
  // ================================================= ARCH FAMILIES
  if (['tudor', 'ogee', 'round', 'storeys', 'cusped', 'rampant'].includes(typ.id)) return archFamily()
  if (typ.id === 'rose' || typ.id === 'wheel') return roseWindow(typ.id === 'wheel')
  if (typ.id === 'vesica') return vesicaWindow()
  if (typ.id === 'triangle') return triangleWindow()
  if (typ.id === 'vault') return vault()
  if (typ.id === 'chapterHouse') return chapterHouse()
  if (typ.id === 'canopy') return canopy()
  if (typ.id === 'cloister') return cloister()
  if (typ.id === 'apse') return apse()
  if (typ.id === 'arcade' || typ.id === 'interlaced') return arcade(typ.id === 'interlaced')
  if (typ.id === 'reticulated') return reticulated()
  if (typ.id === 'parapet') return parapet()
  if (typ.id === 'panel') return panelScreen()
  if (typ.id === 'spire') return spire()
  if (typ.id === 'spiralStair') return spiralStair()
  return false

  // ------------------------------------------------ arches
  function archFamily() {
    if (typ.id === 'rampant') return rampant()
    if (sig.chord < 2 || sig.h < 0.5) {
      step('typology', `${typ.id}: the curve has no arch span (chord ${fmt(sig.chord)} m) → nothing built`)
      return false
    }
    const F = archFrameOf(points)
    const W = (q) => add(add(F.A, scale(F.e1, q.x + F.a)), scale(F.e2, q.y))
    const toW = (arr) => arr.map(W)
    const fitK = clamp((F.h * F.h - F.a * F.a) / (2 * F.a * F.a), -0.4, 4)
    let tc = twoCentredArch(0, F.a, fitK, 0)
    let main = null
    if (typ.id === 'tudor') main = tudorArch(F.a, Math.min(F.h, F.a * 0.95))
    else if (typ.id === 'ogee') main = ogeeArch(F.a, F.h)
    else if (typ.id === 'round') main = roundArch(F.a, F.h)
    if (!main) {
      if (['tudor', 'ogee', 'round'].includes(typ.id)) step('arch', `${typ.id} construction has no solution for a = ${fmt(F.a)} m, h = ${fmt(F.h)} m → two-centred arch`)
      main = fromTwoCentred(tc)
    }
    record('arch', main.residuals)
    const kindText = {
      tudor: () => `Four-centred arch: springing arcs r₁ = ${fmt(main.r1)} m, haunch arcs R₂ = ${fmt(main.R2)} m, tangent at φ = ${fmt((main.phi * 180) / Math.PI)}° (|C₂ − C₁| = R₂ − r₁)`,
      ogee: () => `Ogee arch: lower arcs R₁ = ${fmt(main.R1)} m, reversed upper arcs R₂ = (p² + h² − R₁²)/2a = ${fmt(main.R2)} m, externally tangent, vertical tangent at the apex`,
      round: () => `Round / segmental arch: one circle R = (a² + h²)/2h = ${fmt(main.R)} m through both springings and the apex`,
    }
    step('arch', (kindText[main.kind] ?? (() => `Two-centred arch: k = ${fmt(tc.k)}, R = ${fmt(tc.R)} m, apex ${fmt(tc.h)} m`))(), { a: F.a, h: F.h })
    geoLine('arch', pt(-F.a * 1.15, 0), pt(F.a * 1.15, 0), W)
    constructionOf('arch', main, W)
    const orders = P.archivolts + (main.kind === 'round' ? 1 : 0)
    for (let j = 1; j <= orders; j += 1) {
      const o = archOrder(main, j * delta)
      if (o) addMember('archivolt', 1, toW(sampleCArch(o, 16)), r0 * 0.55, `archivolt${j}`)
    }
    if (orders > 0) step('archivolt', `${orders} archivolt${orders > 1 ? 's' : ''}: every arc offset r ± j·${fmt(delta)} m (same centres, joints keep their angles)`)
    const inner = archOrder(main, -r0 * 1.6) ?? main
    addMember('subarch', 1, toW(sampleCArch(inner, 16)), bar, 'inner')
    if (main.kind === 'ogee') {
      // Ogee: crockets climb the extrados to a tall finial (canopy ogee, REF-007).
      const ext = archOrder(main, orders * delta + r0 * 1.2) ?? main
      const pts = sampleCArch(ext, 10)
      const nC = Math.round(P.crockets * 5)
      for (let i = 1; i <= nC; i += 1) {
        for (const side of [0, 1]) {
          const idx = Math.round((side ? pts.length - 1 - (i * pts.length) / (2 * (nC + 1)) : (i * pts.length) / (2 * (nC + 1))))
          const q = pts[clamp(idx, 1, pts.length - 2)]
          const tq = sub(pts[clamp(idx + 1, 0, pts.length - 1)], pts[clamp(idx - 1, 0, pts.length - 1)])
          const nq = pt(-tq.y, tq.x)
          const outward = nq.x * (q.x - 0) + nq.y * (q.y - ext.h * 0.4) > 0 ? nq : pt(-nq.x, -nq.y)
          ornament('crocket', W(q), add(scale(F.e1, outward.x), scale(F.e2, outward.y)), add(scale(F.e1, tq.x), scale(F.e2, tq.y)), r0 * 0.85)
        }
      }
      ornament('finial', W(ext.apex), F.e1, UP, r0 * 1.8)
      step('crockets', `${nC * 2} crockets on the ogee extrados + finial`)
    } else ornament('keystone', W(main.apex), F.e1, F.e2, r0, { depth: r0 })

    if (main.kind === 'tudor') panelTracery(inner, W, 'panel')
    else if (main.kind === 'ogee') {
      // REF-005: the ogee is the hood moulding; the window under it is a two-centred
      // arch on the same springing, sharpest k whose outline clears the ogee by a bar.
      const poly = sampleCArch(inner, 18)
      let win = null
      for (let sw = 1; sw >= 0.55 && !win; sw -= 0.05) {
        for (let kk = 1.4; kk >= 0.2 && !win; kk -= 0.1) {
          const tcw = twoCentredArch(0, (inner.a - bar * 1.5) * sw, kk, 0)
          const pts = sampleTC(tcw, 16).slice(2, -2)
          if (fitsInside(pts, poly, bar * 1.2)) win = fromTwoCentred(tcw)
        }
      }
      if (win) {
        addMember('subarch', 1, toW(sampleCArch(win, 16)), bar, 'ogeeWindow')
        step('flamboyant', `Window under the ogee hood: two-centred arch, half-span ${fmt(win.a)} m, k = ${fmt(win.k)} (widest, then sharpest, that clears the ogee by ${fmt(bar * 1.2)} m)`)
        flamboyant(win, W)
      } else flamboyant(inner, W)
    }
    else if (main.kind === 'round') plateTracery(inner, W)
    else if (typ.id === 'storeys') storeys(offsetArch(tc, -r0 * 1.6), W)
    else if (typ.id === 'cusped') cusped(inner, W, offsetArch(tc, -r0 * 1.6))

    // Tudor: square hood mould (label) with spandrel roundels tangent to it and the arch.
    if (main.kind === 'tudor') {
      const ext = offsetCArch(main, orders * delta + r0 * 1.2) ?? main
      const yl = ext.apex.y + r0 * 2.2
      const xl = ext.feet[1].x + r0 * 1.2
      const drop = ext.h * 0.45
      addMember('gable', 1, toW([pt(-xl, drop), pt(-xl, yl), pt(xl, yl), pt(xl, drop)]), r0 * 0.45, 'label')
      ornament('boss', W(pt(-xl, drop)), F.e1, F.e2, r0 * 0.9, { lobes: 4 })
      ornament('boss', W(pt(xl, drop)), F.e1, F.e2, r0 * 0.9, { lobes: 4 })
      step('label', `Hood mould: horizontal label at ${fmt(yl)} m, returns down to ${fmt(drop)} m, label stops`)
      // Spandrel circle: centre (xs, y), r = yl − y − bar (tangent to the label), |O − C₂| = R₂ + r (tangent to the haunch arc).
      const haunch = ext.left[1]
      const xs = -xl * 0.55
      const g = (y) => Math.hypot(xs - haunch.c.x, y - haunch.c.y) - (haunch.r + (yl - bar * 1.5 - y))
      const y = bisectRoot(g, Math.max(0, archYAt(ext, xs) ?? 0), yl - bar * 2)
      if (y != null) {
        const r = yl - bar * 1.5 - y
        if (r > bar * 2) {
          record('spandrel', [Math.abs(Math.hypot(xs - haunch.c.x, y - haunch.c.y) - (haunch.r + r))])
          for (const sgn of [-1, 1]) ringFoil('label', pt(sgn * xs, y), r, 4, W, 1, `spandrel${sgn}`, bar * 0.8, Math.PI / 4)
          step('label', `Spandrel roundels r = ${fmt(r)} m, tangent to the label and the haunch arc`)
        }
      }
    }
    if (typ.id === 'cusped' && P.gable > 0) gable(tc, W, F, orders)
    if (typ.id === 'storeys') {
      for (const sgn of [-1, 1]) if (P.pinnacles > 0) ornament('pinnacle', W(pt(sgn * (F.a + r0 * 1.4), F.h * 0.55)), F.e1, UP, r0 * 1.3, { height: r0 * 9 * P.pinnacles })
    }
    grotesquePair(W, F.e1, F.a)
    out.archFrame = { ...F, family: main.kind }
    return true
  }

  function gable(tc, W, F, orders) {
    const ext = offsetArch(tc, orders * delta + r0 * 1.2)
    const gy = ext.h * (1.12 + 0.9 * P.gable)
    const ga = ext.a
    addMember('gable', 1, [W(pt(-ga, 0)), W(pt(0, gy)), W(pt(ga, 0))], r0 * 0.5, 'gable')
    step('gable', `Gable: apex ${fmt(gy)} m, half-width ${fmt(ga)} m`, { gy, ga })
    const gf = gableFoil(tc, ext.R, gy, ga)
    if (gf && gf.radius > bar * 2) {
      record('gableFoil', gf.residuals)
      ringFoil('gableFoil', gf.center, gf.radius, lobes === 4 ? 3 : 4, W, 1, 'gableFoil')
    }
    const edge = Math.hypot(ga, gy)
    const nC = Math.round((P.crockets * edge) / 1.6)
    for (let i = 1; i <= nC; i += 1) {
      const u = i / (nC + 1)
      for (const sgn of [-1, 1]) ornament('crocket', W(pt(sgn * ga * (1 - u), gy * u)), add(scale(F.e1, sgn * gy), scale(F.e2, ga)), add(scale(F.e1, -sgn * ga), scale(F.e2, gy)), r0 * 0.9)
    }
    ornament('finial', W(pt(0, gy)), F.e1, UP, r0 * 1.6)
  }

  /** Cusped intrados: foil lobes internally tangent to each side arc. */
  function cusped(inner, W, tcIn) {
    const perSide = clamp(Math.round(inner.h / 3.2), 2, 4)
    const cu = cuspedIntrados(inner, perSide, P.cuspDepth)
    if (!cu) {
      step('cusped', 'Cusps skipped: lobes do not overlap at this size')
      return
    }
    record('cusped', cu.residuals)
    cu.lobes.forEach((lb) => {
      geoCircle('cusped', lb.c, lb.r, W, 28)
      geoPoint('cusped', lb.c, W)
    })
    cu.arcs.forEach((arc, i) => addMember('foil', 1, arc.map(W), bar * 0.8, `cusp${i}`))
    cu.cusps.forEach((c) => geoPoint('cusp', c, W))
    out.motifs += cu.lobes.length
    step('cusped', `Cusped intrados: ${perSide} lobes per side, each internally tangent to its arch arc (|O − C| = R − r), cusps at neighbour intersections`, { perSide })
    // A trefoil roundel in the head above the pendant cusp.
    if (tcIn) {
      const hc = inscribedInHead(tcIn, tcIn.h * 0.66)
      if (hc && hc.radius > bar * 2) {
        record('headFoil', hc.residuals)
        ringFoil('headFoil', hc.center, hc.radius, 3, W, 1, 'cuspHead')
      }
    }
  }

  /** Perpendicular panel tracery: mullions to the arch, transoms, panel heads touching each transom. */
  function panelTracery(inner, W, piece) {
    const x0 = inner.feet[0].x
    const span = inner.feet[1].x - x0
    const n = clamp(Math.max(2 * Math.round(P.subdivision), Math.round(span / 1.5)), 3, 10)
    const xs = Array.from({ length: n + 1 }, (_, j) => x0 + (span * j) / n)
    for (let j = 1; j < n; j += 1) {
      const yt = archYAt(inner, xs[j])
      if (yt == null || yt < 0.3) continue
      addMember('mullion', 1, [W(pt(xs[j], 0)), W(pt(xs[j], yt))], bar * 0.85, `${piece}m${j}`)
      if (P.screen > 0) {
        const top = W(pt(xs[j], 0))
        if (top.y > 0.4) addMember('mullion', 1, [top, v3(top.x, top.y * (1 - P.screen), top.z)], bar * 0.85, `${piece}d${j}`)
      }
    }
    const transoms = [inner.h * 0.42]
    if (inner.h > 6) transoms.push(inner.h * 0.74)
    let heads = 0
    for (const yt of transoms) {
      // Transom from outline to outline at height yt (bisection on archYAt − yt).
      const xl = bisectRoot((x) => (archYAt(inner, x) ?? -1) - yt, x0 + 1e-6, 0)
      if (xl == null) continue
      addMember('rail', 1, [W(pt(xl, yt)), W(pt(-xl, yt))], bar * 0.8, `${piece}t${fmt(yt)}`)
      for (let j = 0; j < n; j += 1) {
        const b = (xs[j + 1] - xs[j]) / 2
        const m = (xs[j] + xs[j + 1]) / 2
        if (Math.abs(m) + b > -xl + 1e-6) continue
        const head = twoCentredArch(m, b, 1, yt - SQ3 * b) // apex exactly on the transom
        if (head.y0 < 0.3) continue
        addMember('subarch', 2, sampleTC(head, 10).map(W), bar * 0.6, `${piece}h${j}`)
        const hc = inscribedInHead(head, head.y0 + head.h * 0.3)
        if (hc && hc.radius > bar * 1.6) {
          record('headFoil', hc.residuals)
          foil(hc.center, hc.radius, 3, W, 2, `${piece}h${j}`, bar * 0.6)
        }
        heads += 1
      }
    }
    step('panel', `Panel tracery: ${n} panels, mullions rise to the arch, ${transoms.length} transom${transoms.length > 1 ? 's' : ''}, ${heads} cusped panel heads (apex = transom: y₀ = y_t − √3·b)`, { n, heads })
  }

  /** Flamboyant: ogee lights, soufflets on the mullion axes, mouchettes over the lights (REF-005). */
  function flamboyant(inner, W) {
    const n = Math.max(2, Math.round(P.subdivision))
    const x0 = inner.feet[0].x
    const span = inner.feet[1].x - x0
    const b = span / (2 * n)
    const hl = Math.min(inner.h * 0.36, b * 1.9)
    const poly = sampleCArch(inner, 18)
    const lightPolys = []
    for (let i = 0; i < n; i += 1) {
      const m = x0 + b * (2 * i + 1)
      let light = ogeeArch(b, hl)
      if (!light) light = fromTwoCentred(twoCentredArch(0, b, 1, 0))
      light = shiftArch(light, m)
      record('ogeeLight', light.residuals ?? [])
      const lp = sampleCArch(light, 10)
      lightPolys.push(lp)
      addMember('subarch', 2, lp.map(W), bar * 0.8, `light${i}`)
      ornament('finial', W(light.apex), v3(1, 0, 0), UP, bar * 1.6)
      if (i > 0 && P.screen > 0) {
        const top = W(pt(m - b, 0))
        if (top.y > 0.4) addMember('mullion', 1, [top, v3(top.x, top.y * (1 - P.screen), top.z)], bar, `fm${i}`)
      }
    }
    const margin = bar * 1.8
    const clear = (pts) => fitsInside(pts, poly, margin) && pts.every((p) => lightPolys.every((lp) => !pointInPoly(p, lp) && distToPoly(p, lp) >= margin))
    const placed = []
    const clearOf = (pts) => pts.every((p) => placed.every((q) => !pointInPoly(p, q) && distToPoly(p, q) >= margin))
    // Mouchettes: tail at each light's finial, head anywhere in the free head space,
    // curling toward the axis. Fit: grid over head centres, bisection on the head
    // radius (largest r whose outline clears the arch, the lights and earlier shapes).
    let mou = 0
    const yTopAll = inner.h
    // Fit the left half (and the middle light); the right half is the exact mirror x → −x.
    for (let i = 0; i < Math.ceil(n / 2); i += 1) {
      const m = x0 + b * (2 * i + 1)
      const side = m < -1e-6 ? -1 : m > 1e-6 ? 1 : 0
      const T = pt(m, hl + margin * 1.1)
      const fits = (O, r) => {
        // Curl toward the side the head leans to; a sided mouchette stays on its own half.
        const mo = mouchette(O, r, T, (O.x < T.x ? -1 : 1) * 0.3)
        if (mo && side !== 0 && mo.outline.some((q) => q.x * side < bar * 0.4)) return null
        return mo && clear(mo.outline) && clearOf(mo.outline) ? mo : null
      }
      let best = null
      const gx = Math.max(0.12, b * 0.12)
      // Head centres over the whole half: from the outer springing to the axis.
      const oxFrom = side < 0 ? x0 + bar * 2 : side > 0 ? -x0 - bar * 2 : -b
      const oxTo = side < 0 ? -bar : side > 0 ? bar : b
      for (let ox = oxFrom; side >= 0 ? ox >= oxTo : ox <= oxTo; ox -= (side || -1) * gx) {
        for (let oy = T.y + bar * 3; oy < yTopAll; oy += gx) {
          const O = pt(ox, oy)
          if (Math.hypot(O.x - T.x, O.y - T.y) < bar * 4) continue
          let lo = bar * 1.2
          let hi = Math.min(b * 0.9, Math.hypot(O.x - T.x, O.y - T.y) * 0.45)
          if (hi <= lo || (best && hi <= best.r) || !fits(O, lo)) continue
          for (let it = 0; it < 8; it += 1) {
            const mid = (lo + hi) / 2
            if (fits(O, mid)) lo = mid
            else hi = mid
          }
          if (!best || lo > best.r) best = { r: lo, mo: fits(O, lo) }
        }
        if (side === 0) break
      }
      const ok = best?.mo
      if (ok) {
        record('mouchette', ok.residuals)
        addMember('foil', 2, ok.outline.map(W), bar * 0.7, `mou${i}`)
        geoPoint('flamboyant', ok.head.O, W, 'mouchette head')
        ok.flanks.forEach((f) => geoCircle('flamboyant', f.Q, f.R, W, 40))
        placed.push(ok.outline)
        mou += 1
        if (side !== 0) {
          const mirror = ok.outline.map((q) => pt(-q.x, q.y))
          addMember('foil', 2, mirror.map(W), bar * 0.7, `mou${n - 1 - i}`)
          placed.push(mirror)
          mou += 1
        }
      }
    }
    // Soufflets: vertical lenses on each mullion axis between the light heads.
    // Fit: the largest lens (A, B) whose outline clears the arch and both lights by
    // the margin — searched over the bottom tip height and the half-width.
    let souf = 0
    for (let j = 1; j < n; j += 1) {
      const x = x0 + 2 * b * j
      const ytop = (archYAt(inner, x) ?? 0) - margin
      let ok = null
      let best = 0
      const dy = Math.max(0.1, hl * 0.06)
      for (let yt = ytop; yt > hl * 0.5; yt -= dy) {
        for (let yb = hl * 0.35; yb < yt - bar * 5; yb += dy) {
          const A = (yt - yb) / 2
          for (let B = A * 0.6; B > bar * 1.5; B *= 0.86) {
            if (A * B <= best) break
            const v = vesica(pt(x, yb + A), A, B)
            if (clear(v.outline)) {
              ok = v
              best = A * B
              break
            }
          }
        }
      }
      if (ok) {
        record('soufflet', ok.residuals)
        addMember('oculus', 2, ok.outline.map(W), bar * 0.75, `souf${j}`)
        placed.push(ok.outline)
        ok.centres.forEach((c) => geoPoint('flamboyant', c, W))
        souf += 1
      }
    }
    out.motifs += souf + mou
    step('flamboyant', `Flamboyant tracery: ${n} ogee lights (half-span ${fmt(b)} m), ${souf} soufflets (vesica R = (A² + B²)/2B) on the mullion axes, ${mou} mouchettes (flanks internally tangent to the head, t = (r² − |w|²)/2(w·u − r))`, { n, souf, mou })
  }

  /** Plate tracery: two round-headed lights and a roundel tangent to the arch and both lights. */
  function plateTracery(inner, W) {
    const C = inner.left[0].c
    const R = inner.left[0].r
    const m = inner.feet[1].x / 2
    const b = m - bar * 1.4
    for (const sgn of [-1, 1]) {
      const light = roundArch(b, b)
      addMember('subarch', 2, sampleCArch(shiftArch(light, sgn * m), 10).map(W), bar * 0.8, `plate${sgn}`)
    }
    addMember('mullion', 1, [W(pt(0, 0)), W(pt(0, b * 0.15))], bar, 'plateMullion')
    const oc = circleBetween(pt(0, 0), pt(0, 1), C, R, pt(m, 0), b, b * 0.3, C.y + R)
    if (oc && oc.radius > bar * 2) {
      record('plate', oc.residuals)
      ringFoil('plate', oc.center, oc.radius, lobes, W, 1, 'plateRoundel')
      geoLine('tangency', C, oc.center, W)
      geoLine('tangency', pt(m, 0), oc.center, W)
      step('plate', `Plate tracery: two round-headed lights (b = ${fmt(b)} m) and a roundel r = ${fmt(oc.radius)} m, internally tangent to the arch circle and externally to both lights`, { r: oc.radius })
    } else step('plate', 'Plate tracery: two lights; no room for the roundel (segmental arch too low)')
  }

  /** Arcade · triforium · clerestory inside a tall two-centred arch (REF-004). */
  function storeys(inner, W) {
    const H = inner.h
    const y1 = H * 0.45
    const y2 = y1 + Math.max(1.4, H * 0.11)
    const halfAt = (y) => (y <= 0 ? inner.a : -(inner.left.center.x - Math.sqrt(Math.max(0, inner.R * inner.R - y * y))))
    for (const y of [y1, y2]) addMember('rail', 1, [W(pt(-halfAt(y), y)), W(pt(halfAt(y), y))], bar, `storey${fmt(y)}`)
    // Arcade.
    const na = Math.max(2, Math.round(P.subdivision))
    const b = inner.a / na
    const ha = Math.min(SQ3 * b, y1 * 0.5)
    const k = clamp(((ha / b) ** 2 - 1) / 2, -0.3, 1)
    const ys = y1 - b * Math.sqrt(1 + 2 * k)
    for (let i = 0; i < na; i += 1) {
      const arc = twoCentredArch(-inner.a + b * (2 * i + 1), b, k, ys)
      addMember('subarch', 1, sampleTC(arc).map(W), bar, `arcade${i}`)
      if (i > 0) {
        const x = -inner.a + 2 * b * i
        addMember('shaft', 1, [W(pt(x, 0)), W(pt(x, ys))], bar * 1.3, `arcadeCol${i}`)
        ornament('capital', W(pt(x, ys)), v3(1, 0, 0), UP, bar * 2.2)
      }
    }
    // Triforium: small equilateral arches whose apexes touch the upper rail.
    const wt = halfAt(y2)
    const nt = na * 3
    const bt = wt / nt
    for (let i = 0; i < nt; i += 1) {
      const arc = twoCentredArch(-wt + bt * (2 * i + 1), bt, 1, y2 - SQ3 * bt)
      if (arc.y0 < y1) continue
      addMember('subarch', 2, sampleTC(arc, 8).map(W), bar * 0.6, `trif${i}`)
      if (i > 0) addMember('mullion', 2, [W(pt(-wt + 2 * bt * i, y1)), W(pt(-wt + 2 * bt * i, arc.y0))], bar * 0.55, `trifCol${i}`)
    }
    // Clerestory: mullions to the arch and a foiled roundel in the head.
    for (let i = 1; i < na; i += 1) {
      const x = -halfAt(y2) + (2 * halfAt(y2) * i) / na
      const yt = archYAt(fromTwoCentred(inner), x)
      if (yt) addMember('mullion', 1, [W(pt(x, y2)), W(pt(x, yt))], bar * 0.8, `cler${i}`)
    }
    const hc = inscribedInHead(inner, y2 + (H - y2) * 0.45)
    if (hc && hc.radius > bar * 2) {
      record('headFoil', hc.residuals)
      ringFoil('storeys', hc.center, hc.radius, lobes, W, 1, 'clerRoundel')
    }
    step('storeys', `Stacked elevation: arcade of ${na} arches to ${fmt(y1)} m, triforium of ${nt} arches (apex on the rail) to ${fmt(y2)} m, clerestory above`, { y1, y2, na, nt })
  }

  /** Rampant arch + curvilinear branches (concentric with the opposite arc). */
  function rampant() {
    const A0 = points[0]
    const B0 = points[points.length - 1]
    const hv = v3(B0.x - A0.x, 0, B0.z - A0.z)
    const hl = Math.hypot(hv.x, hv.z)
    if (hl < 2) {
      step('rampant', 'Rampant arch needs a horizontal span ≥ 2 m → nothing built')
      return false
    }
    const hd = scale(hv, 1 / hl)
    const ah = hl / 2
    const O = add(A0, scale(hd, ah))
    const W = (q) => v3(O.x + hd.x * q.x, A0.y + q.y, O.z + hd.z * q.x)
    const toW = (arr) => arr.map(W)
    const d = B0.y - A0.y
    let ap = null
    for (const p of points) {
      const q = pt(dot(sub(p, O), hd), p.y - A0.y)
      if (!ap || q.y > ap.y) ap = q
    }
    const main = rampantArch(ah, d, ap.x, Math.max(ap.y, Math.max(0, d) + 0.5))
    if (!main) {
      step('rampant', 'Rampant construction has no solution → nothing built')
      return false
    }
    record('arch', main.residuals)
    step('arch', `Rampant arch: springings at 0 and ${fmt(d)} m; each arc centred on its own springing line through the apex (${fmt(main.xp)}, ${fmt(main.apex.y)}): R₁ = ${fmt(main.left[0].r)} m, R₂ = ${fmt(main.right[0].r)} m`, { d })
    constructionOf('arch', main, W)
    for (let j = 1; j <= P.archivolts; j += 1) {
      const o = offsetCArch(main, j * delta)
      if (o) addMember('archivolt', 1, toW(sampleCArch(o, 16)), r0 * 0.55, `archivolt${j}`)
    }
    const inner = offsetCArch(main, -r0 * 1.6) ?? main
    addMember('subarch', 1, toW(sampleCArch(inner, 16)), bar, 'inner')
    ornament('keystone', W(main.apex), hd, UP, r0, { depth: r0 })
    // Curvilinear branches: mullions from the sloped springing, forks concentric with the opposite arc.
    const n = Math.max(3, Math.round(P.subdivision) + 1)
    const ysAt = (x) => (d * (x + ah)) / (2 * ah)
    let branches = 0
    const Lc = inner.left[0]
    const Rc = inner.right[0]
    for (let j = 1; j < n; j += 1) {
      const x = -ah + (2 * ah * j) / n
      const top = archYAt(inner, x)
      if (top == null) continue
      const ybr = ysAt(x) + 0.4 * (top - ysAt(x))
      addMember('mullion', 1, [W(pt(x, ysAt(x))), W(pt(x, ybr))], bar, `rm${j}`)
      for (const [Cc, target] of [
        [Rc.c, Lc],
        [Lc.c, Rc],
      ]) {
        const rad = Math.hypot(x - Cc.x, ybr - Cc.y)
        const hits = circleCircle(Cc, rad, target.c, target.r).filter((h) => h.y > ybr && (archYAt(inner, h.x) ?? -1) >= h.y - 1e-6)
        if (!hits.length) continue
        const end = hits.reduce((p, q) => (q.y > p.y ? q : p))
        record('curvilinear', [Math.abs(Math.hypot(end.x - target.c.x, end.y - target.c.y) - target.r)])
        addMember('subarch', 1, toW(sampleArcBetween(Cc, rad, pt(x, ybr), end, 14)), bar * 0.85, `rb${j}${branches}`)
        geoPoint('curvilinear', Cc, W, 'branch centre')
        branches += 1
      }
    }
    out.motifs += branches
    step('curvilinear', `Curvilinear tracery: ${n - 1} mullions from the sloped springing; ${branches} branches, each concentric with the opposite arc`, { branches })
    // A mouchette in the head, tail toward the lower springing.
    const poly = sampleCArch(inner, 16)
    const T = pt(inner.apex.x * 0.5, (inner.apex.y + Math.max(0, d)) * 0.55)
    for (let r = ah * 0.3, it = 0; it < 14; it += 1, r *= 0.85) {
      const Oh = pt(T.x - Math.sign(d || 1) * r * 1.2, T.y + r * 2.6)
      const mo = mouchette(Oh, r, T, Math.sign(d || 1) * 0.5)
      if (mo && r > bar * 2 && fitsInside(mo.outline, poly, bar * 2)) {
        record('mouchette', mo.residuals)
        addMember('foil', 2, toW(mo.outline), bar * 0.7, 'rmou')
        out.motifs += 1
        break
      }
    }
    grotesquePair((q) => W(pt(q.x < 0 ? -ah - r0 * 1.2 : ah + r0 * 1.2, q.x < 0 ? 0 : d)), hd, 0)
    out.archFrame = { A: A0, e1: hd, e2: UP, a: ah, h: main.apex.y, family: 'rampant' }
    return true
  }

  // ------------------------------------------------ closed windows
  function windowPlane() {
    const f = sig.frame
    const p2 = points.map((p) => pt(dot(sub(p, f.origin), f.u), dot(sub(p, f.origin), f.v)))
    const M = (q) => add(add(f.origin, scale(f.u, q.x)), scale(f.v, q.y))
    return { p2, M, f }
  }

  function roseWindow(wheel) {
    const { p2, M } = windowPlane()
    const fit = fitCircle2(p2) ?? { center: pt(0, 0), radius: sig.meanRadius }
    const O = fit.center
    const R = fit.radius
    if (R < 1.5) {
      step(wheel ? 'wheel' : 'rose', `Circle radius ${fmt(R)} m too small for a ${wheel ? 'wheel' : 'rose'} window`)
      return false
    }
    const Rin = R - r0 * 1.6
    ring(O, Rin, M, 1, 'rim', bar)
    geoCircle(wheel ? 'wheel' : 'rose', O, R, M, 96)
    geoPoint(wheel ? 'wheel' : 'rose', O, M, 'centre')
    const choices = wheel ? [6, 8, 10, 12] : [6, 8, 10, 12, 16, 20, 24]
    const want = (TAU * R) / (wheel ? 4 : 3.2)
    const n = choices.reduce((p, q) => (Math.abs(q - want) < Math.abs(p - want) ? q : p))
    const rh = Math.max(R * 0.17, bar * 5)
    ringFoil(wheel ? 'wheel' : 'rose', O, rh, wheel ? Math.max(3, Math.min(8, n / 2)) : lobes, M, 1, 'hub')
    const rule = wheel ? 'wheel' : 'rose'
    let rim = 0
    for (let kk = 0; kk < n; kk += 1) {
      const th = Math.PI / 2 + (TAU * kk) / n
      const phi = th + Math.PI / n // sector axis
      const rot = (q) => {
        const a = phi - Math.PI / 2
        return pt(O.x + q.x * Math.cos(a) - q.y * Math.sin(a), O.y + q.x * Math.sin(a) + q.y * Math.cos(a))
      }
      const L = (q) => M(rot(q))
      const s = Math.sin(Math.PI / n)
      const c = Math.cos(Math.PI / n)
      const e = pt(Math.cos(th), Math.sin(th))
      if (wheel) {
        // Colonnette spoke, round arch between spokes, roundel between arch and rim.
        const rhoS = Math.min(Rin * 0.82, (Rin - bar * 3) / (c + s))
        const b = rhoS * s
        const Cl = pt(0, rhoS * c)
        addMember('shaft', 1, [M(pt(O.x + e.x * rh, O.y + e.y * rh)), M(pt(O.x + e.x * rhoS, O.y + e.y * rhoS))], bar * 0.9, `spoke${kk}`)
        addMember('subarch', 1, sampleArcBetween(Cl, b, pt(b, Cl.y), pt(-b, Cl.y), 14, true).map(L), bar * 0.8, `wa${kk}`)
        const next = pt(Math.cos(th + TAU / n), Math.sin(th + TAU / n))
        const oc = circleBetween(O, next, O, Rin, rot(Cl), b, rhoS + 1e-4, Rin)
        if (oc && oc.radius > bar * 1.5) {
          record('wheel', oc.residuals)
          ring(oc.center, oc.radius, M, 2, `wr${kk}`, bar * 0.6)
          rim += 1
        }
      } else {
        // Spoke, radiating lancet (springing on the spokes), head trefoil, rim oculus.
        const rhoS = R * 0.5
        const b = rhoS * s
        const y0 = rhoS * c
        const maxH = Rin - y0 - bar * 3
        const k = clamp(((maxH / b) ** 2 - 1) / 2, 0.15, 1.2)
        const tc = twoCentredArch(0, b, k, y0)
        addMember('mullion', 1, [M(pt(O.x + e.x * rh, O.y + e.y * rh)), M(pt(O.x + e.x * rhoS, O.y + e.y * rhoS))], bar * 0.85, `spoke${kk}`)
        addMember('subarch', 1, sampleTC(tc, 10).map(L), bar * 0.8, `lancet${kk}`)
        if (kk === 0) {
          geoCircle(rule, rot(tc.left.center), tc.R, M, 40)
          geoCircle(rule, rot(tc.right.center), tc.R, M, 40)
        }
        const hc = inscribedInHead(tc, y0 + tc.h * 0.35)
        if (hc && hc.radius > bar * 1.5) {
          record('headFoil', hc.residuals)
          foil(hc.center, hc.radius, 3, L, 2, `lancet${kk}`, bar * 0.6)
        }
        // Rim oculus on the next spoke: inside the rim, tangent to this lancet's facing arc.
        const next = pt(Math.cos(th + TAU / n), Math.sin(th + TAU / n))
        const oc = circleBetween(O, next, O, Rin, rot(tc.left.center), tc.R, rhoS + 1e-4, Rin)
        if (oc && oc.radius > bar * 1.6) {
          record('rose', oc.residuals)
          ringFoil(rule, oc.center, oc.radius, 3, M, 2, `rim${kk}`, bar * 0.6, th + TAU / n)
          rim += 1
        }
      }
    }
    out.motifs += n
    step(rule, wheel ? `Wheel window: ${n} colonnette spokes, round arches on the spokes, ${rim} roundels tangent to the rim and the arches` : `Rose window: R = ${fmt(R)} m (circle fit), ${n} sectors (θₖ = 2πk/n), radiating lancets springing at ρ = R/2, ${rim} rim oculi (|O − C| = R_rim − r, tangent to the lancets)`, { n, R, rim })
    return true
  }

  function vesicaWindow() {
    const { p2, M } = windowPlane()
    // In-plane principal axis.
    let sxx = 0
    let syy = 0
    let sxy = 0
    for (const p of p2) {
      sxx += p.x * p.x
      syy += p.y * p.y
      sxy += p.x * p.y
    }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const ax = pt(Math.cos(ang), Math.sin(ang))
    const A = Math.max(...p2.map((p) => Math.abs(p.x * ax.x + p.y * ax.y)))
    const B = Math.max(...p2.map((p) => Math.abs(-p.x * ax.y + p.y * ax.x)))
    const rot = ang - Math.PI / 2
    const outer = vesica(pt(0, 0), A, B, rot)
    const c = outer.R - B
    const Ri = outer.R - r0 * 1.6
    const Ai = Math.sqrt(Math.max(0, Ri * Ri - c * c))
    const Bi = Ri - c
    if (!(Bi > bar * 4)) {
      step('vesica', 'Vesica too narrow for tracery')
      return false
    }
    const inner = vesica(pt(0, 0), Ai, Bi, rot)
    record('vesica', [...outer.residuals, ...inner.residuals])
    addMember('subarch', 1, inner.outline.map(M), bar, 'vesicaInner')
    outer.centres.forEach((cc) => geoCircle('vesica', cc, outer.R, M, 64))
    const T = (q) => pt(q.x * Math.cos(rot) - q.y * Math.sin(rot), q.x * Math.sin(rot) + q.y * Math.cos(rot))
    // Central roundel r = R' − c touches both arcs; end roundels: r(y) = R' − √(c² + y²), y = Bi + r.
    ringFoil('vesica', pt(0, 0), Bi, lobes, M, 1, 'vCentre')
    const y = bisectRoot((yy) => yy - Bi - (Ri - Math.hypot(c, yy)), Bi, Ai)
    let ends = 0
    if (y != null) {
      const r = Ri - Math.hypot(c, y)
      if (r > bar * 2) {
        for (const sgn of [-1, 1]) {
          ringFoil('vesica', T(pt(0, sgn * y)), r, 3, M, 1, `vEnd${sgn}`, bar * 0.8, rot + (sgn > 0 ? Math.PI / 2 : -Math.PI / 2))
          record('vesica', [Math.abs(Math.hypot(c, y) - (Ri - r)), Math.abs(y - (Bi + r))])
          ends += 1
        }
      }
    }
    step('vesica', `Vesica window: tips ±${fmt(A)} m, half-width ${fmt(B)} m, arcs R = (A² + B²)/2B = ${fmt(outer.R)} m; central roundel r = R′ − c = ${fmt(Bi)} m, ${ends} end roundels tangent to it and both arcs`, { A, B })
    out.motifs += 1 + ends
    return true
  }

  function triangleWindow() {
    const { p2, M } = windowPlane()
    const far = (from) => p2.reduce((p, q) => (Math.hypot(q.x - from.x, q.y - from.y) > Math.hypot(p.x - from.x, p.y - from.y) ? q : p))
    const P1 = far(pt(0, 0))
    const P2 = far(P1)
    const area = (q) => Math.abs((P2.x - P1.x) * (q.y - P1.y) - (P2.y - P1.y) * (q.x - P1.x))
    const P3 = p2.reduce((p, q) => (area(q) > area(p) ? q : p))
    const Vs = [P1, P2, P3]
    const G = pt((P1.x + P2.x + P3.x) / 3, (P1.y + P2.y + P3.y) / 3)
    const sides = []
    for (let i = 0; i < 3; i += 1) {
      const a = Vs[i]
      const b = Vs[(i + 1) % 3]
      const L = Math.hypot(b.x - a.x, b.y - a.y)
      const mid = pt((a.x + b.x) / 2, (a.y + b.y) / 2)
      let nrm = pt(-(b.y - a.y) / L, (b.x - a.x) / L)
      if (nrm.x * (G.x - mid.x) + nrm.y * (G.y - mid.y) < 0) nrm = pt(-nrm.x, -nrm.y)
      const off = Math.sqrt(Math.max(0, L * L - (L / 2) ** 2))
      sides.push({ c: pt(mid.x + nrm.x * off, mid.y + nrm.y * off), R: L, a, b })
      geoCircle('triangle', sides[i].c, L, M, 64)
    }
    const Ri = (s) => s.R - r0 * 1.6
    const innerCorners = Vs.map((V, i) => {
      const s1 = sides[(i + 2) % 3]
      const s2 = sides[i]
      const hits = circleCircle(s1.c, Ri(s1), s2.c, Ri(s2))
      return hits.length ? hits.reduce((p, q) => (Math.hypot(q.x - V.x, q.y - V.y) < Math.hypot(p.x - V.x, p.y - V.y) ? q : p)) : V
    })
    for (let i = 0; i < 3; i += 1) addMember('subarch', 1, sampleArcBetween(sides[i].c, Ri(sides[i]), innerCorners[i], innerCorners[(i + 1) % 3], 16).map(M), bar, `tri${i}`)
    const ins = circleInsideThree(sides.map((s) => ({ c: s.c, R: Ri(s) })), G)
    if (ins && ins.radius > bar * 2) {
      record('triangle', ins.residuals)
      ringFoil('triangle', ins.center, ins.radius, 3, M, 1, 'triFoil', bar, Math.atan2(P1.y - ins.center.y, P1.x - ins.center.x))
    }
    step('triangle', `Spherical-triangle window: three arcs through the corners, each centred on the opposite side's bisector (R = side), inscribed roundel tangent to all three (Newton, residual ${(ins ? Math.max(...ins.residuals) : 0).toExponential(1)})`)
    out.motifs += 1
    return true
  }

  // ------------------------------------------------ plans on the ground
  function vault() {
    const { M, local } = planFrame(points, sig)
    const xs = local.map((q) => q.x)
    const zs = local.map((q) => q.y)
    const x0 = Math.min(...xs)
    const x1 = Math.max(...xs)
    const z0 = Math.min(...zs)
    const z1 = Math.max(...zs)
    const Wz = z1 - z0
    const Lx = x1 - x0
    if (Wz < 2) return false
    const nb = Math.max(1, Math.round(Lx / Wz))
    const bl = Lx / nb
    const hs = clamp(Wz * 0.8, 4, 18)
    const zc = (z0 + z1) / 2
    const sexpartite = nb >= 2 && nb % 2 === 0
    const ht = (SQ3 * Wz) / 2
    const rr = r0 * 0.55
    for (let i = 0; i <= nb; i += 1) {
      const x = x0 + bl * i
      for (const z of [z0, z1]) {
        addMember('pier', 1, [M(x, 0, z), M(x, hs, z)], r0 * 1.3, `vp${i}${z === z0 ? 'a' : 'b'}`)
        ornament('capital', M(x, hs, z), v3(1, 0, 0), UP, r0 * 1.6)
      }
      // Transverse rib: equilateral arch across the width.
      const tr = twoCentredArch(0, Wz / 2, 1, 0)
      addMember('archivolt', 1, sampleTC(tr, 16).map((q) => M(x, hs + q.y, zc + q.x)), rr, `tr${i}`)
    }
    let diag = 0
    for (let i = 0; i < nb; i += 1) {
      const xa = x0 + bl * i
      const xb = xa + bl
      // Wall ribs (formerets) on both long sides.
      const wr = twoCentredArch(0, bl / 2, 1, 0)
      for (const z of [z0, z1]) addMember('archivolt', 1, sampleTC(wr, 12).map((q) => M((xa + xb) / 2 + q.x, hs + q.y, z)), rr * 0.8, `wr${i}${z === z0 ? 'a' : 'b'}`)
    }
    const step2 = sexpartite ? 2 : 1
    for (let i = 0; i < nb; i += step2) {
      const xa = x0 + bl * i
      const xb = x0 + bl * (i + step2)
      for (const [za, zb] of [
        [z0, z1],
        [z1, z0],
      ]) {
        const dx = xb - xa
        const dz = zb - za
        const D = Math.hypot(dx, dz)
        const a = D / 2
        // Diagonal rib reaches the crown height of the transverse ribs: segmental when ht < a.
        const arch = ht >= a ? fromTwoCentred(twoCentredArch(0, a, (ht * ht - a * a) / (2 * a * a), 0)) : roundArch(a, ht)
        record('vault', arch.residuals ?? [])
        const map = (q) => M((xa + xb) / 2 + (dx / D) * q.x, hs + q.y, zc + (dz / D) * q.x)
        addMember('springer', 1, sampleCArch(arch, 14).map(map), rr, `dg${i}${za === z0 ? 'a' : 'b'}`)
        diag += 1
        if (za === z0) geoCircle('vault', arch.left[0].c, arch.left[0].r, map, 48)
      }
      ornament('boss', M((xa + xb) / 2, hs + ht, zc), v3(1, 0, 0), scale(UP, -1), r0 * 1.2, { lobes: Math.max(4, lobes) })
    }
    if (P.subdivision >= 3) {
      addMember('springer', 2, [M(x0, hs + ht, zc), M(x1, hs + ht, zc)], rr * 0.8, 'ridge')
      // Tiercerons: arc with vertical tangent at the springing (centre on the springing line) to the ridge.
      for (let i = 0; i <= nb; i += 1) {
        const x = x0 + bl * i
        for (const z of [z0, z1]) {
          for (const s of [-1, 1]) {
            const xr = x + (s * bl) / 2
            if (xr < x0 - 1e-6 || xr > x1 + 1e-6) continue
            const Lh = Math.hypot(xr - x, zc - z)
            const R = (Lh * Lh + ht * ht) / (2 * Lh)
            const ux = (xr - x) / Lh
            const uz = (zc - z) / Lh
            const arc = sampleArcBetween(pt(R, 0), R, pt(0, 0), pt(Lh, ht), 12)
            addMember('springer', 2, arc.map((q) => M(x + ux * q.x, hs + q.y, z + uz * q.x)), rr * 0.7, `tc${i}${z}${s}`)
          }
        }
      }
    }
    step('vault', `${sexpartite ? 'Sexpartite' : 'Quadripartite'} ribbed vault: plan ${fmt(Lx)} × ${fmt(Wz)} m → ${nb} bays of ${fmt(bl)} m, springing ${fmt(hs)} m; transverse ribs equilateral (crown ${fmt(hs + ht)} m), ${diag} diagonal ribs reach the same crown${P.subdivision >= 3 ? ', ridge rib + tiercerons (lancets ≥ 3)' : ''}`, { nb, hs, sexpartite })
    out.motifs += nb
    return true
  }

  function chapterHouse() {
    const { M, local } = planFrame(points, sig)
    const fit = fitCircle2(local)
    if (!fit || fit.radius < 2.5) return false
    const O = fit.center
    const Rc = fit.radius
    const n = clamp(Math.round((TAU * Rc) / 6), 6, 12)
    const hs = clamp(Rc * 0.8, 4, 14)
    const rr = r0 * 0.55
    addMember('pier', 1, [M(O.x, 0, O.y), M(O.x, hs, O.y)], r0 * 1.9, 'centralColumn')
    ornament('capital', M(O.x, hs, O.y), v3(1, 0, 0), UP, r0 * 2.6)
    const apexes = []
    for (let k = 0; k < n; k += 1) {
      const th = (TAU * k) / n
      const e = pt(Math.cos(th), Math.sin(th))
      const Pk = pt(O.x + e.x * Rc, O.y + e.y * Rc)
      addMember('pier', 1, [M(Pk.x, 0, Pk.y), M(Pk.x, hs, Pk.y)], r0 * 1.2, `wp${k}`)
      ornament('capital', M(Pk.x, hs, Pk.y), v3(1, 0, 0), UP, r0 * 1.5)
      // Radial rib: equilateral arch from the column to the wall pier (vertical tangents at both).
      const tc = twoCentredArch(0, Rc / 2, 1, 0)
      const map = (q) => M(O.x + e.x * (Rc / 2 + q.x), hs + q.y, O.y + e.y * (Rc / 2 + q.x))
      addMember('springer', 1, sampleTC(tc, 14).map(map), rr, `rr${k}`)
      apexes.push({ th, y: hs + tc.h })
      ornament('boss', map(tc.apex), v3(1, 0, 0), scale(UP, -1), r0, { lobes: 4 })
      // Wall rib along the chord to the next pier.
      const th2 = (TAU * (k + 1)) / n
      const Q = pt(O.x + Math.cos(th2) * Rc, O.y + Math.sin(th2) * Rc)
      const ch = Math.hypot(Q.x - Pk.x, Q.y - Pk.y)
      const wtc = twoCentredArch(0, ch / 2, 1, 0)
      const cd = pt((Q.x - Pk.x) / ch, (Q.y - Pk.y) / ch)
      addMember('archivolt', 1, sampleTC(wtc, 12).map((q) => M((Pk.x + Q.x) / 2 + cd.x * q.x, hs + q.y, (Pk.y + Q.y) / 2 + cd.y * q.x)), rr * 0.8, `cw${k}`)
    }
    // Lierne ring through the rib apexes: a horizontal circle of radius Rc / 2.
    const ring3 = []
    for (let i = 0; i <= 72; i += 1) {
      const th = (TAU * i) / 72
      ring3.push(M(O.x + Math.cos(th) * Rc * 0.5, apexes[0].y, O.y + Math.sin(th) * Rc * 0.5))
    }
    addMember('springer', 2, ring3, rr * 0.75, 'lierne')
    step('chapterHouse', `Chapter house: plan circle R = ${fmt(Rc)} m, central column, ${n} wall piers; radial ribs are equilateral arches column → wall (vertical tangent at both), lierne ring at R/2 through their apexes, ${n} wall ribs`, { n, Rc, hs })
    out.motifs += n
    return true
  }

  function canopy() {
    // Footprint: plan rectangle of a loop, or a square around a short vertical curve.
    let M
    let hx
    let hz
    let H
    if (sig.closed) {
      const pf = planFrame(points, sig)
      M = pf.M
      const xs = pf.local.map((q) => q.x)
      const zs = pf.local.map((q) => q.y)
      hx = (Math.max(...xs) - Math.min(...xs)) / 2
      hz = (Math.max(...zs) - Math.min(...zs)) / 2
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2
      const cz = (Math.max(...zs) + Math.min(...zs)) / 2
      const M0 = M
      M = (x, y, z) => M0(x + cx, y, z + cz)
      H = clamp(sig.length * 0.4, 5, 14)
    } else {
      const base = points[0].y < points[points.length - 1].y ? points[0] : points[points.length - 1]
      H = sig.rise
      hx = hz = clamp(H * 0.22, 1, 4)
      M = (x, y, z) => v3(base.x + x, base.y + y, base.z + z)
    }
    const hs = H * 0.5
    const corners = [pt(-hx, -hz), pt(hx, -hz), pt(hx, hz), pt(-hx, hz)]
    corners.forEach((c, i) => {
      addMember('shaft', 1, [M(c.x, 0, c.y), M(c.x, hs, c.y)], r0 * 0.7, `cs${i}`)
      ornament('capital', M(c.x, hs, c.y), v3(1, 0, 0), UP, r0 * 1.1)
      ornament('base', M(c.x, 0, c.y), v3(1, 0, 0), UP, r0 * 1.1)
    })
    let archH = 0
    for (let i = 0; i < 4; i += 1) {
      const A = corners[i]
      const B = corners[(i + 1) % 4]
      const a = Math.hypot(B.x - A.x, B.y - A.y) / 2
      const e = pt((B.x - A.x) / (2 * a), (B.y - A.y) / (2 * a))
      const mid = pt((A.x + B.x) / 2, (A.y + B.y) / 2)
      const F = (q) => M(mid.x + e.x * q.x, hs + q.y, mid.y + e.y * q.x)
      const tc = twoCentredArch(0, a, 0.9, 0)
      archH = tc.h
      addMember('subarch', 1, sampleTC(tc, 14).map(F), bar, `ca${i}`)
      const hc = inscribedInHead(offsetArch(tc, -bar * 1.4), tc.h * 0.4)
      if (hc && hc.radius > bar * 1.6) {
        record('headFoil', hc.residuals)
        foil(hc.center, hc.radius, 3, F, 1, `ca${i}`, bar * 0.7)
      }
      const ext = offsetArch(tc, r0 * 1.2)
      const gy = ext.h * 1.85
      addMember('gable', 1, [F(pt(-ext.a, 0)), F(pt(0, gy)), F(pt(ext.a, 0))], r0 * 0.45, `cg${i}`)
      const gf = gableFoil(tc, ext.R, gy, ext.a)
      if (gf && gf.radius > bar * 2) {
        record('gableFoil', gf.residuals)
        ringFoil('canopy', gf.center, gf.radius, 4, F, 1, `cgf${i}`, bar * 0.8, Math.PI / 4)
      }
      const nC = Math.round(P.crockets * 3)
      const ex3 = v3(e.x, 0, e.y)
      const out3 = v3(e.y, 0, -e.x)
      for (let j = 1; j <= nC; j += 1) {
        const u = j / (nC + 1)
        for (const sgn of [-1, 1]) ornament('crocket', F(pt(sgn * ext.a * (1 - u), gy * u)), add(scale(ex3, sgn), out3), add(scale(ex3, -sgn * ext.a), scale(UP, gy)), r0 * 0.7)
      }
      ornament('finial', F(pt(0, gy)), ex3, UP, r0 * 1.2)
    }
    if (P.pinnacles > 0) corners.forEach((c) => ornament('pinnacle', M(c.x, hs + archH * 0.85, c.y), v3(1, 0, 0), UP, r0 * 0.9, { height: (H - hs) * 0.9 * P.pinnacles + r0 * 2 }))
    // Inner vault: diagonal ribs reaching the face-arch crown height.
    for (const [A, B] of [
      [corners[0], corners[2]],
      [corners[1], corners[3]],
    ]) {
      const D = Math.hypot(B.x - A.x, B.y - A.y)
      const arch = archH >= D / 2 ? fromTwoCentred(twoCentredArch(0, D / 2, (archH * archH - (D * D) / 4) / ((D * D) / 2), 0)) : roundArch(D / 2, archH)
      record('canopy', arch.residuals ?? [])
      addMember('springer', 1, sampleCArch(arch, 12).map((q) => M((A.x + B.x) / 2 + ((B.x - A.x) / D) * q.x, hs + q.y, (A.y + B.y) / 2 + ((B.y - A.y) / D) * q.x)), r0 * 0.4, `cd${A.x}`)
    }
    ornament('boss', M(0, hs + archH, 0), v3(1, 0, 0), scale(UP, -1), r0, { lobes: 4 })
    step('canopy', `Canopy (REF-007): four shafts to ${fmt(hs)} m, a gabled arch on each face (gable foil tangent to both gable lines and the arch), corner pinnacles, diagonal vault ribs`, { hs, H })
    out.motifs += 4
    return true
  }

  function cloister() {
    const dv = developed(points)
    const p = Math.max(3.5, dv.L / 48)
    const N = Math.floor(dv.L / p)
    const hb = 3.2
    const rail = []
    for (let i = 0; i < N; i += 1) {
      const A = dv.at(i * p).p
      const B = dv.at((i + 1) * p).p
      const e1 = norm(v3(B.x - A.x, 0, B.z - A.z))
      const a = Math.hypot(B.x - A.x, B.z - A.z) / 2
      const mid = v3((A.x + B.x) / 2, Math.max(A.y, B.y), (A.z + B.z) / 2)
      const W = (q) => add(add(mid, scale(e1, q.x)), scale(UP, hb + q.y))
      addMember('shaft', 1, [v3(A.x, A.y, A.z), v3(A.x, A.y + hb, A.z)], r0 * 0.7, `cp${i}`)
      ornament('capital', v3(A.x, A.y + hb, A.z), e1, UP, r0)
      const tc = twoCentredArch(0, a, 1, 0)
      addMember('subarch', 1, sampleTC(tc, 12).map(W), bar, `cb${i}`)
      traceriedOpening(tc, W, `cb${i}`)
      rail.push(add(v3(A.x, A.y, A.z), scale(UP, hb + tc.h + 0.6)))
    }
    if (rail.length > 1) addMember('rail', 1, [...rail, rail[0]], bar, 'cloisterRail')
    step('cloister', `Cloister walk: ${N} bays of ${fmt(p)} m around a ${fmt(dv.L)} m loop; each bay an equilateral arch on colonnettes with two lancets and a tangent foiled oculus`, { N, p })
    out.motifs += N
    return true
  }

  function apse() {
    const { M, local } = planFrame(points, sig)
    const fit = fitCircle2(local)
    if (!fit) return false
    const O = fit.center
    const Ra = fit.radius
    const ang = local.map((q) => Math.atan2(q.y - O.y, q.x - O.x))
    let t0 = ang[0]
    let acc = 0
    for (let i = 1; i < ang.length; i += 1) {
      let d = ang[i] - ang[i - 1]
      while (d > Math.PI) d -= TAU
      while (d < -Math.PI) d += TAU
      acc += d
    }
    const n = clamp(Math.round((Math.abs(acc) * Ra) / 5), 3, 9)
    const hs = clamp(Ra * 1.0, 5, 16)
    const hk = hs + Ra * 0.7
    const rr = r0 * 0.55
    const pierAt = (i) => {
      const th = t0 + (acc * i) / n
      return { th, p: pt(O.x + Ra * Math.cos(th), O.y + Ra * Math.sin(th)) }
    }
    ornament('boss', M(O.x, hk, O.y), v3(1, 0, 0), scale(UP, -1), r0 * 1.4, { lobes: Math.max(4, lobes) })
    // Radial rib: circle centred on the springing line (vertical tangent at the pier) through the keystone:
    // cx = (Ra² − (hk − hs)²) / 2Ra measured from O along the pier direction.
    const cx = (Ra * Ra - (hk - hs) ** 2) / (2 * Ra)
    for (let i = 0; i <= n; i += 1) {
      const { th, p } = pierAt(i)
      addMember('pier', 1, [M(p.x, 0, p.y), M(p.x, hs, p.y)], r0 * 1.3, `ap${i}`)
      ornament('capital', M(p.x, hs, p.y), v3(1, 0, 0), UP, r0 * 1.6)
      const e = pt(Math.cos(th), Math.sin(th))
      const arc = sampleArcBetween(pt(cx, 0), Ra - cx, pt(Ra, 0), pt(0, hk - hs), 16)
      record('apse', [Math.abs(Math.hypot(cx, hk - hs) - (Ra - cx))])
      addMember('springer', 1, arc.map((q) => M(O.x + e.x * q.x, hs + q.y, O.y + e.y * q.x)), rr, `ar${i}`)
    }
    for (let i = 0; i < n; i += 1) {
      const A = pierAt(i).p
      const B = pierAt(i + 1).p
      const ch = Math.hypot(B.x - A.x, B.y - A.y)
      const cd = pt((B.x - A.x) / ch, (B.y - A.y) / ch)
      const mid = pt((A.x + B.x) / 2, (A.y + B.y) / 2)
      const tc = twoCentredArch(0, ch / 2, 1.2, 0)
      const W = (q) => M(mid.x + cd.x * q.x, hs * 0.45 + q.y, mid.y + cd.y * q.x)
      addMember('archivolt', 1, sampleTC(tc, 12).map(W), rr, `ab${i}`)
      traceriedOpening(tc, W, `ab${i}`)
      // Radiating chapel: half-circle plan outward from the chord, three piers, ribs to a boss.
      let outw = pt(mid.x - O.x, mid.y - O.y)
      const ol = Math.hypot(outw.x, outw.y) || 1
      outw = pt(outw.x / ol, outw.y / ol)
      if (acc < 0) outw = pt(outw.x, outw.y)
      const rc = (ch / 2) * 0.9
      const hc = hs * 0.55
      const chapel = []
      for (let j = 0; j <= 24; j += 1) {
        const t = (Math.PI * j) / 24
        chapel.push(pt(mid.x + cd.x * rc * Math.cos(t) + outw.x * rc * Math.sin(t), mid.y + cd.y * rc * Math.cos(t) + outw.y * rc * Math.sin(t)))
      }
      addMember('archivolt', 1, chapel.map((q) => M(q.x, 0.25, q.y)), r0 * 0.8, `chapel${i}`)
      const hb = hc + rc * 0.6
      const cxc = (rc * rc - (hb - hc) ** 2) / (2 * rc)
      for (const t of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
        const e = pt(cd.x * Math.cos(t) + outw.x * Math.sin(t), cd.y * Math.cos(t) + outw.y * Math.sin(t))
        const foot = pt(mid.x + e.x * rc, mid.y + e.y * rc)
        addMember('pier', 1, [M(foot.x, 0, foot.y), M(foot.x, hc, foot.y)], r0 * 0.8, `cpier${i}${t}`)
        const arc = sampleArcBetween(pt(cxc, 0), rc - cxc, pt(rc, 0), pt(0, hb - hc), 10)
        addMember('springer', 2, arc.map((q) => M(mid.x + e.x * q.x, hc + q.y, mid.y + e.y * q.x)), rr * 0.7, `crib${i}${t}`)
      }
      ornament('boss', M(mid.x, hb, mid.y), v3(1, 0, 0), scale(UP, -1), r0 * 0.8, { lobes: 4 })
    }
    step('apse', `Apse: circle fit R = ${fmt(Ra)} m over ${fmt((Math.abs(acc) * 180) / Math.PI)}°, ${n} bays; radial ribs centred on the springing line through the keystone (cx = (R² − Δh²)/2R = ${fmt(cx)} m); ${n} radiating chapels`, { n, Ra })
    out.motifs += n
    return true
  }

  // ------------------------------------------------ flat curves
  function arcade(interlaced) {
    const dv = developed(points)
    const Hw = clamp(P.bandHeight * 1.5, 2.8, 7)
    const p = clamp(Hw * 0.55, 1.4, 4.5)
    const N = Math.floor(dv.L / p)
    if (N < 2) return false
    const s0 = (dv.L - N * p) / 2
    const ys = Hw * (interlaced ? 0.45 : 0.55)
    for (let i = 0; i <= N; i += 1) addMember('mullion', 1, [dv.D(pt(s0 + i * p, 0)), dv.D(pt(s0 + i * p, ys))], bar * 0.9, `ap${i}`)
    let n = 0
    if (interlaced) {
      // Round arches spanning two bays: semicircle radius p centred on the middle post.
      for (let i = 0; i + 2 <= N; i += 1) {
        const c = s0 + (i + 1) * p
        addMember('subarch', 1, sampleArcBetween(pt(c, ys), p, pt(c - p, ys), pt(c + p, ys), 18, false).map(dv.D), bar * 0.8, `ia${i}`)
        n += 1
      }
    } else {
      for (let i = 0; i < N; i += 1) {
        const tc = twoCentredArch(s0 + (i + 0.5) * p, p / 2, 1, ys)
        addMember('subarch', 1, sampleTC(tc, 12).map(dv.D), bar * 0.8, `ba${i}`)
        const hc = inscribedInHead(tc, ys + tc.h * 0.3)
        if (hc && hc.radius > bar * 1.4) {
          record('headFoil', hc.residuals)
          foil(hc.center, hc.radius, 3, dv.D, 1, `ba${i}`, bar * 0.6)
        }
        n += 1
      }
    }
    const rail = []
    for (let s = 0; s <= dv.L + 1e-6; s += 0.5) rail.push(dv.D(pt(s, Hw)))
    addMember('rail', 1, rail, bar, 'arcadeRail')
    step(interlaced ? 'arcade' : 'arcade', interlaced ? `Interlaced arcade: ${N + 1} colonnettes at ${fmt(p)} m, ${n} round arches each spanning two bays (radius p, centred on the middle colonnette) — overlaps form pointed arches` : `Blind arcade: ${N} cusped equilateral arches on colonnettes at ${fmt(p)} m, rail at ${fmt(Hw)} m`, { N, p })
    out.motifs += n
    return true
  }

  function reticulated() {
    const dv = developed(points)
    const H = P.bandHeight * 1.2
    const p = H * 0.9
    const N = Math.floor(dv.L / p)
    if (N < 1) return false
    const s0 = (dv.L - N * p) / 2
    const rail = []
    for (let s = s0; s <= s0 + N * p + 1e-6; s += 0.5) rail.push(dv.D(pt(s, H)))
    addMember('rail', 1, rail, bar, 'retRail')
    let res = []
    for (let k = 0; k < N; k += 1) {
      const a = s0 + k * p
      const up = reverseCurve(pt(a, 0), pt(a + p, H))
      const dn = reverseCurve(pt(a + p, 0), pt(a, H))
      res = res.concat(up.residuals, dn.residuals)
      addMember('subarch', 1, up.points.map(dv.D), bar * 0.8, `ret${k}u`)
      addMember('subarch', 1, dn.points.map(dv.D), bar * 0.8, `ret${k}d`)
      if (k > 0) foil(pt(a, H / 2), Math.min(p, H) * 0.24, 4, dv.D, 1, `retf${k}`, bar * 0.6, Math.PI / 4)
    }
    record('reticulated', res)
    step('reticulated', `Reticulated net: ${N} cells of ${fmt(p)} m; each bar is a reverse curve (two equal arcs tangent at the midpoint, R = (Δx² + Δy²)/2Δx), crossing bars form ogee cells with quatrefoils`, { N, p })
    out.motifs += N
    return true
  }

  function parapet() {
    const dv = developed(points)
    const H = clamp(P.bandHeight * 0.5, 0.9, 1.6)
    const N = Math.floor(dv.L / H)
    if (N < 1) return false
    const s0 = (dv.L - N * H) / 2
    const rail = []
    for (let s = s0; s <= s0 + N * H + 1e-6; s += 0.4) rail.push(dv.D(pt(s, H)))
    addMember('rail', 1, rail, bar, 'parapetRail')
    for (let i = 0; i <= N; i += 1) {
      addMember('mullion', 1, [dv.D(pt(s0 + i * H, 0)), dv.D(pt(s0 + i * H, H))], bar * 0.8, `pp${i}`)
      ornament('finial', dv.D(pt(s0 + i * H, H)), v3(1, 0, 0), UP, bar * 1.5)
    }
    for (let i = 0; i < N; i += 1) foil(pt(s0 + (i + 0.5) * H, H / 2), H * 0.44, 4, dv.D, 1, `pq${i}`, bar * 0.7, Math.PI / 4)
    if (P.pinnacles > 0) for (const s of [s0, s0 + N * H]) ornament('pinnacle', dv.D(pt(s, H)), v3(1, 0, 0), UP, bar * 2, { height: H * 2 * P.pinnacles })
    step('parapet', `Parapet gallery (REF-012): ${N} square panels of ${fmt(H)} m, each with a quatrefoil, posts with cresting finials`, { N, H })
    out.motifs += N
    return true
  }

  function panelScreen() {
    const lo = points[0].y < points[points.length - 1].y ? points[0] : points[points.length - 1]
    const Hh = sig.rise
    const Wd = clamp(Hh * 0.4, 2, 8)
    let u = v3(sig.plane.minor.x, 0, sig.plane.minor.z)
    u = Math.hypot(u.x, u.z) > 0.2 ? norm(u) : v3(1, 0, 0)
    const Mp = (q) => add(add(lo, scale(u, q.x)), scale(UP, q.y))
    const half = Wd / 2
    addMember('rail', 1, [Mp(pt(-half, 0)), Mp(pt(-half, Hh)), Mp(pt(half, Hh)), Mp(pt(half, 0))], bar, 'frame')
    const ncol = Math.max(2, Math.round(Wd / 0.9))
    const cw = Wd / ncol
    for (let j = 1; j < ncol; j += 1) addMember('mullion', 1, [Mp(pt(-half + j * cw, 0)), Mp(pt(-half + j * cw, Hh))], bar * 0.8, `pm${j}`)
    const nt = Math.max(1, Math.floor(Hh / 2.4))
    for (let t = 1; t <= nt; t += 1) {
      const yt = (Hh * t) / (nt + 1) + (t === nt ? 0 : 0)
      addMember('rail', 1, [Mp(pt(-half, yt)), Mp(pt(half, yt))], bar * 0.8, `pt${t}`)
      for (let j = 0; j < ncol; j += 1) {
        const tc = twoCentredArch(-half + (j + 0.5) * cw, cw / 2, 1, yt - (SQ3 * cw) / 2)
        addMember('subarch', 2, sampleTC(tc, 8).map(Mp), bar * 0.55, `ph${t}${j}`)
        const hc = inscribedInHead(tc, tc.y0 + tc.h * 0.3)
        if (hc && hc.radius > bar * 1.3) {
          record('headFoil', hc.residuals)
          foil(hc.center, hc.radius, 3, Mp, 2, `ph${t}${j}`, bar * 0.5)
        }
      }
    }
    step('panel', `Perpendicular panel screen: ${fmt(Wd)} × ${fmt(Hh)} m, ${ncol} lights, ${nt} transoms, a cusped head under every transom (apex on the transom)`, { ncol, nt })
    out.motifs += ncol * nt
    return true
  }

  // ------------------------------------------------ vertical
  function spire() {
    const B = points[0].y < points[points.length - 1].y ? points[0] : points[points.length - 1]
    const T = B === points[0] ? points[points.length - 1] : points[0]
    const Hs = T.y - B.y
    const rb = clamp(0.1 * Hs, 1.2, 6)
    const corner = (k, t = 0) => {
      const th = Math.PI / 8 + (TAU * k) / 8
      const c = v3(B.x + rb * Math.cos(th), B.y, B.z + rb * Math.sin(th))
      return add(c, scale(sub(T, c), t))
    }
    for (let k = 0; k < 8; k += 1) {
      addMember('gable', 1, [corner(k), T], r0 * 0.5, `sr${k}`)
      const ribLen = dist(corner(k), T)
      const nC = Math.floor((ribLen * P.crockets) / 2.4)
      const outw = norm(v3(corner(k).x - B.x, 0, corner(k).z - B.z))
      for (let j = 1; j <= nC; j += 1) ornament('crocket', corner(k, j / (nC + 1)), outw, norm(sub(T, corner(k))), r0 * 0.7)
    }
    const m = Math.max(2, Math.floor(Hs / 3.2))
    for (let i = 1; i < m; i += 1) {
      const t = i / m
      addMember('rail', 1, Array.from({ length: 9 }, (_, k) => corner(k % 8, t)), bar * (1 - t * 0.5), `ring${i}`)
    }
    let panels = 0
    if (Hs >= 22) {
      // Openwork: a foiled roundel in each face between rings (REF-012), in the face plane.
      for (let i = 0; i < m - 1; i += 1) {
        const ta = i / m
        const tb = (i + 1) / m
        if (tb > 0.78) break
        for (let k = 0; k < 8; k += 1) {
          const a0 = corner(k, ta)
          const a1 = corner(k + 1, ta)
          const b0 = corner(k, tb)
          const b1 = corner(k + 1, tb)
          const cen = scale(add(add(a0, a1), add(b0, b1)), 0.25)
          const eh = norm(sub(a1, a0))
          const es = norm(sub(scale(add(b0, b1), 0.5), scale(add(a0, a1), 0.5)))
          const wMid = (dist(a0, a1) + dist(b0, b1)) / 2
          const r = 0.36 * Math.min(wMid, dist(scale(add(a0, a1), 0.5), scale(add(b0, b1), 0.5)))
          if (r < bar * 2.5) continue
          const F = (q) => add(add(cen, scale(eh, q.x)), scale(es, q.y))
          ringFoil('spire', pt(0, 0), r, 4, F, 2, `sp${i}${k}`, bar * 0.6, Math.PI / 4)
          panels += 1
        }
      }
    }
    // Lucarnes: small gabled openings on alternate faces at the foot.
    for (const k of [0, 2, 4, 6]) {
      const a0 = corner(k)
      const a1 = corner(k + 1)
      const eh = norm(sub(a1, a0))
      const es = norm(sub(T, scale(add(a0, a1), 0.5)))
      const base = add(scale(add(a0, a1), 0.5), scale(es, Hs * 0.06))
      const a = dist(a0, a1) * 0.28
      const F = (q) => add(add(base, scale(eh, q.x)), scale(es, q.y))
      const tc = twoCentredArch(0, a, 1, 0)
      addMember('subarch', 1, sampleTC(tc, 10).map(F), bar * 0.7, `luc${k}`)
      const gy = tc.h * 1.9
      addMember('gable', 1, [F(pt(-a * 1.2, 0)), F(pt(0, gy)), F(pt(a * 1.2, 0))], bar * 0.7, `lucg${k}`)
      ornament('finial', F(pt(0, gy)), eh, es, r0 * 0.8)
      if (P.pinnacles > 0) ornament('pinnacle', a0, v3(1, 0, 0), UP, r0 * 0.9, { height: Hs * 0.12 * P.pinnacles + r0 })
    }
    ornament('finial', T, v3(1, 0, 0), UP, r0 * 2)
    step('spire', `Octagonal spire: ${fmt(Hs)} m on a base radius ${fmt(rb)} m (0.1·H), 8 crocketed ribs, ${m - 1} rings${panels ? `, openwork: ${panels} foiled roundels in the faces (H ≥ 22 m)` : ''}, 4 lucarnes and corner pinnacles`, { Hs, rb, panels })
    out.motifs += 8 + panels
    return true
  }

  function spiralStair() {
    const n = points.length
    const cx = points.reduce((s, p) => s + p.x, 0) / n
    const cz = points.reduce((s, p) => s + p.z, 0) / n
    const y0 = Math.min(...points.map((p) => p.y))
    const y1 = Math.max(...points.map((p) => p.y))
    addMember('shaft', 1, [v3(cx, y0, cz), v3(cx, y1, cz)], Math.max(0.25, r0 * 0.8), 'newel')
    const count = clamp(Math.round((y1 - y0) / 0.25), 6, 140)
    const byY = points.slice().sort((a, b) => a.y - b.y)
    let ti = 0
    for (let i = 0; i < count; i += 1) {
      const y = y0 + ((y1 - y0) * (i + 0.5)) / count
      while (ti < byY.length - 1 && byY[ti + 1].y < y) ti += 1
      const p = byY[ti]
      addMember('rail', 1, [v3(cx, p.y, cz), p], Math.max(0.08, r0 * 0.35), `tread${i}`)
      if (i % 3 === 0) addMember('mullion', 2, [p, add(p, scale(UP, 1))], Math.max(0.05, r0 * 0.22), `bal${i}`)
    }
    addMember('rail', 1, points.map((p) => add(p, scale(UP, 1))), Math.max(0.06, r0 * 0.3), 'handrail')
    step('stair', `Spiral stair: ${fmt(Math.abs(sig.wind) / TAU)} turns, rise ${fmt(y1 - y0)} m → newel on the winding axis, ${count} treads (≈ 0.25 m risers), balusters every third tread, handrail 1 m above the curve`, { count })
    out.motifs += count
    return true
  }
}

/** Second, lower flyer for tall buttresses (strut top above 14 m). */
export function lowerFlyer(ctx) {
  const { points, r0, addMember, step, band, P } = ctx
  const base = points[0]
  const pts = points.filter((p) => p.y > 0.5).map((p) => v3(p.x, base.y + (p.y - base.y) * 0.6, p.z))
  if (pts.length < 4) return
  addMember('archivolt', 1, pts, r0 * 0.7, 'flyer2')
  band(pts, P.bandHeight * 0.45, 'flyer2/', Math.max(0.06, r0 * 0.25))
  step('flyer', 'Second flyer: the strut repeated at 0.6 × its height (two-tier flying buttress)')
}
