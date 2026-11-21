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
import { twoCentredArch, sampleArch } from '../src/world/skeleton/construct2d.js'
import { tudorArch, ogeeArch, rampantArch, roundArch, sampleCArch, offsetCArch, archOrder, cuspedIntrados, fromTwoCentred } from '../src/world/skeleton/arches2d.js'
import { mouchette, reverseCurve, vesica, circleInsideThree } from '../src/world/skeleton/tracery2d.js'
import { TYPOLOGIES } from '../src/world/skeleton/typology.js'
import { Quaternion, Vector3 } from 'three'
import { buildGroundPoints, buildStonePoints, surfacePool, surveyStations, SCAN_RED, MAX_STONE_POINTS, MAX_GROUND_POINTS } from '../src/world/compose/scanCloud.js'
import { DEFAULT_PRESENTATION, SCAN_SPECS } from '../src/world/compose/worldParams.js'
import { prominentSubjects, structureProminence } from '../src/world/compose/prominence.js'
import { worldEnvironment } from '../src/world/compose/groundMaterial.js'
import { ENVIRONMENT_SPECS, TERRAIN_SURFACE_SPECS } from '../src/world/compose/worldParams.js'

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
// Step 47 grammar checks run the classic typology (Step 48 typologies are checked below).
const CLASSIC = { typology: 'classic' }
const skel = buildCurveSkeleton(curve, archPts, CLASSIC, 42, {})
const GRAMMAR_KINDS = new Set(['main', 'archivolt', 'subarch', 'mullion', 'oculus', 'foil', 'gable', 'rail', 'shaft', 'springer', 'pier'])
const groundCurve = [{ x: -30, y: 0, z: 10 }, { x: 0, y: 0, z: -10 }, { x: 30, y: 0, z: 10 }]
const columnPts = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 14, z: 0 }]
const buttressPts = [{ x: -16, y: 0, z: 0 }, { x: -12, y: 8, z: 0 }, { x: -5, y: 12.5, z: 0 }, { x: 0, y: 14, z: 0 }]
const build = (role, pts, prm = {}, seed = 7, links = {}) => buildCurveSkeleton({ curveId: 'v', curveType: 'catmullRom', curveRole: role }, pts, { ...CLASSIC, ...prm }, seed, links)
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
  check(JSON.stringify(buildCurveSkeleton(curve, archPts, CLASSIC, 42, {})) === JSON.stringify(skel), 'skeleton deterministic for a seed')

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
      const values = spec.options ? spec.options.map((o) => o.id) : [spec.min, spec.max]
      return values.filter((v) => v !== (fixed[spec.key] ?? d)).some((v) => JSON.stringify(build(role, testPts[role], { ...fixed, [spec.key]: v }, 7, links)) !== base)
    })
    check(changed, `skeleton param "${spec.label}" changes the output (${spec.roles.join('/')})`)
  }
  const t0 = performance.now()
  for (let i = 0; i < 20; i += 1) buildCurveSkeleton(curve, archPts, { ...CLASSIC, thickness: 0.6 + i * 0.01, refine: 2 }, 42, {})
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


