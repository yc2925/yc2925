import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Architecture } from '../growth/GrowthScene.jsx'
import { LOD_CENTER, LOD_LEVELS, SpecimenLOD } from './lod.js'

const METRICS_INTERVAL = 500

/**
 * The specimen is one THREE.LOD (see lod.js). Changing the LOD mode, growth, knots or
 * wireframe never regenerates the grammar; only a new `result` rebuilds level geometry.
 *
 * Metrics are sampled every 0.5 s. Draw calls and triangles come from renderer.info of the
 * previous frame (whole scene: architecture and specimen; grid lines are not triangles).
 */
export default function LSystemScene({ facade, result, preset, settings, onMetrics }) {
  const specimen = useMemo(() => new SpecimenLOD(), [])
  const isTracery = preset.placement === 'project'
  const gl = useThree((state) => state.gl)
  const sample = useRef({ frames: 0, start: 0 })

  useEffect(() => () => specimen.dispose(), [specimen])
  useLayoutEffect(() => specimen.setResult(result, isTracery), [specimen, result, isTracery])
  useLayoutEffect(() => specimen.setMode(settings.lodMode), [specimen, settings.lodMode, result])
  useLayoutEffect(() => specimen.setGrowth(settings.growth), [specimen, settings.growth, result])
  useLayoutEffect(() => specimen.setShowKnots(settings.showKnots), [specimen, settings.showKnots, result])
  useLayoutEffect(() => specimen.setWireframe(settings.wireframe), [specimen, settings.wireframe])

  useFrame(({ camera }) => {
    const now = performance.now()
    const s = sample.current
    if (!s.start) s.start = now
    s.frames += 1
    if (now - s.start < METRICS_INTERVAL) return
    const level = specimen.currentLevel()
    onMetrics({
      fps: (s.frames * 1000) / (now - s.start),
      level,
      distance: camera.position.distanceTo(LOD_CENTER),
      calls: gl.info.render.calls,
      frameTriangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      current: specimen.stats(level),
      levels: Object.fromEntries(LOD_LEVELS.map((id) => [id, specimen.stats(id)])),
    })
    s.frames = 0
    s.start = now
  })

  return (
    <group>
      {settings.showArchitecture ? <Architecture facade={facade} /> : null}
      <primitive object={specimen.object} />
    </group>
  )
}
