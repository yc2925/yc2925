/**
 * Step 11C — Build ornamental networks from accepted agent paths.
 * Reuses existing ornament geometry / attachment / bilateral helpers.
 */

import {
  applyBilateralSymmetry,
  getArchitecturalSymmetryAxis,
} from '../ornament/composition.js'
import {
  applyGrowthDrawRange,
  buildOrnamentMeshCache,
  createOrnamentMaterial,
  disposeMeshCache,
} from '../ornament/ornamentGeometry.js'
import { resolveOrnamentPhysical } from '../scale/proportions.js'
import { REGION_COMPOSITION } from './architecturalRegions.js'
import { extractCandidates, constructionFingerprint } from './constructionPath.js'
import { acceptPaths, archScale } from './pathAcceptance.js'

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0))
}

function polyFromPoints(points) {
  const cum = [0]
  for (let i = 1; i < points.length; i += 1) {
    cum.push(
      cum[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
          (points[i].z ?? 0) - (points[i - 1].z ?? 0),
        ),
    )
  }
  return { points, cum, length: cum[cum.length - 1] || 0, modes: points.map(() => 'constrained'), times: points.map((p) => p.t ?? 0) }
}

/**
 * Infer parent among longer accepted paths by tip→body proximity + continuity.
 * Does not invent links between unrelated far paths.
 */
export function buildHierarchy(accepted, opts = {}) {
  const scale = opts.scale ?? 1
  const attachMax = 0.16 * scale
  const sorted = [...accepted].sort((a, b) => (b.length ?? 0) - (a.length ?? 0))

  const nodes = sorted.map((p, i) => {
    const hint = p.tierHint
    const regionBias = REGION_COMPOSITION[p.region]?.primaryBias ?? 0.5
    let generation = 1
    let role = 'secondary'
    const longStem =
      (p.length ?? 0) > (0.38 + (1 - regionBias) * 0.2) * scale &&
      (hint === 'primary' || i < Math.max(1, Math.ceil(sorted.length * (0.22 + regionBias * 0.2))))
    if (hint === 'primary' || longStem) {
      generation = 0
      role = 'primary'
    } else if (hint === 'tertiary' || (p.length ?? 0) < 0.3 * scale) {
      generation = 2
      role = 'tertiary'
    }
    return {
      ...p,
      generation,
      role,
      parentPathId: null,
      parentAttachmentS: 0,
      children: [],
    }
  })

  const primaries = nodes.filter((n) => n.generation === 0)
  const others = nodes.filter((n) => n.generation > 0)

  for (const child of others) {
    const tip = child.points[0]
    let best = null
    for (const parent of primaries.length ? primaries : nodes.filter((n) => n.id !== child.id && n.generation < child.generation)) {
      if (!parent.points?.length) continue
      let localBest = { d: Infinity, s: 0 }
      const plen = parent.length || 1
      for (let i = 0; i < parent.points.length; i += 1) {
        const d = dist(tip, parent.points[i])
        if (d < localBest.d) {
          localBest = { d, s: (i / Math.max(1, parent.points.length - 1)) * plen }
        }
      }
      if (localBest.d < attachMax && (!best || localBest.d < best.d)) {
        best = { parent, d: localBest.d, s: localBest.s / plen }
      }
    }
    if (best) {
      child.parentPathId = best.parent.id
      child.parentAttachmentS = best.s
      best.parent.children.push(child.id)
      // Soften generation: secondary under primary, tertiary under secondary if needed
      if (child.generation === 2 && best.parent.generation === 0) child.generation = 1
    } else if (child.generation > 0 && primaries.length) {
      // Unattached short paths become independent secondary stems (still valid)
      child.generation = Math.min(child.generation, 1)
      child.role = child.generation === 0 ? 'primary' : 'secondary'
    }
  }

  // Cap branching density: if a primary has too many children, demote extras to rejected-like skip
  const maxChildren = Math.max(1, Math.round(2 + (opts.branchComplexity ?? 0.45) * 4))
  for (const p of primaries) {
    if (p.children.length <= maxChildren) continue
    const childNodes = p.children
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean)
      .sort((a, b) => (b.acceptScore ?? 0) - (a.acceptScore ?? 0))
    for (let i = maxChildren; i < childNodes.length; i += 1) {
      const c = childNodes[i]
      c.parentPathId = null
      c.parentAttachmentS = 0
      p.children = p.children.filter((id) => id !== c.id)
    }
  }

  return nodes
}

