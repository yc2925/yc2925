import { useCallback, useDeferredValue, useLayoutEffect, useRef, useState } from 'react'
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
  const [geometryInfo, setGeometryInfo] = useState(null)
  const form = useDeferredValue(settings.form)
  const specimen = useDeferredValue(settings.specimen)

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
        camera={{ position: [3.6, 1.3, 5.75], fov: 38 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#050505']} />
        <hemisphereLight args={['#d4cdc2', '#161412', 0.34]} />
        <ambientLight intensity={0.12} color="#e8e8e8" />
        <directionalLight position={[4.4, 3.6, 1.6]} intensity={1.4} color="#f3efe6" />
        <directionalLight position={[-2.1, 0.55, -1.7]} intensity={0.2} color="#8a8680" />
        <ShaderScene
          geometryId={settings.geometry}
          form={form}
          specimen={specimen}
          strategy={settings.strategy}
          settingsRef={settingsRef}
          rotateModel={settings.rotateModel}
          compare={settings.compare}
          onFps={setFps}
          onGrowthProgress={handleGrowthProgress}
          onGeometryInfo={setGeometryInfo}
        />
        <gridHelper args={[10, 10, '#2a2a2a', '#1a1a1a']} position={[0, -1.62, 0]} />
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
          <span>Triangles</span>
          <span>{geometryInfo ? geometryInfo.triangles.toLocaleString('en-US') : '—'}</span>
        </div>
        {geometryInfo?.buildMs != null ? (
          <div className="telemetry-row">
            <span>Build</span>
            <span>{Math.round(geometryInfo.buildMs)} ms</span>
          </div>
        ) : null}
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
