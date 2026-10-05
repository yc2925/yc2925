import { Slider, Toggle } from './Controls.jsx'

export default function PathsControls({ settings, onChange, onReset }) {
  return (
    <>
      <details className="control-section" open>
        <summary>Paths</summary>
        <div className="section-controls">
          <Slider
            label="Path Count"
            tip="How many PRIMARY anchors from 01 Distribution start a path, most suitable first."
            value={settings.pathCount}
            min={1}
            max={24}
            step={1}
            display={String(settings.pathCount)}
            onChange={(pathCount) => onChange({ pathCount: Math.round(pathCount) })}
          />
          <Slider
            label="Path Length"
            tip="Target length of a primary path along the surface. Paths stop early at the facade boundary."
            value={settings.pathLength}
            min={0.5}
            max={6}
            step={0.1}
            display={settings.pathLength.toFixed(1)}
            onChange={(pathLength) => onChange({ pathLength })}
          />
          <Slider
            label="Vertical Growth"
            tip="Pull towards world up, projected onto the surface. Weak on ledge tops, strong on walls and columns."
            value={settings.verticalGrowth}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.verticalGrowth.toFixed(2)}
            onChange={(verticalGrowth) => onChange({ verticalGrowth })}
          />
          <Slider
            label="Feature Attraction"
            tip="Within reach of an arch, rib, column or ledge, paths turn to run along it and are drawn onto it."
            value={settings.pathFeature}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.pathFeature.toFixed(2)}
            onChange={(pathFeature) => onChange({ pathFeature })}
          />
          <Slider
            label="Organic Drift"
            tip="Low-frequency noise added to the direction, so paths are not mechanical."
            value={settings.organicDrift}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.organicDrift.toFixed(2)}
            onChange={(organicDrift) => onChange({ organicDrift })}
          />
          <Slider
            label="Curvature"
            tip="Steady curl around the surface normal, tightening towards the tip like a tendril."
            value={settings.curvature}
            min={0}
            max={1.5}
            step={0.01}
            display={settings.curvature.toFixed(2)}
            onChange={(curvature) => onChange({ curvature })}
          />
          <Slider
            label="Branch Probability"
            tip="Chance of each of two possible secondary paths. Secondaries are shorter, thinner and leave the parent at a shallow angle."
            value={settings.branchProbability}
            min={0}
            max={1}
            step={0.01}
            display={settings.branchProbability.toFixed(2)}
            onChange={(branchProbability) => onChange({ branchProbability })}
          />
          <Slider
            label="Surface Offset"
            tip="Gap between the surface and the path tube. Keeps the spline above the stone without z-fighting."
            value={settings.surfaceOffset}
            min={0}
            max={0.08}
            step={0.002}
            display={settings.surfaceOffset.toFixed(3)}
            onChange={(surfaceOffset) => onChange({ surfaceOffset })}
          />
          <Slider
            label="Relief Width"
            tip="Width of the raised stone rib swept along each spline (spline → mesh)."
            value={settings.reliefWidth}
            min={0.02}
            max={0.2}
            step={0.005}
            display={settings.reliefWidth.toFixed(3)}
            onChange={(reliefWidth) => onChange({ reliefWidth })}
          />
          <button type="button" className="action-button" onClick={onReset}>
            Reset Paths
          </button>
        </div>
      </details>

      <details className="control-section" open>
        <summary>Layers</summary>
        <div className="section-controls">
          <Toggle
            label="Show Anchors"
            tip="PRIMARY anchors from 01. Bright: used as path starts. Dark: unused."
            value={settings.showAnchors}
            onChange={(showAnchors) => onChange({ showAnchors })}
          />
          <Toggle
            label="Show Source Curve"
            tip="2D → 3D study: a 2D scroll in a plane in front of the portal, its projection rays, and the curve conformed to the architecture."
            value={settings.showSourceCurve}
            onChange={(showSourceCurve) => onChange({ showSourceCurve })}
          />
          <Toggle
            label="Show Projected Paths"
            tip="Surface-following splines grown from the anchors (mesh → spline)."
            value={settings.showPaths}
            onChange={(showPaths) => onChange({ showPaths })}
          />
          <Toggle
            label="Show Relief"
            tip="Shallow stone rib swept along each spline (spline → mesh)."
            value={settings.showRelief}
            onChange={(showRelief) => onChange({ showRelief })}
          />
        </div>
      </details>
    </>
  )
}
