/**
 * Step 14A.1.2.1 — Parametric motif composition rooted on shared growth anchors.
 * Default: SYMMETRICAL GOTHIC SPANDREL SCROLL
 *
 * Authoritative initiation: GrowthAttachment anchors (Architectural Assembly).
 * Motif root MUST coincide with sourceAnchorId — no independent decorative origins.
 */

import {
  DEFAULT_PARAMETRIC_MOTIF_SETTINGS,
  MOTIF_TYPES,
  CURVE_ROLES,
  ROOT_ANCHOR_TOLERANCE,
  emptyParametricMotif,
  mulberry32,
  createCurveMember,
  dist3,
  add3,
  scale3,
} from './types.js'
import {
  buildHostsFromAnchors,
  selectHostByAnchorId,
  localToWorld,
} from './hostFrame.js'
import {
  buildRibbedSpine,
  buildGothicVolute,
  buildSecondaryCurl,
  mirrorCurveLocal,
  validateCurveContinuity,
  polylineLength,
} from './primitives.js'

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

export function parametricMotifCacheKey(geometrySignature, anchorIds, params) {
  const p = { ...DEFAULT_PARAMETRIC_MOTIF_SETTINGS, ...params }
  return JSON.stringify({
    v: '14A.1.2.1',
    g: geometrySignature ?? '',
    a: [...(anchorIds ?? [])],
    selectedAnchorId: p.selectedAnchorId ?? null,
    singleHost: p.singleHost === true,
    motifType: p.motifType,
    motifScale: p.motifScale,
    scrollTurns: p.scrollTurns,
    curlStrength: p.curlStrength,
    symmetryStrength: p.symmetryStrength,
    branchHierarchy: p.branchHierarchy,
    creatureInfluence: p.creatureInfluence,
    randomSeed: p.randomSeed,
    primarySpineCurvature: p.primarySpineCurvature,
    voluteRadius: p.voluteRadius,
    voluteTightness: p.voluteTightness,
    secondaryCurlScale: p.secondaryCurlScale,
    branchAttachmentPosition: p.branchAttachmentPosition,
    negativeSpaceClearance: p.negativeSpaceClearance,
    motifRotation: p.motifRotation,
    motifOffsetU: p.motifOffsetU,
    motifOffsetV: p.motifOffsetV,
    showPrimarySpine: p.showPrimarySpine,
    showPrimaryVolutes: p.showPrimaryVolutes,
    showSecondaryCurls: p.showSecondaryCurls,
    hostKind: p.hostKind,
    maxMotifs: p.maxMotifs,
  })
}

/**
 * Root-to-anchor distance (planar + world). Root sample uses same nOff as curves.
 */
export function measureRootAnchorDistance(host, spine, nOff = 0.025) {
  if (!host?.origin || !spine?.points?.length) {
    return { ok: false, distance: Infinity, reason: 'missing-root' }
  }
  const expected = localToWorld(
    host.origin,
    host.axisU,
    host.axisV,
    host.normal,
    0,
    0,
    nOff,
  )
  const root = spine.points[0]
  const distance = dist3(root, expected)
  const toAnchor = dist3(root, add3(host.origin, scale3(host.normal, nOff)))
  return {
    ok: distance <= ROOT_ANCHOR_TOLERANCE && toAnchor <= ROOT_ANCHOR_TOLERANCE * 2,
    distance,
    toAnchor,
    expected,
    root,
  }
}

/**
 * Compose one symmetrical Gothic spandrel scroll rooted at host.origin (= anchor).
 */
