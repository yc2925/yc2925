/**
 * Step 47 — curve world validation (feedback round 1).
 * Run: node scripts/validate-world.mjs
 */
import { applyCommand, createEmptyProject, deserializeProject, resolveCurvePoints, resolveStructureParams, serializeProject } from '../src/world/model/project.js'
import { createHistory, dispatch, redo, seal, undo } from '../src/world/model/history.js'
import { dot, evaluateCurve, len, resampleByCount, rotationMinimisingFrames } from '../src/world/curves/curve3.js'
import { fitStroke } from '../src/world/curves/strokeFit.js'
import { liftToPointedArch } from '../src/world/curves/archLift.js'
import { buildCurveSkeleton, validateSkeleton } from '../src/world/skeleton/members.js'
import { SKELETON_PARAM_SPECS, DEFAULT_SKELETON_PARAMS } from '../src/world/skeleton/params.js'
import { buildStones } from '../src/world/lithic/stones.js'
import { PALETTE, PALETTE_HEX } from '../src/world/lithic/palette.js'
import { PROTOTYPE_COUNT, protoIndex } from '../src/world/lithic/protos.js'
import { createStonePrototypes } from '../src/world/compose/carving.js'
import { LITHIC_PARAM_SPECS, DEFAULT_LITHIC_PARAMS } from '../src/world/lithic/params.js'
import { createTerrainHeight, terrainFromNoiseLayer } from '../src/world/compose/terrain.js'
import { sampleNoise } from '../src/noise/sample.js'
import { createSimplex2D } from '../src/noise/simplex2d.js'
import { DEFAULT_TERRAIN_PARAMS, TERRAIN_PARAM_SPECS, PRESENTATION_SPECS } from '../src/world/compose/worldParams.js'
import { computePieceOffsets } from '../src/world/compose/geometry.js'
import { buildPointedArch } from '../src/geometry/gothicGrammar/primitives/index.js'
import { Quaternion, Vector3 } from 'three'

let failures = 0
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) failures += 1
}

const ARCH = [0, 0.2, 0.4, 0.6, 0.8, 1].map((u) => ({ x: -15 + 30 * u, y: 0, z: 0 }))

