import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createStoneMaterial } from '../gothic/stoneMaterial.js'
import {
  applyGrowthDrawRange,
  buildOrnamentMeshCache,
  createOrnamentMaterial,
  disposeMeshCache,
} from './ornamentGeometry.js'
import { disposeAttachmentDebug } from './architecturalAttachment.js'

/** Continuous suitability gradient: mute charcoal → mid gray → signal red. */
export function suitabilityColor(t, out = new THREE.Color()) {
  const u = Math.min(1, Math.max(0, t))
  if (u < 0.5) {
    const s = u / 0.5
    // #1a1a1a → #6e6e6e
    out.setRGB(
      (0x1a + s * (0x6e - 0x1a)) / 255,
      (0x1a + s * (0x6e - 0x1a)) / 255,
      (0x1a + s * (0x6e - 0x1a)) / 255,
    )
  } else {
    const s = (u - 0.5) / 0.5
    // #6e6e6e → #ff2020
    out.setRGB(
      (0x6e + s * (0xff - 0x6e)) / 255,
      (0x6e + s * (0x20 - 0x6e)) / 255,
      (0x6e + s * (0x20 - 0x6e)) / 255,
    )
  }
  return out
}

function ArchitectureMeshes({ meshes, stone, subdued }) {
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
    m.opacity = subdued ? 0.22 : 1
    m.depthWrite = !subdued
    return m
  }, [mat, subdued])

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
          castShadow={!subdued}
          receiveShadow={!subdued}
        />
      ))}
    </group>
  )
}

function AnchorPoints({ anchors, mode, density, threshold = 0 }) {
  const { geometry, count } = useMemo(() => {
    const list = (anchors ?? []).filter((a) =>
      mode === 'suitability' ? a.suitability >= threshold : true,
    )
    const step = Math.max(1, Math.round(1 / Math.max(0.15, density)))
    const picked = list.filter((_, i) => i % step === 0)
    const positions = new Float32Array(picked.length * 3)
    const cols = new Float32Array(picked.length * 3)
    const tmp = new THREE.Color()
    picked.forEach((a, i) => {
      positions[i * 3] = a.position.x
      positions[i * 3 + 1] = a.position.y
      positions[i * 3 + 2] = a.position.z + 0.03
      if (mode === 'suitability') {
        suitabilityColor(a.suitability, tmp)
        cols[i * 3] = tmp.r
        cols[i * 3 + 1] = tmp.g
        cols[i * 3 + 2] = tmp.b
      } else {
        cols[i * 3] = 1
        cols[i * 3 + 1] = 0.125
        cols[i * 3 + 2] = 0.125
      }
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    return { geometry, count: picked.length }
  }, [anchors, mode, density, threshold])

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry],
  )

  if (!count) return null
  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={mode === 'suitability' ? 0.11 : 0.055}
        sizeAttenuation
        vertexColors
        depthTest
        depthWrite={false}
        transparent={mode === 'suitability'}
        opacity={mode === 'suitability' ? 0.95 : 1}
      />
    </points>
  )
}

/** Coloured polyline segments along architectural curves by suitability. */
function SuitabilityCurves({ curveSamples, density, threshold = 0 }) {
  const lines = useMemo(() => {
    const list = (curveSamples ?? []).filter((s) => s.suitability >= threshold * 0.85)
    if (list.length < 2) return { object: null, count: 0 }

    // Group by feature, connect consecutive samples into segments
    const byId = new Map()
    for (const s of list) {
      if (!byId.has(s.sourceFeatureId)) byId.set(s.sourceFeatureId, [])
      byId.get(s.sourceFeatureId).push(s)
    }

    const step = Math.max(1, Math.round(1.4 / Math.max(0.2, density)))
    const positions = []
    const colors = []
    const tmp = new THREE.Color()
    for (const samples of byId.values()) {
      for (let i = 0; i < samples.length - 1; i += step) {
        const a = samples[i]
        const b = samples[Math.min(samples.length - 1, i + step)]
        const suit = (a.suitability + b.suitability) * 0.5
        suitabilityColor(suit, tmp)
        positions.push(
          a.position.x,
          a.position.y,
          a.position.z + 0.02,
          b.position.x,
          b.position.y,
          b.position.z + 0.02,
        )
        colors.push(tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b)
      }
    }
    if (!positions.length) return { object: null, count: 0 }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      depthTest: true,
      transparent: true,
      opacity: 0.85,
    })
    return { object: new THREE.LineSegments(geometry, material), count: positions.length / 6 }
  }, [curveSamples, density, threshold])

  useEffect(
    () => () => {
      if (lines.object) {
        lines.object.geometry.dispose()
        lines.object.material.dispose()
      }
    },
    [lines],
  )

  if (!lines.object) return null
  return <primitive object={lines.object} />
}

