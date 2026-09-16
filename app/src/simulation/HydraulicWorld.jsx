import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { readHydrologyTelemetry, stepHydraulic } from './hydraulic.js'
import { readVegetationTelemetry, stepVegetation } from './vegetation.js'

const FIXED_STEP = 1 / 30
const ECOLOGY_STEP = 1 / 8
const MAX_VEGETATION_INSTANCES = 2400
const WATER_COLOR = '#3A3B90'

const WATER_VERTEX = `
  attribute float waterAmount;
  varying float vWater;
  varying vec3 vWorld;
  uniform float uTime;
  uniform vec3 uWaterColor;

  void main() {
    vWater = waterAmount;
    vec3 displaced = position;
    float ripple = sin(position.x * 7.0 + uTime * 0.9)
      * cos(position.y * 6.0 - uTime * 0.7) * 0.008;
    displaced.z += ripple * smoothstep(0.0, 0.08, waterAmount);
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const WATER_FRAGMENT = `
  varying float vWater;
  varying vec3 vWorld;
  uniform float uTime;

  void main() {
    if (vWater < 0.0015) discard;
    float depth = clamp(vWater * 8.0, 0.0, 1.0);
    float shimmer = 0.5 + 0.5 * sin(vWorld.x * 3.0 + vWorld.z * 2.0 + uTime);
    vec3 deep = uWaterColor * 0.28;
    vec3 shallow = mix(uWaterColor, vec3(1.0), 0.22);
    vec3 color = mix(shallow, deep, depth) + shimmer * 0.025;
    gl_FragColor = vec4(color, mix(0.34, 0.72, depth));
  }