// ---------------------------------------------------------------- model + links
{
  let h = createHistory(createEmptyProject())
  h = dispatch(h, { type: 'addCurve', curveId: 'A', structureId: 'sA', points: [{ x: -20, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, { x: 20, y: 0, z: 0 }] })
  h = dispatch(h, { type: 'addCurve', curveId: 'B', structureId: 'sB', points: [{ x: 20, y: 0, z: 20 }, { x: 30, y: 0, z: 30 }] })
  const pa = h.present.curves.A.controlPoints
  const pb = h.present.curves.B.controlPoints
  h = dispatch(h, {
    type: 'addCurve',
    curveId: 'C',
    structureId: 'sC',
    points: [pa[2], pb[0]],
    links: { start: { curveId: 'A', pointId: pa[2].id }, end: { curveId: 'B', pointId: pb[0].id } },
  })
  h = dispatch(h, { type: 'movePoint', curveId: 'A', index: 2, point: { x: 25, y: 4, z: -5 } })
  let c = resolveCurvePoints(h.present, h.present.curves.C)
  check(c[0].x === 25 && c[0].y === 4 && c[0].z === -5, 'moving a target point moves the linked curve end')
  h = dispatch(h, { type: 'movePoint', curveId: 'C', index: 1, point: { x: 22, y: 0, z: 18 } })
  check(h.present.curves.B.controlPoints[0].x === 22, 'dragging a linked end moves its target (both curves follow)')
  h = dispatch(h, { type: 'insertPoint', curveId: 'A', index: 1, point: { x: -10, y: 6, z: 0 } })
  c = resolveCurvePoints(h.present, h.present.curves.C)
  check(h.present.curves.A.controlPoints.length === 4 && c[0].x === 25, 'inserting a point keeps links (stable point ids)')
  for (let i = 0; i < 4; i += 1) h = dispatch(h, { type: 'movePoint', curveId: 'A', index: 1, point: { x: -10, y: 6 + i, z: 0 } }, { coalesce: 'drag' })
  h = seal(h)
  const before = h.present.curves.A.controlPoints[1].y
  h = undo(h)
  check(h.present.curves.A.controlPoints[1].y === 6 && before === 9, 'drag coalesces into one undo step')
  h = redo(h)
  h = dispatch(h, { type: 'deleteCurve', curveId: 'B' })
  c = resolveCurvePoints(h.present, h.present.curves.C)
  check(!h.present.curves.C.links.end && c[1].x === 22, 'deleting a target curve bakes the connector end in place')
  h = undo(h)
  check(Boolean(h.present.curves.B && h.present.curves.C.links.end), 'undo restores deleted curve and link')
  const round = deserializeProject(serializeProject(h.present))
  check(JSON.stringify(round.curves) === JSON.stringify(h.present.curves), 'serialize → deserialize round-trip is lossless')
  const v1 = deserializeProject({ curves: { x: { curveId: 'x', controlPoints: [{ x: 1, y: 0, z: 2 }], architecturalParameters: { height: 9, thickness: 1 } } }, world: { skeleton: { height: 18 } } })
  check(v1.curves.x.controlPoints[0].id && v1.curves.x.curveRole === 'rib', 'v1 document migrates (point ids, role)')
  check(!('height' in v1.curves.x.architecturalParameters) && v1.curves.x.architecturalParameters.thickness === 1, 'removed parameters are dropped on load, valid ones kept')
  const neg = applyCommand(h.present, { type: 'movePoint', curveId: 'A', index: 0, point: { x: 0, y: -5, z: 0 } })
  check(neg.curves.A.controlPoints[0].y === 0, 'points cannot go below ground')
}

// ---------------------------------------------------------------- curves
{
  const wobbly = []
  for (let i = 0; i <= 200; i += 1) wobbly.push({ x: i * 0.3, y: 0, z: Math.sin(i * 0.05) * 8 + (i % 2 ? 0.06 : -0.06) })
  const fitted = fitStroke(wobbly, 0.25)
  check(fitted.length >= 3 && fitted.length <= 24, `freehand stroke → ${fitted.length} control points (≤ 24)`)
  const dense = evaluateCurve({ curveType: 'catmullRom', controlPoints: fitted }).points
  let worst = 0
  for (const p of wobbly) worst = Math.max(worst, Math.min(...dense.map((q) => Math.hypot(q.x - p.x, q.z - p.z))))
  check(worst < 1.0, `fitted spline follows the stroke (max deviation ${worst.toFixed(2)} m)`)
  const lifted = liftToPointedArch(ARCH, 1.1)
  const arch13b = buildPointedArch({ family: 'lancet', span: 30, riseRatio: 1.1, springingY: 0 })
  const apex13b = Math.max(...arch13b.samples.left.map((p) => p.y))
  const apex = Math.max(...lifted.map((p) => p.y))
  check(lifted[0].y === 0 && lifted[5].y === 0 && apex <= apex13b + 1e-6 && apex > apex13b * 0.9, `lift-to-arch follows the 13B two-centred arch (apex ${apex.toFixed(2)} ≤ ${apex13b.toFixed(2)})`)
  const space = { curveType: 'catmullRom', controlPoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 6, z: 3 }, { x: 4, y: 12, z: 14 }, { x: -6, y: 20, z: 2 }] }
  const sf = rotationMinimisingFrames(resampleByCount(evaluateCurve(space).points, 150))
  let sw = 1
  for (let i = 1; i < sf.length; i += 1) sw = Math.min(sw, dot(sf[i].side, sf[i - 1].side))
  check(sw > 0.95, `RMF stable on a 3D curve (min ${sw.toFixed(4)})`)
}

