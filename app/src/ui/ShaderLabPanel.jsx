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
    <ControlPanel title="Shader lab" hint="architectural specimen · latent growth">
      <Select
        label="Test Geometry"
        tip="Architectural Specimen is the main study object. Organic Rock is kept as the previous experiment; plane, sphere, relief, and vegetal remain as shader tests."
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

      {settings.geometry === 'specimen' ? (
        <details className="control-section" open>
          <summary>Specimen Form</summary>
          <div className="section-controls">
            <Slider
              label="Form Seed"
              tip="Repeatable specimen. Same seed and sliders always produce the same object."
              value={settings.specimen.seed}
              min={1}
              max={48}
              step={1}
              display={String(settings.specimen.seed)}
              onChange={(seed) => patchGroup('specimen', { seed: Math.round(seed) })}
            />
            <Slider
              label="Verticality"
              tip="Overall height against a fixed footprint. The zones (base, portal, cage, crown) keep their proportions."
              value={settings.specimen.verticality}
              min={0}
              max={1}
              step={0.01}
              display={settings.specimen.verticality.toFixed(2)}
              onChange={(verticality) => patchGroup('specimen', { verticality })}
            />
            <Slider
              label="Architectural Order"
              tip="Low: rounded, leaning, irregular members. High: rectangular sections, pointed arches, regular rib spacing, more archivolts."
              value={settings.specimen.order}
              min={0}
              max={1}
              step={0.01}
              display={settings.specimen.order.toFixed(2)}
              onChange={(order) => patchGroup('specimen', { order })}
            />
            <Slider
              label="Organic Deformation"
              tip="Bend, twist and low-frequency warp. Stronger toward the crown, so the base stays architectural."
              value={settings.specimen.deformation}
              min={0}
              max={1}
              step={0.01}
              display={settings.specimen.deformation.toFixed(2)}
              onChange={(deformation) => patchGroup('specimen', { deformation })}
            />
            <Slider
              label="Erosion"
              tip="Pits and worn zones cut along each surface; breaks ribs and adds crown fragments."
              value={settings.specimen.erosion}
              min={0}
              max={1}
              step={0.01}
              display={settings.specimen.erosion.toFixed(2)}
              onChange={(erosion) => patchGroup('specimen', { erosion })}
            />
            <Slider
              label="Branching"
              tip="Bifurcation depth of the crown ribs and density of vein channels on the masses."
              value={settings.specimen.branching}
              min={0}
              max={1}
              step={0.01}
              display={settings.specimen.branching.toFixed(2)}
              onChange={(branching) => patchGroup('specimen', { branching })}
            />
            <Slider
              label="Void Scale"
              tip="Width of the portal passage, gaps between ledges, and how much the central mass withdraws."
              value={settings.specimen.voidScale}
              min={0}
              max={1}
              step={0.01}
              display={settings.specimen.voidScale.toFixed(2)}
              onChange={(voidScale) => patchGroup('specimen', { voidScale })}
            />
            <Slider
              label="Layer Separation"
              tip="Restrained exploded view. Each component moves along its own layer vector in the vertex shader — no rebuild."
              value={settings.specimen.layerSeparation}
              min={0}
              max={0.4}
              step={0.005}
              display={settings.specimen.layerSeparation.toFixed(3)}
              onChange={(layerSeparation) => patchGroup('specimen', { layerSeparation })}
            />
            <Slider
              label="Surface Detail"
              tip="Shader-level micro grain, pitting and tool lines (normal perturbation). Does not change the geometry."
              value={settings.specimen.surfaceDetail}
              min={0}
              max={1}
              step={0.01}
              display={settings.specimen.surfaceDetail.toFixed(2)}
              onChange={(surfaceDetail) => patchGroup('specimen', { surfaceDetail })}
            />
          </div>
        </details>
      ) : null}

      {settings.geometry === 'rock' ? (
        <details className="control-section" open>
          <summary>Form</summary>
          <div className="section-controls">
            <Slider
              label="Form Seed"
              tip="Repeatable geological specimen. Same seed always produces the same rock."
              value={settings.form.seed}
              min={1}
              max={48}
              step={1}
              display={String(settings.form.seed)}
              onChange={(seed) => patchGroup('form', { seed: Math.round(seed) })}
            />
            <Slider
              label="Mass Variation"
              tip="Large-scale silhouette deformation. Low frequency only."
              value={settings.form.massVariation}
              min={0.15}
              max={0.95}
              step={0.01}
              display={settings.form.massVariation.toFixed(2)}
              onChange={(massVariation) => patchGroup('form', { massVariation })}
            />
            <Slider
              label="Erosion"
              tip="Rounded cavities and weathered undersides. Does not punch holes through the mass."
              value={settings.form.erosion}
              min={0}
              max={0.9}
              step={0.01}
              display={settings.form.erosion.toFixed(2)}
              onChange={(erosion) => patchGroup('form', { erosion })}
            />
            <Slider
              label="Surface Roughness"
              tip="Fine surface grain only. Does not change the silhouette."
              value={settings.form.surfaceRoughness}
              min={0}
              max={0.8}
              step={0.01}
              display={settings.form.surfaceRoughness.toFixed(2)}
              onChange={(surfaceRoughness) => patchGroup('form', { surfaceRoughness })}
            />
            <Slider
              label="Growth Complexity"
              tip="Density of latent veins, corridors, and branching in the growth field."
              value={settings.form.growthComplexity}
              min={0.1}
              max={0.95}
              step={0.01}
              display={settings.form.growthComplexity.toFixed(2)}
              onChange={(growthComplexity) => patchGroup('form', { growthComplexity })}
            />
          </div>
        </details>
      ) : null}

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
            tip="0 is geological stone. Higher values reveal veins, then connecting paths, then branching organization."
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

      {settings.strategy === 'scan' ? (
        <>
          <Slider
            label="Line Intensity"
            tip="Brightness of structural lines and section contours."
            value={settings.scan.lineIntensity}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.scan.lineIntensity.toFixed(2)}
            onChange={(lineIntensity) => patchGroup('scan', { lineIntensity })}
          />
          <Slider
            label="Surface Opacity"
            tip="How much shaded surface each layer adds. Low values make inner components legible."
            value={settings.scan.surfaceOpacity}
            min={0}
            max={1}
            step={0.01}
            display={settings.scan.surfaceOpacity.toFixed(2)}
            onChange={(surfaceOpacity) => patchGroup('scan', { surfaceOpacity })}
          />
          <Slider
            label="Depth Fade"
            tip="Fades layers behind the object's center so front structure reads first."
            value={settings.scan.depthFade}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.scan.depthFade.toFixed(2)}
            onChange={(depthFade) => patchGroup('scan', { depthFade })}
          />
          <Slider
            label="Edge Contrast"
            tip="Silhouette and crease response. Pulls out ribs, arches and thin members."
            value={settings.scan.edgeContrast}
            min={0}
            max={1}
            step={0.01}
            display={settings.scan.edgeContrast.toFixed(2)}
            onChange={(edgeContrast) => patchGroup('scan', { edgeContrast })}
          />
          <Slider
            label="Scan Density"
            tip="Spacing of structural lines and horizontal section contours (lines per unit)."
            value={settings.scan.scanDensity}
            min={2}
            max={24}
            step={0.5}
            display={settings.scan.scanDensity.toFixed(1)}
            onChange={(scanDensity) => patchGroup('scan', { scanDensity })}
          />
        </>
      ) : null}
    </ControlPanel>
  )
}
