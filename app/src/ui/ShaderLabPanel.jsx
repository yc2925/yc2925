import { ColorField, ControlPanel, Select, Slider, Toggle } from './Controls.jsx'
import {
  POSITION_AXES,
  SHADER_STRATEGIES,
  STONE_PRESETS,
  TEST_GEOMETRIES,
  applyStonePreset,
  resetShaderParams,
} from '../shaders/settings.js'

export default function ShaderLabPanel({ settings, onChange }) {
  const patch = (change) => onChange({ ...settings, ...change })
  const patchGroup = (group, change) =>
    onChange({ ...settings, [group]: { ...settings[group], ...change } })

  return (
    <ControlPanel title="Shader lab" hint="vegetal facade studies · real-time uniforms">
      <Select
        label="Test Geometry"
        tip="Plane for materials, sphere for lighting, relief for carved depth, vegetal for branching ornament."
        value={settings.geometry}
        options={TEST_GEOMETRIES}
        onChange={(geometry) => patch({ geometry })}
      />
      <Select
        label="Shader Strategy"
        tip="One experiment at a time. Baseline is the unmodified comparison surface."
        value={settings.strategy}
        options={SHADER_STRATEGIES}
        onChange={(strategy) => patch({ strategy })}
      />
      <Toggle
        label="Rotate Model"
        tip="Slowly turns the study object so lighting and growth can be read from more than one angle."
        value={settings.rotateModel}
        onChange={(rotateModel) => patch({ rotateModel })}
      />
      <Toggle
        label="Compare"
        tip="Left: baseline. Right: current shader. Same geometry and orbit."
        value={settings.compare}
        onChange={(compare) => patch({ compare })}
      />
      <button
        type="button"
        className="action-button"
        onClick={() => onChange(resetShaderParams(settings))}
      >
        Reset Shader
      </button>

      {settings.strategy === 'baseline' ? (
        <>
          <ColorField
            label="Base Color"
            tip="Neutral ground color before any study shader."
            value={settings.baseline.baseColor}
            onChange={(baseColor) => patchGroup('baseline', { baseColor })}
          />
          <Slider
            label="Roughness"
            tip="Higher reads as unpolished stone; lower as a tighter highlight."
            value={settings.baseline.roughness}
            min={0}
            max={1}
            step={0.01}
            display={settings.baseline.roughness.toFixed(2)}
            onChange={(roughness) => patchGroup('baseline', { roughness })}
          />
          <Slider
            label="Metalness"
            tip="Keep near zero for masonry. Included so the baseline stays a complete standard material."
            value={settings.baseline.metalness}
            min={0}
            max={1}
            step={0.01}
            display={settings.baseline.metalness.toFixed(2)}
            onChange={(metalness) => patchGroup('baseline', { metalness })}
          />
        </>
      ) : null}

      {settings.strategy === 'relief' ? (
        <>
          <Slider
            label="Relief Contrast"
            tip="Hardens the raised / recessed split under raking light."
            value={settings.relief.reliefContrast}
            min={0}
            max={1}
            step={0.01}
            display={settings.relief.reliefContrast.toFixed(2)}
            onChange={(reliefContrast) => patchGroup('relief', { reliefContrast })}
          />
          <Slider
            label="Depth Intensity"
            tip="How strongly baked extrusion depth tints the surface."
            value={settings.relief.depthIntensity}
            min={0}
            max={1}
            step={0.01}
            display={settings.relief.depthIntensity.toFixed(2)}
            onChange={(depthIntensity) => patchGroup('relief', { depthIntensity })}
          />
          <Slider
            label="Light X"
            tip="Raking light direction, X."
            value={settings.relief.lightX}
            min={-1}
            max={1}
            step={0.01}
            display={settings.relief.lightX.toFixed(2)}
            onChange={(lightX) => patchGroup('relief', { lightX })}
          />
          <Slider
            label="Light Y"
            tip="Raking light direction, Y."
            value={settings.relief.lightY}
            min={-1}
            max={1}
            step={0.01}
            display={settings.relief.lightY.toFixed(2)}
            onChange={(lightY) => patchGroup('relief', { lightY })}
          />
          <Slider
            label="Light Z"
            tip="Raking light direction, Z."
            value={settings.relief.lightZ}
            min={-1}
            max={1}
            step={0.01}
            display={settings.relief.lightZ.toFixed(2)}
            onChange={(lightZ) => patchGroup('relief', { lightZ })}
          />
          <Slider
            label="Shadow Emphasis"
            tip="How far cavities go toward black."
            value={settings.relief.shadowEmphasis}
            min={0}
            max={1}
            step={0.01}
            display={settings.relief.shadowEmphasis.toFixed(2)}
            onChange={(shadowEmphasis) => patchGroup('relief', { shadowEmphasis })}
          />
        </>
      ) : null}

      {settings.strategy === 'stone' ? (
        <>
          <Select
            label="Material Preset"
            tip="Starting points only. Parameters stay editable after a preset is applied."
            value={settings.stone.preset}
            options={STONE_PRESETS}
            onChange={(preset) =>
              onChange({ ...settings, stone: applyStonePreset(settings.stone, preset) })
            }
          />
          <ColorField
            label="Base Color"
            tip="Ground hue of the stone body."
            value={settings.stone.baseColor}
            onChange={(baseColor) => patchGroup('stone', { baseColor, preset: 'custom' })}
          />
          <Slider
            label="Grain Scale"
            tip="Spatial frequency of procedural grain and veins."
            value={settings.stone.grainScale}
            min={0.5}
            max={18}
            step={0.1}
            display={settings.stone.grainScale.toFixed(1)}
            onChange={(grainScale) => patchGroup('stone', { grainScale, preset: 'custom' })}
          />
          <Slider
            label="Grain Strength"
            tip="How visible the grain is against the base color."
            value={settings.stone.grainStrength}
            min={0}
            max={1}
            step={0.01}
            display={settings.stone.grainStrength.toFixed(2)}
            onChange={(grainStrength) => patchGroup('stone', { grainStrength, preset: 'custom' })}
          />
          <Slider
            label="Roughness"
            tip="Tight marble highlight vs open limestone."
            value={settings.stone.roughness}
            min={0}
            max={1}
            step={0.01}
            display={settings.stone.roughness.toFixed(2)}
            onChange={(roughness) => patchGroup('stone', { roughness, preset: 'custom' })}
          />
          <Slider
            label="Color Variation"
            tip="Mineral tint range across the surface."
            value={settings.stone.colorVariation}
            min={0}
            max={0.4}
            step={0.01}
            display={settings.stone.colorVariation.toFixed(2)}
            onChange={(colorVariation) => patchGroup('stone', { colorVariation, preset: 'custom' })}
          />
          <Slider
            label="Weathering"
            tip="Dirt and darkening in recesses and less-exposed faces."
            value={settings.stone.weathering}
            min={0}
            max={1}
            step={0.01}
            display={settings.stone.weathering.toFixed(2)}
            onChange={(weathering) => patchGroup('stone', { weathering, preset: 'custom' })}
          />
        </>
      ) : null}

      {settings.strategy === 'curvature' ? (
        <>
          <Slider
            label="Edge Intensity"
            tip="Brightens convex ridges from screen-space normal change."
            value={settings.curvature.edgeIntensity}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.curvature.edgeIntensity.toFixed(2)}
            onChange={(edgeIntensity) => patchGroup('curvature', { edgeIntensity })}
          />
          <Slider
            label="Cavity Intensity"
            tip="Darkens concave regions."
            value={settings.curvature.cavityIntensity}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.curvature.cavityIntensity.toFixed(2)}
            onChange={(cavityIntensity) => patchGroup('curvature', { cavityIntensity })}
          />
          <Slider
            label="Curvature Scale"
            tip="Sensitivity of the derivative approximation."
            value={settings.curvature.curvatureScale}
            min={0.2}
            max={4}
            step={0.05}
            display={settings.curvature.curvatureScale.toFixed(2)}
            onChange={(curvatureScale) => patchGroup('curvature', { curvatureScale })}
          />
          <Slider
            label="Contrast"
            tip="Graphic strength of the curvature bias."
            value={settings.curvature.contrast}
            min={0}
            max={1}
            step={0.01}
            display={settings.curvature.contrast.toFixed(2)}
            onChange={(contrast) => patchGroup('curvature', { contrast })}
          />
        </>
      ) : null}

      {settings.strategy === 'growth' ? (
        <>
          <Slider
            label="Growth Progress"
            tip="0 hides the ornament; 1 reveals the full structure along baked growth."
            value={settings.growth.progress}
            min={0}
            max={1}
            step={0.001}
            display={settings.growth.progress.toFixed(2)}
            onChange={(progress) => patchGroup('growth', { progress })}
          />
          <Slider
            label="Growth Edge Width"
            tip="Thickness of the live growth front."
            value={settings.growth.edgeWidth}
            min={0.01}
            max={0.25}
            step={0.005}
            display={settings.growth.edgeWidth.toFixed(3)}
            onChange={(edgeWidth) => patchGroup('growth', { edgeWidth })}
          />
          <Slider
            label="Growth Contrast"
            tip="Brightness of the traveling front."
            value={settings.growth.contrast}
            min={0}
            max={2}
            step={0.01}
            display={settings.growth.contrast.toFixed(2)}
            onChange={(contrast) => patchGroup('growth', { contrast })}
          />
          <ColorField
            label="Growth Color"
            tip="Color of revealed ornament."
            value={settings.growth.growthColor}
            onChange={(growthColor) => patchGroup('growth', { growthColor })}
          />
          <ColorField
            label="Dormant Color"
            tip="Color of geometry not yet grown."
            value={settings.growth.dormantColor}
            onChange={(dormantColor) => patchGroup('growth', { dormantColor })}
          />
          <Toggle
            label="Auto Grow"
            tip="Animates Growth Progress continuously."
            value={settings.growth.autoGrow}
            onChange={(autoGrow) => patchGroup('growth', { autoGrow })}
          />
          <Slider
            label="Growth Speed"
            tip="Playback rate while Auto Grow is on."
            value={settings.growth.speed}
            min={0.02}
            max={0.8}
            step={0.01}
            display={settings.growth.speed.toFixed(2)}
            onChange={(speed) => patchGroup('growth', { speed })}
          />
        </>
      ) : null}

      {settings.strategy === 'position' ? (
        <>
          <Select
            label="Axis"
            tip="World-space axis used when Anchor Mode is off."
            value={settings.position.axis}
            options={POSITION_AXES}
            onChange={(axis) => patchGroup('position', { axis })}
          />
          <Slider
            label="Gradient Scale"
            tip="How quickly color changes with position."
            value={settings.position.gradientScale}
            min={0.05}
            max={1.5}
            step={0.01}
            display={settings.position.gradientScale.toFixed(2)}
            onChange={(gradientScale) => patchGroup('position', { gradientScale })}
          />
          <Slider
            label="Gradient Contrast"
            tip="Soft mix vs a harder spatial cut."
            value={settings.position.gradientContrast}
            min={0}
            max={1}
            step={0.01}
            display={settings.position.gradientContrast.toFixed(2)}
            onChange={(gradientContrast) => patchGroup('position', { gradientContrast })}
          />
          <Slider
            label="Gradient Offset"
            tip="Shifts the gradient along the chosen axis or radius."
            value={settings.position.gradientOffset}
            min={-1}
            max={1.5}
            step={0.01}
            display={settings.position.gradientOffset.toFixed(2)}
            onChange={(gradientOffset) => patchGroup('position', { gradientOffset })}
          />
          <ColorField
            label="Color A"
            tip="Color at the low end of the gradient."
            value={settings.position.colorA}
            onChange={(colorA) => patchGroup('position', { colorA })}
          />
          <ColorField
            label="Color B"
            tip="Color at the high end of the gradient."
            value={settings.position.colorB}
            onChange={(colorB) => patchGroup('position', { colorB })}
          />
          <Toggle
            label="Anchor Mode"
            tip="Use distance from an adjustable architectural point instead of an axis."
            value={settings.position.anchorMode}
            onChange={(anchorMode) => patchGroup('position', { anchorMode })}
          />
          <Slider
            label="Anchor X"
            tip="World-space anchor, X."
            value={settings.position.anchorX}
            min={-2}
            max={2}
            step={0.01}
            display={settings.position.anchorX.toFixed(2)}
            onChange={(anchorX) => patchGroup('position', { anchorX })}
          />
          <Slider
            label="Anchor Y"
            tip="World-space anchor, Y."
            value={settings.position.anchorY}
            min={-2}
            max={2}
            step={0.01}
            display={settings.position.anchorY.toFixed(2)}
            onChange={(anchorY) => patchGroup('position', { anchorY })}
          />
          <Slider
            label="Anchor Z"
            tip="World-space anchor, Z."
            value={settings.position.anchorZ}
            min={-2}
            max={2}
            step={0.01}
            display={settings.position.anchorZ.toFixed(2)}
            onChange={(anchorZ) => patchGroup('position', { anchorZ })}
          />
        </>
      ) : null}

      {settings.strategy === 'illumination' ? (
        <>
          <Slider
            label="Light X"
            tip="Directional light, X."
            value={settings.illumination.lightX}
            min={-1}
            max={1}
            step={0.01}
            display={settings.illumination.lightX.toFixed(2)}
            onChange={(lightX) => patchGroup('illumination', { lightX })}
          />
          <Slider
            label="Light Y"
            tip="Directional light, Y."
            value={settings.illumination.lightY}
            min={-1}
            max={1}
            step={0.01}
            display={settings.illumination.lightY.toFixed(2)}
            onChange={(lightY) => patchGroup('illumination', { lightY })}
          />
          <Slider
            label="Light Z"
            tip="Directional light, Z."
            value={settings.illumination.lightZ}
            min={-1}
            max={1}
            step={0.01}
            display={settings.illumination.lightZ.toFixed(2)}
            onChange={(lightZ) => patchGroup('illumination', { lightZ })}
          />
          <Slider
            label="Light Intensity"
            tip="Brightness of the directional term."
            value={settings.illumination.lightIntensity}
            min={0}
            max={3}
            step={0.01}
            display={settings.illumination.lightIntensity.toFixed(2)}
            onChange={(lightIntensity) => patchGroup('illumination', { lightIntensity })}
          />
          <Slider
            label="Rim Intensity"
            tip="Strength of silhouette / grazing light."
            value={settings.illumination.rimIntensity}
            min={0}
            max={4}
            step={0.01}
            display={settings.illumination.rimIntensity.toFixed(2)}
            onChange={(rimIntensity) => patchGroup('illumination', { rimIntensity })}
          />
          <Slider
            label="Rim Width"
            tip="How tight the rim sits on the silhouette."
            value={settings.illumination.rimWidth}
            min={0.4}
            max={8}
            step={0.05}
            display={settings.illumination.rimWidth.toFixed(2)}
            onChange={(rimWidth) => patchGroup('illumination', { rimWidth })}
          />
          <Slider
            label="Falloff"
            tip="Exponent on N·L. Higher is a harder, more theatrical key."
            value={settings.illumination.falloff}
            min={0.2}
            max={5}
            step={0.05}
            display={settings.illumination.falloff.toFixed(2)}
            onChange={(falloff) => patchGroup('illumination', { falloff })}
          />
          <ColorField
            label="Light Color"
            tip="Color of the key and rim. Presentation, not a physical sun."
            value={settings.illumination.lightColor}
            onChange={(lightColor) => patchGroup('illumination', { lightColor })}
          />
          <ColorField
            label="Surface Color"
            tip="Albedo of the ornament under this lighting study."
            value={settings.illumination.surfaceColor}
            onChange={(surfaceColor) => patchGroup('illumination', { surfaceColor })}
          />
        </>
      ) : null}
    </ControlPanel>
  )
}
