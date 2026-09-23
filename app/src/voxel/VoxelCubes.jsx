import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

function collectSolidCells(volume) {
  const cells = []
  for (let i = 0; i < volume.density.length; i += 1) {
    if (volume.density[i] > 0) cells.push(i)
  }
  return cells
}

function VoxelChunk({ chunk, volume, visible }) {
  const meshRef = useRef(null)
  const cellSize = volume.worldSize / volume.resolution
  const solidCells = useMemo(() => collectSolidCells(chunk), [chunk])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const object = new THREE.Object3D()
    const chunkSize = chunk.dimensions[0]
    const halfExtent = (chunkSize - 1) * 0.5
    const layerSize = chunkSize * chunkSize

    for (let instance = 0; instance < solidCells.length; instance += 1) {
      const index = solidCells[instance]
      const z = Math.floor(index / layerSize)
      const remainder = index - z * layerSize
      const y = Math.floor(remainder / chunkSize)
      const x = remainder - y * chunkSize

      object.position.set(
        (x - halfExtent) * cellSize,
        (y - halfExtent) * cellSize,
        (z - halfExtent) * cellSize,
      )
      object.updateMatrix()
      mesh.setMatrixAt(instance, object.matrix)
    }

    mesh.count = solidCells.length
    mesh.instanceMatrix.needsUpdate = true
  }, [cellSize, chunk.dimensions, solidCells])

  const globalHalfExtent = (volume.resolution - 1) * 0.5
  const position = chunk.origin.map(
    (origin) =>
      (origin + (chunk.dimensions[0] - 1) * 0.5 - globalHalfExtent) * cellSize,
  )

  return (
    <instancedMesh
      ref={meshRef}
      position={position}
      args={[null, null, solidCells.length]}
      visible={visible}
      frustumCulled={false}
    >
      <boxGeometry args={[cellSize * 0.84, cellSize * 0.84, cellSize * 0.84]} />
      <meshStandardMaterial
        color="#ff2020"
        emissive="#3f0305"
        emissiveIntensity={0.45}
        roughness={0.82}
        metalness={0.04}
      />
    </instancedMesh>
  )
}

export default function VoxelCubes({ chunks, volume, visible }) {
  return chunks.map((chunk) => (
    <VoxelChunk key={chunk.id} chunk={chunk} volume={volume} visible={visible} />
  ))
}
