/**
 * World stage scan look (REF-031): point clouds + survey overlay.
 *
 * Layers: solid stones / ground live on layer 1 (seen only by the station
 * cameras, so each station "photographs" the solid model); points on layer 2
 * and the overlay on layer 3 (seen only by the main camera).
 */

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'

export const LAYER_SOLID = 1
export const LAYER_POINTS = 2
export const LAYER_OVERLAY = 3

const noRaycast = () => null

const pointVertex = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec3 color;
  uniform float uSize;   // world size of a point (m)
  uniform float uPx;     // pixels per metre at distance 1
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(uSize * uPx / max(0.1, -mvPosition.z), 1.0, 3.5);
    #include <fog_vertex>
  }
`
const pointFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  varying vec3 vColor;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    if (dot(d, d) > 0.25) discard;
    gl_FragColor = vec4(vColor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

function createPointMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uSize: { value: 0.1 }, uPx: { value: 1000 } },
  })
}

/** One point cloud (positions + linear colours). worldSize = point diameter in metres. */
export function ScanPoints({ data, worldSize }) {
  const { size, camera, gl } = useThree()
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.position, 3))
    g.setAttribute('color', new THREE.BufferAttribute(data.color, 3))
    g.computeBoundingSphere()
    return g
  }, [data])
  const material = useMemo(() => createPointMaterial(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    material.uniforms.uSize.value = worldSize
    material.uniforms.uPx.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
  }, [material, worldSize, size.height, gl, camera.fov])
  if (!data.count) return null
  return <points geometry={geometry} material={material} layers={LAYER_POINTS} raycast={noRaycast} />
}

/** Main camera sees points + overlay; event raycasts hit the (hidden) solid stones. */
export function ScanLayerSetup() {
  const { camera, raycaster } = useThree()
  useEffect(() => {
    camera.layers.enable(LAYER_POINTS)
    camera.layers.enable(LAYER_OVERLAY)
    raycaster.layers.enable(LAYER_SOLID)
  }, [camera, raycaster])
  return null
}

// ------------------------------------------------------------------ survey overlay

const PHOTO_W = 320
const PHOTO_H = 240
const SKY = new THREE.Color('#a9aeb1')

/**
 * Survey stations: a photograph of the solid model rendered from each
 * station camera, shown as a fixed-size sprite with a frame, dot and
 * measured metadata; traverse + sight lines. Photographs are re-rendered only
 * when the stations or the built world change (`contentKey`), one per frame.
 */
export function SurveyOverlay({ stations, thumbSize, contentKey }) {
  const { gl, scene, size, camera } = useThree()
  const targets = useMemo(
    () =>
      stations.map(() => {
        const rt = new THREE.WebGLRenderTarget(PHOTO_W, PHOTO_H, { type: THREE.HalfFloatType })
        return rt
      }),
    [stations],
  )
  useEffect(() => () => targets.forEach((t) => t.dispose()), [targets])
  const cameras = useMemo(
    () =>
      stations.map((st) => {
        const c = new THREE.PerspectiveCamera(48, PHOTO_W / PHOTO_H, 0.3, 3000)
        c.position.set(...st.pos)
        c.lookAt(...st.target)
        c.layers.set(0)
        c.layers.enable(LAYER_SOLID)
        return c
      }),
    [stations],
  )
  const fog = useMemo(() => new THREE.FogExp2(SKY.getHex(), 0.0022), [])
  const pending = useRef([])
  useEffect(() => {
    pending.current = cameras.map((_, i) => i)
  }, [cameras, contentKey])
  useFrame(() => {
    if (!pending.current.length) return
    const i = pending.current.shift()
    const bg = scene.background
    const f = scene.fog
    scene.background = SKY
    scene.fog = fog
    const prev = gl.getRenderTarget()
    gl.setRenderTarget(targets[i])
    gl.render(scene, cameras[i])
    gl.setRenderTarget(prev)
    scene.background = bg
    scene.fog = f
  })

  const lines = useMemo(() => {
    const pos = []
    for (let i = 0; i < stations.length; i += 1) {
      const s = stations[i]
      if (i > 0) pos.push(...stations[i - 1].pos, ...s.pos)
      pos.push(...s.pos, ...s.target)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [stations])
  useEffect(() => () => lines.dispose(), [lines])

  // Sprite height for a constant on-screen size (sizeAttenuation off).
  const proj11 = 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const sh = (2 * thumbSize) / (proj11 * size.height)
  const tw = thumbSize * (PHOTO_W / PHOTO_H)

  return (
    <group>
      <lineSegments geometry={lines} layers={LAYER_OVERLAY} renderOrder={20} raycast={noRaycast}>
        <lineBasicMaterial color="#f4f4f4" transparent opacity={0.75} depthTest={false} fog={false} />
      </lineSegments>
      {stations.map((st, i) => (
        <group key={st.id}>
          <sprite position={st.pos} scale={[sh * (PHOTO_W / PHOTO_H), sh, 1]} layers={LAYER_OVERLAY} renderOrder={21} raycast={noRaycast}>
            <spriteMaterial map={targets[i].texture} sizeAttenuation={false} depthTest={false} fog={false} />
          </sprite>
          <Html position={st.pos} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div className="scan-tag" style={{ '--w': `${tw}px`, '--h': `${thumbSize}px` }}>
              <div className="scan-frame" />
              <div className="scan-frame scan-frame-b" />
              <div className="scan-dot" />
              <div className="scan-label">
                Stn: {st.code}&nbsp;&nbsp;Target: {st.kind}{st.curve ? ` · ${st.curve}` : ''}{st.color ? ` · ${st.color}` : ''}
                <br />
                Camera: X {st.pos[0].toFixed(2)}&nbsp;&nbsp;Y {st.pos[1].toFixed(2)}&nbsp;&nbsp;Z {st.pos[2].toFixed(2)} m&nbsp;&nbsp;Range: {st.range.toFixed(2)} m
              </div>
            </div>
          </Html>
          <Html position={st.target} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div className="scan-target" />
          </Html>
        </group>
      ))}
    </group>
  )
}
