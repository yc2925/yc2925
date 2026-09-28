import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import ShaderLabPanel from '../ui/ShaderLabPanel.jsx'
import ShaderScene from '../shaders/ShaderScene.jsx'
import {
  DEFAULT_SHADER_LAB,
  SHADER_NOTES,
  SHADER_STRATEGIES,
  TEST_GEOMETRIES,
} from '../shaders/settings.js'

export default function ShaderLabView() {
  const [settings, setSettings] = useState(DEFAULT_SHADER_LAB)
  const settingsRef = useRef(settings)
  const [fps, setFps] = useState(0)

  useLayoutEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const handleGrowthProgress = useCallback((progress) => {
    setSettings((current) => ({
      ...current,
      growth: { ...current.growth, progress },
    }))
  }, [])

  const note = SHADER_NOTES[settings.strategy]
  const strategyLabel =
    SHADER_STRATEGIES.find((item) => item.id === settings.strategy)?.label ?? settings.strategy
  const geometryLabel =
    TEST_GEOMETRIES.find((item) => item.id === settings.geometry)?.label ?? settings.geometry

  return (
    <section className="shader-lab" aria-labelledby="shader-lab-title">
      <Canvas
        className="viewport"
        camera={{ position: [0, 0.4, 4.4], fov: 42 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#070707']} />
        <hemisphereLight args={['#d8d2c8', '#1a1a1a', 0.45]} />
        <ambientLight intensity={0.22} color="#e8e8e8" />
        <directionalLight position={[3.4, 4.2, 2.6]} intensity={1.05} color="#f3efe6" />
        <directionalLight position={[-2.8, 1.2, -1.4]} intensity={0.22} color="#8a8680" />
        <ShaderScene
          geometryId={settings.geometry}
          strategy={settings.strategy}
          settingsRef={settingsRef}
          rotateModel={settings.rotateModel}
          compare={settings.compare}
          onFps={setFps}
          onGrowthProgress={handleGrowthProgress}
        />
        <gridHelper args={[10, 10, '#2a2a2a', '#1a1a1a']} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={1.6}
          maxDistance={14}
        />
      </Canvas>

      <h2 id="shader-lab-title" className="voxel-lab-title">
        Shader Lab
      </h2>

      <aside className="shader-status" aria-label="Shader lab status">
        <div className="telemetry-row">
          <span>Shader</span>
          <span>{strategyLabel}</span>
        </div>
        <div className="telemetry-row">
          <span>Geometry</span>
          <span>{geometryLabel}</span>
        </div>
        <div className="telemetry-row">
          <span>FPS</span>
          <span>{fps || '—'}</span>
        </div>
        {settings.compare ? (
          <div className="telemetry-row">
            <span>Compare</span>
            <span>Baseline | Current</span>
          </div>
        ) : null}
        <p className="shader-brief">
          {note.testing} {note.why}
        </p>
      </aside>

      <ShaderLabPanel settings={settings} onChange={setSettings} />
    </section>
  )
}
