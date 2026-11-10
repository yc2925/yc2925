/**
 * Architectural surface semantics extraction (Step 13E.3).
 *
 * Separates GEOMETRY GENERATION (already done) from SEMANTIC EXTRACTION.
 * Reads construction metadata + mesh geometry; does not alter materials.
 * No vegetation is generated.
 *
 * References: REF-004 (piers/recesses), REF-002 (layered openings),
 * REF-013 (tracery junctions), REF-008 / REF-011 (arch / tracery grammar).
 */

import {
  COMPONENT_TYPES,
  SURFACE_TYPES,
  GROWTH_ELIGIBILITY,
  CLASSIFICATION_CONFIDENCE,
  FEATURE_KINDS,
  EDGE_KINDS,
  RELATIONSHIP_TYPES,
  GROWTH_ZONES,
  ZONE_PRECEDENCE,
  DEFAULT_GROWTH_POLICY,
  PART_ROLE_TO_COMPONENT,
  MEMBER_TYPE_TO_COMPONENT,
  JOINT_DATA_UNAVAILABLE,
} from './surfaceSemanticsTypes.js'

const EPS = 1e-9
const NORMAL_BIN = 0.35

function identityTransform() {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  }
}

function cloneTransform(t) {
  if (!t) return identityTransform()
  return {
    position: [...(t.position ?? [0, 0, 0])],
    rotation: [...(t.rotation ?? [0, 0, 0])],
    scale: [...(t.scale ?? [1, 1, 1])],
  }
}

function applyWorldPoint(local, transform) {
  const [px, py, pz] = transform?.position ?? [0, 0, 0]
  const [sx, sy, sz] = transform?.scale ?? [1, 1, 1]
  return [local[0] * sx + px, local[1] * sy + py, local[2] * sz + pz]
}

function applyWorldNormal(n, transform) {
  // Assemblies use translation + uniform/non-rotating placement only today.
  const [sx, sy, sz] = transform?.scale ?? [1, 1, 1]
  const nx = n[0] / (Math.abs(sx) || 1)
  const ny = n[1] / (Math.abs(sy) || 1)
  const nz = n[2] / (Math.abs(sz) || 1)
  const len = Math.hypot(nx, ny, nz) || 1
  return [nx / len, ny / len, nz / len]
}

function emptyBBox() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  }
}

function expandPoint(b, p) {
  for (let i = 0; i < 3; i += 1) {
    if (p[i] < b.min[i]) b.min[i] = p[i]
    if (p[i] > b.max[i]) b.max[i] = p[i]
  }
}

function finalizeBBox(b) {
  if (!Number.isFinite(b.min[0])) {
    return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] }
  }
  return {
    min: b.min,
    max: b.max,
    size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]],
  }
}

function triNormalArea(positions, ia, ib, ic) {
  const ax = positions[ia * 3]
  const ay = positions[ia * 3 + 1]
  const az = positions[ia * 3 + 2]
  const bx = positions[ib * 3]
  const by = positions[ib * 3 + 1]
  const bz = positions[ib * 3 + 2]
  const cx = positions[ic * 3]
  const cy = positions[ic * 3 + 1]
  const cz = positions[ic * 3 + 2]
  const abx = bx - ax
  const aby = by - ay
  const abz = bz - az
  const acx = cx - ax
  const acy = cy - ay
  const acz = cz - az
  const nx = aby * acz - abz * acy
  const ny = abz * acx - abx * acz
  const nz = abx * acy - aby * acx
  const len = Math.hypot(nx, ny, nz)
  if (len < EPS) return { normal: [0, 0, 1], area: 0, centroid: [ax, ay, az] }
  const area = len * 0.5
  return {
    normal: [nx / len, ny / len, nz / len],
    area,
    centroid: [(ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3],
  }
}

function quantizeNormal(n) {
  return [
    Math.round(n[0] / NORMAL_BIN) * NORMAL_BIN,
    Math.round(n[1] / NORMAL_BIN) * NORMAL_BIN,
    Math.round(n[2] / NORMAL_BIN) * NORMAL_BIN,
  ].join(',')
}

function classifyOrientation(worldNormal) {
  const [nx, ny, nz] = worldNormal
  const ax = Math.abs(nx)
  const ay = Math.abs(ny)
  const az = Math.abs(nz)
  if (az >= ax && az >= ay) {
    return nz >= 0 ? SURFACE_TYPES.FRONT_FACE : SURFACE_TYPES.BACK_FACE
  }
  if (ay >= ax && ay >= az) {
    return ny >= 0 ? SURFACE_TYPES.TOP_FACE : SURFACE_TYPES.BOTTOM_FACE
  }
  return SURFACE_TYPES.SIDE_FACE
}

/**
 * Map support part role → component type via grammar metadata.
 */
export function componentTypeFromPartRole(role) {
  return PART_ROLE_TO_COMPONENT[role] ?? null
}

export function componentTypeFromMemberType(type) {
  if (!type) return null
  if (MEMBER_TYPE_TO_COMPONENT[type]) return MEMBER_TYPE_TO_COMPONENT[type]
  const upper = String(type).toUpperCase()
  if (upper.includes('FOIL')) return COMPONENT_TYPES.FOIL
  if (upper.includes('MULLION') || upper.includes('PRIMARY')) {
    return COMPONENT_TYPES.PRIMARY_MULLION
  }
  if (upper.includes('SECONDARY')) return COMPONENT_TYPES.SECONDARY_TRACERY
  if (upper.includes('TERTIARY')) return COMPONENT_TYPES.TERTIARY_TRACERY
  if (upper.includes('ARCH') || upper.includes('OUTER')) return COMPONENT_TYPES.OUTER_ARCH
  return COMPONENT_TYPES.SECONDARY_TRACERY
}

function defaultEligibilityForComponent(componentType) {
  switch (componentType) {
    case COMPONENT_TYPES.PIER_CORE:
    case COMPONENT_TYPES.ENGAGED_SHAFT:
    case COMPONENT_TYPES.BUTTRESS:
    case COMPONENT_TYPES.BUTTRESS_STAGE:
    case COMPONENT_TYPES.BASE_COURSE:
    case COMPONENT_TYPES.PIER_BASE:
    case COMPONENT_TYPES.SILL:
    case COMPONENT_TYPES.OUTER_ARCH:
      return GROWTH_ELIGIBILITY.ALLOWED
    case COMPONENT_TYPES.PRIMARY_MULLION:
    case COMPONENT_TYPES.SECONDARY_TRACERY:
    case COMPONENT_TYPES.TERTIARY_TRACERY:
    case COMPONENT_TYPES.FOIL:
    case COMPONENT_TYPES.CAPITAL:
      return GROWTH_ELIGIBILITY.RESTRICTED
    case COMPONENT_TYPES.WINDOW:
    case COMPONENT_TYPES.FACADE:
    case COMPONENT_TYPES.BAY:
      return GROWTH_ELIGIBILITY.PROHIBITED
    default:
      return GROWTH_ELIGIBILITY.RESTRICTED
  }
}

function baseWeightFor(eligibility, componentType, surfaceType, policy) {
  if (eligibility === GROWTH_ELIGIBILITY.PROHIBITED) return 0
  const structuralTypes = new Set([
    COMPONENT_TYPES.PIER_CORE,
    COMPONENT_TYPES.ENGAGED_SHAFT,
    COMPONENT_TYPES.BUTTRESS,
    COMPONENT_TYPES.BUTTRESS_STAGE,
    COMPONENT_TYPES.BASE_COURSE,
    COMPONENT_TYPES.PIER_BASE,
    COMPONENT_TYPES.SILL,
  ])
  const traceryTypes = new Set([
    COMPONENT_TYPES.PRIMARY_MULLION,
    COMPONENT_TYPES.SECONDARY_TRACERY,
    COMPONENT_TYPES.TERTIARY_TRACERY,
    COMPONENT_TYPES.FOIL,
    COMPONENT_TYPES.OUTER_ARCH,
    COMPONENT_TYPES.CAPITAL,
  ])
  let w = 0.5
  if (structuralTypes.has(componentType)) w = policy.structuralGrowthWeight
  else if (traceryTypes.has(componentType)) w = policy.traceryGrowthWeight
  if (surfaceType === SURFACE_TYPES.RECESS || surfaceType === SURFACE_TYPES.INTRADOS) {
    w = Math.max(w, policy.recessedGrowthWeight * (eligibility === GROWTH_ELIGIBILITY.RESTRICTED ? 0.55 : 1))
  }
  if (surfaceType === SURFACE_TYPES.TOP_FACE) w = Math.min(1, w + 0.08)
  if (eligibility === GROWTH_ELIGIBILITY.RESTRICTED) w = Math.min(w, 0.35)
  return Math.max(0, Math.min(1, w))
}

function makeComponent(partial) {
  return {
    id: partial.id,
    parentId: partial.parentId ?? null,
    assemblyId: partial.assemblyId,
    bayId: partial.bayId ?? null,
    componentType: partial.componentType,
    hierarchyLevel: partial.hierarchyLevel ?? 'PRIMARY',
    localTransform: cloneTransform(partial.localTransform),
    worldTransform: cloneTransform(partial.worldTransform),
    boundingBox: partial.boundingBox ?? { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] },
    geometryReference: partial.geometryReference ?? null,
    semanticTags: partial.semanticTags ?? [],
  }
}

