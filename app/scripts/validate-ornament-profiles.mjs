/**
 * Step 10B — sculptural profiles + relief validation.
 * Run: node scripts/validate-ornament-profiles.mjs
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
  blendProfile2D,
  buildOrnamentMeshCache,
  disposeMeshCache,
  profileBlendAt,
  sampleProfile2D,
  sweepSculpturalTube,
  sweepTaperedTube,
} from '../src/ornament/ornamentGeometry.js'
import { DEFAULT_ORNAMENT } from '../src/ornament/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 10B sculptural profiles validation ===')

// Unit: profile samples
{
  const round = sampleProfile2D('round', 0, { halfWidth: 0.02, halfDepth: 0.02 })
  const leaf = sampleProfile2D('leaf', 0, { halfWidth: 0.04, halfDepth: 0.015, ridgeStrength: 0.6 })
  const flute = sampleProfile2D('fluted', 0, {
    halfWidth: 0.02,
    halfDepth: 0.02,
    flutingStrength: 0.8,
  })
  const relief = sampleProfile2D('relief', Math.PI / 2, { halfWidth: 0.03, halfDepth: 0.02 })
  if (!(Math.abs(round.n - 0.02) < 1e-6 && Math.abs(round.b) < 1e-6)) fail('round sample')
  else pass('round profile sample')
  if (!(Math.abs(leaf.n) > Math.abs(round.n))) fail('leaf should be wider')
  else pass('leaf wider than round')
  if (!(Math.hypot(flute.n, flute.b) < 0.019)) fail('fluting should shrink radius at groove')
  else pass('fluted groove shrinks section')
  if (!(relief.b > 0)) fail('relief front should raise +B')
  else pass('carved relief raises outward')

  const mid = blendProfile2D(round, leaf, 0.5)
  if (!(mid.n > round.n && mid.n < leaf.n)) fail('blend not between')
  else pass('profile blend intermediate')

  const b0 = profileBlendAt(0, 0.6)
  const b1 = profileBlendAt(1, 0.6)
  if (!(b0 === 0 && b1 === 1)) fail(`blendAt ends ${b0} ${b1}`)
  else pass('profileBlendAt stem→tip')
}

// Unit: sweeps for each profile
const helix = []
for (let i = 0; i <= 24; i += 1) {
  const t = i / 24
  helix.push({ x: Math.sin(t * Math.PI) * 0.35, y: t * 1.1, z: 0 })
}

for (const profileType of ['round', 'fluted', 'leaf', 'relief']) {
  const geo = sweepSculpturalTube(helix, {
    baseRadius: 0.03,
    taperStrength: 0.7,
    radialResolution: 12,
    curveResolution: 28,
    profileType,
    profileWidth: 1.4,
    profileDepth: 0.6,
    flutingStrength: 0.5,
    profileTransition: 0.55,
    reliefDepth: 0.015,
    sculptureMode: 'surface',
    tipCurl: 0.5,
  })
  if (!geo) {
    fail(`${profileType}: null geo`)
    continue
  }
  const idx = geo.index
  const pos = geo.getAttribute('position')
  let degenerate = 0
  for (let i = 0; i < idx.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i))
    const b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1))
    const c = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2))
    const area = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length()
    if (area < 1e-12) degenerate += 1
  }
  const tris = idx.count / 3
  if (tris < 80) fail(`${profileType}: few tris ${tris}`)
  else if (degenerate > tris * 0.02) fail(`${profileType}: degenerate ${degenerate}/${tris}`)
  else pass(`${profileType}: ${tris} tris, ${degenerate} degenerate`)
  geo.dispose()
}

// 10A round still works
{
  const geo = sweepTaperedTube(helix, { baseRadius: 0.028, radialResolution: 10, curveResolution: 20 })
  if (!geo) fail('10A sweepTaperedTube broken')
  else {
    pass(`10A round wrapper ok (${geo.userData.triangleCount} tris)`)
    geo.dispose()
  }
}

// Integration: bilateral + profiles + growth
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

for (const seed of [11, 23]) {
  for (const gens of [1, 2]) {
    for (const profileType of ['round', 'leaf', 'relief']) {
      const sim = createParticleSimulation({
        arch: architecture.arch,
        anchors: growth.anchors,
        params: { ...DEFAULT_ORNAMENT, particleCount: 3, growthSeed: seed },
      })
      const trails = completeParticleTrails(sim)
      const network = composeOrnamentNetwork({
        trails,
        arch: architecture.arch,
        curveSamples: growth.curveSamples,
        params: {
          ...DEFAULT_ORNAMENT,
          compositionMode: 'bilateral',
          branchGenerations: gens,
          growthSeed: seed,
        },
      })
      const cache = buildOrnamentMeshCache(network, {
        ...DEFAULT_ORNAMENT,
        profileType,
        sculptureMode: 'surface',
        reliefDepth: 0.016,
        profileTransition: 0.58,
        branchGenerations: gens,
      })
      if (cache.meshes.length < 2) fail(`seed${seed} g${gens} ${profileType}: few meshes`)
      else pass(`seed${seed} g${gens} ${profileType}: ${cache.meshes.length} meshes / ${cache.stats.ornamentTriangles} tris`)

      const mirrors = cache.meshes.filter((m) => m.compositionRole === 'mirror')
      const masters = cache.meshes.filter((m) => m.compositionRole === 'master')
      if (mirrors.length < 1 || masters.length < 1) fail(`seed${seed}: missing mirror/master`)
      else pass(`seed${seed} ${profileType}: master ${masters.length} / mirror ${mirrors.length}`)

      const playback = createGrowthPlayback(network, {
        ...DEFAULT_ORNAMENT,
        simulationDuration: 12,
        stretchTimeline: true,
        branchGenerations: gens,
      })
      playback.setTime(0)
      let v0 = 0
      for (const m of cache.meshes) {
        const b = network.branches.find((x) => x.id === m.id)
        const r = revealBranchAtTime(b, 0)
        applyGrowthDrawRange(m.geometry, (r.visibleLength ?? 0) / Math.max(1e-6, b.length || 1))
        v0 += m.geometry.drawRange.count
      }
      if (v0 !== 0) fail(`seed${seed} ${profileType}: t=0 visible`)
      else pass(`seed${seed} ${profileType}: t=0 empty`)

      playback.setTime(5)
      let mid = 0
      for (const m of cache.meshes) {
        const b = network.branches.find((x) => x.id === m.id)
        const r = revealBranchAtTime(b, 5)
        const frac = (r.visibleLength ?? 0) / Math.max(1e-6, b.length || 1)
        applyGrowthDrawRange(m.geometry, frac)
        mid += m.geometry.drawRange.count
      }
      if (mid <= 0) fail(`seed${seed} ${profileType}: mid empty`)
      else pass(`seed${seed} ${profileType}: mid growth ok`)

      disposeMeshCache(cache)
    }
  }
}

architecture.dispose?.()
console.log(ok ? '\nAll Step 10B checks passed.' : '\nStep 10B validation FAILED.')
process.exit(ok ? 0 : 1)
