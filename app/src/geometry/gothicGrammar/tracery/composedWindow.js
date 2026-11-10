/**
 * Hierarchical window composition: TWO LANCETS + UPPER QUATREFOIL (Step 13C).
 *
 * Sequence:
 * 1. Parent pointed arch
 * 2. Lancet subdivision + mullion
 * 3. Upper residual region → oculus solve
 * 4. Quatrefoil inside oculus
 * 5. Validate containment / clearance — report failure if unsolvable
 *
 * All elements rebuild from parent span / rise — no hardcoded world coordinates.
 */

import { ARCH_FAMILIES, DEFAULT_ARCH_PARAMS } from '../primitives/archFamilies.js'
import { ARCH_SEMANTICS } from '../primitives/archFamilies.js'
import { buildLancetSubdivision, DEFAULT_SUBDIVISION_PARAMS } from './lancetSubdivision.js'
import { solveOculusCenterY } from './oculus.js'
import { buildQuatrefoil, buildTrefoil, foilInsideCircle } from './foils.js'
import { circleInsideArch } from './archContainment.js'
import { createCircle } from '../kernel/circle2.js'
import { point } from '../kernel/vector2.js'
import {
  createTraceryElement,
  createTraceryGraph,
  addElement,
  finalizeGraph,
  markGraphInvalid,
} from './graph.js'
import { TRACERY_ROLES, TRACERY_ELEMENT_TYPES, FOIL_TYPES } from './roles.js'

export const DEFAULT_COMPOSED_PARAMS = Object.freeze({
  family: DEFAULT_ARCH_PARAMS.family,
  span: DEFAULT_ARCH_PARAMS.span,
  riseRatio: DEFAULT_ARCH_PARAMS.riseRatio,
  springingY: DEFAULT_ARCH_PARAMS.springingY,
  samplingQuality: DEFAULT_ARCH_PARAMS.samplingQuality,
  subdivisionRatio: 0.5,
  mullionWidth: 0.16,
  jambInset: 0.08,
  childRiseRatio: 1.08,
  childFamily: ARCH_FAMILIES.lancet,
  symmetric: true,
  containmentMargin: 0.01,
  oculusHeightRatio: 0.78,
  oculusRadiusRatio: 0.9,
  oculusClearance: 0.045,
  foilType: FOIL_TYPES.quatrefoil,
  foilScale: 0.86,
  cuspDepth: 0.7,
  foilRotation: 0,
  foilOrientation: 0,
})

/**
 * Build TWO LANCETS + UPPER FOIL composed window graph.
 */
export function buildComposedWindow(params = {}) {
  const p = { ...DEFAULT_COMPOSED_PARAMS, ...params }

  const subdivision = buildLancetSubdivision({
    ...DEFAULT_SUBDIVISION_PARAMS,
    family: p.family,
    span: p.span,
    riseRatio: p.riseRatio,
    springingY: p.springingY,
    samplingQuality: p.samplingQuality,
    subdivisionRatio: p.subdivisionRatio,
    mullionWidth: p.mullionWidth,
    jambInset: p.jambInset,
    childRiseRatio: p.childRiseRatio,
    childFamily: p.childFamily,
    symmetric: p.symmetric,
    containmentMargin: p.containmentMargin,
  })

  if (!subdivision.validation?.ok) {
    return finalizeFailedComposition(p, subdivision, [
      'Lancet subdivision failed — cannot compose window',
      ...(subdivision.validation?.errors ?? []),
    ])
  }

  const parent = subdivision.metadata.parent
  const leftChild = subdivision.metadata.leftChild
  const rightChild = subdivision.metadata.rightChild
  const leftApex = leftChild.points[ARCH_SEMANTICS.APEX]
  const rightApex = rightChild.points[ARCH_SEMANTICS.APEX]
  const lowerBoundY =
    Math.max(leftApex?.y ?? 0, rightApex?.y ?? 0) + p.oculusClearance

  const solved = solveOculusCenterY(parent, p.oculusHeightRatio, p.oculusClearance, lowerBoundY)
  if (!solved.ok) {
    return finalizeFailedComposition(p, subdivision, [
      'No valid upper oculus placement above child lancets (constraint failure)',
      solved.reason ?? 'empty_band',
    ])
  }

  const center = point(solved.offsetX ?? 0, solved.y)
  const roomAboveLancets = center.y - lowerBoundY
  const radius = Math.min(
    solved.maxRadius * Math.min(1, Math.max(0.05, p.oculusRadiusRatio)),
    Math.max(0, roomAboveLancets),
  )
  if (!(radius > p.oculusClearance)) {
    return finalizeFailedComposition(p, subdivision, [
      'Upper oculus cannot fit above child lancets with required clearance (constraint failure)',
    ])
  }

  const circle = createCircle(center, radius)
  const containment = circleInsideArch(parent, circle, p.oculusClearance)
  if (!containment.ok) {
    return finalizeFailedComposition(p, subdivision, [
      'Oculus fails containment inside parent arch',
    ])
  }
  if (center.y - radius < lowerBoundY - 1e-6) {
    return finalizeFailedComposition(p, subdivision, [
      'Oculus intersects child lancet region (constraint failure)',
    ])
  }

  return assembleComposition(p, subdivision, parent, circle, center, radius, solved, lowerBoundY)
}