/**
 * Group mesh triangles into meaningful surface patches (not one-per-triangle).
 */
function extractPatchesFromMesh({
  mesh,
  componentId,
  componentType,
  worldTransform,
  surfaceIdPrefix,
  meshKind = 'unknown',
  openingHints = [],
  policy,
}) {
  if (!mesh?.positions || !mesh?.indices) {
    return { surfaces: [], patches: [], triangleRefs: [] }
  }
  const positions = mesh.positions
  const indices = mesh.indices
  const triCount = Math.floor(indices.length / 3)
  const clusters = new Map()

  for (let t = 0; t < triCount; t += 1) {
    const ia = indices[t * 3]
    const ib = indices[t * 3 + 1]
    const ic = indices[t * 3 + 2]
    const { normal, area, centroid } = triNormalArea(positions, ia, ib, ic)
    if (area < EPS) continue
    const localNormal = normal
    const worldNormal = applyWorldNormal(localNormal, worldTransform)
    const worldCentroid = applyWorldPoint(centroid, worldTransform)

    // Spatial bin keeps patch count bounded while preserving locality.
    // Extruded window shells use coarser bins than supports (1–7 bay perf).
    const binN = quantizeNormal(worldNormal)
    const isExtruded = meshKind !== 'box-solid' && meshKind !== 'cylinder-solid'
    const binX = Math.round(worldCentroid[0] / (isExtruded ? 0.85 : 0.35))
    const binY = Math.round(worldCentroid[1] / (isExtruded ? 0.95 : 0.45))
    const binZ = Math.round(worldCentroid[2] / (isExtruded ? 0.4 : 0.25))
    // Cylinders: prefer azimuthal+height banding over flat normal bins alone.
    let key = `${binN}|${binX}|${binY}|${binZ}`
    if (meshKind === 'cylinder-solid') {
      const lx = centroid[0] - (mesh.meta?.cx ?? centroid[0])
      const lz = centroid[2] - (mesh.meta?.cz ?? centroid[2])
      const az = Math.floor(((Math.atan2(lz, lx) + Math.PI) / (Math.PI * 2)) * 8)
      const hy = Math.floor(centroid[1] / 0.4)
      key = `cyl|${az}|${hy}|${binN}`
    } else if (meshKind === 'box-solid') {
      key = `box|${binN}`
    } else if (isExtruded && (Math.abs(worldNormal[2]) > 0.85 || Math.abs(worldNormal[1]) > 0.85)) {
      // Front/back/top/bottom of extruded stone: normal family + coarse XY only
      key = `ext|${binN}|${binX}|${binY}`
    }

    if (!clusters.has(key)) {
      clusters.set(key, {
        key,
        area: 0,
        cx: 0,
        cy: 0,
        cz: 0,
        nx: 0,
        ny: 0,
        nz: 0,
        triIndices: [],
        bbox: emptyBBox(),
        localNormalSum: [0, 0, 0],
      })
    }
    const c = clusters.get(key)
    c.area += area
    c.cx += centroid[0] * area
    c.cy += centroid[1] * area
    c.cz += centroid[2] * area
    c.nx += localNormal[0] * area
    c.ny += localNormal[1] * area
    c.nz += localNormal[2] * area
    c.triIndices.push(t)
    expandPoint(c.bbox, [positions[ia * 3], positions[ia * 3 + 1], positions[ia * 3 + 2]])
    expandPoint(c.bbox, [positions[ib * 3], positions[ib * 3 + 1], positions[ib * 3 + 2]])
    expandPoint(c.bbox, [positions[ic * 3], positions[ic * 3 + 1], positions[ic * 3 + 2]])
  }

  const surfaces = []
  const patches = []
  const triangleRefs = []
  let surfIdx = 0

  for (const c of clusters.values()) {
    if (c.area < EPS) continue
    const localCentroid = [c.cx / c.area, c.cy / c.area, c.cz / c.area]
    const lnLen = Math.hypot(c.nx, c.ny, c.nz) || 1
    const localNormal = [c.nx / lnLen, c.ny / lnLen, c.nz / lnLen]
    const worldNormal = applyWorldNormal(localNormal, worldTransform)
    const worldCentroid = applyWorldPoint(localCentroid, worldTransform)
    let surfaceType = classifyOrientation(worldNormal)
    let confidence = CLASSIFICATION_CONFIDENCE.VERIFIED
    if (meshKind !== 'box-solid' && Math.abs(worldNormal[2]) < 0.85 && Math.abs(worldNormal[1]) < 0.85) {
      // Non-axis-aligned → sampled / approximated orientation family
      confidence = CLASSIFICATION_CONFIDENCE.APPROXIMATED
    }

    // Construction-aware intrados: normals facing an opening centroid.
    for (const hint of openingHints) {
      const dx = hint.centroid[0] - worldCentroid[0]
      const dy = hint.centroid[1] - worldCentroid[1]
      const dz = hint.centroid[2] - worldCentroid[2]
      const dlen = Math.hypot(dx, dy, dz) || 1
      const toward = (dx * worldNormal[0] + dy * worldNormal[1] + dz * worldNormal[2]) / dlen
      const dist = Math.hypot(dx, dy, dz)
      if (toward > 0.55 && dist < hint.radius * 1.35) {
        surfaceType = SURFACE_TYPES.INTRADOS
        confidence = CLASSIFICATION_CONFIDENCE.VERIFIED
        break
      }
      if (toward < -0.55 && dist < hint.radius * 1.8 && surfaceType === SURFACE_TYPES.SIDE_FACE) {
        surfaceType = SURFACE_TYPES.EXTRADOS
        confidence = CLASSIFICATION_CONFIDENCE.APPROXIMATED
      }
    }

    // Engaged-shaft / setback facing pier core → recess candidate
    if (
      (componentType === COMPONENT_TYPES.ENGAGED_SHAFT ||
        componentType === COMPONENT_TYPES.BUTTRESS_STAGE) &&
      surfaceType === SURFACE_TYPES.SIDE_FACE &&
      worldNormal[2] < -0.2
    ) {
      surfaceType = SURFACE_TYPES.RECESS
      confidence = CLASSIFICATION_CONFIDENCE.APPROXIMATED
    }

    const eligibility = defaultEligibilityForComponent(componentType)
    // Bottom faces of capitals / tops of bases stay restricted but nonzero weight possible
    let elig = eligibility
    if (surfaceType === SURFACE_TYPES.BOTTOM_FACE && componentType === COMPONENT_TYPES.CAPITAL) {
      elig = GROWTH_ELIGIBILITY.RESTRICTED
    }

    const surfaceId = `${surfaceIdPrefix}-surf-${String(++surfIdx).padStart(3, '0')}`
    const bboxLocal = finalizeBBox(c.bbox)
    const bboxWorld = {
      min: applyWorldPoint(bboxLocal.min, worldTransform),
      max: applyWorldPoint(bboxLocal.max, worldTransform),
    }
    bboxWorld.size = [
      bboxWorld.max[0] - bboxWorld.min[0],
      bboxWorld.max[1] - bboxWorld.min[1],
      bboxWorld.max[2] - bboxWorld.min[2],
    ]

    const growthWeight = baseWeightFor(elig, componentType, surfaceType, policy)

    surfaces.push({
      surfaceId,
      componentId,
      surfaceType,
      localNormal,
      worldNormal,
      area: c.area,
      centroid: worldCentroid,
      boundingBox: bboxWorld,
      growthEligibility: elig,
      growthWeight,
      featureReferences: [],
      classificationConfidence: confidence,
      triangleCount: c.triIndices.length,
    })

    // One patch per cluster (meaningful grouping). Large box faces → 2×2 subpatches.
    const subdivide =
      meshKind === 'box-solid' && c.area > 0.35 && surfaceType !== SURFACE_TYPES.TOP_FACE
        ? 2
        : 1
    if (subdivide === 1) {
      const patchId = `${surfaceId}-p00`
      patches.push({
        patchId,
        componentId,
        surfaceId,
        localCoordinates: { centroid: localCentroid, normal: localNormal },
        worldTransform: {
          position: worldCentroid,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          normal: worldNormal,
        },
        representativeNormal: worldNormal,
        area: c.area,
        growthEligibility: elig,
        growthWeight,
        triangleIndices: c.triIndices.slice(),
      })
      triangleRefs.push({
        patchId,
        componentId,
        surfaceId,
        meshRef: mesh.meta?.id ?? componentId,
        triangleIndices: c.triIndices.slice(),
      })
    } else {
      // Split by centroid projection onto face tangent axes (axis-aligned boxes).
      const groups = Array.from({ length: 4 }, () => ({
        tris: [],
        area: 0,
        cx: 0,
        cy: 0,
        cz: 0,
      }))
      for (const ti of c.triIndices) {
        const ia = indices[ti * 3]
        const ib = indices[ti * 3 + 1]
        const ic = indices[ti * 3 + 2]
        const { area, centroid } = triNormalArea(positions, ia, ib, ic)
        const u =
          Math.abs(localNormal[0]) > 0.9
            ? centroid[2] >= localCentroid[2]
            : centroid[0] >= localCentroid[0]
        const v =
          Math.abs(localNormal[1]) > 0.9
            ? centroid[2] >= localCentroid[2]
            : centroid[1] >= localCentroid[1]
        const gi = (u ? 1 : 0) + (v ? 2 : 0)
        groups[gi].tris.push(ti)
        groups[gi].area += area
        groups[gi].cx += centroid[0] * area
        groups[gi].cy += centroid[1] * area
        groups[gi].cz += centroid[2] * area
      }
      groups.forEach((g, gi) => {
        if (g.area < EPS) return
        const lc = [g.cx / g.area, g.cy / g.area, g.cz / g.area]
        const wc = applyWorldPoint(lc, worldTransform)
        const patchId = `${surfaceId}-p${String(gi).padStart(2, '0')}`
        patches.push({
          patchId,
          componentId,
          surfaceId,
          localCoordinates: { centroid: lc, normal: localNormal },
          worldTransform: {
            position: wc,
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            normal: worldNormal,
          },
          representativeNormal: worldNormal,
          area: g.area,
          growthEligibility: elig,
          growthWeight,
          triangleIndices: g.tris,
        })
        triangleRefs.push({
          patchId,
          componentId,
          surfaceId,
          meshRef: mesh.meta?.id ?? componentId,
          triangleIndices: g.tris.slice(),
        })
      })
    }
  }

  return { surfaces, patches, triangleRefs }
}