`

const OCEAN_VERTEX = `
  varying float vWave;
  uniform float uTime;
  uniform float uWaveHeight;
  uniform float uWaveScale;
  uniform float uWaveSpeed;

  void main() {
    vec3 displaced = position;
    float phase = uTime * uWaveSpeed;
    float waveA = sin((position.x * 0.72 + position.y * 0.38) * uWaveScale + phase);
    float waveB = sin((position.x * -0.31 + position.y * 0.81) * uWaveScale * 1.7 - phase * 0.73);
    vWave = waveA * 0.65 + waveB * 0.35;
    displaced.z += vWave * uWaveHeight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`

const OCEAN_FRAGMENT = `
  varying float vWave;
  uniform vec3 uWaterColor;

  void main() {
    vec3 deep = uWaterColor * 0.22;
    vec3 crest = mix(uWaterColor, vec3(1.0), 0.16);
    vec3 color = mix(deep, crest, clamp(vWave * 0.22 + 0.3, 0.0, 1.0));
    gl_FragColor = vec4(color, 0.94);
  }
`

function terrainRed(value) {
  const v = Math.min(1, Math.max(0, value))
  if (v < 0.48) {
    const t = v / 0.48
    return [0.055 + t * 0.16, 0.012 + t * 0.012, 0.012 + t * 0.012]
  }
  const t = (v - 0.48) / 0.52
  return [0.215 + t * 0.46, 0.024 + t * 0.08, 0.024 + t * 0.07]
}

function pseudoRandom(index, salt) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function RainField({ state, settings, reviewing }) {
  const pointsRef = useRef(null)
  const count = 850
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
    if (!pointsRef.current || reviewing) return
    const attribute = pointsRef.current.geometry.attributes.position
    const last = Math.max(1, state.size - 1)

    for (let i = 0; i < attribute.count; i += 1) {
      const x = attribute.getX(i)
      const z = attribute.getZ(i)
      const gx = Math.min(state.size - 1, Math.max(0, Math.round(((x / 10) + 0.5) * last)))
      const gy = Math.min(state.size - 1, Math.max(0, Math.round(((z / 10) + 0.5) * last)))
      const rain = state.precipitation[gy * state.size + gx]
      const threshold = 0.25 + pseudoRandom(i, 7) * 1.25
      let y = attribute.getY(i)

      if (rain < threshold || !settings.running || settings.rain <= 0) {
        y = -100
      } else {
        if (y < -1) y = 5 + pseudoRandom(i + Math.floor(state.time), 9) * 5
        y -= delta * (4.5 + settings.rain * 80)
      }
      attribute.setY(i, y)
    }
    attribute.needsUpdate = true
  })

  return (
    <points ref={pointsRef} visible={settings.showRain}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={WATER_COLOR}
        size={0.04}
        sizeAttenuation
        transparent
        opacity={0.72}
        depthWrite={false}
      />
    </points>
  )
}

function VegetationInstances({ state, amplitude, settings, reviewSnapshot }) {
  const meshRef = useRef(null)
  const object = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const lastVersionRef = useRef(-1)
  const lastSnapshotRef = useRef(null)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    if (!settings.showVegetation) {
      mesh.count = 0
      lastVersionRef.current = -1
      return
    }
    if (
      !reviewSnapshot &&
      lastVersionRef.current === state.ecologyVersion &&
      lastSnapshotRef.current === null
    ) {
      return
    }
    if (reviewSnapshot && lastSnapshotRef.current === reviewSnapshot) return

    const visual =
      reviewSnapshot?.size === state.size && reviewSnapshot ? reviewSnapshot : state
    let instance = 0
    const last = Math.max(1, visual.size - 1)

    for (let i = 0; i < visual.vegetation.length; i += 1) {
      const density = visual.vegetation[i]
      const type = visual.vegetationType[i]
      if (
        instance >= MAX_VEGETATION_INSTANCES ||
        density < 0.1 ||
        type === 0 ||
        visual.terrain[i] <= settings.oceanLevel ||
        pseudoRandom(i, 17) > density * 0.56
      ) {
        continue
      }

      const x = i % visual.size
      const y = Math.floor(i / visual.size)
      const variation = 0.76 + pseudoRandom(i, 19) * 0.48
      const typeHeight = type === 3 ? 1.65 : type === 2 ? 0.72 : 0.2
      const typeWidth = type === 3 ? 0.72 : type === 2 ? 1.15 : 1.5
      const height = typeHeight * (0.55 + density * 0.75) * variation

      object.position.set(
        (x / last) * 10 - 5,
        visual.terrain[i] * amplitude * 2.4 + height * 0.16,
        (y / last) * 10 - 5,
      )
      object.rotation.set(0, pseudoRandom(i, 23) * Math.PI, 0)
      object.scale.set(typeWidth * variation, height, typeWidth * variation)
      object.updateMatrix()
      mesh.setMatrixAt(instance, object.matrix)

      if (type === 3) color.setRGB(0.035, 0.085, 0.045)
      else if (type === 2) color.setRGB(0.075, 0.12, 0.065)
      else color.setRGB(0.1, 0.12, 0.075)
      mesh.setColorAt(instance, color)
      instance += 1
    }

    mesh.count = instance
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    lastVersionRef.current = state.ecologyVersion
    lastSnapshotRef.current = reviewSnapshot
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, MAX_VEGETATION_INSTANCES]}>
      <boxGeometry args={[0.07, 0.32, 0.07]} />
      <meshStandardMaterial roughness={1} metalness={0} />
    </instancedMesh>
  )
}

function Ocean({ amplitude, settings }) {
  const materialRef = useRef(null)

  useFrame(({ clock }) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value = clock.elapsedTime
    materialRef.current.uniforms.uWaveHeight.value = settings.waveHeight
    materialRef.current.uniforms.uWaveScale.value = settings.waveScale
    materialRef.current.uniforms.uWaveSpeed.value = settings.waveSpeed
  })

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, settings.oceanLevel * amplitude * 2.4, 0]}
    >
      <planeGeometry args={[80, 80, 96, 96]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={OCEAN_VERTEX}
        fragmentShader={OCEAN_FRAGMENT}
        transparent
        depthWrite
        side={THREE.DoubleSide}
        uniforms={{
          uTime: { value: 0 },
          uWaveHeight: { value: settings.waveHeight },
          uWaveScale: { value: settings.waveScale },
          uWaveSpeed: { value: settings.waveSpeed },
          uWaterColor: { value: new THREE.Color(WATER_COLOR) },
        }}
      />
    </mesh>
  )
}

export default function HydraulicWorld({
  state,
  amplitude,
  settings,
  reviewSnapshot,
  onTelemetry,
}) {
  const terrainRef = useRef(null)
  const waterRef = useRef(null)
  const waterMaterialRef = useRef(null)
  const terrainColorsRef = useRef(null)
  const waterAmountsRef = useRef(null)
  const accumulatorRef = useRef(0)
  const ecologyAccumulatorRef = useRef(0)
  const frameRef = useRef(0)
  const telemetryRef = useRef(0)

  useEffect(() => {
    terrainColorsRef.current = null
    waterAmountsRef.current = null
    accumulatorRef.current = 0
    ecologyAccumulatorRef.current = 0
  }, [state])

  useFrame(({ clock }, frameDelta) => {
    if (settings.running) {
      accumulatorRef.current += Math.min(frameDelta, 0.1) * settings.simulationSpeed
      let steps = 0
      while (accumulatorRef.current >= FIXED_STEP && steps < settings.iterations) {
        stepHydraulic(state, settings, FIXED_STEP)
        ecologyAccumulatorRef.current += FIXED_STEP
        if (ecologyAccumulatorRef.current >= ECOLOGY_STEP) {
          stepVegetation(state, settings, ECOLOGY_STEP)
          ecologyAccumulatorRef.current -= ECOLOGY_STEP
        }
        accumulatorRef.current -= FIXED_STEP
        steps += 1
      }
      if (steps === settings.iterations) {
        accumulatorRef.current = Math.min(accumulatorRef.current, FIXED_STEP)
      }
    }

    const visual =
      reviewSnapshot?.size === state.size && reviewSnapshot ? reviewSnapshot : state
    const terrainGeometry = terrainRef.current?.geometry
    const waterGeometry = waterRef.current?.geometry
    if (!terrainGeometry || !waterGeometry) return

    const terrainPositions = terrainGeometry.attributes.position
    const waterPositions = waterGeometry.attributes.position

    if (
      !terrainColorsRef.current ||
      terrainColorsRef.current.length !== terrainPositions.count * 3
    ) {
      terrainColorsRef.current = new Float32Array(terrainPositions.count * 3)
      terrainGeometry.setAttribute(
        'color',
        new THREE.BufferAttribute(terrainColorsRef.current, 3),
      )
    }
    if (
      !waterAmountsRef.current ||
      waterAmountsRef.current.length !== waterPositions.count
    ) {
      waterAmountsRef.current = new Float32Array(waterPositions.count)
      waterGeometry.setAttribute(
        'waterAmount',
        new THREE.BufferAttribute(waterAmountsRef.current, 1),
      )
    }

    const terrainColors = terrainColorsRef.current
    const waterAmounts = waterAmountsRef.current
    for (let i = 0; i < terrainPositions.count; i += 1) {
      const height = visual.terrain[i]
      const water = visual.water[i]
      terrainPositions.setZ(i, height * amplitude * 2.4)
      waterPositions.setZ(i, (height + water * 0.62) * amplitude * 2.4 + 0.012)
      waterAmounts[i] = water

      let [r, g, b] = terrainRed((height + 1) * 0.5)
      if (settings.showErosion) {
        const erosion = Math.min(1, visual.scour[i] * 2.2)
        const deposit = Math.min(1, visual.deposition[i] * 2)
        r += erosion * 0.28 + deposit * 0.08
        g += deposit * 0.055
        b += deposit * 0.03
      }
      if (settings.showVegetation) {
        const density = visual.vegetation[i]
        const type = visual.vegetationType[i]
        const vegetationColor =
          type === 3
            ? [0.025, 0.075, 0.04]
            : type === 2
              ? [0.06, 0.105, 0.055]
              : [0.085, 0.105, 0.065]
        const coverage = density * 0.72
        r = r * (1 - coverage) + vegetationColor[0] * coverage
        g = g * (1 - coverage) + vegetationColor[1] * coverage
        b = b * (1 - coverage) + vegetationColor[2] * coverage
      }
      if (settings.showSoilMoisture) {
        const moisture = visual.soilMoisture[i] * 0.48
        r = r * (1 - moisture) + 0.227 * moisture
        g = g * (1 - moisture) + 0.231 * moisture
        b = b * (1 - moisture) + 0.565 * moisture
      }
      terrainColors[i * 3] = Math.min(1, r)
      terrainColors[i * 3 + 1] = Math.min(1, g)
      terrainColors[i * 3 + 2] = Math.min(1, b)
    }

    terrainPositions.needsUpdate = true
    terrainGeometry.attributes.color.needsUpdate = true
    waterPositions.needsUpdate = true
    waterGeometry.attributes.waterAmount.needsUpdate = true
    frameRef.current += 1
    if (frameRef.current % 4 === 0) terrainGeometry.computeVertexNormals()
    if (waterMaterialRef.current) {
      waterMaterialRef.current.uniforms.uTime.value = clock.elapsedTime
    }

    if (clock.elapsedTime - telemetryRef.current >= 0.25) {
      telemetryRef.current = clock.elapsedTime
      onTelemetry({
        ...readHydrologyTelemetry(state),
        ...readVegetationTelemetry(state, settings.oceanLevel),
      })
    }
  })

  return (
    <>
      <Ocean amplitude={amplitude} settings={settings} />
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh ref={terrainRef} visible={settings.showTerrain}>
          <planeGeometry args={[10, 10, state.size - 1, state.size - 1]} />
          <meshStandardMaterial
            vertexColors
            roughness={0.91}
            metalness={0}
            side={THREE.DoubleSide}
            wireframe={settings.wireframe}
          />
        </mesh>
        <mesh ref={waterRef} visible={settings.showWater} renderOrder={2}>
          <planeGeometry args={[10, 10, state.size - 1, state.size - 1]} />
          <shaderMaterial
            ref={waterMaterialRef}
            vertexShader={WATER_VERTEX}
            fragmentShader={WATER_FRAGMENT}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            uniforms={{
              uTime: { value: 0 },
              uWaterColor: { value: new THREE.Color(WATER_COLOR) },
            }}
          />
        </mesh>
      </group>
      <VegetationInstances
        state={state}
        amplitude={amplitude}
        settings={settings}
        reviewSnapshot={reviewSnapshot}
      />
      <RainField state={state} settings={settings} reviewing={Boolean(reviewSnapshot)} />
    </>
  )
}
