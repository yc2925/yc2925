import { ControlPanel, Select, Slider, Toggle } from './Controls.jsx'
import { PRESETS } from '../lsystems/presets.js'
import { LOD_DISTANCE, LOD_LEVELS, LOD_SPEC } from '../lsystems/lod.js'

export default function LSystemPanel({ settings, preset, onChange, onPreset }) {
  const patch = (change) => onChange({ ...settings, ...change })

  return (
    <ControlPanel title="L-systems" hint="procedural geometry · rewrite rules + turtle">
      <Select
        label="Preset"
        tip="Three growth presets of the same L-system engine. Switching loads that preset's defaults."
        value={settings.preset}
        options={PRESETS.map(({ id, index, label }) => ({ id, label: `${index} ${label}` }))}
        onChange={onPreset}
      />
      <button type="button" className="action-button" onClick={() => onPreset(settings.preset)}>
        Reset Preset
      </button>

      <details className="control-section" open>
        <summary>Grammar</summary>
        <div className="section-controls">
          <Slider
            label="Iterations"
            tip="How many times every rule is applied to the string. Each pass grows the structure one generation."
            value={settings.iterations}
            min={1}
            max={preset.maxIterations}
            step={1}
            display={String(settings.iterations)}
            onChange={(iterations) => patch({ iterations: Math.round(iterations) })}
          />
          <Slider
            label="Seed"
            tip="Chooses between stochastic rules and drives the randomness. Same seed, same result."
            value={settings.seed}
            min={1}
            max={99}
            step={1}
            display={String(settings.seed)}
            onChange={(seed) => patch({ seed: Math.round(seed) })}
          />
          <Slider
            label="Growth"
            tip="Reveals the structure from the root outwards, by distance along the branches. Does not regenerate."
            value={settings.growth}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round(settings.growth * 100)}%`}
            onChange={(growth) => patch({ growth })}
          />
        </div>
      </details>

      <details className="control-section" open>
        <summary>Turtle</summary>
        <div className="section-controls">
          <Slider
            label="Angle"
            tip="Turn for + − (yaw) and & ^ (pitch). Roll / \ always uses the golden angle 137.5°."
            value={settings.angle}
            min={5}
            max={75}
            step={0.5}
            display={`${settings.angle.toFixed(1)}°`}
            onChange={(angle) => patch({ angle })}
          />
          <Slider
            label="Step Length"
            tip="Length of one F at the root."
            value={settings.step}
            min={0.04}
            max={1.6}
            step={0.01}
            display={settings.step.toFixed(2)}
            onChange={(step) => patch({ step })}
          />
          <Slider
            label="Length Decay"
            tip="Each branch ([) is this much shorter than its parent."
            value={settings.lengthDecay}
            min={0.4}
            max={1}
            step={0.01}
            display={settings.lengthDecay.toFixed(2)}
            onChange={(lengthDecay) => patch({ lengthDecay })}
          />
          <Slider
            label="Width"
            tip="Radius of the root segment."
            value={settings.width}
            min={0.005}
            max={0.12}
            step={0.001}
            display={settings.width.toFixed(3)}
            onChange={(width) => patch({ width })}
          />
          <Slider
            label="Width Decay"
            tip="Each branch ([) is this much thinner than its parent."
            value={settings.widthDecay}
            min={0.4}
            max={1}
            step={0.01}
            display={settings.widthDecay.toFixed(2)}
            onChange={(widthDecay) => patch({ widthDecay })}
          />
          <Slider
            label="Randomness"
            tip="Jitter on angles and lengths. Zero keeps the grammar perfectly regular."
            value={settings.randomness}
            min={0}
            max={1}
            step={0.01}
            display={settings.randomness.toFixed(2)}
            onChange={(randomness) => patch({ randomness })}
          />
          <Slider
            label="Tropism"
            tip="Bends every step towards world up (on the wall: up along the surface). Not used by flat tracery."
            value={settings.tropism}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.tropism.toFixed(2)}
            disabled={preset.placement === 'project'}
            onChange={(tropism) => patch({ tropism })}
          />
        </div>
      </details>

      <details className="control-section" open>
        <summary>Level of Detail</summary>
        <div className="section-controls">
          <Select
            label="LOD Mode"
            tip={`Auto picks the level from the camera distance: High below ${LOD_DISTANCE.medium}, Medium below ${LOD_DISTANCE.low}, Low beyond (10% hysteresis). Manual levels keep the camera, seed and grammar; only the mesh changes.`}
            value={settings.lodMode}
            options={[{ id: 'auto', label: 'Auto (distance)' }, ...LOD_LEVELS.map((id) => ({ id, label: LOD_SPEC[id].label }))]}
            onChange={(lodMode) => patch({ lodMode })}
          />
          <Toggle
            label="Wireframe"
            tip="Shows the triangles of the specimen, so the change in geometric detail between levels is visible."
            value={settings.wireframe}
            onChange={(wireframe) => patch({ wireframe })}
          />
        </div>
      </details>

      <details className="control-section" open>
        <summary>Display</summary>
        <div className="section-controls">
          <Toggle
            label="Show Architecture"
            tip="The shared test wall from Growth Lab."
            value={settings.showArchitecture}
            onChange={(showArchitecture) => patch({ showArchitecture })}
          />
          <Toggle
            label="Show Knots"
            tip="Terminal symbols (K): bosses, buds, or tracery foils."
            value={settings.showKnots}
            onChange={(showKnots) => patch({ showKnots })}
          />
        </div>
      </details>
    </ControlPanel>
  )
}