function openingHintsFromModule(mod, worldTransform) {
  const hints = []
  const sv = mod.assembly?.solidVoid
  if (!sv?.regions) return hints
  for (const [key, region] of Object.entries(sv.regions)) {
    if (!/VOID|OPENING|HOLE/i.test(key) && !/VOID|OPENING/i.test(region?.type ?? '')) continue
    const samples = region.samples ?? []
    if (!samples.length && region.centroid) {
      const c = applyWorldPoint(
        [region.centroid.x ?? region.centroid[0], region.centroid.y ?? region.centroid[1], 0],
        worldTransform,
      )
      hints.push({
        id: region.id ?? key,
        centroid: c,
        radius: Math.sqrt(Math.max(0, region.area ?? 0.2) / Math.PI) || 0.3,
        type: region.type ?? key,
      })
      continue
    }
    if (!samples.length) continue
    let sx = 0
    let sy = 0
    for (const s of samples) {
      sx += s.x ?? s[0] ?? 0
      sy += s.y ?? s[1] ?? 0
    }
    const n = samples.length
    const c = applyWorldPoint([sx / n, sy / n, 0], worldTransform)
    let r = 0
    for (const s of samples) {
      const dx = (s.x ?? s[0] ?? 0) - sx / n
      const dy = (s.y ?? s[1] ?? 0) - sy / n
      r = Math.max(r, Math.hypot(dx, dy))
    }
    hints.push({
      id: region.id ?? key,
      centroid: c,
      radius: r || 0.3,
      type: region.type ?? key,
    })
  }
  return hints
}

function protectedOpeningRecords(mod, bayId, assemblyId, worldTransform, policy) {
  const openings = []
  const sv = mod.assembly?.solidVoid
  const regions = sv?.regions ?? {}
  for (const [key, region] of Object.entries(regions)) {
    const isVoid =
      /VOID|OPENING/i.test(key) ||
      /VOID|OPENING/i.test(region?.type ?? '') ||
      region?.semantic === 'void'
    if (!isVoid) continue
    const samples = region.samples ?? []
    let cx = 0
    let cy = 0
    if (region.centroid) {
      cx = region.centroid.x ?? region.centroid[0] ?? 0
      cy = region.centroid.y ?? region.centroid[1] ?? 0
    } else if (samples.length) {
      for (const s of samples) {
        cx += s.x ?? s[0] ?? 0
        cy += s.y ?? s[1] ?? 0
      }
      cx /= samples.length
      cy /= samples.length
    }
    const world = applyWorldPoint([cx, cy, 0], worldTransform)
    openings.push({
      openingId: `${mod.id}-opening-${region.id ?? key}`,
      componentId: mod.id,
      bayId,
      assemblyId,
      regionType: region.type ?? key,
      centroid: world,
      area: Math.max(0, region.area ?? 0),
      // Never a growable surface — policy only affects nearby boundary weights.
      growableSurface: false,
      protected: policy.protectWindowOpenings !== false,
      note: 'Empty window void — not represented as a surface patch',
    })
  }
  return openings
}

function pushEdge(edges, partial) {
  edges.push({
    sourceId: partial.sourceId,
    targetId: partial.targetId,
    relationshipType: partial.relationshipType,
    geometric: partial.geometric ?? null,
  })
}

/**
 * Apply growth policy / zone precedence onto an existing extraction
 * without regenerating geometry references.
 */
