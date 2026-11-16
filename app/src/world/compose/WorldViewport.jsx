/**
 * Main 3D world viewport (Step 47, slice scope).
 *
 * Shares the editor's coordinate system (metres, y up). Own camera: edits and
 * parameter changes never move it; "Fit selected" is an explicit action.
 *
 * Presentation per stage (references):
 *  - Curves / Gothic Skeleton: luminous member lines on black (REF-029, REF-024)
 *  - Lithic Formation: pale stone in clean light (REF-023, REF-027, REF-028)
 *  - World: stone + fog and depth (REF-009 / REF-016 atmosphere)
 *  - X-ray: translucent stone with the skeleton visible inside (REF-021)
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'

const SIGNAL = '#ff2020'
const KIND_ALPHA = {
  pier: 1,
  tower: 1,
  spire: 1,
  towerCrown: 0.9,
  transverseArch: 0.95,
  arcadeArch: 0.85,
  diagonalRib: 0.7,
  ridgeRib: 0.6,
  buttressPier: 0.75,
  flyingButtress: 0.7,
}

function SkeletonLines({ skeleton, selected, dim }) {
  return (
    <group>
      {skeleton.members.map((m) => (
        <Line
          key={m.id}
          points={m.points.map((p) => [p.x, p.y, p.z])}
          color={selected ? SIGNAL : '#e8eef2'}
          lineWidth={selected ? 1.6 : 1.2}
          transparent
          opacity={(KIND_ALPHA[m.kind] ?? 0.8) * (dim ? 0.35 : 1)}
          depthTest={!dim}
        />
      ))}
    </group>
  )
}

function SourceCurve({ skeleton, selected }) {
  if (skeleton.sourcePolyline.length < 2) return null
  return (
    <Line
      points={skeleton.sourcePolyline.map((p) => [p.x, p.y + 0.05, p.z])}
      color={selected ? SIGNAL : '#8a8a8a'}
      lineWidth={selected ? 2 : 1.25}
    />
  )
}

function LithicMesh({ mesh, xray, selected }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    g.computeBoundingSphere()
    return g
  }, [mesh])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={selected ? '#ddd2bd' : '#cfc6b3'}
        roughness={0.93}
        metalness={0}
        transparent={xray}
        opacity={xray ? 0.22 : 1}
        depthWrite={!xray}
        emissive={selected ? '#2a0606' : '#000000'}
      />
    </mesh>
  )
}

function Ground({ atmosphere }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color={atmosphere ? '#2a2826' : '#1a1a1a'} roughness={1} />
      </mesh>
      <gridHelper args={[200, 20, '#3a3a3a', '#242424']} position-y={0.01} />
    </group>
  )
}

const CameraRig = forwardRef(function CameraRig(_, ref) {
  const { camera, controls } = useThree()
  useImperativeHandle(ref, () => ({
    fit(bounds) {
      if (!bounds || !controls) return
      const c = new THREE.Vector3(
        (bounds.min.x + bounds.max.x) / 2,
        (bounds.min.y + bounds.max.y) / 2,
        (bounds.min.z + bounds.max.z) / 2,
      )
      const radius = Math.max(
        5,
        Math.hypot(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z) / 2,
      )
      const dir = camera.position.clone().sub(controls.target).normalize()
      const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05
      controls.target.copy(c)
      camera.position.copy(c.clone().add(dir.multiplyScalar(distance)))
      controls.update()
    },
  }))
  return null
})

const WorldViewport = forwardRef(function WorldViewport({ structures, lithic, stage, xray, selectedCurveId, onSelect }, ref) {
  const rig = useRef(null)
  useImperativeHandle(ref, () => ({ fit: (b) => rig.current?.fit(b) }))
  const showStone = stage === 'lithic' || stage === 'world'
  const atmosphere = stage === 'world'
  const bg = atmosphere ? '#16171a' : showStone ? '#101010' : '#050505'
  return (
    <Canvas
      className="world-viewport-canvas"
      shadows
      camera={{ position: [70, 55, 95], fov: 42, near: 0.5, far: 4000 }}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[bg]} />
      {atmosphere ? <fog attach="fog" args={[bg, 90, 520]} /> : null}
      <hemisphereLight args={['#f1ece2', '#26221d', showStone ? 0.75 : 0.4]} />
      <directionalLight
        position={[80, 140, 60]}
        intensity={showStone ? 2.1 : 0.6}
        castShadow={showStone}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-camera-far={500}
      />
      <OrbitControls makeDefault enableDamping={false} maxPolarAngle={Math.PI * 0.495} />
      <CameraRig ref={rig} />
      <Ground atmosphere={atmosphere} />
      {structures.map((s) => {
        if (!s.curve.visibility) return null
        const selected = s.curveId === selectedCurveId
        const mesh = lithic[s.structureId]?.mesh
        return (
          <group
            key={s.structureId}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(s.curveId)
            }}
          >
            <SourceCurve skeleton={s.skeleton} selected={selected} />
            {!showStone || xray || !mesh ? <SkeletonLines skeleton={s.skeleton} selected={selected} dim={showStone && !xray && !mesh} /> : null}
            {showStone && mesh ? <LithicMesh mesh={mesh} xray={xray} selected={selected} /> : null}
          </group>
        )
      })}
    </Canvas>
  )
})

export default WorldViewport
