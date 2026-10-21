import { ControlPanel, Select, Slider, Toggle, ColorField } from './Controls.jsx'
import {
  ACTIVE_TYPOLOGIES,
  displayModesForTypology,
  resetGothic,
} from '../gothic/settings.js'
import { DESIGN_LAYERS, TRACERY_FAMILIES } from '../gothic/typologies/windowDesign2d.js'
import { TRACERY_PRESETS, applyPreset, regenerateSeed, presetById } from '../gothic/typologies/presets.js'
import { MOLDING_PROFILE_OPTIONS } from '../gothic/profiles.js'

export default function GothicArchitecturePanel({ settings, onChange, onTypology }) {
  const isWindow = settings.typology === 'window'
  const displayOptions = displayModesForTypology(settings.typology)
  const showDesignLayers = isWindow && settings.displayMode === 'design'
  const activePreset = settings.activePreset ?? 'geo-twin-trefoil'

  const patch = (change) => {
    const next = { ...settings, ...change }
    if (change.structuralComplexity != null) next.structuralDensity = change.structuralComplexity
    if (change.traceryComplexity != null) next.ornamentDensity = change.traceryComplexity
    if (change.lancetCount != null) next.bayCount = change.lancetCount
    if (change.moldingComplexity != null) next.moldingLayers = change.moldingComplexity
    if (change.subdivisionComplexity != null) next.cuspingComplexity = change.subdivisionComplexity
    if (change.cuspingComplexity != null && change.subdivisionComplexity == null) {
      next.subdivisionComplexity = change.cuspingComplexity
    }
    onChange(next)
  }

  const patchLayer = (id, value) => {
    patch({
      designLayers: {
        ...(settings.designLayers ?? {}),
        [id]: value,
      },
    })
  }

  const onPreset = (presetId) => {
    onChange(applyPreset(settings, presetId))
  }

  return (
    <ControlPanel
      title="Gothic Architecture"
      hint={
        isWindow
          ? 'phase 4 · tracery families · carved limestone'
          : 'step 6 · portal / façade assemblies · shared modules'
      }
    >
      <Select
        label="Typology"
        tip="Architectural grammar family. Each typology is a different composition."
        value={settings.typology}
        options={ACTIVE_TYPOLOGIES.map(({ id, label }) => ({ id, label }))}
        onChange={onTypology}
      />
      <Select
        label="Display"
        tip={
          isWindow
            ? 'Solid / Wireframe: stone. Skeleton: exact solid centerlines. 2D Design: flat curve graph.'
            : 'Solid: stone mass. Wireframe: triangles.'
        }
        value={settings.displayMode}
        options={displayOptions}
        onChange={(displayMode) => patch({ displayMode })}
      />
      <button type="button" className="action-button" onClick={() => onChange(resetGothic(settings.typology))}>
        Reset Typology
      </button>

      {isWindow ? (
        <>
          <details className="control-section" open>
            <summary>Tracery Family</summary>
            <div className="section-controls">
              <Select
                label="Tracery Family"
                tip="Composition grammar. Geometric, Rayonnant, and Flamboyant each rebuild the 2D curve network."
                value={settings.traceryFamily ?? 'geometric'}
                options={TRACERY_FAMILIES.map(({ id, label }) => ({ id, label }))}
                onChange={(traceryFamily) => patch({ traceryFamily })}
              />
              <Select
                label="Preset"
                tip="Curated compositions (two per family). Applies family, params, and seed."
                value={activePreset}
                options={TRACERY_PRESETS.map(({ id, label }) => ({ id, label }))}
                onChange={onPreset}
              />
              <button
                type="button"
                className="action-button"
                onClick={() => onChange(regenerateSeed(settings))}
              >
                Regenerate
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() => onChange(applyPreset(settings, activePreset || 'geo-twin-trefoil'))}
              >
                Reset to Preset
              </button>
              <p className="meshing-hint">
                {presetById(activePreset || 'geo-twin-trefoil').note}
              </p>
            </div>
          </details>

          <details className="control-section" open>
            <summary>Composition (2D)</summary>
            <div className="section-controls">
              <Slider
                label="Window Aspect Ratio"
                tip="Height ÷ width. Changes 2D topology proportions."
                value={settings.windowAspect ?? 1.9}
                min={1.3}
                max={2.6}
                step={0.05}
                display={(settings.windowAspect ?? 1.9).toFixed(2)}
                onChange={(windowAspect) => patch({ windowAspect })}
              />
              <Slider
                label="Lancet Count"
                tip="Number of primary lights (2–4). Reorganizes lower subdivisions."
                value={settings.lancetCount ?? 2}
                min={2}
                max={4}
                step={1}
                display={String(Math.round(settings.lancetCount ?? 2))}
                onChange={(lancetCount) => patch({ lancetCount: Math.round(lancetCount) })}
              />
              <Slider
                label="Upper Tracery Height"
                tip="Fraction of height reserved for the head / rose."
                value={settings.upperTraceryHeight ?? 0.36}
                min={0.24}
                max={0.46}
                step={0.01}
                display={(settings.upperTraceryHeight ?? 0.36).toFixed(2)}
                onChange={(upperTraceryHeight) => patch({ upperTraceryHeight })}
              />
              <Slider
                label="Subdivision Complexity"
                tip="Number and arrangement of upper tracery cells / foils."
                value={settings.subdivisionComplexity ?? settings.cuspingComplexity ?? 0.5}
                min={0}
                max={1}
                step={0.01}
                display={(settings.subdivisionComplexity ?? settings.cuspingComplexity ?? 0.5).toFixed(2)}
                onChange={(subdivisionComplexity) => patch({ subdivisionComplexity })}
              />
              <Slider
                label="Curvature"
                tip="Pointedness of arches and ornamental inflection."
                value={settings.curvature ?? 0.55}
                min={0}
                max={1}
                step={0.01}
                display={(settings.curvature ?? 0.55).toFixed(2)}
                onChange={(curvature) => patch({ curvature })}
              />
              <Slider
                label="Variation Seed"
                tip="Selects among valid composition strategies within the family."
                value={settings.variationSeed ?? 7}
                min={1}
                max={99}
                step={1}
                display={String(Math.round(settings.variationSeed ?? 7))}
                onChange={(variationSeed) => patch({ variationSeed: Math.round(variationSeed) })}
              />
              <Toggle
                label="Symmetry"
                tip="On: bilateral. Off: controlled asymmetry (Flamboyant especially)."
                value={settings.symmetry !== false}
                onChange={(symmetry) => patch({ symmetry })}
              />
            </div>
          </details>

          <details className="control-section" open>
            <summary>Stone (3D)</summary>
            <div className="section-controls">
              <Slider
                label="Profile Thickness"
                tip="Bar cross-section scale. Does not change 2D centerlines."
                value={settings.profileThickness ?? 0.055}
                min={0.03}
                max={0.1}
                step={0.005}
                display={(settings.profileThickness ?? 0.055).toFixed(3)}
                onChange={(profileThickness) => patch({ profileThickness })}
              />
              <Slider
                label="Architectural Depth"
                tip="Base wall-depth of profiles."
                value={settings.architecturalDepth ?? 0.14}
                min={0.06}
                max={0.28}
                step={0.01}
                display={(settings.architecturalDepth ?? 0.14).toFixed(2)}
                onChange={(architecturalDepth) => patch({ architecturalDepth })}
              />
              <Slider
                label="Molding Complexity"
                tip="Layered molding count on the outer frame (1–4)."
                value={settings.moldingComplexity ?? 2}
                min={1}
                max={4}
                step={1}
                display={String(Math.round(settings.moldingComplexity ?? 2))}
                onChange={(moldingComplexity) => patch({ moldingComplexity: Math.round(moldingComplexity) })}
              />
              <Slider
                label="Detail Resolution"
                tip="Curve sampling and sweep subdivisions."
                value={settings.detailResolution}
                min={0.2}
                max={1}
                step={0.01}
                display={settings.detailResolution.toFixed(2)}
                onChange={(detailResolution) => patch({ detailResolution })}
              />
            </div>
          </details>

          <details className="control-section" open>
            <summary>Detail / Material</summary>
            <div className="section-controls">
              <Select
                label="Molding Profile"
                tip="Cross-section family for swept stone. Applied by role hierarchy."
                value={settings.moldingProfile ?? 'compound'}
                options={MOLDING_PROFILE_OPTIONS}
                onChange={(moldingProfile) => patch({ moldingProfile })}
              />
              <Slider
                label="Molding Depth"
                tip="How deeply profiles sit in the wall direction."
                value={settings.moldingDepth ?? 0.55}
                min={0}
                max={1}
                step={0.01}
                display={(settings.moldingDepth ?? 0.55).toFixed(2)}
                onChange={(moldingDepth) => patch({ moldingDepth })}
              />
              <Slider
                label="Bevel Intensity"
                tip="Chamfer / channel strength on the selected molding family."
                value={settings.bevelIntensity ?? 0.45}
                min={0}
                max={1}
                step={0.01}
                display={(settings.bevelIntensity ?? 0.45).toFixed(2)}
                onChange={(bevelIntensity) => patch({ bevelIntensity })}
              />
              <ColorField
                label="Stone Color"
                tip="Limestone base color."
                value={settings.stoneColor ?? '#c4bfb4'}
                onChange={(stoneColor) => patch({ stoneColor })}
              />
              <Slider
                label="Stone Roughness"
                tip="PBR roughness. Higher = softer, less specular stone."
                value={settings.stoneRoughness ?? 0.78}
                min={0.25}
                max={1}
                step={0.01}
                display={(settings.stoneRoughness ?? 0.78).toFixed(2)}
                onChange={(stoneRoughness) => patch({ stoneRoughness })}
              />
              <Slider
                label="Surface Variation"
                tip="Subtle tone and roughness grain. Does not displace geometry."
                value={settings.surfaceVariation ?? 0.25}
                min={0}
                max={0.7}
                step={0.01}
                display={(settings.surfaceVariation ?? 0.25).toFixed(2)}
                onChange={(surfaceVariation) => patch({ surfaceVariation })}
              />
            </div>
          </details>

          {showDesignLayers ? (
            <details className="control-section" open>
              <summary>Design Layers</summary>
              <div className="section-controls">
                {DESIGN_LAYERS.map((layer) => (
                  <Toggle
                    key={layer.id}
                    label={layer.label}
                    tip={`Show or hide ${layer.label.toLowerCase()} in 2D Design.`}
                    value={settings.designLayers?.[layer.id] !== false}
                    onChange={(on) => patchLayer(layer.id, on)}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <>
          <details className="control-section" open>
            <summary>Composition</summary>
            <div className="section-controls">
              <Slider
                label="Bay Count"
                tip={
                  settings.typology === 'facade'
                    ? 'Odd bay count (3–5). Centre bay hosts the portal assembly.'
                    : 'Portal openings across the wall (1–3).'
                }
                value={settings.bayCount}
                min={settings.typology === 'facade' ? 3 : 1}
                max={settings.typology === 'facade' ? 5 : 3}
                step={1}
                display={String(Math.round(settings.bayCount))}
                onChange={(bayCount) => patch({ bayCount: Math.round(bayCount) })}
              />
              <Slider
                label="Overall Height"
                tip="Total vertical extent."
                value={settings.overallHeight}
                min={3.2}
                max={12}
                step={0.1}
                display={settings.overallHeight.toFixed(1)}
                onChange={(overallHeight) => patch({ overallHeight })}
              />
              <Slider
                label="Overall Width"
                tip="Total horizontal extent."
                value={settings.overallWidth}
                min={2}
                max={14}
                step={0.1}
                display={settings.overallWidth.toFixed(1)}
                onChange={(overallWidth) => patch({ overallWidth })}
              />
              <Slider
                label="Verticality"
                tip="Spring lines, sill height, storey splits (vertical proportion)."
                value={settings.verticalProportion}
                min={0.25}
                max={0.85}
                step={0.01}
                display={settings.verticalProportion.toFixed(2)}
                onChange={(verticalProportion) => patch({ verticalProportion })}
              />
              <Select
                label="Tracery Family"
                tip="Family for embedded tympanum / bay / rose windows (reuses the Window generator)."
                value={settings.traceryFamily ?? 'geometric'}
                options={TRACERY_FAMILIES.map(({ id, label }) => ({ id, label }))}
                onChange={(traceryFamily) => patch({ traceryFamily })}
              />
            </div>
          </details>

          <details className="control-section" open>
            <summary>Detail</summary>
            <div className="section-controls">
              <Slider
                label="Structural Density"
                tip="Archivolt count, column shafts, buttress steps."
                value={settings.structuralComplexity}
                min={0}
                max={1}
                step={0.01}
                display={settings.structuralComplexity.toFixed(2)}
                onChange={(structuralComplexity) => patch({ structuralComplexity })}
              />
              <Slider
                label="Ornament Density"
                tip="Tympanum / gallery / rose tracery richness and pinnacle crockets."
                value={settings.traceryComplexity}
                min={0}
                max={1}
                step={0.01}
                display={settings.traceryComplexity.toFixed(2)}
                onChange={(traceryComplexity) => patch({ traceryComplexity })}
              />
              <Slider
                label="Architectural Depth"
                tip="How deeply archivolts and recesses step into the wall."
                value={settings.architecturalDepth ?? 0.55}
                min={0.25}
                max={1}
                step={0.01}
                display={(settings.architecturalDepth ?? 0.55).toFixed(2)}
                onChange={(architecturalDepth) => patch({ architecturalDepth })}
              />
              <Slider
                label="Molding Layers"
                tip="Hood mould count on main openings (1–5)."
                value={settings.moldingLayers}
                min={1}
                max={5}
                step={1}
                display={String(Math.round(settings.moldingLayers))}
                onChange={(moldingLayers) => patch({ moldingLayers: Math.round(moldingLayers) })}
              />
              <Slider
                label="Detail Resolution"
                tip="Curve tessellation only."
                value={settings.detailResolution}
                min={0.15}
                max={1}
                step={0.01}
                display={settings.detailResolution.toFixed(2)}
                onChange={(detailResolution) => patch({ detailResolution })}
              />
              <Slider
                label="Variation Seed"
                tip="Deterministic layout variants."
                value={settings.variationSeed}
                min={1}
                max={99}
                step={1}
                display={String(Math.round(settings.variationSeed))}
                onChange={(variationSeed) => patch({ variationSeed: Math.round(variationSeed) })}
              />
              <Toggle
                label="Symmetry"
                tip="On: mirrored. Off: seed shifts layout left–right."
                value={settings.symmetry}
                onChange={(symmetry) => patch({ symmetry })}
              />
            </div>
          </details>

          <details className="control-section" open>
            <summary>Detail / Material</summary>
            <div className="section-controls">
              <ColorField
                label="Stone Color"
                tip="Limestone base color."
                value={settings.stoneColor ?? '#c4bfb4'}
                onChange={(stoneColor) => patch({ stoneColor })}
              />
              <Slider
                label="Stone Roughness"
                tip="PBR roughness."
                value={settings.stoneRoughness ?? 0.78}
                min={0.25}
                max={1}
                step={0.01}
                display={(settings.stoneRoughness ?? 0.78).toFixed(2)}
                onChange={(stoneRoughness) => patch({ stoneRoughness })}
              />
              <Slider
                label="Surface Variation"
                tip="Subtle tone and roughness grain."
                value={settings.surfaceVariation ?? 0.25}
                min={0}
                max={0.7}
                step={0.01}
                display={(settings.surfaceVariation ?? 0.25).toFixed(2)}
                onChange={(surfaceVariation) => patch({ surfaceVariation })}
              />
            </div>
          </details>
        </>
      )}
    </ControlPanel>
  )
}
