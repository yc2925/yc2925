/**
 * Main 3D world viewport (Step 47, feedback round 1).
 *
 * Stages:
 *  - Curves: source curves + skeleton centre lines.
 *  - Gothic Skeleton: member tubes in the X-ray scrim language (REF-026).
 *  - Lithic Formation: dry-stone masonry, solid weathered stone (REF-030).
 *  - World: stones + procedural terrain, brighter exposure.
 * X-ray toggle: everything as additive wire-mesh scrim on pure black,
 * stones outlined facet by facet; X-ray exposure scales the additive glow
 * from minimal light to blown-out.
 * Point Cloud stage (REF-031): stones and ground as a photogrammetry point
 * cloud on black; survey stations photograph the (hidden) solid model.
 * Clouds are built off the render path (deferred, debounced) within a
 * world-wide point budget, so slider drags never block or exhaust memory.
 * Explode separates fragments in every stage.
 * Own camera: edits never move it; "Fit selected" is explicit.
 */

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { buildMemberGeometry, computePieceOffsets, createStonePrototypes } from './geometry.js'
import { createScrimMaterial } from './scrimMaterial.js'
import { createTerrainHeight } from './terrain.js'
import { createStoneMaterial } from './stoneMaterial.js'
import { baseProximity, buildGroundPoints, buildStonePoints, stationKey, stoneSurfaceArea, surveyStations, WORLD_STONE_POINTS } from './scanCloud.js'
import { LAYER_SOLID, ScanLayerSetup, ScanPoints, SurveyOverlay } from './ScanLayer.jsx'

const SIGNAL = '#ff2020'

// Stone prototypes (dressed + carved), cached per irregularity × dressing (rounded to 0.05).
const protoCache = new Map()
function prototypesFor(irregularity, dressing = 0.75) {
  const a = Math.round(irregularity * 20) / 20
  const b = Math.round(dressing * 20) / 20
  const key = `${a}|${b}`
  let p = protoCache.get(key)
  if (!p) {
    p = createStonePrototypes(a, b)
    protoCache.set(key, p)
  }
  return p
}

function structureCenter(skeleton) {
  const b = skeleton.bounds
  if (!b) return { x: 0, y: 0, z: 0 }
  return { x: (b.min.x + b.max.x) / 2, y: b.min.y, z: (b.min.z + b.max.z) / 2 }
}

// --------------------------------------------------------------- skeleton

function CenterLines({ skeleton, selected }) {
  const geometry = useMemo(() => {
    const pos = []
    for (const m of skeleton.members)
      for (let i = 1; i < m.points.length; i += 1) {
        const a = m.points[i - 1]
        const b = m.points[i]
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [skeleton])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={selected ? '#ffb3b3' : '#d9dee2'} transparent opacity={0.85} />
    </lineSegments>
  )
}

function MemberTubes({ skeleton, offsets, scrim, solid }) {
  const geometry = useMemo(() => buildMemberGeometry(skeleton, (piece) => offsets.get(piece)), [skeleton, offsets])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return (
    <mesh geometry={geometry} material={scrim ?? undefined} castShadow={!scrim}>
      {!scrim ? <meshStandardMaterial color={solid ?? '#bdb6aa'} roughness={0.9} /> : null}
    </mesh>
  )
}

// --------------------------------------------------------------- stones

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpP = new THREE.Vector3()
const tmpS = new THREE.Vector3()
const tmpC = new THREE.Color()

function StoneBatch({ geometry, stones, offsets, material, selected, layers = 0 }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    stones.forEach((st, i) => {
      const off = offsets.get(st.piece)
      tmpP.set(st.p[0] + (off?.x ?? 0), st.p[1] + (off?.y ?? 0), st.p[2] + (off?.z ?? 0))
      tmpQ.set(st.q[0], st.q[1], st.q[2], st.q[3])
      tmpS.set(st.s[0], st.s[1], st.s[2])
      tmpM.compose(tmpP, tmpQ, tmpS)
      mesh.setMatrixAt(i, tmpM)
      tmpC.setRGB(st.color[0], st.color[1], st.color[2], THREE.SRGBColorSpace)
      if (selected) tmpC.lerp(new THREE.Color('#ff6a5a'), 0.12)
      mesh.setColorAt(i, tmpC)
    })
    mesh.count = stones.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [stones, offsets, selected])
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, stones.length)]} castShadow receiveShadow frustumCulled={false} layers={layers} />
}