export function composeSymmetricalSpandrelScroll(host, params = {}) {
  const cfg = { ...DEFAULT_PARAMETRIC_MOTIF_SETTINGS, ...params }
  const rand = mulberry32(
    (((cfg.randomSeed ?? 42) >>> 0) +
      String(host.sourceAnchorId ?? host.id)
        .split('')
        .reduce((s, ch) => s + ch.charCodeAt(0), 0)) >>>
      0,
  )
  const scale = Math.max(0.35, cfg.motifScale ?? 1)
  const curlAmt = clamp01(cfg.curlStrength ?? 0.7)
  const turns = Math.max(0.4, (cfg.scrollTurns ?? 1.25) * lerp(0.7, 1.25, curlAmt))
  const symmetry = clamp01(cfg.symmetryStrength ?? 1)
  const hierarchy = clamp01(cfg.branchHierarchy ?? 0.65)
  const creature = clamp01(cfg.creatureInfluence ?? 0.3)
  const clearance = Math.max(0.02, cfg.negativeSpaceClearance ?? 0.06)

  const areaW = Math.max(0.15, host.area.uMax - host.area.uMin)
  const areaH = Math.max(0.15, host.area.vMax - host.area.vMin)
  const fitScale = Math.min(1, Math.min(areaW, areaH) / 0.85) * scale

  // Composition offsets may shift subordinate elements — NEVER the root (must stay at anchor).
  const offU = (cfg.motifOffsetU ?? 0) * areaW * 0.35
  const tipBiasV = Math.max(0, (cfg.motifOffsetV ?? 0.05) * areaH * 0.12)

  const curves = []
  const invalid = []

  // 1. Primary spine — ROOT exactly at anchor UV (0,0), grow along +V
  const spineLen = Math.min(areaH * 0.78, host.area.vMax - 0.04) * fitScale
  const baseU = 0
  const baseV = 0
  const tipV = Math.min(host.area.vMax - 0.04, baseV + Math.max(0.2, spineLen) + tipBiasV)
  const { spine, ribs } = buildRibbedSpine(host, {
    id: `${host.sourceAnchorId ?? host.id}-spine`,
    length: tipV - baseV,
    curvature: (cfg.primarySpineCurvature ?? 0.35) * (1 - symmetry * 0.35 + creature * 0.2),
    taper: 0.25,
    ribSpacing: lerp(0.18, 0.1, hierarchy),
    baseU,
    baseV,
    tipU: offU + (rand() - 0.5) * creature * 0.04 * areaW,
    tipV,
    creatureInfluence: creature * (1 - symmetry * 0.5),
    clearance,
    samples: 40,
  })

  // Force exact root coincidence with the shared anchor (nOff matches curve sampling).
  const exactRoot = localToWorld(host.origin, host.axisU, host.axisV, host.normal, 0, 0, 0.025)
  if (spine.points?.length) {
    spine.points[0] = exactRoot
  } else {
    spine.points = [exactRoot]
    spine.valid = false
    spine.invalidReason = 'ROOT_MISSING'
  }
  const rootCheck = measureRootAnchorDistance(host, spine)
  if (!rootCheck.ok) {
    spine.valid = false
    spine.invalidReason = `ROOT_ANCHOR_DISTANCE:${rootCheck.distance.toExponential(2)}`
  }

  if (cfg.showPrimarySpine !== false) {
    if (spine.valid) curves.push(spine)
    else invalid.push(spine)
    for (const rib of ribs) curves.push(rib)
  }

  const slots = spine.meta?.attachmentSlots ?? []
  const attachMain =
    slots[1] ?? slots[0] ?? { u: baseU, v: lerp(baseV, tipV, 0.55), t: 0.55, tangent: { u: 0, v: 1 } }

  // 2. Primary volutes (paired) near spine tip
  const voluteR = (cfg.voluteRadius ?? 0.42) * Math.min(areaW, areaH) * 0.55 * fitScale
  const voluteTight = cfg.voluteTightness ?? 0.75
  const voluteCenterV = Math.min(host.area.vMax - voluteR * 0.9, tipV - voluteR * 0.15)
  const voluteCenterU = voluteR * 0.55 + Math.abs(offU) * 0.5

  let leftVolute = null
  let rightVolute = null

  if (cfg.showPrimaryVolutes !== false) {
    leftVolute = buildGothicVolute(host, {
      id: `${host.sourceAnchorId ?? host.id}-volute-L`,
      role: CURVE_ROLES.PRIMARY_VOLUTE,
      hierarchy: 1,
      outerRadius: voluteR,
      innerRadius: voluteR * 0.16,
      turns,
      tightness: voluteTight,
      taper: 0.55,
      orientation: 1,
      startAngle: Math.PI * 0.15,
      centerU: -voluteCenterU + offU,
      centerV: voluteCenterV,
      creatureInfluence: creature * (symmetry >= 0.99 ? 0.15 : 1),
      clearance,
      samples: 56,
      parentId: spine.id,
    })

    if (symmetry >= 0.995) {
      rightVolute = mirrorCurveLocal(host, leftVolute, '-R')
      if (rightVolute) {
        rightVolute.role = CURVE_ROLES.PRIMARY_VOLUTE
        rightVolute.id = `${host.sourceAnchorId ?? host.id}-volute-R`
      }
    } else if (symmetry <= 0.02) {
      rightVolute = buildGothicVolute(host, {
        id: `${host.sourceAnchorId ?? host.id}-volute-R`,
        role: CURVE_ROLES.PRIMARY_VOLUTE,
        hierarchy: 1,
        outerRadius: voluteR * lerp(0.9, 1.15, rand()),
        innerRadius: voluteR * 0.16,
        turns: turns * lerp(0.85, 1.1, rand()),
        tightness: voluteTight,
        orientation: -1,
        startAngle: -Math.PI * 0.15,
        centerU: voluteCenterU + offU + (rand() - 0.5) * creature * 0.05,
        centerV: voluteCenterV + (rand() - 0.5) * creature * 0.04,
        creatureInfluence: creature,
        clearance,
        samples: 56,
        parentId: spine.id,
      })
    } else {
      rightVolute = buildGothicVolute(host, {
        id: `${host.sourceAnchorId ?? host.id}-volute-R`,
        role: CURVE_ROLES.PRIMARY_VOLUTE,
        hierarchy: 1,
        outerRadius: voluteR * lerp(0.95, 1.08, (1 - symmetry) * rand()),
        innerRadius: voluteR * 0.16,
        turns: turns * lerp(0.95, 1.06, 1 - symmetry),
        tightness: voluteTight,
        orientation: -1,
        startAngle: -Math.PI * 0.15,
        centerU: voluteCenterU + offU,
        centerV: voluteCenterV,
        creatureInfluence: creature * (1 - symmetry * 0.6),
        clearance,
        samples: 56,
        parentId: spine.id,
        mirrorOf: leftVolute.id,
      })
    }

    for (const v of [leftVolute, rightVolute]) {
      if (!v) continue
      if (v.valid) curves.push(v)
      else invalid.push(v)
    }
  }

  // 3. Secondary curls along spine (exact local mirror at 100% symmetry)
  if (cfg.showSecondaryCurls !== false && hierarchy > 0.08) {
    const pairCount = Math.max(1, Math.round(lerp(1, 3, hierarchy) + creature * 0.8))
    const attachBase = clamp01(cfg.branchAttachmentPosition ?? 0.55)
    for (let i = 0; i < pairCount; i += 1) {
      const t = clamp01(attachBase + (i - (pairCount - 1) * 0.5) * 0.14)
      const idx = Math.min(
        (spine.meta?.uv?.length ?? 1) - 1,
        Math.max(0, Math.floor(t * ((spine.meta?.uv?.length ?? 1) - 1))),
      )
      const slot = spine.meta?.uv?.[idx] ?? attachMain
      const tangent = spine.meta?.uv
        ? {
            u: (spine.meta.uv[Math.min(idx + 1, spine.meta.uv.length - 1)].u - slot.u) || 0,
            v: (spine.meta.uv[Math.min(idx + 1, spine.meta.uv.length - 1)].v - slot.v) || 1,
          }
        : { u: 0, v: 1 }
      const tLen = Math.hypot(tangent.u, tangent.v) || 1
      tangent.u /= tLen
      tangent.v /= tLen

      const side = 1
      const secScale =
        (cfg.secondaryCurlScale ?? 0.45) *
        Math.min(areaW, areaH) *
        0.35 *
        fitScale *
        lerp(1, 0.7, i / Math.max(1, pairCount - 1))

      const secCurl = buildSecondaryCurl(host, {
        id: `${host.sourceAnchorId ?? host.id}-sec-${i}`,
        parentId: spine.id,
        hierarchy: 2,
        attachU: slot.u,
        attachV: slot.v,
        tangentUV: tangent,
        branchAngle: lerp(0.7, 1.2, curlAmt) + creature * 0.25 * (rand() - 0.5),
        side,
        scale: secScale,
        turns: lerp(0.7, 1.2, curlAmt),
        tightness: 0.82,
        creatureInfluence: creature * (symmetry >= 0.99 ? 0.2 : 1),
        clearance,
        samples: 32,
        attachmentT: t,
      })

      if (secCurl.valid) curves.push(secCurl)
      else invalid.push(secCurl)

      if (symmetry >= 0.995) {
        const m = mirrorCurveLocal(host, secCurl, '-m')
        if (m?.valid) curves.push(m)
        else if (m) invalid.push(m)
      } else if (symmetry <= 0.02) {
        const independent = buildSecondaryCurl(host, {
          id: `${host.sourceAnchorId ?? host.id}-sec-${i}-R`,
          parentId: spine.id,
          hierarchy: 2,
          attachU: -slot.u + (rand() - 0.5) * creature * 0.04,
          attachV: slot.v + (rand() - 0.5) * creature * 0.03,
          tangentUV: { u: -tangent.u, v: tangent.v },
          branchAngle: lerp(0.7, 1.2, curlAmt) + creature * 0.3 * (rand() - 0.5),
          side: -1,
          scale: secScale * lerp(0.85, 1.15, rand()),
          turns: lerp(0.65, 1.25, curlAmt) * lerp(0.9, 1.1, rand()),
          tightness: 0.82,
          creatureInfluence: creature,
          clearance,
          samples: 32,
          attachmentT: t,
        })
        if (independent.valid) curves.push(independent)
        else invalid.push(independent)
      } else if (symmetry > 0.08) {
        const m = mirrorCurveLocal(host, secCurl, '-m')
        if (m?.valid) {
          if (symmetry < 0.9 && m.points.length > 2) {
            const tip = m.points[m.points.length - 1]
            tip[0] += (rand() - 0.5) * (1 - symmetry) * 0.04
            tip[1] += (rand() - 0.5) * (1 - symmetry) * 0.03
          }
          curves.push(m)
        }
      }

      if (hierarchy > 0.55 && creature > 0.2 && secCurl.valid && secCurl.points.length > 4) {
        const tipLocal = secCurl.meta?.localEnd
        if (tipLocal) {
          const tert = buildSecondaryCurl(host, {
            id: `${secCurl.id}-t`,
            parentId: secCurl.id,
            role: CURVE_ROLES.TERTIARY,
            hierarchy: 3,
            attachU: tipLocal.u,
            attachV: tipLocal.v,
            tangentUV: { u: side * 0.2, v: 1 },
            branchAngle: 0.9,
            side: -side,
            scale: secScale * 0.45,
            turns: 0.7,
            creatureInfluence: creature,
            clearance,
            samples: 24,
          })
          if (tert.valid) curves.push(tert)
          else invalid.push(tert)
          if (symmetry >= 0.995) {
            const tm = mirrorCurveLocal(host, tert, '-m')
            if (tm?.valid) curves.push(tm)
          }
        }
      }
    }
  }

  if (cfg.showConstructionCurves) {
    curves.push(
      createCurveMember({
        id: `${host.sourceAnchorId ?? host.id}-sym-axis`,
        role: CURVE_ROLES.CONSTRUCTION,
        hierarchy: -1,
        points: [
          localToWorld(host.origin, host.axisU, host.axisV, host.normal, 0, host.area.vMin, 0.02),
          localToWorld(host.origin, host.axisU, host.axisV, host.normal, 0, host.area.vMax, 0.02),
        ],
        length: areaH,
        valid: true,
        hostId: host.id,
      }),
    )
  }

  const validCurves = curves.filter((c) => c.valid)
  const continuity = validCurves
    .filter((c) => c.role !== CURVE_ROLES.RIB_MARK && c.role !== CURVE_ROLES.CONSTRUCTION)
    .map((c) => validateCurveContinuity(c))
  const sharp = continuity.filter((c) => !c.ok).length

  const totalLen = validCurves.reduce((s, c) => s + (c.length ?? 0), 0)
  const fitOk = spine.valid && rootCheck.ok && invalid.length === 0 && sharp === 0
  const motifId = `motif-${host.sourceAnchorId ?? host.id}`

  return {
    id: motifId,
    motifId,
    type: MOTIF_TYPES.SYMMETRICAL_SPANDREL_SCROLL,
    sourceAnchorId: host.sourceAnchorId ?? null,
    hostComponentId: host.hostComponentId ?? null,
    hostSurfaceId: host.hostSurfaceId ?? null,
    hostPatchId: host.hostPatchId ?? null,
    localFrame: {
      origin: host.origin,
      axisU: host.axisU,
      axisV: host.axisV,
      normal: host.normal,
    },
    motifParameters: {
      motifType: cfg.motifType,
      motifScale: cfg.motifScale,
      scrollTurns: cfg.scrollTurns,
      curlStrength: cfg.curlStrength,
      symmetryStrength: cfg.symmetryStrength,
      branchHierarchy: cfg.branchHierarchy,
      creatureInfluence: cfg.creatureInfluence,
      randomSeed: cfg.randomSeed,
    },
    geometrySignature: host.geometrySignature ?? '',
    hostId: host.id,
    host,
    rootWorld: rootCheck.root ?? null,
    curves: [...validCurves, ...invalid.map((c) => ({ ...c, valid: false }))],
    diagnostics: {
      curveCount: validCurves.length,
      invalidCurveCount: invalid.length,
      sharpContinuityCount: sharp,
      totalLength: totalLen,
      fitOk,
      fitScale,
      symmetry,
      rootAnchorDistance: rootCheck.distance,
      rootOk: rootCheck.ok,
      mirroredCount: validCurves.filter((c) => c.mirrorOf || c.role === CURVE_ROLES.MIRROR).length,
      hostStatus: host.hostClassification?.ok ? 'valid' : host.hostClassification?.reason ?? 'unknown',
    },
  }
}

