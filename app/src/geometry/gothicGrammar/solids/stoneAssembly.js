/**
 * Assemble STRUCTURAL_STONE + DECORATIVE_MOLDINGS from Step 13C.1 regions (Step 13D).
 *
 * Exact 2D edges remain the source of truth; polylines are tessellation only.
 * Combined assembly is NOT a single boolean-union solid.
 */

import { REGION_TYPES, structuralHoleKeys } from '../tracery/regionRoles.js'
import { sampleLoop } from '../tracery/openingLoops.js'
import { buildSolidVoidModel } from '../tracery/solidVoid.js'
import { barNetworkHoleKeys } from '../tracery/barNetworkStone.js'
import { elaborateHoleKeys } from '../tracery/elaborate/elaborateSolidVoid.js'
import { skeletonHoleKeys } from '../tracery/skeleton/skeletonStone.js'
import { memberClassForRole, scaleProfileParams } from '../tracery/memberHierarchy.js'
import {
  extrudeRegion,
  depthRange,
  DEPTH_ALIGNMENTS,
  TESSELLATION_QUALITY,
} from './regionExtrusion.js'
import { buildProfile, PROFILE_TYPES, DEFAULT_PROFILE_PARAMS } from './profileLibrary.js'
import { sweepProfile } from './profileSweep.js'
import { buildJunctionReport } from './stoneJunctions.js'
import { validateMesh, boundingBox, triangleCount, vertexCount } from './meshValidation.js'

export const MESH_GROUPS = Object.freeze({
  STRUCTURAL_STONE: 'STRUCTURAL_STONE',
  DECORATIVE_MOLDINGS: 'DECORATIVE_MOLDINGS',
})

export const DEFAULT_STONE_PARAMS = Object.freeze({
  stoneDepth: 0.25,
  depthAlignment: DEPTH_ALIGNMENTS.CENTERED,
  tessellation: 'standard',
  moldingEnabled: true,
  profileType: PROFILE_TYPES.COMPOUND_GOTHIC,
  profileWidth: DEFAULT_PROFILE_PARAMS.profileWidth,
  profileDepth: DEFAULT_PROFILE_PARAMS.profileDepth,
  chamferSize: DEFAULT_PROFILE_PARAMS.chamferSize,
  beadRadius: DEFAULT_PROFILE_PARAMS.beadRadius,
  recessDepth: DEFAULT_PROFILE_PARAMS.recessDepth,
  /** Scale molding outward; holes use inward (into void) as +s toward opening. */
  moldingOnOuter: true,
  moldingOnOpenings: true,
  /** Step 13D.2 — per-member profile depth/width hierarchy. */
  moldingHierarchy: false,
})

function tessellationSegments(quality) {
  const q = TESSELLATION_QUALITY[quality] ?? TESSELLATION_QUALITY.standard
  return q.segments
}

/**
 * Resample region edges at requested quality (exact edges unchanged).
 */
export function sampleRegionRing(region, segments) {
  if (!region?.edges?.length) {
    return (region?.samples ?? []).map((p) => ({ x: p.x, y: p.y }))
  }
  return sampleLoop(region.edges, { segments }).map((p) => ({ x: p.x, y: p.y }))
}

/**
 * Build 3D stone assembly from a validated solid/void model or params.
 *
 * @param {object} input
 * @param {object} [input.solidVoid] — existing buildSolidVoidModel result
 * @param {object} [input.regionParams] — passed to buildSolidVoidModel if solidVoid omitted
 * @param {object} [input.stone] — DEFAULT_STONE_PARAMS overrides
 */
