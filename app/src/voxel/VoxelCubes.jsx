import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

export default function VoxelCubes({ volume }) {
  const meshRef = useRef(null)
  const cellSize = volume.worldSize / volume.resolution
  const solidCells = useMemo(() => {
    const cells = []
    for (let i = 0; i < volume.density.length; i += 1) {
      if (volume.density[i] > 0) cells.push(i)
    }
    return cells
  }, [volume])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const object = new THREE.Object3D()
    const halfExtent = (volume.resolution - 1) * 0.5
    const layerSize = volume.resolution * volume.resolution

    for (let instance = 0; instance < solidCells.length; instance += 1) {
      const index = solidCells[instance]
      const z = Math.floor(index / layerSize)
      const remainder = index - z * layerSize
      const y = Math.floor(remainder / volume.resolution)
      const x = remainder - y * volume.resolution

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
  }, [cellSize, solidCells, volume.resolution])

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, solidCells.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[cellSize * 0.84, cellSize * 0.84, cellSize * 0.84]} />
      <meshStandardMaterial color="#741014" roughness={0.88} metalness={0.04} />
    </instancedMesh>
  )
}
