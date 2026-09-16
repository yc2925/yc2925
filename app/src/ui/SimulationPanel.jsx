import { useState } from 'react'
import { EROSION_LIMITS, EROSION_TIPS } from '../simulation/settings.js'
import { ControlPanel, Slider, Toggle } from './Controls.jsx'
import { NoiseControls } from './NoisePanel.jsx'

function Section({ title, children, open = false }) {
  const [expanded, setExpanded] = useState(open)

  return (
    <details
      className="control-section"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      <div className="section-controls">{children}</div>
    </details>
  )
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  const tenths = Math.floor((seconds % 1) * 10)
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}.${tenths}`
}

function Timeline({
  recording,
  reviewing,
  elapsed,
  duration,
  frameCount,
  cursor,
  onCursorChange,
  onStart,
  onStop,
  onLive,
}) {
  const timelineMax = Math.max(1, duration)

  return (
    <section className="recording-block">
      <div className="recording-status">
        <span className={recording ? 'record-dot is-live' : 'record-dot'} />
        <span>
          {recording
            ? 'Recording'
            : reviewing
              ? 'Review'
              : frameCount > 0
                ? `${frameCount} frames`
                : 'Ready'}
        </span>
        <span>{formatTime(recording ? elapsed : reviewing ? cursor : elapsed)}</span>
      </div>

      <div className="transport">
        <button type="button" className="transport-start" onClick={onStart} disabled={recording}>
          Record
        </button>
        <button type="button" onClick={onStop} disabled={!recording}>
          Stop
        </button>
        <button type="button" onClick={onLive} disabled={!reviewing}>
          Live
        </button>
      </div>

      <label className="timeline">
        <span className="timeline-scale">
          <span>In · 00:00</span>
          <span>Out · {formatTime(duration)}</span>
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

function Readout({ label, value, unit }) {
  return (
    <div className="telemetry-row">
      <span>{label}</span>
      <span>
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
    </div>
  )
}

function Telemetry({ values }) {
  const compact = (value) =>
    value >= 1000 ? value.toExponential(2) : value >= 10 ? value.toFixed(1) : value.toFixed(3)

  return (
    <div className="telemetry-grid">
      <Readout label="Total water" value={compact(values.totalWater)} />
      <Readout label="Avg depth" value={compact(values.averageWater)} />
      <Readout label="Max depth" value={compact(values.maxWater)} />
      <Readout label="Rainfall" value={compact(values.rainfallRate)} unit="/s" />
      <Readout label="Evaporation" value={compact(values.evaporationRate)} unit="/s" />
      <Readout label="Outflow" value={compact(values.outflowRate)} unit="/s" />
      <Readout label="Eroded" value={compact(values.erodedMaterial)} />
      <Readout label="Deposited" value={compact(values.depositedMaterial)} />
      <Readout label="Sediment" value={compact(values.sedimentLoad)} />
      <Readout
        label="Vegetation coverage"
        value={(values.vegetationCoverage * 100).toFixed(1)}
        unit="%"
      />
      <Readout label="Soil moisture" value={(values.soilMoisture * 100).toFixed(1)} unit="%" />
      <Readout
        label="Growth rate"
        value={compact(values.vegetationGrowthRate)}
        unit="/s"
      />
      <Readout
        label="Die-off rate"
        value={compact(values.vegetationDieOffRate)}
        unit="/s"
      />
    </div>
  )
}

export default function SimulationPanel({
  noise,
  onNoiseChange,
  erosion,
  onErosionChange,
  telemetry,
  recorder,
}) {
  const limits = EROSION_LIMITS
  const patch = (change) => onErosionChange({ ...erosion, ...change })

  return (
    <ControlPanel title="World system" hint="terrain · hydrology · erosion · ocean">
      <Section title="Simulation" open>
        <Toggle
          label="Run / Pause"
          tip={EROSION_TIPS.running}
          value={erosion.running}
          onChange={(running) => patch({ running })}
        />
        <button type="button" className="action-button action-danger" onClick={recorder.onReset}>
          Reset world + history
        </button>
        <Slider
          label="Simulation speed"
          tip={EROSION_TIPS.simulationSpeed}
          value={erosion.simulationSpeed}
          min={limits.simulationSpeed.min}
          max={limits.simulationSpeed.max}
          step={limits.simulationSpeed.step}
          display={`${erosion.simulationSpeed.toFixed(1)}×`}
          onChange={(simulationSpeed) => patch({ simulationSpeed })}
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

      <Section title="Precipitation" open>
        <Slider
          label="Rain intensity"
          tip={EROSION_TIPS.rain}
          value={erosion.rain}
          min={limits.rain.min}
          max={limits.rain.max}
          step={limits.rain.step}
          display={erosion.rain.toFixed(3)}
          onChange={(rain) => patch({ rain })}
        />
        <Slider
          label="Rain variation"
          tip={EROSION_TIPS.rainVariation}
          value={erosion.rainVariation}
          min={limits.rainVariation.min}
          max={limits.rainVariation.max}
          step={limits.rainVariation.step}
          display={`${Math.round(erosion.rainVariation * 100)}%`}
          onChange={(rainVariation) => patch({ rainVariation })}
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
          label="Rain movement"
          tip={EROSION_TIPS.rainMovement}
          value={erosion.rainMovement}
          min={limits.rainMovement.min}
          max={limits.rainMovement.max}
          step={limits.rainMovement.step}
          display={erosion.rainMovement.toFixed(3)}
          onChange={(rainMovement) => patch({ rainMovement })}
        />
      </Section>

      <Section title="Hydrology" open>
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
          label="Evaporation"
          tip={EROSION_TIPS.evaporation}
          value={erosion.evaporation}
          min={limits.evaporation.min}
          max={limits.evaporation.max}
          step={limits.evaporation.step}
          display={erosion.evaporation.toFixed(3)}
          onChange={(evaporation) => patch({ evaporation })}
        />
      </Section>

      <Section title="Erosion" open>
        <Slider
          label="Erosion strength"
          tip={EROSION_TIPS.erosionStrength}
          value={erosion.erosionStrength}
          min={limits.erosionStrength.min}
          max={limits.erosionStrength.max}
          step={limits.erosionStrength.step}
          display={erosion.erosionStrength.toFixed(2)}
          onChange={(erosionStrength) => patch({ erosionStrength })}
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
          label="Sediment capacity"
          tip={EROSION_TIPS.capacity}
          value={erosion.capacity}
          min={limits.capacity.min}
          max={limits.capacity.max}
          step={limits.capacity.step}
          display={erosion.capacity.toFixed(2)}
          onChange={(capacity) => patch({ capacity })}
        />
        <Slider
          label="Deposition rate"
          tip={EROSION_TIPS.deposition}
          value={erosion.deposition}
          min={limits.deposition.min}
          max={limits.deposition.max}
          step={limits.deposition.step}
          display={erosion.deposition.toFixed(2)}
          onChange={(deposition) => patch({ deposition })}
        />
      </Section>

      <Section title="Ocean" open>
        <Slider
          label="Ocean level"
          tip={EROSION_TIPS.oceanLevel}
          value={erosion.oceanLevel}
          min={limits.oceanLevel.min}
          max={limits.oceanLevel.max}
          step={limits.oceanLevel.step}
          display={erosion.oceanLevel.toFixed(2)}
          onChange={(oceanLevel) => patch({ oceanLevel })}
        />
        <Slider
          label="Wave height"
          tip={EROSION_TIPS.waveHeight}
          value={erosion.waveHeight}
          min={limits.waveHeight.min}
          max={limits.waveHeight.max}
          step={limits.waveHeight.step}
          display={erosion.waveHeight.toFixed(3)}
          onChange={(waveHeight) => patch({ waveHeight })}
        />
        <Slider
          label="Wave scale"
          tip={EROSION_TIPS.waveScale}
          value={erosion.waveScale}
          min={limits.waveScale.min}
          max={limits.waveScale.max}
          step={limits.waveScale.step}
          display={erosion.waveScale.toFixed(2)}
          onChange={(waveScale) => patch({ waveScale })}
        />
        <Slider
          label="Wave speed"
          tip={EROSION_TIPS.waveSpeed}
          value={erosion.waveSpeed}
          min={limits.waveSpeed.min}
          max={limits.waveSpeed.max}
          step={limits.waveSpeed.step}
          display={erosion.waveSpeed.toFixed(2)}
          onChange={(waveSpeed) => patch({ waveSpeed })}
        />
      </Section>

      <Section title="Vegetation" open>
        <Toggle
          label="Enabled"
          tip={EROSION_TIPS.vegetationEnabled}
          value={erosion.vegetationEnabled}
          onChange={(vegetationEnabled) => patch({ vegetationEnabled })}
        />
        <Slider
          label="Growth rate"
          tip={EROSION_TIPS.growthRate}
          value={erosion.growthRate}
          min={limits.growthRate.min}
          max={limits.growthRate.max}
          step={limits.growthRate.step}
          display={erosion.growthRate.toFixed(2)}
          onChange={(growthRate) => patch({ growthRate })}
        />
        <Slider
          label="Moisture preference"
          tip={EROSION_TIPS.moisturePreference}
          value={erosion.moisturePreference}
          min={limits.moisturePreference.min}
          max={limits.moisturePreference.max}
          step={limits.moisturePreference.step}
          display={`${Math.round(erosion.moisturePreference * 100)}%`}
          onChange={(moisturePreference) => patch({ moisturePreference })}
        />
        <Slider
          label="Elevation range"
          tip={EROSION_TIPS.elevationRange}
          value={erosion.elevationRange}
          min={limits.elevationRange.min}
          max={limits.elevationRange.max}
          step={limits.elevationRange.step}
          display={erosion.elevationRange.toFixed(2)}
          onChange={(elevationRange) => patch({ elevationRange })}
        />
        <Slider
          label="Slope tolerance"
          tip={EROSION_TIPS.slopeTolerance}
          value={erosion.slopeTolerance}
          min={limits.slopeTolerance.min}
          max={limits.slopeTolerance.max}
          step={limits.slopeTolerance.step}
          display={erosion.slopeTolerance.toFixed(2)}
          onChange={(slopeTolerance) => patch({ slopeTolerance })}
        />
        <Slider
          label="Spread"
          tip={EROSION_TIPS.spread}
          value={erosion.spread}
          min={limits.spread.min}
          max={limits.spread.max}
          step={limits.spread.step}
          display={`${Math.round(erosion.spread * 100)}%`}
          onChange={(spread) => patch({ spread })}
        />
        <Slider
          label="Die-off rate"
          tip={EROSION_TIPS.dieOffRate}
          value={erosion.dieOffRate}
          min={limits.dieOffRate.min}
          max={limits.dieOffRate.max}
          step={limits.dieOffRate.step}
          display={erosion.dieOffRate.toFixed(2)}
          onChange={(dieOffRate) => patch({ dieOffRate })}
        />
        <Slider
          label="Erosion resistance"
          tip={EROSION_TIPS.erosionResistance}
          value={erosion.erosionResistance}
          min={limits.erosionResistance.min}
          max={limits.erosionResistance.max}
          step={limits.erosionResistance.step}
          display={`${Math.round(erosion.erosionResistance * 100)}%`}
          onChange={(erosionResistance) => patch({ erosionResistance })}
        />
      </Section>

      <Section title="Display">
        <Toggle
          label="Terrain"
          tip={EROSION_TIPS.terrain}
          value={erosion.showTerrain}
          onChange={(showTerrain) => patch({ showTerrain })}
        />
        <Toggle
          label="Water"
          tip={EROSION_TIPS.water}
          value={erosion.showWater}
          onChange={(showWater) => patch({ showWater })}
        />
        <Toggle
          label="Rain"
          tip={EROSION_TIPS.rainView}
          value={erosion.showRain}
          onChange={(showRain) => patch({ showRain })}
        />
        <Toggle
          label="Wireframe · W"
          tip={EROSION_TIPS.wireframe}
          value={erosion.wireframe}
          onChange={(wireframe) => patch({ wireframe })}
        />
        <Toggle
          label="Erosion overlay"
          tip={EROSION_TIPS.erosionView}
          value={erosion.showErosion}
          onChange={(showErosion) => patch({ showErosion })}
        />
        <Toggle
          label="Vegetation visibility"
          tip={EROSION_TIPS.vegetationView}
          value={erosion.showVegetation}
          onChange={(showVegetation) => patch({ showVegetation })}
        />
        <Toggle
          label="Soil moisture visualization"
          tip={EROSION_TIPS.soilMoistureView}
          value={erosion.showSoilMoisture}
          onChange={(showSoilMoisture) => patch({ showSoilMoisture })}
        />
      </Section>

      <Section title="Telemetry" open>
        <Telemetry values={telemetry} />
      </Section>

      <Section title="Recording">
        <Timeline {...recorder} />
      </Section>

      <Section title="Noise source">
        <NoiseControls noise={noise} onNoiseChange={onNoiseChange} />
      </Section>
    </ControlPanel>
  )
}
