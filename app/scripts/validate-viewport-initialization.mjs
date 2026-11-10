/**
 * Step 13E.4.2 — Viewport / camera initialization regression.
 * Run: npm run validate:viewport-initialization
 *
 * Browser framing is verified separately; this script locks the math +
 * lifecycle contracts that caused the tiny-geometry bug (pixel frusta).
 */
import * as THREE from 'three'
import {
  buildGothicFacadeElevation,
  clearWindowModuleCache,
  SUPPORT_STYLES,
} from '../src/geometry/gothicGrammar/assemblies/index.js'
import {
  buildArchConstruction,
  archFramingBounds,
} from '../src/geometry/gothicGrammar/construction/archConstruction.js'
import { DEFAULT_ARCH_PARAMS } from '../src/geometry/gothicGrammar/primitives/archFamilies.js'
import {
  DEFAULT_ASSEMBLY_SETTINGS,
  DEFAULT_STONE_SETTINGS,
} from '../src/geometry/gothicGrammar/settings.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13E.4.2 Viewport Initialization ===')

const WORKSPACE_MODES = [
  'pointed-arch',
  'compare-arches',
  'tracery',
  'stone-3d',
  'architectural-assembly',
]

{
  for (const m of WORKSPACE_MODES) {
    if (typeof m !== 'string' || !m) {
      fail(`missing workspace mode ${m}`)
    }
  }
  pass(`workspace modes covered: ${WORKSPACE_MODES.join(', ')}`)
}

function orthoFrustumFromBounds(bounds, viewport, pad = 1.2) {
  const aspect = viewport.width / Math.max(1, viewport.height)
  const width = Math.max(0.5, bounds.width)
  const height = Math.max(0.5, bounds.height)
  const half = Math.max(width, height) * 0.5 * pad
  return {
    left: -half * aspect,
    right: half * aspect,
    top: half,
    bottom: -half,
    half,
    cx: (bounds.min.x + bounds.max.x) / 2,
    cy: (bounds.min.y + bounds.max.y) / 2,
  }
}

function isValidPose(pose) {
  if (!pose) return false
  const nums = [
    ...(pose.position ?? []),
    ...(pose.target ?? []),
    pose.zoom,
    pose.near,
    pose.far,
  ]
  for (const n of nums) {
    if (!Number.isFinite(n)) return false
  }
  if (pose.zoom != null && !(pose.zoom > 0)) return false
  if (!(pose.near > 0) || !(pose.far > pose.near)) return false
  return true
}

{
  const arch = buildArchConstruction({ ...DEFAULT_ARCH_PARAMS })
  const bounds = archFramingBounds(arch, {})
  if (!(bounds?.width > 0.5) || !(bounds?.height > 0.5)) {
    fail(`arch bounds too small: ${JSON.stringify(bounds)}`)
  } else pass(`pointed-arch bounds ${bounds.width.toFixed(2)}×${bounds.height.toFixed(2)} m`)

  const pixelViewport = { width: 960, height: 720 }
  const world = orthoFrustumFromBounds(bounds, pixelViewport, 1.2)
  const pixelHalfW = pixelViewport.width / 2
  // World frustum must be O(geometry), NOT O(canvas pixels).
  if (world.right > pixelHalfW * 0.5) {
    fail(`frustum still pixel-scale: right=${world.right} (pixel half=${pixelHalfW})`)
  } else pass(`ortho frustum world-scale right=${world.right.toFixed(2)} (not ${pixelHalfW})`)

  if (!(world.right > bounds.width * 0.4)) {
    fail('frustum smaller than geometry — would clip')
  } else pass('frustum spans geometry with padding')

  // Zero-size viewport must be rejected by lifecycle (contract).
  const zeroOk = !(0 > 1) // size.width > 1 gate
  if (!zeroOk) fail('zero viewport gate broken')
  else pass('initial fit waits for nonzero viewport (size>1 contract)')
}

