/**
 * Steps 11A–11C — Agents, field heatmaps, comparison, ornament construction.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createStoneMaterial } from '../gothic/stoneMaterial.js'
import { applyConstructionReveal, createOrnamentMaterial } from './ornamentConstruction.js'
import { buildRegionCurveMap, regionDebugColor } from './architecturalRegions.js'
import { AGENT_STATE_COLORS } from './settings.js'
import { STATE } from './agentModel.js'

function ArchitectureMeshes({ meshes, stone, subdued, opacity = 0.22 }) {
  const mat = useMemo(
    () =>
      createStoneMaterial({
        stoneColor: stone?.color ?? '#c4bfb4',
        stoneRoughness: stone?.roughness ?? 0.78,
        surfaceVariation: stone?.variation ?? 0.25,
        wireframe: false,
      }),
    [stone?.color, stone?.roughness, stone?.variation],
  )

  const dimMat = useMemo(() => {
    const m = mat.clone()
    m.transparent = true
    m.opacity = subdued ? opacity : 1
    m.depthWrite = !subdued
    return m
  }, [mat, subdued, opacity])

  useEffect(
    () => () => {
      mat.dispose()
      dimMat.dispose()
    },
    [mat, dimMat],
  )

  if (!meshes?.length) return null
  return (
    <group>
      {meshes.map((part) => (
        <mesh
          key={part.id}
          geometry={part.geometry}
          material={dimMat}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  )
}

/** Always-on state colours — restrained but readable on dark stone. */
function stateColor(state) {
  return new THREE.Color(AGENT_STATE_COLORS[state] ?? '#c8c2b6')
}

function FieldOverlay({ simRef, mode = 'attraction', maxSegments = 12000, fieldStride = 1 }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxSegments * 2 * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxSegments * 2 * 3), 3))
    g.setDrawRange(0, 0)
    return g
  }, [maxSegments])
  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthTest: true,
        linewidth: 1,
      }),
    [],
  )
  const clock = useRef(0)

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )

  useFrame((_, dt) => {
    if (!mode || mode === 'agents') {
      geo.setDrawRange(0, 0)
      return
    }
    clock.current += dt
    if (clock.current < 0.05) return
    clock.current = 0
    const field = simRef?.current?.field
    if (!field?.buildVizSegments) {
      geo.setDrawRange(0, 0)
      return
    }
    const { positions, colors } = field.buildVizSegments(mode)
    const pos = geo.getAttribute('position')
    const col = geo.getAttribute('color')
    const stride = Math.max(1, fieldStride | 0)
    // Segment = 2 verts; stride skips display segments only (simulation field unchanged)
    const segCount = Math.floor(positions.length / 6)
    let vi = 0
    for (let s = 0; s < segCount; s += stride) {
      if (vi + 1 >= pos.count) break
      const b = s * 6
      pos.setXYZ(vi, positions[b], positions[b + 1], positions[b + 2])
      pos.setXYZ(vi + 1, positions[b + 3], positions[b + 4], positions[b + 5])
      col.setXYZ(vi, colors[b], colors[b + 1], colors[b + 2])
      col.setXYZ(vi + 1, colors[b + 3], colors[b + 4], colors[b + 5])
      vi += 2
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    geo.setDrawRange(0, vi)
  })

  if (!mode || mode === 'agents') return null
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />
}