function assembleComposition(p, subdivision, parent, circle, center, radius, solved, lowerBoundY) {
  const foilSize = radius * Math.min(1, Math.max(0.2, p.foilScale))
  const foilParams = {
    size: foilSize,
    cuspDepth: p.cuspDepth,
    rotation: p.foilRotation,
    orientation: p.foilOrientation,
    centerX: center.x,
    centerY: center.y,
    samplingQuality: p.samplingQuality,
  }

  const foil =
    p.foilType === FOIL_TYPES.trefoil
      ? buildTrefoil(foilParams)
      : buildQuatrefoil({ ...foilParams, orientation: p.foilOrientation ?? 0 })

  if (!foil.validation?.ok) {
    return finalizeFailedComposition(p, subdivision, foil.validation?.errors ?? ['Foil invalid'], {
      oculus: { circle, center, radius },
    })
  }

  const foilIn = foilInsideCircle(foil, circle, p.oculusClearance * 0.2)
  if (!foilIn.ok) {
    return finalizeFailedComposition(p, subdivision, ['Foil does not fit inside oculus'], {
      oculus: { circle, center, radius },
      foil,
    })
  }

  // Start from subdivision graph and add oculus + foil
  let graph = {
    ...subdivision,
    type: 'traceryGraph',
    parameters: { ...p },
    derived: {
      ...subdivision.derived,
      oculusCenterY: center.y,
      oculusRadius: radius,
      oculusMaxRadius: solved.maxRadius,
      lowerBoundY,
      foilType: p.foilType,
    },
    metadata: {
      ...subdivision.metadata,
      title: 'Composed Window · Two Lancets + Upper Foil',
      mode: 'composed-window',
      references: ['REF-011', 'REF-008', 'REF-006', 'REF-007', 'REF-009'],
      oculus: { circle, center, radius },
      foil,
      preset: 'TWO_LANCETS_UPPER_QUATREFOIL',
    },
  }

  const oculusEl = createTraceryElement({
    id: 'upper-oculus',
    type: TRACERY_ELEMENT_TYPES.oculus,
    role: TRACERY_ROLES.UPPER_OCULUS,
    parentId: 'parent-arch',
    geometry: {
      circles: [circle],
      samples: sampleCircle(circle, 64),
      points: { center: { ...center, label: 'O' } },
    },
    parameters: {
      heightRatio: p.oculusHeightRatio,
      radiusRatio: p.oculusRadiusRatio,
      clearance: p.oculusClearance,
    },
    derived: { radius, maxRadius: solved.maxRadius, centerY: center.y, lowerBoundY },
    constraints: [
      { type: 'oculus_containment', ok: true },
      { type: 'above_lancets', ok: center.y - radius >= lowerBoundY - 1e-6 },
    ],
    validation: { ok: true, errors: [] },
  })

  const foilRole =
    foil.foilType === FOIL_TYPES.trefoil ? TRACERY_ROLES.TREFOIL : TRACERY_ROLES.QUATREFOIL
  const foilEl = createTraceryElement({
    id: 'upper-foil',
    type: TRACERY_ELEMENT_TYPES.foil,
    role: foilRole,
    parentId: 'upper-oculus',
    geometry: {
      arcs: foil.arcs,
      circles: foil.circles,
      samples: foil.samples,
      cusps: foil.cusps,
      enclosing: foil.enclosing,
      points: Object.fromEntries(foil.cusps.map((c, i) => [`cusp${i}`, { ...c, label: `K${i}` }])),
    },
    parameters: foil.parameters,
    derived: foil.derived,
    validation: foil.validation,
  })

  graph = addElement(graph, oculusEl)
  graph = addElement(graph, foilEl)
  graph.constraints = [
    ...(subdivision.constraints ?? []),
    { type: 'oculus_containment', ok: true },
    { type: 'foil_in_oculus', ok: foilIn.ok },
    { type: 'above_lancets', ok: center.y - radius >= lowerBoundY - 1e-6 },
  ]
  return finalizeGraph(graph)
}

