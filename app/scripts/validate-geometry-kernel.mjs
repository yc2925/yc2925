/**
 * Step 13A.1 — Mathematical geometry kernel validation.
 * Run: node scripts/validate-geometry-kernel.mjs
 */
import {
  point,
  add,
  subtract,
  scale,
  dot,
  cross2D,
  length,
  distance,
  normalize,
  perpendicular,
  lerp,
  nearlyEqualPoints,
  createLine,
  createSegment,
  createCircle,
  createArc,
  intersectInfinite,
  intersectSegments,
  intersectCircles,
  intersectLineCircle,
  reverseArc,
  pointAt,
  startPoint,
  endPoint,
  angleOnArc,
  tangentsFromPoint,
  tangencyResidual,
  offsetCircle,
  offsetLine,
  reflectionAcrossLine,
  transformArc,
  transformCircle,
  transformPoint,
  sampleArc,
  sampleSegment,
  createPlanarRegion,
  validateClosure,
  windingOrientation,
  signedArea,
  detectSelfIntersections,
  ABS_EPS,
  eps,
  INTERSECT,
} from '../src/geometry/gothicGrammar/kernel/index.js'
import { buildExample as buildDemo } from '../src/geometry/gothicGrammar/examples.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13A.1 geometry kernel ===')

// --- Vector arithmetic ---
{
  const a = point(1, 2)
  const b = point(3, -1)
  const s = add(a, b)
  if (s.x !== 4 || s.y !== 1) fail('add')
  else pass('vector add')
  const d = subtract(a, b)
  if (d.x !== -2 || d.y !== 3) fail('subtract')
  else pass('vector subtract')
  if (dot(a, b) !== 1) fail('dot')
  else pass('dot')
  if (cross2D(a, b) !== -7) fail('cross2D')
  else pass('cross2D')
  if (Math.abs(length(point(3, 4)) - 5) > 1e-12) fail('length')
  else pass('length')
  if (Math.abs(distance(a, b) - Math.hypot(-2, 3)) > 1e-12) fail('distance')
  else pass('distance')
  const n = normalize(point(0, 4))
  if (Math.abs(n.x) > 1e-12 || Math.abs(n.y - 1) > 1e-12) fail('normalize')
  else pass('normalize unit')
  const perp = perpendicular(point(2, 0))
  if (perp.x !== 0 || perp.y !== 2) fail('perpendicular')
  else pass('perpendicular')
  const mid = lerp(a, b, 0.5)
  if (!nearlyEqualPoints(mid, point(2, 0.5))) fail('lerp')
  else pass('lerp')
}

// --- Zero-length normalization ---
{
  let threw = false
  try {
    normalize(point(0, 0))
  } catch {
    threw = true
  }
  if (!threw) fail('normalize zero should throw')
  else pass('zero-length normalize throws')
  if (normalize(point(0, 0), { allowZero: true }) !== null) fail('allowZero should return null')
  else pass('zero-length normalize allowZero → null')
}

// --- Parallel / coincident lines ---
{
  const L1 = createLine(point(0, 0), point(1, 0))
  const L2 = createLine(point(0, 1), point(1, 0))
  const L3 = createLine(point(2, 0), point(-1, 0))
  const p = intersectInfinite(L1, L2)
  if (p.status !== INTERSECT.PARALLEL) fail(`parallel expected, got ${p.status}`)
  else pass('parallel lines')
  const c = intersectInfinite(L1, L3)
  if (c.status !== INTERSECT.COINCIDENT) fail(`coincident expected, got ${c.status}`)
  else pass('coincident lines')
  const L4 = createLine(point(0, 0), point(0, 1))
  const hit = intersectInfinite(L1, L4)
  if (hit.status !== INTERSECT.INTERSECTING || !nearlyEqualPoints(hit.point, point(0, 0))) {
    fail('orthogonal line intersection')
  } else pass('line-line intersecting')
}

// --- Segment bounds ---
{
  const s1 = createSegment(point(0, 0), point(1, 0))
  const s2 = createSegment(point(0.5, -1), point(0.5, 1))
  const hit = intersectSegments(s1, s2)
  if (hit.status !== INTERSECT.INTERSECTING || !nearlyEqualPoints(hit.point, point(0.5, 0))) {
    fail('segment cross')
  } else pass('segment-segment intersecting')
  const s3 = createSegment(point(2, -1), point(2, 1))
  const miss = intersectSegments(s1, s3)
  if (miss.status !== INTERSECT.NONE) fail('segment out of bounds should be NONE')
  else pass('segment bounds respected (infinite hit ≠ segment hit)')
  const deg = createSegment(point(1, 1), point(1, 1))
  if (!deg.degenerate) fail('degenerate segment flag')
  else pass('zero-length segment marked degenerate')
}

