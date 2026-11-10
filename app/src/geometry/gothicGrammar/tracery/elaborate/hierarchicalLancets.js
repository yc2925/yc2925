/**
 * Primary + nested secondary lancet hierarchy (Step 13D.4).
 *
 * Nesting depth 1 → two primary openings.
 * Nesting depth 2 → each primary splits into two subsidiary lights (four-light field).
 * Subsidiary arches divide the parent void into closed opening regions (REF-008).
 */

import { point } from '../../kernel/vector2.js'
import { createCircle } from '../../kernel/circle2.js'
import { buildPointedArch } from '../../primitives/pointedArch.js'
import { ARCH_FAMILIES, ARCH_SEMANTICS } from '../../primitives/archFamilies.js'
import { buildLancetSubdivision, DEFAULT_SUBDIVISION_PARAMS } from '../lancetSubdivision.js'
import { archOutlineInsideParent, circleInsideArch } from '../archContainment.js'
import { closedLoopFromArch, ensureCw } from '../openingLoops.js'
import { circleToCwLoop } from '../spandrelOpenings.js'
import { buildTrefoil, foilInsideCircle } from '../foils.js'
import { archHalfWidthAtY } from './architecturalConstraints.js'

const SAMPLE_OPTS = { segments: 24 }

/**
 * Subdivide one field arch (may be offset) into two child lancets.
 * Extends the Step 13C bay layout with an explicit field offsetX.
 */
export function subdivideArchField(fieldArch, opts = {}) {
  const span = fieldArch.parameters.span
  const ox = fieldArch.parameters.offsetX ?? 0
  const springingY = fieldArch.parameters.springingY
  const mullionWidth = opts.mullionWidth ?? 0.06
  const jambInset = Math.max(0, opts.jambInset ?? 0.02)
  const childRiseRatio = opts.childRiseRatio ?? 1.05
  const childFamily = opts.childFamily ?? ARCH_FAMILIES.lancet
  const minChildSpan = opts.minChildSpan ?? 0.18
  const samplingQuality = opts.samplingQuality ?? fieldArch.parameters.samplingQuality ?? 0.65
  const containmentMargin = opts.containmentMargin ?? 0.008

  if (!(span > mullionWidth + 2 * jambInset + minChildSpan * 2)) {
    return {
      ok: false,
      errors: [`field span ${span.toFixed(3)} too narrow for secondary subdivision`],
      leftChild: null,
      rightChild: null,
    }
  }

  const clear = span - mullionWidth - 2 * jambInset
  const leftClear = clear * 0.5
  const rightClear = clear * 0.5
  const half = span / 2
  const leftBayLeft = -half + jambInset
  const leftBayRight = leftBayLeft + leftClear
  const rightBayLeft = leftBayRight + mullionWidth
  const rightBayRight = rightBayLeft + rightClear
  const leftCenterX = ox + (leftBayLeft + leftBayRight) / 2
  const rightCenterX = ox + (rightBayLeft + rightBayRight) / 2

  const leftChild = buildPointedArch({
    family: childFamily,
    span: leftClear,
    riseRatio: childRiseRatio,
    springingY,
    samplingQuality,
    offsetX: leftCenterX,
  })
  const rightChild = buildPointedArch({
    family: childFamily,
    span: rightClear,
    riseRatio: childRiseRatio,
    springingY,
    samplingQuality,
    offsetX: rightCenterX,
  })

  const errors = []
  if (!leftChild.validation?.ok) errors.push(...(leftChild.validation?.errors ?? ['left secondary invalid']))
  if (!rightChild.validation?.ok) {
    errors.push(...(rightChild.validation?.errors ?? ['right secondary invalid']))
  }

  const leftIn = archOutlineInsideParent(leftChild, fieldArch, containmentMargin)
  const rightIn = archOutlineInsideParent(rightChild, fieldArch, containmentMargin)
  if (!leftIn.ok) errors.push('left secondary escapes field arch')
  if (!rightIn.ok) errors.push('right secondary escapes field arch')

  return {
    ok: errors.length === 0,
    errors,
    fieldArch,
    leftChild,
    rightChild,
    mullionWidth,
    jambInset,
    mullionX: ox,
    derived: { leftClear, rightClear, leftCenterX, rightCenterX, clear },
  }
}

