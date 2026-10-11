import { useDeferredValue, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import LSystemPanel from '../ui/LSystemPanel.jsx'
import LSystemScene from '../lsystems/LSystemScene.jsx'
import { createFacade } from '../growth/facade.js'
import { createSurface } from '../growth/surface.js'
import { generate } from '../lsystems/lsystem.js'
import { LOD_DISTANCE, LOD_LEVELS, LOD_SPEC } from '../lsystems/lod.js'
import { PRESETS, defaultSettings, formatRules, presetById } from '../lsystems/presets.js'

function createSpecimen() {
  const facade = createFacade()
  return { facade, surface: createSurface(facade) }
}

const LOD_MODES = ['auto', ...LOD_LEVELS]
const count = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'))

function Row({ label, value }) {
  return (
    <div className="telemetry-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function LSystemView() {
  const [settings, setSettings] = useState(() => defaultSettings())
  const [{ facade, surface }] = useState(createSpecimen)
  const [metrics, setMetrics] = useState(null)
  const params = useDeferredValue(settings)
  const preset = presetById(settings.preset)
  const activePreset = presetById(params.preset)

  const result = useMemo(
    () =>
      generate(
        activePreset,
        {
          iterations: params.iterations,
          seed: params.seed,
          angle: params.angle,
          step: params.step,
          lengthDecay: params.lengthDecay,
          widthDecay: params.widthDecay,
          width: params.width,
          randomness: params.randomness,
          tropism: params.tropism,
        },
        surface,
      ),
    [
      activePreset,
      surface,
      params.iterations,
      params.seed,
      params.angle,
      params.step,
      params.lengthDecay,
      params.widthDecay,
      params.width,
      params.randomness,
      params.tropism,
    ],
  )

  const choosePreset = (id) =>
    setSettings((current) => ({
      ...defaultSettings(id),
      showArchitecture: current.showArchitecture,
      showKnots: current.showKnots,
      lodMode: current.lodMode,
      wireframe: current.wireframe,
    }))
  const chooseLod = (lodMode) => setSettings((current) => ({ ...current, lodMode }))
  const levelLabel = metrics ? LOD_SPEC[metrics.level].label : '—'

  return (
    <section className="lsystem-lab" aria-labelledby="lsystem-lab-title">
      <Canvas className="viewport" camera={{ position: [4.6, 4.2, 12.4], fov: 38 }} gl={{ antialias: true }}>
        <color attach="background" args={['#070707']} />
        <hemisphereLight args={['#e8e8e8', '#141414', 0.5]} />
        <ambientLight intensity={0.12} />
        <directionalLight position={[5, 9, 7]} intensity={1.2} color="#e8e8e8" />
        <directionalLight position={[-6, 3, 4]} intensity={0.25} color="#e8e8e8" />
        <LSystemScene facade={facade} result={result} preset={activePreset} settings={settings} onMetrics={setMetrics} />
        <gridHelper args={[14, 14, '#2a2a2a', '#1a1a1a']} />
        <OrbitControls makeDefault target={[0, 2.6, 0]} enableDamping dampingFactor={0.08} minDistance={2} maxDistance={40} />
      </Canvas>

      <h2 id="lsystem-lab-title" className="voxel-lab-title">
        L-Systems
      </h2>

      <aside className="shader-status lsystem-status" aria-label="L-system status">
        <nav className="growth-studies" aria-label="L-system presets">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === settings.preset ? 'is-active' : ''}
              onClick={() => choosePreset(item.id)}
            >
              <span>{item.index}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <p className="growth-pipeline">
          Axiom <span>→</span> Rewrite × {result.completed} <span>→</span> Turtle <span>→</span> Geometry
        </p>

        <div className="lsystem-rules">
          <div>
            <span>ω</span>
            {preset.axiom}
          </div>
          {formatRules(preset).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>

        <Row label="Placement" value={{ free: 'Free · avoids wall', conform: 'Conform to surface', project: '2D → raycast' }[activePreset.placement]} />
        <Row label="Symbols" value={result.string.length.toLocaleString('en-US')} />
        <Row label="Segments" value={result.segments.length.toLocaleString('en-US')} />
        <Row label="Knots" value={result.knots.length.toLocaleString('en-US')} />
        <Row label="Generate" value={`${Math.round(result.ms)} ms`} />

        <nav className="growth-studies lsystem-lod" aria-label="Level of detail">
          {LOD_MODES.map((mode) => (
            <button key={mode} type="button" className={mode === settings.lodMode ? 'is-active' : ''} onClick={() => chooseLod(mode)}>
              {mode === 'auto' ? 'Auto' : LOD_SPEC[mode].label}
            </button>
          ))}
        </nav>
        <Row label="FPS" value={metrics ? metrics.fps.toFixed(0) : '—'} />
        <Row label="Current LOD" value={settings.lodMode === 'auto' ? `Auto · ${levelLabel}` : levelLabel} />
        <Row label="Camera dist." value={metrics ? metrics.distance.toFixed(1) : '—'} />
        <Row label="Branches" value={count(metrics?.current?.branches)} />
        <Row label="Specimen tris" value={count(metrics?.current?.triangles)} />
        <Row label="Frame tris" value={count(metrics?.frameTriangles)} />
        <Row label="Draw calls" value={count(metrics?.calls)} />
        <Row label="GPU geometries" value={count(metrics?.geometries)} />

        <div className="lsystem-rules lsystem-compare">
          <div>
            <span>LOD</span>
            <span>branches</span>
            <span>triangles</span>
          </div>
          {LOD_LEVELS.map((id) => (
            <div key={id} className={metrics?.level === id ? 'is-active' : ''}>
              <span>
                {LOD_SPEC[id].label} {id === 'high' ? '' : `≥${LOD_DISTANCE[id]}`}
              </span>
              <span>{count(metrics?.levels[id]?.branches)}</span>
              <span>{count(metrics?.levels[id]?.triangles)}</span>
            </div>
          ))}
        </div>

        <p className="shader-brief">{preset.note}</p>
      </aside>

      <LSystemPanel settings={settings} preset={preset} onChange={setSettings} onPreset={choosePreset} />
    </section>
  )
}
