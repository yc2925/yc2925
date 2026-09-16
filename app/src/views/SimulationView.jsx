import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { fillHeightmap } from '../noise/sample.js'
import { heightmapKey } from '../noise/settings.js'
import { captureHydraulicState, createHydraulicState } from '../simulation/hydraulic.js'
import { DEFAULT_EROSION } from '../simulation/settings.js'
import HydraulicWorld from '../simulation/HydraulicWorld.jsx'
import SimulationPanel from '../ui/SimulationPanel.jsx'

const SNAPSHOT_INTERVAL = 0.1

function nearestSnapshot(frames, cursor) {
  if (frames.length === 0) return null
  let nearest = frames[0]
  for (const frame of frames) {
    if (Math.abs(frame.time - cursor) < Math.abs(nearest.time - cursor)) nearest = frame
  }
  return nearest
}

const EMPTY_TELEMETRY = {
  totalWater: 0,
  averageWater: 0,
  maxWater: 0,
  rainfallRate: 0,
  evaporationRate: 0,
  outflowRate: 0,
  erodedMaterial: 0,
  depositedMaterial: 0,
  sedimentLoad: 0,
  vegetationCoverage: 0,
  soilMoisture: 0,
  vegetationGrowthRate: 0,
  vegetationDieOffRate: 0,
}

export default function SimulationView({ noise, onNoiseChange }) {
  const [erosion, setErosion] = useState(DEFAULT_EROSION)
  const [resetVersion, setResetVersion] = useState(0)
  const terrainKey = heightmapKey(noise)
  const terrainConfig = useMemo(() => JSON.parse(terrainKey), [terrainKey])
  const state = useMemo(
    () => {
      void resetVersion
      return createHydraulicState(
        fillHeightmap(terrainConfig),
        Math.round(terrainConfig.resolution),
      )
    },
    [resetVersion, terrainConfig],
  )
  const stateRef = useRef(state)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [frameCount, setFrameCount] = useState(0)
  const [reviewing, setReviewing] = useState(false)
  const [reviewSnapshot, setReviewSnapshot] = useState(null)
  const [telemetry, setTelemetry] = useState(EMPTY_TELEMETRY)
  const framesRef = useRef([])
  const startTimeRef = useRef(0)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target
      if (
        event.key.toLowerCase() !== 'w' ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return
      }
      setErosion((current) => ({ ...current, wireframe: !current.wireframe }))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!recording) return undefined

    let animationFrame
    let lastCapture = -SNAPSHOT_INTERVAL

    function record(now) {
      const time = (now - startTimeRef.current) / 1000

      if (time - lastCapture >= SNAPSHOT_INTERVAL) {
        lastCapture = time
        framesRef.current.push(captureHydraulicState(stateRef.current, time))
        setFrameCount(framesRef.current.length)
        setElapsed(time)
        setCursor(time)
      }

      animationFrame = requestAnimationFrame(record)
    }

    animationFrame = requestAnimationFrame(record)
    return () => cancelAnimationFrame(animationFrame)
  }, [recording])

  function startRecording() {
    framesRef.current = [captureHydraulicState(stateRef.current, 0)]
    setFrameCount(1)
    setReviewing(false)
    setReviewSnapshot(null)
    setElapsed(0)
    setCursor(0)
    startTimeRef.current = performance.now()
    setRecording(true)
  }

  function stopRecording() {
    setRecording(false)
  }

  function resetSimulation() {
    setRecording(false)
    framesRef.current = []
    setFrameCount(0)
    setElapsed(0)
    setCursor(0)
    setReviewing(false)
    setReviewSnapshot(null)
    setTelemetry(EMPTY_TELEMETRY)
    setResetVersion((version) => version + 1)
  }

  function updateNoise(nextNoise) {
    if (heightmapKey(nextNoise) !== terrainKey) {
      setRecording(false)
      framesRef.current = []
      setFrameCount(0)
      setElapsed(0)
      setCursor(0)
      setReviewing(false)
      setReviewSnapshot(null)
    }
    onNoiseChange(nextNoise)
  }

  function reviewAt(time) {
    setCursor(time)
    setReviewing(true)
    setReviewSnapshot(nearestSnapshot(framesRef.current, time))
  }

  function returnLive() {
    setReviewing(false)
    setReviewSnapshot(null)
  }

  return (
    <div className="simulation-view">
      <Canvas className="viewport" camera={{ position: [7, 6, 7], fov: 50 }} gl={{ antialias: true }}>
        <color attach="background" args={['#070707']} />
        <ambientLight intensity={0.48} />
        <directionalLight position={[6, 10, 4]} intensity={0.95} color="#e8e8e8" />
        <HydraulicWorld
          state={state}
          amplitude={noise.amplitude}
          settings={erosion}
          reviewSnapshot={reviewSnapshot}
          onTelemetry={setTelemetry}
        />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={28}
        />
      </Canvas>

      <SimulationPanel
        noise={noise}
        onNoiseChange={updateNoise}
        erosion={erosion}
        onErosionChange={setErosion}
        telemetry={telemetry}
        recorder={{
          recording,
          reviewing,
          elapsed,
          duration: elapsed,
          frameCount,
          cursor,
          onCursorChange: reviewAt,
          onLive: returnLive,
          onStart: startRecording,
          onStop: stopRecording,
          onReset: resetSimulation,
        }}
      />
    </div>
  )
}
