/**
 * Step 13E.4.3 — CONSTRUCTION_GEOMETRY contract.
 * Extracts structured anatomy metadata from generator outputs.
 * Visualization only — does not recompute arch / tracery mathematics.
 */

import { ARCH_SEMANTICS } from '../primitives/pointedArch.js'

function pt(p, role, id, sourceComponentId = null) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null
  return {
    id,
    x: p.x,
    y: p.y,
    role,
    sourceComponentId,
  }
}

function circleEntry(circle, id, sourceComponentId = null) {
  if (!circle?.center || !Number.isFinite(circle.radius)) return null
  return {
    id,
    center: { x: circle.center.x, y: circle.center.y },
    radius: circle.radius,
    sourceComponentId,
  }
}

function lineEntry(a, b, id, role = 'guide', sourceComponentId = null) {
  if (!a || !b) return null
  return {
    id,
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    role,
    sourceComponentId,
  }
}

function emptyConstructionGeometry(limitations = []) {
  return {
    constructionPoints: [],
    constructionLines: [],
    constructionCircles: [],
    constructionArcs: [],
    intersectionPoints: [],
    symmetryAxes: [],
    constraintGuides: [],
    sourceComponentIds: [],
    limitations,
  }
}

/**
 * Pointed-arch generator → CONSTRUCTION_GEOMETRY.
 */
