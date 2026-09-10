import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import ParticleField from '../ParticleField.jsx'

export default function ParticlesView({ particles }) {
  return (
    <Canvas className="viewport" camera={{ position: [3, 2.4, 4], fov: 50 }} gl={{ antialias: true }}>
      <color attach="background" args={['#070707']} />
      <ParticleField
        spacing={particles.spacing}
        hue={particles.hue}
        shape={particles.shape}
      />
      <gridHelper args={[10, 10, '#2a2a2a', '#1a1a1a']} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2} maxDistance={24} />
    </Canvas>
  )
}
