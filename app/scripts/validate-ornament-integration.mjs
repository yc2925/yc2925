/**
 * Step 10C — architectural integration validation.
 * Run: node scripts/validate-ornament-integration.mjs
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
  buildOrnamentMeshCache,
  disposeMeshCache,
} from '../src/ornament/ornamentGeometry.js'
import {
  attachOrnamentNetwork,
  buildSurfaceIndex,
  featureInfluence,
  integrationStateAt,
  mirrorAttachment,
  resolveAttachment,
} from '../src/ornament/architecturalAttachment.js'
import { DEFAULT_ORNAMENT } from '../src/ornament/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 10C architectural integration validation ===')

// --- Unit: integration states smooth ---
{
  const params = {
    transitionLength: 0.55,
    sculpturalEmergence: 0.6,
    surfaceConformity: 0.7,
  }
  const a = integrationStateAt(0, params)
  const mid = integrationStateAt(0.35, params)
  const tip = integrationStateAt(0.95, params)
  if (!(a.embedded > 0.5 && tip.free > mid.free)) {
    fail(`state order emb=${a.embedded.toFixed(2)} midFree=${mid.free.toFixed(2)} tipFree=${tip.free.toFixed(2)}`)
  } else pass(`integration states A→C (emb ${a.embedded.toFixed(2)} → free ${tip.free.toFixed(2)})`)

  // No hard jumps across samples
  let maxJump = 0
  let prev = integrationStateAt(0, params)
  for (let i = 1; i <= 40; i += 1) {
    const s = integrationStateAt(i / 40, params)
    maxJump = Math.max(
      maxJump,
      Math.abs(s.embedded - prev.embedded),
      Math.abs(s.raised - prev.raised),
      Math.abs(s.free - prev.free),
    )
    prev = s
  }
  if (maxJump > 0.35) fail(`hard transition jump ${maxJump.toFixed(3)}`)
  else pass(`smooth state transitions (max Δ ${maxJump.toFixed(3)})`)
}

// --- Unit: feature influence ---
{
  const arch = featureInfluence('frame')
  const mull = featureInfluence('mullion')
  const trac = featureInfluence('tracery')
  const junc = featureInfluence('junction')
  if (!(mull.conformBias > trac.conformBias && trac.emergeBias > mull.emergeBias)) {
    fail('feature biases unexpected')
  } else pass('feature influence arches/mullions/tracery/junctions')
  if (!(junc.rootScale > trac.rootScale)) fail('junction rootScale not broader')
  else pass(`junction rootScale ${junc.rootScale} > tracery ${trac.rootScale}`)
  void arch
}

// --- Unit: mirror attachment ---
{
  const att = {
    valid: true,
    position: new THREE.Vector3(0.4, 1.2, 0.05),
    normal: new THREE.Vector3(0.1, 0, 1).normalize(),
    tangent: new THREE.Vector3(0.2, 1, 0).normalize(),
    side: new THREE.Vector3(1, 0, 0),
    distance: 0.02,
    featureType: 'tracery',
    featureId: 't1',
    source: 'feature',
    strength: 0.9,
    influence: featureInfluence('tracery'),
  }
  const m = mirrorAttachment(att, 0)
  if (Math.abs(m.position.x + 0.4) > 1e-6) fail(`mirror x ${m.position.x}`)
  else if (Math.abs(m.normal.x + att.normal.x) > 1e-6) fail('mirror normal.x')
  else pass('mirrorAttachment reflects position + normal.x')
}

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

const surfaceIndex = buildSurfaceIndex(architecture.arch, architecture.specimen)
if ((surfaceIndex.featureSamples?.length ?? 0) < 20) {
  fail(`too few feature samples ${surfaceIndex.featureSamples?.length}`)
} else {
  pass(
    `surface index: ${surfaceIndex.featureSamples.length} feature + ${surfaceIndex.meshSamples.length} mesh samples`,
  )
}

// Nearest-surface reject when far
{
  const far = resolveAttachment(new THREE.Vector3(50, 50, 50), surfaceIndex, {
    attachmentStrength: 1,
    maxDistance: 0.4,
  })
  if (far.valid) fail('far query should be invalid')
  else pass('far query flagged invalid')
}

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

  const attach = attachOrnamentNetwork(network, surfaceIndex, {
    attachmentStrength: 0.9,
    maxAttachDistance: 0.55,
  })
  const primaries = network.branches.filter((b) => (b.generation ?? 0) === 0)
  const primaryValid = primaries.filter((b) => attach.attachments.get(b.id)?.valid).length
  if (primaryValid < Math.max(1, primaries.length * 0.5)) {
    fail(`${mode}: few valid primary attachments ${primaryValid}/${primaries.length}`)
  } else pass(`${mode}: primary attachments ${primaryValid}/${primaries.length} valid`)

  if (mode === 'bilateral') {
    const masters = network.branches.filter((b) => (b.compositionRole ?? 'master') === 'master')
    let mirrorOk = true
    for (const b of network.branches) {
      if (b.compositionRole !== 'mirror' || !b.sourceId) continue
      const src = attach.attachments.get(b.sourceId)
      const mir = attach.attachments.get(b.id)
      if (!src?.valid || !mir?.valid) continue
      const ax = network.composition?.axis?.axisX ?? 0
      const expectX = ax - (src.position.x - ax)
      if (Math.abs(mir.position.x - expectX) > 1e-4) {
        mirrorOk = false
        fail(`${mode}: mirror attach x mismatch`)
        break
      }
      if (Math.abs(mir.normal.x + src.normal.x) > 1e-4) {
        mirrorOk = false
        fail(`${mode}: mirror normal not reflected`)
        break
      }
    }
    if (mirrorOk) pass(`${mode}: mirrored attachments geometrically reflected`)
    void masters
  }

  const cache = buildOrnamentMeshCache(network, {
    ...DEFAULT_ORNAMENT,
    ornamentThickness: 0.03,
    taperStrength: 0.72,
    branchThicknessDecay: 0.68,
    radialResolution: 10,
    curveResolution: 0.55,
    profileType: 'leaf',
    attachmentStrength: 0.9,
    surfaceConformity: 0.75,
    rootEmbedding: 0.014,
    reliefProjection: 0.018,
    sculpturalEmergence: 0.55,
    transitionLength: 0.55,
    arch: architecture.arch,
    specimen: architecture.specimen,
    surfaceIndex,
  })

  if (cache.meshes.length < 2) fail(`${mode}: too few meshes ${cache.meshes.length}`)
  else {
    pass(
      `${mode}: ${cache.stats.ornamentMeshes} meshes / ${cache.stats.ornamentTriangles} tris · attach ${cache.stats.validAttachments} ok / ${cache.stats.invalidAttachments} miss`,
    )
  }

  // Roots should sit near attachment (first ring center ≈ attach.position after embed)
  let floatCount = 0
  for (const m of cache.meshes) {
    const b = network.branches.find((x) => x.id === m.id)
    if (!b || (b.generation ?? 0) > 0) continue
    const att = attach.attachments.get(m.id)
    if (!att?.valid) continue
    const pos = m.geometry.getAttribute('position')
    // Average first ring (radial segs)
    const radial = m.radialSegments ?? 10
    const c = new THREE.Vector3()
    for (let j = 0; j < radial; j += 1) {
      c.x += pos.getX(j)
      c.y += pos.getY(j)
      c.z += pos.getZ(j)
    }
    c.multiplyScalar(1 / radial)
    // Embedded root is pulled into stone along -normal; allow embedding + radius budget
    const expected = att.position
      .clone()
      .addScaledVector(att.normal, -(DEFAULT_ORNAMENT.rootEmbedding ?? 0.014))
    const dist = c.distanceTo(expected)
    if (dist > 0.12) floatCount += 1
  }
  if (floatCount > 0) fail(`${mode}: ${floatCount} primary roots float from attach`)
  else pass(`${mode}: primary roots near embedded attachments`)

  // Degenerate triangle check (sample)
  let badTris = 0
  let totalTris = 0
  for (const m of cache.meshes) {
    const geo = m.geometry
    const idx = geo.index
    const pos = geo.getAttribute('position')
    const step = Math.max(1, Math.floor(idx.count / 3 / 40))
    for (let i = 0; i < idx.count; i += 3 * step) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i))
      const b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1))
      const c = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2))
      const area =
        new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5
      totalTris += 1
      if (area < 1e-12) badTris += 1
    }
  }
  if (badTris > totalTris * 0.03) fail(`${mode}: degenerate tris ${badTris}/${totalTris}`)
  else pass(`${mode}: mesh integrity (${badTris} degenerate / ${totalTris} sampled)`)

  // Animation progressive
  const playback = createGrowthPlayback(network, {
    ...DEFAULT_ORNAMENT,
    simulationDuration: 12,
    stretchTimeline: true,
    branchGenerations: 2,
  })
  playback.setTime(0)
  let v0 = 0
  for (const m of cache.meshes) {
    const b = network.branches.find((x) => x.id === m.id)
    const r = revealBranchAtTime(b, 0)
    applyGrowthDrawRange(m.geometry, (r.visibleLength ?? 0) / Math.max(1e-6, b.length || 1))
    v0 += m.geometry.drawRange.count
  }
  if (v0 !== 0) fail(`${mode}: t=0 visible`)
  else pass(`${mode}: t=0 empty`)

  playback.setTime(4)
  let vMid = 0
  for (const m of cache.meshes) {
    const b = network.branches.find((x) => x.id === m.id)
    const r = revealBranchAtTime(b, 4)
    applyGrowthDrawRange(m.geometry, (r.visibleLength ?? 0) / Math.max(1e-6, b.length || 1))
    vMid += m.geometry.drawRange.count
  }
  if (vMid <= 0) fail(`${mode}: mid empty`)
  else pass(`${mode}: progressive mid growth`)

  playback.reset()
  let vR = 0
  for (const m of cache.meshes) {
    const b = network.branches.find((x) => x.id === m.id)
    const r = revealBranchAtTime(b, playback.state.time)
    applyGrowthDrawRange(m.geometry, (r.visibleLength ?? 0) / Math.max(1e-6, b.length || 1))
    vR += m.geometry.drawRange.count
  }
  if (vR !== 0) fail(`${mode}: reset visible`)
  else pass(`${mode}: reset clears`)

  if (!cache.attachmentDebug?.points) fail(`${mode}: missing attachment debug`)
  else pass(`${mode}: attachment debug geometries present`)

  disposeMeshCache(cache)
}

architecture.dispose?.()

console.log(ok ? '\nAll Step 10C checks passed.' : '\nStep 10C validation FAILED.')
process.exit(ok ? 0 : 1)