function DirectionField({ anchors, density, arrowScale = 0.22 }) {
  const lines = useMemo(() => {
    const list = anchors ?? []
    const step = Math.max(1, Math.round(1 / Math.max(0.15, density)))
    const picked = list.filter((_, i) => i % step === 0)
    const positions = new Float32Array(picked.length * 2 * 3)
    picked.forEach((a, i) => {
      const d = a.travelDirection ?? a.direction
      const len = arrowScale * (0.6 + a.suitability * 0.65)
      const ox = a.position.x
      const oy = a.position.y
      const oz = a.position.z + 0.03
      positions[i * 6] = ox
      positions[i * 6 + 1] = oy
      positions[i * 6 + 2] = oz
      positions[i * 6 + 3] = ox + d.x * len
      positions[i * 6 + 4] = oy + d.y * len
      positions[i * 6 + 5] = oz + d.z * len
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({ color: '#ff2020', depthTest: true })
    return { object: new THREE.LineSegments(geometry, material), count: picked.length }
  }, [anchors, density, arrowScale])

  useEffect(
    () => () => {
      lines.object.geometry.dispose()
      lines.object.material.dispose()
    },
    [lines],
  )

  if (!lines.count) return null
  return <primitive object={lines.object} />
}

function GrowthEnvelopeDebug({ simRef, visible }) {
  const ref = useRef()
  useFrame(() => {
    const sim = simRef?.current
    const line = ref.current
    if (!sim || !line) return
    line.visible = !!visible
    if (!visible) return
    const env = sim.getDebug?.()?.env ?? sim.state?.env
    if (!env) return
    const z = 0.02
    const pts = [
      -env.half, env.y0, z, env.half, env.y0, z,
      env.half, env.y0, z, env.half, env.y1, z,
      env.half, env.y1, z, -env.half, env.y1, z,
      -env.half, env.y1, z, -env.half, env.y0, z,
    ]
    line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  })
  return (
    <lineSegments ref={ref} frustumCulled={false}>
      <bufferGeometry />
      <lineBasicMaterial color="#5a3030" transparent opacity={0.45} depthTest />
    </lineSegments>
  )
}

function OccupancyDebug({ simRef, visible }) {
  const ref = useRef()
  useFrame(() => {
    const sim = simRef?.current
    const pts = ref.current
    if (!sim || !pts) return
    pts.visible = !!visible
    if (!visible) return
    const samples = sim.getDebug?.()?.occupancyPoints ?? []
    const arr = new Float32Array(Math.max(1, samples.length) * 3)
    samples.forEach((s, i) => {
      arr[i * 3] = s.x
      arr[i * 3 + 1] = s.y
      arr[i * 3 + 2] = 0.018
    })
    pts.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    pts.geometry.setDrawRange(0, samples.length)
  })
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry />
      <pointsMaterial
        color="#7a2428"
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  )
}

/**
 * Particle trails — mutates line buffers in useFrame; sim lives outside React.
 */
function ParticleTrails({
  simRef,
  showHeads,
  trailOpacity,
  trailThickness,
  distinguishSegments,
  showPrimarySecondary,
  onStats,
  active,
}) {
  const groupRef = useRef()
  const resources = useRef(null)
  const statsClock = useRef(0)

  useEffect(() => {
    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: trailOpacity ?? 0.85,
      depthTest: true,
    })
    const headMat = new THREE.PointsMaterial({
      color: '#ff3030',
      size: 0.06 + (trailThickness ?? 1.5) * 0.014,
      sizeAttenuation: true,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    })
    const trailGeo = new THREE.BufferGeometry()
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6), 3))
    const headGeo = new THREE.BufferGeometry()
    headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const trailLines = new THREE.LineSegments(trailGeo, trailMat)
    const headPoints = new THREE.Points(headGeo, headMat)
    trailLines.frustumCulled = false
    headPoints.frustumCulled = false
    resources.current = { trailMat, headMat, trailGeo, headGeo, trailLines, headPoints }
    const g = groupRef.current
    g?.add(trailLines)
    g?.add(headPoints)
    return () => {
      g?.remove(trailLines)
      g?.remove(headPoints)
      trailGeo.dispose()
      headGeo.dispose()
      trailMat.dispose()
      headMat.dispose()
      resources.current = null
    }
  }, [])

  useEffect(() => {
    const r = resources.current
    if (!r) return
    r.trailMat.opacity = trailOpacity ?? 0.85
    r.headMat.size = 0.06 + (trailThickness ?? 1.5) * 0.014
    r.headPoints.visible = !!showHeads
  }, [trailOpacity, trailThickness, showHeads])

  useFrame((_, dt) => {
    const sim = simRef?.current
    const r = resources.current
    if (!sim || !r || !active) return
    if (sim.state.running) sim.advance(dt)

    const trails = sim.getTrails()
    let segCount = 0
    for (const t of trails) {
      const n = t.positions.length
      if (n < 2) continue
      segCount += n - 1
      if (n > 2) segCount += Math.max(0, n - 3)
    }
    const posArr = new Float32Array(Math.max(1, segCount) * 6)
    const colArr = new Float32Array(Math.max(1, segCount) * 6)
    let w = 0
    const zLift = 0.025
    // Role hierarchy (when enabled): primary = deep crimson; secondary = cooler rose
    const cPrimary = { r: 0.62, g: 0.08, b: 0.1 }
    const cSecondary = { r: 0.72, g: 0.22, b: 0.2 }
    const cArch = { r: 0.55, g: 0.07, b: 0.09 }
    const cFree = { r: 0.78, g: 0.18, b: 0.16 }

    const writeSeg = (p0, p1, cr, cg, cb) => {
      posArr[w] = p0.x
      posArr[w + 1] = p0.y
      posArr[w + 2] = p0.z + zLift
      posArr[w + 3] = p1.x
      posArr[w + 4] = p1.y
      posArr[w + 5] = p1.z + zLift
      colArr[w] = cr
      colArr[w + 1] = cg
      colArr[w + 2] = cb
      colArr[w + 3] = Math.min(1, cr * 1.08)
      colArr[w + 4] = Math.min(1, cg * 1.08)
      colArr[w + 5] = Math.min(1, cb * 1.08)
      w += 6
    }

    for (const t of trails) {
      const pts = t.positions
      if (pts.length < 2) continue
      const fadeBase = 0.55 + (t.active ? 0.35 : 0.18)
      for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i]
        const b = pts[i + 1]
        let base
        if (showPrimarySecondary) {
          base = t.role === 'secondary' ? cSecondary : cPrimary
          if (distinguishSegments && (a.mode === 'free' || b.mode === 'free')) {
            base = { r: base.r * 1.12, g: base.g * 1.2, b: base.b * 1.05 }
          }
        } else {
          const free = distinguishSegments && (a.mode === 'free' || b.mode === 'free')
          base = free ? cFree : cArch
        }
        const ageFade = fadeBase * (0.62 + 0.38 * ((i + 1) / pts.length))
        const cr = base.r * ageFade
        const cg = base.g * ageFade
        const cb = base.b * ageFade

        if (i > 0 && i < pts.length - 2) {
          const mid = {
            x: a.x * 0.5 + b.x * 0.5,
            y: a.y * 0.5 + b.y * 0.5,
            z: a.z * 0.5 + b.z * 0.5,
          }
          const prev = pts[i - 1]
          const next = pts[i + 2]
          mid.x = mid.x * 0.7 + (prev.x + next.x) * 0.15
          mid.y = mid.y * 0.7 + (prev.y + next.y) * 0.15
          mid.z = mid.z * 0.7 + (prev.z + next.z) * 0.15
          writeSeg(a, mid, cr, cg, cb)
          writeSeg(mid, b, cr, cg, cb)
        } else {
          writeSeg(a, b, cr, cg, cb)
        }
      }
    }
    const drawnSegs = w / 6
    r.trailGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    r.trailGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3))
    r.trailGeo.setDrawRange(0, drawnSegs * 2)
    r.trailGeo.computeBoundingSphere()

    if (showHeads) {
      const heads = sim.getHeads()
      const hp = new Float32Array(Math.max(1, heads.length) * 3)
      heads.forEach((h, i) => {
        hp[i * 3] = h.position.x
        hp[i * 3 + 1] = h.position.y
        hp[i * 3 + 2] = h.position.z + 0.04
      })
      r.headGeo.setAttribute('position', new THREE.BufferAttribute(hp, 3))
      r.headGeo.setDrawRange(0, heads.length)
      r.headGeo.computeBoundingSphere()
    }

    statsClock.current += dt
    if (statsClock.current > 0.12 && onStats) {
      statsClock.current = 0
      onStats(sim.getStats())
    }
  })

  return <group ref={groupRef} />
}

