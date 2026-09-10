import { hueToCss, PARTICLE_LIMITS, PARTICLE_TIPS } from '../particleSettings.js'
import { ControlPanel, Slider } from '../ui/Controls.jsx'

export default function ParticlesPanel({ particles, onParticlesChange }) {
  const { spacing, hue, shape } = PARTICLE_LIMITS

  return (
    <ControlPanel title="Particles" hint="orbit drag · edit params">
      <Slider
        label="Spacing"
        tip={PARTICLE_TIPS.spacing}
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
        tip={PARTICLE_TIPS.hue}
        value={particles.hue}
        min={hue.min}
        max={hue.max}
        step={hue.step}
        display={
          <span className="color-readout">
            <span className="color-swatch" style={{ background: hueToCss(particles.hue) }} />
            {Math.round(particles.hue)}°
          </span>
        }
        onChange={(hueValue) => onParticlesChange({ ...particles, hue: hueValue })}
      />
      <Slider
        label="Shape"
        tip={PARTICLE_TIPS.shape}
        value={particles.shape}
        min={shape.min}
        max={shape.max}
        step={shape.step}
        display={`${Math.round(particles.shape * 100)}%`}
        onChange={(shapeValue) => onParticlesChange({ ...particles, shape: shapeValue })}
      />
    </ControlPanel>
  )
}