/**
 * Build hierarchical lancet openings for Zone A.
 *
 * @returns {{ ok, openings, primary, nested, warnings, errors, metrics }}
 */
export function buildHierarchicalLancets(params = {}) {
  const nestingDepth = Math.min(2, Math.max(1, Math.round(params.nestingDepth ?? 2)))
  const baseY = params.windowBaseElevation ?? -0.35
  const warnings = []
  const errors = []

  const primary = buildLancetSubdivision({
    ...DEFAULT_SUBDIVISION_PARAMS,
    family: params.family,
    span: params.span,
    riseRatio: params.riseRatio,
    springingY: params.springingY,
    samplingQuality: params.samplingQuality,
    subdivisionRatio: params.subdivisionRatio ?? 0.5,
    mullionWidth: params.mullionWidth ?? 0.09,
    jambInset: params.jambInset ?? 0.04,
    childRiseRatio: params.childRiseRatio ?? 1.1,
    childFamily: params.childFamily ?? ARCH_FAMILIES.lancet,
    symmetric: params.symmetric !== false,
    containmentMargin: params.containmentMargin ?? 0.01,
    minChildSpan: params.minChildSpan ?? 0.35,
  })

  if (!primary.validation?.ok) {
    return {
      ok: false,
      openings: [],
      primary,
      nested: null,
      errors: primary.validation?.errors ?? ['primary subdivision failed'],
      warnings,
      nestingDepth,
    }
  }

  const leftPrimary = primary.metadata.leftChild
  const rightPrimary = primary.metadata.rightChild
  const openings = []
  let nested = { left: null, right: null }

  if (nestingDepth < 2) {
    const leftLoop = closedLoopFromArch(leftPrimary, baseY)
    const rightLoop = closedLoopFromArch(rightPrimary, baseY)
    if (!leftLoop.ok || !rightLoop.ok) {
      return {
        ok: false,
        openings: [],
        primary,
        nested: null,
        errors: [...(leftLoop.errors ?? []), ...(rightLoop.errors ?? [])],
        warnings,
        nestingDepth,
      }
    }
    openings.push(
      {
        id: 'LEFT_PRIMARY_LANCET',
        type: 'LEFT_PRIMARY_LANCET',
        zone: 'ZONE_A_LOWER_LANCET_FIELD',
        level: 1,
        edges: ensureCw(leftLoop.edges, SAMPLE_OPTS).edges,
        arch: leftPrimary,
        memberClass: 'PRIMARY_ARCH_BAR',
      },
      {
        id: 'RIGHT_PRIMARY_LANCET',
        type: 'RIGHT_PRIMARY_LANCET',
        zone: 'ZONE_A_LOWER_LANCET_FIELD',
        level: 1,
        edges: ensureCw(rightLoop.edges, SAMPLE_OPTS).edges,
        arch: rightPrimary,
        memberClass: 'PRIMARY_ARCH_BAR',
      },
    )
  } else {
    const secMullion = params.secondaryMullionWidth ?? Math.max(0.035, (params.mullionWidth ?? 0.09) * 0.55)
    const secJamb = params.secondaryJambInset ?? Math.max(0.015, secMullion * 0.35)
    const secRise = params.secondaryLancetRatio ?? 1.08

    const leftNest = subdivideArchField(leftPrimary, {
      mullionWidth: secMullion,
      jambInset: secJamb,
      childRiseRatio: secRise,
      childFamily: ARCH_FAMILIES.lancet,
      samplingQuality: params.samplingQuality,
      minChildSpan: Math.max(0.16, leftPrimary.parameters.span * 0.22),
    })
    const rightNest = subdivideArchField(rightPrimary, {
      mullionWidth: secMullion,
      jambInset: secJamb,
      childRiseRatio: secRise,
      childFamily: ARCH_FAMILIES.lancet,
      samplingQuality: params.samplingQuality,
      minChildSpan: Math.max(0.16, rightPrimary.parameters.span * 0.22),
    })

    nested = { left: leftNest, right: rightNest, secondaryMullionWidth: secMullion }

    if (!leftNest.ok || !rightNest.ok) {
      // Fallback: use primary openings (still valid hierarchy depth 1)
      warnings.push(
        `Secondary nesting failed — fallback to primary lancets: ${[
          ...(leftNest.errors ?? []),
          ...(rightNest.errors ?? []),
        ].join('; ')}`,
      )
      const leftLoop = closedLoopFromArch(leftPrimary, baseY)
      const rightLoop = closedLoopFromArch(rightPrimary, baseY)
      if (!leftLoop.ok || !rightLoop.ok) {
        return {
          ok: false,
          openings: [],
          primary,
          nested,
          errors: [...(leftLoop.errors ?? []), ...(rightLoop.errors ?? [])],
          warnings,
          nestingDepth,
        }
      }
      openings.push(
        {
          id: 'LEFT_PRIMARY_LANCET',
          type: 'LEFT_PRIMARY_LANCET',
          zone: 'ZONE_A_LOWER_LANCET_FIELD',
          level: 1,
          edges: ensureCw(leftLoop.edges, SAMPLE_OPTS).edges,
          arch: leftPrimary,
          memberClass: 'PRIMARY_ARCH_BAR',
        },
        {
          id: 'RIGHT_PRIMARY_LANCET',
          type: 'RIGHT_PRIMARY_LANCET',
          zone: 'ZONE_A_LOWER_LANCET_FIELD',
          level: 1,
          edges: ensureCw(rightLoop.edges, SAMPLE_OPTS).edges,
          arch: rightPrimary,
          memberClass: 'PRIMARY_ARCH_BAR',
        },
      )
    } else {
      const pairs = [
        ['LEFT_OUTER_SECONDARY', leftNest.leftChild, 'LEFT'],
        ['LEFT_INNER_SECONDARY', leftNest.rightChild, 'LEFT'],
        ['RIGHT_INNER_SECONDARY', rightNest.leftChild, 'RIGHT'],
        ['RIGHT_OUTER_SECONDARY', rightNest.rightChild, 'RIGHT'],
      ]
      for (const [id, arch] of pairs) {
        const loop = closedLoopFromArch(arch, baseY)
        if (!loop.ok) {
          errors.push(...(loop.errors ?? [`${id} loop failed`]))
          continue
        }
        openings.push({
          id,
          type: id,
          zone: 'ZONE_A_LOWER_LANCET_FIELD',
          level: 2,
          edges: ensureCw(loop.edges, SAMPLE_OPTS).edges,
          arch,
          memberClass: 'SECONDARY_ARCH_BAR',
          parentField: arch.parameters.offsetX < 0 ? 'left-primary' : 'right-primary',
        })
      }
      if (openings.length !== 4) {
        return {
          ok: false,
          openings: [],
          primary,
          nested,
          errors: errors.length ? errors : ['secondary openings incomplete'],
          warnings,
          nestingDepth,
        }
      }

      // REF-008: foil / circular opening in each primary lancet head above nested lights
      const headOpenings = buildPrimaryHeadOpenings({
        leftPrimary,
        rightPrimary,
        leftNest,
        rightNest,
        web: Math.max(0.02, secMullion * 0.55),
        foilScale: params.foilScale ?? 0.82,
        cuspDepth: params.cuspDepth ?? 0.5,
        samplingQuality: params.samplingQuality,
      })
      warnings.push(...(headOpenings.warnings ?? []))
      openings.push(...headOpenings.openings)
    }
  }

  return {
    ok: errors.length === 0 && openings.length >= 2,
    openings,
    primary,
    nested,
    warnings,
    errors,
    nestingDepth,
    parent: primary.metadata.parent,
    leftPrimary,
    rightPrimary,
    metrics: {
      openingCount: openings.length,
      nestingDepth,
      primaryMullionWidth: primary.parameters?.mullionWidth ?? params.mullionWidth,
    },
  }
}