/**
 * Convert hierarchy nodes → ornament branch network (composition-compatible).
 */
export function hierarchyToNetwork(nodes, opts = {}) {
  const branches = []
  for (const n of nodes) {
    const pts = (n.points ?? []).map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z ?? 0,
      t: p.t ?? 0,
      mode: 'constrained',
    }))
    if (pts.length < 2) continue
    const poly = polyFromPoints(pts)
    const start = pts[0]
    const birth = n.growthStartTime ?? 0
    const end = n.growthCompletionTime ?? birth + 0.8
    branches.push({
      id: n.id,
      parentId: n.parentPathId,
      generation: n.generation ?? 0,
      role: n.role === 'primary' ? 'stem' : n.role === 'tertiary' ? 'flourish' : 'branch',
      compositionRole: 'master',
      sourceId: null,
      origin: { x: start.x, y: start.y, z: start.z ?? 0 },
      originTangent: n.tangentStart ?? { x: 0, y: 1, z: 0 },
      points: pts,
      pointTimes: pts.map((p) => p.t ?? birth),
      length: poly.length,
      poly,
      parentAttachmentS: n.parentAttachmentS ?? 0,
      birthTime: birth,
      growthDuration: Math.max(0.25, end - birth),
      revealMode: 'arc',
      architecturalFeatureId: n.featureRefs?.[0] ?? n.attachmentStart?.curveId ?? null,
      children: n.children ?? [],
      agentId: n.agentId,
      acceptScore: n.acceptScore,
      fieldAttraction: n.accumulatedAttraction,
      fieldInhibition: n.accumulatedInhibition,
    })
  }

  let network = {
    branches,
    mode: 'agent-construction',
    stats: {
      primary: branches.filter((b) => b.generation === 0).length,
      secondary: branches.filter((b) => b.generation === 1).length,
      tertiary: branches.filter((b) => b.generation >= 2).length,
    },
  }

  if (opts.bilateral !== false && opts.arch) {
    network = applyBilateralSymmetry(network, {
      arch: opts.arch,
      strength: 1,
      seed: opts.seed ?? 42,
      trailSpacing: 0.12,
    })
  }

  return network
}

/**
 * Tip flourish markers (lightweight — reuse leaf profile via short child stubs).
 * Only at selected secondary/tertiary tips; subordinate length.
 */
export function addFoliateTips(network, opts = {}) {
  const strength = opts.foliateDetail ?? 0.35
  if (strength < 0.08) return network
  const scale = opts.scale ?? 1
  const tipLen = 0.06 * scale * (0.6 + strength)
  const branches = [...(network.branches ?? [])]
  const extras = []
  let added = 0
  const maxTips = Math.max(0, Math.round(2 + strength * 8))

  for (const b of branches) {
    if (added >= maxTips) break
    if ((b.compositionRole ?? 'master') === 'mirror') continue
    if ((b.generation ?? 0) < 1) continue
    if ((b.length ?? 0) < 0.2 * scale) continue
    const pts = b.points
    if (!pts || pts.length < 2) continue
    const a = pts[pts.length - 2]
    const c = pts[pts.length - 1]
    const dx = c.x - a.x
    const dy = c.y - a.y
    const len = Math.hypot(dx, dy) || 1
    // Slight curl side-offset
    const nx = -dy / len
    const ny = dx / len
    const curl = tipLen * (0.55 + strength * 0.4)
    const tipPts = [
      { x: c.x, y: c.y, z: c.z ?? 0, t: c.t ?? 0, mode: 'free' },
      {
        x: c.x + (dx / len) * curl * 0.55 + nx * curl * 0.35,
        y: c.y + (dy / len) * curl * 0.55 + ny * curl * 0.35,
        z: (c.z ?? 0) + 0.01,
        t: (c.t ?? 0) + 0.05,
        mode: 'free',
      },
      {
        x: c.x + (dx / len) * curl + nx * curl * 0.15,
        y: c.y + (dy / len) * curl + ny * curl * 0.15,
        z: (c.z ?? 0) + 0.018,
        t: (c.t ?? 0) + 0.1,
        mode: 'free',
      },
    ]
    const poly = polyFromPoints(tipPts)
    extras.push({
      id: `folio-${b.id}`,
      parentId: b.id,
      generation: Math.min(3, (b.generation ?? 1) + 1),
      role: 'flourish',
      compositionRole: 'master',
      sourceId: null,
      origin: tipPts[0],
      originTangent: { x: dx / len, y: dy / len, z: 0 },
      points: tipPts,
      pointTimes: tipPts.map((p) => p.t),
      length: poly.length,
      poly,
      parentAttachmentS: 0.98,
      birthTime: (b.birthTime ?? 0) + (b.growthDuration ?? 0.5) * 0.75,
      growthDuration: Math.max(0.2, (b.growthDuration ?? 0.5) * 0.35),
      revealMode: 'arc',
      architecturalFeatureId: b.architecturalFeatureId,
      children: [],
    })
    added += 1
  }

  if (!extras.length) return network

  const withTips = { ...network, branches: [...branches, ...extras] }
  if (opts.bilateral !== false && opts.arch) {
    return applyBilateralSymmetry(
      { ...withTips, branches: withTips.branches.filter((b) => (b.compositionRole ?? 'master') !== 'mirror') },
      { arch: opts.arch, strength: 1, seed: (opts.seed ?? 42) + 3, trailSpacing: 0.1 },
    )
  }
  return withTips
}