function Stones({ lithic, prototypes, offsets, scrim, solidMaterial, selected, layers = 0 }) {
  const byProto = useMemo(() => {
    const groups = prototypes.map(() => [])
    for (const st of lithic.stones) groups[st.proto % prototypes.length].push(st)
    return groups
  }, [lithic, prototypes])
  return byProto.map((stones, k) =>
    stones.length ? (
      <StoneBatch
        key={`${k}-${stones.length}-${scrim ? 'x' : 's'}-${layers}`}
        layers={layers}
        geometry={prototypes[k]}
        stones={stones}
        offsets={offsets}
        material={scrim ?? solidMaterial}
        selected={selected}
      />
    ) : null,
  )
}

// --------------------------------------------------------------- terrain

// Terrain extends to TERRAIN_HALF and dissolves radially into the background
// from FADE_START to FADE_END, so no square edge is ever visible.
const TERRAIN_HALF = 1600
const FADE_START = 520
const FADE_END = 1500

/** Solid ground that blends into the background colour with distance (after tone mapping). */
function useFadingGroundMaterial(bg) {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#26282b', roughness: 1 })
    m.userData.bg = { value: new THREE.Color() }
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uBg = m.userData.bg
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;\nuniform vec3 uBg;')
        .replace(
          '#include <colorspace_fragment>',
          `#include <colorspace_fragment>
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uBg, smoothstep(${FADE_START.toFixed(1)}, ${FADE_END.toFixed(1)}, length(vGroundXZ)));`,
        )
    }
    m.customProgramCacheKey = () => 'yc2925-ground-fade-v1'
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    // Raw sRGB values (no linear conversion): the mix happens after colorspace_fragment.
    material.userData.bg.value.setStyle(bg, THREE.LinearSRGBColorSpace)
  }, [material, bg])
  useEffect(() => () => material.dispose(), [material])
  return material
}

function Terrain({ params, scrim, xray, bg, scan }) {
  const geometry = useMemo(() => {
    const size = TERRAIN_HALF * 2
    const seg = 256
    const g = new THREE.PlaneGeometry(size, size, seg, seg)
    g.rotateX(-Math.PI / 2)
    const height = createTerrainHeight(params)
    const pos = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, height(x, z) - 0.03)
      uv.setXY(i, x, z) // metres → mesh line spacing
    }
    g.computeVertexNormals()
    return g
  }, [params])
  useEffect(() => () => geometry.dispose(), [geometry])
  const ground = useFadingGroundMaterial(bg)
  // Scan look: the solid ground is only photographed by the survey stations.
  if (scan) return <mesh geometry={geometry} material={ground} receiveShadow layers={LAYER_SOLID} />
  return (
    <group>
      <mesh geometry={geometry} material={ground} receiveShadow renderOrder={-2} visible={!xray} />
      <mesh geometry={geometry} material={scrim} renderOrder={-1} />
    </group>
  )
}


// --------------------------------------------------------------- camera + exposure

function Exposure({ value }) {
  const { gl } = useThree()
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = value
  }, [gl, value])
  return null
}

