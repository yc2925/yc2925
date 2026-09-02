import { PARTICLE_LIMITS, hueToCss } from './particleSettings.js'

function Slider({ label, value, min, max, step, display, className, onChange }) {
  return (
    <label className={`slider ${className ?? ''}`.trim()}>
      <span className="slider-meta">
        <span>{label}</span>
        <span>{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export default function SidePanel({ particles, onParticlesChange }) {
  const { spacing, hue, shape } = PARTICLE_LIMITS

  return (
    <aside className="side-panel" aria-label="Controls">
      <h2>Particles</h2>
      <p className="side-panel-hint">Orbit the canvas with the mouse. Use the sliders to shape the cloud.</p>

      <div className="slider-stack">
        <Slider
          label="Spacing"
          value={particles.spacing}
          min={spacing.min}
          max={spacing.max}
          step={spacing.step}
          display={particles.spacing.toFixed(2)}
          onChange={(spacingValue) =>
            onParticlesChange({ ...particles, spacing: spacingValue })
          }
        />
        <Slider
          className="slider-hue"
          label="Color"
          value={particles.hue}
          min={hue.min}
          max={hue.max}
          step={hue.step}
          display={
            <span className="color-readout">
              <span
                className="color-swatch"
                style={{ background: hueToCss(particles.hue) }}
              />
              {Math.round(particles.hue)}°
            </span>
          }
          onChange={(hueValue) => onParticlesChange({ ...particles, hue: hueValue })}
        />
        <Slider
          label="Shape"
          value={particles.shape}
          min={shape.min}
          max={shape.max}
          step={shape.step}
          display={`${Math.round(particles.shape * 100)}%`}
          onChange={(shapeValue) =>
            onParticlesChange({ ...particles, shape: shapeValue })
          }
        />
      </div>
    </aside>
  )
}
