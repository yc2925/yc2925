import { useState } from 'react'
import {
  CSG_OPERATIONS,
  DENSITY_MODES,
  MESHING_METHODS,
  RESOLUTION_PRESETS,
  VOXEL_LIMITS,
  chunkSizeOptions,
  compatibleChunkSize,
} from '../voxel/settings.js'
import { ControlPanel, Select, Slider, Toggle } from './Controls.jsx'

function Section({ title, hint, children, open = false }) {
  const [expanded, setExpanded] = useState(open)

  return (
    <details
      className="control-section"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      <div className="section-controls">
        {hint ? <p className="meshing-hint">{hint}</p> : null}
        {children}
      </div>
    </details>
  )
}

function DebugReadout({ label, value }) {
  return (
    <div className="telemetry-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function displayModeLabel(settings) {
  if (settings.showVoxels && settings.showMarchingCubes) return 'Both'
  if (settings.showVoxels) return 'Voxels'
  if (settings.showMarchingCubes) return 'Surface'
  return 'Hidden'
}

export default function VoxelLabPanel({ settings, debug, assignmentView, onAssignmentViewChange, onChange }) {
  const patch = (change) => onChange({ ...settings, ...change })
  const count = (value) => Math.round(value).toLocaleString()
  const title = (index, name) => (assignmentView ? `${index}. ${name}` : name)

  return (
    <ControlPanel
      title={assignmentView ? 'Assignment view' : 'Voxel lab'}
      hint={assignmentView ? 'demo topics · screenshot the live status strip' : 'procedural scalar density fields'}
    >
      <Toggle
        label="Assignment View"
        tip="Organizes the existing voxel tools into demonstration topics and shows a compact status strip."
        value={assignmentView}
        onChange={onAssignmentViewChange}
      />

      <Section
        title={title(1, 'Density Field')}
        hint="Each cell stores a scalar. Density > 0 is solid; density ≤ 0 is empty."
        open
      >
        <Select
          label="Density Mode"
          tip="Selects the scalar field used to classify solid and empty cells."
          value={settings.densityMode}
          options={DENSITY_MODES}
          onChange={(densityMode) => patch({ densityMode })}
        />
      </Section>

      <Section
        title={title(2, 'Procedural Voxel Terrain')}
        hint="Rolling terrain is generated volumetrically, then classified cell by cell."
        open={!assignmentView}
      >
        <Slider
          label="Terrain Scale"
          tip="Controls the world-space size of the cubic voxel volume."
          value={settings.terrainScale}
          min={VOXEL_LIMITS.terrainScale.min}
          max={VOXEL_LIMITS.terrainScale.max}
          step={VOXEL_LIMITS.terrainScale.step}
          display={settings.terrainScale.toFixed(2)}
          onChange={(terrainScale) => patch({ terrainScale })}
        />
        <Slider
          label="Terrain Height"
          tip="Controls the vertical amplitude of the rolling terrain surface."
          value={settings.terrainHeight}
          min={VOXEL_LIMITS.terrainHeight.min}
          max={VOXEL_LIMITS.terrainHeight.max}
          step={VOXEL_LIMITS.terrainHeight.step}
          display={`${Math.round(settings.terrainHeight * 100)}%`}
          onChange={(terrainHeight) => patch({ terrainHeight })}
        />
        <Slider
          label="Noise Frequency"
          tip="Controls the horizontal frequency of the coherent terrain features."
          value={settings.noiseFrequency}
          min={VOXEL_LIMITS.noiseFrequency.min}
          max={VOXEL_LIMITS.noiseFrequency.max}
          step={VOXEL_LIMITS.noiseFrequency.step}
          display={settings.noiseFrequency.toFixed(2)}
          onChange={(noiseFrequency) => patch({ noiseFrequency })}
        />
      </Section>

      <Section
        title={title(3, 'Volumetric Caves')}
        hint="3D noise subtracts from interior density. The top surface stays intact."
      >
        <Toggle
          label="Enable Caves"
          tip="Subtracts thresholded coherent 3D noise from the interior density field."
          value={settings.enableCaves}
          onChange={(enableCaves) => patch({ enableCaves })}
        />
        <Slider
          label="Cave Frequency"
          tip="Controls the scale and repetition of internal cave formations."
          value={settings.caveFrequency}
          min={VOXEL_LIMITS.caveFrequency.min}
          max={VOXEL_LIMITS.caveFrequency.max}
          step={VOXEL_LIMITS.caveFrequency.step}
          display={settings.caveFrequency.toFixed(2)}
          disabled={!settings.enableCaves}
          onChange={(caveFrequency) => patch({ caveFrequency })}
        />
        <Slider
          label="Cave Threshold"
          tip="Sets how much of the 3D noise field is selected for excavation."
          value={settings.caveThreshold}
          min={VOXEL_LIMITS.caveThreshold.min}
          max={VOXEL_LIMITS.caveThreshold.max}
          step={VOXEL_LIMITS.caveThreshold.step}
          display={settings.caveThreshold.toFixed(2)}
          disabled={!settings.enableCaves}
          onChange={(caveThreshold) => patch({ caveThreshold })}
        />
        <Slider
          label="Cave Strength"
          tip="Controls how strongly selected 3D noise subtracts from solid density."
          value={settings.caveStrength}
          min={VOXEL_LIMITS.caveStrength.min}
          max={VOXEL_LIMITS.caveStrength.max}
          step={VOXEL_LIMITS.caveStrength.step}
          display={settings.caveStrength.toFixed(2)}
          disabled={!settings.enableCaves}
          onChange={(caveStrength) => patch({ caveStrength })}
        />
      </Section>

      <Section
        title={title(4, 'CSG Operations')}
        hint="Boolean results are computed on the density field, then visualized."
      >
        <Select
          label="CSG Operation"
          tip="Combines the procedural density field with the movable sphere density."
          value={settings.csgOperation}
          options={CSG_OPERATIONS}
          onChange={(csgOperation) => patch({ csgOperation })}
        />
        <Toggle
          label="CSG Sphere Wireframe"
          tip="Shows or hides the movable sphere guide without changing the density operation."
          value={settings.showCsgWireframe}
          onChange={(showCsgWireframe) => patch({ showCsgWireframe })}
        />
        <Slider
          label="Sphere X"
          tip="Moves the CSG sphere along the X axis."
          value={settings.csgX}
          min={VOXEL_LIMITS.csgPosition.min}
          max={VOXEL_LIMITS.csgPosition.max}
          step={VOXEL_LIMITS.csgPosition.step}
          display={settings.csgX.toFixed(2)}
          onChange={(csgX) => patch({ csgX })}
        />
        <Slider
          label="Sphere Y"
          tip="Moves the CSG sphere along the Y axis."
          value={settings.csgY}
          min={VOXEL_LIMITS.csgPosition.min}
          max={VOXEL_LIMITS.csgPosition.max}
          step={VOXEL_LIMITS.csgPosition.step}
          display={settings.csgY.toFixed(2)}
          onChange={(csgY) => patch({ csgY })}
        />
        <Slider
          label="Sphere Z"
          tip="Moves the CSG sphere along the Z axis."
          value={settings.csgZ}
          min={VOXEL_LIMITS.csgPosition.min}
          max={VOXEL_LIMITS.csgPosition.max}
          step={VOXEL_LIMITS.csgPosition.step}
          display={settings.csgZ.toFixed(2)}
          onChange={(csgZ) => patch({ csgZ })}
        />
        <Slider
          label="Blend Strength"
          tip="Controls the transition width between the terrain and sphere in Smooth Union mode."
          value={settings.blendStrength}
          min={VOXEL_LIMITS.blendStrength.min}
          max={VOXEL_LIMITS.blendStrength.max}
          step={VOXEL_LIMITS.blendStrength.step}
          display={settings.blendStrength.toFixed(2)}
          disabled={settings.csgOperation !== 'smoothUnion'}
          onChange={(blendStrength) => patch({ blendStrength })}
        />
        <Slider
          label="Shell Thickness"
          tip="Controls the inward wall thickness retained around the density surface."
          value={settings.shellThickness}
          min={VOXEL_LIMITS.shellThickness.min}
          max={VOXEL_LIMITS.shellThickness.max}
          step={VOXEL_LIMITS.shellThickness.step}
          display={settings.shellThickness.toFixed(3)}
          disabled={settings.csgOperation !== 'shell'}
          onChange={(shellThickness) => patch({ shellThickness })}
        />
      </Section>

      <Section
        title={title(5, 'Marching Cubes')}
        hint="Turn Show Surface on and keep Meshing Method on Marching Cubes."
        open
      >
        <Toggle
          label="Show Voxels"
          tip="Renders solid density cells as instanced cubes."
          value={settings.showVoxels}
          onChange={(showVoxels) => patch({ showVoxels })}
        />
        <Toggle
          label="Show Surface"
          tip="Renders the selected meshing algorithm from the same density field."
          value={settings.showMarchingCubes}
          onChange={(showMarchingCubes) => patch({ showMarchingCubes })}
        />
      </Section>

      <Section
        title={title(6, 'Resolution Comparison')}
        hint="Switch Low / Medium / High and compare voxel stair-steps against the surface mesh."
      >
        <Select
          label="Voxel Resolution"
          tip="Selects a safe sample-grid preset for comparing quality and generation cost."
          value={String(settings.resolution)}
          options={RESOLUTION_PRESETS}
          onChange={(resolution) => {
            const nextResolution = Number(resolution)
            patch({
              resolution: nextResolution,
              chunkSize: compatibleChunkSize(nextResolution, settings.chunkSize),
            })
          }}
        />
      </Section>

      <Section
        title={title(7, 'Chunking')}
        hint="The volume is split into independent 3D regions. Enable boundaries, then move a CSG sphere."
      >
        <Select
          label="Chunk Size"
          tip="Edge length of each independently stored and remeshed spatial region."
          value={String(settings.chunkSize)}
          options={chunkSizeOptions(settings.resolution)}
          onChange={(chunkSize) => patch({ chunkSize: Number(chunkSize) })}
        />
        <Toggle
          label="Show Chunk Boundaries"
          tip="Displays the independent spatial regions used for voxel and mesh generation."
          value={settings.showChunkBoundaries}
          onChange={(showChunkBoundaries) => patch({ showChunkBoundaries })}
        />
      </Section>

      <Section title={title(8, 'Performance / Optimization')} open={assignmentView}>
        <div className="telemetry-grid voxel-debug" aria-label="Voxel performance statistics">
          <DebugReadout
            label="Total voxels / samples"
            value={`${count(debug.solidVoxelCount)} / ${count(debug.sampleCount)}`}
          />
          <DebugReadout
            label="Active chunks"
            value={`${count(debug.activeChunks)} / ${count(debug.chunkCount)}`}
          />
          <DebugReadout label="Total chunks" value={count(debug.chunkCount)} />
          <DebugReadout label="Triangle count" value={count(debug.meshTriangleCount)} />
          <DebugReadout
            label="Last generation time"
            value={`${debug.updateTime.toFixed(1)} ms`}
          />
          <DebugReadout
            label="Chunks updated"
            value={`${count(debug.chunksUpdated)} / ${count(debug.chunkCount)}`}
          />
        </div>
      </Section>

      <Section
        title={title(9, 'Alternative Meshing Methods')}
        hint="Voxel cubes stay the same. The dropdown only changes the extracted surface mesh."
      >
        <Select
          label="Meshing Method"
          tip="Chooses how the shared scalar density field is converted into triangles."
          value={settings.meshingMethod}
          options={MESHING_METHODS}
          onChange={(meshingMethod) =>
            patch({
              meshingMethod,
              showMarchingCubes: true,
              showVoxels: false,
            })
          }
        />
        <div className="telemetry-row meshing-current">
          <span>Current implementation</span>
          <span>
            {MESHING_METHODS.find((item) => item.id === settings.meshingMethod)?.label}
          </span>
        </div>
        <article className={`meshing-method${settings.meshingMethod === 'marchingCubes' ? ' is-current' : ''}`}>
          <h3>Marching Cubes</h3>
          <p>Smooth continuous surfaces.</p>
          <p>Well suited for density fields.</p>
          <p>Can produce relatively high polygon counts.</p>
        </article>
        <article className={`meshing-method${settings.meshingMethod === 'greedy' ? ' is-current' : ''}`}>
          <h3>Greedy Meshing</h3>
          <p>Combines adjacent voxel faces.</p>
          <p>Efficient for block-style voxel worlds.</p>
          <p>Best suited to Minecraft-like geometry.</p>
        </article>
        <article className={`meshing-method${settings.meshingMethod === 'surfaceNets' ? ' is-current' : ''}`}>
          <h3>Surface Nets</h3>
          <p>Places approximately one vertex per intersected cell.</p>
          <p>Often produces fewer polygons than Marching Cubes.</p>
          <p>Useful for smoother voxel surfaces.</p>
        </article>
        <article className={`meshing-method${settings.meshingMethod === 'dualContouring' ? ' is-current' : ''}`}>
          <h3>Dual Contouring</h3>
          <p>Can preserve sharp features better.</p>
          <p>Useful when surface normals or Hermite data are available.</p>
          <p>More complex implementation.</p>
        </article>
      </Section>
    </ControlPanel>
  )
}