export function extractArchConstructionGeometry(arch, sourceComponentId = 'pointed-arch') {
  if (!arch) return emptyConstructionGeometry(['arch unavailable'])

  const constructionPoints = []
  const constructionCircles = []
  const constructionLines = []
  const constructionArcs = []
  const intersectionPoints = []
  const symmetryAxes = []
  const constraintGuides = []
  const limitations = []
  const sourceComponentIds = [sourceComponentId]

  const A = arch.points?.[ARCH_SEMANTICS.LEFT_SPRINGING]
  const B = arch.points?.[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const P = arch.points?.[ARCH_SEMANTICS.APEX]
  const CA = arch.points?.[ARCH_SEMANTICS.LEFT_ARC_CENTER]
  const CB = arch.points?.[ARCH_SEMANTICS.RIGHT_ARC_CENTER]

  const a = pt(A, 'springing', `${sourceComponentId}:A`, sourceComponentId)
  const b = pt(B, 'springing', `${sourceComponentId}:B`, sourceComponentId)
  const apex = pt(P, 'apex', `${sourceComponentId}:P`, sourceComponentId)
  const ca = pt(CA, 'arc-center', `${sourceComponentId}:CA`, sourceComponentId)
  const cb = pt(CB, 'arc-center', `${sourceComponentId}:CB`, sourceComponentId)
  for (const p of [a, b, apex, ca, cb]) {
    if (p) constructionPoints.push(p)
  }
  if (apex) intersectionPoints.push({ ...apex, role: 'apex-intersection' })

  const leftCircle = circleEntry(arch.circles?.left, `${sourceComponentId}:circL`, sourceComponentId)
  const rightCircle = circleEntry(arch.circles?.right, `${sourceComponentId}:circR`, sourceComponentId)
  if (leftCircle) constructionCircles.push(leftCircle)
  else limitations.push('left construction circle unavailable')
  if (rightCircle) constructionCircles.push(rightCircle)
  else limitations.push('right construction circle unavailable')

  const leftArc = arch.arcs?.[ARCH_SEMANTICS.LEFT_ARC] ?? arch.arcs?.left
  const rightArc = arch.arcs?.[ARCH_SEMANTICS.RIGHT_ARC] ?? arch.arcs?.right
  if (leftArc) {
    constructionArcs.push({
      id: `${sourceComponentId}:arcL`,
      ...leftArc,
      sourceComponentId,
    })
  }
  if (rightArc) {
    constructionArcs.push({
      id: `${sourceComponentId}:arcR`,
      ...rightArc,
      sourceComponentId,
    })
  }

  if (CA && A) {
    const rad = lineEntry(CA, A, `${sourceComponentId}:radLA`, 'radius', sourceComponentId)
    if (rad) constructionLines.push(rad)
  }
  if (CA && P) {
    const rad = lineEntry(CA, P, `${sourceComponentId}:radLP`, 'radius', sourceComponentId)
    if (rad) constructionLines.push(rad)
  }
  if (CB && B) {
    const rad = lineEntry(CB, B, `${sourceComponentId}:radRB`, 'radius', sourceComponentId)
    if (rad) constructionLines.push(rad)
  }
  if (CB && P) {
    const rad = lineEntry(CB, P, `${sourceComponentId}:radRP`, 'radius', sourceComponentId)
    if (rad) constructionLines.push(rad)
  }

  if (arch.symmetryAxis) {
    const axis = lineEntry(
      arch.symmetryAxis.a,
      arch.symmetryAxis.b,
      `${sourceComponentId}:axis`,
      'symmetry',
      sourceComponentId,
    )
    if (axis) {
      symmetryAxes.push(axis)
      constructionLines.push(axis)
    }
  } else {
    limitations.push('symmetry axis unavailable')
  }

  if (A && B) {
    const spring = lineEntry(A, B, `${sourceComponentId}:springing`, 'constraint', sourceComponentId)
    if (spring) constraintGuides.push(spring)
  }

  return {
    constructionPoints,
    constructionLines,
    constructionCircles,
    constructionArcs,
    intersectionPoints,
    symmetryAxes,
    constraintGuides,
    sourceComponentIds,
    limitations,
  }
}

/**
 * Tracery graph metadata → CONSTRUCTION_GEOMETRY.
 */
export function extractTraceryConstructionGeometry(graph) {
  if (!graph) return emptyConstructionGeometry(['tracery graph unavailable'])

  const out = emptyConstructionGeometry()
  const meta = graph.metadata ?? {}
  const parent = meta.parent
  const leftChild = meta.leftChild
  const rightChild = meta.rightChild
  const mullion = meta.mullion
  const oculus = meta.oculus
  const foil = meta.foil

  const merge = (part) => {
    out.constructionPoints.push(...part.constructionPoints)
    out.constructionLines.push(...part.constructionLines)
    out.constructionCircles.push(...part.constructionCircles)
    out.constructionArcs.push(...part.constructionArcs)
    out.intersectionPoints.push(...part.intersectionPoints)
    out.symmetryAxes.push(...part.symmetryAxes)
    out.constraintGuides.push(...part.constraintGuides)
    out.sourceComponentIds.push(...part.sourceComponentIds)
    out.limitations.push(...part.limitations)
  }

  if (parent) merge(extractArchConstructionGeometry(parent, 'parent-arch'))
  else if (!foil) out.limitations.push('parent arch unavailable')

  if (leftChild) merge(extractArchConstructionGeometry(leftChild, 'left-child'))
  if (rightChild) merge(extractArchConstructionGeometry(rightChild, 'right-child'))

  if (mullion?.segment) {
    const m = lineEntry(
      mullion.segment.a,
      mullion.segment.b,
      'mullion-centerline',
      'mullion',
      'mullion',
    )
    if (m) {
      out.constructionLines.push(m)
      out.constraintGuides.push(m)
      out.sourceComponentIds.push('mullion')
    }
  } else if (parent) {
    out.limitations.push('mullion centerline unavailable')
  }

  if (oculus?.circle) {
    const c = circleEntry(oculus.circle, 'oculus', 'oculus')
    if (c) {
      out.constructionCircles.push(c)
      out.sourceComponentIds.push('oculus')
    }
    const o = pt(oculus.center ?? oculus.circle.center, 'oculus-center', 'oculus-center', 'oculus')
    if (o) out.constructionPoints.push(o)
  } else if (meta.mode === 'composed-window' || meta.mode === 'oculus-placement') {
    out.limitations.push('oculus construction circle unavailable')
  }

  if (foil) {
    out.sourceComponentIds.push('foil')
    const foilCenter = pt(foil.center, 'foil-center', 'foil-center', 'foil')
    if (foilCenter) out.constructionPoints.push(foilCenter)
    for (const [i, circle] of (foil.circles ?? []).entries()) {
      const c = circleEntry(circle, `foil-circle-${i}`, 'foil')
      if (c) out.constructionCircles.push(c)
    }
    for (const [i, center] of (foil.lobeCenters ?? foil.centers ?? []).entries()) {
      const p = pt(center, 'foil-lobe-center', `foil-lobe-${i}`, 'foil')
      if (p) out.constructionPoints.push(p)
    }
    for (const [i, cusp] of (foil.cusps ?? foil.cuspPoints ?? []).entries()) {
      const p = pt(cusp, 'cusp-intersection', `foil-cusp-${i}`, 'foil')
      if (p) {
        out.constructionPoints.push(p)
        out.intersectionPoints.push({ ...p, role: 'cusp-intersection' })
      }
    }
    if (!(foil.circles?.length)) {
      out.limitations.push('foil construction circles unavailable')
    }
  }

  out.sourceComponentIds = [...new Set(out.sourceComponentIds)]
  out.limitations = [...new Set(out.limitations)]
  return out
}

/**
 * From a Grammar construction document (buildArchConstruction / buildTraceryConstruction).
 */
export function extractConstructionGeometryFromResult(result) {
  if (!result) return emptyConstructionGeometry(['construction result unavailable'])
  if (result.metadata?.constructionGeometry) {
    return result.metadata.constructionGeometry
  }
  if (result.type === 'pointed-arch' && result.metadata?.arch) {
    return extractArchConstructionGeometry(result.metadata.arch, 'pointed-arch')
  }
  if (result.type === 'arch-comparison' && result.metadata?.arches) {
    const merged = emptyConstructionGeometry()
    for (const arch of result.metadata.arches) {
      const part = extractArchConstructionGeometry(arch, arch.family ?? 'arch')
      merged.constructionPoints.push(...part.constructionPoints)
      merged.constructionLines.push(...part.constructionLines)
      merged.constructionCircles.push(...part.constructionCircles)
      merged.constructionArcs.push(...part.constructionArcs)
      merged.intersectionPoints.push(...part.intersectionPoints)
      merged.symmetryAxes.push(...part.symmetryAxes)
      merged.constraintGuides.push(...part.constraintGuides)
      merged.sourceComponentIds.push(...part.sourceComponentIds)
      merged.limitations.push(...part.limitations)
    }
    merged.sourceComponentIds = [...new Set(merged.sourceComponentIds)]
    return merged
  }
  if (result.metadata?.parent || result.metadata?.foil || result.metadata?.graph) {
    const graph = result.metadata.graph ?? {
      metadata: result.metadata,
    }
    return extractTraceryConstructionGeometry(graph)
  }
  return emptyConstructionGeometry(['no construction geometry for this result type'])
}
