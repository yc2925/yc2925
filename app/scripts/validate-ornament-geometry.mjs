/**
 * Step 10A — tapered ornament geometry validation.
 * Run: node scripts/validate-ornament-geometry.mjs
 */
import * as THREE from 'three'
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createParticleSimulation } from '../src/ornament/particles.js'
import { completeParticleTrails } from '../src/ornament/branching.js'
import { composeOrnamentNetwork } from '../src/ornament/composition.js'
import { createGrowthPlayback, revealBranchAtTime } from '../src/ornament/growthPlayback.js'
import {
  applyGrowthDrawRange,
  baseRadiusForGeneration,
  buildOrnamentMeshCache,
  disposeMeshCache,
  sweepTaperedTube,
  taperProfile,
} from '../src/ornament/ornamentGeometry.js'
import { DEFAULT_ORNAMENT } from '../src/ornament/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 10A ornament geometry validation ===')

// --- Unit: taper + hierarchy ---
{
  const tip = taperProfile(1, 0.9)
  const mid = taperProfile(0.5, 0.9)
  const base = taperProfile(0, 0.9)
  if (!(base > mid && mid > tip && tip >= 0.04)) fail(`taperProfile order base=${base} mid=${mid} tip=${tip}`)
  else pass(`taperProfile smooth base→tip (${base.toFixed(2)}→${tip.toFixed(2)})`)

  const r0 = baseRadiusForGeneration(0, 0.028, 0.68)
  const r1 = baseRadiusForGeneration(1, 0.028, 0.68)
  const r2 = baseRadiusForGeneration(2, 0.028, 0.68)
  if (!(r0 > r1 && r1 > r2)) fail(`gen radii ${r0} ${r1} ${r2}`)
  else pass(`hierarchy radii gen0>${r1.toFixed(4)}>gen2`)
}

// --- Unit: sweep continuity ---
{
  const pts = []
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20
    pts.push({ x: Math.sin(t * Math.PI) * 0.4, y: t * 1.2, z: 0 })
  }
  const geo = sweepTaperedTube(pts, {
    baseRadius: 0.03,
    taperStrength: 0.75,
    radialResolution: 10,
    curveResolution: 24,
  })
  if (!geo) fail('sweep returned null')
  else {
    const idx = geo.index.count
    const tris = idx / 3
    const pos = geo.getAttribute('position')
    let degenerate = 0
    for (let i = 0; i < idx; i += 3) {
      const a = idxAt(pos, geo.index.getX(i))
      const b = idxAt(pos, geo.index.getX(i + 1))
      const c = idxAt(pos, geo.index.getX(i + 2))
      const area = triangleArea(a, b, c)
      if (area < 1e-12) degenerate += 1
    }
    if (tris < 40) fail(`too few triangles ${tris}`)
    else if (degenerate > tris * 0.02) fail(`degenerate tris ${degenerate}/${tris}`)
    else pass(`sweep tube ${tris} tris, ${degenerate} degenerate`)
    geo.dispose()
  }
}

function idxAt(attr, i) {
  return new THREE.Vector3(attr.getX(i), attr.getY(i), attr.getZ(i))
}
function triangleArea(a, b, c) {
  return new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5
}

// --- Integration: composed network → cache → growth drawRange ---
const settings = applyPreset({ ...DEFAULT_ORNAMENT }, 'geo-twin-trefoil')
const architecture = buildOrnamentArchitecture({
  ...DEFAULT_ORNAMENT,
  ...settings,
  activePreset: 'geo-twin-trefoil',
})
const growth = generateGrowthConditions(architecture.arch, {
  ...DEFAULT_ORNAMENT,
  growthSeed: 11,
  anchorCount: 90,
})

