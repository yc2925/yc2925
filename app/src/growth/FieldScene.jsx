import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { fieldArrows } from './field.js'
import { createParticles, seedParticles, stepParticles } from './particles.js'
import { PathTubes } from './PathsScene.jsx'
import { SHAPE, pointGeometry } from './points.js'
import PointMaterial from './PointMaterial.jsx'

const TRAIL_COLOR = new THREE.Color('#d9d4ca')
const PRIMARY = new THREE.Color('#ff2020')
const SECONDARY = new THREE.Color('#b8b8b8')

const trailVertex = /* glsl */ `
  attribute float aFade;
  varying float vFade;
  void main() {
    vFade = aFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const trailFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity * vFade);
  }
`

function useDisposable(geometry) {
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function EmitterLayer({ emitters, visible }) {
  const geometry = useDisposable(
    useMemo(() => {
      const n = emitters.count
      const colors = new Float32Array(n * 3)
      const sizes = new Float32Array(n)
      const shapes = new Float32Array(n)
      for (let k = 0; k < n; k += 1) {
        const primary = emitters.primary[k] === 1
        const color = primary ? PRIMARY : SECONDARY
        colors.set([color.r, color.g, color.b], k * 3)
        sizes[k] = primary ? 11 : 4
        shapes[k] = primary ? SHAPE.TARGET : SHAPE.SQUARE
      }
      return pointGeometry(emitters.positions, colors, sizes, shapes)
    }, [emitters]),
  )
  return (
    <points geometry={geometry} visible={visible} renderOrder={4}>
      <PointMaterial />
    </points>
  )
}

/** One system for every particle: a shared trail buffer drawn as lines, heads drawn as points. */
function Tracers({ cache, emitters, display }) {
  const { particleCount, trailLength, seed, resetKey } = display
  const paramsRef = useRef(null)
  useLayoutEffect(() => {
    paramsRef.current = {
      paused: display.paused,
      speed: display.particleSpeed,
      forces: {
        up: display.upwardForce,
        surface: display.surfaceFollow,
        feature: display.fieldFeature,
        curl: display.curlStrength,
      },
    }
  })

  const lab = useMemo(() => {
    const system = createParticles(particleCount, trailLength, seed + resetKey * 31)
    seedParticles(system, emitters)
    const position = new THREE.BufferAttribute(system.trail, 3).setUsage(THREE.DynamicDrawUsage)

    const fade = new Float32Array(particleCount * trailLength)
    const segments = new Uint32Array(particleCount * (trailLength - 1) * 2)
    const heads = new Uint32Array(particleCount)
    for (let i = 0; i < particleCount; i += 1) {
      const base = i * trailLength
      heads[i] = base
      for (let s = 0; s < trailLength; s += 1) fade[base + s] = (1 - s / (trailLength - 1)) ** 1.4
      for (let s = 0; s < trailLength - 1; s += 1) {
        const o = (i * (trailLength - 1) + s) * 2
        segments[o] = base + s
        segments[o + 1] = base + s + 1
      }
    }
    const trails = new THREE.BufferGeometry()
    trails.setAttribute('position', position)
    trails.setAttribute('aFade', new THREE.BufferAttribute(fade, 1))
    trails.setIndex(new THREE.BufferAttribute(segments, 1))
    const points = new THREE.BufferGeometry()
    points.setAttribute('position', position)
    points.setIndex(new THREE.BufferAttribute(heads, 1))
    return { system, trails, points, position }
  }, [particleCount, trailLength, seed, resetKey, emitters])

  useEffect(
    () => () => {
      lab.trails.dispose()
      lab.points.dispose()
    },
    [lab],
  )

  const trailMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: trailVertex,
        fragmentShader: trailFragment,
        uniforms: { uColor: { value: TRAIL_COLOR }, uOpacity: { value: 0.5 } },
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => trailMaterial.dispose(), [trailMaterial])

  const labRef = useRef(lab)
  useLayoutEffect(() => {
    labRef.current = lab
  }, [lab])

  useFrame((_, delta) => {
    const params = paramsRef.current
    const current = labRef.current
    if (!params || params.paused) return
    stepParticles(current.system, cache, emitters, params, Math.min(delta, 1 / 30))
    current.position.needsUpdate = true
  })

  return (
    <group>
      <lineSegments
        geometry={lab.trails}
        material={trailMaterial}
        visible={display.showTrails}
        frustumCulled={false}
        renderOrder={2}
      />
      <points geometry={lab.points} visible={display.showParticles} frustumCulled={false} renderOrder={3}>
        <pointsMaterial color="#e8e8e8" size={2} sizeAttenuation={false} depthWrite={false} />
      </points>
    </group>
  )
}

function FieldArrows({ cache, display }) {
  const { upwardForce, surfaceFollow, fieldFeature, curlStrength, fieldScale } = display
  const geometry = useDisposable(
    useMemo(() => {
      const { positions, colors } = fieldArrows(cache, {
        up: upwardForce,
        surface: surfaceFollow,
        feature: fieldFeature,
        curl: curlStrength,
      })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      return g
      // fieldScale changes the curl stored in the cache.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cache, upwardForce, surfaceFollow, fieldFeature, curlStrength, fieldScale]),
  )
  return (
    <lineSegments geometry={geometry} visible={display.showVectorField} renderOrder={1}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} />
    </lineSegments>
  )
}

export default function FieldScene({ cache, emitters, paths, display }) {
  return (
    <group>
      <EmitterLayer emitters={emitters} visible={display.showAnchors} />
      {emitters.count ? <Tracers cache={cache} emitters={emitters} display={display} /> : null}
      {display.showVectorField ? <FieldArrows cache={cache} display={display} /> : null}
      {paths ? <PathTubes paths={paths} offset={display.surfaceOffset} visible={display.showSplines} /> : null}
    </group>
  )
}