/**
 * Animated hierarchical network — reveals recorded geometry by shared playback clock.
 * Does not regenerate branch geometry each frame.
 */
function BranchingNetwork({
  playbackRef,
  showPrimary = true,
  showSecondary = true,
  trailOpacity = 0.85,
  showGrowingTips = true,
  showGrowthOrigins = false,
  showMasterPaths = true,
  showMirroredPaths = true,
  showMotifOrigins = false,
  showSymmetryAxis = false,
  driveClock = true,
  onStats,
}) {
  const groupRef = useRef()
  const resources = useRef(null)
  const statsClock = useRef(0)

  useEffect(() => {
    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthTest: true,
    })
    const tipMat = new THREE.PointsMaterial({
      color: '#ff4040',
      size: 0.07,
      sizeAttenuation: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    })
    const originMat = new THREE.PointsMaterial({
      color: '#c06040',
      size: 0.045,
      sizeAttenuation: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.55,
    })
    const motifMat = new THREE.PointsMaterial({
      color: '#d09050',
      size: 0.05,
      sizeAttenuation: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.7,
    })
    const axisMat = new THREE.LineBasicMaterial({
      color: '#806040',
      transparent: true,
      opacity: 0.55,
      depthTest: true,
    })
    const trailGeo = new THREE.BufferGeometry()
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6), 3))
    const tipGeo = new THREE.BufferGeometry()
    tipGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const originGeo = new THREE.BufferGeometry()
    originGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const motifGeo = new THREE.BufferGeometry()
    motifGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const axisGeo = new THREE.BufferGeometry()
    axisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const trailLines = new THREE.LineSegments(trailGeo, trailMat)
    const tipPoints = new THREE.Points(tipGeo, tipMat)
    const originPoints = new THREE.Points(originGeo, originMat)
    const motifPoints = new THREE.Points(motifGeo, motifMat)
    const axisLine = new THREE.Line(axisGeo, axisMat)
    trailLines.frustumCulled = false
    tipPoints.frustumCulled = false
    originPoints.frustumCulled = false
    motifPoints.frustumCulled = false
    axisLine.frustumCulled = false
    resources.current = {
      trailMat,
      tipMat,
      originMat,
      motifMat,
      axisMat,
      trailGeo,
      tipGeo,
      originGeo,
      motifGeo,
      axisGeo,
      trailLines,
      tipPoints,
      originPoints,
      motifPoints,
      axisLine,
    }
    const g = groupRef.current
    g?.add(trailLines)
    g?.add(tipPoints)
    g?.add(originPoints)
    g?.add(motifPoints)
    g?.add(axisLine)
    return () => {
      g?.remove(trailLines)
      g?.remove(tipPoints)
      g?.remove(originPoints)
      g?.remove(motifPoints)
      g?.remove(axisLine)
      trailGeo.dispose()
      tipGeo.dispose()
      originGeo.dispose()
      motifGeo.dispose()
      axisGeo.dispose()
      trailMat.dispose()
      tipMat.dispose()
      originMat.dispose()
      motifMat.dispose()
      axisMat.dispose()
      resources.current = null
    }
  }, [])

  useFrame((_, dt) => {
    const playback = playbackRef?.current
    const r = resources.current
    if (!playback || !r) return
    if (driveClock && playback.state.running) playback.advance(dt)

    const vis = playback.getVisible()
    const styles = [
      { r: 0.62, g: 0.08, b: 0.1, a: 1.0, z: 0.032 },
      { r: 1.0, g: 0.34, b: 0.24, a: 0.98, z: 0.04 },
      { r: 0.82, g: 0.4, b: 0.34, a: 0.62, z: 0.043 },
      { r: 0.72, g: 0.42, b: 0.38, a: 0.42, z: 0.045 },
    ]
    const mirrorTint = { r: 0.92, g: 0.3, b: 0.38 }
    const distinguishSides = showMasterPaths !== showMirroredPaths || showSymmetryAxis

    const allowRole = (b) => {
      const role = b.compositionRole ?? 'master'
      if (role === 'mirror' && !showMirroredPaths) return false
      if (role !== 'mirror' && !showMasterPaths) return false
      return true
    }

    let segCount = 0
    for (const b of vis.branches) {
      const gen = b.generation ?? 0
      if (gen === 0 && !showPrimary) continue
      if (gen >= 1 && !showSecondary) continue
      if (!allowRole(b)) continue
      segCount += Math.max(0, b.points.length - 1)
    }

    const posArr = new Float32Array(Math.max(1, segCount) * 6)
    const colArr = new Float32Array(Math.max(1, segCount) * 6)
    let w = 0
    const op = trailOpacity ?? 0.85

    for (const b of vis.branches) {
      const gen = b.generation ?? 0
      if (gen === 0 && !showPrimary) continue
      if (gen >= 1 && !showSecondary) continue
      if (!allowRole(b)) continue
      const pts = b.points
      if (pts.length < 2) continue
      const st = styles[Math.min(3, gen)]
      const isMirror = (b.compositionRole ?? 'master') === 'mirror'
      const tint = distinguishSides && isMirror ? mirrorTint : st
      const baseA = op * st.a * (isMirror && distinguishSides ? 0.88 : 1)
      for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i]
        const c = pts[i + 1]
        const fade = 0.75 + 0.25 * ((i + 1) / pts.length)
        const cr = tint.r * fade * baseA
        const cg = tint.g * fade * baseA
        const cb = tint.b * fade * baseA
        posArr[w] = a.x
        posArr[w + 1] = a.y
        posArr[w + 2] = (a.z ?? 0) + st.z
        posArr[w + 3] = c.x
        posArr[w + 4] = c.y
        posArr[w + 5] = (c.z ?? 0) + st.z
        colArr[w] = cr
        colArr[w + 1] = cg
        colArr[w + 2] = cb
        colArr[w + 3] = Math.min(1, cr * 1.1)
        colArr[w + 4] = Math.min(1, cg * 1.1)
        colArr[w + 5] = Math.min(1, cb * 1.1)
        w += 6
      }
    }
    r.trailGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    r.trailGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3))
    r.trailGeo.setDrawRange(0, (w / 6) * 2)
    r.trailGeo.computeBoundingSphere()

    r.tipPoints.visible = !!showGrowingTips
    if (showGrowingTips) {
      const tips = vis.tips
      const hp = new Float32Array(Math.max(1, tips.length) * 3)
      tips.forEach((t, i) => {
        hp[i * 3] = t.position.x
        hp[i * 3 + 1] = t.position.y
        hp[i * 3 + 2] = (t.position.z ?? 0) + 0.05
      })
      r.tipGeo.setAttribute('position', new THREE.BufferAttribute(hp, 3))
      r.tipGeo.setDrawRange(0, tips.length)
      r.tipGeo.computeBoundingSphere()
    }

    r.originPoints.visible = !!showGrowthOrigins
    if (showGrowthOrigins) {
      const or = vis.origins
      const op2 = new Float32Array(Math.max(1, or.length) * 3)
      or.forEach((o, i) => {
        op2[i * 3] = o.position.x
        op2[i * 3 + 1] = o.position.y
        op2[i * 3 + 2] = (o.position.z ?? 0) + 0.045
      })
      r.originGeo.setAttribute('position', new THREE.BufferAttribute(op2, 3))
      r.originGeo.setDrawRange(0, or.length)
      r.originGeo.computeBoundingSphere()
    }

    const motifOrigins = playback.network?.composition?.motifOrigins ?? []
    r.motifPoints.visible = !!showMotifOrigins && motifOrigins.length > 0
    if (showMotifOrigins && motifOrigins.length) {
      const mp = new Float32Array(Math.max(1, motifOrigins.length) * 3)
      motifOrigins.forEach((o, i) => {
        mp[i * 3] = o.position.x
        mp[i * 3 + 1] = o.position.y
        mp[i * 3 + 2] = (o.position.z ?? 0) + 0.048
      })
      r.motifGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3))
      r.motifGeo.setDrawRange(0, motifOrigins.length)
      r.motifGeo.computeBoundingSphere()
    }

    const axis = playback.network?.composition?.axis
    r.axisLine.visible = !!showSymmetryAxis && !!axis
    if (showSymmetryAxis && axis) {
      const ap = new Float32Array([
        axis.a.x,
        axis.a.y,
        axis.a.z ?? 0.02,
        axis.b.x,
        axis.b.y,
        axis.b.z ?? 0.02,
      ])
      r.axisGeo.setAttribute('position', new THREE.BufferAttribute(ap, 3))
      r.axisGeo.computeBoundingSphere()
    }

    statsClock.current += dt
    if (statsClock.current > 0.1 && onStats) {
      statsClock.current = 0
      onStats(playback.getStats())
    }
  })

  return <group ref={groupRef} />
}