function finalizeFailedComposition(params, subdivision, errors, extraMeta = {}) {
  let graph = createTraceryGraph({
    parameters: params,
    elements: { ...(subdivision?.elements ?? {}) },
    rootId: subdivision?.rootId ?? null,
    derived: { ...(subdivision?.derived ?? {}) },
    metadata: {
      title: 'Composed Window (invalid)',
      mode: 'composed-window',
      references: ['REF-011', 'REF-008'],
      parent: subdivision?.metadata?.parent,
      leftChild: subdivision?.metadata?.leftChild,
      rightChild: subdivision?.metadata?.rightChild,
      mullion: subdivision?.metadata?.mullion,
      ...extraMeta,
    },
  })
  graph = markGraphInvalid(graph, errors[0] ?? 'composition constraint failure')
  graph.validation.errors = [...new Set(errors)]
  return graph
}

function sampleCircle(circle, n) {
  const pts = []
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    pts.push({
      x: circle.center.x + Math.cos(a) * circle.radius,
      y: circle.center.y + Math.sin(a) * circle.radius,
    })
  }
  return pts
}

/** Standalone foil example graphs (no parent arch). */
export function buildFoilExample(foilType, params = {}) {
  const size = params.size ?? 1.2
  const foil =
    foilType === FOIL_TYPES.trefoil
      ? buildTrefoil({
          size,
          cuspDepth: params.cuspDepth ?? 0.55,
          rotation: params.foilRotation ?? 0,
          centerX: 0,
          centerY: size * 0.15,
          samplingQuality: params.samplingQuality ?? 0.65,
        })
      : buildQuatrefoil({
          size,
          cuspDepth: params.cuspDepth ?? 0.55,
          rotation: params.foilRotation ?? 0,
          orientation: params.foilOrientation ?? 0,
          centerX: 0,
          centerY: size * 0.1,
          samplingQuality: params.samplingQuality ?? 0.65,
        })

  let graph = createTraceryGraph({
    parameters: { foilType, ...params, size },
    derived: foil.derived,
    metadata: {
      title: foil.metadata?.title ?? 'Foil',
      mode: foilType === FOIL_TYPES.trefoil ? 'trefoil' : 'quatrefoil',
      references: ['REF-006', 'REF-011'],
      foil,
    },
  })

  const role = foilType === FOIL_TYPES.trefoil ? TRACERY_ROLES.TREFOIL : TRACERY_ROLES.QUATREFOIL
  const el = createTraceryElement({
    id: 'foil',
    type: TRACERY_ELEMENT_TYPES.foil,
    role,
    geometry: {
      arcs: foil.arcs,
      circles: foil.circles,
      samples: foil.samples,
      cusps: foil.cusps,
      enclosing: foil.enclosing,
      points: {
        center: { ...foil.center, label: 'C' },
        ...Object.fromEntries(foil.cusps.map((c, i) => [`cusp${i}`, { ...c, label: `K${i}` }])),
        ...Object.fromEntries(
          foil.lobeCenters.map((c, i) => [`lobe${i}`, { ...c, label: `L${i}`, role: 'center' }]),
        ),
      },
    },
    parameters: foil.parameters,
    derived: foil.derived,
    validation: foil.validation,
  })

  // Opening boundary element
  const opening = createTraceryElement({
    id: 'opening-boundary',
    type: TRACERY_ELEMENT_TYPES.opening,
    role: TRACERY_ROLES.OPENING_BOUNDARY,
    parentId: el.id,
    geometry: { arcs: foil.arcs, samples: foil.samples },
    validation: foil.validation,
  })

  graph = addElement(graph, el)
  graph = addElement(graph, opening)
  graph = { ...graph, rootId: el.id }
  if (!foil.validation?.ok) {
    graph = markGraphInvalid(graph, foil.validation.errors?.[0] ?? 'invalid foil')
  }
  return finalizeGraph(graph)
}