// --- Circle intersections ---
{
  const c1 = createCircle(point(0, 0), 1)
  const c2 = createCircle(point(1, 0), 1)
  const hit = intersectCircles(c1, c2)
  if (hit.status !== INTERSECT.INTERSECTING || hit.points.length !== 2) fail('two circle intersections')
  else {
    const sorted = [...hit.points].sort((a, b) => a.y - b.y)
    if (Math.abs(sorted[0].y + sorted[1].y) > 1e-9) fail('circle intersection symmetry')
    else pass('circle-circle two intersections (deterministic)')
  }
  const tan = intersectCircles(c1, createCircle(point(2, 0), 1))
  if (tan.status !== 'TANGENT' || tan.points.length !== 1) fail('tangent circles')
  else pass('circle-circle tangent')
  const none = intersectCircles(c1, createCircle(point(5, 0), 1))
  if (none.status !== INTERSECT.NONE) fail('separated circles')
  else pass('circle-circle none')
  const coin = intersectCircles(c1, createCircle(point(0, 0), 1))
  if (coin.status !== 'COINCIDENT') fail('coincident circles')
  else pass('circle-circle coincident')
}

// --- Nearly tangent / nearly parallel ---
{
  const c1 = createCircle(point(0, 0), 1)
  const c2 = createCircle(point(2 - 1e-10, 0), 1)
  const hit = intersectCircles(c1, c2)
  if (hit.status !== 'TANGENT' && hit.status !== INTERSECT.INTERSECTING) {
    fail(`nearly tangent: ${hit.status}`)
  } else pass(`nearly tangent circles → ${hit.status}`)
  const L1 = createLine(point(0, 0), point(1, 0))
  const L2 = createLine(point(0, 1), point(1, 1e-12))
  const p = intersectInfinite(L1, L2)
  // Extremely small angle — may classify as parallel or intersecting far away
  if (p.status === INTERSECT.PARALLEL || p.status === INTERSECT.INTERSECTING) {
    pass(`nearly parallel lines → ${p.status}`)
  } else fail(`nearly parallel unexpected ${p.status}`)
}

// --- Circle tangency ---
{
  const c = createCircle(point(0, 0), 1)
  const t = tangentsFromPoint(c, point(3, 0))
  if (t.tangents.length !== 2) fail('two external tangents')
  else {
    const okRes = t.tangents.every((tan) => tangencyResidual(c, tan.touchPoint) < 1e-9)
    if (!okRes) fail('tangent touch residual')
    else pass('tangents from external point')
  }
  const inside = tangentsFromPoint(c, point(0.1, 0))
  if (inside.tangents.length !== 0) fail('inside point should have no tangents')
  else pass('no tangents from interior point')
}

// --- Arc reversal / wraparound ---
{
  const arc = createArc(point(0, 0), 1, -0.2, 4)
  const rev = reverseArc(arc)
  if (!nearlyEqualPoints(startPoint(arc), endPoint(rev))) fail('arc reverse start/end')
  else pass('arc reversal endpoints')
  if (Math.sign(rev.sweepAngle) === Math.sign(arc.sweepAngle)) fail('arc reverse sweep sign')
  else pass('arc reverse sweep orientation')
  if (!angleOnArc(arc, -0.2 + 2) && !angleOnArc(arc, -0.2)) fail('angleOnArc wrap')
  else pass('arc angular wraparound')
  const mid = pointAt(arc, 0.5)
  if (!Number.isFinite(mid.x) || !Number.isFinite(mid.y)) fail('arc pointAt finite')
  else pass('arc pointAt finite')
}

// --- Reflection ---
{
  const mirror = createLine(point(0, 0), point(0, 1))
  const xf = reflectionAcrossLine(mirror)
  const p = transformPoint(point(1.5, 2), xf)
  if (!nearlyEqualPoints(p, point(-1.5, 2))) fail('reflect point')
  else pass('reflection of point across Y axis')
  const circ = createCircle(point(1, 1), 0.5)
  const mc = transformCircle(circ, xf)
  if (!nearlyEqualPoints(mc.center, point(-1, 1))) fail('reflect circle center')
  else pass('reflection of circle')
  const arc = createArc(point(1, 1), 0.5, 0, Math.PI / 2)
  const ma = transformArc(arc, xf)
  if (Math.sign(ma.sweepAngle) === Math.sign(arc.sweepAngle)) fail('reflected arc should flip sweep')
  else pass('reflection preserves arc orientation (flipped sweep)')
}

