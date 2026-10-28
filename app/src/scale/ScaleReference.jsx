/**
 * Step 12A — Optional scale reference overlays (not part of exported ornament).
 */

import * as THREE from 'three'
import { HUMAN_REFERENCE_HEIGHT } from './config.js'

function MarkerBar({ from, to, color = '#c8a84a', thickness = 0.018 }) {
  const mid = [(from[0] + to[0]) * 0.5, (from[1] + to[1]) * 0.5, (from[2] + to[2]) * 0.5]
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const len = Math.hypot(dx, dy, dz) || 1e-6
  const quat = new THREE.Quaternion()
  quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize())
  return (
    <mesh position={mid} quaternion={quat} userData={{ scaleReference: true }}>
      <boxGeometry args={[thickness, len, thickness]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} depthTest={false} />
    </mesh>
  )
}

/** Simple standing human silhouette (~1.7 m) — flat box stack, no character art. */
function HumanSilhouette({ x = 0, z = 0.05, height = HUMAN_REFERENCE_HEIGHT }) {
  const h = height
  const bodyH = h * 0.55
  const legH = h * 0.42
  const headR = h * 0.07
  return (
    <group position={[x, 0, z]} userData={{ scaleReference: true, exportOmit: true }}>
      <mesh position={[0, legH * 0.5, 0]}>
        <boxGeometry args={[0.12, legH, 0.08]} />
        <meshBasicMaterial color="#8a8a8a" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, legH + bodyH * 0.5, 0]}>
        <boxGeometry args={[0.28, bodyH, 0.12]} />
        <meshBasicMaterial color="#9a9a9a" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, legH + bodyH + headR, 0]}>
        <sphereGeometry args={[headR, 10, 8]} />
        <meshBasicMaterial color="#b0b0b0" transparent opacity={0.55} />
      </mesh>
    </group>
  )
}

function ScaleBar({ width, z = 0.04 }) {
  const barLen = Math.min(1, Math.max(0.5, width * 0.25))
  const x0 = -width * 0.5
  const y = 0.015
  return (
    <group userData={{ scaleReference: true, exportOmit: true }}>
      <MarkerBar from={[x0, y, z]} to={[x0 + barLen, y, z]} color="#d4c48a" thickness={0.014} />
      <MarkerBar from={[x0, y, z]} to={[x0, y + 0.1, z]} color="#d4c48a" thickness={0.014} />
      <MarkerBar
        from={[x0 + barLen * 0.5, y, z]}
        to={[x0 + barLen * 0.5, y + 0.07, z]}
        color="#d4c48a"
        thickness={0.012}
      />
      <MarkerBar
        from={[x0 + barLen, y, z]}
        to={[x0 + barLen, y + 0.1, z]}
        color="#d4c48a"
        thickness={0.014}
      />
    </group>
  )
}

function GroundReference({ width, depth = 0.9 }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.002, -depth * 0.12]}
      userData={{ scaleReference: true, exportOmit: true }}
    >
      <planeGeometry args={[width * 1.4, depth]} />
      <meshBasicMaterial color="#1c1c1c" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  )
}

/**
 * Optional metric overlays. Never included in ornamental export meshes.
 */
export default function ScaleReference({
  width = 3,
  height = 5.7,
  showScaleReference = false,
  showDimensions = false,
  showHumanReference = false,
  humanHeight = HUMAN_REFERENCE_HEIGHT,
}) {
  if (!showScaleReference && !showDimensions && !showHumanReference) return null

  const half = width * 0.5
  const dimOn = showScaleReference || showDimensions
  const z = 0.08

  return (
    <group name="ScaleReference" userData={{ scaleReference: true, exportOmit: true }}>
      {showScaleReference ? <GroundReference width={width} /> : null}
      {showScaleReference ? <ScaleBar width={width} z={z} /> : null}
      {dimOn ? (
        <group userData={{ scaleReference: true }}>
          <MarkerBar from={[-half - 0.12, 0, z]} to={[-half - 0.12, height, z]} />
          <MarkerBar from={[-half, height + 0.12, z]} to={[half, height + 0.12, z]} />
          <mesh position={[-half - 0.12, 0, z]}>
            <boxGeometry args={[0.05, 0.05, 0.05]} />
            <meshBasicMaterial color="#c8a84a" />
          </mesh>
          <mesh position={[-half - 0.12, height, z]}>
            <boxGeometry args={[0.05, 0.05, 0.05]} />
            <meshBasicMaterial color="#c8a84a" />
          </mesh>
        </group>
      ) : null}
      {showHumanReference ? (
        <HumanSilhouette x={-half - Math.max(0.55, humanHeight * 0.35)} z={z} height={humanHeight} />
      ) : null}
    </group>
  )
}

/** Fit OrbitControls + camera to an axis-aligned envelope. */
export function fitCameraToEnvelope(camera, controls, envelope, opts = {}) {
  if (!camera || !envelope) return
  const w = envelope.width ?? 3
  const h = envelope.height ?? 5.7
  const pad = opts.pad ?? 1.35
  const targetY = h * 0.48
  const target = new THREE.Vector3(0, targetY, 0)
  const dist = Math.max(w, h) * pad * 0.85
  const dir = new THREE.Vector3(0.42, 0.28, 1).normalize()
  camera.position.copy(target).addScaledVector(dir, dist)
  camera.near = Math.max(0.05, dist * 0.02)
  camera.far = Math.max(80, dist * 8)
  camera.updateProjectionMatrix()
  if (controls) {
    controls.target.copy(target)
    controls.minDistance = Math.max(0.5, dist * 0.15)
    controls.maxDistance = Math.max(40, dist * 4)
    controls.update()
  }
}