function AgentLayer({
  simRef,
  showTrails = true,
  showDirections = true,
  onStats,
  maxAgents = 64,
  hideAgents = false,
  driveClock = true,
  fullTrailHistory = false,
  trailWindow = 40,
  trailStride = 1,
  markerScale = 1,
}) {
  const meshRef = useRef(null)
  const statsClock = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorBuf = useRef(null)

  const sphere = useMemo(() => new THREE.SphereGeometry(0.07, 12, 10), [])
  const markerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.08,
        emissive: new THREE.Color('#1a1a1a'),
        emissiveIntensity: 0.35,
      }),
    [],
  )
  const dirMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 1,
        depthTest: true,
      }),
    [],
  )
  const trailMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        depthTest: true,
      }),
    [],
  )

  const dirGeometry = useMemo(() => {
    const d = new THREE.BufferGeometry()
    d.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxAgents * 2 * 3), 3))
    d.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxAgents * 2 * 3), 3))
    d.setDrawRange(0, 0)
    return d
  }, [maxAgents])

  const trailSegCap = maxAgents * (fullTrailHistory ? 220 : 64) * 2
  const trailGeometry = useMemo(() => {
    const t = new THREE.BufferGeometry()
    t.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailSegCap * 3), 3))
    t.setAttribute('color', new THREE.BufferAttribute(new Float32Array(trailSegCap * 3), 3))
    t.setDrawRange(0, 0)
    return t
  }, [trailSegCap])

  useEffect(
    () => () => {
      sphere.dispose()
      markerMat.dispose()
      dirMat.dispose()
      trailMat.dispose()
      dirGeometry.dispose()
      trailGeometry.dispose()
    },
    [sphere, markerMat, dirMat, trailMat, dirGeometry, trailGeometry],
  )

  useEffect(() => {
    const colors = new Float32Array(maxAgents * 3)
    colorBuf.current = colors
    if (meshRef.current) {
      meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
    }
  }, [maxAgents])

  useFrame((_, dt) => {
    const sim = simRef?.current
    if (!sim) return
    if (driveClock) sim.advance(dt)

    const agents = sim.state.agents
    const mesh = meshRef.current
    if (!mesh) return

    const colors = colorBuf.current
    const n = Math.min(agents.length, maxAgents)

    for (let i = 0; i < maxAgents; i += 1) {
      if (hideAgents || i >= n) {
        dummy.position.set(0, -100, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        continue
      }
      const a = agents[i]
      dummy.position.copy(a.position)
      const mScale = Math.max(0.4, markerScale ?? 1)
      const scale =
        (a.state === STATE.DORMANT ? 0.5 : a.state === STATE.COMPLETED ? 0.65 : 1.15) * mScale
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (colors) {
        const c = stateColor(a.state)
        colors[i * 3] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = n

    if (showDirections && !hideAgents && dirGeometry) {
      const pos = dirGeometry.getAttribute('position')
      const col = dirGeometry.getAttribute('color')
      let w = 0
      for (let i = 0; i < n; i += 1) {
        const a = agents[i]
        if (a.state === STATE.DORMANT || a.state === STATE.COMPLETED) continue
        const P = a.position
        const V = a.velocity
        const len = V.length()
        if (len < 1e-5) continue
        const L = 0.18
        const i0 = w * 2
        pos.setXYZ(i0, P.x, P.y, P.z)
        pos.setXYZ(i0 + 1, P.x + (V.x / len) * L, P.y + (V.y / len) * L, P.z + (V.z / len) * L)
        const c = stateColor(a.state)
        col.setXYZ(i0, c.r, c.g, c.b)
        col.setXYZ(i0 + 1, Math.min(1, c.r + 0.25), Math.min(1, c.g + 0.15), Math.min(1, c.b + 0.1))
        w += 1
      }
      pos.needsUpdate = true
      col.needsUpdate = true
      dirGeometry.setDrawRange(0, w * 2)
    } else if (dirGeometry) {
      dirGeometry.setDrawRange(0, 0)
    }

    if (showTrails && !hideAgents && trailGeometry) {
      const pos = trailGeometry.getAttribute('position')
      const col = trailGeometry.getAttribute('color')
      let vi = 0
      const cap = pos.count
      for (let i = 0; i < n; i += 1) {
        const a = agents[i]
        const trail = a.trail
        if (!trail || trail.length < 2) continue
        const c = stateColor(a.state)
        const window = Math.max(4, trailWindow ?? 40)
        const stride = Math.max(1, trailStride ?? 1)
        const start = fullTrailHistory ? 1 : Math.max(1, trail.length - window)
        for (let k = start; k < trail.length; k += stride) {
          if (vi + 1 >= cap) break
          const p0 = trail[Math.max(start, k - stride)]
          const p1 = trail[k]
          pos.setXYZ(vi, p0.x, p0.y, p0.z ?? 0)
          pos.setXYZ(vi + 1, p1.x, p1.y, p1.z ?? 0)
          const fade = k / trail.length
          col.setXYZ(vi, c.r * 0.35 * fade, c.g * 0.35 * fade, c.b * 0.35 * fade)
          col.setXYZ(vi + 1, c.r * fade, c.g * fade, c.b * fade)
          vi += 2
        }
      }
      pos.needsUpdate = true
      col.needsUpdate = true
      trailGeometry.setDrawRange(0, vi)
    } else if (trailGeometry) {
      trailGeometry.setDrawRange(0, 0)
    }

    statsClock.current += dt
    if (statsClock.current > 0.1 && onStats) {
      statsClock.current = 0
      onStats(sim.getStats())
    }
  })

  return (
    <group>
      <instancedMesh
        ref={(m) => {
          meshRef.current = m
          if (m && colorBuf.current && !m.instanceColor) {
            m.instanceColor = new THREE.InstancedBufferAttribute(colorBuf.current, 3)
          }
        }}
        args={[sphere, markerMat, maxAgents]}
        frustumCulled={false}
      />
      <lineSegments geometry={dirGeometry} material={dirMat} frustumCulled={false} />
      <lineSegments geometry={trailGeometry} material={trailMat} frustumCulled={false} />
    </group>
  )
}

/** Architectural region colours on curve graph (regional composition debug). */
function RegionOverlay({ simRef, arch, maxSegs = 10000 }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxSegs * 2 * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxSegs * 2 * 3), 3))
    g.setDrawRange(0, 0)
    return g
  }, [maxSegs])
  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        depthTest: true,
      }),
    [],
  )
  const built = useRef('')

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )

  useFrame(() => {
    const graph = simRef?.current?.graph
    if (!graph?.curves?.length) {
      geo.setDrawRange(0, 0)
      return
    }
    const key = `${graph.curves.length}:${arch?.bounds?.y1 ?? 0}`
    if (key === built.current && geo.drawRange.count > 0) return
    built.current = key
    const regionMap = buildRegionCurveMap(graph, arch ?? { bounds: graph.bounds })
    const pos = geo.getAttribute('position')
    const col = geo.getAttribute('color')
    let vi = 0
    for (const c of graph.curves) {
      const region = regionMap.get(c.id) ?? 'outer-frame'
      const rgb = regionDebugColor(region)
      const pts = c.points ?? []
      for (let i = 1; i < pts.length; i += 1) {
        if (vi + 1 >= pos.count) break
        const a = pts[i - 1]
        const b = pts[i]
        pos.setXYZ(vi, a.x, a.y, (a.z ?? 0) + 0.03)
        pos.setXYZ(vi + 1, b.x, b.y, (b.z ?? 0) + 0.03)
        col.setXYZ(vi, rgb[0] * 0.55, rgb[1] * 0.55, rgb[2] * 0.55)
        col.setXYZ(vi + 1, rgb[0], rgb[1], rgb[2])
        vi += 2
      }
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    geo.setDrawRange(0, vi)
  })

  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />
}

