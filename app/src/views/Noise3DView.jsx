import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { fillHeightmap } from '../noise/sample.js'
import Noise2DView from './Noise2DView.jsx'

function heightToRed(t) {
  const stops = [
    { t: 0, r: 0.1, g: 0.01, b: 0.01 },
    { t: 0.35, r: 0.48, g: 0.05, b: 0.02 },
    { t: 0.7, r: 1, g: 0.23, b: 0 },
    { t: 1, r: 1, g: 0.72, b: 0.58 },
  ]
  const clamped = Math.min(1, Math.max(0, t))
  let i = 0
  while (i < stops.length - 2 && clamped > stops[i + 1].t) i += 1
  const a = stops[i]
  const b = stops[i + 1]
  const u = (clamped - a.t) / Math.max(1e-6, b.t - a.t)
  return [a.r + (b.r - a.r) * u, a.g + (b.g - a.g) * u, a.b + (b.b - a.b) * u]
}

function HeightGrid({ noise }) {
  const size = Math.round(noise.resolution)
  const heights = useMemo(() => fillHeightmap(noise), [noise])

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(10, 10, size - 1, size - 1)
    const positions = plane.attributes.position
    const colors = new Float32Array(positions.count * 3)
    const extent = 10

    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const col = Math.round(((x + extent / 2) / extent) * (size - 1))
      const row = Math.round(((y + extent / 2) / extent) * (size - 1))
      const index =
        Math.min(size - 1, Math.max(0, row)) * size + Math.min(size - 1, Math.max(0, col))
      const h = heights[index] ?? 0
      positions.setZ(i, h * noise.amplitude * 2.4)
      const [r, g, b] = heightToRed((h + 1) * 0.5)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    positions.needsUpdate = true
    plane.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    plane.computeVertexNormals()
    return plane
  }, [heights, noise.amplitude, size])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.88} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#3f1a12" wireframe transparent opacity={0.22} />
      </mesh>
    </group>
  )
}

export default function Noise3DView({ noise }) {
  return (
    <div className="noise-3d">
      <Canvas className="viewport" camera={{ position: [7, 6, 7], fov: 50 }} gl={{ antialias: true }}>
        <color attach="background" args={['#070707']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[6, 10, 4]} intensity={0.9} color="#e8e8e8" />
        <HeightGrid noise={noise} />
        <gridHelper args={[12, 12, '#2a2a2a', '#1a1a1a']} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          autoRotate
          autoRotateSpeed={0.45}
          minDistance={3}
          maxDistance={28}
        />
      </Canvas>

      <aside className="noise-float" aria-label="Noise 2D preview">
        <header>Noise 2D</header>
        <Noise2DView noise={noise} compact />
      </aside>
    </div>
  )
}
