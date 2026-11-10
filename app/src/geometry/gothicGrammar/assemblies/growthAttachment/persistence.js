/**
 * Anchor persistence across geometry edits (13E.4).
 *
 * SAME TOPOLOGY → recompute world from local
 * SURFACE EXISTS → reproject (REPROJECTED)
 * SURFACE REMOVED → ORPHANED (never silent reattach)
 * NOW PROHIBITED → BLOCKED
 */

import { GROWTH_ELIGIBILITY } from '../surfaceSemanticsTypes.js'
import {
  ANCHOR_STATUS,
  ANCHOR_SCOPES,
  createGrowthAnchor,
  dist3,
  normalize3,
} from './types.js'
import { buildSurfaceFrame } from './frames.js'
import { createAnchorOnPatch } from './anchors.js'

/**
 * Facade rebuilds bump `facade-N` prefixes; stable keys strip that counter
 * so anchors can reproject across compatible regenerations.
 */
export function stableSemanticKey(id) {
  if (!id) return ''
  return String(id).replace(/^facade-\d+/, 'facade-*')
}

/** Normalize geometry signatures so volatile facade-N prefixes do not force reproject. */
export function stableGeometrySignature(sig) {
  if (!sig) return ''
  return String(sig).replace(/^facade-\d+/, 'facade')
}

/**
 * Rebind an attachment state onto a new semantics model.
 * Never silently deletes seeds.
 */