/** Debug polylines for accepted / rejected construction paths. */
function PathDebugOverlay({ constructionRef, mode = 'accepted', maxSegs = 8000 }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxSegs * 2 * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxSegs * 2 * 3), 3))
    g.setDrawRange(0, 0)
    return g
  }, [maxSegs])
  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthTest: true,
      }),
    [],
  )

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )

  useFrame(() => {
    if (mode !== 'accepted' && mode !== 'rejected') {
      geo.setDrawRange(0, 0)
      return
    }
    const pack = constructionRef?.current
    const paths = mode === 'accepted' ? pack?.accepted : pack?.rejected
    if (!paths?.length) {
      geo.setDrawRange(0, 0)
      return
    }
    const pos = geo.getAttribute('position')
    const col = geo.getAttribute('color')
    let vi = 0
    const cr = mode === 'accepted' ? [0.85, 0.72, 0.42] : [0.55, 0.12, 0.14]
    for (const path of paths) {
      const pts = path.points ?? []
      for (let i = 1; i < pts.length; i += 1) {
        if (vi + 1 >= pos.count) break
        const a = pts[i - 1]
        const b = pts[i]
        pos.setXYZ(vi, a.x, a.y, (a.z ?? 0) + 0.04)
        pos.setXYZ(vi + 1, b.x, b.y, (b.z ?? 0) + 0.04)
        col.setXYZ(vi, cr[0] * 0.55, cr[1] * 0.55, cr[2] * 0.55)
        col.setXYZ(vi + 1, cr[0], cr[1], cr[2])
        vi += 2
      }
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    geo.setDrawRange(0, vi)
  })

  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />
}

