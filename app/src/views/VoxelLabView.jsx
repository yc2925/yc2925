import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import VoxelLabPanel from '../ui/VoxelLabPanel.jsx'
import { createDensityVolume } from '../voxel/density.js'
import { DEFAULT_VOXEL_TERRAIN } from '../voxel/settings.js'
import VoxelCubes from '../voxel/VoxelCubes.jsx'

export default function VoxelLabView() {
  const [settings, setSettings] = useState(DEFAULT_VOXEL_TERRAIN)
  const volume = useMemo(() => createDensityVolume(settings), [settings])

  return (
    <section className="voxel-lab" aria-labelledby="voxel-lab-title">
      <Canvas
        className="viewport"
        camera={{ position: [6, 5, 6], fov: 50 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#070707']} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[5, 8, 4]} intensity={0.9} color="#e8e8e8" />
        <VoxelCubes volume={volume} />
        <gridHelper
          position={[0, -settings.terrainScale * 0.5, 0]}
          args={[12, 12, '#2a2a2a', '#1a1a1a']}
        />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={28}
        />
      </Canvas>

      <h2 id="voxel-lab-title" className="voxel-lab-title">
        Voxel Exercise
      </h2>

      <VoxelLabPanel settings={settings} onChange={setSettings} />
    </section>
  )
}