// --- Invalid offsets ---
{
  const c = createCircle(point(0, 0), 0.5)
  const bad = offsetCircle(c, -0.6)
  if (bad.ok) fail('nonpositive offset radius should reject')
  else pass('invalid circle offset rejected')
  const good = offsetCircle(c, 0.2)
  if (!good.ok || Math.abs(good.circle.radius - 0.7) > 1e-12) fail('valid offset')
  else pass('concentric circle offset')
  const seg = createSegment(point(0, 0), point(2, 0))
  const off = offsetLine(seg, 1)
  if (!nearlyEqualPoints(off.a, point(0, 1)) || !nearlyEqualPoints(off.b, point(2, 1))) {
    fail('line offset left-normal')
  } else pass('line offset (positive = left)')
}

// --- Loop closure / winding / self-intersection ---
{
  const O = point(0, 0)
  const r = 1
  const arcs = [0, 1, 2, 3].map((i) => {
    const start = (i * Math.PI) / 2
    return createArc(O, r, start, Math.PI / 2)
  })
  const closure = validateClosure(arcs)
  if (!closure.ok) fail(`closure: ${closure.reason}`)
  else pass('loop closure')
  const area = signedArea(arcs, { segments: 32 })
  if (!(area > 0)) fail(`signed area expected positive CCW, got ${area}`)
  else pass(`signed area ${area.toFixed(3)} (ccw)`)
  if (windingOrientation(arcs, { segments: 32 }) !== 'ccw') fail('winding')
  else pass('winding orientation ccw')
  const region = createPlanarRegion(arcs, [], { segments: 20 })
  if (!region.ok) fail(`planar region: ${region.reason}`)
  else pass('valid closed region')

  const bow = [
    createSegment(point(0, 0), point(1, 1)),
    createSegment(point(1, 1), point(0, 1)),
    createSegment(point(0, 1), point(1, 0)),
    createSegment(point(1, 0), point(0, 0)),
  ]
  const self = detectSelfIntersections(bow, { segments: 1 })
  if (!self.selfIntersecting) fail('bow-tie should self-intersect')
  else pass('self-intersection detection')
  const badRegion = createPlanarRegion(bow, [], { segments: 1 })
  if (badRegion.ok) fail('self-intersecting region should reject')
  else pass('invalid closed region rejected')
}

// --- Deterministic sampling ---
{
  const arc = createArc(point(0, 0), 1, 0, Math.PI / 2)
  const a = sampleArc(arc, { maxAngularStep: Math.PI / 16, maxChordError: 0.02 })
  const b = sampleArc(arc, { maxAngularStep: Math.PI / 16, maxChordError: 0.02 })
  if (a.length !== b.length) fail('sampling length nondeterministic')
  else if (!a.every((p, i) => nearlyEqualPoints(p, b[i]))) fail('sampling values nondeterministic')
  else pass(`deterministic sampling (${a.length} pts)`)
  const seg = sampleSegment(createSegment(point(0, 0), point(1, 0)), 4)
  if (seg.length !== 5) fail('segment sample count')
  else pass('segment sampling inclusive endpoints')
}

// --- Finite coordinates / scale extremes ---
{
  const tiny = createCircle(point(1e-8, 1e-8), 1e-7)
  const hit = intersectLineCircle(createLine(point(0, 0), point(1, 0)), tiny)
  if (hit.points?.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    fail('tiny geometry NaN')
  } else pass(`tiny geometry finite (${hit.status})`)
  const huge = createCircle(point(1e6, 1e6), 1e5)
  const h2 = intersectCircles(huge, createCircle(point(1e6 + 1.5e5, 1e6), 1e5))
  if (h2.points?.some((p) => !Number.isFinite(p.x))) fail('large coords NaN')
  else pass(`large coordinates finite (${h2.status})`)
}

// --- Examples rebuild ---
{
  const ids = [
    'points-lines',
    'circle-intersections',
    'circular-arcs',
    'tangency',
    'offsets',
    'reflection',
    'closed-regions',
  ]
  for (const id of ids) {
    const r = buildDemo(id)
    if (!r?.curves?.length) fail(`example ${id} empty curves`)
    else if (r.curves.some((c) => c.samples?.some((p) => !Number.isFinite(p.x)))) {
      fail(`example ${id} NaN samples`)
    } else pass(`example ${id} → ${r.curves.length} curves`)
  }
}

// --- Tolerance policy smoke ---
{
  pass(`tolerance ABS_EPS=${ABS_EPS} eps(1)=${eps(1)}`)
}

console.log(ok ? '\nAll geometry kernel checks passed.' : '\nGeometry kernel validation FAILED.')
process.exit(ok ? 0 : 1)
