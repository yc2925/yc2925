/**
 * Step 47 vertical slice — model, curves, skeleton, lithic validation.
 * Run: node scripts/validate-world.mjs
 */
import { applyCommand, createEmptyProject, deserializeProject, serializeProject } from '../src/world/model/project.js'
import { createHistory, dispatch, redo, seal, undo } from '../src/world/model/history.js'
import { skeletonSignature } from '../src/world/model/signature.js'
import { dot, evaluateCurve, len, rotationMinimisingFrames, resampleByCount, signedCurvature } from '../src/world/curves/curve3.js'
import { buildSpineSkeleton, validateSkeleton } from '../src/world/skeleton/spine.js'
import { DEFAULT_SKELETON_PARAMS } from '../src/world/skeleton/params.js'
import { archPrismDist, buildLithicField, createLocalEvaluator } from '../src/world/lithic/field.js'
import { meshLithicField } from '../src/world/lithic/mesh.js'
import { analyzeEdges, createMeshData } from '../src/geometry/gothicGrammar/solids/meshValidation.js'

let failures = 0
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) failures += 1
}

const PTS = [
  { x: -40, y: 0, z: 10 },
  { x: -10, y: 0, z: -5 },
  { x: 15, y: 0, z: 5 },
  { x: 40, y: 0, z: -20 },
]

// ---------- A1 model
{
  let h = createHistory(createEmptyProject())
  h = dispatch(h, { type: 'addCurve', curveId: 'crv_a', structureId: 'str_a', points: PTS.slice(0, 2) })
  h = dispatch(h, { type: 'appendPoint', curveId: 'crv_a', point: PTS[2] })
  for (let i = 0; i < 5; i += 1) h = dispatch(h, { type: 'movePoint', curveId: 'crv_a', index: 2, point: { x: 15 + i, y: 0, z: 5 } }, { coalesce: 'drag1' })
  h = seal(h)
  check(h.past.length === 3, `drag coalesces into one undo step (past=${h.past.length})`)
  const moved = h.present.curves.crv_a.controlPoints[2].x
  h = undo(h)
  check(h.present.curves.crv_a.controlPoints[2].x === 15, `undo restores pre-drag point (was ${moved})`)
  h = redo(h)
  check(h.present.curves.crv_a.controlPoints[2].x === moved, 'redo reapplies drag')
  h = dispatch(h, { type: 'addCurve', curveId: 'crv_b', structureId: 'str_b', points: PTS.slice(1) })
  const before = h.present
  h = dispatch(h, { type: 'deleteCurve', curveId: 'crv_b' })
  check(!h.present.curves.crv_b && !h.present.structures.str_b, 'delete removes curve and its structure')
  check(h.present.curves.crv_a === before.curves.crv_a, 'unrelated curve object identity unchanged')
  h = undo(h)
  check(Boolean(h.present.curves.crv_b && h.present.structures.str_b), 'undo restores deleted curve + structure')
  const round = deserializeProject(serializeProject(h.present))
  check(JSON.stringify(round) === JSON.stringify(h.present), 'serialize → deserialize round-trip is lossless')
  check(deserializeProject('{}').schemaVersion === 1, 'empty / legacy document migrates to schema 1')
  const locked = applyCommand(applyCommand(h.present, { type: 'setCurveField', curveId: 'crv_a', field: 'locked', value: true }), {
    type: 'movePoint', curveId: 'crv_a', index: 0, point: { x: 99, y: 0, z: 99 },
  })
  check(locked.curves.crv_a.controlPoints[0].x === -40, 'locked curve rejects geometry edits')
  const unlocked = applyCommand(locked, { type: 'setCurveField', curveId: 'crv_a', field: 'locked', value: false })
  check(unlocked.curves.crv_a.locked === false, 'locked curve can be unlocked')
}

// ---------- A2 curves
{
  const curve = { curveType: 'catmullRom', closed: false, controlPoints: PTS }
  const { points, length } = evaluateCurve(curve)
  check(points[0].x === -40 && points[points.length - 1].x === 40, 'spline interpolates end control points')
  check(length > 80 && length < 120, `spline length plausible (${length.toFixed(2)} m)`)
  const samples = resampleByCount(points, 200)
  const gaps = samples.slice(1).map((p, i) => len({ x: p.x - samples[i].x, y: p.y - samples[i].y, z: p.z - samples[i].z }))
  const spread = Math.max(...gaps) - Math.min(...gaps)
  check(spread < 0.02, `arc-length resampling is uniform (spread ${spread.toFixed(4)} m)`)
  const frames = rotationMinimisingFrames(samples)
  let worst = 1
  let ortho = 0
  for (let i = 1; i < frames.length; i += 1) {
    worst = Math.min(worst, dot(frames[i].side, frames[i - 1].side))
    ortho = Math.max(ortho, Math.abs(dot(frames[i].side, frames[i].t)))
  }
  check(worst > 0.98, `RMF has no flips (min consecutive side·side = ${worst.toFixed(4)})`)
  check(ortho < 1e-6, `frames orthonormal (max |side·t| = ${ortho.toExponential(1)})`)
  const space = { curveType: 'catmullRom', controlPoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 6, z: 3 }, { x: 4, y: 12, z: 14 }, { x: -6, y: 20, z: 2 }] }
  const sf = rotationMinimisingFrames(resampleByCount(evaluateCurve(space).points, 150))
  let sw = 1
  for (let i = 1; i < sf.length; i += 1) sw = Math.min(sw, dot(sf[i].side, sf[i - 1].side))
  check(sw > 0.95, `RMF stable on a space curve (min ${sw.toFixed(4)})`)
  const k = signedCurvature(frames)
  check(k.some((v) => v > 0.01) && k.some((v) => v < -0.01), 'signed curvature detects both turn directions on an S-curve')
  const closed = evaluateCurve({ curveType: 'catmullRom', closed: true, controlPoints: PTS.slice(0, 3) })
  const a = closed.points[0]
  const b = closed.points[closed.points.length - 1]
  check(a.x === b.x && a.z === b.z, 'closed curve seam is closed')
}

