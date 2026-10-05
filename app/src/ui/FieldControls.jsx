import { Slider, Toggle } from './Controls.jsx'
import { COMBINED_PRESET } from '../growth/settings.js'

export default function FieldControls({ settings, onChange }) {
  return (
    <>
      <div className="field-actions">
        <button type="button" className="action-button" onClick={() => onChange(COMBINED_PRESET)}>
          Combined View
        </button>
        <button type="button" className="action-button" onClick={() => onChange({ paused: !settings.paused })}>
          {settings.paused ? 'Play' : 'Pause'}
        </button>
        <button
          type="button"
          className="action-button"
          onClick={() => onChange({ resetKey: settings.resetKey + 1 })}
        >
          Reset Particles
        </button>
      </div>

      <details className="control-section" open>
        <summary>Vector Field</summary>
        <div className="section-controls">
          <Slider
            label="Particle Count"
            tip="Growth tracers emitted from PRIMARY and SECONDARY anchors of 01."
            value={settings.particleCount}
            min={250}
            max={8000}
            step={250}
            display={settings.particleCount.toLocaleString('en-US')}
            onChange={(particleCount) => onChange({ particleCount: Math.round(particleCount) })}
          />
          <Slider
            label="Particle Speed"
            tip="Travel speed in facade units per second."
            value={settings.particleSpeed}
            min={0.1}
            max={2}
            step={0.05}
            display={settings.particleSpeed.toFixed(2)}
            onChange={(particleSpeed) => onChange({ particleSpeed })}
          />
          <Slider
            label="Trail Length"
            tip="Positions kept per particle (one per frame)."
            value={settings.trailLength}
            min={8}
            max={120}
            step={4}
            display={String(settings.trailLength)}
            onChange={(trailLength) => onChange({ trailLength: Math.round(trailLength) })}
          />
          <Slider
            label="Upward Force"
            tip="Vegetal tropism: constant pull towards +Y."
            value={settings.upwardForce}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.upwardForce.toFixed(2)}
            onChange={(upwardForce) => onChange({ upwardForce })}
          />
          <Slider
            label="Surface Follow"
            tip="Pull onto a thin shell above the stone, and removal of motion away from it."
            value={settings.surfaceFollow}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.surfaceFollow.toFixed(2)}
            onChange={(surfaceFollow) => onChange({ surfaceFollow })}
          />
          <Slider
            label="Feature Attraction"
            tip="Near arches, archivolts, columns, ledges and the oculus, tracers run along them and are drawn onto them."
            value={settings.fieldFeature}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.fieldFeature.toFixed(2)}
            onChange={(fieldFeature) => onChange({ fieldFeature })}
          />
          <Slider
            label="Curl Strength"
            tip="Divergence-free swirl from a noise potential. Keep low for legible, architectural traces."
            value={settings.curlStrength}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.curlStrength.toFixed(2)}
            onChange={(curlStrength) => onChange({ curlStrength })}
          />
          <Slider
            label="Field Scale"
            tip="Frequency of the curl noise. Low: broad sweeps. High: tight eddies."
            value={settings.fieldScale}
            min={0.2}
            max={3}
            step={0.05}
            display={settings.fieldScale.toFixed(2)}
            onChange={(fieldScale) => onChange({ fieldScale })}
          />
        </div>
      </details>

      <details className="control-section" open>
        <summary>Layers</summary>
        <div className="section-controls">
          <Toggle
            label="Show Particles"
            tip="Current tracer positions."
            value={settings.showParticles}
            onChange={(showParticles) => onChange({ showParticles })}
          />
          <Toggle
            label="Show Trails"
            tip="Recent history of every tracer: the emergent paths."
            value={settings.showTrails}
            onChange={(showTrails) => onChange({ showTrails })}
          />
          <Toggle
            label="Show Vector Field"
            tip="Sparse samples of the combined force near the surface, dark tail to light head."
            value={settings.showVectorField}
            onChange={(showVectorField) => onChange({ showVectorField })}
          />
          <Toggle
            label="Show Splines"
            tip="The designed paths from 02, for comparison with the emergent trails."
            value={settings.showSplines}
            onChange={(showSplines) => onChange({ showSplines })}
          />
          <Toggle
            label="Show Anchors"
            tip="Emitters: PRIMARY (red) and SECONDARY anchors from 01."
            value={settings.showAnchors}
            onChange={(showAnchors) => onChange({ showAnchors })}
          />
        </div>
      </details>
    </>
  )
}
