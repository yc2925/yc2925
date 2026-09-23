import { CSG_SPHERE_RADIUS } from './settings.js'

export default function CsgSphere({ settings }) {
  if (!settings.showCsgWireframe || settings.csgOperation === 'shell') return null

  const scale = settings.terrainScale

  return (
    <mesh
      position={[settings.csgX * scale, settings.csgY * scale, settings.csgZ * scale]}
      renderOrder={3}
    >
      <sphereGeometry args={[CSG_SPHERE_RADIUS * scale, 24, 16]} />
      <meshBasicMaterial
        color="#e8e8e8"
        wireframe
        transparent
        opacity={0.65}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}