export function applyGrowthPolicy(semantics, policyInput = {}) {
  const policy = { ...DEFAULT_GROWTH_POLICY, ...policyInput }
  if (!semantics) return null

  const surfaceById = new Map(semantics.surfaces.map((s) => [s.surfaceId, { ...s }]))
  const componentById = new Map(semantics.components.map((c) => [c.id, c]))

  // Zone membership → eligibility overrides
  const zoneBySurface = new Map()
  for (const zone of semantics.zones ?? []) {
    for (const sid of zone.surfaceIds ?? []) {
      if (!zoneBySurface.has(sid)) zoneBySurface.set(sid, [])
      zoneBySurface.get(sid).push(zone)
    }
  }

  for (const [sid, surface] of surfaceById) {
    const component = componentById.get(surface.componentId)
    const ctype = component?.componentType ?? COMPONENT_TYPES.WINDOW
    let elig = defaultEligibilityForComponent(ctype)
    if (surface.surfaceType === SURFACE_TYPES.BOTTOM_FACE && ctype === COMPONENT_TYPES.CAPITAL) {
      elig = GROWTH_ELIGIBILITY.RESTRICTED
    }

    const zones = zoneBySurface.get(sid) ?? []
    let bestPrec = -1
    let zoneElig = null
    for (const z of zones) {
      const prec = ZONE_PRECEDENCE[z.zoneType] ?? 0
      if (prec < bestPrec) continue
      bestPrec = prec
      if (z.zoneType === GROWTH_ZONES.PROTECTED_OPENING) {
        zoneElig = GROWTH_ELIGIBILITY.PROHIBITED
      } else if (z.zoneType === GROWTH_ZONES.TRACERY_ORNAMENT) {
        zoneElig = GROWTH_ELIGIBILITY.RESTRICTED
      } else if (
        z.zoneType === GROWTH_ZONES.STRUCTURAL_COLONIZATION ||
        z.zoneType === GROWTH_ZONES.RECESSED_GROWTH ||
        z.zoneType === GROWTH_ZONES.ARCH_FOLLOWING
      ) {
        zoneElig = GROWTH_ELIGIBILITY.ALLOWED
      } else if (z.zoneType === GROWTH_ZONES.SACRED_FACADE) {
        zoneElig = elig === GROWTH_ELIGIBILITY.PROHIBITED ? elig : GROWTH_ELIGIBILITY.ALLOWED
      }
    }
    if (zoneElig) elig = zoneElig

    // Protected openings never create growable empty-space patches; nearby
    // stone may still grow. Overlay policy only adjusts boundary preference.
    let weight = baseWeightFor(elig, ctype, surface.surfaceType, policy)
    if (zones.some((z) => z.zoneType === GROWTH_ZONES.SACRED_FACADE)) {
      weight = Math.min(1, weight + policy.sacredFacadeEmphasis * 0.25)
    }
    if (zones.some((z) => z.zoneType === GROWTH_ZONES.RECESSED_GROWTH)) {
      weight = Math.min(1, Math.max(weight, policy.recessedGrowthWeight))
    }
    if (elig === GROWTH_ELIGIBILITY.PROHIBITED) weight = 0

    surface.growthEligibility = elig
    surface.growthWeight = weight
    surface.activeZones = zones.map((z) => z.zoneType)
  }

  const patches = (semantics.patches ?? []).map((p) => {
    const s = surfaceById.get(p.surfaceId)
    return {
      ...p,
      growthEligibility: s?.growthEligibility ?? GROWTH_ELIGIBILITY.PROHIBITED,
      growthWeight: s?.growthWeight ?? 0,
      activeZones: s?.activeZones ?? [],
    }
  })

  const surfaces = [...surfaceById.values()]
  const diagnostics = computeDiagnostics({
    ...semantics,
    surfaces,
    patches,
    policy,
  })

  return {
    ...semantics,
    surfaces,
    patches,
    policy: { ...policy },
    diagnostics,
    openings: (semantics.openings ?? []).map((o) => ({
      ...o,
      protected: policy.protectWindowOpenings !== false,
      growableSurface: false,
    })),
  }
}

function computeDiagnostics(model) {
  let eligibleArea = 0
  let restrictedArea = 0
  let prohibitedArea = 0
  for (const s of model.surfaces ?? []) {
    if (s.growthEligibility === GROWTH_ELIGIBILITY.ALLOWED) eligibleArea += s.area
    else if (s.growthEligibility === GROWTH_ELIGIBILITY.RESTRICTED) restrictedArea += s.area
    else prohibitedArea += s.area
  }
  return {
    componentCount: model.components?.length ?? 0,
    surfaceCount: model.surfaces?.length ?? 0,
    surfacePatchCount: model.patches?.length ?? 0,
    eligibleSurfaceArea: eligibleArea,
    restrictedSurfaceArea: restrictedArea,
    prohibitedSurfaceArea: prohibitedArea,
    protectedOpeningCount: (model.openings ?? []).filter((o) => o.protected !== false).length,
    featureGraphEdgeCount: model.featureGraph?.edges?.length ?? 0,
    jointDataStatus: model.jointDataStatus ?? JOINT_DATA_UNAVAILABLE,
    policy: model.policy ?? null,
  }
}

/**
 * Extract full architectural surface semantics from a facade assembly.
 */