for (const mode of ['bilateral', 'rhythmic', 'free']) {
  const sim = createParticleSimulation({
    arch: architecture.arch,
    anchors: growth.anchors,
    params: { ...DEFAULT_ORNAMENT, particleCount: 3, growthSeed: 11 },
  })
  const trails = completeParticleTrails(sim)
  const network = composeOrnamentNetwork({
    trails,
    arch: architecture.arch,
    curveSamples: growth.curveSamples,
    params: {
      ...DEFAULT_ORNAMENT,
      compositionMode: mode,
      branchGenerations: 2,
      growthSeed: 11,
      motifType: 'scroll',
      repetitionCount: 4,
    },
  })

  const cache = buildOrnamentMeshCache(network, {
    ornamentThickness: 0.028,
    taperStrength: 0.72,
    branchThicknessDecay: 0.68,
    radialResolution: 10,
    curveResolution: 0.55,
  })

  if (cache.meshes.length < 2) fail(`${mode}: too few meshes ${cache.meshes.length}`)
  else pass(`${mode}: ${cache.stats.ornamentMeshes} meshes / ${cache.stats.ornamentTriangles} tris (P${cache.stats.primaryMeshCount}/S${cache.stats.secondaryMeshCount})`)

  // Child not thicker than parent base at join
  const byId = new Map(network.branches.map((b) => [b.id, b]))
  const meshById = new Map(cache.meshes.map((m) => [m.id, m]))
  let thickOk = true
  for (const m of cache.meshes) {
    const b = byId.get(m.id)
    if (!b?.parentId) continue
    const parent = meshById.get(b.parentId)
    if (!parent) continue
    if (m.baseRadius > parent.baseRadius * 1.001) {
      thickOk = false
      fail(`${mode}: child ${m.id} thicker than parent (${m.baseRadius} > ${parent.baseRadius})`)
      break
    }
  }
  if (thickOk) pass(`${mode}: child radii ≤ parent bases`)

  // Mirror winding present for bilateral
  if (mode === 'bilateral') {
    const mirrors = cache.meshes.filter((m) => m.compositionRole === 'mirror')
    if (mirrors.length < 1) fail('bilateral: no mirror meshes')
    else pass(`bilateral: ${mirrors.length} mirror meshes`)
  }

  const playback = createGrowthPlayback(network, {
    ...DEFAULT_ORNAMENT,
    simulationDuration: 12,
    stretchTimeline: true,
    branchGenerations: 2,
  })

  // t=0 → empty draw ranges
  playback.setTime(0)
  let visibleAt0 = 0
  for (const m of cache.meshes) {
    const b = byId.get(m.id)
    const r = revealBranchAtTime(b, 0)
    const frac = (r.visibleLength ?? 0) / Math.max(1e-6, b.length || 1)
    applyGrowthDrawRange(m.geometry, frac)
    visibleAt0 += m.geometry.drawRange.count
  }
  if (visibleAt0 !== 0) fail(`${mode}: t=0 drawRange not empty (${visibleAt0})`)
  else pass(`${mode}: t=0 no geometry visible`)

  // Mid scrub — progressive, not full
  playback.setTime(3.5)
  let midVisible = 0
  let midFull = 0
  for (const m of cache.meshes) {
    const b = byId.get(m.id)
    const r = revealBranchAtTime(b, 3.5)
    const frac = (r.visibleLength ?? 0) / Math.max(1e-6, b.length || 1)
    applyGrowthDrawRange(m.geometry, frac)
    midVisible += m.geometry.drawRange.count
    const full = m.geometry.index.count
    if (frac >= 0.999) midFull += 1
    if (frac > 0 && frac < 0.999 && m.geometry.drawRange.count >= full) {
      fail(`${mode}: partial frac but full drawRange`)
    }
  }
  if (midVisible <= 0) fail(`${mode}: mid timeline still empty`)
  else pass(`${mode}: mid growth drawRange=${midVisible} (full meshes ${midFull}/${cache.meshes.length})`)

  // End — all revealed
  playback.setTime(playback.state.duration)
  let endIncomplete = 0
  for (const m of cache.meshes) {
    const b = byId.get(m.id)
    const r = revealBranchAtTime(b, playback.state.duration)
    const frac = (r.visibleLength ?? 0) / Math.max(1e-6, b.length || 1)
    applyGrowthDrawRange(m.geometry, frac)
    if (frac < 0.99) endIncomplete += 1
  }
  if (endIncomplete > 0) fail(`${mode}: ${endIncomplete} incomplete at end`)
  else pass(`${mode}: full reveal at duration`)

  // Reset empty
  playback.reset()
  let afterReset = 0
  for (const m of cache.meshes) {
    const b = byId.get(m.id)
    const r = revealBranchAtTime(b, playback.state.time)
    applyGrowthDrawRange(m.geometry, (r.visibleLength ?? 0) / Math.max(1e-6, b.length || 1))
    afterReset += m.geometry.drawRange.count
  }
  if (afterReset !== 0) fail(`${mode}: reset left geometry (${afterReset})`)
  else pass(`${mode}: reset clears growth`)

  // Pause freezes
  playback.setTime(2)
  playback.start()
  playback.pause()
  const t0 = playback.state.time
  playback.advance(0.4)
  if (Math.abs(playback.state.time - t0) > 1e-9) fail(`${mode}: pause advanced`)
  else pass(`${mode}: pause freezes clock`)

  disposeMeshCache(cache)
}

architecture.dispose?.()

console.log(ok ? '\nAll Step 10A checks passed.' : '\nStep 10A validation FAILED.')
process.exit(ok ? 0 : 1)
