import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { createTestGeometry } from './geometry.js'
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
  strategy,
  settingsRef,
  rotateModel,
  compare,
  onFps,
  onGrowthProgress,
}) {
  const group = useRef()
  const fpsAccum = useRef({ time: 0, frames: 0 })
  const growAccum = useRef(0)

  const geometry = useMemo(() => createTestGeometry(geometryId), [geometryId])
  const material = useMemo(() => createStrategyMaterial(strategy), [strategy])
  const baselineMaterial = useMemo(() => createBaselineMaterial(), [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
      baselineMaterial.dispose()
    }
  }, [geometry, material, baselineMaterial])

  useFrame((_, delta) => {
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

    syncMaterial(material, settings, strategy)
    syncMaterial(baselineMaterial, settings, 'baseline')

    const fps = fpsAccum.current
    fps.time += delta
    fps.frames += 1
    if (fps.time >= 0.4) {
      onFps?.(Math.round(fps.frames / fps.time))
      fps.time = 0
      fps.frames = 0
    }
  })

  const offset = compare ? 1.45 : 0

  return (
    <group ref={group}>
      {compare ? (
        <StudyMesh geometry={geometry} material={baselineMaterial} position={[-offset, 0, 0]} />
      ) : null}
      <StudyMesh geometry={geometry} material={material} position={[offset, 0, 0]} />
    </group>
  )
}