export function rebindGrowthAnchors(previousState, semantics, options = {}) {
  const prev = previousState?.anchors ?? []
  if (!prev.length) {
    return {
      ...emptyLike(previousState, semantics),
      anchors: [],
      diagnostics: zeroDiag(),
    }
  }

  const patchById = new Map((semantics?.patches ?? []).map((p) => [p.patchId, p]))
  const patchByStable = new Map()
  for (const p of semantics?.patches ?? []) {
    patchByStable.set(stableSemanticKey(p.patchId), p)
  }
  const surfaceById = new Map((semantics?.surfaces ?? []).map((s) => [s.surfaceId, s]))
  const surfaceByStable = new Map()
  for (const s of semantics?.surfaces ?? []) {
    surfaceByStable.set(stableSemanticKey(s.surfaceId), s)
  }
  const componentById = new Map((semantics?.components ?? []).map((c) => [c.id, c]))
  const componentByStable = new Map()
  for (const c of semantics?.components ?? []) {
    componentByStable.set(stableSemanticKey(c.id), c)
  }

  const sameTopology =
    Boolean(previousState?.geometrySignature) &&
    stableGeometrySignature(previousState.geometrySignature) ===
      stableGeometrySignature(semantics?.geometryVersion ?? '')

  const next = []
  const diagnostics = zeroDiag()

  for (const anchor of prev) {
    // Instance-specific: drop only if bay instance vanished — mark ORPHANED
    if (anchor.scope === ANCHOR_SCOPES.ASSEMBLY_INSTANCE && anchor.bayId) {
      const bayStillExists = (semantics?.components ?? []).some(
        (c) => c.bayId === anchor.bayId || c.id === anchor.bayId,
      )
      // Also accept window module bay ids via component tags
      const bayOk =
        bayStillExists ||
        (semantics?.components ?? []).some((c) => String(c.id).includes(String(anchor.bayId)))
      if (!bayOk && options.bayCountChanged) {
        const orphaned = { ...anchor, status: ANCHOR_STATUS.ORPHANED }
        orphaned.metadata = {
          ...(anchor.metadata ?? {}),
          orphanReason: 'bay instance removed',
        }
        next.push(orphaned)
        diagnostics.orphaned += 1
        continue
      }
    }

    let patch =
      patchById.get(anchor.patchId) ?? patchByStable.get(stableSemanticKey(anchor.patchId))
    const surface =
      surfaceById.get(anchor.surfaceId) ??
      surfaceByStable.get(stableSemanticKey(anchor.surfaceId))
    const component =
      componentById.get(anchor.componentId) ??
      componentByStable.get(stableSemanticKey(anchor.componentId))

    // B-assist: patch id gone but component/surface still exists → nearest same-component patch
    if (!patch && (component || surface)) {
      const stableComp = stableSemanticKey(anchor.componentId)
      const stableSurf = stableSemanticKey(anchor.surfaceId)
      const candidates = (semantics.patches ?? []).filter((p) => {
        if (component && stableSemanticKey(p.componentId) === stableComp) return true
        if (surface && stableSemanticKey(p.surfaceId) === stableSurf) return true
        return false
      })
      let best = null
      let bestD = Infinity
      for (const p of candidates) {
        const c = p.worldTransform?.position
        if (!c) continue
        const d = dist3(c, anchor.worldPosition)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      if (best) patch = best
    }

    // C: original surface removed
    if (!patch && !surface && !component) {
      const orphaned = {
        ...anchor,
        status: ANCHOR_STATUS.ORPHANED,
        metadata: {
          ...(anchor.metadata ?? {}),
          orphanReason: 'surface/patch removed',
        },
      }
      next.push(orphaned)
      diagnostics.orphaned += 1
      continue
    }

    // D: surface now prohibited
    const elig =
      patch?.growthEligibility ?? surface?.growthEligibility ?? anchor.eligibility
    if (elig === GROWTH_ELIGIBILITY.PROHIBITED) {
      next.push({
        ...anchor,
        eligibility: elig,
        status: ANCHOR_STATUS.BLOCKED,
        metadata: {
          ...(anchor.metadata ?? {}),
          blockReason: 'surface now PROHIBITED',
        },
      })
      diagnostics.blocked += 1
      continue
    }

    if (sameTopology && patch) {
      // A: recompute world from local attachment using patch frame
      const world = recomputeWorldFromLocal(anchor, patch, component, surface)
      next.push({
        ...world,
        status: ANCHOR_STATUS.VALID,
        geometrySignature: semantics.geometryVersion ?? '',
        eligibility: elig,
      })
      diagnostics.valid += 1
      continue
    }

    // B: geometry changed but surface/patch exists → reproject
    if (patch) {
      const targetPos = anchor.worldPosition
      const n = normalize3(patch.representativeNormal ?? [0, 0, 1])
      const c = patch.worldTransform?.position ?? targetPos
      const toP = [
        targetPos[0] - c[0],
        targetPos[1] - c[1],
        targetPos[2] - c[2],
      ]
      const signed = toP[0] * n[0] + toP[1] * n[1] + toP[2] * n[2]
      const projected = [
        targetPos[0] - n[0] * signed,
        targetPos[1] - n[1] * signed,
        targetPos[2] - n[2] * signed,
      ]
      // Prefer staying on same patch; if far, try same surface patches
      let usePatch = patch
      let usePos = projected
      if (dist3(projected, c) > Math.sqrt(Math.max(patch.area ?? 0, 1e-6) / Math.PI) * 2.5) {
        const sameSurf = (semantics.patches ?? []).filter(
          (p) => p.surfaceId === anchor.surfaceId || p.componentId === anchor.componentId,
        )
        let best = patch
        let bestD = Infinity
        for (const p of sameSurf) {
          const pc = p.worldTransform?.position
          if (!pc) continue
          const d = dist3(pc, targetPos)
          if (d < bestD) {
            bestD = d
            best = p
          }
        }
        usePatch = best
        const bn = normalize3(best.representativeNormal ?? [0, 0, 1])
        const bc = best.worldTransform?.position ?? targetPos
        const tp = [
          targetPos[0] - bc[0],
          targetPos[1] - bc[1],
          targetPos[2] - bc[2],
        ]
        const s = tp[0] * bn[0] + tp[1] * bn[1] + tp[2] * bn[2]
        usePos = [
          targetPos[0] - bn[0] * s,
          targetPos[1] - bn[1] * s,
          targetPos[2] - bn[2] * s,
        ]
      }

      const created = createAnchorOnPatch(semantics, usePatch, {
        anchorId: anchor.anchorId,
        worldPosition: usePos,
        localPosition: anchor.localPosition,
        status: ANCHOR_STATUS.REPROJECTED,
        seedType: anchor.seedType,
        scope: anchor.scope,
        instanceId: anchor.instanceId,
        bayId: anchor.bayId,
        masterAnchorId: anchor.masterAnchorId,
        allowRestricted: true,
        metadata: {
          ...(anchor.metadata ?? {}),
          previousStatus: anchor.status,
          reprojectDelta: dist3(anchor.worldPosition, usePos),
        },
      })
      if (created.ok) {
        next.push(created.anchor)
        diagnostics.reprojected += 1
      } else {
        next.push({
          ...anchor,
          status: ANCHOR_STATUS.ORPHANED,
          metadata: {
            ...(anchor.metadata ?? {}),
            orphanReason: created.reason ?? 'reproject failed',
          },
        })
        diagnostics.orphaned += 1
      }
      continue
    }

    // Surface exists without patch — keep blocked/orphan
    next.push({
      ...anchor,
      status: ANCHOR_STATUS.ORPHANED,
      metadata: {
        ...(anchor.metadata ?? {}),
        orphanReason: 'patch missing on existing surface',
      },
    })
    diagnostics.orphaned += 1
  }

  return {
    type: 'GROWTH_ATTACHMENT_STATE',
    geometrySignature: semantics?.geometryVersion ?? '',
    anchors: next,
    navigationGraph: previousState?.navigationGraph ?? null,
    lastPath: previousState?.lastPath ?? null,
    distributionReport: previousState?.distributionReport ?? null,
    diagnostics: {
      ...diagnostics,
      acceptedSeeds: next.filter((a) => a.status === ANCHOR_STATUS.VALID || a.status === ANCHOR_STATUS.REPROJECTED)
        .length,
      requestedSeeds: prev.length,
    },
  }
}

function recomputeWorldFromLocal(anchor, patch, component, surface) {
  const frame = buildSurfaceFrame({
    position: patch.worldTransform?.position ?? anchor.worldPosition,
    normal: patch.representativeNormal ?? anchor.worldNormal,
    componentType: component?.componentType ?? anchor.metadata?.componentType,
    surfaceType: surface?.surfaceType ?? anchor.metadata?.surfaceType,
  })
  // Parametric: localPosition stored as world-ish offset in current pipeline —
  // prefer patch centroid + tangential offset encoded in metadata if present.
  const offset = anchor.metadata?.localOffset
  let world = patch.worldTransform?.position?.slice?.() ?? anchor.worldPosition.slice()
  if (Array.isArray(offset) && offset.length >= 2) {
    world = [
      world[0] + frame.tangentU[0] * offset[0] + frame.tangentV[0] * offset[1],
      world[1] + frame.tangentU[1] * offset[0] + frame.tangentV[1] * offset[1],
      world[2] + frame.tangentU[2] * offset[0] + frame.tangentV[2] * offset[1],
    ]
  } else {
    // Keep relative vector from previous patch center if available
    world = anchor.worldPosition.slice()
  }

  return createGrowthAnchor({
    ...anchor,
    worldPosition: world,
    worldNormal: frame.normal,
    tangentU: frame.tangentU,
    tangentV: frame.tangentV,
    localNormal: normalize3(patch.localCoordinates?.normal ?? frame.normal),
    patchId: patch.patchId,
    surfaceId: patch.surfaceId,
    componentId: patch.componentId,
    geometrySignature: patch.geometrySignature ?? anchor.geometrySignature,
  })
}

/**
 * Instantiate master-module anchors across assembly bay transforms.
 */
export function instantiateMasterAnchors(masterAnchors, facade, options = {}) {
  const instances = []
  const modules = facade?.windowModules ?? []
  for (const master of masterAnchors ?? []) {
    if (master.scope !== ANCHOR_SCOPES.MASTER_MODULE && !options.forceMaster) continue
    for (const mod of modules) {
      const t = mod.transform?.position ?? [0, 0, 0]
      // Assemblies currently translate only (no rotation) — normals unchanged
      const worldPosition = [
        (master.metadata?.masterLocalPosition?.[0] ?? master.worldPosition[0]) + t[0],
        (master.metadata?.masterLocalPosition?.[1] ?? master.worldPosition[1]) + t[1],
        (master.metadata?.masterLocalPosition?.[2] ?? master.worldPosition[2]) + t[2],
      ]
      // If master already in world of bay0, compute delta from bay0
      const bay0 = modules[0]?.transform?.position ?? [0, 0, 0]
      const local = [
        master.worldPosition[0] - bay0[0],
        master.worldPosition[1] - bay0[1],
        master.worldPosition[2] - bay0[2],
      ]
      const instPos = [local[0] + t[0], local[1] + t[1], local[2] + t[2]]
      instances.push(
        createGrowthAnchor({
          ...master,
          anchorId: `${master.anchorId}::${mod.id}`,
          worldPosition: instPos,
          worldNormal: normalize3(master.worldNormal),
          tangentU: normalize3(master.tangentU),
          tangentV: normalize3(master.tangentV),
          scope: ANCHOR_SCOPES.ASSEMBLY_INSTANCE,
          instanceId: mod.id,
          bayId: mod.bayId ?? mod.id,
          masterAnchorId: master.anchorId,
          metadata: {
            ...(master.metadata ?? {}),
            instantiatedFrom: master.anchorId,
            moduleId: mod.id,
          },
        }),
      )
    }
  }
  return instances
}

function emptyLike(prev, semantics) {
  return {
    type: 'GROWTH_ATTACHMENT_STATE',
    geometrySignature: semantics?.geometryVersion ?? '',
    anchors: [],
    navigationGraph: prev?.navigationGraph ?? null,
    lastPath: null,
    distributionReport: null,
  }
}

function zeroDiag() {
  return {
    valid: 0,
    reprojected: 0,
    blocked: 0,
    orphaned: 0,
    acceptedSeeds: 0,
    requestedSeeds: 0,
  }
}
