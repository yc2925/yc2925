/**
 * Shared SCALE controls for Gothic / Ornament / Agent panels.
 */

import { Slider, Toggle } from './Controls.jsx'
import { formatMeters } from '../scale/units.js'
import { DEFAULT_SCALE_SETTINGS } from '../scale/config.js'

export default function ScaleSection({
  settings,
  onPatch,
  onFitToObject,
  showArchitecturalDims = true,
  open = false,
}) {
  const patch = onPatch
  const scale = settings.architecturalScale ?? DEFAULT_SCALE_SETTINGS.architecturalScale
  const height = settings.overallHeight ?? DEFAULT_SCALE_SETTINGS.overallHeight
  const width = settings.overallWidth ?? DEFAULT_SCALE_SETTINGS.overallWidth

  return (
    <details className="control-section" open={open}>
      <summary>Scale</summary>
      <div className="section-controls">
        <p className="control-hint">1 world unit = 1 meter. Physical scale is independent of procedural complexity.</p>
        <Slider
          label="World Unit"
          tip="Fixed convention: one world unit equals one meter. Not adjustable."
          value={1}
          min={1}
          max={1}
          step={1}
          display="1 m"
          disabled
          onChange={() => {}}
        />
        {showArchitecturalDims ? (
          <>
            <Slider
              label="Architectural Height"
              tip="Design height in meters (before architectural scale multiplier)."
              value={height}
              min={2}
              max={12}
              step={0.1}
              display={formatMeters(height, 1)}
              onChange={(overallHeight) => patch({ overallHeight })}
            />
            <Slider
              label="Architectural Width"
              tip="Design width in meters (before architectural scale multiplier)."
              value={width}
              min={1.5}
              max={14}
              step={0.1}
              display={formatMeters(width, 1)}
              onChange={(overallWidth) => patch({ overallWidth })}
            />
          </>
        ) : null}
        <Slider
          label="Architectural Scale"
          tip="Uniform multiplier on architecture / ornament / agent lengths. Does not change branch count or density."
          value={scale}
          min={0.5}
          max={2}
          step={0.05}
          display={`${scale.toFixed(2)}×`}
          onChange={(architecturalScale) => patch({ architecturalScale })}
        />
        <Toggle
          label="Scale Reference"
          tip="Ground plane + metric scale bar overlays (not exported with ornament)."
          value={!!settings.showScaleReference}
          onChange={(showScaleReference) => patch({ showScaleReference })}
        />
        <Toggle
          label="Show Dimensions"
          tip="Height and width dimension markers in meters."
          value={!!settings.showDimensions}
          onChange={(showDimensions) => patch({ showDimensions })}
        />
        <Toggle
          label="Show Human Reference"
          tip="Neutral ~1.7 m silhouette for proportion checks."
          value={!!settings.showHumanReference}
          onChange={(showHumanReference) => patch({ showHumanReference })}
        />
        {typeof onFitToObject === 'function' ? (
          <button
            type="button"
            className="action-button"
            onClick={onFitToObject}
          >
            Fit to Object
          </button>
        ) : null}
      </div>
    </details>
  )
}
