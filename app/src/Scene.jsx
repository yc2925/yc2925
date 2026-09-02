import { OrbitControls } from '@react-three/drei'
import ParticleField from './ParticleField.jsx'

export default function Scene({ particles }) {
  return (
    <>
      <color attach="background" args={['#0f1116']} />
      <ParticleField
        spacing={particles.spacing}
        hue={particles.hue}
        shape={particles.shape}
      />
      <gridHelper args={[10, 10, '#3a3f4b', '#23262e']} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2} maxDistance={24} />
    </>
  )
}
