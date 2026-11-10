/**
 * Primary lancet subdivision — parent pointed arch → two child lancets (Step 13C).
 *
 * Informed by REF-008 (mullion axes / twin lancets) and REF-011 (hierarchical bars).
 * Children are generated through buildPointedArch — no duplicate arch math.
 */

import { point } from '../kernel/vector2.js'
import { createSegment } from '../kernel/line2.js'
import { buildPointedArch } from '../primitives/pointedArch.js'
import { ARCH_FAMILIES, ARCH_SEMANTICS, DEFAULT_ARCH_PARAMS } from '../primitives/archFamilies.js'
import {
  archOutlineInsideParent,
  mullionClearance,
  pointInsideArchOpening,
} from './archContainment.js'
import {
  createTraceryElement,
  createTraceryGraph,
  addElement,
  finalizeGraph,
  markGraphInvalid,
} from './graph.js'
import { TRACERY_ROLES, TRACERY_ELEMENT_TYPES } from './roles.js'

export const DEFAULT_SUBDIVISION_PARAMS = Object.freeze({
  family: DEFAULT_ARCH_PARAMS.family,
  span: DEFAULT_ARCH_PARAMS.span,
  riseRatio: DEFAULT_ARCH_PARAMS.riseRatio,
  springingY: DEFAULT_ARCH_PARAMS.springingY,
  samplingQuality: DEFAULT_ARCH_PARAMS.samplingQuality,
  /** Left clear-width fraction of (span − mullion − 2·jambInset). 0.5 = symmetric. */
  subdivisionRatio: 0.5,
  /** Mullion thickness (meters). */
  mullionWidth: 0.18,
  /**
   * Inset from parent jambs (meters). Prevents child arcs from crossing the
   * parent near shared springings (REF-008 shows outer frame / bar thickness).
   */
  jambInset: 0.08,
  /** Minimum child span (meters). */
  minChildSpan: 0.35,
  /** Child rise / child span. */
  childRiseRatio: 1.05,
  childFamily: ARCH_FAMILIES.lancet,
  /** Absolute child springing elevation; defaults to parent springing. */
  childSpringingY: null,
  symmetric: true,
  /** Inward clearance from parent upper boundary (meters). */
  containmentMargin: 0.01,
})

/**
 * Subdivide one parent pointed arch into two child lancets.
 */
