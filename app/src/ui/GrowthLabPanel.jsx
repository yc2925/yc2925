import { ControlPanel, Select, Slider, Toggle } from './Controls.jsx'
import { DEFAULT_DISTRIBUTION, DEFAULT_PATHS, DISTRIBUTION_MODES } from '../growth/settings.js'
import PathsControls from './PathsControls.jsx'
import FieldControls from './FieldControls.jsx'

const HINTS = {
  distribution: '01 distribution · where ornament wants to emerge',
  paths: '02 paths · how ornament travels across architecture',
  field: '03 vector field · which forces could produce the growth',
}

export default function GrowthLabPanel({ settings, onChange }) {
  const patch = (change) => onChange({ ...settings, ...change })
  const isNoise = settings.mode === 'noise'
  const isArchitectural = settings.mode === 'architectural'
  const isPaths = settings.study === 'paths'
  const isLater = settings.study !== 'distribution'

  return (
    <ControlPanel
      title="Growth lab"
      hint={HINTS[settings.study]}
    >
      {isPaths ? (
        <PathsControls
          settings={settings}
          onChange={patch}
          onReset={() => onChange({ ...settings, ...DEFAULT_PATHS })}
        />
      ) : null}
      {settings.study === 'field' ? <FieldControls settings={settings} onChange={patch} /> : null}
      <Select
        label="Distribution Mode"
        tip="Random is the baseline. Noise clusters patches. Architectural Data reads the facade: height, features, orientation."
        value={settings.mode}
        options={DISTRIBUTION_MODES}
        onChange={(mode) => patch({ mode })}
      />
      <button
        type="button"
        className="action-button"
        onClick={() => onChange({ ...settings, ...DEFAULT_DISTRIBUTION, mode: settings.mode, study: settings.study })}
      >
        Reset Distribution
      </button>

      <details className="control-section" open={!isLater}>
        <summary>Sampling</summary>
        <div className="section-controls">
          <Slider
            label="Seed"
            tip="Repeatable result. Same seed and parameters always give the same candidates and anchors."
            value={settings.seed}
            min={1}
            max={99}
            step={1}
            display={String(settings.seed)}
            onChange={(seed) => patch({ seed: Math.round(seed) })}
          />
          <Slider
            label="Candidate Count"
            tip="Points sampled on the facade surfaces, weighted by area. Hidden and buried faces are skipped."
            value={settings.candidateCount}
            min={1000}
            max={20000}
            step={500}
            display={settings.candidateCount.toLocaleString('en-US')}
            onChange={(candidateCount) => patch({ candidateCount: Math.round(candidateCount) })}
          />
          <Slider
            label="Density"
            tip="Share of candidates allowed to become anchors. In Architectural Data it is scaled by suitability squared."
            value={settings.density}
            min={0.02}
            max={1}
            step={0.01}
            display={settings.density.toFixed(2)}
            onChange={(density) => patch({ density })}
          />
        </div>
      </details>

      <details className="control-section" open={!isLater}>
        <summary>Noise</summary>
        <div className="section-controls">
          <Slider
            label="Noise Scale"
            tip="Frequency of the fBm field. Low: few large patches. High: many small ones. Noise mode only."
            value={settings.noiseScale}
            min={0.2}
            max={4}
            step={0.05}
            display={settings.noiseScale.toFixed(2)}
            disabled={!isNoise}
            onChange={(noiseScale) => patch({ noiseScale })}
          />
          <Slider
            label="Noise Threshold"
            tip="Field value below which nothing is accepted. Higher threshold, smaller and sparser patches. Noise mode only."
            value={settings.noiseThreshold}
            min={0}
            max={0.95}
            step={0.01}
            display={settings.noiseThreshold.toFixed(2)}
            disabled={!isNoise}
            onChange={(noiseThreshold) => patch({ noiseThreshold })}
          />
        </div>
      </details>

      <details className="control-section" open={!isLater}>
        <summary>Architectural Data</summary>
        <div className="section-controls">
          <Slider
            label="Height Bias"
            tip="Positive favours upper zones, negative favours the base. Zero ignores height."
            value={settings.heightBias}
            min={-1}
            max={1}
            step={0.01}
            display={settings.heightBias.toFixed(2)}
            disabled={!isArchitectural}
            onChange={(heightBias) => patch({ heightBias })}
          />
          <Slider
            label="Feature Attraction"
            tip="Pull towards arch edges, ribs, columns, ledges, the oculus and the sheltered recess. Intersections score highest."
            value={settings.featureAttraction}
            min={0}
            max={1}
            step={0.01}
            display={settings.featureAttraction.toFixed(2)}
            disabled={!isArchitectural}
            onChange={(featureAttraction) => patch({ featureAttraction })}
          />
          <Slider
            label="Orientation Bias"
            tip="Scales suitability by facing. Upward faces (ledge tops, sills) keep it, vertical faces lose a little, soffits facing down lose most."
            value={settings.orientationBias}
            min={0}
            max={1}
            step={0.01}
            display={settings.orientationBias.toFixed(2)}
            disabled={!isArchitectural}
            onChange={(orientationBias) => patch({ orientationBias })}
          />
        </div>
      </details>

      <details className="control-section" open hidden={isLater}>
        <summary>Display</summary>
        <div className="section-controls">
          <Toggle
            label="Show Candidates"
            tip="All sampled locations, before evaluation."
            value={settings.showCandidates}
            onChange={(showCandidates) => patch({ showCandidates })}
          />
          <Toggle
            label="Show Suitability"
            tip="growthSuitability per candidate, dark 0 to light 1."
            value={settings.showSuitability}
            onChange={(showSuitability) => patch({ showSuitability })}
          />
          <Toggle
            label="Show Accepted"
            tip="Selected anchors, classified as primary, secondary and terminal."
            value={settings.showAccepted}
            onChange={(showAccepted) => patch({ showAccepted })}
          />
        </div>
      </details>
    </ControlPanel>
  )
}