/**
 * Full construction pass from a simulation instance.
 */
export function buildConstructionFromSim(sim, arch, params = {}) {
  const enabled = params.enableOrnamentConstruction !== false
  if (!enabled || !sim) {
    return emptyConstructionResult('disabled')
  }

  const candidates = extractCandidates(sim, { preferMasters: true })
  const {
    accepted,
    rejected,
    scale,
    coverage,
    diagnostics,
    quotas,
    regionCounts,
  } = acceptPaths(candidates, {
    graph: sim.graph,
    arch,
    pathAcceptanceThreshold: params.pathAcceptanceThreshold ?? 0.42,
    ornamentDensity: params.ornamentDensity ?? 0.55,
    enableStigmergy: params.enableStigmergy !== false,
    branchComplexity: params.branchComplexity ?? 0.45,
    maxPaths: Math.round(10 + (params.ornamentDensity ?? 0.55) * 14),
  })

  const hierarchy = buildHierarchy(accepted, {
    scale,
    branchComplexity: params.branchComplexity ?? 0.45,
  })

  // Masters only first — single bilateral pass after foliate tips
  let network = hierarchyToNetwork(hierarchy, {
    arch,
    bilateral: false,
    seed: params.agentSeed ?? 42,
  })

  network = addFoliateTips(network, {
    foliateDetail: params.foliateDetail ?? 0.35,
    scale,
    arch,
    bilateral: false,
    seed: params.agentSeed ?? 42,
  })

  if (params.bilateralSymmetry !== false && arch) {
    network = applyBilateralSymmetry(network, {
      arch,
      strength: 1,
      seed: params.agentSeed ?? 42,
      trailSpacing: 0.12,
    })
  }

  const physical = resolveOrnamentPhysical(
    {
      ...params,
      primaryThickness: params.primaryThickness ?? 0.03,
      secondaryThickness: params.secondaryThickness ?? 0.018,
      reliefDepth: params.constructionReliefDepth ?? params.reliefDepth ?? 0.014,
      rootEmbedding: params.rootEmbedding ?? 0.012,
      sculpturalEmergence: params.constructionEmergence ?? 0.55,
      foliateDetail: params.foliateDetail ?? 0.35,
    },
    {
      profileThickness: params.profileThickness ?? 0.055,
      architecturalDepth: params.architecturalDepth ?? 0.14,
      height: arch?.bounds?.y1 ?? arch?.bounds?.max?.y ?? 5.7,
    },
  )
  const thickness = physical.primaryThickness
  const decay = Math.max(
    0.4,
    Math.min(
      0.9,
      physical.secondaryThickness / Math.max(1e-6, physical.primaryThickness),
    ),
  )

  const meshCache = buildOrnamentMeshCache(network, {
    arch,
    specimen: params.specimen ?? null,
    ornamentThickness: thickness,
    branchThicknessDecay: decay,
    taperStrength: 0.72,
    profileType: params.foliateDetail > 0.55 ? 'leaf' : 'fluted',
    profileWidth: 1.25,
    profileDepth: 0.58,
    flutingStrength: 0.4,
    profileTransition: 0.5 + (params.foliateDetail ?? 0.35) * 0.25,
    tipCurl: 0.35 + (params.foliateDetail ?? 0.35) * 0.45,
    reliefDepth: physical.reliefDepth,
    reliefProjection: physical.reliefProjection,
    sculpturalEmergence: physical.sculpturalEmergence,
    sculptureMode: 'surface',
    attachmentStrength: 0.88,
    surfaceConformity: 0.72,
    rootEmbedding: physical.rootEmbedding,
    radialResolution: 9,
    curveResolution: 0.5,
  })

  // Start fully hidden — reveal driven by sim time
  for (const m of meshCache.meshes ?? []) {
    applyGrowthDrawRange(m.geometry, 0)
  }

  const stats = summarizeConstruction({
    candidates,
    accepted: hierarchy,
    rejected,
    network,
    meshCache,
    coverage,
    diagnostics,
  })

  return {
    fingerprint: constructionFingerprint(sim),
    candidates,
    accepted: hierarchy,
    rejected,
    network,
    meshCache,
    scale,
    coverage,
    diagnostics,
    quotas,
    regionCounts,
    stats,
  }
}