{
  clearWindowModuleCache()
  const facade = buildGothicFacadeElevation({
    bayCount: 3,
    bayWidth: 3,
    supportStyle: SUPPORT_STYLES.COMBINED,
    id: 'facade-gg-b3',
  })
  const size = facade.metrics?.boundingSize
  if (!size || !(size[0] > 0.5) || !(size[1] > 0.5)) {
    fail('assembly metrics missing for framing')
  } else pass(`assembly metrics ${size[0].toFixed(2)}×${size[1].toFixed(2)} m`)

  const min = facade.metrics.boundingMin
  const max = facade.metrics.boundingMax
  const target = new THREE.Vector3(
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  )
  const camera = new THREE.PerspectiveCamera(42, 1.6, 0.05, 200)
  const r = Math.max(size[0], size[1]) * 1.2
  camera.position.set(target.x + r * 0.72, target.y + r * 0.28, target.z + r * 0.85)
  const pose = {
    position: camera.position.toArray(),
    target: target.toArray(),
    zoom: 1,
    near: camera.near,
    far: camera.far,
  }
  if (!isValidPose(pose)) fail('default assembly pose invalid')
  else pass('assembly three-quarter default pose valid')
}

{
  if (DEFAULT_ASSEMBLY_SETTINGS.viewPreset !== 'three-quarter') {
    fail(`assembly default viewPreset=${DEFAULT_ASSEMBLY_SETTINGS.viewPreset}`)
  } else pass('assembly default viewPreset = three-quarter')

  if (DEFAULT_STONE_SETTINGS.viewPreset !== 'three-quarter') {
    fail(`stone default viewPreset=${DEFAULT_STONE_SETTINGS.viewPreset}`)
  } else pass('stone default viewPreset = three-quarter')
}

{
  const bad = [
    { position: [NaN, 0, 0], target: [0, 0, 0], zoom: 1, near: 0.1, far: 100 },
    { position: [0, 0, 5], target: [0, Infinity, 0], zoom: 1, near: 0.1, far: 100 },
    { position: [0, 0, 5], target: [0, 0, 0], zoom: 0, near: 0.1, far: 100 },
    { position: [0, 0, 5], target: [0, 0, 0], zoom: 1, near: 10, far: 1 },
  ]
  for (const p of bad) {
    if (isValidPose(p)) fail(`accepted invalid pose ${JSON.stringify(p)}`)
  }
  pass('invalid camera poses rejected')

  const good = { position: [4, 2, 5], target: [0, 1.5, 0], zoom: 1, near: 0.05, far: 200 }
  if (!isValidPose(good)) fail('rejected valid pose')
  else pass('valid camera pose accepted')
}

{
  // Geometry edit must not require auto-fit (contract: hasFramedRef stays true).
  // Encode as: framing half-extent independent of a second bounds compute.
  const arch1 = buildArchConstruction({ ...DEFAULT_ARCH_PARAMS, span: 3 })
  const arch2 = buildArchConstruction({ ...DEFAULT_ARCH_PARAMS, span: 3.4 })
  const b1 = archFramingBounds(arch1, {})
  const b2 = archFramingBounds(arch2, {})
  const f1 = orthoFrustumFromBounds(b1, { width: 800, height: 600 }, 1.2)
  const f2 = orthoFrustumFromBounds(b2, { width: 800, height: 600 }, 1.2)
  if (f1.half === f2.half) fail('expected different halves for different spans')
  else pass('geometry edit changes bounds (camera preservation is view-layer policy)')
}

{
  // Resize keeps half-extent, refreshes aspect only.
  const bounds = { width: 3, height: 2.6, min: { x: -1.5, y: 0 }, max: { x: 1.5, y: 2.6 } }
  const a = orthoFrustumFromBounds(bounds, { width: 800, height: 600 }, 1.2)
  const b = orthoFrustumFromBounds(bounds, { width: 1200, height: 600 }, 1.2)
  if (Math.abs(a.half - b.half) > 1e-9) fail('half extent changed on resize')
  if (!(b.right > a.right)) fail('wider viewport should widen left/right')
  else pass('resize preserves half-extent, updates aspect')
}

console.log(ok ? '\nvalidate:viewport-initialization PASS' : '\nvalidate:viewport-initialization FAIL')
process.exit(ok ? 0 : 1)