export function extractFacadeSurfaceSemantics(facade, policyInput = {}) {
  const policy = { ...DEFAULT_GROWTH_POLICY, ...policyInput }
  if (!facade?.id) {
    return {
      ok: false,
      geometryVersion: null,
      components: [],
      surfaces: [],
      patches: [],
      features: [],
      openings: [],
      zones: [],
      featureGraph: { nodes: [], edges: [] },
      triangleRefs: [],
      jointDataStatus: JOINT_DATA_UNAVAILABLE,
      diagnostics: computeDiagnostics({}),
      policy,
      errors: ['missing facade'],
    }
  }

  const assemblyId = facade.id
  // Geometry identity must be stable across rebuilds that only bump facade-N
  // counters (nextId). Volatile assembly ids caused every remount/rebuild to
  // look like a new topology and mark fresh VALID seeds as REPROJECTED.
  const geometryVersion = [
    String(assemblyId ?? '').replace(/^facade-\d+/, 'facade'),
    facade.metrics?.bayCount,
    facade.parameters?.supportStyle,
    facade.parameters?.hierarchicalDepth,
    facade.parameters?.shaftArrangement,
    facade.parameters?.shaftProjection,
    facade.parameters?.baseHeight,
    facade.parameters?.capitalHeight,
    facade.parameters?.buttressSetbackCount,
    facade.parameters?.buttressSetbackRatio,
    facade.metrics?.estimatedStoneVolume?.toFixed?.(5),
  ].join('|')

  const components = []
  const surfaces = []
  const patches = []
  const features = []
  const openings = []
  const triangleRefs = []
  const graphEdges = []
  const errors = []
  const warnings = []

  components.push(
    makeComponent({
      id: assemblyId,
      parentId: null,
      assemblyId,
      componentType: COMPONENT_TYPES.FACADE,
      hierarchyLevel: 'PRIMARY',
      localTransform: identityTransform(),
      worldTransform: identityTransform(),
      boundingBox: {
        min: facade.metrics?.boundingMin ?? [0, 0, 0],
        max: facade.metrics?.boundingMax ?? [0, 0, 0],
        size: facade.metrics?.boundingSize ?? [0, 0, 0],
      },
      geometryReference: { kind: 'facade', id: assemblyId },
      semanticTags: ['facade', 'assembly'],
    }),
  )

  const bayById = new Map((facade.bays ?? []).map((b) => [b.id, b]))

  for (const bay of facade.bays ?? []) {
    components.push(
      makeComponent({
        id: bay.id,
        parentId: assemblyId,
        assemblyId,
        bayId: bay.id,
        componentType: COMPONENT_TYPES.BAY,
        hierarchyLevel: 'PRIMARY',
        localTransform: { position: [...bay.localOrigin], rotation: [0, 0, 0], scale: [1, 1, 1] },
        worldTransform: { position: [...bay.localOrigin], rotation: [0, 0, 0], scale: [1, 1, 1] },
        boundingBox: {
          min: [bay.leftBoundaryX, 0, -0.2],
          max: [bay.rightBoundaryX, bay.bayHeight, 0.2],
          size: [bay.bayWidth, bay.bayHeight, 0.4],
        },
        geometryReference: { kind: 'bay', id: bay.id },
        semanticTags: ['bay', `index:${bay.bayIndex}`],
      }),
    )
    pushEdge(graphEdges, {
      sourceId: assemblyId,
      targetId: bay.id,
      relationshipType: RELATIONSHIP_TYPES.PARENT_OF,
    })
    if (bay.leftPierId) {
      pushEdge(graphEdges, {
        sourceId: bay.id,
        targetId: bay.leftPierId,
        relationshipType: RELATIONSHIP_TYPES.BAY_TO_PIER,
        geometric: { side: 'left' },
      })
    }
    if (bay.rightPierId) {
      pushEdge(graphEdges, {
        sourceId: bay.id,
        targetId: bay.rightPierId,
        relationshipType: RELATIONSHIP_TYPES.BAY_TO_PIER,
        geometric: { side: 'right' },
      })
    }
  }

  // Window modules + tracery member components + mesh surfaces
  for (const mod of facade.windowModules ?? []) {
    const bayId = mod.parentAssemblyId
    const worldTransform = cloneTransform(mod.transform)
    components.push(
      makeComponent({
        id: mod.id,
        parentId: bayId,
        assemblyId,
        bayId,
        componentType: COMPONENT_TYPES.WINDOW,
        hierarchyLevel: 'PRIMARY',
        localTransform: identityTransform(),
        worldTransform,
        boundingBox: {
          min: applyWorldPoint(mod.boundingBox?.min ?? [0, 0, 0], worldTransform),
          max: applyWorldPoint(mod.boundingBox?.max ?? [0, 0, 0], worldTransform),
          size: mod.boundingBox?.size ?? [0, 0, 0],
        },
        geometryReference: { kind: 'window-module', id: mod.id, cacheKey: mod.geometryRef },
        semanticTags: ['window', 'rayonnant-hierarchical'],
      }),
    )
    pushEdge(graphEdges, {
      sourceId: bayId,
      targetId: mod.id,
      relationshipType: RELATIONSHIP_TYPES.PARENT_OF,
    })

    // Sill component (construction elevation, not a fabricated mesh joint)
    const sillId = `${mod.id}-sill`
    components.push(
      makeComponent({
        id: sillId,
        parentId: mod.id,
        assemblyId,
        bayId,
        componentType: COMPONENT_TYPES.SILL,
        hierarchyLevel: 'SECONDARY',
        localTransform: {
          position: [0, mod.windowBaseElevation ?? 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        worldTransform: {
          position: applyWorldPoint([0, mod.windowBaseElevation ?? 0, 0], worldTransform),
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        boundingBox: {
          min: applyWorldPoint([-mod.span * 0.5, mod.windowBaseElevation ?? 0, -0.05], worldTransform),
          max: applyWorldPoint([mod.span * 0.5, (mod.windowBaseElevation ?? 0) + 0.04, 0.05], worldTransform),
          size: [mod.span, 0.04, 0.1],
        },
        geometryReference: { kind: 'construction-elevation', id: sillId },
        semanticTags: ['sill', 'window-base'],
      }),
    )
    pushEdge(graphEdges, {
      sourceId: mod.id,
      targetId: sillId,
      relationshipType: RELATIONSHIP_TYPES.PARENT_OF,
    })

    const skeleton = mod.assembly?.solidVoid?.skeleton
    const rawMembers = skeleton?.members ?? skeleton?.graph?.members ?? []
    const rawNodes = skeleton?.nodes ?? skeleton?.graph?.nodes ?? []
    const members = Array.isArray(rawMembers) ? rawMembers : Object.values(rawMembers ?? {})
    const nodes = Array.isArray(rawNodes) ? rawNodes : Object.values(rawNodes ?? {})
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    for (const member of members) {
      const mtype = member.memberClass ?? member.type
      const ctype = componentTypeFromMemberType(mtype)
      const mid = `${mod.id}-member-${member.id}`
      components.push(
        makeComponent({
          id: mid,
          parentId: mod.id,
          assemblyId,
          bayId,
          componentType: ctype,
          hierarchyLevel:
            ctype === COMPONENT_TYPES.OUTER_ARCH || ctype === COMPONENT_TYPES.PRIMARY_MULLION
              ? 'PRIMARY'
              : ctype === COMPONENT_TYPES.FOIL || ctype === COMPONENT_TYPES.TERTIARY_TRACERY
                ? 'TERTIARY'
                : 'SECONDARY',
          localTransform: identityTransform(),
          worldTransform,
          boundingBox: { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] },
          geometryReference: {
            kind: 'tracery-member',
            memberId: member.id,
            path: member.path ?? null,
            width: member.width ?? null,
          },
          semanticTags: ['tracery', String(mtype)],
        }),
      )
      pushEdge(graphEdges, {
        sourceId: mod.id,
        targetId: mid,
        relationshipType: RELATIONSHIP_TYPES.PARENT_OF,
      })
      if (ctype === COMPONENT_TYPES.OUTER_ARCH) {
        pushEdge(graphEdges, {
          sourceId: mid,
          targetId: mod.id,
          relationshipType: RELATIONSHIP_TYPES.ARCH_BOUNDARY,
        })
        features.push({
          featureId: `${mid}-arch-edge`,
          kind: FEATURE_KINDS.ARCH_EDGE,
          edgeKind: EDGE_KINDS.CONSTRUCTION_EDGE,
          componentIds: [mid, mod.id],
          geometric: {
            memberId: member.id,
            pathPresent: Boolean(member.path),
          },
        })
      }
      // Tracery intersections from shared construction nodes (not proximity invent)
      const ends = [member.startNodeId, member.endNodeId].filter(Boolean)
      for (const nid of ends) {
        const node = nodeMap.get(nid)
        if (!node) continue
        const otherMembers = (node.memberIds ?? []).filter((id) => id !== member.id)
        for (const oid of otherMembers) {
          pushEdge(graphEdges, {
            sourceId: mid,
            targetId: `${mod.id}-member-${oid}`,
            relationshipType: RELATIONSHIP_TYPES.TRACERY_INTERSECTION,
            geometric: {
              nodeId: nid,
              position: node.position
                ? applyWorldPoint(
                    [node.position.x ?? node.position[0], node.position.y ?? node.position[1], 0],
                    worldTransform,
                  )
                : null,
            },
          })
          features.push({
            featureId: `${mod.id}-junction-${nid}`,
            kind: FEATURE_KINDS.JUNCTION,
            edgeKind: EDGE_KINDS.CONSTRUCTION_EDGE,
            componentIds: [mid, `${mod.id}-member-${oid}`],
            geometric: { nodeId: nid },
          })
        }
      }
    }

    const hints = openingHintsFromModule(mod, worldTransform)
    openings.push(...protectedOpeningRecords(mod, bayId, assemblyId, worldTransform, policy))

    // Structural mesh surfaces — stone only (voids are openings, not patches)
    const mesh =
      mod.assembly?.structuralTopology ??
      mod.assembly?.structural ??
      null
    if (mesh) {
      // Attribute window stone mass to OUTER_ARCH / WINDOW stone shell
      const stoneCompId = `${mod.id}-stone-shell`
      components.push(
        makeComponent({
          id: stoneCompId,
          parentId: mod.id,
          assemblyId,
          bayId,
          componentType: COMPONENT_TYPES.OUTER_ARCH,
          hierarchyLevel: 'PRIMARY',
          localTransform: identityTransform(),
          worldTransform,
          boundingBox: components.find((c) => c.id === mod.id)?.boundingBox,
          geometryReference: {
            kind: 'mesh',
            meshId: mesh.meta?.id ?? stoneCompId,
            positions: true,
            indices: true,
          },
          semanticTags: ['stone-shell', 'window-structure'],
        }),
      )
      pushEdge(graphEdges, {
        sourceId: mod.id,
        targetId: stoneCompId,
        relationshipType: RELATIONSHIP_TYPES.PARENT_OF,
      })

      const extracted = extractPatchesFromMesh({
        mesh,
        componentId: stoneCompId,
        componentType: COMPONENT_TYPES.OUTER_ARCH,
        worldTransform,
        surfaceIdPrefix: stoneCompId,
        meshKind: mesh.meta?.kind ?? 'extruded-region',
        openingHints: hints,
        policy,
      })
      surfaces.push(...extracted.surfaces)
      patches.push(...extracted.patches)
      triangleRefs.push(...extracted.triangleRefs)

      // Construction edges from solidVoid outer boundary (not tessellation)
      const outer = mod.assembly?.solidVoid?.regions?.OUTER_BOUNDARY
      if (outer?.edges?.length) {
        features.push({
          featureId: `${mod.id}-outer-construction-edge`,
          kind: FEATURE_KINDS.ARCH_EDGE,
          edgeKind: EDGE_KINDS.CONSTRUCTION_EDGE,
          componentIds: [stoneCompId],
          geometric: {
            edgeCount: outer.edges.length,
            note: 'solidVoid outer boundary construction edges',
          },
        })
        for (const s of extracted.surfaces) {
          if (
            s.surfaceType === SURFACE_TYPES.INTRADOS ||
            s.surfaceType === SURFACE_TYPES.FRONT_FACE
          ) {
            pushEdge(graphEdges, {
              sourceId: s.surfaceId,
              targetId: `${mod.id}-outer-construction-edge`,
              relationshipType: RELATIONSHIP_TYPES.SURFACE_TO_EDGE,
            })
            s.featureReferences.push(`${mod.id}-outer-construction-edge`)
          }
        }
      }
    } else {
      warnings.push(`${mod.id}: missing structural mesh for surface extraction`)
    }
  }

  // Supports
  for (const pier of facade.supports ?? []) {
    const pierParent = assemblyId
    // Aggregate pier node first (bay graph references pier.id)
    components.push(
      makeComponent({
        id: pier.id,
        parentId: pierParent,
        assemblyId,
        componentType: COMPONENT_TYPES.PIER_CORE,
        hierarchyLevel: 'PRIMARY',
        localTransform: { position: [pier.x, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        worldTransform: { position: [pier.x, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        boundingBox: {
          min: [pier.x - (pier.pierWidth ?? 0.2) * 0.5, 0, -(pier.pierDepth ?? 0.4) * 0.5],
          max: [
            pier.x + (pier.pierWidth ?? 0.2) * 0.5,
            pier.pierHeight ?? 0,
            (pier.pierDepth ?? 0.4) * 0.5,
          ],
          size: [pier.pierWidth ?? 0.2, pier.pierHeight ?? 0, pier.pierDepth ?? 0.4],
        },
        geometryReference: { kind: 'support', id: pier.id, supportType: pier.type },
        semanticTags: ['support', pier.supportStyle ?? pier.type].filter(Boolean),
      }),
    )
    pushEdge(graphEdges, {
      sourceId: assemblyId,
      targetId: pier.id,
      relationshipType: RELATIONSHIP_TYPES.PARENT_OF,
    })

    for (const part of pier.parts ?? []) {
      const ctype = componentTypeFromPartRole(part.role)
      if (!ctype) {
        warnings.push(`${part.id}: unknown part role ${part.role}`)
        continue
      }
      const worldTransform = identityTransform() // support meshes already in world XY
      const bbox = {
        min: part.boundingMin ?? [0, 0, 0],
        max: part.boundingMax ?? [0, 0, 0],
        size: [
          (part.boundingMax?.[0] ?? 0) - (part.boundingMin?.[0] ?? 0),
          (part.boundingMax?.[1] ?? 0) - (part.boundingMin?.[1] ?? 0),
          (part.boundingMax?.[2] ?? 0) - (part.boundingMin?.[2] ?? 0),
        ],
      }
      components.push(
        makeComponent({
          id: part.id,
          parentId: pier.id,
          assemblyId,
          bayId: null,
          componentType: ctype,
          hierarchyLevel: part.hierarchy ?? 'PRIMARY',
          localTransform: identityTransform(),
          worldTransform,
          boundingBox: bbox,
          geometryReference: {
            kind: 'mesh',
            meshId: part.mesh?.meta?.id ?? part.id,
            role: part.role,
          },
          semanticTags: [part.role, part.hierarchy].filter(Boolean),
        }),
      )
      pushEdge(graphEdges, {
        sourceId: pier.id,
        targetId: part.id,
        relationshipType: RELATIONSHIP_TYPES.PARENT_OF,
      })

      const extracted = extractPatchesFromMesh({
        mesh: part.mesh,
        componentId: part.id,
        componentType: ctype,
        worldTransform,
        surfaceIdPrefix: part.id,
        meshKind: part.mesh?.meta?.kind ?? 'box-solid',
        openingHints: [],
        policy,
      })
      surfaces.push(...extracted.surfaces)
      patches.push(...extracted.patches)
      triangleRefs.push(...extracted.triangleRefs)

      // Box construction corners (true geometric edges of the solid, not masonry joints)
      if (part.mesh?.meta?.kind === 'box-solid') {
        const corners = [
          part.boundingMin,
          [
            part.boundingMax[0],
            part.boundingMin[1],
            part.boundingMin[2],
          ],
          [
            part.boundingMin[0],
            part.boundingMax[1],
            part.boundingMin[2],
          ],
          [
            part.boundingMin[0],
            part.boundingMin[1],
            part.boundingMax[2],
          ],
        ]
        features.push({
          featureId: `${part.id}-corners`,
          kind: FEATURE_KINDS.CORNER,
          edgeKind: EDGE_KINDS.CONSTRUCTION_EDGE,
          componentIds: [part.id],
          geometric: {
            corners,
            note: 'Axis-aligned solid corners — not masonry joints',
          },
        })
        // Surface adjacency among faces of same box (shared construction edges)
        for (let i = 0; i < extracted.surfaces.length; i += 1) {
          for (let j = i + 1; j < extracted.surfaces.length; j += 1) {
            const a = extracted.surfaces[i]
            const b = extracted.surfaces[j]
            const dot =
              a.worldNormal[0] * b.worldNormal[0] +
              a.worldNormal[1] * b.worldNormal[1] +
              a.worldNormal[2] * b.worldNormal[2]
            if (Math.abs(dot) < 0.15) {
              pushEdge(graphEdges, {
                sourceId: a.surfaceId,
                targetId: b.surfaceId,
                relationshipType: RELATIONSHIP_TYPES.ADJACENT_SURFACE,
                geometric: { angleCos: dot, tolerance: 0.15 },
              })
            }
          }
        }
      }
    }

    // Pier ↔ buttress relationships from same support parts
    const cores = (pier.parts ?? []).filter((p) => p.role === 'PIER_CORE')
    const buttresses = (pier.parts ?? []).filter(
      (p) => p.role === 'BUTTRESS_MASS' || p.role === 'BUTTRESS_SETBACK',
    )
    for (const c of cores) {
      for (const b of buttresses) {
        pushEdge(graphEdges, {
          sourceId: c.id,
          targetId: b.id,
          relationshipType: RELATIONSHIP_TYPES.PIER_TO_BUTTRESS,
          geometric: { pierX: pier.x },
        })
        pushEdge(graphEdges, {
          sourceId: c.id,
          targetId: b.id,
          relationshipType: RELATIONSHIP_TYPES.STRUCTURAL_JUNCTION,
        })
      }
    }
  }

  // Base course
  if (facade.baseCourse) {
    const base = facade.baseCourse
    for (const part of base.parts ?? []) {
      const id = part.id
      components.push(
        makeComponent({
          id,
          parentId: base.id,
          assemblyId,
          componentType: COMPONENT_TYPES.BASE_COURSE,
          hierarchyLevel: 'PRIMARY',
          localTransform: identityTransform(),
          worldTransform: identityTransform(),
          boundingBox: {
            min: part.boundingMin,
            max: part.boundingMax,
            size: [
              part.boundingMax[0] - part.boundingMin[0],
              part.boundingMax[1] - part.boundingMin[1],
              part.boundingMax[2] - part.boundingMin[2],
            ],
          },
          geometryReference: { kind: 'mesh', meshId: part.mesh?.meta?.id ?? id },
          semanticTags: ['base-course'],
        }),
      )
      pushEdge(graphEdges, {
        sourceId: assemblyId,
        targetId: id,
        relationshipType: RELATIONSHIP_TYPES.PARENT_OF,
      })
      const extracted = extractPatchesFromMesh({
        mesh: part.mesh,
        componentId: id,
        componentType: COMPONENT_TYPES.BASE_COURSE,
        worldTransform: identityTransform(),
        surfaceIdPrefix: id,
        meshKind: 'box-solid',
        policy,
      })
      surfaces.push(...extracted.surfaces)
      patches.push(...extracted.patches)
      triangleRefs.push(...extracted.triangleRefs)
    }
  }

  // Growth zones (semantic / artistic categories)
  const zones = buildGrowthZones({
    components,
    surfaces,
    openings,
    facade,
    policy,
  })
  for (const z of zones) {
    for (const sid of z.surfaceIds) {
      pushEdge(graphEdges, {
        sourceId: z.zoneId,
        targetId: sid,
        relationshipType: RELATIONSHIP_TYPES.ZONE_MEMBER,
      })
    }
  }

  // Honest joint status: no stone-block segmentation in current generators
  const jointDataStatus = JOINT_DATA_UNAVAILABLE
  warnings.push(
    'JOINT_DATA_UNAVAILABLE: geometry has no explicit masonry block segmentation; tessellation edges are not exposed as stone joints',
  )

  // Dangling reference scrub
  const knownIds = new Set([
    ...components.map((c) => c.id),
    ...surfaces.map((s) => s.surfaceId),
    ...patches.map((p) => p.patchId),
    ...zones.map((z) => z.zoneId),
    ...features.map((f) => f.featureId),
    ...openings.map((o) => o.openingId),
  ])
  // Pier ids referenced by bays before synthetic pier nodes — already added
  for (const bay of facade.bays ?? []) {
    if (bay.leftPierId) knownIds.add(bay.leftPierId)
    if (bay.rightPierId) knownIds.add(bay.rightPierId)
  }
  const cleanEdges = graphEdges.filter((e) => {
    // Allow feature construction edge targets
    if (e.targetId?.includes('-outer-construction-edge')) return knownIds.has(e.sourceId)
    if (!knownIds.has(e.sourceId) || !knownIds.has(e.targetId)) {
      // Tracery may reference members not yet typed — drop dangling only
      return false
    }
    return true
  })
  // Re-add construction feature ids
  for (const f of features) knownIds.add(f.featureId)
  const edges2 = [
    ...cleanEdges,
    ...graphEdges.filter(
      (e) =>
        e.targetId?.includes('-outer-construction-edge') &&
        knownIds.has(e.sourceId),
    ),
  ]

  const baseModel = {
    ok: errors.length === 0,
    type: 'ARCHITECTURAL_SURFACE_SEMANTICS',
    geometryVersion,
    assemblyId,
    components,
    surfaces,
    patches,
    features,
    openings,
    zones,
    featureGraph: {
      nodes: [...knownIds].map((id) => ({ id })),
      edges: edges2,
    },
    triangleRefs,
    jointDataStatus,
    policy: { ...policy },
    errors,
    warnings,
    metadata: {
      grammarStage: '13E.3',
      references: ['REF-004', 'REF-002', 'REF-013', 'REF-008', 'REF-011'],
      note: 'Semantic substrate for future vegetation — no plants generated',
    },
  }

  return applyGrowthPolicy(baseModel, policy)
}

function buildGrowthZones({ components, surfaces, openings, facade, policy }) {
  const zones = []
  const byComponent = new Map(components.map((c) => [c.id, c]))
  const surfacesOf = (pred) =>
    surfaces.filter((s) => {
      const c = byComponent.get(s.componentId)
      return c && pred(c, s)
    })

  const structural = surfacesOf((c) =>
    [
      COMPONENT_TYPES.PIER_CORE,
      COMPONENT_TYPES.ENGAGED_SHAFT,
      COMPONENT_TYPES.BUTTRESS,
      COMPONENT_TYPES.BUTTRESS_STAGE,
      COMPONENT_TYPES.BASE_COURSE,
      COMPONENT_TYPES.PIER_BASE,
    ].includes(c.componentType),
  )
  zones.push({
    zoneId: `${facade.id}-zone-structural`,
    zoneType: GROWTH_ZONES.STRUCTURAL_COLONIZATION,
    weight: policy.structuralGrowthWeight,
    surfaceIds: structural.map((s) => s.surfaceId),
    componentIds: [...new Set(structural.map((s) => s.componentId))],
    precedence: ZONE_PRECEDENCE[GROWTH_ZONES.STRUCTURAL_COLONIZATION],
  })

  const arch = surfacesOf(
    (c, s) =>
      c.componentType === COMPONENT_TYPES.OUTER_ARCH ||
      s.surfaceType === SURFACE_TYPES.INTRADOS ||
      s.surfaceType === SURFACE_TYPES.EXTRADOS,
  )
  zones.push({
    zoneId: `${facade.id}-zone-arch`,
    zoneType: GROWTH_ZONES.ARCH_FOLLOWING,
    weight: 0.6,
    surfaceIds: arch.map((s) => s.surfaceId),
    componentIds: [...new Set(arch.map((s) => s.componentId))],
    precedence: ZONE_PRECEDENCE[GROWTH_ZONES.ARCH_FOLLOWING],
  })

  const tracery = surfacesOf((c) =>
    [
      COMPONENT_TYPES.PRIMARY_MULLION,
      COMPONENT_TYPES.SECONDARY_TRACERY,
      COMPONENT_TYPES.TERTIARY_TRACERY,
      COMPONENT_TYPES.FOIL,
      COMPONENT_TYPES.CAPITAL,
    ].includes(c.componentType),
  )
  // Tracery members may lack mesh surfaces; still register zone with component ids
  zones.push({
    zoneId: `${facade.id}-zone-tracery`,
    zoneType: GROWTH_ZONES.TRACERY_ORNAMENT,
    weight: policy.traceryGrowthWeight,
    surfaceIds: tracery.map((s) => s.surfaceId),
    componentIds: components
      .filter((c) =>
        [
          COMPONENT_TYPES.PRIMARY_MULLION,
          COMPONENT_TYPES.SECONDARY_TRACERY,
          COMPONENT_TYPES.TERTIARY_TRACERY,
          COMPONENT_TYPES.FOIL,
        ].includes(c.componentType),
      )
      .map((c) => c.id),
    precedence: ZONE_PRECEDENCE[GROWTH_ZONES.TRACERY_ORNAMENT],
  })

  const recessed = surfaces.filter(
    (s) =>
      s.surfaceType === SURFACE_TYPES.RECESS || s.surfaceType === SURFACE_TYPES.INTRADOS,
  )
  zones.push({
    zoneId: `${facade.id}-zone-recess`,
    zoneType: GROWTH_ZONES.RECESSED_GROWTH,
    weight: policy.recessedGrowthWeight,
    surfaceIds: recessed.map((s) => s.surfaceId),
    componentIds: [...new Set(recessed.map((s) => s.componentId))],
    precedence: ZONE_PRECEDENCE[GROWTH_ZONES.RECESSED_GROWTH],
  })

  zones.push({
    zoneId: `${facade.id}-zone-protected`,
    zoneType: GROWTH_ZONES.PROTECTED_OPENING,
    weight: 0,
    surfaceIds: [], // intentionally empty — voids are not surfaces
    openingIds: openings.map((o) => o.openingId),
    componentIds: [...new Set(openings.map((o) => o.componentId))],
    precedence: ZONE_PRECEDENCE[GROWTH_ZONES.PROTECTED_OPENING],
    note: 'Prevents growth in empty window space; never invents growable patches',
  })

  // Sacred facade: front-facing structural + outer arch surfaces
  const sacred = surfaces.filter((s) => {
    const c = byComponent.get(s.componentId)
    if (!c) return false
    if (s.surfaceType !== SURFACE_TYPES.FRONT_FACE && s.surfaceType !== SURFACE_TYPES.INTRADOS) {
      return false
    }
    return [
      COMPONENT_TYPES.PIER_CORE,
      COMPONENT_TYPES.ENGAGED_SHAFT,
      COMPONENT_TYPES.BUTTRESS,
      COMPONENT_TYPES.BUTTRESS_STAGE,
      COMPONENT_TYPES.OUTER_ARCH,
      COMPONENT_TYPES.BASE_COURSE,
    ].includes(c.componentType)
  })
  zones.push({
    zoneId: `${facade.id}-zone-sacred`,
    zoneType: GROWTH_ZONES.SACRED_FACADE,
    weight: policy.sacredFacadeEmphasis,
    surfaceIds: sacred.map((s) => s.surfaceId),
    componentIds: [...new Set(sacred.map((s) => s.componentId))],
    precedence: ZONE_PRECEDENCE[GROWTH_ZONES.SACRED_FACADE],
  })

  return zones
}

/**
 * Attach semantics onto a facade object (non-mutating shallow copy).
 */
export function attachSurfaceSemantics(facade, policyInput = {}) {
  const surfaceSemantics = extractFacadeSurfaceSemantics(facade, policyInput)
  return {
    ...facade,
    surfaceSemantics,
    metrics: {
      ...facade.metrics,
      surfaceSemantics: surfaceSemantics.diagnostics,
    },
  }
}

export function validateSurfaceSemantics(model, { previous = null } = {}) {
  const errors = []
  const warnings = []
  if (!model) {
    return { ok: false, errors: ['missing model'], warnings }
  }
  const ids = new Set()
  for (const c of model.components ?? []) {
    if (!c.id) errors.push('component missing id')
    if (ids.has(c.id)) errors.push(`duplicate component id ${c.id}`)
    ids.add(c.id)
    if (!COMPONENT_TYPES[c.componentType] && !Object.values(COMPONENT_TYPES).includes(c.componentType)) {
      errors.push(`unknown componentType ${c.componentType}`)
    }
    if (c.parentId && c.parentId !== null) {
      // parent may be pier aggregate
    }
  }
  for (const s of model.surfaces ?? []) {
    if (!s.surfaceId) errors.push('surface missing surfaceId')
    if (ids.has(s.surfaceId)) errors.push(`id collision ${s.surfaceId}`)
    ids.add(s.surfaceId)
    if (!(s.area >= 0)) errors.push(`${s.surfaceId} negative area`)
    if (!(s.growthWeight >= 0 && s.growthWeight <= 1)) {
      errors.push(`${s.surfaceId} growthWeight out of range`)
    }
    if (s.growthEligibility === GROWTH_ELIGIBILITY.PROHIBITED && s.growthWeight !== 0) {
      errors.push(`${s.surfaceId} prohibited with nonzero weight`)
    }
    const n = s.worldNormal
    const len = Math.hypot(n?.[0] ?? 0, n?.[1] ?? 0, n?.[2] ?? 0)
    if (!(Math.abs(len - 1) < 1e-3)) errors.push(`${s.surfaceId} worldNormal not unit`)
    if (!model.components.find((c) => c.id === s.componentId)) {
      errors.push(`${s.surfaceId} dangling componentId`)
    }
  }
  for (const p of model.patches ?? []) {
    if (!p.patchId) errors.push('patch missing id')
    if (!(p.area >= 0)) errors.push(`${p.patchId} negative area`)
    if (!model.surfaces.find((s) => s.surfaceId === p.surfaceId)) {
      errors.push(`${p.patchId} dangling surfaceId`)
    }
  }
  for (const o of model.openings ?? []) {
    if (o.growableSurface) errors.push(`${o.openingId} marked growable (forbidden)`)
    if ((o.area ?? 0) < 0) errors.push(`${o.openingId} negative area`)
  }
  // No empty-space growable patches: every patch must belong to a mesh component
  for (const p of model.patches ?? []) {
    const c = model.components.find((x) => x.id === p.componentId)
    if (!c) errors.push(`${p.patchId} missing component`)
    if (c?.componentType === COMPONENT_TYPES.WINDOW && p.growthWeight > 0) {
      // WINDOW container itself should not host growable patches; stone-shell is OUTER_ARCH
      errors.push(`${p.patchId} growable on WINDOW container`)
    }
  }
  if (model.jointDataStatus !== JOINT_DATA_UNAVAILABLE) {
    // If joints claimed, ensure none are tessellation mislabeled as stone joints
    for (const f of model.features ?? []) {
      if (f.kind === FEATURE_KINDS.STONE_JOINT && f.edgeKind === EDGE_KINDS.MESH_TESSELLATION_EDGE) {
        errors.push(`${f.featureId} fabricated masonry joint from tessellation`)
      }
    }
  } else {
    for (const f of model.features ?? []) {
      if (f.kind === FEATURE_KINDS.STONE_JOINT) {
        errors.push(`${f.featureId} stone joint present while JOINT_DATA_UNAVAILABLE`)
      }
    }
  }
  for (const e of model.featureGraph?.edges ?? []) {
    // construction edge targets may be feature ids
    const okSource =
      (model.featureGraph.nodes ?? []).some((n) => n.id === e.sourceId) ||
      ids.has(e.sourceId) ||
      (model.features ?? []).some((f) => f.featureId === e.sourceId)
    const okTarget =
      (model.featureGraph.nodes ?? []).some((n) => n.id === e.targetId) ||
      ids.has(e.targetId) ||
      (model.features ?? []).some((f) => f.featureId === e.targetId) ||
      String(e.targetId).includes('-outer-construction-edge')
    if (!okSource || !okTarget) {
      errors.push(`dangling graph edge ${e.sourceId} → ${e.targetId}`)
    }
  }
  if (previous?.geometryVersion && previous.geometryVersion === model.geometryVersion) {
    // IDs must be stable across identical regenerations
    const prevC = new Set((previous.components ?? []).map((c) => c.id))
    const nextC = new Set((model.components ?? []).map((c) => c.id))
    for (const id of prevC) {
      if (!nextC.has(id)) errors.push(`unstable component id lost: ${id}`)
    }
  }
  if (previous && previous.geometryVersion !== model.geometryVersion) {
    // After geometry change, old surface ids must not linger as the only set —
    // checked by caller comparing sets; here just note versions differ.
  }
  return { ok: errors.length === 0, errors, warnings: [...warnings, ...(model.warnings ?? [])] }
}