export function buildLancetSubdivision(params = {}) {
  const p = { ...DEFAULT_SUBDIVISION_PARAMS, ...params }
  const errors = []

  if (!(p.span > 0)) errors.push('Parent span must be positive')
  if (!(p.mullionWidth > 0)) errors.push('Mullion width must be positive')
  if (p.mullionWidth >= p.span) errors.push('Mullion width must be less than parent span')
  const jambInset = Math.max(0, p.jambInset ?? 0)
  if (2 * jambInset + p.mullionWidth >= p.span) {
    errors.push('Jamb inset + mullion leave no clear width for children')
  }

  const ratio = p.symmetric ? 0.5 : p.subdivisionRatio
  if (!(ratio > 0 && ratio < 1)) errors.push('Subdivision ratio must be in (0, 1)')

  const clear = p.span - p.mullionWidth - 2 * jambInset
  if (!(clear > 0)) errors.push('Clear width after mullion and jamb insets must be positive')

  if (errors.length) {
    return emptySubdivision(p, errors)
  }

  const leftClear = ratio * clear
  const rightClear = (1 - ratio) * clear
  const minChild = p.minChildSpan ?? 0.35
  if (!(leftClear >= minChild) || !(rightClear >= minChild)) {
    return emptySubdivision(p, [
      `Child spans below minimum (${minChild} m) — reduce mullion/inset or increase parent span`,
    ])
  }

  // Parent local frame: springings at ±span/2; children inset from jambs
  const half = p.span / 2
  const leftBayLeft = -half + jambInset
  const leftBayRight = leftBayLeft + leftClear
  const rightBayLeft = leftBayRight + p.mullionWidth
  const rightBayRight = rightBayLeft + rightClear

  const gap = mullionClearance(leftBayRight, rightBayLeft)
  if (gap < p.mullionWidth - 1e-12) {
    return emptySubdivision(p, [`Mullion clearance invalid: ${gap}`])
  }
  // Children should not overlap: gap must equal mullion width
  if (Math.abs(gap - p.mullionWidth) > 1e-9) {
    return emptySubdivision(p, ['Child openings overlap or leave unexpected gap'])
  }
  if (Math.abs(rightBayRight - (half - jambInset)) > 1e-9) {
    return emptySubdivision(p, ['Bay layout does not match parent clear width'])
  }

  const leftSpan = leftClear
  const rightSpan = rightClear
  const leftCenterX = (leftBayLeft + leftBayRight) / 2
  const rightCenterX = (rightBayLeft + rightBayRight) / 2
  const childSpringingY =
    p.childSpringingY == null ? p.springingY : p.childSpringingY

  const parent = buildPointedArch({
    family: p.family,
    span: p.span,
    riseRatio: p.riseRatio,
    springingY: p.springingY,
    samplingQuality: p.samplingQuality,
    offsetX: 0,
  })

  if (!parent.validation?.ok) {
    return emptySubdivision(p, parent.validation?.errors ?? ['Parent arch invalid'])
  }

  if (childSpringingY < p.springingY - 1e-12) {
    return emptySubdivision(p, ['Child springing cannot be below parent springing'])
  }
  if (childSpringingY >= p.springingY + parent.parameters.rise - 1e-6) {
    return emptySubdivision(p, ['Child springing leaves no room for child rise'])
  }

  const leftChild = buildPointedArch({
    family: p.childFamily,
    span: leftSpan,
    riseRatio: p.childRiseRatio,
    springingY: childSpringingY,
    samplingQuality: p.samplingQuality,
    offsetX: leftCenterX,
  })
  const rightChild = buildPointedArch({
    family: p.childFamily,
    span: rightSpan,
    riseRatio: p.childRiseRatio,
    springingY: childSpringingY,
    samplingQuality: p.samplingQuality,
    offsetX: rightCenterX,
  })

  const childErrors = []
  if (!leftChild.validation?.ok) {
    childErrors.push(...(leftChild.validation?.errors ?? ['Left child invalid']))
  }
  if (!rightChild.validation?.ok) {
    childErrors.push(...(rightChild.validation?.errors ?? ['Right child invalid']))
  }

  const margin = Math.max(0, p.containmentMargin)
  const leftIn = archOutlineInsideParent(leftChild, parent, margin)
  const rightIn = archOutlineInsideParent(rightChild, parent, margin)
  if (!leftIn.ok) childErrors.push('Left child crosses or exits parent boundary')
  if (!rightIn.ok) childErrors.push('Right child crosses or exits parent boundary')

  // Child openings must not overlap: check left apex/right springings separation
  const leftA = leftChild.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const rightA = rightChild.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  if (leftA && rightA && leftA.x > rightA.x - 1e-9) {
    childErrors.push('Child openings overlap horizontally')
  }

  // Mullion axis segment (centerline)
  const mullionX = (leftBayRight + rightBayLeft) / 2
  const parentApex = parent.points[ARCH_SEMANTICS.APEX]
  const mullionTopY = Math.min(
    parentApex?.y ?? childSpringingY + 1,
    Math.max(
      leftChild.points[ARCH_SEMANTICS.APEX]?.y ?? childSpringingY,
      rightChild.points[ARCH_SEMANTICS.APEX]?.y ?? childSpringingY,
    ) + (parent.parameters.rise - (childSpringingY - p.springingY)) * 0.15,
  )
  // Extend mullion toward parent apex for visualization, clamped inside parent
  let mullionTop = point(mullionX, Math.max(childSpringingY + 0.1, mullionTopY))
  // Prefer rising to just below the residual upper region
  const targetTop = (leftChild.points[ARCH_SEMANTICS.APEX].y + rightChild.points[ARCH_SEMANTICS.APEX].y) / 2
  mullionTop = point(mullionX, targetTop)
  if (!pointInsideArchOpening(parent, mullionTop, margin * 0.5)) {
    // Walk down until inside
    let y = targetTop
    while (y > childSpringingY && !pointInsideArchOpening(parent, point(mullionX, y), margin * 0.5)) {
      y -= 0.02
    }
    mullionTop = point(mullionX, y)
  }
  const mullionSeg = createSegment(point(mullionX, childSpringingY), mullionTop)

  const derived = {
    clearWidth: clear,
    leftClear,
    rightClear,
    leftSpan,
    rightSpan,
    leftCenterX,
    rightCenterX,
    mullionX,
    mullionClearance: gap,
    jambInset,
    subdivisionRatio: ratio,
    symmetric: p.symmetric || Math.abs(ratio - 0.5) < 1e-12,
  }

  let graph = createTraceryGraph({
    parameters: { ...p, subdivisionRatio: ratio },
    derived,
    metadata: {
      title: 'Lancet Subdivision',
      references: ['REF-008', 'REF-011', 'REF-007'],
      mode: 'lancet-subdivision',
    },
  })

  const parentEl = createTraceryElement({
    id: 'parent-arch',
    type: TRACERY_ELEMENT_TYPES.pointedArch,
    role: TRACERY_ROLES.PARENT_ARCH,
    geometry: {
      arch: parent,
      arcs: Object.values(parent.arcs ?? {}),
      circles: Object.values(parent.circles ?? {}),
      samples: [...(parent.samples?.left ?? []), ...(parent.samples?.right ?? [])],
      points: parent.points,
    },
    parameters: parent.parameters,
    derived: parent.derived,
    validation: parent.validation,
  })

  const mullionEl = createTraceryElement({
    id: 'primary-mullion',
    type: TRACERY_ELEMENT_TYPES.mullion,
    role: TRACERY_ROLES.PRIMARY_MULLION,
    parentId: parentEl.id,
    geometry: {
      segments: [mullionSeg],
      samples: [mullionSeg.a, mullionSeg.b],
      points: {
        base: { ...mullionSeg.a, label: 'M₀' },
        top: { ...mullionSeg.b, label: 'M₁' },
      },
    },
    parameters: { width: p.mullionWidth, centerX: mullionX },
    derived: { clearance: gap },
    constraints: [
      { type: 'mullion_clearance', value: gap, ok: gap > 0 },
      { type: 'on_axis', ok: p.symmetric ? Math.abs(mullionX) < 1e-9 : true },
    ],
    validation: { ok: gap > 0, errors: gap > 0 ? [] : ['Non-positive mullion clearance'] },
  })

  const leftEl = createTraceryElement({
    id: 'child-lancet-left',
    type: TRACERY_ELEMENT_TYPES.pointedArch,
    role: TRACERY_ROLES.CHILD_LANCET,
    parentId: parentEl.id,
    geometry: {
      arch: leftChild,
      arcs: Object.values(leftChild.arcs ?? {}),
      circles: Object.values(leftChild.circles ?? {}),
      samples: [...(leftChild.samples?.left ?? []), ...(leftChild.samples?.right ?? [])],
      points: leftChild.points,
    },
    parameters: leftChild.parameters,
    derived: { ...leftChild.derived, bay: 'left' },
    constraints: [{ type: 'containment', ok: leftIn.ok, violations: leftIn.violations }],
    validation: {
      ok: leftChild.validation?.ok && leftIn.ok,
      errors: [
        ...(leftChild.validation?.ok ? [] : leftChild.validation?.errors ?? []),
        ...(leftIn.ok ? [] : ['Left child containment failed']),
      ],
    },
  })

  const rightEl = createTraceryElement({
    id: 'child-lancet-right',
    type: TRACERY_ELEMENT_TYPES.pointedArch,
    role: TRACERY_ROLES.CHILD_LANCET,
    parentId: parentEl.id,
    geometry: {
      arch: rightChild,
      arcs: Object.values(rightChild.arcs ?? {}),
      circles: Object.values(rightChild.circles ?? {}),
      samples: [...(rightChild.samples?.left ?? []), ...(rightChild.samples?.right ?? [])],
      points: rightChild.points,
    },
    parameters: rightChild.parameters,
    derived: { ...rightChild.derived, bay: 'right' },
    constraints: [{ type: 'containment', ok: rightIn.ok, violations: rightIn.violations }],
    validation: {
      ok: rightChild.validation?.ok && rightIn.ok,
      errors: [
        ...(rightChild.validation?.ok ? [] : rightChild.validation?.errors ?? []),
        ...(rightIn.ok ? [] : ['Right child containment failed']),
      ],
    },
  })

  graph = addElement(graph, parentEl)
  graph = addElement(graph, mullionEl)
  graph = addElement(graph, leftEl)
  graph = addElement(graph, rightEl)
  graph = { ...graph, rootId: parentEl.id }

  graph.constraints = [
    { type: 'mullion_clearance', value: gap, ok: gap > 0 },
    { type: 'left_containment', ok: leftIn.ok },
    { type: 'right_containment', ok: rightIn.ok },
    { type: 'no_child_overlap', ok: leftA.x <= rightA.x + 1e-9 },
  ]

  if (childErrors.length) {
    graph = markGraphInvalid(graph, childErrors[0])
    graph = {
      ...graph,
      validation: {
        ...graph.validation,
        ok: false,
        errors: [...new Set([...(graph.validation.errors ?? []), ...childErrors])],
      },
    }
  }

  graph = finalizeGraph(graph)
  graph.metadata = {
    ...graph.metadata,
    parent,
    leftChild,
    rightChild,
    mullion: { segment: mullionSeg, width: p.mullionWidth, x: mullionX },
  }
  return graph
}

function emptySubdivision(params, errors) {
  let graph = createTraceryGraph({
    parameters: params,
    metadata: { title: 'Lancet Subdivision (invalid)', mode: 'lancet-subdivision' },
  })
  graph = markGraphInvalid(graph, errors[0] ?? 'invalid subdivision')
  graph.validation.errors = errors
  return graph
}
