/**
 * Shared LEVEL OF DETAIL controls (Step 12B).
 */

import { Select, Slider, Toggle } from './Controls.jsx'
import { DEFAULT_LOD_SETTINGS, LOD_LABELS } from '../lod/config.js'

const LOD_MODE_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

export default function LodSection({
  settings,
  onPatch,
  onFitToObject,
  activeLevel = null,
  open = false,
  showFit = true,
}) {
  const patch = onPatch
  const enableAuto = settings.enableAutoLod !== false
  const mode = settings.lodMode ?? DEFAULT_LOD_SETTINGS.lodMode
  const bias = settings.lodBias ?? 0

  return (
    <details className="control-section" open={open}>
      <summary>Level of Detail</summary>
      <div className="section-controls">
        <p className="control-hint">
          LOD changes mesh tessellation only — not topology, agents, or physical scale.
        </p>
        <Toggle
          label="Enable Auto LOD"
          tip="When on and mode is Auto, LOD follows projected screen size."
          value={enableAuto}
          onChange={(enableAutoLod) =>
            patch({
              enableAutoLod,
              lodMode: enableAutoLod ? 'auto' : settings.lodMode === 'auto' ? 'high' : settings.lodMode,
            })
          }
        />
        <Select
          label="LOD Mode"
          tip="Auto uses screen-space size. Manual locks High / Medium / Low."
          value={mode}
          options={LOD_MODE_OPTIONS}
          onChange={(lodMode) =>
            patch({
              lodMode,
              enableAutoLod: lodMode === 'auto' ? true : settings.enableAutoLod,
            })
          }
        />
        <Slider
          label="LOD Bias"
          tip="Positive bias prefers higher detail at the same screen size."
          value={bias}
          min={-1}
          max={1}
          step={0.05}
          display={bias.toFixed(2)}
          onChange={(lodBias) => patch({ lodBias })}
        />
        <Toggle
          label="Show LOD Debug"
          tip="Bounds wire + active level colour. Does not alter geometry."
          value={!!settings.showLodDebug}
          onChange={(showLodDebug) => patch({ showLodDebug })}
        />
        {activeLevel ? (
          <p className="control-hint">
            Active: {LOD_LABELS[activeLevel] ?? activeLevel}
            {mode === 'auto' && enableAuto ? ' (auto)' : ' (manual)'}
          </p>
        ) : null}
        {showFit && typeof onFitToObject === 'function' ? (
          <button type="button" className="action-button" onClick={onFitToObject}>
            Fit to Object
          </button>
        ) : null}
      </div>
    </details>
  )
}
