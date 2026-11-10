/**
 * Working kernel examples for the Gothic Grammar tab (Step 13A.1).
 * Every shape is produced by kernel functions — no bypass drawings.
 */

import {
  point,
  createSegment,
  createLine,
  createCircle,
  createArc,
  intersectCircles,
  intersectSegments,
  tangentsFromPoint,
  offsetCircle,
  offsetLine,
  reflectionAcrossLine,
  transformArc,
  transformCircle,
  createPlanarRegion,
  createConstructionResult,
  markInvalid,
  sampleArc,
  sampleCircle,
  sampleSegment,
  startPoint,
  endPoint,
  resetIdCounter,
} from './kernel/index.js'

export const EXAMPLE_IDS = [
  { id: 'points-lines', label: 'A · Points & Lines' },
  { id: 'circle-intersections', label: 'B · Circle Intersections' },
  { id: 'circular-arcs', label: 'C · Circular Arcs' },
  { id: 'tangency', label: 'D · Tangency' },
  { id: 'offsets', label: 'E · Offsets' },
  { id: 'reflection', label: 'F · Reflection' },
  { id: 'closed-regions', label: 'G · Closed Regions' },
]

export const DEFAULT_EXAMPLE_PARAMS = {
  'points-lines': { ax: -1.2, ay: 0.4, bx: 1.4, by: 2.2, cx: -0.2, cy: 2.6 },
  'circle-intersections': { x1: 0, y1: 1.4, r1: 1.1, x2: 1.0, y2: 1.4, r2: 0.95 },
  'circular-arcs': { cx: 0, cy: 1.5, r: 1.2, startDeg: -20, sweepDeg: 140 },
  tangency: { cx: 0.3, cy: 1.5, r: 0.9, px: -1.6, py: 0.5 },
  offsets: { cx: 0, cy: 1.4, r: 1.0, offset: 0.25, lx0: -1.5, ly0: 0.3, lx1: 1.5, ly1: 0.3 },
  reflection: { cx: 0.7, cy: 1.6, r: 0.75, startDeg: -30, sweepDeg: 120 },
  'closed-regions': { cx: 0, cy: 1.5, r: 1.1 },
}

function deg(d) {
  return (d * Math.PI) / 180
}

export function buildExample(exampleId, params = {}) {
  resetIdCounter(0)
  const p = { ...DEFAULT_EXAMPLE_PARAMS[exampleId], ...params }

  switch (exampleId) {
    case 'points-lines':
      return buildPointsLines(p)
    case 'circle-intersections':
      return buildCircleIntersections(p)
    case 'circular-arcs':
      return buildCircularArcs(p)
    case 'tangency':
      return buildTangency(p)
    case 'offsets':
      return buildOffsets(p)
    case 'reflection':
      return buildReflection(p)
    case 'closed-regions':
      return buildClosedRegions(p)
    default:
      return createConstructionResult({
        type: 'unknown',
        validation: { ok: false, errors: [`Unknown example ${exampleId}`] },
      })
  }
}

function buildPointsLines(p) {
  const A = point(p.ax, p.ay)
  const B = point(p.bx, p.by)
  const C = point(p.cx, p.cy)
  const seg = createSegment(A, B)
  const line = createLine(A, { x: B.x - A.x, y: B.y - A.y })
  const cross = createSegment(C, point((A.x + B.x) / 2, (A.y + B.y) / 2))
  const hit = intersectSegments(seg, cross)

  let result = createConstructionResult({
    type: 'points-lines',
    parameters: p,
    primitives: [
      { id: 'A', type: 'point', ...A, role: 'endpoint' },
      { id: 'B', type: 'point', ...B, role: 'endpoint' },
      { id: 'C', type: 'point', ...C, role: 'control' },
      { id: 'AB', type: 'segment', entity: seg, role: 'result' },
      { id: 'support', type: 'line', entity: line, role: 'construction' },
      { id: 'cross', type: 'segment', entity: cross, role: 'construction' },
    ],
    derivedPoints:
      hit.status === 'INTERSECTING' && hit.point
        ? [{ id: 'X', type: 'point', ...hit.point, role: 'intersection', label: 'X' }]
        : [],
    constraints: [{ type: 'segment-intersection', status: hit.status }],
    curves: [
      { id: 'AB', role: 'result', samples: sampleSegment(seg, 1) },
      { id: 'cross', role: 'construction', samples: sampleSegment(cross, 1) },
    ],
    metadata: { title: 'Points & Lines', references: ['REF-008'] },
  })
  if (seg.degenerate) result = markInvalid(result, 'Segment AB is degenerate')
  return result
}

