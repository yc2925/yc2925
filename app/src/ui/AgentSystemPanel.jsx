import { ControlPanel, Select, Slider, Toggle } from './Controls.jsx'
import {
  CONSTRUCTION_DISPLAY_MODES,
  FIELD_DISPLAY_MODES,
  resetAgents,
} from '../agents/settings.js'
import { TRACERY_FAMILIES } from '../gothic/typologies/windowDesign2d.js'
import { TRACERY_PRESETS, applyPreset, presetById } from '../gothic/typologies/presets.js'
import ScaleSection from './ScaleSection.jsx'
import LodSection from './LodSection.jsx'
import { formatMeters, formatMillimeters } from '../scale/units.js'

export default function AgentSystemPanel({
  settings,
  onChange,
  running,
  onStartPause,
  onReset,
  onStep,
  onRegenerate,
  activeLod = null,
}) {
  const patch = (change) => onChange({ ...settings, ...change })

  const onPreset = (presetId) => {
    const next = applyPreset(settings, presetId)
    onChange({
      ...settings,
      ...next,
      archSource: 'window',
      activePreset: presetId,
    })
  }

  return (
    <ControlPanel title="Agent Simulation" hint="step 12a · architectural scale">
      <button type="button" className="action-button" onClick={() => onChange(resetAgents())}>
        Reset All
      </button>

      <ScaleSection
        settings={settings}
        onPatch={patch}
        onFitToObject={() =>
          patch({ fitToObjectToken: (settings.fitToObjectToken ?? 0) + 1 })
        }
        showArchitecturalDims
        open
      />
      <LodSection
        settings={settings}
        onPatch={patch}
        activeLevel={activeLod}
        showFit={false}
        open
      />

      <details className="control-section" open>
        <summary>Architectural Source</summary>
        <div className="section-controls">
          <Select
            label="Tracery Family"
            tip="Same families as Gothic Architecture / Ornament System."
            value={settings.traceryFamily ?? 'geometric'}
            options={TRACERY_FAMILIES.map(({ id, label }) => ({ id, label }))}
            onChange={(traceryFamily) => patch({ traceryFamily })}
          />
          <Select
            label="Preset"
            tip="Curated window presets from the Gothic generator."
            value={settings.activePreset ?? 'geo-twin-trefoil'}
            options={TRACERY_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
            onChange={onPreset}
          />
          <Slider
            label="Architecture Seed"
            tip="Variation seed for the shared window generator."
            value={settings.variationSeed ?? 3}
            min={0}
            max={40}
            step={1}
            display={String(Math.round(settings.variationSeed ?? 3))}
            onChange={(variationSeed) => patch({ variationSeed: Math.round(variationSeed) })}
          />
          <p className="control-hint">
            {presetById(settings.activePreset)?.note ??
              'Agents spawn on growth anchors of this Gothic window.'}
          </p>
        </div>
      </details>

      <details className="control-section" open>
        <summary>Agent System</summary>
        <div className="section-controls">
          <Toggle
            label="Enable Agent Simulation"
            tip="When off, agents stay dormant and do not step."
            value={settings.enableAgentSimulation !== false}
            onChange={(enableAgentSimulation) => patch({ enableAgentSimulation })}
          />
          <Slider
            label="Agent Count"
            tip="Number of agents (bilateral pairs share decisions)."
            value={settings.agentCount ?? 16}
            min={4}
            max={48}
            step={1}
            display={String(Math.round(settings.agentCount ?? 16))}
            onChange={(agentCount) => patch({ agentCount: Math.round(agentCount) })}
          />
          <Slider
            label="Simulation Speed"
            tip="Wall-clock multiplier for the fixed-timestep loop."
            value={settings.simulationSpeed ?? 1}
            min={0.25}
            max={3}
            step={0.05}
            display={(settings.simulationSpeed ?? 1).toFixed(2)}
            onChange={(simulationSpeed) => patch({ simulationSpeed })}
          />
          <Slider
            label="Sensing Radius"
            tip="Local search radius in meters when blocked / re-attaching to the graph."
            value={settings.sensingRadius ?? 0.28}
            min={0.08}
            max={0.6}
            step={0.01}
            display={formatMeters(settings.sensingRadius ?? 0.28, 2)}
            onChange={(sensingRadius) => patch({ sensingRadius })}
          />
          <Slider
            label="Movement Speed"
            tip="Arc-length travel rate along architectural curves (meters / second)."
            value={settings.movementSpeed ?? 0.55}
            min={0.1}
            max={1.4}
            step={0.02}
            display={`${(settings.movementSpeed ?? 0.55).toFixed(2)} m/s`}
            onChange={(movementSpeed) => patch({ movementSpeed })}
          />
          <Slider
            label="Energy Budget"
            tip="Growth / life budget. Exhaustion → COMPLETED."
            value={settings.energyBudget ?? 1.4}
            min={0.4}
            max={4}
            step={0.05}
            display={(settings.energyBudget ?? 1.4).toFixed(2)}
            onChange={(energyBudget) => patch({ energyBudget })}
          />
          <Slider
            label="Random Seed"
            tip="Deterministic agent RNG. Same seed → same outcomes."
            value={settings.agentSeed ?? 42}
            min={0}
            max={999}
            step={1}
            display={String(Math.round(settings.agentSeed ?? 42))}
            onChange={(agentSeed) => patch({ agentSeed: Math.round(agentSeed) })}
          />
          <Toggle
            label="Bilateral Symmetry"
            tip="Paired agents share decisions; positions/directions mirrored."
            value={settings.bilateralSymmetry !== false}
            onChange={(bilateralSymmetry) => patch({ bilateralSymmetry })}
          />
          <Slider
            label="Spawn Threshold"
            tip="Minimum anchor suitability for spawning."
            value={settings.spawnThreshold ?? 0.45}
            min={0}
            max={0.9}
            step={0.01}
            display={(settings.spawnThreshold ?? 0.45).toFixed(2)}
            onChange={(spawnThreshold) => patch({ spawnThreshold })}
          />

          <button type="button" className="action-button" onClick={onStartPause}>
            {running ? 'Pause' : 'Start'}
          </button>
          <button type="button" className="action-button" onClick={onReset}>
            Reset
          </button>
          <button type="button" className="action-button" onClick={onStep}>
            Step One Frame
          </button>
          <button type="button" className="action-button" onClick={onRegenerate}>
            Regenerate
          </button>
        </div>
      </details>

      <details className="control-section" open>
        <summary>Stigmergy</summary>
        <div className="section-controls">
          <Toggle
            label="Enable Stigmergy"
            tip="Agents deposit and sense attraction / inhibition on the curve graph."
            value={settings.enableStigmergy !== false}
            onChange={(enableStigmergy) => patch({ enableStigmergy })}
          />
          <Slider
            label="Attraction Strength"
            tip="FOLLOW: bias toward established promising paths."
            value={settings.attractionStrength ?? 0.55}
            min={0}
            max={1.5}
            step={0.02}
            display={(settings.attractionStrength ?? 0.55).toFixed(2)}
            onChange={(attractionStrength) => patch({ attractionStrength })}
          />
          <Slider
            label="Inhibition Strength"
            tip="AVOID: bias away from overcrowded / recently occupied regions."
            value={settings.inhibitionStrength ?? 0.45}
            min={0}
            max={1.5}
            step={0.02}
            display={(settings.inhibitionStrength ?? 0.45).toFixed(2)}
            onChange={(inhibitionStrength) => patch({ inhibitionStrength })}
          />
          <Slider
            label="Deposition Rate"
            tip="How strongly depositing/building agents write into the field."
            value={settings.depositionRate ?? 0.35}
            min={0}
            max={1}
            step={0.02}
            display={(settings.depositionRate ?? 0.35).toFixed(2)}
            onChange={(depositionRate) => patch({ depositionRate })}
          />
          <Slider
            label="Deposition Radius"
            tip="Graph-local arc-length radius of each deposit."
            value={settings.depositionRadius ?? 0.16}
            min={0.04}
            max={0.4}
            step={0.01}
            display={(settings.depositionRadius ?? 0.16).toFixed(2)}
            onChange={(depositionRadius) => patch({ depositionRadius })}
          />
          <Slider
            label="Signal Decay"
            tip="How quickly attraction / inhibition fade each step."
            value={settings.signalDecay ?? 0.12}
            min={0}
            max={0.6}
            step={0.01}
            display={(settings.signalDecay ?? 0.12).toFixed(2)}
            onChange={(signalDecay) => patch({ signalDecay })}
          />
          <Slider
            label="Signal Diffusion"
            tip="Graph-neighbour mixing along curves and junctions only."
            value={settings.signalDiffusion ?? 0.28}
            min={0}
            max={0.8}
            step={0.02}
            display={(settings.signalDiffusion ?? 0.28).toFixed(2)}
            onChange={(signalDiffusion) => patch({ signalDiffusion })}
          />
          <Slider
            label="Exploration Bias"
            tip="EXPLORE: retain tendency to discover new valid paths."
            value={settings.explorationBias ?? 0.35}
            min={0}
            max={1}
            step={0.02}
            display={(settings.explorationBias ?? 0.35).toFixed(2)}
            onChange={(explorationBias) => patch({ explorationBias })}
          />
        </div>
      </details>

      <details className="control-section" open>
        <summary>Ornament Construction</summary>
        <div className="section-controls">
          <Toggle
            label="Enable Ornament Construction"
            tip="Build swept stone ornament from accepted agent deposit/build paths."
            value={!!settings.enableOrnamentConstruction}
            onChange={(enableOrnamentConstruction) => patch({ enableOrnamentConstruction })}
          />
          <Select
            label="Construction Display"
            tip="Agents, accepted/rejected paths, ornament meshes, or combinations."
            value={settings.constructionDisplayMode ?? 'agents+ornament'}
            options={CONSTRUCTION_DISPLAY_MODES}
            onChange={(constructionDisplayMode) => patch({ constructionDisplayMode })}
          />
          <Slider
            label="Path Acceptance Threshold"
            tip="Higher = stricter pruning of short/redundant/inhibited trails."
            value={settings.pathAcceptanceThreshold ?? 0.42}
            min={0.15}
            max={0.85}
            step={0.02}
            display={(settings.pathAcceptanceThreshold ?? 0.42).toFixed(2)}
            onChange={(pathAcceptanceThreshold) => patch({ pathAcceptanceThreshold })}
          />
          <Slider
            label="Ornament Density"
            tip="Caps accepted path count and overlap tolerance."
            value={settings.ornamentDensity ?? 0.55}
            min={0.15}
            max={1}
            step={0.02}
            display={(settings.ornamentDensity ?? 0.55).toFixed(2)}
            onChange={(ornamentDensity) => patch({ ornamentDensity })}
          />
          <Slider
            label="Branch Complexity"
            tip="Max children per primary stem (hierarchy density)."
            value={settings.branchComplexity ?? 0.45}
            min={0}
            max={1}
            step={0.02}
            display={(settings.branchComplexity ?? 0.45).toFixed(2)}
            onChange={(branchComplexity) => patch({ branchComplexity })}
          />
          <Slider
            label="Primary Thickness"
            tip="Base radius for primary stems (15–60 mm)."
            value={settings.primaryThickness ?? 0.03}
            min={0.015}
            max={0.06}
            step={0.002}
            display={formatMillimeters(settings.primaryThickness ?? 0.03, 0)}
            onChange={(primaryThickness) => patch({ primaryThickness })}
          />
          <Slider
            label="Secondary Thickness"
            tip="Target child radius (8–30 mm) — sets thickness decay vs primary."
            value={settings.secondaryThickness ?? 0.018}
            min={0.008}
            max={0.03}
            step={0.002}
            display={formatMillimeters(settings.secondaryThickness ?? 0.018, 0)}
            onChange={(secondaryThickness) => patch({ secondaryThickness })}
          />
          <Slider
            label="Relief Depth"
            tip="Surface relief projection into stone (5–40 mm)."
            value={settings.constructionReliefDepth ?? 0.014}
            min={0.005}
            max={0.04}
            step={0.002}
            display={formatMillimeters(settings.constructionReliefDepth ?? 0.014, 0)}
            onChange={(constructionReliefDepth) => patch({ constructionReliefDepth })}
          />
          <Slider
            label="Sculptural Emergence"
            tip="How quickly paths lift from relief into free sculpture."
            value={settings.constructionEmergence ?? 0.55}
            min={0}
            max={1}
            step={0.02}
            display={(settings.constructionEmergence ?? 0.55).toFixed(2)}
            onChange={(constructionEmergence) => patch({ constructionEmergence })}
          />
          <Slider
            label="Foliate Detail"
            tip="Limited crocket-like tip flourishes on secondary branches."
            value={settings.foliateDetail ?? 0.35}
            min={0}
            max={1}
            step={0.02}
            display={(settings.foliateDetail ?? 0.35).toFixed(2)}
            onChange={(foliateDetail) => patch({ foliateDetail })}
          />
        </div>
      </details>

      <details className="control-section" open>
        <summary>Visualization</summary>
        <div className="section-controls">
          <Toggle
            label="Comparison Mode"
            tip="Left: stigmergy OFF. Right: stigmergy ON. Same seed, architecture, spawn."
            value={!!settings.comparisonMode}
            onChange={(comparisonMode) => patch({ comparisonMode })}
          />
          <Select
            label="Field Display"
            tip="Agents only, or real attraction / inhibition / occupancy / combined heatmap."
            value={
              settings.comparisonMode
                ? settings.compareFieldMode ?? 'combined'
                : settings.fieldDisplayMode ?? 'agents'
            }
            options={FIELD_DISPLAY_MODES}
            onChange={(mode) =>
              settings.comparisonMode
                ? patch({ compareFieldMode: mode })
                : patch({ fieldDisplayMode: mode })
            }
          />
          <Toggle
            label="Show Architecture"
            tip="Subdued Gothic stone under agents."
            value={settings.showArchitecture !== false}
            onChange={(showArchitecture) => patch({ showArchitecture })}
          />
          <Toggle
            label="Show Agent Trails"
            tip="Recent movement trails coloured by agent state."
            value={settings.showAgentTrails !== false}
            onChange={(showAgentTrails) => patch({ showAgentTrails })}
          />
          <Toggle
            label="Full Trail History"
            tip="Keep longer trails (up to ~240 samples) for path comparison."
            value={!!settings.showFullTrailHistory}
            onChange={(showFullTrailHistory) => patch({ showFullTrailHistory })}
          />
          <Toggle
            label="Show Direction Indicators"
            tip="Short heading segments from each active agent."
            value={settings.showDirectionIndicators !== false}
            onChange={(showDirectionIndicators) => patch({ showDirectionIndicators })}
          />
          <Toggle
            label="State Colour Legend"
            tip="Markers always use state colours; this keeps the status legend visible."
            value={settings.showStateDebug !== false}
            onChange={(showStateDebug) => patch({ showStateDebug })}
          />
        </div>
      </details>
    </ControlPanel>
  )
}
