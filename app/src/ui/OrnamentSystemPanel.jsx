import { ControlPanel, Select, Slider, Toggle } from './Controls.jsx'
import {
  ARCH_SOURCES,
  COMPOSITION_MODES,
  GROWTH_MODES,
  GROWTH_REGIONS,
  MOTIF_TYPES,
  ORNAMENT_DISPLAY_MODES,
  ORNAMENT_MATERIAL_MODES,
  ORNAMENT_PROFILE_TYPES,
  SCULPTURE_MODES,
  VIEW_ISOLATION_MODES,
  resetOrnament,
} from '../ornament/settings.js'
import { TRACERY_FAMILIES } from '../gothic/typologies/windowDesign2d.js'
import { TRACERY_PRESETS, applyPreset, presetById } from '../gothic/typologies/presets.js'
import ScaleSection from './ScaleSection.jsx'
import LodSection from './LodSection.jsx'
import { formatMillimeters } from '../scale/units.js'

export default function OrnamentSystemPanel({
  settings,
  onChange,
  simRunning,
  simFinished,
  onSimStartPause,
  onSimReset,
  onSimRegenerate,
  timelineTime,
  timelineDuration,
  onTimelineScrub,
  activeLod = null,
}) {
  const patch = (change) => onChange({ ...settings, ...change })
  const trails = settings.displayMode === 'trails'
  const branching = settings.displayMode === 'branching'
  const geometry = settings.displayMode === 'geometry'
  const networkUI = branching || geometry
  const particleUI = trails || networkUI

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
    <ControlPanel
      title="Ornament System"
      hint={
        geometry
          ? 'step 10c · architectural integration'
          : branching
            ? 'step 9 · L-system branching on primary trails'
            : trails
              ? 'step 8 · particle trails · ornamental paths'
              : 'step 7–10b · growth conditions · trails · geometry'
      }
    >
      <Select
        label="Display"
        tip="Diagnostics, trails, branching, and ornament geometry. Mode switch does not rebuild architecture."
        value={settings.displayMode}
        options={ORNAMENT_DISPLAY_MODES}
        onChange={(displayMode) => patch({ displayMode })}
      />
      <button type="button" className="action-button" onClick={() => onChange(resetOrnament())}>
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
            label="Source"
            tip="Tracery Window reuses the Gothic generator."
            value={settings.archSource}
            options={ARCH_SOURCES.map(({ id, label }) => ({ id, label }))}
            onChange={(archSource) => patch({ archSource })}
          />
          <Select
            label="Tracery Family"
            tip="Same families as Gothic Architecture."
            value={settings.traceryFamily ?? 'geometric'}
            options={TRACERY_FAMILIES.map(({ id, label }) => ({ id, label }))}
            onChange={(traceryFamily) => patch({ traceryFamily })}
          />
          <Select
            label="Preset"
            tip="Curated Gothic window presets."
            value={settings.activePreset ?? 'geo-twin-trefoil'}
            options={TRACERY_PRESETS.map(({ id, label }) => ({ id, label }))}
            onChange={onPreset}
          />
          <Slider
            label="Architecture Seed"
            tip="Window design seed. Independent of growth seed."
            value={settings.variationSeed ?? 3}
            min={1}
            max={99}
            step={1}
            display={String(Math.round(settings.variationSeed ?? 3))}
            onChange={(variationSeed) => patch({ variationSeed: Math.round(variationSeed) })}
          />
          <p className="meshing-hint">{presetById(settings.activePreset ?? 'geo-twin-trefoil').note}</p>
        </div>
      </details>

      {!particleUI ? (
        <>
          <details className="control-section" open>
            <summary>Growth Distribution</summary>
            <div className="section-controls">
              <Slider
                label="Anchor Count"
                tip="Target number of growth anchors after spacing."
                value={settings.anchorCount}
                min={20}
                max={280}
                step={1}
                display={String(Math.round(settings.anchorCount))}
                onChange={(anchorCount) => patch({ anchorCount: Math.round(anchorCount) })}
              />
              <Slider
                label="Min Anchor Spacing"
                tip="Minimum distance between selected anchors."
                value={settings.minAnchorSpacing}
                min={0.05}
                max={0.35}
                step={0.01}
                display={settings.minAnchorSpacing.toFixed(2)}
                onChange={(minAnchorSpacing) => patch({ minAnchorSpacing })}
              />
              <Slider
                label="Growth Seed"
                tip="Changes anchor sampling without changing the architecture."
                value={settings.growthSeed}
                min={1}
                max={99}
                step={1}
                display={String(Math.round(settings.growthSeed))}
                onChange={(growthSeed) => patch({ growthSeed: Math.round(growthSeed) })}
              />
            </div>
          </details>

          <details className="control-section" open>
            <summary>Suitability</summary>
            <div className="section-controls">
              <Slider
                label="Frame Attraction"
                tip="Weight for outer frame features."
                value={settings.frameAttraction}
                min={0}
                max={1}
                step={0.01}
                display={settings.frameAttraction.toFixed(2)}
                onChange={(frameAttraction) => patch({ frameAttraction })}
              />
              <Slider
                label="Mullion Attraction"
                tip="Weight for primary mullions / lancets."
                value={settings.mullionAttraction}
                min={0}
                max={1}
                step={0.01}
                display={settings.mullionAttraction.toFixed(2)}
                onChange={(mullionAttraction) => patch({ mullionAttraction })}
              />
              <Slider
                label="Tracery Attraction"
                tip="Weight for secondary ornamental curves."
                value={settings.traceryAttraction}
                min={0}
                max={1}
                step={0.01}
                display={settings.traceryAttraction.toFixed(2)}
                onChange={(traceryAttraction) => patch({ traceryAttraction })}
              />
              <Slider
                label="Junction Attraction"
                tip="Boost near architectural intersections."
                value={settings.junctionAttraction}
                min={0}
                max={1}
                step={0.01}
                display={settings.junctionAttraction.toFixed(2)}
                onChange={(junctionAttraction) => patch({ junctionAttraction })}
              />
              <Slider
                label="Height Preference"
                tip="Favor elevated regions of the window."
                value={settings.heightPreference}
                min={0}
                max={1}
                step={0.01}
                display={settings.heightPreference.toFixed(2)}
                onChange={(heightPreference) => patch({ heightPreference })}
              />
            </div>
          </details>

          <details className="control-section" open>
            <summary>Direction</summary>
            <div className="section-controls">
              <Slider
                label="Architectural Following"
                tip="Follow local curve tangents."
                value={settings.architecturalFollowing}
                min={0}
                max={1}
                step={0.01}
                display={settings.architecturalFollowing.toFixed(2)}
                onChange={(architecturalFollowing) => patch({ architecturalFollowing })}
              />
              <Slider
                label="Upward Bias"
                tip="Blend toward world up."
                value={settings.upwardBias}
                min={0}
                max={1}
                step={0.01}
                display={settings.upwardBias.toFixed(2)}
                onChange={(upwardBias) => patch({ upwardBias })}
              />
              <Slider
                label="Junction Pull"
                tip="Attract direction toward nearby junctions."
                value={settings.junctionPull}
                min={0}
                max={1}
                step={0.01}
                display={settings.junctionPull.toFixed(2)}
                onChange={(junctionPull) => patch({ junctionPull })}
              />
              <Slider
                label="Outward Bias"
                tip="Deviate outward from the window centre."
                value={settings.outwardBias}
                min={0}
                max={1}
                step={0.01}
                display={settings.outwardBias.toFixed(2)}
                onChange={(outwardBias) => patch({ outwardBias })}
              />
            </div>
          </details>
        </>
      ) : (
        <>
          <details className="control-section" open>
            <summary>Particle Simulation</summary>
            <div className="section-controls">
              <Select
                label="Growth Mode"
                tip="Constrained follows stone curves. Hybrid allows organic deviation."
                value={settings.growthMode ?? 'constrained'}
                options={GROWTH_MODES}
                onChange={(growthMode) => patch({ growthMode })}
              />
              <Slider
                label="Particle Count"
                tip="Number of ornamental paths (keep low for clarity)."
                value={settings.particleCount ?? 8}
                min={2}
                max={24}
                step={1}
                display={String(Math.round(settings.particleCount ?? 8))}
                onChange={(particleCount) => patch({ particleCount: Math.round(particleCount) })}
              />
              <Slider
                label="Spawn Threshold"
                tip="Minimum suitability to be eligible for spawning."
                value={settings.spawnThreshold ?? 0.55}
                min={0}
                max={0.95}
                step={0.01}
                display={(settings.spawnThreshold ?? 0.55).toFixed(2)}
                onChange={(spawnThreshold) => patch({ spawnThreshold })}
              />
              <Slider
                label="Maximum Path Length"
                tip="Per-particle path budget. 0 = auto from window scale. Primary uses full; secondary ~half."
                value={settings.maximumPathLength ?? 0}
                min={0}
                max={12}
                step={0.1}
                display={
                  (settings.maximumPathLength ?? 0) <= 0
                    ? 'auto'
                    : (settings.maximumPathLength ?? 0).toFixed(1)
                }
                onChange={(maximumPathLength) => patch({ maximumPathLength })}
              />
              <Slider
                label="Trail Spacing"
                tip="Minimum clearance between trails (spatial competition)."
                value={settings.trailSpacing ?? 0.14}
                min={0.06}
                max={0.35}
                step={0.01}
                display={(settings.trailSpacing ?? 0.14).toFixed(2)}
                onChange={(trailSpacing) => patch({ trailSpacing })}
              />
              <Slider
                label="Max Arch Distance"
                tip="How far free tips may leave the stone network. 0 = auto."
                value={settings.maxArchDistance ?? 0}
                min={0}
                max={0.8}
                step={0.01}
                display={
                  (settings.maxArchDistance ?? 0) <= 0
                    ? 'auto'
                    : (settings.maxArchDistance ?? 0).toFixed(2)
                }
                onChange={(maxArchDistance) => patch({ maxArchDistance })}
              />
              <Slider
                label="Growth Speed"
                tip="Path advance rate (simulation units)."
                value={settings.growthSpeed ?? 1}
                min={0.25}
                max={2.5}
                step={0.05}
                display={(settings.growthSpeed ?? 1).toFixed(2)}
                onChange={(growthSpeed) => patch({ growthSpeed })}
              />
              <Slider
                label="Simulation Duration"
                tip="Maximum simulated seconds before stop."
                value={settings.simulationDuration ?? 12}
                min={3}
                max={30}
                step={0.5}
                display={(settings.simulationDuration ?? 12).toFixed(1)}
                onChange={(simulationDuration) => patch({ simulationDuration })}
              />
              <Slider
                label="Growth Seed"
                tip="Deterministic spawn and junction choices. Independent of architecture seed."
                value={settings.growthSeed}
                min={1}
                max={99}
                step={1}
                display={String(Math.round(settings.growthSeed))}
                onChange={(growthSeed) => patch({ growthSeed: Math.round(growthSeed) })}
              />
              <button type="button" className="action-button" onClick={onSimStartPause}>
                {simFinished ? 'Finished' : simRunning ? 'Pause' : 'Start'}
              </button>
              <button type="button" className="action-button" onClick={onSimReset}>
                Reset
              </button>
              <button type="button" className="action-button" onClick={onSimRegenerate}>
                Regenerate
              </button>
            </div>
          </details>

          <details className="control-section" open>
            <summary>Behavior</summary>
            <div className="section-controls">
              <Slider
                label="Architectural Following"
                tip="Stay on / return toward stone centerlines."
                value={settings.architecturalFollowing}
                min={0}
                max={1}
                step={0.01}
                display={settings.architecturalFollowing.toFixed(2)}
                onChange={(architecturalFollowing) => patch({ architecturalFollowing })}
              />
              <Slider
                label="Upward Bias"
                tip="Prefer ascending travel."
                value={settings.upwardBias}
                min={0}
                max={1}
                step={0.01}
                display={settings.upwardBias.toFixed(2)}
                onChange={(upwardBias) => patch({ upwardBias })}
              />
              <Slider
                label="Gravity"
                tip="Downward pull in hybrid free movement."
                value={settings.gravity ?? 0.25}
                min={0}
                max={1}
                step={0.01}
                display={(settings.gravity ?? 0.25).toFixed(2)}
                onChange={(gravity) => patch({ gravity })}
              />
              <Slider
                label="Curl Strength"
                tip="Localized terminal / tendril curl (keep low)."
                value={settings.curlStrength ?? 0.2}
                min={0}
                max={1}
                step={0.01}
                display={(settings.curlStrength ?? 0.2).toFixed(2)}
                onChange={(curlStrength) => patch({ curlStrength })}
              />
              <Slider
                label="Organic Deviation"
                tip="How far hybrid paths may leave the stone network."
                value={settings.organicDeviation ?? 0.15}
                min={0}
                max={1}
                step={0.01}
                display={(settings.organicDeviation ?? 0.15).toFixed(2)}
                onChange={(organicDeviation) => patch({ organicDeviation })}
              />
              <Slider
                label="Junction Attraction"
                tip="Pull toward nearby junctions while free."
                value={settings.junctionAttraction}
                min={0}
                max={1}
                step={0.01}
                display={settings.junctionAttraction.toFixed(2)}
                onChange={(junctionAttraction) => patch({ junctionAttraction })}
              />
              <Slider
                label="Exploration Bias"
                tip="At junctions: prefer underexplored curves (high) vs familiar routes (low)."
                value={settings.explorationBias ?? 0.55}
                min={0}
                max={1}
                step={0.01}
                display={(settings.explorationBias ?? 0.55).toFixed(2)}
                onChange={(explorationBias) => patch({ explorationBias })}
              />
              <Slider
                label="Architectural Proximity"
                tip="How strongly free particles stay near arches and tracery."
                value={settings.architecturalProximity ?? 0.65}
                min={0}
                max={1}
                step={0.01}
                display={(settings.architecturalProximity ?? 0.65).toFixed(2)}
                onChange={(architecturalProximity) => patch({ architecturalProximity })}
              />
              <Slider
                label="Growth Envelope"
                tip="Allowed growth beyond the specimen bounds. High = more fringe."
                value={settings.growthEnvelope ?? 0.35}
                min={0.05}
                max={1}
                step={0.01}
                display={(settings.growthEnvelope ?? 0.35).toFixed(2)}
                onChange={(growthEnvelope) => patch({ growthEnvelope })}
              />
            </div>
          </details>

          {networkUI ? (
            <details className="control-section" open>
              <summary>Ornamental Composition</summary>
              <div className="section-controls">
                <Select
                  label="Composition Mode"
                  tip="Free = existing growth. Bilateral mirrors a master side. Rhythmic places motifs along stone."
                  value={settings.compositionMode ?? 'bilateral'}
                  options={COMPOSITION_MODES}
                  onChange={(compositionMode) => patch({ compositionMode })}
                />
                <Select
                  label="Growth Region"
                  tip="Bias ornamental growth to an architectural zone."
                  value={settings.growthRegion ?? 'upper-tracery'}
                  options={GROWTH_REGIONS}
                  onChange={(growthRegion) => patch({ growthRegion })}
                />
                {(settings.compositionMode ?? 'bilateral') === 'bilateral' ||
                (settings.compositionMode ?? 'bilateral') === 'rhythmic' ? (
                  <Slider
                    label="Symmetry Strength"
                    tip="1 = perfect mirror. 0 = free. Mid values add smooth seeded variation on the mirror."
                    value={settings.symmetryStrength ?? 1}
                    min={0}
                    max={1}
                    step={0.01}
                    display={(settings.symmetryStrength ?? 1).toFixed(2)}
                    onChange={(symmetryStrength) => patch({ symmetryStrength })}
                  />
                ) : null}
                {(settings.compositionMode ?? 'bilateral') === 'bilateral' ? (
                  <Slider
                    label="Master Path Count"
                    tip="How many primary trails on the master side before mirroring."
                    value={settings.masterPathCount ?? settings.particleCount ?? 3}
                    min={1}
                    max={8}
                    step={1}
                    display={String(Math.round(settings.masterPathCount ?? settings.particleCount ?? 3))}
                    onChange={(masterPathCount) =>
                      patch({
                        masterPathCount: Math.round(masterPathCount),
                        particleCount: Math.round(masterPathCount),
                      })
                    }
                  />
                ) : null}
                {(settings.compositionMode ?? 'bilateral') === 'rhythmic' ? (
                  <>
                    <Select
                      label="Motif Type"
                      tip="Parametric curve motifs placed along architectural arcs."
                      value={settings.motifType ?? 'scroll'}
                      options={MOTIF_TYPES}
                      onChange={(motifType) => patch({ motifType })}
                    />
                    <Slider
                      label="Motif Spacing"
                      tip="Arc-length gap between motif attachments."
                      value={settings.motifSpacing ?? 0.55}
                      min={0.2}
                      max={1.4}
                      step={0.02}
                      display={(settings.motifSpacing ?? 0.55).toFixed(2)}
                      onChange={(motifSpacing) => patch({ motifSpacing })}
                    />
                    <Slider
                      label="Motif Scale"
                      tip="Size of each ornamental motif."
                      value={settings.motifScale ?? 0.55}
                      min={0.15}
                      max={1.2}
                      step={0.02}
                      display={(settings.motifScale ?? 0.55).toFixed(2)}
                      onChange={(motifScale) => patch({ motifScale })}
                    />
                    <Slider
                      label="Repetition Count"
                      tip="Max motifs per selected curve before stopping."
                      value={settings.repetitionCount ?? 4}
                      min={1}
                      max={16}
                      step={1}
                      display={String(Math.round(settings.repetitionCount ?? 4))}
                      onChange={(repetitionCount) =>
                        patch({ repetitionCount: Math.round(repetitionCount) })
                      }
                    />
                  </>
                ) : null}
              </div>
            </details>
          ) : null}

          {networkUI ? (
            <details className="control-section" open>
              <summary>L-System Branching</summary>
              <div className="section-controls">
                <Slider
                  label="Branch Generations"
                  tip="0 = primary trails only. 1–3 add recursive side branches."
                  value={settings.branchGenerations ?? 1}
                  min={0}
                  max={3}
                  step={1}
                  display={String(Math.round(settings.branchGenerations ?? 1))}
                  onChange={(branchGenerations) =>
                    patch({ branchGenerations: Math.round(branchGenerations) })
                  }
                />
                <Slider
                  label="Branch Density"
                  tip="How many side shoots along each parent path."
                  value={settings.branchDensity ?? 0.4}
                  min={0.05}
                  max={0.85}
                  step={0.01}
                  display={(settings.branchDensity ?? 0.4).toFixed(2)}
                  onChange={(branchDensity) => patch({ branchDensity })}
                />
                <Slider
                  label="Branch Angle"
                  tip="Degrees from local parent tangent."
                  value={settings.branchAngle ?? 34}
                  min={8}
                  max={55}
                  step={1}
                  display={`${Math.round(settings.branchAngle ?? 34)}°`}
                  onChange={(branchAngle) => patch({ branchAngle })}
                />
                <Slider
                  label="Length Decay"
                  tip="Child length ≈ parent × decay each generation."
                  value={settings.lengthDecay ?? 0.48}
                  min={0.3}
                  max={0.85}
                  step={0.01}
                  display={(settings.lengthDecay ?? 0.48).toFixed(2)}
                  onChange={(lengthDecay) => patch({ lengthDecay })}
                />
                <Slider
                  label="Architectural Attraction"
                  tip="Pull toward stone after departure. Lower = freer opening exploration."
                  value={settings.architecturalAttraction ?? 0.55}
                  min={0}
                  max={1}
                  step={0.01}
                  display={(settings.architecturalAttraction ?? 0.55).toFixed(2)}
                  onChange={(architecturalAttraction) => patch({ architecturalAttraction })}
                />
                <Slider
                  label="Curl Influence"
                  tip="Terminal hooks, S-curves, and partial spirals."
                  value={settings.curlInfluence ?? 0.42}
                  min={0}
                  max={1}
                  step={0.01}
                  display={(settings.curlInfluence ?? 0.42).toFixed(2)}
                  onChange={(curlInfluence) => patch({ curlInfluence })}
                />
                <Slider
                  label="Symmetry Bias"
                  tip="Favor mirrored left/right branch choices."
                  value={settings.symmetryBias ?? 0.55}
                  min={0}
                  max={1}
                  step={0.01}
                  display={(settings.symmetryBias ?? 0.55).toFixed(2)}
                  onChange={(symmetryBias) => patch({ symmetryBias })}
                />
                <Slider
                  label="Branch Growth Speed"
                  tip="How quickly secondary branches extend once born."
                  value={settings.branchGrowthSpeed ?? 1}
                  min={0.25}
                  max={2.5}
                  step={0.05}
                  display={(settings.branchGrowthSpeed ?? 1).toFixed(2)}
                  onChange={(branchGrowthSpeed) => patch({ branchGrowthSpeed })}
                />
                <Slider
                  label="Branch Delay"
                  tip="Extra wait after parent reaches the attachment point."
                  value={settings.branchDelay ?? 0.35}
                  min={0}
                  max={2}
                  step={0.05}
                  display={(settings.branchDelay ?? 0.35).toFixed(2)}
                  onChange={(branchDelay) => patch({ branchDelay })}
                />
                <Toggle
                  label="Stretch Timeline"
                  tip="Scale growth across Simulation Duration. Off = finish when geometry completes (~2s)."
                  value={settings.stretchTimeline !== false}
                  onChange={(stretchTimeline) => patch({ stretchTimeline })}
                />
                {typeof onTimelineScrub === 'function' ? (
                  <Slider
                    label="Timeline"
                    tip="Scrub shared growth clock. Uses recorded geometry."
                    value={timelineTime ?? 0}
                    min={0}
                    max={Math.max(0.1, timelineDuration ?? 12)}
                    step={0.05}
                    display={`${(timelineTime ?? 0).toFixed(2)}s`}
                    onChange={(t) => onTimelineScrub(t)}
                  />
                ) : null}
              </div>
            </details>
          ) : null}

          {geometry ? (
            <>
            <details className="control-section" open>
              <summary>Ornament Geometry</summary>
              <div className="section-controls">
                <Select
                  label="Profile Type"
                  tip="Round stem, fluted ribbing, leaf blade, or carved relief against stone."
                  value={settings.profileType ?? 'leaf'}
                  options={ORNAMENT_PROFILE_TYPES}
                  onChange={(profileType) => patch({ profileType })}
                />
                <Select
                  label="Sculpture Mode"
                  tip="Surface Relief hugs the window plane. Free Sculpture may project into openings."
                  value={settings.sculptureMode ?? 'surface'}
                  options={SCULPTURE_MODES}
                  onChange={(sculptureMode) => patch({ sculptureMode })}
                />
                <Slider
                  label="Ornament Thickness"
                  tip="Primary stem thickness (15–60 mm design range). Proportional to mullion thickness."
                  value={settings.ornamentThickness ?? 0.032}
                  min={0.015}
                  max={0.06}
                  step={0.001}
                  display={formatMillimeters(settings.ornamentThickness ?? 0.032, 0)}
                  onChange={(ornamentThickness) => patch({ ornamentThickness })}
                />
                <Slider
                  label="Profile Width"
                  tip="Cross-section width (leaf blade / relief span)."
                  value={settings.profileWidth ?? 1.4}
                  min={0.6}
                  max={2.4}
                  step={0.02}
                  display={(settings.profileWidth ?? 1.4).toFixed(2)}
                  onChange={(profileWidth) => patch({ profileWidth })}
                />
                <Slider
                  label="Profile Depth"
                  tip="Cross-section thickness / carved projection depth."
                  value={settings.profileDepth ?? 0.58}
                  min={0.25}
                  max={1.4}
                  step={0.02}
                  display={(settings.profileDepth ?? 0.58).toFixed(2)}
                  onChange={(profileDepth) => patch({ profileDepth })}
                />
                <Slider
                  label="Fluting Strength"
                  tip="Rib / groove amplitude on fluted and relief profiles."
                  value={settings.flutingStrength ?? 0.48}
                  min={0}
                  max={1}
                  step={0.01}
                  display={(settings.flutingStrength ?? 0.48).toFixed(2)}
                  onChange={(flutingStrength) => patch({ flutingStrength })}
                />
                <Slider
                  label="Profile Transition"
                  tip="How early the stem morphs into the sculptural / leaf section."
                  value={settings.profileTransition ?? 0.58}
                  min={0.1}
                  max={1}
                  step={0.01}
                  display={(settings.profileTransition ?? 0.58).toFixed(2)}
                  onChange={(profileTransition) => patch({ profileTransition })}
                />
                <Slider
                  label="Relief Depth"
                  tip="How far ornament lifts from the local window-plane support (5–40 mm)."
                  value={settings.reliefDepth ?? 0.016}
                  min={0.005}
                  max={0.04}
                  step={0.001}
                  display={formatMillimeters(settings.reliefDepth ?? 0.016, 0)}
                  onChange={(reliefDepth) => patch({ reliefDepth })}
                />
                <Slider
                  label="Tip Curl"
                  tip="Foliate hook strength near path tips."
                  value={settings.tipCurl ?? 0.55}
                  min={0}
                  max={1}
                  step={0.01}
                  display={(settings.tipCurl ?? 0.55).toFixed(2)}
                  onChange={(tipCurl) => patch({ tipCurl })}
                />
                <Slider
                  label="Taper Strength"
                  tip="How finely tips narrow along each path."
                  value={settings.taperStrength ?? 0.72}
                  min={0.15}
                  max={0.95}
                  step={0.01}
                  display={(settings.taperStrength ?? 0.72).toFixed(2)}
                  onChange={(taperStrength) => patch({ taperStrength })}
                />
                <Slider
                  label="Branch Thickness Decay"
                  tip="Child radius ≈ parent × decay each generation (0.60–0.75 typical)."
                  value={settings.branchThicknessDecay ?? 0.68}
                  min={0.4}
                  max={0.9}
                  step={0.01}
                  display={(settings.branchThicknessDecay ?? 0.68).toFixed(2)}
                  onChange={(branchThicknessDecay) => patch({ branchThicknessDecay })}
                />
                <Slider
                  label="Radial Resolution"
                  tip="Cross-section segments. 10–14 for sculptural preview."
                  value={settings.radialResolution ?? 12}
                  min={6}
                  max={18}
                  step={1}
                  display={String(Math.round(settings.radialResolution ?? 12))}
                  onChange={(radialResolution) =>
                    patch({ radialResolution: Math.round(radialResolution) })
                  }
                />
                <Slider
                  label="Curve Resolution"
                  tip="Adaptive tubular density along curvature / length."
                  value={settings.curveResolution ?? 0.55}
                  min={0.15}
                  max={1}
                  step={0.01}
                  display={(settings.curveResolution ?? 0.55).toFixed(2)}
                  onChange={(curveResolution) => patch({ curveResolution })}
                />
                <Select
                  label="Material"
                  tip="Stone / clay / wireframe / profile-debug (frames + section tint)."
                  value={settings.ornamentMaterialMode ?? 'stone'}
                  options={ORNAMENT_MATERIAL_MODES}
                  onChange={(ornamentMaterialMode) => patch({ ornamentMaterialMode })}
                />
              </div>
            </details>
            <details className="control-section" open>
              <summary>Architectural Integration</summary>
              <div className="section-controls">
                <Slider
                  label="Attachment Strength"
                  tip="How strongly roots snap onto valid architectural surfaces."
                  value={settings.attachmentStrength ?? 0.88}
                  min={0}
                  max={1}
                  step={0.01}
                  display={(settings.attachmentStrength ?? 0.88).toFixed(2)}
                  onChange={(attachmentStrength) => patch({ attachmentStrength })}
                />
                <Slider
                  label="Surface Conformity"
                  tip="How closely the initial ornament follows architectural geometry."
                  value={settings.surfaceConformity ?? 0.72}
                  min={0}
                  max={1}
                  step={0.01}
                  display={(settings.surfaceConformity ?? 0.72).toFixed(2)}
                  onChange={(surfaceConformity) => patch({ surfaceConformity })}
                />
                <Slider
                  label="Root Embedding"
                  tip="How far the root extends into the supporting stone surface."
                  value={settings.rootEmbedding ?? 0.014}
                  min={0}
                  max={0.04}
                  step={0.001}
                  display={(settings.rootEmbedding ?? 0.014).toFixed(3)}
                  onChange={(rootEmbedding) => patch({ rootEmbedding })}
                />
                <Slider
                  label="Relief Projection"
                  tip="How far raised relief projects from the architectural surface."
                  value={settings.reliefProjection ?? 0.018}
                  min={0}
                  max={0.06}
                  step={0.001}
                  display={(settings.reliefProjection ?? 0.018).toFixed(3)}
                  onChange={(reliefProjection) => patch({ reliefProjection })}
                />
                <Slider
                  label="Sculptural Emergence"
                  tip="How strongly ornament may depart into free space after the relief phase."
                  value={settings.sculpturalEmergence ?? 0.52}
                  min={0}
                  max={1}
                  step={0.01}
                  display={(settings.sculpturalEmergence ?? 0.52).toFixed(2)}
                  onChange={(sculpturalEmergence) => patch({ sculpturalEmergence })}
                />
                <Slider
                  label="Transition Length"
                  tip="How gradually geometry changes from embedded relief to free sculpture."
                  value={settings.transitionLength ?? 0.55}
                  min={0.15}
                  max={0.95}
                  step={0.01}
                  display={(settings.transitionLength ?? 0.55).toFixed(2)}
                  onChange={(transitionLength) => patch({ transitionLength })}
                />
                <Select
                  label="View Isolation"
                  tip="Architecture only, ornament only, or combined (default)."
                  value={settings.viewIsolation ?? 'combined'}
                  options={VIEW_ISOLATION_MODES}
                  onChange={(viewIsolation) => patch({ viewIsolation })}
                />
                <Toggle
                  label="Show Attachment Points"
                  tip="Debug: root attachment positions on stone."
                  value={!!settings.showAttachmentPoints}
                  onChange={(showAttachmentPoints) => patch({ showAttachmentPoints })}
                />
                <Toggle
                  label="Show Surface Normals"
                  tip="Debug: outward normals at attachment sites."
                  value={!!settings.showSurfaceNormals}
                  onChange={(showSurfaceNormals) => patch({ showSurfaceNormals })}
                />
                <Toggle
                  label="Show Attachment Frames"
                  tip="Debug: local tangent / side / normal frames."
                  value={!!settings.showAttachmentFrames}
                  onChange={(showAttachmentFrames) => patch({ showAttachmentFrames })}
                />
                <Toggle
                  label="Show Relief Transitions"
                  tip="Debug: embed → raise direction segments."
                  value={!!settings.showReliefTransitions}
                  onChange={(showReliefTransitions) => patch({ showReliefTransitions })}
                />
              </div>
            </details>
            </>
          ) : null}
        </>
      )}

      <details className="control-section" open>
        <summary>Visualization</summary>
        <div className="section-controls">
          <Toggle
            label="Show Architecture"
            tip="Draw stone under diagnostics / trails / branching / geometry."
            value={
              geometry
                ? settings.showOrnamentArchitecture !== false
                : branching
                  ? settings.showBranchArchitecture !== false
                  : settings.showArchitecture !== false
            }
            onChange={(v) => {
              if (geometry) patch({ showOrnamentArchitecture: v })
              else if (branching) patch({ showBranchArchitecture: v })
              else patch({ showArchitecture: v })
            }}
          />
          {geometry ? (
            <>
              <Toggle
                label="Show Curve Skeleton"
                tip="Overlay source ornamental curves for comparison with swept meshes."
                value={!!settings.showCurveSkeleton}
                onChange={(showCurveSkeleton) => patch({ showCurveSkeleton })}
              />
              <Toggle
                label="Show Primary"
                tip="Generation-0 tapered stems."
                value={settings.showBranchPrimary !== false}
                onChange={(showBranchPrimary) => patch({ showBranchPrimary })}
              />
              <Toggle
                label="Show Secondary"
                tip="Generation 1+ branch meshes."
                value={settings.showBranchSecondary !== false}
                onChange={(showBranchSecondary) => patch({ showBranchSecondary })}
              />
              <Toggle
                label="Show Growth Origins"
                tip="Debug: branch attachment points on parents."
                value={!!settings.showGrowthOrigins}
                onChange={(showGrowthOrigins) => patch({ showGrowthOrigins })}
              />
              <Toggle
                label="Show Symmetry Axis"
                tip="Debug: architectural vertical centerline used for mirroring."
                value={!!settings.showSymmetryAxis}
                onChange={(showSymmetryAxis) => patch({ showSymmetryAxis })}
              />
            </>
          ) : branching ? (
            <>
              <Toggle
                label="Show Primary"
                tip="Generation-0 particle trails."
                value={settings.showBranchPrimary !== false}
                onChange={(showBranchPrimary) => patch({ showBranchPrimary })}
              />
              <Toggle
                label="Show Secondary"
                tip="Generation 1+ L-system branches."
                value={settings.showBranchSecondary !== false}
                onChange={(showBranchSecondary) => patch({ showBranchSecondary })}
              />
              <Toggle
                label="Show Growing Tips"
                tip="Bright tips of actively extending curves."
                value={settings.showGrowingTips !== false}
                onChange={(showGrowingTips) => patch({ showGrowingTips })}
              />
              <Toggle
                label="Show Growth Origins"
                tip="Debug: branch attachment points on parents."
                value={!!settings.showGrowthOrigins}
                onChange={(showGrowthOrigins) => patch({ showGrowthOrigins })}
              />
              <Toggle
                label="Show Symmetry Axis"
                tip="Debug: architectural vertical centerline used for mirroring."
                value={!!settings.showSymmetryAxis}
                onChange={(showSymmetryAxis) => patch({ showSymmetryAxis })}
              />
              <Toggle
                label="Show Master Paths"
                tip="Debug: generation side before mirror."
                value={settings.showMasterPaths !== false}
                onChange={(showMasterPaths) => patch({ showMasterPaths })}
              />
              <Toggle
                label="Show Mirrored Paths"
                tip="Debug: reflected counterparts."
                value={settings.showMirroredPaths !== false}
                onChange={(showMirroredPaths) => patch({ showMirroredPaths })}
              />
              <Toggle
                label="Show Motif Origins"
                tip="Debug: rhythmic motif attachment points."
                value={!!settings.showMotifOrigins}
                onChange={(showMotifOrigins) => patch({ showMotifOrigins })}
              />
              <Slider
                label="Trail Opacity"
                tip="Opacity of the hierarchical network."
                value={settings.trailOpacity ?? 0.85}
                min={0.15}
                max={1}
                step={0.01}
                display={(settings.trailOpacity ?? 0.85).toFixed(2)}
                onChange={(trailOpacity) => patch({ trailOpacity })}
              />
            </>
          ) : trails ? (
            <>
              <Toggle
                label="Show Particle Heads"
                tip="Bright tips of active particles."
                value={settings.showParticleHeads !== false}
                onChange={(showParticleHeads) => patch({ showParticleHeads })}
              />
              <Toggle
                label="Distinguish Segments"
                tip="Tint constrained vs free-growth trail segments."
                value={settings.distinguishGrowthSegments !== false}
                onChange={(distinguishGrowthSegments) => patch({ distinguishGrowthSegments })}
              />
              <Toggle
                label="Show Primary / Secondary"
                tip="Colour primary (structural) vs secondary (shorter) paths."
                value={settings.showPrimarySecondary !== false}
                onChange={(showPrimarySecondary) => patch({ showPrimarySecondary })}
              />
              <Toggle
                label="Show Growth Envelope"
                tip="Debug: soft growth bounds around the specimen."
                value={!!settings.showGrowthEnvelope}
                onChange={(showGrowthEnvelope) => patch({ showGrowthEnvelope })}
              />
              <Toggle
                label="Show Occupancy"
                tip="Debug: spatial occupancy samples used for trail spacing."
                value={!!settings.showOccupancy}
                onChange={(showOccupancy) => patch({ showOccupancy })}
              />
              <Slider
                label="Trail Opacity"
                tip="Opacity of accumulated path lines."
                value={settings.trailOpacity ?? 0.85}
                min={0.15}
                max={1}
                step={0.01}
                display={(settings.trailOpacity ?? 0.85).toFixed(2)}
                onChange={(trailOpacity) => patch({ trailOpacity })}
              />
              <Slider
                label="Trail Thickness"
                tip="Head size scale (line width is platform-limited)."
                value={settings.trailThickness ?? 1.5}
                min={0.5}
                max={3}
                step={0.1}
                display={(settings.trailThickness ?? 1.5).toFixed(1)}
                onChange={(trailThickness) => patch({ trailThickness })}
              />
            </>
          ) : (
            <>
              <Slider
                label="Diagnostic Density"
                tip="Fraction of anchors / arrows drawn."
                value={settings.diagnosticDensity}
                min={0.15}
                max={1}
                step={0.01}
                display={settings.diagnosticDensity.toFixed(2)}
                onChange={(diagnosticDensity) => patch({ diagnosticDensity })}
              />
              <Slider
                label="Suitability Threshold"
                tip="In Suitability mode, show scores at or above this value."
                value={settings.suitabilityThreshold ?? 0}
                min={0}
                max={1}
                step={0.01}
                display={(settings.suitabilityThreshold ?? 0).toFixed(2)}
                onChange={(suitabilityThreshold) => patch({ suitabilityThreshold })}
              />
            </>
          )}
        </div>
      </details>
    </ControlPanel>
  )
}