// ---------------------------------------------------------------- World scan look (REF-031)
{
  const skel = buildCurveSkeleton({ curveId: 'scan', curveType: 'catmullRom', curveRole: 'rib' }, liftToPointedArch(ARCH, 1.1), {}, 42, {})
  const { stones } = buildStones(skel, {}, 42)
  const protos = createStonePrototypes(0.25, 0.75)
  const pool = surfacePool(protos[0])
  const box = pool.pos.every((v) => Math.abs(v) <= 0.5 + 1e-4)
  check(pool.count === 2000 && pool.area > 0.5 && box, `surface pool: 2000 area-weighted samples on the unit-box prototype (area ${pool.area.toFixed(2)})`)
  const base = { density: 30, fidelity: 0.3, noise: 0, coverage: 0, yTop: skel.bounds.max.y, markers: [] }
  const a = buildStonePoints(stones, protos, null, base)
  const b = buildStonePoints(stones, protos, null, { ...base, density: 60 })
  check(a.count > 1000 && Math.abs(b.count / a.count - 2) < 0.15, `stone points scale with density (${a.count} → ${b.count})`)
  check(a.position.every(Number.isFinite) && a.color.every((c) => Number.isFinite(c) && c >= 0), 'stone points finite, colours non-negative')
  const again = buildStonePoints(stones, protos, null, base)
  check(again.count === a.count && again.position[100] === a.position[100], 'stone points are deterministic')
  // Every point lies on (near) a stone: within the stone's half-diagonal of its centre.
  let off = 0
  for (let i = 0; i < a.count; i += 97) {
    const p = [a.position[i * 3], a.position[i * 3 + 1], a.position[i * 3 + 2]]
    if (!stones.some((st) => Math.hypot(p[0] - st.p[0], p[1] - st.p[1], p[2] - st.p[2]) <= Math.hypot(...st.s) * 0.5 + 0.05)) off += 1
  }
  check(off === 0, `noise 0: every sampled point lies on a stone (${off} off)`)
  const thin = buildStonePoints(stones, protos, null, { ...base, coverage: 1 })
  check(thin.count < a.count * 0.8, `coverage falloff thins the cloud (${a.count} → ${thin.count})`)
  const hi = (r) => { let n = 0, s = 0; for (let i = 0; i < r.count; i++) if (r.position[i * 3 + 1] > base.yTop * 0.7) { n++ } ; return n }
  check(hi(thin) / thin.count < hi(a) / a.count, 'coverage thins the top more than the base')
  const st = surveyStations({ bounds: skel.bounds, count: 7, seed: 3, stones: stones.map((s) => ({ p: s.p, kind: s.kind, paletteIndex: s.paletteIndex, curve: 'Curve 001' })) })
  check(st.length === 7 && st.every((s) => s.pos.every(Number.isFinite) && !('time' in s) && !('date' in s)), 'survey stations: 7, no invented time / date fields')
  check(st.every((s) => stones.some((x) => x.p[0] === s.target[0] && x.p[1] === s.target[1] && x.kind === s.kind && PALETTE_HEX[x.paletteIndex] === s.color)), 'every station reports a real target stone (position, kind, palette colour)')
  check(st.every((s) => Math.abs(s.range - Math.hypot(s.pos[0] - s.target[0], s.pos[1] - s.target[1], s.pos[2] - s.target[2])) < 1e-9), 'station range = measured camera → target distance')
  {
    const big = []
    for (let k = 0; k < 40; k++) big.push(...stones.map((x) => ({ ...x, p: [x.p[0] + k * 40, x.p[1], x.p[2]] })))
    const t0 = performance.now()
    const r = buildStonePoints(big, protos, null, { ...base, density: 150 })
    check(r.count <= MAX_STONE_POINTS * 1.01 && performance.now() - t0 < 3000, `point budget holds for a huge structure (${big.length} stones → ${r.count} points, ${(performance.now() - t0).toFixed(0)} ms)`)
  }
  const red = buildStonePoints(stones, protos, null, { ...base, markers: st.map((s) => ({ c: s.target, r: 1.5, k: 1 })) })
  let reds = 0
  for (let i = 0; i < red.count; i++) if (red.color[i * 3] > 3 * red.color[i * 3 + 1] + 0.05) reds += 1
  check(reds > 20 && SCAN_RED === '#ff2a2a', `survey paint marks the station targets red (${reds} points)`)
  const height = createTerrainHeight(DEFAULT_TERRAIN_PARAMS)
  const g = buildGroundPoints({ height, centre: { x: 0, z: 0 }, radius: 60, density: 4, lichen: 0, fidelity: 0.3, noise: 0, seed: 7 })
  let inner = 0, outer = 0
  for (let i = 0; i < g.count; i++) {
    const r = Math.hypot(g.position[i * 3], g.position[i * 3 + 2])
    if (r < 20) inner++
    else if (r > 80 && r < 100) outer++
    if (Math.abs(g.position[i * 3 + 1] - height(g.position[i * 3], g.position[i * 3 + 2])) > 0.05) inner = -1e9
  }
  const dIn = inner / (Math.PI * 400), dOut = outer / (Math.PI * (100 ** 2 - 80 ** 2))
  check(dIn > 3 && dOut < dIn * 0.1, `ground scan: dense centre (${dIn.toFixed(2)}/m²), sparse beyond the radius (${dOut.toFixed(2)}/m²), points on the terrain`)
  const greens = (r) => { let n = 0; for (let i = 0; i < r.count; i++) if (r.color[i * 3 + 1] > r.color[i * 3] * 1.3) n++; return n }
  const gl = buildGroundPoints({ height, centre: { x: 0, z: 0 }, radius: 60, density: 4, lichen: 0.8, fidelity: 0.3, noise: 0, seed: 7 })
  check(greens(g) === 0 && greens(gl) > 100, `lichen is opt-in (0 green points by default, ${greens(gl)} at 0.8)`)
  {
    const t0 = performance.now()
    const r = buildGroundPoints({ height, centre: { x: 0, z: 0 }, radius: 300, density: 40, lichen: 0.5, fidelity: 0.3, noise: 0.35, seed: 7 })
    check(r.count <= MAX_GROUND_POINTS * 1.15, `ground budget holds at max radius × density (${r.count} points, ${(performance.now() - t0).toFixed(0)} ms)`)
  }
  check(!('look' in DEFAULT_PRESENTATION) && DEFAULT_PRESENTATION.lichen === 0 && SCAN_SPECS.every((s) => s.help && s.key in DEFAULT_PRESENTATION), 'point cloud is its own view (no look switch); every scan control has a default and a tooltip')
}


