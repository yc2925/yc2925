import { useCallback, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import VoxelLabPanel, { displayModeLabel } from '../ui/VoxelLabPanel.jsx'
import {
  CSG_OPERATIONS,
  DENSITY_MODES,
  DEFAULT_VOXEL_TERRAIN,
} from '../voxel/settings.js'
import ChunkBoundaries from '../voxel/ChunkBoundaries.jsx'
import { createChunkedWorld, updateChunkedWorld } from '../voxel/chunks.js'
import CsgSphere from '../voxel/CsgSphere.jsx'
import MarchingSurface from '../voxel/MarchingSurface.jsx'
import VoxelCubes from '../voxel/VoxelCubes.jsx'

function createInitialLab() {
  const settings = { ...DEFAULT_VOXEL_TERRAIN }
  return {
    settings,
    world: createChunkedWorld(settings),
  }
}

export default function VoxelLabView() {
  const [lab, setLab] = useState(createInitialLab)
  const labRef = useRef(lab)
  const [assignmentView, setAssignmentView] = useState(true)
  const [meshMetrics, setMeshMetrics] = useState(null)
  const { settings, world } = lab
  const { chunks, volume } = world
  const handleSettingsChange = useCallback((nextSettings) => {
    const current = labRef.current
    const nextLab = {
      settings: nextSettings,
      world: updateChunkedWorld(current.world, current.settings, nextSettings),
    }
    labRef.current = nextLab
    setLab(nextLab)
  }, [])
  const currentMeshMetrics =
    meshMetrics?.volume === volume && meshMetrics?.updateVersion === world.updateVersion
      ? meshMetrics
      : null
  const solidVoxelCount = chunks.reduce((total, chunk) => total + chunk.solidVoxelCount, 0)
  const debug = {
    resolution: volume.resolution,
    sampleCount: volume.sampleCount,
    solidVoxelCount,
    meshVertexCount: currentMeshMetrics?.vertexCount ?? 0,
    meshTriangleCount: currentMeshMetrics?.triangleCount ?? 0,
    generationTime: world.updateTime + (currentMeshMetrics?.generationTime ?? 0),
    chunkCount: chunks.length,
    activeChunks: chunks.filter((chunk) => chunk.solidVoxelCount > 0).length,
    chunkDimensions: chunks[0].dimensions,
    chunksUpdated: world.updatedChunkIds.length,
    updateTime:
      world.updateTime + (currentMeshMetrics?.updatedGenerationTime ?? 0),
  }

  return (
    <section className="voxel-lab" aria-labelledby="voxel-lab-title">
      <Canvas
        className="viewport"
        camera={{ position: [6, 5, 6], fov: 50 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#070707']} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[5, 8, 4]} intensity={0.9} color="#e8e8e8" />
        <VoxelCubes chunks={chunks} volume={volume} visible={settings.showVoxels} />
        <MarchingSurface
          chunks={chunks}
          volume={volume}
          method={settings.meshingMethod}
          visible={settings.showMarchingCubes}
          overlay={settings.showVoxels && settings.showMarchingCubes}
          updatedChunkIds={world.updatedChunkIds}
          updateVersion={world.updateVersion}
          onMetrics={setMeshMetrics}
        />
        <ChunkBoundaries
          chunks={chunks}
          volume={volume}
          visible={settings.showChunkBoundaries}
          updatedChunkIds={world.updatedChunkIds}
          updateVersion={world.updateVersion}
        />
        <CsgSphere settings={settings} />
        <gridHelper
          position={[0, -settings.terrainScale * 0.5, 0]}
          args={[12, 12, '#2a2a2a', '#1a1a1a']}
        />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={28}
        />
      </Canvas>

      <h2 id="voxel-lab-title" className="voxel-lab-title">
        Voxel Exercise
      </h2>

      {assignmentView ? (
        <aside className="assignment-status" aria-label="Assignment status">
          <div className="telemetry-row">
            <span>Density mode</span>
            <span>
              {DENSITY_MODES.find((item) => item.id === settings.densityMode)?.label}
            </span>
          </div>
          <div className="telemetry-row">
            <span>Resolution</span>
            <span>{debug.resolution}³</span>
          </div>
          <div className="telemetry-row">
            <span>Display mode</span>
            <span>{displayModeLabel(settings)}</span>
          </div>
          <div className="telemetry-row">
            <span>CSG operation</span>
            <span>
              {CSG_OPERATIONS.find((item) => item.id === settings.csgOperation)?.label}
            </span>
          </div>
          <div className="telemetry-row">
            <span>Chunk count</span>
            <span>{debug.chunkCount}</span>
          </div>
          <div className="telemetry-row">
            <span>Triangle count</span>
            <span>{Math.round(debug.meshTriangleCount).toLocaleString()}</span>
          </div>
          <div className="telemetry-row">
            <span>Generation time</span>
            <span>{debug.updateTime.toFixed(1)} ms</span>
          </div>
        </aside>
      ) : null}

      <VoxelLabPanel
        settings={settings}
        debug={debug}
        assignmentView={assignmentView}
        onAssignmentViewChange={setAssignmentView}
        onChange={handleSettingsChange}
      />
    </section>
  )
}