/**
 * Cached tapered tubes as declarative R3F meshes.
 * Growth uses drawRange only (no per-frame rebuild).
 */
function AttachmentDebugViz({ attachmentDebug, flags }) {
  const pointMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#5aa8d4',
        size: 0.045,
        sizeAttenuation: true,
        depthTest: true,
        depthWrite: false,
      }),
    [],
  )
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ vertexColors: true, depthTest: true }),
    [],
  )
  useEffect(
    () => () => {
      pointMat.dispose()
      lineMat.dispose()
    },
    [pointMat, lineMat],
  )

  if (!attachmentDebug) return null
  const showPts = !!flags?.showAttachmentPoints
  const showN = !!flags?.showSurfaceNormals
  const showF = !!flags?.showAttachmentFrames
  const showT = !!flags?.showReliefTransitions
  if (!showPts && !showN && !showF && !showT) return null

  return (
    <group>
      {showPts && attachmentDebug.points ? (
        <points geometry={attachmentDebug.points} material={pointMat} />
      ) : null}
      {showN && attachmentDebug.normals ? (
        <lineSegments geometry={attachmentDebug.normals} material={lineMat} />
      ) : null}
      {showF && attachmentDebug.frames ? (
        <lineSegments geometry={attachmentDebug.frames} material={lineMat} />
      ) : null}
      {showT && attachmentDebug.transitions ? (
        <lineSegments geometry={attachmentDebug.transitions} material={lineMat} />
      ) : null}
    </group>
  )
}