// ---------- B1 skeleton
const curve = { curveId: 'crv_a', curveType: 'catmullRom', closed: false, controlPoints: PTS }
const skel = buildSpineSkeleton(curve, {})
{
  const v = validateSkeleton(skel)
  check(v.valid, `skeleton connectivity (${v.errors.slice(0, 3).join('; ') || 'ok'})`)
  check(skel.stats.bayCount === Math.round(skel.stats.length / DEFAULT_SKELETON_PARAMS.spacing), `bay count = round(L / spacing) = ${skel.stats.bayCount}`)
  check(Math.abs(skel.stats.vaultApex - DEFAULT_SKELETON_PARAMS.height) < 1e-6, 'vault apex equals height × verticality')
  const lens = skel.bays.map((b) => b.length)
  const curvy = skel.bays.reduce((m, b) => (Math.abs(b.kappa) > Math.abs(m.kappa) ? b : m))
  check(curvy.length < Math.max(...lens), `bays compress on bends (tightest-bend bay ${curvy.length.toFixed(1)} m < max ${Math.max(...lens).toFixed(1)} m)`)
  const again = buildSpineSkeleton(curve, {})
  check(JSON.stringify(again) === JSON.stringify(skel), 'skeleton is deterministic')
  const tall = buildSpineSkeleton(curve, { height: 30 })
  check(tall.bounds.max.y > skel.bounds.max.y + 10, 'height parameter raises the structure')
  const dense = buildSpineSkeleton(curve, { spacing: 4 })
  check(dense.stats.bayCount > skel.stats.bayCount, 'spacing parameter changes bay count')
  const noSpire = buildSpineSkeleton(curve, { spireIntensity: 0 })
  check(!noSpire.members.some((m) => m.kind === 'spire'), 'spire intensity 0 removes spires')
  const arcade = buildSpineSkeleton(curve, { width: 0 })
  check(arcade.members.every((m) => m.kind !== 'transverseArch') && validateSkeleton(arcade).valid, 'width 0 produces a valid single arcade')
  const sigA = skeletonSignature(curve, DEFAULT_SKELETON_PARAMS, 1)
  const sigB = skeletonSignature({ ...curve, controlPoints: [...PTS.slice(0, 3), { x: 41, y: 0, z: -20 }] }, DEFAULT_SKELETON_PARAMS, 1)
  check(sigA !== sigB && sigA === skeletonSignature(curve, { ...DEFAULT_SKELETON_PARAMS }, 1), 'signature changes with geometry only')
  const t0 = performance.now()
  for (let i = 0; i < 20; i += 1) buildSpineSkeleton(curve, { height: 18 + i * 0.1 })
  const ms = (performance.now() - t0) / 20
  check(ms < 16, `live skeleton preview fast enough (${ms.toFixed(2)} ms / build)`)
}

// ---------- C1 lithic
{
  const field = buildLithicField(skel, {}, 123)
  const again = buildLithicField(skel, {}, 123)
  check(JSON.stringify(field.lobes) === JSON.stringify(again.lobes), 'lobe seeding is deterministic for a seed')
  const other = buildLithicField(skel, {}, 124)
  check(JSON.stringify(field.lobes) !== JSON.stringify(other.lobes), 'different seed → different lobes')
  // Openings: every protected volume centre near the floor must be air.
  let blocked = 0
  for (const pv of skel.protected) {
    const o = pv.origin
    const yy = o.y + Math.min(2.5, pv.springY * 0.5)
    const ev = createLocalEvaluator(field, [o.x - 1, yy - 1, o.z - 1], [o.x + 1, yy + 1, o.z + 1])
    if (ev && ev(o.x, yy, o.z) < 0) blocked += 1
  }
  check(blocked === 0, `all ${skel.protected.length} protected openings stay open (${blocked} blocked)`)
  const pv = field.protected[0]
  check(archPrismDist(pv.o[0], pv.o[1] + 1, pv.o[2], pv) < 0, 'arch prism SDF negative inside')
  const m = meshLithicField(field, { quality: 'preview' })
  const edges = analyzeEdges(createMeshData(Array.from(m.positions), Array.from(m.indices)))
  check(m.stats.triangles > 10000, `preview mesh generated (${m.stats.triangles} tris, ${Math.round(m.stats.ms)} ms, ${m.stats.chunksSkipped} chunks culled)`)
  check(edges.boundaryEdgeCount / edges.edgeCount < 1e-4, `preview mesh essentially closed (${edges.boundaryEdgeCount} open edges of ${edges.edgeCount}; from degenerate quads dropped at weld)`)
  const nmRatio = edges.nonManifoldEdgeCount / edges.edgeCount
  check(nmRatio < 0.005, `non-manifold edges rare (${edges.nonManifoldEdgeCount} = ${(nmRatio * 100).toFixed(2)}%, surface-nets pinches)`)
  check(m.stats.ms < 3000, `preview within budget (${Math.round(m.stats.ms)} ms)`)
  const strata = meshLithicField(buildLithicField(skel, { layering: 0.8 }, 123), { quality: 'preview' })
  const thick = meshLithicField(buildLithicField(skel, { formationThickness: 3 }, 123), { quality: 'preview' })
  check(strata.stats.triangles !== m.stats.triangles && thick.stats.triangles !== m.stats.triangles, 'layering / thickness change the formation')
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll world checks passed')
process.exit(failures ? 1 : 0)
