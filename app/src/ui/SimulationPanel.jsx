import { EROSION_LIMITS, EROSION_TIPS } from '../simulation/settings.js'
import { ControlPanel, Slider, Toggle } from './Controls.jsx'
import { NoiseControls } from './NoisePanel.jsx'

function Section({ title, children, open = false }) {
  return (
    <details className="control-section" open={open}>
      <summary>{title}</summary>
      <div className="section-controls">{children}</div>
    </details>
  )
}

function Timeline({
  recording,
  elapsed,
  duration,
  frameCount,
  cursor,
  onCursorChange,
  onStart,
  onStop,
  onReset,
}) {
  const timelineMax = Math.max(1, duration)

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainder = Math.floor(seconds % 60)
    const tenths = Math.floor((seconds % 1) * 10)
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}.${tenths}`
  }

  return (
    <section className="recording-block">
      <div className="recording-status">
        <span className={recording ? 'record-dot is-live' : 'record-dot'} />
        <span>{recording ? 'Recording' : frameCount > 0 ? `${frameCount} frames` : 'Ready'}</span>
        <span>{formatTime(elapsed)}</span>
      </div>

      <div className="transport">
        <button type="button" className="transport-start" onClick={onStart} disabled={recording}>
          Start
        </button>
        <button type="button" onClick={onStop} disabled={!recording}>
          Stop
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>

      <label className="timeline">
        <span className="timeline-scale">
          <span>Start · 00:00</span>
          <span>End · {formatTime(duration)}</span>
        </span>
        <input
          type="range"
          min="0"
          max={timelineMax}
          step="0.1"
          value={cursor}
          disabled={frameCount === 0 || recording}
          style={{ '--recorded': duration > 0 ? '100%' : '0%' }}
          onChange={(event) => onCursorChange(Number(event.target.value))}
        />
      </label>
    </section>
  )
}

export default function SimulationPanel({
  noise,
  onNoiseChange,
  erosion,
  onErosionChange,
  recorder,
}) {
  const limits = EROSION_LIMITS
  const patch = (change) => onErosionChange({ ...erosion, ...change })

  return (
    <ControlPanel title="Simulation" hint="record to trigger rainfall · stop to review">
      <Timeline {...recorder} />

      <Section title="Hydraulics" open>
        <Toggle
          label="Run"
          tip={EROSION_TIPS.running}
          value={erosion.running}
          onChange={(running) => patch({ running })}
        />
        <Toggle
          label="Rainmap"
          tip={EROSION_TIPS.rainmap}
          value={erosion.rainmap}
          onChange={(rainmap) => patch({ rainmap })}
        />
        <Toggle
          label="Scour"
          tip={EROSION_TIPS.scourView}
          value={erosion.showScour}
          onChange={(showScour) => patch({ showScour })}
        />
        <Toggle
          label="Water"
          tip={EROSION_TIPS.water}
          value={erosion.showWater}
          onChange={(showWater) => patch({ showWater })}
        />
        <Toggle
          label="Wireframe · W"
          tip={EROSION_TIPS.wireframe}
          value={erosion.wireframe}
          onChange={(wireframe) => patch({ wireframe })}
        />
        <Slider
          label="Rain"
          tip={EROSION_TIPS.rain}
          value={erosion.rain}
          min={limits.rain.min}
          max={limits.rain.max}
          step={limits.rain.step}
          display={erosion.rain.toFixed(3)}
          onChange={(rain) => patch({ rain })}
        />
        <Slider
          label="Rain scale"
          tip={EROSION_TIPS.rainScale}
          value={erosion.rainScale}
          min={limits.rainScale.min}
          max={limits.rainScale.max}
          step={limits.rainScale.step}
          display={erosion.rainScale.toFixed(1)}
          onChange={(rainScale) => patch({ rainScale })}
        />
        <Slider
          label="Flow"
          tip={EROSION_TIPS.flow}
          value={erosion.flow}
          min={limits.flow.min}
          max={limits.flow.max}
          step={limits.flow.step}
          display={erosion.flow.toFixed(2)}
          onChange={(flow) => patch({ flow })}
        />
        <Slider
          label="Capacity"
          tip={EROSION_TIPS.capacity}
          value={erosion.capacity}
          min={limits.capacity.min}
          max={limits.capacity.max}
          step={limits.capacity.step}
          display={erosion.capacity.toFixed(2)}
          onChange={(capacity) => patch({ capacity })}
        />
        <Slider
          label="Scour rate"
          tip={EROSION_TIPS.scour}
          value={erosion.scour}
          min={limits.scour.min}
          max={limits.scour.max}
          step={limits.scour.step}
          display={erosion.scour.toFixed(2)}
          onChange={(scour) => patch({ scour })}
        />
        <Slider
          label="Deposit"
          tip={EROSION_TIPS.deposition}
          value={erosion.deposition}
          min={limits.deposition.min}
          max={limits.deposition.max}
          step={limits.deposition.step}
          display={erosion.deposition.toFixed(2)}
          onChange={(deposition) => patch({ deposition })}
        />
        <Slider
          label="Evaporate"
          tip={EROSION_TIPS.evaporation}
          value={erosion.evaporation}
          min={limits.evaporation.min}
          max={limits.evaporation.max}
          step={limits.evaporation.step}
          display={erosion.evaporation.toFixed(3)}
          onChange={(evaporation) => patch({ evaporation })}
        />
        <Slider
          label="Steps / frame"
          tip={EROSION_TIPS.iterations}
          value={erosion.iterations}
          min={limits.iterations.min}
          max={limits.iterations.max}
          step={limits.iterations.step}
          display={String(erosion.iterations)}
          onChange={(iterations) => patch({ iterations })}
        />
      </Section>

      <Section title="Noise source">
        <NoiseControls noise={noise} onNoiseChange={onNoiseChange} />
      </Section>
    </ControlPanel>
  )
}