/**
 * Build parametric motifs from shared GrowthAttachment anchors only.
 */
export function buildParametricMotifs({ semantics, anchors = [], params = {} } = {}) {
  const cfg = { ...DEFAULT_PARAMETRIC_MOTIF_SETTINGS, ...params }
  const geometrySignature = semantics?.geometryVersion ?? ''
  const anchorList = anchors ?? []

  if (!semantics) {
    return emptyParametricMotif({
      emptyReason: 'Surface semantics unavailable for host.',
      geometrySignature,
      parameters: cfg,
      anchorCount: anchorList.length,
    })
  }

  if (!anchorList.length) {
    return emptyParametricMotif({
      emptyReason:
        'No shared ornament initiation points. Place or distribute anchors in Architectural Assembly (or Foliate place mode).',
      geometrySignature,
      parameters: cfg,
      anchorCount: 0,
    })
  }

  const resolved = buildHostsFromAnchors(semantics, anchorList, {
    hostKind: cfg.hostKindFilter ? cfg.hostKind : null,
  })

  if (!resolved.hosts.length) {
    return emptyParametricMotif({
      emptyReason:
        resolved.invalidAnchors.length > 0
          ? `No valid ornamental hosts for current anchors (${resolved.invalidAnchors[0].reason}). Select or reposition a valid initiation point.`
          : 'No valid ornamental hosts for current anchors.',
      geometrySignature,
      parameters: cfg,
      anchors: anchorList,
      anchorCount: anchorList.length,
      unusedAnchorCount: resolved.unusedAnchors.length,
      invalidAnchorCount: resolved.invalidAnchors.length,
      unusedAnchors: resolved.unusedAnchors,
      invalidAnchors: resolved.invalidAnchors,
    })
  }

  const singleHost = cfg.singleHost === true
  let selectedHosts = []
  let unusedExtra = [...resolved.unusedAnchors]

  if (singleHost) {
    const preferredId = cfg.selectedAnchorId ?? resolved.hosts[0]?.sourceAnchorId
    const picked = selectHostByAnchorId(resolved.hosts, preferredId)
    if (!picked) {
      return emptyParametricMotif({
        emptyReason: `Selected anchor "${preferredId}" is not a valid ornamental host. Choose another initiation point.`,
        geometrySignature,
        parameters: cfg,
        anchors: anchorList,
        anchorCount: anchorList.length,
        unusedAnchorCount: resolved.hosts.length + resolved.unusedAnchors.length,
        invalidAnchorCount: resolved.invalidAnchors.length,
        unusedAnchors: [
          ...resolved.unusedAnchors,
          ...resolved.hosts.map((h) => ({
            anchorId: h.sourceAnchorId,
            reason: 'not-selected',
          })),
        ],
        invalidAnchors: resolved.invalidAnchors,
      })
    }
    selectedHosts = [picked]
    for (const h of resolved.hosts) {
      if (h.sourceAnchorId !== picked.sourceAnchorId) {
        unusedExtra.push({ anchorId: h.sourceAnchorId, reason: 'not-selected-single-motif' })
      }
    }
  } else {
    const maxMotifs = Math.max(1, Math.floor(cfg.maxMotifs ?? 12))
    selectedHosts = resolved.hosts.slice(0, maxMotifs)
    for (const h of resolved.hosts.slice(maxMotifs)) {
      unusedExtra.push({ anchorId: h.sourceAnchorId, reason: 'maxMotifs-cap' })
    }
  }

  const motifs = selectedHosts.map((host) => composeSymmetricalSpandrelScroll(host, cfg))

  const allCurves = motifs.flatMap((m) => m.curves ?? [])
  const invalidCurveCount = allCurves.filter((c) => !c.valid).length
  const fitOk = motifs.every((m) => m.diagnostics?.fitOk)
  const rootOk = motifs.every((m) => m.diagnostics?.rootOk)

  return {
    type: 'PARAMETRIC_GOTHIC_MOTIF',
    version: '14A.1.2.1',
    motifs,
    hosts: selectedHosts,
    allHosts: resolved.allHosts,
    anchors: anchorList,
    diagnostics: {
      motifCount: motifs.length,
      curveCount: allCurves.filter((c) => c.valid).length,
      invalidCurveCount,
      hostCount: resolved.hosts.length,
      anchorCount: anchorList.length,
      selectedAnchorId: singleHost ? selectedHosts[0]?.sourceAnchorId ?? null : null,
      unusedAnchorCount: unusedExtra.length,
      invalidAnchorCount: resolved.invalidAnchors.length,
      unusedAnchors: unusedExtra,
      invalidAnchors: resolved.invalidAnchors,
      fitOk: fitOk && rootOk,
      rootOk,
      emptyReason: null,
      cacheKey: parametricMotifCacheKey(
        geometrySignature,
        selectedHosts.map((h) => h.sourceAnchorId),
        cfg,
      ),
      totalLength: allCurves.reduce((s, c) => s + (c.length ?? 0), 0),
    },
    parameters: cfg,
    geometrySignature,
    label: 'PARAMETRIC GOTHIC MOTIF — CONSTRUCTION PREVIEW',
  }
}

/**
 * Exact symmetry test helper: max deviation between paired mirrored samples.
 */
export function measureMirrorDeviation(host, curveA, curveB) {
  if (!curveA?.points?.length || !curveB?.points?.length) return Infinity
  const n = Math.min(curveA.points.length, curveB.points.length)
  let maxDev = 0
  for (let i = 0; i < n; i += 1) {
    const mirrored = mirrorCurveLocal(
      host,
      {
        ...curveA,
        points: [curveA.points[i]],
        controlPoints: [],
      },
      '-tmp',
    )
    if (!mirrored) continue
    const d = Math.hypot(
      mirrored.points[0][0] - curveB.points[i][0],
      mirrored.points[0][1] - curveB.points[i][1],
      mirrored.points[0][2] - curveB.points[i][2],
    )
    maxDev = Math.max(maxDev, d)
  }
  return maxDev
}

export { polylineLength }