function buildCircleIntersections(p) {
  const c1 = createCircle(point(p.x1, p.y1), p.r1)
  const c2 = createCircle(point(p.x2, p.y2), p.r2)
  const hit = intersectCircles(c1, c2)
  const derived = (hit.points ?? []).map((pt, i) => ({
    id: `I${i}`,
    type: 'point',
    ...pt,
    role: 'intersection',
    label: `I${i}`,
  }))

  let result = createConstructionResult({
    type: 'circle-intersections',
    parameters: p,
    primitives: [
      { id: 'C1', type: 'circle', entity: c1, role: 'result' },
      { id: 'C2', type: 'circle', entity: c2, role: 'result' },
      { id: 'O1', type: 'point', ...c1.center, role: 'center', label: 'O1' },
      { id: 'O2', type: 'point', ...c2.center, role: 'center', label: 'O2' },
    ],
    derivedPoints: derived,
    constraints: [{ type: 'circle-circle', status: hit.status }],
    curves: [
      { id: 'C1', role: 'result', closed: true, samples: sampleCircle(c1, 64) },
      { id: 'C2', role: 'result', closed: true, samples: sampleCircle(c2, 64) },
    ],
    metadata: { title: 'Circle Intersections', references: ['REF-006', 'REF-008'] },
  })
  if (hit.status === 'NONE') {
    result = markInvalid(result, 'Circles do not intersect')
  }
  return result
}

function buildCircularArcs(p) {
  const circle = createCircle(point(p.cx, p.cy), p.r)
  const arc = createArc(circle.center, circle.radius, deg(p.startDeg), deg(p.sweepDeg))
  const s = startPoint(arc)
  const e = endPoint(arc)

  return createConstructionResult({
    type: 'circular-arcs',
    parameters: p,
    primitives: [
      { id: 'support', type: 'circle', entity: circle, role: 'construction' },
      { id: 'arc', type: 'arc', entity: arc, role: 'result' },
      { id: 'O', type: 'point', ...circle.center, role: 'center', label: 'O' },
      { id: 'S', type: 'point', ...s, role: 'endpoint', label: 'S' },
      { id: 'E', type: 'point', ...e, role: 'endpoint', label: 'E' },
    ],
    derivedPoints: [],
    curves: [
      { id: 'support', role: 'construction', closed: true, samples: sampleCircle(circle, 64) },
      {
        id: 'arc',
        role: 'result',
        samples: sampleArc(arc, { maxAngularStep: Math.PI / 24, maxChordError: 0.04 }),
      },
    ],
    metadata: {
      title: 'Circular Arcs',
      arcLength: Math.abs(arc.sweepAngle) * arc.radius,
      references: ['REF-006', 'REF-011'],
    },
  })
}

function buildTangency(p) {
  const circle = createCircle(point(p.cx, p.cy), p.r)
  const ext = point(p.px, p.py)
  const tang = tangentsFromPoint(circle, ext)
  const derived = []
  const curves = [{ id: 'C', role: 'result', closed: true, samples: sampleCircle(circle, 64) }]
  const primitives = [
    { id: 'C', type: 'circle', entity: circle, role: 'result' },
    { id: 'O', type: 'point', ...circle.center, role: 'center', label: 'O' },
    { id: 'P', type: 'point', ...ext, role: 'control', label: 'P' },
  ]

  ;(tang.tangents ?? []).forEach((t, i) => {
    derived.push({
      id: `T${i}`,
      type: 'point',
      ...t.touchPoint,
      role: 'intersection',
      label: `T${i}`,
    })
    const seg = createSegment(ext, t.touchPoint)
    primitives.push({ id: `tan${i}`, type: 'segment', entity: seg, role: 'construction' })
    curves.push({ id: `tan${i}`, role: 'construction', samples: sampleSegment(seg, 1) })
  })

  let result = createConstructionResult({
    type: 'tangency',
    parameters: p,
    primitives,
    derivedPoints: derived,
    constraints: [{ type: 'tangents-from-point', status: tang.status, count: tang.tangents?.length ?? 0 }],
    curves,
    metadata: { title: 'Tangency', references: ['REF-008'] },
  })
  if (tang.status === 'NONE') result = markInvalid(result, 'Point is inside the circle — no real tangents')
  return result
}

function buildOffsets(p) {
  const circle = createCircle(point(p.cx, p.cy), p.r)
  const off = offsetCircle(circle, p.offset)
  const seg = createSegment(point(p.lx0, p.ly0), point(p.lx1, p.ly1))
  const lineOff = offsetLine(seg, p.offset)

  const curves = [
    { id: 'C', role: 'result', closed: true, samples: sampleCircle(circle, 64) },
    { id: 'L', role: 'result', samples: sampleSegment(seg, 1) },
  ]
  const primitives = [
    { id: 'C', type: 'circle', entity: circle, role: 'result' },
    { id: 'L', type: 'segment', entity: seg, role: 'result' },
  ]

  let result = createConstructionResult({
    type: 'offsets',
    parameters: p,
    primitives,
    derivedPoints: [],
    curves,
    metadata: { title: 'Offsets', references: ['REF-008'] },
  })

  if (!off.ok) {
    result = markInvalid(result, `Circle offset rejected: ${off.reason}`)
  } else {
    result.primitives.push({ id: 'Coff', type: 'circle', entity: off.circle, role: 'construction' })
    result.curves.push({
      id: 'Coff',
      role: 'construction',
      closed: true,
      samples: sampleCircle(off.circle, 64),
    })
  }
  result.primitives.push({ id: 'Loff', type: 'segment', entity: lineOff, role: 'construction' })
  result.curves.push({ id: 'Loff', role: 'construction', samples: sampleSegment(lineOff, 1) })
  return result
}