// ---------------------------------------------------------------- skeleton (Gothic shape grammar)
const archPts = liftToPointedArch(ARCH, 1.1)
const curve = { curveId: 'c', curveType: 'catmullRom', curveRole: 'rib' }
const skel = buildCurveSkeleton(curve, archPts, {}, 42, {})
const GRAMMAR_KINDS = new Set(['main', 'archivolt', 'subarch', 'mullion', 'oculus', 'foil', 'gable', 'rail', 'shaft', 'springer', 'pier'])
const groundCurve = [{ x: -30, y: 0, z: 10 }, { x: 0, y: 0, z: -10 }, { x: 30, y: 0, z: 10 }]
const columnPts = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 14, z: 0 }]
const buttressPts = [{ x: -16, y: 0, z: 0 }, { x: -12, y: 8, z: 0 }, { x: -5, y: 12.5, z: 0 }, { x: 0, y: 14, z: 0 }]
const build = (role, pts, prm = {}, seed = 7, links = {}) => buildCurveSkeleton({ curveId: 'v', curveType: 'catmullRom', curveRole: role }, pts, prm, seed, links)
{
  const v = validateSkeleton(skel)
  check(v.valid, `skeleton valid — finite, above ground, every tangency solved (${v.errors.slice(0, 2).join('; ') || 'ok'})`)
  const main = skel.members.filter((m) => m.kind === 'main').flatMap((m) => m.points)
  const dense = evaluateCurve({ ...curve, controlPoints: archPts }).points
  let dev = 0
  const segDist = (p, a, b) => {
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
    const t = Math.max(0, Math.min(1, dot({ x: p.x - a.x, y: p.y - a.y, z: p.z - a.z }, ab) / (dot(ab, ab) || 1)))
    return len({ x: a.x + ab.x * t - p.x, y: a.y + ab.y * t - p.y, z: a.z + ab.z * t - p.z })
  }
  for (const p of main) {
    let best = Infinity
    for (let i = 1; i < dense.length; i += 1) best = Math.min(best, segDist(p, dense[i - 1], dense[i]))
    dev = Math.max(dev, best)
  }
  check(dev < 0.01, `main member follows the exact drawn path (max ${dev.toFixed(3)} m)`)
  check(skel.members.every((m) => GRAMMAR_KINDS.has(m.kind)), 'no branching growth: every member is a named grammar element')
  check(JSON.stringify(buildCurveSkeleton(curve, archPts, {}, 42, {})) === JSON.stringify(skel), 'skeleton deterministic for a seed')

  // Each tracery system produces its own construction, with exact tangencies.
  const geo = build('rib', archPts, { style: 1, refine: 1 })
  const ySk = build('rib', archPts, { style: 2, subdivision: 3 })
  const xSk = build('rib', archPts, { style: 3, subdivision: 4 })
  check(geo.stats.style === 'geometric' && geo.members.some((m) => m.kind === 'oculus') && geo.members.some((m) => m.kind === 'foil'), `geometric tracery: lancets + tangent oculus + foil (${geo.stats.motifs} motifs)`)
  check(geo.construction.some((c) => c.type === 'oculus') && Math.max(...geo.construction.map((c) => c.residual)) < 1e-9, `oculus / foil tangencies exact (max residual ${Math.max(...geo.construction.map((c) => c.residual)).toExponential(1)})`)
  check(ySk.stats.style === 'y' && ySk.construction.filter((c) => c.type === 'yBranch').length === 4 && ySk.construction.every((c) => c.residual < 1e-9), 'Y-tracery: 2 mullions × 2 branches end exactly on the main arch')
  check(xSk.stats.style === 'intersecting' && xSk.members.filter((m) => m.kind === 'subarch').length >= 6, `intersecting tracery: repeated main-arch circles (${xSk.members.filter((m) => m.kind === 'subarch').length} arcs)`)
  // Mirror symmetry about the arch axis (relationships, not just the look — §6).
  const F = geo.archFrame
  const pts = geo.members.filter((m) => m.kind !== 'main').flatMap((m) => m.points)
  let worst = 0
  for (const p of pts) {
    const x = (p.x - F.A.x) * F.e1.x + (p.y - F.A.y) * F.e1.y + (p.z - F.A.z) * F.e1.z - F.a
    const q = { x: p.x - 2 * x * F.e1.x, y: p.y - 2 * x * F.e1.y, z: p.z - 2 * x * F.e1.z }
    let best = Infinity
    for (const o of pts) best = Math.min(best, Math.hypot(o.x - q.x, o.y - q.y, o.z - q.z))
    worst = Math.max(worst, best)
  }
  check(worst < 1e-4, `geometric tracery is mirror-symmetric about the arch axis (max ${worst.toExponential(1)} m)`)
  const styles = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => build('rib', archPts, {}, s).stats.style))
  check(styles.size > 1, `seed picks between grammar alternatives in Auto (${[...styles].join(', ')})`)

  const band = build('tracery', groundCurve)
  check(band.stats.style === 'band' && band.members.some((m) => m.kind === 'rail') && band.construction.some((c) => c.type === 'spandrel') && band.construction.every((c) => c.residual < 1e-9), `tracery band: rail + tangent circles + foils + spandrel circles r = d²/4ρ (${band.stats.motifs} foils)`)
  const col = build('column', columnPts, { shafts: 6, springers: 4 })
  const shafts = col.members.filter((m) => m.kind === 'shaft')
  const ringOk = shafts.every((m) => m.points.every((p) => Math.abs(Math.hypot(p.x, p.z) - Math.hypot(shafts[0].points[0].x, shafts[0].points[0].z)) < 1e-6))
  check(shafts.length === 6 && ringOk && col.members.filter((m) => m.kind === 'springer').length === 4, 'compound pier: 6 shafts on one ring (rotational symmetry) + 4 springer arcs')
  check(['capital', 'base'].every((t) => col.ornaments.some((o) => o.type === t)), 'column gets a carved capital and moulded base')
  const but = build('buttress', buttressPts, { pierHeight: 0.8, setbacks: 2, grotesques: 1 })
  check(but.members.filter((m) => m.kind === 'pier').length === 3 && ['pinnacle', 'grotesque'].every((t) => but.ornaments.some((o) => o.type === t)), 'buttress: stepped pier (3 stages) + pinnacle + gargoyle')
  const linked = build('rib', archPts, {}, 42, { start: { curveId: 'x', pointId: 'y' } })
  check(linked.ornaments.filter((o) => o.type === 'boss').length === 1 && linked.ornaments.some((o) => o.type === 'keystone'), 'linked end gets a boss; arch apex gets a keystone')

  // Every skeleton parameter changes the output for at least one of its roles.
  const raised = liftToPointedArch(ARCH.map((p) => ({ ...p, y: 6 })), 0.9)
  const testPts = { rib: raised, tracery: groundCurve, column: columnPts, buttress: buttressPts }
  for (const spec of SKELETON_PARAM_SPECS) {
    const d = DEFAULT_SKELETON_PARAMS[spec.key]
    const changed = spec.roles.some((role) => {
      const links = { start: { curveId: 'q', pointId: 'r' } }
      const fixed = { grotesques: 1, gable: 0.5, style: 1 }
      const base = JSON.stringify(build(role, testPts[role], fixed, 7, links))
      return [spec.min, spec.max].filter((v) => v !== d).some((v) => JSON.stringify(build(role, testPts[role], { ...fixed, [spec.key]: v }, 7, links)) !== base)
    })
    check(changed, `skeleton param "${spec.label}" changes the output (${spec.roles.join('/')})`)
  }
  const t0 = performance.now()
  for (let i = 0; i < 20; i += 1) buildCurveSkeleton(curve, archPts, { thickness: 0.6 + i * 0.01, refine: 2 }, 42, {})
  check((performance.now() - t0) / 20 < 16, `skeleton rebuild fast (${((performance.now() - t0) / 20).toFixed(2)} ms)`)
}