// ---------------------------------------------------------------- X-ray subjects (prominence)
{
  const mk = (id, span, rise, role = 'rib') => {
    const pts = [0, 0.25, 0.5, 0.75, 1].map((u) => ({ x: -span / 2 + span * u, y: 0, z: id.length * 30 }))
    return { curveId: id, skeleton: buildCurveSkeleton({ curveId: id, curveType: 'catmullRom', curveRole: role }, liftToPointedArch(pts, rise), {}, 7, {}) }
  }
  const list = [mk('big', 40, 1.2), mk('mid', 20, 1.1), mk('flat', 12, 0.2)]
  const sc = structureProminence(list)
  check(sc.get('big') === 1 && sc.get('big') > sc.get('mid') && sc.get('mid') > sc.get('flat'), `prominence ranks taller / larger / richer structures higher (${[...sc.values()].map((v) => v.toFixed(2)).join(', ')})`)
  check(prominentSubjects(sc, 1).size === 1 && prominentSubjects(sc, 1).has('big') && prominentSubjects(sc, 0).size === 3, 'subject threshold: 1 → only the most prominent, 0 → all')
}


// ---------------------------------------------------------------- environment + ground surface (REF-032, REF-033)
{
  const lum = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
  const fogEnv = worldEnvironment(1)
  const studio = worldEnvironment(0)
  check(lum(fogEnv.horizon) > 0.75 && Math.abs(lum(fogEnv.zenith) - lum(fogEnv.horizon)) < 0.1 && fogEnv.key < fogEnv.hemi, `sky tone 1 = pale near-uniform overcast, sky light dominates the key (horizon ${fogEnv.horizon})`)
  check(lum(studio.zenith) < 0.05 && lum(studio.horizon) > lum(studio.zenith) && studio.key > studio.hemi, `sky tone 0 = dark studio gradient with a strong key (zenith ${studio.zenith})`)
  const h0 = createTerrainHeight(DEFAULT_TERRAIN_PARAMS)
  const h1 = createTerrainHeight({ ...DEFAULT_TERRAIN_PARAMS, rubble: 1, dust: 0, relief: 1, surfaceScale: 5 })
  check([[300, 120], [180, -260]].every(([x, z]) => h0(x, z) === h1(x, z)), 'ground surface controls never change the terrain height')
  check([...TERRAIN_SURFACE_SPECS].every((sp) => sp.help && sp.key in DEFAULT_TERRAIN_PARAMS) && ENVIRONMENT_SPECS.every((sp) => sp.help && sp.key in DEFAULT_PRESENTATION), 'environment + surface controls have defaults and tooltips')
}