/** Cached ornament meshes — reveal via drawRange from sim clock. */
function ConstructionMeshes({ constructionRef, simRef, stone, visible = true }) {
  const groupRef = useRef(null)
  const mat = useMemo(
    () =>
      createOrnamentMaterial('stone', {
        stoneColor: stone?.color ?? '#c4bfb4',
        stoneRoughness: stone?.roughness ?? 0.82,
      }),
    [stone?.color, stone?.roughness],
  )
  const builtKey = useRef('')

  useEffect(
    () => () => {
      mat.dispose()
    },
    [mat],
  )

  useFrame(() => {
    const pack = constructionRef?.current
    const group = groupRef.current
    if (!group) return
    if (!visible || !pack?.meshCache) {
      group.visible = false
      if (!pack?.meshCache && builtKey.current) {
        while (group.children.length) group.remove(group.children[0])
        builtKey.current = ''
      }
      return
    }
    group.visible = true
    const key = pack.fingerprint ?? ''
    if (key !== builtKey.current) {
      while (group.children.length) group.remove(group.children[0])
      for (const m of pack.meshCache.meshes ?? []) {
        const mesh = new THREE.Mesh(m.geometry, mat)
        mesh.frustumCulled = false
        mesh.userData.branchId = m.id
        group.add(mesh)
      }
      builtKey.current = key
    }
    const t = simRef?.current?.state?.time ?? 0
    applyConstructionReveal(pack, t)
  })

  return <group ref={groupRef} />
}

/**
 * Single simulation viewport (optionally offset for comparison).
 */
export function AgentSimViewport({
  specimen,
  stone,
  showArchitecture = true,
  simRef,
  showTrails = true,
  showDirections = true,
  fieldDisplayMode = 'agents',
  onStats,
  driveClock = true,
  fullTrailHistory = false,
  position = [0, 0, 0],
  label = null,
  constructionRef = null,
  constructionDisplayMode = 'agents',
  hideAgents = false,
  arch = null,
  vizLod = null,
}) {
  const fieldMode = fieldDisplayMode ?? 'agents'
  const showField = fieldMode !== 'agents' && constructionDisplayMode !== 'regional'
  const mode = constructionDisplayMode ?? 'agents'
  const showAgents =
    !hideAgents &&
    (mode === 'agents' ||
      mode === 'agents+ornament' ||
      mode === 'accepted' ||
      mode === 'rejected' ||
      mode === 'regional')
  const showOrnament =
    mode === 'ornament' || mode === 'agents+ornament' || mode === 'architecture+ornament'
  const showAccepted = mode === 'accepted' || mode === 'regional'
  const showRejected = mode === 'rejected' || mode === 'regional'
  const showRegions = mode === 'regional'
  const archOpacity = mode === 'architecture+ornament' || mode === 'regional' ? 0.28 : 0.18
  const trailWindow = vizLod?.trailWindow ?? 40
  const trailStride = vizLod?.trailStride ?? 1
  const fieldStride = vizLod?.fieldStride ?? 1
  const markerScale = vizLod?.markerScale ?? 1
  const dirsOn = showDirections && showAgents && vizLod?.showDirections !== false

  return (
    <group position={position}>
      {showArchitecture ? (
        <ArchitectureMeshes
          meshes={specimen?.meshes}
          stone={stone}
          subdued
          opacity={archOpacity}
        />
      ) : null}
      <FieldOverlay
        simRef={simRef}
        mode={showField ? fieldMode : 'agents'}
        fieldStride={fieldStride}
      />
      {showRegions ? <RegionOverlay simRef={simRef} arch={arch} /> : null}
      {showAccepted ? (
        <PathDebugOverlay constructionRef={constructionRef} mode="accepted" />
      ) : null}
      {showRejected && mode === 'rejected' ? (
        <PathDebugOverlay constructionRef={constructionRef} mode="rejected" />
      ) : null}
      {showRejected && mode === 'regional' ? (
        <PathDebugOverlay constructionRef={constructionRef} mode="rejected" />
      ) : null}
      <ConstructionMeshes
        constructionRef={constructionRef}
        simRef={simRef}
        stone={stone}
        visible={showOrnament}
      />
      <AgentLayer
        simRef={simRef}
        showTrails={showTrails && showAgents}
        showDirections={dirsOn}
        onStats={driveClock ? null : onStats}
        maxAgents={64}
        hideAgents={!showAgents}
        driveClock={false}
        trailWindow={trailWindow}
        trailStride={trailStride}
        markerScale={markerScale}
        fullTrailHistory={fullTrailHistory}
      />
      {label ? (
        <sprite position={[0, -0.35, 0.5]} scale={[1.6, 0.28, 1]}>
          {/* label handled in HTML overlay; keep 3D clean */}
        </sprite>
      ) : null}
    </group>
  )
}