export function buildStoneAssembly(input = {}) {
  const stone = { ...DEFAULT_STONE_PARAMS, ...(input.stone ?? {}) }
  const solidVoid = input.solidVoid?.validation?.ok
    ? input.solidVoid
    : buildSolidVoidModel(input.regionParams ?? input.params ?? {})

  if (!solidVoid?.validation?.ok) {
    return {
      ok: false,
      errors: solidVoid?.validation?.errors ?? ['solid/void model invalid — stop'],
      warnings: solidVoid?.validation?.warnings ?? [],
      groups: {},
      metrics: null,
      solidVoid,
      stone,
      junctions: null,
    }
  }

  const regions = solidVoid.regions
  const outerReg = regions[REGION_TYPES.OUTER_BOUNDARY]
  const includeSpandrels = Boolean(
    regions[REGION_TYPES.LEFT_SPANDREL_VOID]?.edges?.length &&
      regions[REGION_TYPES.RIGHT_SPANDREL_VOID]?.edges?.length,
  )
  const isSkeleton = Boolean(solidVoid.metrics?.skeleton || solidVoid.skeleton)
  const isSecondaryTracery = Boolean(
    isSkeleton &&
      (solidVoid.metrics?.secondaryTracery || solidVoid.parameters?.enableSecondaryTracery),
  )
  const isHierarchical = Boolean(
    isSkeleton &&
      (solidVoid.metrics?.hierarchicalTracery ||
        solidVoid.parameters?.enableHierarchicalTracery ||
        solidVoid.skeleton?.metadata?.enableHierarchicalTracery),
  )
  const isOculusRefinement = Boolean(
    isSkeleton &&
      (isHierarchical ||
        solidVoid.metrics?.oculusRefinement ||
        solidVoid.parameters?.enableOculusRefinement ||
        solidVoid.skeleton?.metadata?.enableOculusRefinement),
  )
  const isOculusNetwork = Boolean(
    isSkeleton &&
      (isSecondaryTracery ||
        isOculusRefinement ||
        isHierarchical ||
        solidVoid.metrics?.oculusNetwork ||
        solidVoid.parameters?.enableOculusNetwork),
  )
  const isBarNetwork = Boolean(
    !isSkeleton && (solidVoid.metrics?.barNetwork || solidVoid.network),
  )
  const isElaborate = Boolean(solidVoid.metrics?.elaborate || solidVoid.arrangement)
  const holeKeys = isSkeleton
    ? skeletonHoleKeys(solidVoid).filter((k) => regions[k]?.samples?.length)
    : isElaborate
      ? elaborateHoleKeys(solidVoid).filter((k) => regions[k]?.edges?.length)
      : isBarNetwork
        ? barNetworkHoleKeys(solidVoid).filter((k) => regions[k]?.edges?.length)
        : structuralHoleKeys({ includeSpandrels })
  const segs = tessellationSegments(stone.tessellation)

  // Skeleton: stone IS the strip-union polygon (samples), never outer⊕holes panel.
  let outer
  let holes
  if (isSkeleton && solidVoid.extrusion?.outer?.length) {
    outer = solidVoid.extrusion.outer.map((p) => ({ x: p.x, y: p.y }))
    holes = (solidVoid.extrusion.holes ?? []).map((h) => h.map((p) => ({ x: p.x, y: p.y })))
  } else {
    outer = sampleRegionRing(outerReg, segs)
    holes = holeKeys
      .map((k) => regions[k])
      .filter((r) => r?.validation?.ok !== false && (r?.edges?.length || r?.samples?.length))
      .map((r) => sampleRegionRing(r, segs))
  }

  if (outer.length < 3) {
    return {
      ok: false,
      errors: ['outer boundary tessellation failed'],
      warnings: [],
      groups: {},
      metrics: null,
      solidVoid,
      stone,
    }
  }

  const moldErrors = []
  const moldWarnings = []
  let structural
  try {
    structural = extrudeRegion({
      outer,
      holes,
      depth: stone.stoneDepth,
      alignment: stone.depthAlignment,
    })
    // Some tessellation densities yield Earcut pinch artifacts. Retry with
    // nearby segment counts known to stay manifold (exact curves unchanged).
    const extrusionAcceptable = (mesh) =>
      Boolean(mesh?.validation?.ok && mesh?.validation?.watertight)
    if (!extrusionAcceptable(structural)) {
      const retries = isElaborate
        ? [24, 32, 64, 28, 36, 40, 44, 48, 52, 56, 20, 16, 72, 12, 8]
        : [24, 28, 32, 40, 36, 44, 20, 16, 48, 56, 8]
      for (const alt of retries) {
        if (alt === segs) continue
        const outer2 = sampleRegionRing(outerReg, alt)
        const holes2 = holeKeys
          .map((k) => regions[k])
          .filter((r) => r?.validation?.ok !== false && (r?.edges?.length || r?.samples?.length))
          .map((r) => sampleRegionRing(r, alt))
        const attempt = extrudeRegion({
          outer: outer2,
          holes: holes2,
          depth: stone.stoneDepth,
          alignment: stone.depthAlignment,
        })
        if (extrusionAcceptable(attempt)) {
          structural = attempt
          moldWarnings.push(
            `tessellation ${stone.tessellation} (${segs}) produced invalid extrusion; used ${alt} segments for structural mesh`,
          )
          break
        }
      }
    }
  } catch (err) {
    return {
      ok: false,
      errors: [`extrusion failed: ${err.message}`],
      warnings: [],
      groups: {},
      metrics: null,
      solidVoid,
      stone,
    }
  }

  const { zFront } = depthRange(stone.stoneDepth, stone.depthAlignment)
  // Sit moldings slightly proud of the front face to reduce coplanar z-fighting.
  const moldingZOffset = zFront - stone.profileDepth / 2 + 0.002

  const profileParams = {
    type: stone.profileType,
    profileWidth: stone.profileWidth,
    profileDepth: stone.profileDepth,
    chamferSize: stone.chamferSize,
    beadRadius: stone.beadRadius,
    recessDepth: stone.recessDepth,
  }

  const decorativeMeshes = []
  const sweepRecords = []

  if (stone.moldingEnabled) {
    const paths = []
    if (stone.moldingOnOuter) {
      paths.push({ role: 'outer-frame', path: outer, outwardSign: 1 })
    }
    if (stone.moldingOnOpenings) {
      // Skip tiny foil/cusp voids — decorative sweeps on sharp cusps create end-cap / twist artifacts.
      // Not a miter claim; structural stone remains the strip-union extrusion.
      const minMoldingHoleArea = isOculusRefinement || isSecondaryTracery ? 0.012 : 0
      holeKeys.forEach((k, i) => {
        if (!holes[i]) return
        if (minMoldingHoleArea > 0) {
          let a = 0
          const ring = holes[i]
          for (let j = 0; j < ring.length; j += 1) {
            const p0 = ring[j]
            const p1 = ring[(j + 1) % ring.length]
            a += p0.x * p1.y - p1.x * p0.y
          }
          if (Math.abs(a * 0.5) < minMoldingHoleArea) {
            moldWarnings.push(`skip molding on tiny void ${k} (area gate)`)
            return
          }
        }
        // Hole rings are CW for earcut; walking CW, left normal points into hole (void).
        // We want molding protruding into the opening → outwardSign +1 with CW walk = into void.
        paths.push({ role: k, path: holes[i], outwardSign: 1 })
      })
    }

    for (const { role, path, outwardSign } of paths) {
      try {
        const memberClass = memberClassForRole(role)
        const roleParams = stone.moldingHierarchy
          ? scaleProfileParams(profileParams, memberClass)
          : profileParams
        const profile = buildProfile(roleParams)
        const roleZ =
          moldingZOffset +
          (stone.moldingHierarchy
            ? (roleParams.profileDepth - profileParams.profileDepth) * 0.15
            : 0)
        const swept = sweepProfile({
          path,
          profile,
          closed: true,
          outwardSign,
          zOffset: roleZ,
        })
        swept.meta.role = role
        swept.meta.memberClass = memberClass
        decorativeMeshes.push(swept.mesh)
        sweepRecords.push(swept)
      } catch (err) {
        moldWarnings.push(`sweep ${role}: ${err.message}`)
      }
    }
  }

  const junctions = buildJunctionReport(sweepRecords)

  const structuralValidation = structural.validation
  const ok = structuralValidation.ok && moldErrors.length === 0

  // Metrics — volume only for validated closed structural mesh
  const bbox = boundingBox(structural.mesh)
  const metrics = {
    boundingSize: bbox.size,
    boundingMin: bbox.min,
    boundingMax: bbox.max,
    structuralVolume: structuralValidation.watertight ? structuralValidation.volume : null,
    structuralVolumeAvailable: structuralValidation.watertight === true,
    surfaceArea: structuralValidation.surfaceArea ?? null,
    triangleCount: triangleCount(structural.mesh),
    vertexCount: vertexCount(structural.mesh),
    decorativeTriangleCount: decorativeMeshes.reduce((n, m) => n + triangleCount(m), 0),
    watertight: structuralValidation.watertight,
    nonManifoldEdgeCount: structuralValidation.edges?.nonManifoldEdgeCount ?? null,
    boundaryEdgeCount: structuralValidation.edges?.boundaryEdgeCount ?? null,
    invalidFaceCount: structuralValidation.faces?.invalidFaceCount ?? null,
    degenerateFaceCount: structuralValidation.faces?.degenerateFaceCount ?? null,
    stoneDepth: stone.stoneDepth,
    depthAlignment: stone.depthAlignment,
    tessellation: stone.tessellation,
    tessellationSegments: segs,
    combinedWatertightClaim: false,
    note: 'Volume/watertight apply to STRUCTURAL_STONE only; moldings are separate.',
  }

  const structuralDisplay = structural.displayMesh ?? structural.mesh

  return {
    ok,
    errors: [...(structuralValidation.errors ?? []), ...moldErrors],
    warnings: [...(structuralValidation.warnings ?? []), ...moldWarnings],
    groups: {
      [MESH_GROUPS.STRUCTURAL_STONE]: {
        meshes: [structuralDisplay],
        topologyMesh: structural.mesh,
        validation: structuralValidation,
      },
      [MESH_GROUPS.DECORATIVE_MOLDINGS]: {
        meshes: decorativeMeshes,
        validation: {
          ok: moldErrors.length === 0,
          watertight: false,
          note: 'Decorative sweeps are open strips — not individually watertight solids.',
        },
      },
    },
    structural: structuralDisplay,
    structuralTopology: structural.mesh,
    decorative: decorativeMeshes,
    metrics,
    junctions,
    solidVoid,
    stone,
    profileParams,
    meta: {
      version: isHierarchical
        ? '13D.9'
        : isOculusRefinement
          ? '13D.8'
          : isSecondaryTracery
            ? '13D.7'
            : isOculusNetwork
              ? '13D.6'
              : isSkeleton
                ? '13D.5'
                : isElaborate
                  ? '13D.4'
                  : isBarNetwork
                    ? '13D.3'
                    : '13D.2',
      coordinateMapping: { x: '2D X', y: '2D Y', z: 'stone depth' },
      unit: 'meter',
      hardEdgeDisplay: true,
      moldingHierarchy: Boolean(stone.moldingHierarchy),
      spandrelOpenings: includeSpandrels,
      barNetwork: isBarNetwork,
      elaborate: isElaborate,
      skeleton: isSkeleton,
      oculusNetwork: isOculusNetwork,
      secondaryTracery: isSecondaryTracery,
      oculusRefinement: isOculusRefinement,
      hierarchicalTracery: isHierarchical,
      hierarchicalDepth:
        solidVoid.metrics?.hierarchicalDepth ??
        solidVoid.skeleton?.hierarchy?.depth ??
        null,
      cellCount: solidVoid.metrics?.cellCount ?? solidVoid.skeleton?.hierarchy?.cellCount ?? null,
      acceptedSubdivisions:
        solidVoid.metrics?.acceptedSubdivisions ??
        solidVoid.skeleton?.hierarchy?.accepted ??
        null,
      rejectedSubdivisions:
        solidVoid.metrics?.rejectedSubdivisions ??
        solidVoid.skeleton?.hierarchy?.rejected ??
        null,
      grammarStage:
        solidVoid.metrics?.grammarStage ??
        solidVoid.skeleton?.metadata?.grammarStage ??
        (isHierarchical
          ? '13D.9'
          : isOculusRefinement
            ? '13D.8'
            : isSecondaryTracery
              ? '13D.7'
              : isOculusNetwork
                ? '13D.6'
                : isSkeleton
                  ? '13D.5'
                  : null),
      representation:
        solidVoid.metrics?.representation ??
        solidVoid.regions?.STONE_REGION?.source?.representation ??
        null,
      openingCount: isSkeleton
        ? solidVoid.metrics?.openingCount ?? holes.length
        : holeKeys.length,
      networkNodeCount:
        solidVoid.metrics?.nodeCount ??
        solidVoid.skeleton?.metadata?.nodeCount ??
        solidVoid.network?.metrics?.nodeCount ??
        null,
      networkMemberCount:
        solidVoid.metrics?.memberCount ??
        solidVoid.skeleton?.metadata?.memberCount ??
        solidVoid.network?.metrics?.memberCount ??
        null,
      stoneComponentCount: solidVoid.metrics?.stripComponentCount ?? null,
      nestingDepth: solidVoid.metrics?.nestingDepth ?? null,
      openingToEnvelopeRatio: solidVoid.metrics?.openingToEnvelopeRatio ?? null,
      architecturePreset: stone.architecturePreset ?? solidVoid.parameters?.architecturePreset ?? null,
      secondaryTraceryLevel: solidVoid.metrics?.secondaryTraceryLevel ?? null,
    },
  }
}

/**
 * Regenerate only when geometry-affecting params change (callers should memoize keys).
 */
export function stoneGeometryKey(traceryParams, stoneParams) {
  return JSON.stringify({
    t: traceryParams,
    s: {
      stoneDepth: stoneParams.stoneDepth,
      depthAlignment: stoneParams.depthAlignment,
      tessellation: stoneParams.tessellation,
      moldingEnabled: stoneParams.moldingEnabled,
      profileType: stoneParams.profileType,
      profileWidth: stoneParams.profileWidth,
      profileDepth: stoneParams.profileDepth,
      chamferSize: stoneParams.chamferSize,
      beadRadius: stoneParams.beadRadius,
      recessDepth: stoneParams.recessDepth,
      moldingOnOuter: stoneParams.moldingOnOuter,
      moldingOnOpenings: stoneParams.moldingOnOpenings,
      moldingHierarchy: stoneParams.moldingHierarchy,
    },
  })
}

export function validateStructuralOnly(assembly) {
  const mesh = assembly?.structural
  if (!mesh) return { ok: false, errors: ['no structural mesh'] }
  return validateMesh(mesh, { requireWatertight: true })
}