// ---------------------------------------------------------------- carved stone
{
  const t0 = performance.now()
  const res = buildStones(skel, {}, 42)
  const ms = performance.now() - t0
  check(res.stones.length > 300, `stones placed (${res.stones.length} in ${ms.toFixed(0)} ms, ${res.stats.carved} carved, ${res.stats.rejected} overlap-rejected)`)
  check(res.stones.every((s) => s.p[1] >= 0), 'no stone centre below ground')
  const halfHeights = res.stones.map((s) => {
    const q = new Quaternion(...s.q)
    const ax = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map((v) => v.applyQuaternion(q))
    return s.p[1] - (Math.abs(ax[0].y) * s.s[0] + Math.abs(ax[1].y) * s.s[1] + Math.abs(ax[2].y) * s.s[2]) / 2
  })
  check(Math.min(...halfHeights) > -0.25, `stones rest on (not through) the ground (lowest corner ${Math.min(...halfHeights).toFixed(2)} m)`)
  const crown = res.stones.filter((s) => s.kind === 'voussoir' && Math.abs(s.p[0]) < 2 && s.p[1] > 15)
  const radial = crown.map((s) => Math.abs(new Vector3(1, 0, 0).applyQuaternion(new Quaternion(...s.q)).y))
  const meanRadial = radial.reduce((a, b) => a + b, 0) / Math.max(1, radial.length)
  check(crown.length > 0 && meanRadial > 0.75, `crown voussoirs stand on end, long axis toward the centre (mean |X·up| = ${meanRadial.toFixed(2)})`)
  check(res.stones.some((s) => s.kind === 'voussoir' && s.proto === protoIndex('ribVoussoir', 0)) || res.stones.some((s) => s.kind === 'voussoir' && s.proto === protoIndex('ribVoussoir', 1)), 'single-stone rib sections use the moulded rib voussoir')
  const ks = res.stones.find((s) => s.kind === 'keystone')
  check(ks && Math.abs(ks.p[0]) < 1e-6, 'carved keystone sits on the arch axis')
  // Tracery bars lie on the construction curves.
  const tracery = skel.members.filter((m) => ['subarch', 'mullion', 'oculus', 'foil', 'gable'].includes(m.kind))
  const barDev = res.stones
    .filter((s) => ['subarch', 'oculus', 'foil'].includes(s.kind))
    .reduce((w, s) => {
      let best = Infinity
      const c = { x: s.p[0], y: s.p[1], z: s.p[2] }
      for (const m of tracery)
        for (let i = 1; i < m.points.length; i += 1) {
          const a = m.points[i - 1]
          const ab = { x: m.points[i].x - a.x, y: m.points[i].y - a.y, z: m.points[i].z - a.z }
          const t = Math.max(0, Math.min(1, dot({ x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }, ab) / (dot(ab, ab) || 1)))
          best = Math.min(best, len({ x: a.x + ab.x * t - c.x, y: a.y + ab.y * t - c.y, z: a.z + ab.z * t - c.z }))
        }
      return Math.max(w, best)
    }, 0)
  check(barDev < 0.1, `carved tracery bars follow the construction curves (max ${barDev.toFixed(2)} m)`)
  // Palette: every stone colour is one of the ten requested colours (±3 % tone).
  const palOk = res.stones.every((s) => {
    const base = PALETTE[s.paletteIndex]
    if (!base) return false
    const k = s.color[0] / base[0]
    return k > 0.965 && k < 1.035 && Math.abs(s.color[1] / base[1] - k) < 1e-9 && Math.abs(s.color[2] / base[2] - k) < 1e-9
  })
  check(palOk, `every stone colour comes from the palette (${new Set(res.stones.map((s) => PALETTE_HEX[s.paletteIndex])).size} of 10 colours used)`)
  const lum = (arr) => arr.reduce((a, s) => a + s.color[0] + s.color[1] + s.color[2], 0) / Math.max(1, arr.length)
  const wet = buildStones(skel, { weathering: 1 }, 42).stones.filter((s) => s.kind === 'voussoir')
  check(lum(wet.filter((s) => s.p[1] < 5)) < lum(wet.filter((s) => s.p[1] > 15)), 'weathering darkens stones toward the ground')
  const sand = buildStones(skel, { stoneMix: 1 }, 42).stones.filter((s) => s.kind === 'voussoir')
  check(sand.every((s) => !['#b7b2ad', '#a8a4a0', '#928e8a', '#7a7772'].includes(PALETTE_HEX[s.paletteIndex])), 'stone mix 1 builds in sandstone (no limestone-only tones)')
  // Within one member (the main rib), stones are graded larger low than high.
  const ribV = res.stones.filter((s) => s.kind === 'voussoir' && s.piece.startsWith('main'))
  const lowY = ribV.filter((s) => s.p[1] < 10)
  const highY = ribV.filter((s) => s.p[1] > 15)
  const vol = (arr) => arr.reduce((a, s) => a + s.s[0] * s.s[1] * s.s[2], 0) / Math.max(1, arr.length)
  check(vol(lowY) > vol(highY), `rib stones larger low than high (${vol(lowY).toFixed(3)} > ${vol(highY).toFixed(3)} m³)`)
  check(JSON.stringify(buildStones(skel, {}, 42).stones) === JSON.stringify(res.stones), 'stone layout deterministic for a seed')
  // Carved pieces for every ornament type the grammar emits.
  const colStones = buildStones(build('column', columnPts, { shafts: 4 }), {}, 3).stones
  check(colStones.some((s) => s.kind === 'capital') && colStones.some((s) => s.kind === 'base') && colStones.filter((s) => s.kind === 'drum').length > 10, 'columns: drums + carved capital + moulded base')
  const butStones = buildStones(build('buttress', buttressPts, { grotesques: 1 }), {}, 3).stones
  check(['pinnacle', 'grotesque'].every((k) => butStones.some((s) => s.kind === k)), 'buttress: carved pinnacle + grotesque')
  const gab = buildStones(build('rib', archPts, { gable: 0.8, crockets: 1 }, 7, { start: { curveId: 'a', pointId: 'b' } }), {}, 3).stones
  check(['crocket', 'finial', 'boss'].every((k) => gab.some((s) => s.kind === k)), 'gable: crockets + finial; joint: boss')
  // Every stone parameter must change the output (render-side ones change the prototypes).
  const baseS = JSON.stringify(res.stones)
  for (const spec of LITHIC_PARAM_SPECS) {
    if (spec.key === 'irregularity' || spec.key === 'dressing') {
      const a = createStonePrototypes(spec.key === 'irregularity' ? 0.1 : 0.3, spec.key === 'dressing' ? 0.1 : 0.75)
      const b = createStonePrototypes(spec.key === 'irregularity' ? 0.9 : 0.3, spec.key === 'dressing' ? 0.95 : 0.75)
      const ia = protoIndex('ashlar', 0)
      check(a[ia].attributes.position.count !== b[ia].attributes.position.count || a[ia].attributes.position.array.some((v, i) => Math.abs(v - b[ia].attributes.position.array[i]) > 1e-4), `stone param "${spec.label}" changes the dressed-stone prototypes (render-side)`)
      continue
    }
    const d = DEFAULT_LITHIC_PARAMS[spec.key]
    const changed = [spec.min, spec.max].filter((v) => v !== d).some((v) => JSON.stringify(buildStones(skel, { [spec.key]: v }, 42).stones) !== baseS)
    check(changed, `stone param "${spec.label}" changes the output`)
  }
  // Every stone slider except Gravel also changes the carved tracery bars.
  const TR = new Set(['subarch', 'mullion', 'oculus', 'foil', 'rail', 'gable'])
  const trOf = (prm) => JSON.stringify(buildStones(skel, prm, 42).stones.filter((s) => TR.has(s.kind)))
  const trBase = trOf({})
  for (const spec of LITHIC_PARAM_SPECS) {
    if (spec.key === 'gravel') continue
    const d = DEFAULT_LITHIC_PARAMS[spec.key]
    const changed = [spec.min, spec.max].filter((v) => v !== d).some((v) => trOf({ [spec.key]: v }) !== trBase)
    check(changed, `stone param "${spec.label}" changes the tracery bars`)
  }
  const protos = createStonePrototypes(0.3, 0.75)
  check(protos.length === PROTOTYPE_COUNT && protos.every((g) => g && g.attributes.position.count > 0 && g.attributes.bary), `all ${PROTOTYPE_COUNT} stone prototypes build (ashlar, drums, mouldings, keystone, bosses, pinnacle, capital, base, grotesques, crocket, finial)`)
  const ground = build('rib', groundCurve, { bandHeight: 0.8 })
  const gs = buildStones(ground, {}, 1)
  const foot = gs.stones.filter((s) => s.kind === 'footing')
  const lens = foot.map((s) => s.s[0])
  const mean = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length)
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lens.length))
  check(foot.length > 20 && sd > 0.05, `ground curve → coursed ashlar footing with varied block lengths (${foot.length} blocks, σ ${sd.toFixed(2)} m)`)
}

