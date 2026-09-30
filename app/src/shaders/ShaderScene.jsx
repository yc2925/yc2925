import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { createTestGeometry } from './geometry.js'
import { DEFAULT_ROCK_FORM } from './organicRock.js'
import { DEFAULT_SPECIMEN, SPECIMEN_GEOMETRY_KEYS } from './specimen.js'
import { createBaselineMaterial, createStrategyMaterial, syncMaterial } from './materials.js'

function StudyMesh({ geometry, material, position }) {
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      castShadow
      receiveShadow
    />
  )
}

export default function ShaderScene({
  geometryId,
  form = DEFAULT_ROCK_FORM,
  specimen = DEFAULT_SPECIMEN,
  strategy,
  settingsRef,
  rotateModel,
  compare,
  onFps,
  onGrowthProgress,
  onGeometryInfo,
}) {
  const group = useRef()
  const fpsAccum = useRef({ time: 0, frames: 0 })
  const growAccum = useRef(0)

  // Layer Separation and Surface Detail are uniforms, so they are left out of the key.
  const formKey = JSON.stringify({
    rock: form,
    specimen: Object.fromEntries(SPECIMEN_GEOMETRY_KEYS.map((key) => [key, specimen[key]])),
  })
  const geometry = useMemo(
    () => createTestGeometry(geometryId, JSON.parse(formKey)),
    [geometryId, formKey],
  )
  const material = useMemo(() => createStrategyMaterial(strategy), [strategy])
  const baselineMaterial = useMemo(() => createBaselineMaterial(), [])

  useEffect(() => {
    geometry.computeBoundingBox()
    onGeometryInfo?.({
      triangles: Math.round((geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3),
      buildMs: geometry.userData.buildMs ?? null,
    })
    return () => geometry.dispose()
  }, [geometry, onGeometryInfo])

  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => baselineMaterial.dispose(), [baselineMaterial])

  useFrame((state, delta) => {
    const settings = settingsRef.current
    if (rotateModel && group.current) {
      group.current.rotation.y += delta * 0.28
    }

    if (strategy === 'growth' && settings.growth.autoGrow) {
      const next = (settings.growth.progress + delta * settings.growth.speed) % 1
      settings.growth.progress = next
      growAccum.current += delta
      if (growAccum.current > 0.08) {
        growAccum.current = 0
        onGrowthProgress?.(next)
      }
    }

    const isSpecimen = geometryId === 'specimen'
    const shared = {
      layerSeparation: isSpecimen ? settings.specimen.layerSeparation : 0,
      surfaceDetail: isSpecimen ? settings.specimen.surfaceDetail : 0,
      focusDepth: state.camera.position.length() - 0.6,
    }
    syncMaterial(material, settings, strategy, shared)
    syncMaterial(baselineMaterial, settings, 'baseline', shared)

    const fps = fpsAccum.current
    fps.time += delta
    fps.frames += 1
    if (fps.time >= 0.4) {
      onFps?.(Math.round(fps.frames / fps.time))
      fps.time = 0
      fps.frames = 0
    }
  })

  const box = geometry.boundingBox
  const halfWidth = box ? (box.max.x - box.min.x) / 2 : 1.2
  const offset = compare ? Math.max(1.45, halfWidth + 0.08) : 0

  return (
    <group ref={group}>
      {compare ? (
        <StudyMesh geometry={geometry} material={baselineMaterial} position={[-offset, 0, 0]} />
      ) : null}
      <StudyMesh geometry={geometry} material={material} position={[offset, 0, 0]} />
    </group>
  )
}