// ---------------------------------------------------------------- debug trace (curve → skeleton)
{
  const arch = buildCurveSkeleton({ curveId: 'dbg', curveType: 'catmullRom', curveRole: 'rib' }, liftToPointedArch(ARCH, 1.1), { style: 1, typology: 'classic' }, 42, {})
  const flat = buildCurveSkeleton({ curveId: 'dbgf', curveType: 'catmullRom', curveRole: 'rib' }, ARCH.map((p) => ({ ...p, y: 2 })), {}, 42, {})
  const col = buildCurveSkeleton({ curveId: 'dbgc', curveType: 'polyline', curveRole: 'column' }, [{ x: 0, y: 0, z: 0 }, { x: 0, y: 12, z: 0 }], {}, 3, {})
  const rules = (s) => s.trace.steps.map((st) => st.rule)
  check(arch.trace.steps.length > 8 && arch.trace.steps.every((st, i) => st.n === i + 1 && st.text), `debug trace: ordered rule log (${arch.trace.steps.length} steps)`)
  check(rules(arch).includes('archTest') && arch.trace.steps.find((st) => st.rule === 'archTest').text.includes('passed') && rules(arch).includes('arch') && rules(arch).includes('subdivide') && rules(arch).includes('oculus'), 'arch curve: log records the arch test, fit, subdivision and oculi')
  check(flat.trace.steps.find((st) => st.rule === 'archTest').text.includes('failed') && rules(flat).includes('band'), 'flat curve: log records why the arch test failed and the band')
  check(rules(col).includes('shafts') && rules(col).includes('springers'), 'column: log records shafts and springers')
  const finite = (s) => s.trace.geom.every((g) => g.points.length && g.points.every((p) => [p.x, p.y, p.z].every(Number.isFinite)))
  check(finite(arch) && finite(flat) && finite(col), `construction geometry is finite (${arch.trace.geom.length} primitives on the arch)`)
  // Arch circles really pass through the arch: the apex lies on both full circles.
  const circles = arch.trace.geom.filter((g) => g.rule === 'arch' && g.kind === 'circle')
  const apex = arch.trace.geom.find((g) => g.rule === 'arch' && g.label?.startsWith('apex')).points[0]
  check(circles.length === 2 && circles.every((c) => Math.abs(Math.hypot(apex.x - c.center.x, apex.y - c.center.y, apex.z - c.center.z) - c.r) < 1e-6), 'debug: the drawn arch circles pass exactly through the apex (R = a + c)')
  const oc = arch.trace.steps.filter((st) => st.rule === 'oculus').length
  const tl = arch.trace.geom.filter((g) => g.rule === 'tangency').length
  check(oc > 0 && tl >= oc * 2, `every oculus has its tangency lines (${oc} oculi, ${tl} lines)`)
}


// ---------------------------------------------------------------- debug trace (skeleton → stone)
{
  const skel = buildCurveSkeleton({ curveId: 'dbs', curveType: 'catmullRom', curveRole: 'rib' }, liftToPointedArch(ARCH, 1.1), {}, 42, {})
  const r = buildStones(skel, { density: 0.8 }, 42)
  const ph = Object.values(r.trace.phases)
  const sum = (k) => ph.reduce((a, v) => a + v[k], 0)
  check(sum('slots') === r.stats.slots && sum('rejected') === r.stats.rejected && sum('skipped') === r.stats.skipped && sum('placed') === r.stones.length, `stone trace: phase counts add up (${r.stats.slots} slots = ${r.stones.length} placed + ${r.stats.rejected} rejected + ${r.stats.skipped} skipped)`)
  check(r.trace.slots.length === r.stats.rejected + r.stats.skipped, 'every unplaced slot is recorded with its outcome')
  const rej = r.trace.slots.filter((t) => t.outcome === 'rejected')
  check(rej.every((t) => r.stones[t.blockedBy] && Math.hypot(t.p[0] - r.stones[t.blockedBy].p[0], t.p[1] - r.stones[t.blockedBy].p[1], t.p[2] - r.stones[t.blockedBy].p[2]) < 2 * Math.max(...r.stones[t.blockedBy].s)), `every rejected slot names a real, nearby blocking stone (${rej.length})`)
  const order = ['carved', 'tracery', 'structural', 'footing', 'plinth', 'gravel']
  check(r.stones.every((st, i) => i === 0 || order.indexOf(st.phase) >= order.indexOf(r.stones[i - 1].phase)), 'stones are stored in placement order (timelapse order)')
  const again = buildStones(skel, { density: 0.8 }, 42)
  check(again.stones.length === r.stones.length && again.stones.every((st, i) => st.p[0] === r.stones[i].p[0] && st.kind === r.stones[i].kind), 'recording the trace does not change placement (deterministic)')
}