// ---------------------------------------------------------------- terrain + presentation
{
  const h = createTerrainHeight(DEFAULT_TERRAIN_PARAMS)
  check(h(0, 0) === 0 && h(50, 30) === 0, 'build plateau is flat at the origin')
  check(Math.abs(h(400, 250)) > 0.5, `terrain rises beyond the plateau (${h(400, 250).toFixed(2)} m)`)
  for (const spec of TERRAIN_PARAM_SPECS) {
    const d = DEFAULT_TERRAIN_PARAMS[spec.key]
    const v2 = spec.options ? spec.options.find((o) => o.id !== d).id : Math.min(spec.max, d * 1.3 + spec.step)
    // Shaping amount only acts when a shaping curve is selected (default: smoothstep).
    const p2 = { ...DEFAULT_TERRAIN_PARAMS, [spec.key]: v2 }
    const h2 = createTerrainHeight(p2)
    const samples = [[300, 120], [180, -260], [-420, 90], [140, 60]]
    check(samples.some(([x, z]) => Math.abs(h2(x, z) - h(x, z)) > 1e-3), `terrain param "${spec.label}" changes the terrain`)
  }
  // Terrain uses the same sampler as LAB → Noise 2D / 3D: identical value for an identical layer.
  {
    const layer = { type: 'warp', typeAmount: 0.6, shaping: 'gain', shapeAmount: 0.7, octaves: 4, persistence: 0.55, lacunarity: 2.1, seed: 33, frequency: 1 }
    const tp = { ...DEFAULT_TERRAIN_PARAMS, ...layer, scale: 100, height: 50, plateau: 40 }
    const ht = createTerrainHeight(tp)
    const n = sampleNoise(500 / 100, 300 / 100, layer, createSimplex2D(33))
    check(Math.abs(ht(500, 300) - 50 * (0.55 + 0.45 * n)) < 1e-9, 'terrain = Noise 2D / 3D sampleNoise (same type, shaping, octaves, seed)')
    const imported = terrainFromNoiseLayer({ ...layer, frequency: 2 }, DEFAULT_TERRAIN_PARAMS)
    check(imported.type === 'warp' && imported.seed === 33 && imported.scale === 100, 'importing a Noise lab layer copies its parameters (frequency → scale)')
    const types = new Set(TERRAIN_PARAM_SPECS.find((s) => s.key === 'type').options.map((o) => createTerrainHeight({ ...DEFAULT_TERRAIN_PARAMS, type: o.id })(320, 140).toFixed(4)))
    check(types.size >= 6, `every noise type shapes the terrain differently (${types.size} distinct)`)
  }
  const items = skel.members.flatMap((m) => m.points.map((p) => ({ piece: m.piece, p })))
  const off = computePieceOffsets(items, { x: 0, y: 0, z: 0 }, 10)
  check(off.size > 1 && [...off.values()].every((o) => Math.hypot(o.x, o.y, o.z) > 4), 'explode moves every fragment apart')
  check(PRESENTATION_SPECS.every((s) => s.help) && SKELETON_PARAM_SPECS.every((s) => s.help) && LITHIC_PARAM_SPECS.every((s) => s.help) && TERRAIN_PARAM_SPECS.every((s) => s.help), 'every parameter has a tooltip')
  const p = createEmptyProject()
  check(resolveStructureParams(p, 'none').skeleton.thickness === DEFAULT_SKELETON_PARAMS.thickness, 'world defaults resolve')
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll world checks passed')
process.exit(failures ? 1 : 0)