const CameraRig = forwardRef(function CameraRig(_, ref) {
  const { camera, controls } = useThree()
  useImperativeHandle(ref, () => ({
    fit(bounds) {
      if (!bounds || !controls) return
      const c = new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, (bounds.min.z + bounds.max.z) / 2)
      const radius = Math.max(5, Math.hypot(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z) / 2)
      const dir = camera.position.clone().sub(controls.target).normalize()
      const distance = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.05
      controls.target.copy(c)
      camera.position.copy(c.clone().add(dir.multiplyScalar(distance)))
      controls.update()
    },
  }))
  return null
})


// --------------------------------------------------------------- deferred builds

/**
 * Run an expensive build after the deps settle (debounced), outside render;
 * keeps showing the previous result meanwhile. Disabled → released at once.
 */
function useDeferredBuild(enabled, build, deps, delay = 90) {
  const [value, setValue] = useState(null)
  useEffect(() => {
    if (!enabled) {
      setValue(null)
      return undefined
    }
    const id = setTimeout(() => setValue(build()), delay)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])
  return enabled ? value : null
}

// --------------------------------------------------------------- structure

function Structure({ s, stage, xray, explode, prototypesFor, materials, selected, onSelect, scan, order = 0 }) {
  const center = useMemo(() => structureCenter(s.skeleton), [s.skeleton])
  const memberOffsets = useMemo(
    () =>
      computePieceOffsets(
        s.skeleton.members.flatMap((m) => m.points.map((p) => ({ piece: m.piece, p }))),
        center,
        explode,
      ),
    [s.skeleton, center, explode],
  )
  const stoneOffsets = useMemo(
    () => computePieceOffsets(s.lithic.stones.map((st) => ({ piece: st.piece, p: { x: st.p[0], y: st.p[1], z: st.p[2] } })), center, explode),
    [s.lithic, center, explode],
  )
  const prototypes = prototypesFor(s.params.lithic.irregularity, s.params.lithic.dressing)
  const showStones = stage === 'lithic' || stage === 'world'
  const scrimMode = xray || stage === 'skeleton'
  // Survey paint only from stations whose target lies on this structure.
  const b = s.skeleton.bounds
  const markers = scan && b ? scan.markers.filter((m) => m.c[0] >= b.min.x - 4 && m.c[0] <= b.max.x + 4 && m.c[2] >= b.min.z - 4 && m.c[2] <= b.max.z + 4 && m.c[1] <= b.max.y + 4) : []
  const markersKey = markers.map((m) => m.c.map((v) => v.toFixed(2)).join(',') + m.r.toFixed(2)).join(';')
  const optsKey = scan ? [scan.density, scan.fidelity, scan.noise, scan.coverage, scan.yTop.toFixed(1)].join('|') : ''
  const cloud = useDeferredBuild(
    !!scan,
    () => buildStonePoints(s.lithic.stones, prototypes, stoneOffsets, { ...scan, markers }),
    [s.lithic, prototypes, stoneOffsets, optsKey, markersKey],
    90 + order * 40,
  )
  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        onSelect(s.curveId)
      }}
    >
      {s.skeleton.sourcePolyline.length >= 2 && (!scan || selected) ? (
        <Line points={s.skeleton.sourcePolyline.map((p) => [p.x, p.y + 0.05, p.z])} color={selected ? SIGNAL : '#9a9a9a'} lineWidth={selected ? 2 : 1.25} transparent opacity={stage === 'curves' ? 1 : selected ? 0.8 : 0.3} />
      ) : null}
      {stage === 'curves' ? <CenterLines skeleton={s.skeleton} selected={selected} /> : null}
      {stage === 'skeleton' || (scrimMode && showStones) ? (
        <MemberTubes skeleton={s.skeleton} offsets={memberOffsets} scrim={materials.tubeScrim} />
      ) : null}
      {showStones ? (
        <Stones lithic={s.lithic} prototypes={prototypes} offsets={stoneOffsets} scrim={scrimMode ? materials.stoneScrim : null} solidMaterial={materials.stoneSolid} selected={selected && !scan} layers={scan ? LAYER_SOLID : 0} />
      ) : null}
      {cloud && scan ? <ScanPoints data={cloud} worldSize={(scan.pointSize * 1.1) / Math.sqrt(scan.density)} /> : null}
    </group>
  )
}