function emptyConstructionResult(reason = 'empty') {
  return {
    fingerprint: '',
    candidates: [],
    accepted: [],
    rejected: [],
    network: { branches: [], mode: 'agent-construction', stats: {} },
    meshCache: null,
    scale: 1,
    coverage: null,
    diagnostics: { byReason: {}, byCategory: {}, total: 0 },
    quotas: null,
    regionCounts: null,
    stats: {
      candidatePaths: 0,
      acceptedPaths: 0,
      rejectedPaths: 0,
      primaryStems: 0,
      secondaryBranches: 0,
      tertiaryFlourishes: 0,
      ornamentMeshes: 0,
      ornamentTriangles: 0,
      growthCompletion: 0,
      regionsHit: 0,
      reason,
    },
  }
}

export function summarizeConstruction({
  candidates,
  accepted,
  rejected,
  network,
  meshCache,
  coverage,
  diagnostics,
}) {
  const branches = network?.branches ?? []
  const masters = branches.filter((b) => (b.compositionRole ?? 'master') !== 'mirror')
  return {
    candidatePaths: candidates?.length ?? 0,
    acceptedPaths: accepted?.length ?? 0,
    rejectedPaths: rejected?.length ?? 0,
    primaryStems: masters.filter((b) => (b.generation ?? 0) === 0).length,
    secondaryBranches: masters.filter((b) => (b.generation ?? 0) === 1).length,
    tertiaryFlourishes: masters.filter((b) => (b.generation ?? 0) >= 2).length,
    ornamentMeshes: meshCache?.stats?.ornamentMeshes ?? 0,
    ornamentTriangles: meshCache?.stats?.ornamentTriangles ?? 0,
    growthCompletion: 0,
    validAttachments: meshCache?.stats?.validAttachments ?? 0,
    regionsHit: coverage?.regionsHit ?? 0,
    rejectionByCategory: diagnostics?.byCategory ?? {},
    rejectionByReason: diagnostics?.byReason ?? {},
    coverageRows: coverage?.rows ?? [],
  }
}

/**
 * Update draw ranges from simulation time. Returns growth completion 0–1.
 */
export function applyConstructionReveal(construction, simTime) {
  if (!construction?.meshCache?.meshes?.length || !construction.network) {
    return 0
  }
  const byId = new Map((construction.network.branches ?? []).map((b) => [b.id, b]))
  let sum = 0
  let n = 0
  for (const mesh of construction.meshCache.meshes) {
    const branch = byId.get(mesh.id)
    const birth = branch?.birthTime ?? 0
    const dur = Math.max(0.2, branch?.growthDuration ?? 0.8)
    const frac = Math.max(0, Math.min(1, (simTime - birth) / dur))
    applyGrowthDrawRange(mesh.geometry, frac)
    sum += frac
    n += 1
  }
  const completion = n ? sum / n : 0
  if (construction.stats) construction.stats.growthCompletion = completion
  return completion
}

export function disposeConstruction(construction) {
  if (!construction) return
  disposeMeshCache(construction.meshCache)
  construction.meshCache = null
}

export {
  constructionFingerprint,
  createOrnamentMaterial,
  disposeMeshCache,
  getArchitecturalSymmetryAxis,
  archScale,
  emptyConstructionResult,
}