function buildReflection(p) {
  const mirror = createLine(point(0, 0), { x: 0, y: 1 }) // Y axis
  const circle = createCircle(point(p.cx, p.cy), p.r)
  const arc = createArc(circle.center, circle.radius, deg(p.startDeg), deg(p.sweepDeg))
  const xf = reflectionAcrossLine(mirror)
  const mirroredCircle = transformCircle(circle, xf)
  const mirroredArc = transformArc(arc, xf)
  const axisSeg = createSegment(point(0, -0.2), point(0, 3.2))

  return createConstructionResult({
    type: 'reflection',
    parameters: p,
    primitives: [
      { id: 'axis', type: 'segment', entity: axisSeg, role: 'construction' },
      { id: 'C', type: 'circle', entity: circle, role: 'result' },
      { id: 'arc', type: 'arc', entity: arc, role: 'result' },
      { id: 'Cm', type: 'circle', entity: mirroredCircle, role: 'construction' },
      { id: 'arcm', type: 'arc', entity: mirroredArc, role: 'construction' },
      { id: 'O', type: 'point', ...circle.center, role: 'center', label: 'O' },
      {
        id: 'Om',
        type: 'point',
        ...mirroredCircle.center,
        role: 'center',
        label: "O'",
      },
    ],
    derivedPoints: [],
    curves: [
      { id: 'axis', role: 'construction', samples: sampleSegment(axisSeg, 1) },
      { id: 'C', role: 'result', closed: true, samples: sampleCircle(circle, 64) },
      { id: 'arc', role: 'result', samples: sampleArc(arc, { segments: 32 }) },
      { id: 'Cm', role: 'construction', closed: true, samples: sampleCircle(mirroredCircle, 64) },
      { id: 'arcm', role: 'construction', samples: sampleArc(mirroredArc, { segments: 32 }) },
    ],
    metadata: { title: 'Reflection', references: ['REF-008', 'REF-011'] },
  })
}

function buildClosedRegions(p) {
  // Quatrefoil-like region from four arcs of one circle packing (REF-006 style schematic)
  const O = point(p.cx, p.cy)
  const r = p.r
  const arcs = [0, 1, 2, 3].map((i) => {
    const start = (i * Math.PI) / 2 - Math.PI / 4
    return createArc(O, r, start, Math.PI / 2)
  })
  // Actually a full circle as four quarter arcs — closed loop
  const regionBuild = createPlanarRegion(arcs, [], { segments: 20 })

  const curves = arcs.map((a, i) => ({
    id: `arc${i}`,
    role: 'result',
    samples: sampleArc(a, { segments: 16 }),
  }))

  let result = createConstructionResult({
    type: 'closed-regions',
    parameters: p,
    primitives: [
      { id: 'O', type: 'point', ...O, role: 'center', label: 'O' },
      ...arcs.map((a, i) => ({ id: `arc${i}`, type: 'arc', entity: a, role: 'result' })),
    ],
    derivedPoints: [],
    curves,
    validation: {
      ok: regionBuild.ok,
      errors: regionBuild.ok ? [] : [regionBuild.reason],
      warnings: [],
    },
    metadata: {
      title: 'Closed Regions',
      signedArea: regionBuild.region?.signedArea,
      orientation: regionBuild.region?.orientation,
      references: ['REF-006'],
    },
  })
  if (!regionBuild.ok) result = markInvalid(result, regionBuild.reason)
  return result
}

/** Axis-aligned bounds of a construction for camera fit. */
export function constructionBounds(result) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const consider = (p) => {
    if (!p || !Number.isFinite(p.x)) return
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  for (const c of result.curves ?? []) {
    for (const p of c.samples ?? []) consider(p)
  }
  for (const d of result.derivedPoints ?? []) consider(d)
  for (const pr of result.primitives ?? []) {
    if (pr.type === 'point') consider(pr)
  }
  if (!Number.isFinite(minX)) {
    return { min: { x: -2, y: 0 }, max: { x: 2, y: 3 }, width: 4, height: 3 }
  }
  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
    width: maxX - minX,
    height: maxY - minY,
  }
}