const WorldViewport = forwardRef(function WorldViewport({ structures, stage, xray, presentation, terrain, selectedCurveId, onSelect }, ref) {
  const rig = useRef(null)
  useImperativeHandle(ref, () => ({ fit: (b) => rig.current?.fit(b) }))
  const pointCloud = stage === 'pointcloud'
  const scrimMode = xray || stage === 'skeleton'
  const world = stage === 'world' || pointCloud

  const materials = useMemo(
    () => ({
      tubeScrim: createScrimMaterial({ mode: 'uv', density: [1.6, 2.4], opacity: 0.5, edge: 2.2, line: 0.5 }),
      stoneScrim: createScrimMaterial({ mode: 'bary', opacity: 0.07, edge: 1.1, line: 0.22 }),
      terrainScrim: createScrimMaterial({ mode: 'uv', density: [0.1, 0.1], opacity: 0.0, edge: 0.4, line: 0.22, color: '#c9ced2', fade: [FADE_START, FADE_END] }),
      stoneSolid: createStoneMaterial(),
    }),
    [],
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])
  // X-ray exposure: one gain for every scrim (wire-mesh) material.
  useEffect(() => {
    for (const m of Object.values(materials)) if (m.uniforms?.uGain) m.uniforms.uGain.value = presentation.xrayExposure ?? 1
  }, [materials, presentation.xrayExposure])


  const scanLook = pointCloud && !scrimMode
  const bg = scrimMode || scanLook ? '#000000' : world ? '#2a2c30' : '#1a1b1d'

  // ---- scan look (REF-031)
  const visible = useMemo(() => structures.filter((s) => s.curve.visibility && s.skeleton.bounds), [structures])
  const sceneBounds = useMemo(() => {
    if (!visible.length) return null
    const b = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } }
    for (const s of visible)
      for (const k of ['x', 'y', 'z']) {
        b.min[k] = Math.min(b.min[k], s.skeleton.bounds.min[k])
        b.max[k] = Math.max(b.max[k], s.skeleton.bounds.max[k])
      }
    return b
  }, [visible])
  const P = presentation
  // Stations move only when the scene bounds, stone count, count or seed change.
  const stoneCount = visible.reduce((n, s) => n + s.lithic.stones.length, 0)
  const sKey = scanLook ? stationKey(sceneBounds, P.stations ?? 0, P.surveySeed ?? 1, stoneCount) : 'off'
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const stations = useMemo(
    () =>
      scanLook
        ? surveyStations({
            bounds: sceneBounds,
            count: P.stations ?? 0,
            seed: P.surveySeed ?? 1,
            stones: visibleRef.current.flatMap((s) => s.lithic.stones.map((st) => ({ p: st.p, kind: st.kind, paletteIndex: st.paletteIndex, curve: s.curve.name }))),
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sKey],
  )
  // World-wide point budget: density drops (quantised, so edits rarely rebuild everything) when the total surface is large.
  const density = useMemo(() => {
    const want = P.pointDensity ?? 45
    if (!scanLook) return want
    const area = visible.reduce((a, s) => a + stoneSurfaceArea(s.lithic.stones, prototypesFor(s.params.lithic.irregularity, s.params.lithic.dressing)), 0)
    const cap = WORLD_STONE_POINTS / Math.max(1, area)
    if (cap >= want) return want
    const q = Math.pow(10, Math.floor(Math.log10(cap)) - 1)
    return Math.max(0.5, Math.floor(cap / q) * q)
  }, [scanLook, visible, P.pointDensity])
  const scanOpts = useMemo(
    () =>
      scanLook
        ? {
            density,
            pointSize: P.pointSize ?? 1,
            fidelity: P.colorFidelity ?? 0.3,
            noise: P.scanNoise ?? 0.35,
            coverage: P.coverage ?? 0.45,
            yTop: sceneBounds?.max.y ?? 30,
            markers: (P.markers ?? 0) > 0 ? stations.map((st) => ({ c: st.target, r: 0.5 + 1.8 * P.markers, k: P.markers })) : [],
          }
        : null,
    [scanLook, density, P.pointSize, P.colorFidelity, P.scanNoise, P.coverage, P.markers, sceneBounds, stations],
  )
  const groundCloud = useDeferredBuild(scanLook, () => {
    const centre = sceneBounds ? { x: (sceneBounds.min.x + sceneBounds.max.x) / 2, z: (sceneBounds.min.z + sceneBounds.max.z) / 2 } : { x: 0, z: 0 }
    return buildGroundPoints({
      height: createTerrainHeight(terrain),
      centre,
      radius: P.scanRadius ?? 60,
      density: P.groundDensity ?? 10,
      lichen: P.lichen ?? 0,
      fidelity: P.colorFidelity ?? 0.3,
      noise: P.scanNoise ?? 0.35,
      near: baseProximity(visible.map((s) => s.lithic.stones)),
      seed: terrain.seed,
    })
  }, [sKey, terrain, P.scanRadius, P.groundDensity, P.lichen, P.colorFidelity, P.scanNoise], 60)

  return (
    <Canvas className="world-viewport-canvas" shadows camera={{ position: [70, 55, 95], fov: 42, near: 0.5, far: 5000 }} onPointerMissed={() => onSelect(null)} gl={{ antialias: true }}>
      <Exposure value={presentation.exposure} />
      <color attach="background" args={[bg]} />
      {/* Exponential depth fog (World view, normal + X-ray); density² so the slider feels even. */}
      {world && presentation.fog > 0 ? <fogExp2 key={bg} attach="fog" args={[bg, 0.0004 + 0.02 * presentation.fog * presentation.fog]} /> : null}
      <hemisphereLight args={['#f1ece4', '#3e3a35', 0.95]} />
      <ambientLight intensity={0.22} />
      <directionalLight
        position={[90, 160, 70]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
        shadow-camera-far={600}
        shadow-bias={-0.0004}
      />
      {/* Fill from below (REF-026 lighting from above and below). */}
      <directionalLight position={[-60, -40, -50]} intensity={0.55} color="#cfd6dc" />
      <OrbitControls makeDefault enableDamping={false} />
      <CameraRig ref={rig} />
      <ScanLayerSetup />

      {world || scrimMode ? <Terrain params={terrain} scrim={materials.terrainScrim} xray={scrimMode} bg={bg} scan={scanLook} /> : null}
      {groundCloud ? <ScanPoints data={groundCloud} worldSize={(P.pointSize ?? 1) * 0.7 / Math.sqrt(P.groundDensity ?? 10)} /> : null}
      {scanLook && stations.length ? <SurveyOverlay stations={stations} thumbSize={P.thumbSize ?? 84} contentKey={visible} /> : null}
      {!world && !scrimMode ? <gridHelper args={[200, 20, '#4a4a4a', '#2c2c2c']} position-y={0.01} /> : null}
      {!world && !scrimMode ? (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
          <planeGeometry args={[4000, 4000]} />
          <meshStandardMaterial color="#232426" roughness={1} />
        </mesh>
      ) : null}

      {structures.map((s, i) =>
        s.curve.visibility ? (
          <Structure
            key={s.structureId}
            s={s}
            stage={pointCloud ? 'world' : stage}
            order={i}
            xray={xray}
            explode={presentation.explode}
            prototypesFor={prototypesFor}
            materials={materials}
            selected={s.curveId === selectedCurveId}
            onSelect={onSelect}
            scan={scanOpts}
          />
        ) : null,
      )}
    </Canvas>
  )
})

export default WorldViewport