// ---------------------------------------------------------------- Move mode: translate a whole curve
{
  let p = createEmptyProject()
  p = applyCommand(p, { type: 'addCurve', curveId: 'A', points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 5, z: 0 }] })
  p = applyCommand(p, { type: 'addCurve', curveId: 'B', points: [{ x: 10, y: 5, z: 0 }, { x: 20, y: 0, z: 10 }], links: { start: null, end: null } })
  const bPts = p.curves.B.controlPoints
  p = applyCommand(p, { type: 'addCurve', curveId: 'C', points: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 }], links: { start: { curveId: 'B', pointId: bPts[1].id }, end: null } })
  const from = resolveCurvePoints(p, p.curves.B)
  const moved = applyCommand(p, { type: 'translateCurve', curveId: 'B', from, delta: { x: 7, y: 2, z: -3 } })
  const after = resolveCurvePoints(moved, moved.curves.B)
  check(after.every((q, i) => q.x === from[i].x + 7 && q.y === from[i].y + 2 && q.z === from[i].z - 3), 'translateCurve moves every point by the same offset (rigid)')
  const cStart = resolveCurvePoints(moved, moved.curves.C)[0]
  check(cStart.x === after[1].x && cStart.z === after[1].z, 'curves linked to a moved curve follow it')
  const down = applyCommand(p, { type: 'translateCurve', curveId: 'B', from, delta: { x: 0, y: -50, z: 0 } })
  check(Math.min(...resolveCurvePoints(down, down.curves.B).map((q) => q.y)) === 0 && resolveCurvePoints(down, down.curves.B)[0].y - resolveCurvePoints(down, down.curves.B)[1].y === from[0].y - from[1].y, 'translateCurve stops at the ground and keeps the curve shape')
}

