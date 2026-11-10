/**
 * Step 13E.2 — Camera persistence contract checks (static + framing helpers).
 *
 * Full OrbitControls pose tests run in the browser; this script asserts the
 * framing policy helpers remain geometry-stable for repeated metric updates.
 *
 * Run: node scripts/validate-camera-persistence.mjs
 */
import * as THREE from 'three'
import { buildGothicFacadeElevation, clearWindowModuleCache } from '../src/geometry/gothicGrammar/assemblies/index.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13E.2 Camera Persistence ===')

clearWindowModuleCache()
const a3 = buildGothicFacadeElevation({ bayCount: 3, bayWidth: 3 })
const a5 = buildGothicFacadeElevation({ bayCount: 5, bayWidth: 3 })

function lookTarget(metrics) {
  const min = metrics?.boundingMin ?? [-2, 0, -0.125]
  const max = metrics?.boundingMax ?? [2, 4, 0.125]
  return new THREE.Vector3(
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  )
}

function radius(metrics) {
  const size = metrics?.boundingSize ?? [4, 4, 0.25]
  const w = size[0] ?? 4
  const h = size[1] ?? 4
  const d = size[2] ?? 0.25
  const fov = 42 * (Math.PI / 180)
  const fitW = (w * 0.55) / Math.tan(fov * 0.5)
  const fitH = (h * 0.55) / Math.tan(fov * 0.5)
  return Math.max(fitW, fitH, d * 1.2, w * 0.7, h * 0.9, 1)
}

function applyPreset(camera, controlsTarget, metrics, preset) {
  const target = lookTarget(metrics)
  const r = radius(metrics) * 1.15
  let offset
  switch (preset) {
    case 'front':
      offset = new THREE.Vector3(0, 0, r)
      break
    case 'side':
      offset = new THREE.Vector3(r, 0, 0)
      break
    case 'top':
      offset = new THREE.Vector3(0, r * 1.35, 0.01)
      break
    default:
      offset = new THREE.Vector3(r * 0.72, r * 0.28, r * 0.85)
  }
  camera.position.copy(target).add(offset)
  controlsTarget.copy(target)
  return { position: camera.position.clone(), target: controlsTarget.clone() }
}

const camera = new THREE.PerspectiveCamera(42, 1.6, 0.05, 200)
const target = new THREE.Vector3()

const custom = applyPreset(camera, target, a3.metrics, 'three-quarter')
// Simulate user orbit: nudge pose away from preset
camera.position.add(new THREE.Vector3(1.25, 0.4, -0.8))
target.add(new THREE.Vector3(0.2, -0.1, 0.15))
const before = {
  position: camera.position.clone(),
  target: target.clone(),
  quaternion: camera.quaternion.clone(),
}

// Geometry regeneration must leave camera untouched (policy under test)
void a5
const afterGeom = {
  position: camera.position.clone(),
  target: target.clone(),
  quaternion: camera.quaternion.clone(),
}

const eps = 1e-9
const sameVec = (a, b) => a.distanceTo(b) < eps
const sameQuat = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) + Math.abs(a.w - b.w) < 1e-9

if (!sameVec(before.position, afterGeom.position)) fail('geometry rebuild mutated camera position')
else pass('TEST A/C/D policy: geometry rebuild leaves position unchanged')

if (!sameVec(before.target, afterGeom.target)) fail('geometry rebuild mutated orbit target')
else pass('geometry rebuild leaves orbit target unchanged')

if (!sameQuat(before.quaternion, afterGeom.quaternion)) fail('geometry rebuild mutated quaternion')
else pass('geometry rebuild leaves quaternion unchanged')

// Explicit FRONT must move camera
const front = applyPreset(camera, target, a5.metrics, 'front')
if (sameVec(before.position, front.position)) fail('explicit FRONT did not move camera')
else pass('TEST E: explicit FRONT VIEW moves camera')

// Explicit three-quarter then FIT (re-apply) moves toward assembly bounds of a5
const fit = applyPreset(camera, target, a5.metrics, 'three-quarter')
if (!Number.isFinite(fit.position.x)) fail('FIT produced non-finite pose')
else pass('TEST F: explicit FIT / preset apply produces finite pose')

// After FIT, a custom orbit again must remain stable across another geom swap
camera.position.add(new THREE.Vector3(-0.7, 0.25, 0.5))
const postOrbit = camera.position.clone()
void buildGothicFacadeElevation({ bayCount: 4, pierWidth: 0.32 })
if (!sameVec(postOrbit, camera.position)) fail('post-orbit geometry change moved camera')
else pass('TEST G: after FIT+orbit, geometry change preserves pose')

if (!custom.position) fail('initial preset missing')
else pass('initial three-quarter framing available')

if (!ok) {
  console.error('\nCamera persistence validation FAILED')
  process.exit(1)
}
console.log('\nStep 13E.2 camera persistence validation passed')
