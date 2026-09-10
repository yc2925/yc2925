import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { fillHeightmap } from '../noise/sample.js'
import {
  captureHydraulicState,
  createHydraulicState,
  restoreHydraulicState,
  stepHydraulic,
} from '../simulation/hydraulic.js'
import { DEFAULT_EROSION } from '../simulation/settings.js'
import SimulationPanel from '../ui/SimulationPanel.jsx'

const SNAPSHOT_INTERVAL = 0.1

function redGradient(t) {
  const v = Math.min(1, Math.max(0, t))
  if (v < 0.45) {
    const u = v / 0.45
    return [0.08 + u * 0.42, 0.005 + u * 0.025, 0.005]
  }
  const u = (v - 0.45) / 0.55
  return [0.5 + u * 0.5, 0.03 + u * 0.35, 0.005 + u * 0.18]
}

function pseudoRandom(index, salt) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function Rainfall({ active, intensity }) {
  const pointsRef = useRef(null)
  const count = 900
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      values[i * 3] = (pseudoRandom(i, 1) - 0.5) * 10
      values[i * 3 + 1] = 1 + pseudoRandom(i, 2) * 8
      values[i * 3 + 2] = (pseudoRandom(i, 3) - 0.5) * 10
    }
    return values
  }, [])

  useFrame((_, delta) => {
    if (!active || !pointsRef.current) return
    const attribute = pointsRef.current.geometry.attributes.position
    const speed = 5 + intensity * 90
    for (let i = 0; i < attribute.count; i += 1) {
      let y = attribute.getY(i) - delta * speed
      if (y < -0.5) y = 5 + Math.random() * 5
      attribute.setY(i, y)
    }
    attribute.needsUpdate = true
  })

  return (
    <points ref={pointsRef} visible={active}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#168cff"
        size={0.055}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  )
}

function SimulationTerrain({ state, amplitude, settings, reviewSnapshot }) {
  const meshRef = useRef(null)
  const colorsRef = useRef(null)

  useEffect(() => {
    if (reviewSnapshot) restoreHydraulicState(state, reviewSnapshot)
  }, [reviewSnapshot, state])

  useFrame((_, frameDelta) => {
    if (!reviewSnapshot && settings.running) {
      const delta = Math.min(1.5, frameDelta * 60) / settings.iterations
      for (let i = 0; i < settings.iterations; i += 1) {
        stepHydraulic(state, settings, delta)
      }
    }

    const geometry = meshRef.current?.geometry
    if (!geometry) return
    const positions = geometry.attributes.position
    if (!colorsRef.current || colorsRef.current.length !== positions.count * 3) {
      colorsRef.current = new Float32Array(positions.count * 3)
      geometry.setAttribute('color', new THREE.BufferAttribute(colorsRef.current, 3))
    }
    const colors = colorsRef.current
    for (let i = 0; i < positions.count; i += 1) {
      const height = state.terrain[i]
      positions.setZ(i, height * amplitude * 2.4)

      let [r, g, b] = redGradient((height + 1) * 0.5)
      if (settings.showScour) {
        const cut = Math.min(1, state.scour[i] * 2.5)
        r += cut * 0.28
        g += cut * 0.06
      }
      if (settings.showWater) {
        const wet = Math.min(0.72, state.water[i] * 8)
        r = r * (1 - wet) + 0.08 * wet
        g = g * (1 - wet) + 0.38 * wet
        b = b * (1 - wet) + 1 * wet
      }

      colors[i * 3] = Math.min(1, r)
      colors[i * 3 + 1] = Math.min(1, g)
      colors[i * 3 + 2] = Math.min(1, b)
    }

    positions.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
    geometry.computeVertexNormals()
  })

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={meshRef}>
        <planeGeometry args={[10, 10, state.size - 1, state.size - 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.86}
          metalness={0}
          side={THREE.DoubleSide}
          wireframe={settings.wireframe}
        />
      </mesh>
    </group>
  )
}

function nearestSnapshot(frames, cursor) {
  if (frames.length === 0) return null
  let nearest = frames[0]
  for (const frame of frames) {
    if (Math.abs(frame.time - cursor) < Math.abs(nearest.time - cursor)) nearest = frame
  }
  return nearest
}

export default function SimulationView({ noise, onNoiseChange }) {
  const [erosion, setErosion] = useState(DEFAULT_EROSION)
  const [resetVersion, setResetVersion] = useState(0)
  const state = useMemo(
    () => {
      void resetVersion
      return createHydraulicState(fillHeightmap(noise), Math.round(noise.resolution))
    },
    [noise, resetVersion],
  )
  const stateRef = useRef(state)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [frames, setFrames] = useState([])
  const framesRef = useRef([])
  const startTimeRef = useRef(0)
  const liveErosion = useMemo(
    () => ({ ...erosion, rain: recording ? erosion.rain : 0 }),
    [erosion, recording],
  )

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
      setElapsed(time)
      setCursor(time)

      if (time - lastCapture >= SNAPSHOT_INTERVAL) {
        lastCapture = time
        framesRef.current.push(captureHydraulicState(stateRef.current, time))
        setFrames([...framesRef.current])
      }

      animationFrame = requestAnimationFrame(record)
    }

    animationFrame = requestAnimationFrame(record)
    return () => cancelAnimationFrame(animationFrame)
  }, [recording])

  function startRecording() {
    framesRef.current = [captureHydraulicState(stateRef.current, 0)]
    setFrames(framesRef.current)
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
    setFrames([])
    setElapsed(0)
    setCursor(0)
    setResetVersion((version) => version + 1)
  }

  const reviewSnapshot = !recording ? nearestSnapshot(frames, cursor) : null

  return (
    <div className="simulation-view">
      <Canvas className="viewport" camera={{ position: [7, 6, 7], fov: 50 }} gl={{ antialias: true }}>
        <color attach="background" args={['#070707']} />
        <ambientLight intensity={0.48} />
        <directionalLight position={[6, 10, 4]} intensity={0.95} color="#e8e8e8" />
        <SimulationTerrain
          state={state}
          amplitude={noise.amplitude}
          settings={liveErosion}
          reviewSnapshot={reviewSnapshot}
        />
        <Rainfall active={recording} intensity={erosion.rain} />
        <gridHelper args={[12, 12, '#2a2a2a', '#151515']} />
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
        onNoiseChange={onNoiseChange}
        erosion={erosion}
        onErosionChange={setErosion}
        recorder={{
          recording,
          elapsed,
          duration: elapsed,
          frameCount: frames.length,
          cursor,
          onCursorChange: setCursor,
          onStart: startRecording,
          onStop: stopRecording,
          onReset: resetSimulation,
        }}
      />
    </div>
  )
}
