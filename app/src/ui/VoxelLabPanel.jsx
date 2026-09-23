import { DENSITY_MODES, VOXEL_LIMITS } from '../voxel/settings.js'
import { ControlPanel, Select, Slider, Toggle } from './Controls.jsx'

export default function VoxelLabPanel({ settings, onChange }) {
  const patch = (change) => onChange({ ...settings, ...change })

  return (
    <ControlPanel title="Voxel lab" hint="procedural scalar density fields">
      <Select
        label="Density Mode"
        tip="Selects the scalar field used to classify solid and empty cells."
        value={settings.densityMode}
        options={DENSITY_MODES}
        onChange={(densityMode) => patch({ densityMode })}
      />
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
      <Slider
        label="Voxel Resolution"
        tip="Number of cells along each axis of the cubic density volume."
        value={settings.resolution}
        min={VOXEL_LIMITS.resolution.min}
        max={VOXEL_LIMITS.resolution.max}
        step={VOXEL_LIMITS.resolution.step}
        display={`${settings.resolution}³`}
        onChange={(resolution) => patch({ resolution })}
      />
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
    </ControlPanel>
  )
}