/**
 * Circular / trefoil openings in primary lancet heads above secondary arches.
 * Prevents a solid slab between nested lights and the primary arch crown (REF-008).
 */
function buildPrimaryHeadOpenings({
  leftPrimary,
  rightPrimary,
  leftNest,
  rightNest,
  web,
  foilScale,
  cuspDepth,
  samplingQuality,
}) {
  const openings = []
  const warnings = []
  const fields = [
    {
      id: 'LEFT_PRIMARY_HEAD',
      field: leftPrimary,
      leftChild: leftNest.leftChild,
      rightChild: leftNest.rightChild,
    },
    {
      id: 'RIGHT_PRIMARY_HEAD',
      field: rightPrimary,
      leftChild: rightNest.leftChild,
      rightChild: rightNest.rightChild,
    },
  ]

  for (const { id, field, leftChild, rightChild } of fields) {
    const fieldApex = field.points?.[ARCH_SEMANTICS.APEX]
    const leftApex = leftChild?.points?.[ARCH_SEMANTICS.APEX]
    const rightApex = rightChild?.points?.[ARCH_SEMANTICS.APEX]
    if (!fieldApex || !leftApex || !rightApex) {
      warnings.push(`${id}: missing apexes for head opening`)
      continue
    }
    const lowerY = Math.max(leftApex.y, rightApex.y) + web * 0.85
    const upperY = fieldApex.y - web * 0.75
    const pocket = upperY - lowerY
    if (!(pocket > web * 2.2)) {
      warnings.push(`${id}: head pocket too small`)
      continue
    }
    const cy = (lowerY + upperY) / 2
    const ox = field.parameters.offsetX ?? 0
    const half = archHalfWidthAtY(field, cy)
    let r = Math.min(pocket * 0.42, half - web * 0.85, field.parameters.span * 0.22)
    if (!(r > web * 0.7)) {
      warnings.push(`${id}: head radius too small`)
      continue
    }
    const center = point(ox, cy)
    const circle = createCircle(center, r)
    const inside = circleInsideArch(field, circle, web * 0.35)
    if (!inside.ok) {
      // Shrink once toward valid fit
      r *= 0.82
      const retry = createCircle(center, r)
      if (!circleInsideArch(field, retry, web * 0.3).ok) {
        warnings.push(`${id}: head circle escapes primary field`)
        continue
      }
      Object.assign(circle, retry)
    }

    // Prefer a trefoil when it fits; else circular head opening
    const foilSize = r * Math.min(1, Math.max(0.5, foilScale))
    const foil = buildTrefoil({
      size: foilSize,
      cuspDepth,
      rotation: 0,
      orientation: Math.PI / 2,
      centerX: center.x,
      centerY: center.y,
      samplingQuality: samplingQuality ?? 0.65,
    })
    let edges
    let memberClass = 'FOIL_BAR'
    let source = 'primary-head-trefoil'
    if (foil.validation?.ok && foilInsideCircle(foil, circle, web * 0.1).ok) {
      edges = ensureCw(foil.arcs, SAMPLE_OPTS).edges
    } else {
      edges = circleToCwLoop(center, r * 0.92).edges
      memberClass = 'SECONDARY_ARCH_BAR'
      source = 'primary-head-circle'
      warnings.push(`${id}: trefoil unfit — circular head opening`)
    }
    openings.push({
      id,
      type: id,
      zone: 'ZONE_A_LOWER_LANCET_FIELD',
      level: 2,
      edges,
      center,
      radius: r,
      memberClass,
      source,
      parentField: ox < 0 ? 'left-primary' : 'right-primary',
    })
  }

  return { openings, warnings }
}

export { point, ARCH_SEMANTICS, buildPrimaryHeadOpenings }