/**
 * Advances both sims once per frame when comparison is active.
 */
function DualClock({ simOffRef, simOnRef, onStatsOff, onStatsOn }) {
  const clock = useRef(0)
  useFrame((_, dt) => {
    simOffRef?.current?.advance(dt)
    simOnRef?.current?.advance(dt)
    clock.current += dt
    if (clock.current > 0.1) {
      clock.current = 0
      if (onStatsOff && simOffRef?.current) onStatsOff(simOffRef.current.getStats())
      if (onStatsOn && simOnRef?.current) onStatsOn(simOnRef.current.getStats())
    }
  })
  return null
}

/** Solo sim clock — keeps advance/stats independent of agent marker layer. */
function SoloClock({ simRef, onStats }) {
  const clock = useRef(0)
  useFrame((_, dt) => {
    simRef?.current?.advance(dt)
    clock.current += dt
    if (clock.current > 0.1) {
      clock.current = 0
      if (onStats && simRef?.current) onStats(simRef.current.getStats())
    }
  })
  return null
}

export default function AgentScene({
  specimen,
  stone,
  showArchitecture = true,
  simRef,
  showTrails = true,
  showDirections = true,
  fieldDisplayMode = 'agents',
  onStats,
  fullTrailHistory = false,
  // Comparison mode
  comparisonMode = false,
  simOffRef = null,
  simOnRef = null,
  onStatsOff = null,
  onStatsOn = null,
  compareFieldMode = 'agents',
  // Construction
  constructionRef = null,
  constructionDisplayMode = 'agents',
  arch = null,
  /** Step 12B — visualization LOD only (simulation unchanged) */
  vizLod = null,
}) {
  if (comparisonMode && simOffRef && simOnRef) {
    const gap = 3.4
    return (
      <group>
        <DualClock
          simOffRef={simOffRef}
          simOnRef={simOnRef}
          onStatsOff={onStatsOff}
          onStatsOn={onStatsOn}
        />
        <AgentSimViewport
          specimen={specimen}
          stone={stone}
          showArchitecture={showArchitecture}
          simRef={simOffRef}
          showTrails={showTrails}
          showDirections={showDirections}
          fieldDisplayMode={compareFieldMode}
          driveClock={false}
          fullTrailHistory={fullTrailHistory}
          position={[-gap, 0, 0]}
          constructionRef={null}
          constructionDisplayMode="agents"
          vizLod={vizLod}
        />
        <AgentSimViewport
          specimen={specimen}
          stone={stone}
          showArchitecture={showArchitecture}
          simRef={simOnRef}
          showTrails={showTrails}
          showDirections={showDirections}
          fieldDisplayMode={compareFieldMode}
          driveClock={false}
          fullTrailHistory={fullTrailHistory}
          position={[gap, 0, 0]}
          constructionRef={null}
          constructionDisplayMode="agents"
          vizLod={vizLod}
        />
        {/* Divider plane (hairline) */}
        <mesh position={[0, 2.2, 0]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.02, 5.5]} />
          <meshBasicMaterial color="#3f3f3f" transparent opacity={0.85} />
        </mesh>
      </group>
    )
  }

  return (
    <group>
      <SoloClock simRef={simRef} onStats={onStats} />
      <AgentSimViewport
        specimen={specimen}
        stone={stone}
        showArchitecture={showArchitecture}
        simRef={simRef}
        showTrails={showTrails}
        showDirections={showDirections}
        fieldDisplayMode={fieldDisplayMode}
        onStats={null}
        driveClock={false}
        fullTrailHistory={fullTrailHistory}
        constructionRef={constructionRef}
        constructionDisplayMode={constructionDisplayMode}
        arch={arch}
        vizLod={vizLod}
      />
    </group>
  )
}
