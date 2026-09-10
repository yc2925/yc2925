import {
  formatTypeAmount,
  NOISE_LIMITS,
  NOISE_TIPS,
  NOISE_TYPES,
  patchLayer,
  SHAPING_OPS,
  shapingAmountLabel,
  shapingAmountTip,
  typeAmountLabel,
  typeAmountTip,
} from '../noise/settings.js'
import { ControlPanel, LabelWithTip, Select, Slider, Toggle } from './Controls.jsx'

export function NoiseControls({ noise, onNoiseChange }) {
  const limits = NOISE_LIMITS
  const active = noise.activeLayer
  const layer = noise.layers[active]
  const shapingDisabled = layer.shaping === 'none'

  function setLayer(patch) {
    onNoiseChange(patchLayer(noise, active, patch))
  }

  return (
    <>
      <Slider
        label="Resolution"
        tip={NOISE_TIPS.resolution}
        value={noise.resolution}
        min={limits.resolution.min}
        max={limits.resolution.max}
        step={limits.resolution.step}
        display={String(Math.round(noise.resolution))}
        onChange={(resolution) => onNoiseChange({ ...noise, resolution })}
      />
      <Slider
        label="Height"
        tip={NOISE_TIPS.amplitude}
        value={noise.amplitude}
        min={limits.amplitude.min}
        max={limits.amplitude.max}
        step={limits.amplitude.step}
        display={noise.amplitude.toFixed(2)}
        onChange={(amplitude) => onNoiseChange({ ...noise, amplitude })}
      />

      <div className="layer-picker">
        <LabelWithTip tip={NOISE_TIPS.layer}>Layer</LabelWithTip>
        <div className="layer-tabs" role="tablist" aria-label="Noise layers">
          {noise.layers.map((item, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === active}
              className={`${index === active ? 'is-active' : ''} ${item.enabled ? 'is-on' : ''}`.trim()}
              onClick={() => onNoiseChange({ ...noise, activeLayer: index })}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      <Toggle
        label="Enable"
        tip={NOISE_TIPS.enable}
        value={layer.enabled}
        onChange={(enabled) => setLayer({ enabled })}
      />
      <Slider
        label="Blend"
        tip={NOISE_TIPS.blend}
        value={layer.blend}
        min={limits.blend.min}
        max={limits.blend.max}
        step={limits.blend.step}
        display={`${Math.round(layer.blend * 100)}%`}
        disabled={!layer.enabled}
        onChange={(blend) => setLayer({ blend })}
      />
      <Select
        label="Type"
        tip={NOISE_TIPS.type}
        value={layer.type}
        options={NOISE_TYPES}
        onChange={(type) => setLayer({ type })}
      />
      <Slider
        label={typeAmountLabel(layer.type)}
        tip={typeAmountTip(layer.type)}
        value={layer.typeAmount}
        min={limits.typeAmount.min}
        max={limits.typeAmount.max}
        step={limits.typeAmount.step}
        display={formatTypeAmount(layer.type, layer.typeAmount)}
        disabled={!layer.enabled}
        onChange={(typeAmount) => setLayer({ typeAmount })}
      />
      <Select
        label="Shaping"
        tip={NOISE_TIPS.shaping}
        value={layer.shaping}
        options={SHAPING_OPS}
        onChange={(shaping) => setLayer({ shaping })}
      />
      <Slider
        label={shapingAmountLabel(layer.shaping)}
        tip={shapingAmountTip(layer.shaping)}
        value={layer.shapeAmount}
        min={limits.shapeAmount.min}
        max={limits.shapeAmount.max}
        step={limits.shapeAmount.step}
        display={`${Math.round(layer.shapeAmount * 100)}%`}
        disabled={shapingDisabled || !layer.enabled}
        onChange={(shapeAmount) => setLayer({ shapeAmount })}
      />
      <Slider
        label="Frequency"
        tip={NOISE_TIPS.frequency}
        value={layer.frequency}
        min={limits.frequency.min}
        max={limits.frequency.max}
        step={limits.frequency.step}
        display={layer.frequency.toFixed(2)}
        disabled={!layer.enabled}
        onChange={(frequency) => setLayer({ frequency })}
      />
      <Slider
        label="Octaves"
        tip={NOISE_TIPS.octaves}
        value={layer.octaves}
        min={limits.octaves.min}
        max={limits.octaves.max}
        step={limits.octaves.step}
        display={String(Math.round(layer.octaves))}
        disabled={!layer.enabled}
        onChange={(octaves) => setLayer({ octaves })}
      />
      <Slider
        label="Persist"
        tip={NOISE_TIPS.persistence}
        value={layer.persistence}
        min={limits.persistence.min}
        max={limits.persistence.max}
        step={limits.persistence.step}
        display={layer.persistence.toFixed(2)}
        disabled={!layer.enabled}
        onChange={(persistence) => setLayer({ persistence })}
      />
      <Slider
        label="Lacunarity"
        tip={NOISE_TIPS.lacunarity}
        value={layer.lacunarity}
        min={limits.lacunarity.min}
        max={limits.lacunarity.max}
        step={limits.lacunarity.step}
        display={layer.lacunarity.toFixed(2)}
        disabled={!layer.enabled}
        onChange={(lacunarity) => setLayer({ lacunarity })}
      />
      <Slider
        label="Seed"
        tip={NOISE_TIPS.seed}
        value={layer.seed}
        min={limits.seed.min}
        max={limits.seed.max}
        step={limits.seed.step}
        display={String(Math.round(layer.seed))}
        disabled={!layer.enabled}
        onChange={(seed) => setLayer({ seed })}
      />
    </>
  )
}

export default function NoisePanel(props) {
  return (
    <ControlPanel title="Noise" hint="blend up to three layers · 2d drives 3d">
      <NoiseControls {...props} />
    </ControlPanel>
  )
}