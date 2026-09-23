import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function ChunkBoundary({ position, geometry, highlighted, updateVersion }) {
  const materialRef = useRef(null)
  const highlightStartRef = useRef(-Infinity)

  useEffect(() => {
    if (highlighted) highlightStartRef.current = performance.now()
  }, [highlighted, updateVersion])

  useFrame(() => {
    const material = materialRef.current
    if (!material) return
    const elapsed = performance.now() - highlightStartRef.current
    const active = elapsed >= 0 && elapsed < 900
    material.color.set(active ? '#ff2020' : '#8a8a8a')
    material.opacity = active ? 1 : 0.24
  })

  return (
    <lineSegments position={position} geometry={geometry} renderOrder={4}>
      <lineBasicMaterial
        ref={materialRef}
        transparent
        opacity={0.24}
        depthTest={false}
        depthWrite={false}
      />
    </lineSegments>
  )
}

export default function ChunkBoundaries({
  chunks,
  volume,
  visible,
  updatedChunkIds,
  updateVersion,
}) {
  const cellSize = volume.worldSize / volume.resolution
  const chunkWorldSize = chunks[0].dimensions[0] * cellSize
  const highlightedIds = useMemo(
    () => new Set(updatedChunkIds),
    [updatedChunkIds],
  )
  const resources = useMemo(() => {
    const box = new THREE.BoxGeometry(chunkWorldSize, chunkWorldSize, chunkWorldSize)
    return {
      geometry: new THREE.EdgesGeometry(box),
      box,
    }
  }, [chunkWorldSize])

  useEffect(
    () => () => {
      resources.geometry.dispose()
      resources.box.dispose()
    },
    [resources],
  )

  if (!visible) return null

  const globalHalfExtent = (volume.resolution - 1) * 0.5
  return chunks.map((chunk) => {
    const position = chunk.origin.map(
      (origin) =>
        (origin + (chunk.dimensions[0] - 1) * 0.5 - globalHalfExtent) * cellSize,
    )
    return (
      <ChunkBoundary
        key={chunk.id}
        position={position}
        geometry={resources.geometry}
        highlighted={highlightedIds.has(chunk.id)}
        updateVersion={updateVersion}
      />
    )
  })
}