function OrnamentGeometryMeshes({
  playbackRef,
  network,
  geomParams,
  materialMode = 'stone',
  stone,
  showPrimary = true,
  showSecondary = true,
  onStats,
  debugFlags = null,
  hideOrnament = false,
}) {
  const meshRefs = useRef(new Map())
  const statsClock = useRef(0)
  const statsRef = useRef(null)

  const geomKey = useMemo(
    () =>
      JSON.stringify({
        ornamentThickness: geomParams?.ornamentThickness,
        taperStrength: geomParams?.taperStrength,
        branchThicknessDecay: geomParams?.branchThicknessDecay,
        radialResolution: geomParams?.radialResolution,
        curveResolution: geomParams?.curveResolution,
        profileType: geomParams?.profileType,
        profileWidth: geomParams?.profileWidth,
        profileDepth: geomParams?.profileDepth,
        flutingStrength: geomParams?.flutingStrength,
        profileTransition: geomParams?.profileTransition,
        reliefDepth: geomParams?.reliefDepth,
        reliefProjection: geomParams?.reliefProjection,
        sculptureMode: geomParams?.sculptureMode,
        tipCurl: geomParams?.tipCurl,
        attachmentStrength: geomParams?.attachmentStrength,
        surfaceConformity: geomParams?.surfaceConformity,
        rootEmbedding: geomParams?.rootEmbedding,
        sculpturalEmergence: geomParams?.sculpturalEmergence,
        transitionLength: geomParams?.transitionLength,
        archReady: !!geomParams?.arch,
        specimenReady: !!geomParams?.specimen,
      }),
    [geomParams],
  )

  const material = useMemo(
    () =>
      createOrnamentMaterial(materialMode, {
        stoneColor: stone?.color ?? '#c4bfb4',
        stoneRoughness: stone?.roughness ?? 0.82,
      }),
    [materialMode, stone?.color, stone?.roughness],
  )

  useEffect(() => () => material.dispose(), [material])

  const [pack, setPack] = useState({
    items: [],
    stats: null,
    debugGeos: [],
    attachmentDebug: null,
  })
  const items = pack.items
  const debugGeos = pack.debugGeos
  const packEpoch = useRef(0)

  useEffect(() => {
    const epoch = (packEpoch.current += 1)
    if (!network?.branches?.length) {
      setPack({ items: [], stats: null, debugGeos: [], attachmentDebug: null })
      statsRef.current = null
      return undefined
    }
    const built = buildOrnamentMeshCache(network, geomParams ?? {})
    for (const item of built.meshes) applyGrowthDrawRange(item.geometry, 0)
    const next = {
      items: built.meshes,
      stats: built.stats,
      debugGeos: materialMode === 'profile-debug' ? built.debugGeometries ?? [] : [],
      attachmentDebug: built.attachmentDebug ?? null,
    }
    // Ignore stale Strict-Mode / raced effect results.
    if (epoch === packEpoch.current) {
      setPack(next)
      statsRef.current = built.stats
    } else {
      disposeMeshCache(built)
    }
    return () => {
      // Only dispose if this effect's pack is still the live one.
      if (epoch !== packEpoch.current) return
      for (const item of next.items) item.geometry?.dispose()
      for (const d of next.debugGeos) d.geometry?.dispose()
      disposeAttachmentDebug(next.attachmentDebug)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, geomKey, materialMode])

  useFrame((_, dt) => {
    const playback = playbackRef?.current
    if (!playback) return
    if (playback.state.running) playback.advance(dt)

    const vis = playback.getVisible()
    const visById = new Map(vis.branches.map((b) => [b.id, b]))
    let visibleTris = 0
    let visibleLen = 0
    let totalLen = 0

    for (const item of items) {
      const mesh = meshRefs.current.get(item.id)
      if (!mesh) continue
      const gen = item.generation ?? 0
      const hide =
        hideOrnament || (gen === 0 && !showPrimary) || (gen >= 1 && !showSecondary)
      const vb = visById.get(item.id)
      const frac =
        hide || !vb
          ? 0
          : (vb.visibleLength ?? 0) / Math.max(1e-6, vb.length || item.length || 1)
      const shown = applyGrowthDrawRange(item.geometry, frac)
      mesh.visible = shown > 0 && !hide
      totalLen += item.length || 0
      if (vb && !hide) {
        visibleLen += vb.visibleLength ?? 0
        visibleTris += Math.round((item.triangleCount ?? 0) * shown)
      }
    }

    statsClock.current += dt
    if (statsClock.current > 0.1 && onStats) {
      statsClock.current = 0
      const base = playback.getStats()
      const s = statsRef.current
      onStats({
        ...base,
        ornamentMeshes: s?.ornamentMeshes ?? items.length,
        ornamentTriangles: s?.ornamentTriangles ?? 0,
        primaryMeshCount: s?.primaryMeshCount ?? 0,
        secondaryMeshCount: s?.secondaryMeshCount ?? 0,
        visibleOrnamentTriangles: visibleTris,
        visibleGrowthPercent: totalLen > 0 ? (100 * visibleLen) / totalLen : 0,
        profileType: s?.profileType ?? geomParams?.profileType,
        sculptureMode: s?.sculptureMode ?? geomParams?.sculptureMode,
        validAttachments: s?.validAttachments ?? 0,
        invalidAttachments: s?.invalidAttachments ?? 0,
      })
    }
  })

  const debugMat = useMemo(
    () => new THREE.LineBasicMaterial({ vertexColors: true }),
    [],
  )
  useEffect(() => () => debugMat.dispose(), [debugMat])

  return (
    <group>
      {!hideOrnament
        ? items.map((item) => (
            <mesh
              key={item.id}
              ref={(m) => {
                if (m) meshRefs.current.set(item.id, m)
                else meshRefs.current.delete(item.id)
              }}
              geometry={item.geometry}
              material={material}
              frustumCulled={false}
            />
          ))
        : null}
      {materialMode === 'profile-debug'
        ? debugGeos.map((d) => (
            <lineSegments key={`dbg-${d.id}`} geometry={d.geometry} material={debugMat} />
          ))
        : null}
      <AttachmentDebugViz attachmentDebug={pack.attachmentDebug} flags={debugFlags} />
    </group>
  )
}

/**
 * Ornament System viewport content.
 */
export default function OrnamentScene({
  specimen,
  anchors,
  curveSamples,
  displayMode,
  showArchitecture,
  diagnosticDensity,
  suitabilityThreshold = 0,
  stone,
  simRef,
  showParticleHeads = true,
  distinguishGrowthSegments = true,
  showPrimarySecondary = true,
  showGrowthEnvelope = false,
  showOccupancy = false,
  trailOpacity = 0.85,
  trailThickness = 1.5,
  onSimStats,
  branchPlaybackRef = null,
  showBranchPrimary = true,
  showBranchSecondary = true,
  showGrowingTips = true,
  showGrowthOrigins = false,
  showMasterPaths = true,
  showMirroredPaths = true,
  showMotifOrigins = false,
  showSymmetryAxis = false,
  onBranchStats,
  geomParams = null,
  ornamentMaterialMode = 'stone',
  showCurveSkeleton = false,
  branchNetwork = null,
  viewIsolation = 'combined',
  debugFlags = null,
}) {
  const density = diagnosticDensity ?? 0.7
  const trailsMode = displayMode === 'trails'
  const branchingMode = displayMode === 'branching'
  const geometryMode = displayMode === 'geometry'
  const isolation = viewIsolation ?? 'combined'
  const hideArchByIsolation = geometryMode && isolation === 'ornament'
  const hideOrnamentByIsolation = geometryMode && isolation === 'architecture'
  const showArch =
    !hideArchByIsolation &&
    (displayMode === 'architecture' ||
      (showArchitecture && displayMode !== 'architecture'))
  const subdued = displayMode !== 'architecture'

  return (
    <group>
      {showArch ? (
        <ArchitectureMeshes
          meshes={specimen?.meshes}
          stone={stone}
          subdued={subdued || trailsMode || branchingMode || geometryMode}
        />
      ) : null}

      {displayMode === 'anchors' ? (
        <AnchorPoints anchors={anchors} mode="anchors" density={density} />
      ) : null}

      {displayMode === 'suitability' ? (
        <>
          <SuitabilityCurves
            curveSamples={curveSamples}
            density={density}
            threshold={suitabilityThreshold}
          />
          <AnchorPoints
            anchors={anchors}
            mode="suitability"
            density={Math.min(1, density + 0.15)}
            threshold={suitabilityThreshold}
          />
        </>
      ) : null}

      {displayMode === 'direction' ? (
        <DirectionField anchors={anchors} density={density} />
      ) : null}

      {trailsMode ? (
        <>
          <ParticleTrails
            simRef={simRef}
            showHeads={showParticleHeads}
            trailOpacity={trailOpacity}
            trailThickness={trailThickness}
            distinguishSegments={distinguishGrowthSegments}
            showPrimarySecondary={showPrimarySecondary}
            onStats={onSimStats}
            active
          />
          <GrowthEnvelopeDebug simRef={simRef} visible={showGrowthEnvelope} />
          <OccupancyDebug simRef={simRef} visible={showOccupancy} />
        </>
      ) : null}

      {branchingMode ? (
        <BranchingNetwork
          playbackRef={branchPlaybackRef}
          showPrimary={showBranchPrimary}
          showSecondary={showBranchSecondary}
          trailOpacity={trailOpacity}
          showGrowingTips={showGrowingTips}
          showGrowthOrigins={showGrowthOrigins}
          showMasterPaths={showMasterPaths}
          showMirroredPaths={showMirroredPaths}
          showMotifOrigins={showMotifOrigins}
          showSymmetryAxis={showSymmetryAxis}
          onStats={onBranchStats}
        />
      ) : null}

      {geometryMode ? (
        <>
          <OrnamentGeometryMeshes
            playbackRef={branchPlaybackRef}
            network={branchNetwork}
            geomParams={geomParams}
            materialMode={ornamentMaterialMode}
            stone={stone}
            showPrimary={showBranchPrimary}
            showSecondary={showBranchSecondary}
            onStats={onBranchStats}
            debugFlags={debugFlags}
            hideOrnament={hideOrnamentByIsolation}
          />
          {showCurveSkeleton && !hideOrnamentByIsolation ? (
            <BranchingNetwork
              playbackRef={branchPlaybackRef}
              showPrimary={showBranchPrimary}
              showSecondary={showBranchSecondary}
              trailOpacity={Math.min(0.55, (trailOpacity ?? 0.85) * 0.55)}
              showGrowingTips={false}
              showGrowthOrigins={showGrowthOrigins}
              showMasterPaths={showMasterPaths}
              showMirroredPaths={showMirroredPaths}
              showMotifOrigins={showMotifOrigins}
              showSymmetryAxis={showSymmetryAxis}
              driveClock={false}
              onStats={null}
            />
          ) : null}
        </>
      ) : null}
    </group>
  )
}
