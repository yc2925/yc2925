import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js'
import { createMeshGeometry } from './meshing.js'

const MESH_LOOK = {
  marchingCubes: { color: '#d0d0d0', roughness: 0.78, flatShading: false },
  greedy: { color: '#8f8880', roughness: 1, flatShading: true },
  surfaceNets: { color: '#b8c0c6', roughness: 0.55, flatShading: false },
  dualContouring: { color: '#e4d6c4', roughness: 0.42, flatShading: false },
}

function createMaterial(method, overlay) {
  const look = MESH_LOOK[method] ?? MESH_LOOK.marchingCubes
  return new THREE.MeshStandardMaterial({
    color: look.color,
    roughness: look.roughness,
    metalness: 0.02,
    flatShading: look.flatShading,
    side: THREE.DoubleSide,
    transparent: overlay,
    opacity: overlay ? 0.55 : 1,
    depthWrite: !overlay,
  })
}

function createMarchingCubesSurface(chunk, overlay) {
  const start = performance.now()
  const maxPolyCount = chunk.dimensions[0] ** 3 * 5
  const surface = new MarchingCubes(
    chunk.meshResolution,
    createMaterial('marchingCubes', overlay),
    false,
    false,
    maxPolyCount,
  )
  surface.field.set(chunk.meshDensity)
  surface.isolation = 0
  surface.update()
  return {
    surface,
    vertexCount: surface.count,
    triangleCount: surface.count / 3,
    generationTime: performance.now() - start,
    kind: 'marchingCubes',
  }
}

function createBufferSurface(chunk, volume, method, overlay) {
  const start = performance.now()
  const { positions, indices } = createMeshGeometry(method, chunk, volume)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  if (indices.length > 0) {
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeVertexNormals()
  }
  const surface = new THREE.Mesh(geometry, createMaterial(method, overlay))
  return {
    surface,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    generationTime: performance.now() - start,
    kind: 'buffer',
  }
}

function createSurface(chunk, volume, method, overlay) {
  if (method === 'marchingCubes') return createMarchingCubesSurface(chunk, overlay)
  return createBufferSurface(chunk, volume, method, overlay)
}

function SurfaceChunk({ chunk, volume, method, visible, overlay, onMetrics }) {
  const result = useMemo(
    () => createSurface(chunk, volume, method, overlay),
    [chunk, method, overlay, volume],
  )
  const surface = result.surface

  useEffect(() => {
    onMetrics(chunk.id, {
      vertexCount: result.vertexCount,
      triangleCount: result.triangleCount,
      generationTime: result.generationTime,
    })
  }, [chunk.id, onMetrics, result])

  useEffect(
    () => () => {
      surface.geometry.dispose()
      surface.material.dispose()
    },
    [surface],
  )

  if (result.kind === 'marchingCubes') {
    const cellSize = volume.worldSize / volume.resolution
    const globalHalfExtent = (volume.resolution - 1) * 0.5
    const position = chunk.origin.map(
      (origin) =>
        (origin - 1 - globalHalfExtent + chunk.meshResolution * 0.5) * cellSize,
    )
    return (
      <primitive
        object={surface}
        visible={visible}
        position={position}
        scale={chunk.meshResolution * cellSize * 0.5}
      />
    )
  }

  return <primitive object={surface} visible={visible} />
}

export default function MarchingSurface({
  chunks,
  volume,
  method,
  visible,
  overlay,
  updatedChunkIds,
  updateVersion,
  onMetrics,
}) {
  const metricsRef = useRef({
    resolution: null,
    chunkCount: 0,
    method: null,
    values: new Map(),
  })
  const updatedIds = useMemo(() => new Set(updatedChunkIds), [updatedChunkIds])
  const reportMetrics = useCallback(
    (chunkId, metrics) => {
      const store = metricsRef.current
      if (
        store.resolution !== volume.resolution ||
        store.chunkCount !== chunks.length ||
        store.method !== method
      ) {
        metricsRef.current = {
          resolution: volume.resolution,
          chunkCount: chunks.length,
          method,
          values: new Map(),
        }
      }
      metricsRef.current.values.set(chunkId, metrics)
      if (metricsRef.current.values.size !== chunks.length) return

      let vertexCount = 0
      let triangleCount = 0
      let generationTime = 0
      let updatedGenerationTime = 0
      for (const value of metricsRef.current.values.values()) {
        vertexCount += value.vertexCount
        triangleCount += value.triangleCount
        generationTime += value.generationTime
      }
      for (const id of updatedIds) {
        updatedGenerationTime +=
          metricsRef.current.values.get(id)?.generationTime ?? 0
      }
      onMetrics({
        volume,
        updateVersion,
        resolution: volume.resolution,
        vertexCount,
        triangleCount,
        generationTime,
        updatedGenerationTime,
      })
    },
    [chunks.length, method, onMetrics, updatedIds, updateVersion, volume],
  )

  return chunks.map((chunk) => (
    <SurfaceChunk
      key={`${method}:${chunk.id}`}
      chunk={chunk}
      volume={volume}
      method={method}
      visible={visible}
      overlay={overlay}
      onMetrics={reportMetrics}
    />
  ))
}