// ---------------------------------------------------------------- Step 48: curve signature → typologies
{
  const T2 = Math.PI * 2
  const xy = (arr) => arr.map((p) => ({ x: p.x, y: p.y, z: 0 }))
  const circle = (c, r, plane, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = (T2 * i) / n; return plane === 'v' ? { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t), z: c.z } : { x: c.x + r * Math.cos(t), y: 0, z: c.z + r * Math.sin(t) } })
  const poly = (corners, per = 8) => { const out = []; corners.forEach((a, i) => { const b = corners[(i + 1) % corners.length]; for (let j = 0; j < per; j += 1) out.push({ x: a.x + ((b.x - a.x) * j) / per, y: a.y + ((b.y - a.y) * j) / per, z: a.z + ((b.z - a.z) * j) / per }) }); out.push({ ...corners[0] }); return out }
  const CASES = [
    ['pointed', 'rib', xy(sampleArch(twoCentredArch(0, 6, 1, 0), 8))],
    ['cusped', 'rib', xy(sampleArch(twoCentredArch(0, 6, 1.2, 0), 8))],
    ['tudor', 'rib', xy(sampleCArch(tudorArch(8, 4.5), 6))],
    ['ogee', 'rib', xy(sampleCArch(ogeeArch(5, 9), 8))],
    ['round', 'rib', xy(sampleArch(twoCentredArch(0, 6, 0, 0), 10))],
    ['rampant', 'rib', xy(sampleCArch(rampantArch(6, 5, 1, 9), 8))],
    ['storeys', 'rib', xy(sampleArch(twoCentredArch(0, 10, 2, 0), 10))],
    ['rose', 'rib', circle({ x: 0, y: 12, z: 0 }, 9, 'v', 48)],
    ['wheel', 'rib', circle({ x: 0, y: 8, z: 0 }, 4.5, 'v', 40)],
    ['vesica', 'rib', [...Array.from({ length: 21 }, (_, i) => { const t = -Math.PI / 2 + (Math.PI * i) / 20; return { x: 3.5 * Math.cos(t), y: 10 + 8 * Math.sin(t), z: 0 } }), ...Array.from({ length: 20 }, (_, i) => { const t = Math.PI / 2 + (Math.PI * (i + 1)) / 20; return { x: 3.5 * Math.cos(t), y: 10 + 8 * Math.sin(t), z: 0 } })]],
    ['triangle', 'rib', poly([{ x: -7, y: 4, z: 0 }, { x: 7, y: 4, z: 0 }, { x: 0, y: 16, z: 0 }], 10)],
    ['vault', 'rib', poly([{ x: -15, y: 0, z: -5 }, { x: 15, y: 0, z: -5 }, { x: 15, y: 0, z: 5 }, { x: -15, y: 0, z: 5 }], 10)],
    ['chapterHouse', 'rib', circle({ x: 0, y: 0, z: 0 }, 9, 'h', 48)],
    ['canopy', 'rib', poly([{ x: -3, y: 0, z: -3 }, { x: 3, y: 0, z: -3 }, { x: 3, y: 0, z: 3 }, { x: -3, y: 0, z: 3 }], 6)],
    ['cloister', 'rib', poly([{ x: -20, y: 0, z: -15 }, { x: 20, y: 0, z: -15 }, { x: 20, y: 0, z: 15 }, { x: -20, y: 0, z: 15 }], 10)],
    ['apse', 'rib', Array.from({ length: 25 }, (_, i) => { const t = (Math.PI * i) / 24; return { x: 10 * Math.cos(t), y: 0, z: 10 * Math.sin(t) } })],
    ['arcade', 'rib', Array.from({ length: 11 }, (_, i) => ({ x: -15 + 3 * i, y: 0, z: 0 }))],
    ['interlaced', 'rib', Array.from({ length: 21 }, (_, i) => { const t = ((100 * Math.PI) / 180) * (i / 20 - 0.5); return { x: 18 * Math.sin(t), y: 0, z: 18 * Math.cos(t) } })],
    ['reticulated', 'rib', Array.from({ length: 41 }, (_, i) => ({ x: -20 + i, y: 0, z: 2.5 * Math.sin((i / 40) * 2 * T2) }))],
    ['parapet', 'rib', Array.from({ length: 11 }, (_, i) => ({ x: -12 + 2.4 * i, y: 10, z: 0 }))],
    ['band', 'rib', Array.from({ length: 6 }, (_, i) => ({ x: -5 + 2 * i, y: 0, z: 0 }))],
    ['spire', 'rib', [{ x: 0, y: 0, z: 0 }, { x: 0, y: 15, z: 0 }, { x: 0, y: 30, z: 0 }]],
    ['spiralStair', 'rib', Array.from({ length: 61 }, (_, i) => { const t = (3 * T2 * i) / 60; return { x: 3 * Math.cos(t), y: (12 * i) / 60, z: 3 * Math.sin(t) } })],
    ['panel', 'tracery', [{ x: 0, y: 0, z: 0 }, { x: 0, y: 5, z: 0 }, { x: 0, y: 10, z: 0 }]],
  ]
  const run = (role, pts, prm = {}, seed = 7) => buildCurveSkeleton({ curveId: 'typ', curveType: 'polyline', curveRole: role }, pts, prm, seed, {})
  const t0 = performance.now()
  const results = CASES.map(([id, role, pts]) => ({ id, s: run(role, pts) }))
  const ms = (performance.now() - t0) / CASES.length
  const wrong = results.filter((r) => r.s.typology !== r.id).map((r) => `${r.id}→${r.s.typology}`)
  check(!wrong.length, `Auto reads the curve: ${CASES.length} test curves get their typology${wrong.length ? ` (wrong: ${wrong.join(', ')})` : ''}`)
  const invalid = results.filter((r) => !validateSkeleton(r.s).valid).map((r) => `${r.id}: ${validateSkeleton(r.s).errors[0]}`)
  check(!invalid.length, `every typology builds a valid skeleton: finite, above ground, all tangencies exact${invalid.length ? ` (${invalid.join('; ')})` : ''}`)
  check(results.every((r) => r.s.members.length > 3), 'every typology adds construction members beyond the drawn curve')
  check(new Set(results.map((r) => r.s.typology)).size >= 22, `the city can hold ${new Set(results.map((r) => r.s.typology)).size} distinct typologies (≥ 22)`)
  check(results.every((r) => r.s.trace.steps.some((st) => st.rule === 'typology')), 'the debug log records which typology rule fired and why')
  check(results.every((r, i) => JSON.stringify(run(CASES[i][1], CASES[i][2])) === JSON.stringify(r.s)), 'typologies are deterministic')
  check(ms < 25, `typology build fast (${ms.toFixed(1)} ms per curve)`)
  // Forced typologies never crash and stay valid on unsuitable curves (they fall back to classic).
  const forced = []
  for (const t of TYPOLOGIES) for (const [, role, pts] of [CASES[0], CASES[11]]) {
    const s = run(role, pts, { typology: t.id })
    if (!validateSkeleton(s).valid) forced.push(t.id)
  }
  check(!forced.length, `forcing any of ${TYPOLOGIES.length} typologies on an arch or a plan stays valid${forced.length ? ` (${forced.join(', ')})` : ''}`)
  const cl = run('rib', CASES[0][2], { typology: 'classic' })
  check(cl.typology === 'classic' && ['geometric', 'y', 'intersecting'].includes(cl.style), 'Classic keeps the Step 47 grammar (seeded tracery style)')
  // Construction kernel: exact arcs and tangencies.
  const tu = tudorArch(8, 4.5)
  const og = ogeeArch(5, 9)
  const rp = rampantArch(6, 5, 1, 9)
  const ro = roundArch(6, 4)
  check([tu, og, rp, ro].every((a) => a && Math.max(...a.residuals) < 1e-9), 'Tudor, ogee, rampant and segmental arches: every tangency / incidence exact')
  check(Math.abs(tu.apex.y - 4.5) < 1e-9 && Math.abs(og.apex.y - 9) < 1e-9 && Math.abs(ro.apex.y - 4) < 1e-9, 'arch families reach the measured rise exactly')
  const o1 = offsetCArch(fromTwoCentred(twoCentredArch(0, 6, 1, 0)), 0.8)
  check(Math.abs(o1.apex.y - twoCentredArch(0, 6.8, 6 / 6.8, 0).h) < 1e-9, 'composite offset of a two-centred arch = the Step 47 archivolt (same apex)')
  const oo = archOrder(og, -0.5)
  check(oo && oo.kind === 'ogee' && Math.abs(oo.h - 8.1) < 1e-9, 'ogee orders are rebuilt ogees (a − δ, h − 1.8δ), not collapsing offsets')
  const cu = cuspedIntrados(fromTwoCentred(twoCentredArch(0, 5, 1, 0)), 3, 0.55)
  check(cu && Math.max(...cu.residuals) < 1e-9 && cu.cusps.length === 5, 'cusped intrados: 6 lobes internally tangent to the arch, 5 cusps at exact intersections')
  const mo = mouchette({ x: 0, y: 3 }, 0.8, { x: 0.5, y: 0 }, 0.3)
  check(mo && Math.max(...mo.residuals) < 1e-9, 'mouchette: both flanks internally tangent to the head and through the tail')
  const rc = reverseCurve({ x: 0, y: 0 }, { x: 3, y: 4 })
  check(Math.max(...rc.residuals) < 1e-9, 'reverse curve: two equal arcs tangent at the midpoint')
  const ve = vesica({ x: 0, y: 0 }, 4, 1.5)
  check(Math.max(...ve.residuals) < 1e-9, 'vesica: R = (A² + B²)/2B passes both tips and the waist')
  const c3 = circleInsideThree([{ c: { x: 0, y: 0 }, R: 10 }, { c: { x: 6, y: 0 }, R: 10 }, { c: { x: 3, y: 5 }, R: 10 }], { x: 3, y: 2 })
  check(c3 && Math.max(...c3.residuals) < 1e-9, 'roundel internally tangent to three arcs (Newton) is exact')
  const ogs = results.find((r) => r.id === 'ogee').s
  check(['soufflet', 'mouchette'].every((t) => ogs.construction.some((c) => c.type === t)), 'ogee window holds soufflets and mouchettes (flamboyant)')
  const rose = results.find((r) => r.id === 'rose').s
  check(rose.construction.filter((c) => c.type === 'rose').length >= 6, 'rose window: rim oculi tangent to the rim and the radiating lancets')
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll world checks passed')
process.exit(failures ? 1 : 0)
