/**
 * Gothic Grammar controls — Steps 13A.1 / 13B / 13C / 13D / 13D.2.
 */

import { ControlPanel, Select, Toggle, Slider } from './Controls.jsx'
import {
  CONSTRUCTION_MODES,
  PRIMITIVE_TOOLS,
  WORKSPACE_CATEGORIES,
  DESIGN_WORKSPACES,
  TECHNICAL_WORKSPACES,
  DISPLAY_STATES,
  STONE_DISPLAY_MODES,
  STONE_INSPECT_LAYERS,
  STONE_VIEW_PRESETS,
  ASSEMBLY_VIEW_PRESETS,
  ASSEMBLY_INSPECT_LAYERS,
  SEMANTIC_VIEW_OPTIONS,
  UI_CONTROL_TIERS,
  DEPTH_ALIGNMENT_OPTIONS,
  TESSELLATION_OPTIONS,
  PROFILE_TYPE_OPTIONS,
  DEFAULT_STONE_SETTINGS,
  DEFAULT_ASSEMBLY_SETTINGS,
  DEFAULT_CONSTRUCTION_OVERLAY,
  ASSEMBLY_TYPES,
  VARIATION_MODES,
  SUPPORT_STYLES,
  SHAFT_ARRANGEMENTS,
  WINDOW_LINK_MODES,
  COMPARE_MODES,
  ARCHITECTURE_PRESET_OPTIONS,
  applyArchitecturePreset,
  applyWorkspaceNavigation,
  resetGothicGrammar,
  ARCH_FAMILY_META,
  EQUILATERAL_RISE_RATIO,
  DEFAULT_ARCH_SETTINGS,
  DEFAULT_TRACERY_SETTINGS,
  TRACERY_EXAMPLES,
  FOIL_TYPES,
  GROWTH_DISTRIBUTION_OPTIONS,
  GROWTH_PLACEMENT_MODE_OPTIONS,
  DEFAULT_FOLIATE_SETTINGS,
  FOLIATE_WORKSPACE_ID,
  COMPOSITION_MODES,
  MOTIF_TYPES,
} from '../geometry/gothicGrammar/settings.js'
import { resolveMemberWidths } from '../geometry/gothicGrammar/tracery/memberHierarchy.js'
import {
  supportStyleUsesShafts,
  supportStyleUsesButtress,
  supportStyleUsesBaseCapital,
} from '../geometry/gothicGrammar/assemblies/articulatedSupport.js'
import { KERNEL_STATUS, KERNEL_VERSION } from '../geometry/gothicGrammar/kernel/index.js'
import {
  PRIMARY_REFERENCES,
  WORKING_FAMILY,
  TRACERY_STATUS,
} from '../geometry/gothicGrammar/tracery/index.js'
import { applyTraceryExample } from '../geometry/gothicGrammar/tracery/traceryExamples.js'
import {
  EXAMPLE_IDS,
  DEFAULT_EXAMPLE_PARAMS,
} from '../geometry/gothicGrammar/examples.js'

function controlTierAllows(tier, needed) {
  const t = tier ?? 'essential'
  if (needed === 'essential') return true
  if (needed === 'advanced') return t === 'advanced' || t === 'debug'
  if (needed === 'debug') return t === 'debug'
  return false
}

function UpcomingList({ items }) {
  return (
    <ul className="gothic-grammar-upcoming" aria-label="Upcoming tools">
      {items.map((item) => (
        <li key={item.id} className={item.enabled ? 'is-ready' : 'is-upcoming'}>
          <span>{item.label}</span>
          <span className="gothic-grammar-upcoming-tag">{item.enabled ? 'ready' : 'upcoming'}</span>
        </li>
      ))}
    </ul>
  )
}

function ParamSliders({ exampleId, params, onPatch }) {
  const set = (key, value) => onPatch({ ...params, [key]: value })
  const p = params ?? {}

  switch (exampleId) {
    case 'points-lines':
      return (
        <>
          <Slider label="A.x" tip="Endpoint A x (m)" value={p.ax} min={-2.5} max={2.5} step={0.05} display={`${(p.ax ?? 0).toFixed(2)} m`} onChange={(v) => set('ax', v)} />
          <Slider label="A.y" tip="Endpoint A y (m)" value={p.ay} min={-0.5} max={3.5} step={0.05} display={`${(p.ay ?? 0).toFixed(2)} m`} onChange={(v) => set('ay', v)} />
          <Slider label="B.x" tip="Endpoint B x (m)" value={p.bx} min={-2.5} max={2.5} step={0.05} display={`${(p.bx ?? 0).toFixed(2)} m`} onChange={(v) => set('bx', v)} />
          <Slider label="B.y" tip="Endpoint B y (m)" value={p.by} min={-0.5} max={3.5} step={0.05} display={`${(p.by ?? 0).toFixed(2)} m`} onChange={(v) => set('by', v)} />
          <Slider label="C.x" tip="Cross segment start x (m)" value={p.cx} min={-2.5} max={2.5} step={0.05} display={`${(p.cx ?? 0).toFixed(2)} m`} onChange={(v) => set('cx', v)} />
          <Slider label="C.y" tip="Cross segment start y (m)" value={p.cy} min={-0.5} max={3.5} step={0.05} display={`${(p.cy ?? 0).toFixed(2)} m`} onChange={(v) => set('cy', v)} />
        </>
      )
    case 'circle-intersections':
      return (
        <>
          <Slider label="O1.x" value={p.x1} min={-2} max={2} step={0.05} display={`${(p.x1 ?? 0).toFixed(2)} m`} onChange={(v) => set('x1', v)} tip="First circle center x" />
          <Slider label="O1.y" value={p.y1} min={0} max={3} step={0.05} display={`${(p.y1 ?? 0).toFixed(2)} m`} onChange={(v) => set('y1', v)} tip="First circle center y" />
          <Slider label="R1" value={p.r1} min={0.15} max={2.2} step={0.05} display={`${(p.r1 ?? 0).toFixed(2)} m`} onChange={(v) => set('r1', v)} tip="First radius" />
          <Slider label="O2.x" value={p.x2} min={-2} max={2} step={0.05} display={`${(p.x2 ?? 0).toFixed(2)} m`} onChange={(v) => set('x2', v)} tip="Second circle center x" />
          <Slider label="O2.y" value={p.y2} min={0} max={3} step={0.05} display={`${(p.y2 ?? 0).toFixed(2)} m`} onChange={(v) => set('y2', v)} tip="Second circle center y" />
          <Slider label="R2" value={p.r2} min={0.15} max={2.2} step={0.05} display={`${(p.r2 ?? 0).toFixed(2)} m`} onChange={(v) => set('r2', v)} tip="Second radius" />
        </>
      )
    case 'circular-arcs':
      return (
        <>
          <Slider label="Center X" value={p.cx} min={-1.5} max={1.5} step={0.05} display={`${(p.cx ?? 0).toFixed(2)} m`} onChange={(v) => set('cx', v)} tip="Arc center x" />
          <Slider label="Center Y" value={p.cy} min={0.2} max={2.8} step={0.05} display={`${(p.cy ?? 0).toFixed(2)} m`} onChange={(v) => set('cy', v)} tip="Arc center y" />
          <Slider label="Radius" value={p.r} min={0.2} max={2} step={0.05} display={`${(p.r ?? 0).toFixed(2)} m`} onChange={(v) => set('r', v)} tip="Arc radius" />
          <Slider label="Start °" value={p.startDeg} min={-180} max={180} step={1} display={`${Math.round(p.startDeg ?? 0)}°`} onChange={(v) => set('startDeg', v)} tip="Start angle" />
          <Slider label="Sweep °" value={p.sweepDeg} min={-350} max={350} step={1} display={`${Math.round(p.sweepDeg ?? 0)}°`} onChange={(v) => set('sweepDeg', v)} tip="Signed sweep (negative = CW)" />
        </>
      )
    case 'tangency':
      return (
        <>
          <Slider label="O.x" value={p.cx} min={-1.5} max={1.5} step={0.05} display={`${(p.cx ?? 0).toFixed(2)} m`} onChange={(v) => set('cx', v)} tip="Circle center x" />
          <Slider label="O.y" value={p.cy} min={0.2} max={2.8} step={0.05} display={`${(p.cy ?? 0).toFixed(2)} m`} onChange={(v) => set('cy', v)} tip="Circle center y" />
          <Slider label="Radius" value={p.r} min={0.2} max={1.8} step={0.05} display={`${(p.r ?? 0).toFixed(2)} m`} onChange={(v) => set('r', v)} tip="Circle radius" />
          <Slider label="P.x" value={p.px} min={-2.5} max={2.5} step={0.05} display={`${(p.px ?? 0).toFixed(2)} m`} onChange={(v) => set('px', v)} tip="External point x" />
          <Slider label="P.y" value={p.py} min={-0.5} max={3} step={0.05} display={`${(p.py ?? 0).toFixed(2)} m`} onChange={(v) => set('py', v)} tip="External point y" />
        </>
      )
    case 'offsets':
      return (
        <>
          <Slider label="Circle R" value={p.r} min={0.3} max={1.8} step={0.05} display={`${(p.r ?? 0).toFixed(2)} m`} onChange={(v) => set('r', v)} tip="Base circle radius" />
          <Slider label="Offset" value={p.offset} min={-0.9} max={0.9} step={0.05} display={`${(p.offset ?? 0).toFixed(2)} m`} onChange={(v) => set('offset', v)} tip="Positive = outward / left of line" />
        </>
      )
    case 'reflection':
      return (
        <>
          <Slider label="O.x" value={p.cx} min={0.2} max={1.8} step={0.05} display={`${(p.cx ?? 0).toFixed(2)} m`} onChange={(v) => set('cx', v)} tip="Source center x (mirror = Y axis)" />
          <Slider label="O.y" value={p.cy} min={0.4} max={2.6} step={0.05} display={`${(p.cy ?? 0).toFixed(2)} m`} onChange={(v) => set('cy', v)} tip="Source center y" />
          <Slider label="Radius" value={p.r} min={0.25} max={1.4} step={0.05} display={`${(p.r ?? 0).toFixed(2)} m`} onChange={(v) => set('r', v)} tip="Circle / arc radius" />
          <Slider label="Start °" value={p.startDeg} min={-180} max={180} step={1} display={`${Math.round(p.startDeg ?? 0)}°`} onChange={(v) => set('startDeg', v)} tip="Arc start" />
          <Slider label="Sweep °" value={p.sweepDeg} min={20} max={300} step={1} display={`${Math.round(p.sweepDeg ?? 0)}°`} onChange={(v) => set('sweepDeg', v)} tip="Arc sweep" />
        </>
      )
    case 'closed-regions':
      return (
        <Slider label="Radius" value={p.r} min={0.4} max={1.8} step={0.05} display={`${(p.r ?? 0).toFixed(2)} m`} onChange={(v) => set('r', v)} tip="Closed loop radius" />
      )
    default:
      return <p className="control-hint">No parameters for this example.</p>
  }
}

function ArchControls({ arch, onPatchArch, workspaceMode }) {
  const a = { ...DEFAULT_ARCH_SETTINGS, ...arch }
  const set = (key, value) => onPatchArch({ ...a, [key]: value })
  const meta = ARCH_FAMILY_META[a.family] ?? ARCH_FAMILY_META.equilateral
  const riseLocked = workspaceMode === 'pointed-arch' && meta.riseLocked

  return (
    <>
      {workspaceMode === 'pointed-arch' ? (
        <Select
          label="Arch Family"
          tip="Equilateral locks rise to (√3/2)·S. Lancet taller; depressed lower. Same two-centered construction."
          value={a.family}
          options={Object.values(ARCH_FAMILY_META).map(({ id, label }) => ({ id, label }))}
          onChange={(family) => {
            const next = ARCH_FAMILY_META[family]
            onPatchArch({
              ...a,
              family,
              riseRatio: next?.defaultRiseRatio ?? EQUILATERAL_RISE_RATIO,
            })
          }}
        />
      ) : null}

      <Slider
        label="Span"
        tip="Clear width between springing points (meters)."
        value={a.span}
        min={1}
        max={8}
        step={0.05}
        display={`${a.span.toFixed(2)} m`}
        onChange={(span) => set('span', span)}
      />

      {workspaceMode === 'pointed-arch' ? (
        riseLocked ? (
          <p className="control-hint">
            Rise ratio locked: √3/2 ≈ {EQUILATERAL_RISE_RATIO.toFixed(4)} (equilateral geometry)
          </p>
        ) : (
          <Slider
            label="Rise ratio h/S"
            tip={`Family range ${meta.minRiseRatio.toFixed(3)}–${meta.maxRiseRatio.toFixed(3)}`}
            value={a.riseRatio}
            min={meta.minRiseRatio}
            max={meta.maxRiseRatio}
            step={0.005}
            display={a.riseRatio.toFixed(3)}
            onChange={(riseRatio) => set('riseRatio', riseRatio)}
          />
        )
      ) : (
        <>
          <Slider
            label="Lancet h/S"
            tip="Comparison lancet rise ratio (must exceed √3/2)."
            value={a.lancetRiseRatio}
            min={ARCH_FAMILY_META.lancet.minRiseRatio}
            max={ARCH_FAMILY_META.lancet.maxRiseRatio}
            step={0.005}
            display={a.lancetRiseRatio.toFixed(3)}
            onChange={(lancetRiseRatio) => set('lancetRiseRatio', lancetRiseRatio)}
          />
          <Slider
            label="Depressed h/S"
            tip="Comparison depressed rise ratio (below √3/2). Not a four-centered Tudor arch."
            value={a.depressedRiseRatio}
            min={ARCH_FAMILY_META.depressed.minRiseRatio}
            max={ARCH_FAMILY_META.depressed.maxRiseRatio}
            step={0.005}
            display={a.depressedRiseRatio.toFixed(3)}
            onChange={(depressedRiseRatio) => set('depressedRiseRatio', depressedRiseRatio)}
          />
        </>
      )}

      <Slider
        label="Springing Y"
        tip="Elevation of the springing line (meters)."
        value={a.springingY}
        min={-0.5}
        max={2}
        step={0.05}
        display={`${a.springingY.toFixed(2)} m`}
        onChange={(springingY) => set('springingY', springingY)}
      />
      <Slider
        label="Sampling quality"
        tip="Higher = denser arc samples for display (exact arcs unchanged)."
        value={a.samplingQuality}
        min={0}
        max={1}
        step={0.05}
        display={`${Math.round(a.samplingQuality * 100)}%`}
        onChange={(samplingQuality) => set('samplingQuality', samplingQuality)}
      />

    </>
  )
}

function applyProportionWidths(t, ratioOverrides = {}) {
  if (!t.useProportionRatios) return t
  const resolved = resolveMemberWidths(
    t.span,
    {
      outerFrameWidthRatio: ratioOverrides.outerFrameWidthRatio ?? t.outerFrameWidthRatio,
      primaryMullionWidthRatio:
        ratioOverrides.primaryMullionWidthRatio ?? t.primaryMullionWidthRatio,
      lancetArchWidthRatio: ratioOverrides.lancetArchWidthRatio ?? t.lancetArchWidthRatio,
      secondaryTraceryWidthRatio:
        ratioOverrides.secondaryTraceryWidthRatio ?? t.secondaryTraceryWidthRatio,
      oculusFrameWidthRatio: ratioOverrides.oculusFrameWidthRatio ?? t.oculusFrameWidthRatio,
      foilBarWidthRatio: ratioOverrides.foilBarWidthRatio ?? t.foilBarWidthRatio,
      upperOpeningScale: ratioOverrides.upperOpeningScale ?? t.upperOpeningScale,
      upperSubdivisionDensity:
        ratioOverrides.upperSubdivisionDensity ?? t.upperSubdivisionDensity,
    },
    t.minStoneWebWidth,
  )
  return {
    ...t,
    ...ratioOverrides,
    outerFrameWidth: resolved.widths.outerFrameWidth,
    masterFrameWidth: resolved.widths.outerFrameWidth,
    mullionWidth: resolved.widths.mullionWidth,
    jambInset: resolved.widths.jambInset,
    secondaryTraceryWidth: resolved.widths.secondaryTraceryWidth,
    oculusFrameWidth: resolved.widths.oculusFrameWidth,
    foilBarWidth: resolved.widths.foilBarWidth,
  }
}

function TraceryControls({
  tracery,
  onPatch,
  stone,
  onApplyArchitecturePreset,
  controlTier = 'essential',
  workspaceMode = 'tracery',
}) {
  const t = { ...DEFAULT_TRACERY_SETTINGS, ...tracery }
  const set = (key, value) => onPatch({ ...t, [key]: value })
  const setRatio = (key, value) => onPatch(applyProportionWidths({ ...t, [key]: value }))
  const exampleId = t.exampleId
  // Stone / Assembly use full-window shared configs for every example (13E.3.2.1).
  // Standalone foil-only control strip remains for 2D Tracery workspace demos.
  const foilOnly =
    workspaceMode === 'tracery' &&
    (exampleId === 'trefoil' || exampleId === 'quatrefoil')
  const showSubdivision =
    !foilOnly &&
    (exampleId === 'lancet-subdivision' ||
      exampleId === 'composed-window' ||
      exampleId === 'oculus-placement' ||
      exampleId === 'trefoil' ||
      exampleId === 'quatrefoil')
  const showOculus =
    !foilOnly &&
    (exampleId === 'oculus-placement' ||
      exampleId === 'composed-window' ||
      exampleId === 'trefoil' ||
      exampleId === 'quatrefoil' ||
      exampleId === 'lancet-subdivision')
  const showFoil =
    foilOnly ||
    exampleId === 'oculus-placement' ||
    exampleId === 'composed-window' ||
    exampleId === 'trefoil' ||
    exampleId === 'quatrefoil' ||
    exampleId === 'lancet-subdivision'
  // Architecture presets available whenever the example drives a full window path.
  const showArchitecture =
    !foilOnly &&
    (exampleId === 'composed-window' ||
      exampleId === 'oculus-placement' ||
      workspaceMode === 'stone-3d')
  const parentMeta = ARCH_FAMILY_META[t.family] ?? ARCH_FAMILY_META.equilateral
  const riseLocked = parentMeta.riseLocked
  const asymmetric = !t.symmetric
  const showAdvanced = controlTier === 'advanced' || controlTier === 'debug'
  const showDebug = controlTier === 'debug'

  return (
    <>
      <p className="control-hint">
        Control density: {controlTier}. Essential keeps span / depth / trefoil / oculus height /
        outer frame. Advanced & Debug expose ratios and path flags. Tracery examples apply a full
        shared-generator configuration (not a label-only switch).
      </p>
      {showArchitecture ? (
        <Select
          label="Architecture preset"
          tip="Baseline · Refined · Bar Network · Elaborate · Skeleton (centerline strips)."
          value={t.architecturePreset ?? 'baseline-13d'}
          options={ARCHITECTURE_PRESET_OPTIONS.map(({ id, label }) => ({ id, label }))}
          onChange={(architecturePreset) => {
            const applied = applyArchitecturePreset(
              architecturePreset,
              t,
              stone ?? DEFAULT_STONE_SETTINGS,
            )
            // Must apply tracery + stone in one parent state update.
            // Two sequential patches race and the second overwrites the first.
            if (onApplyArchitecturePreset) {
              onApplyArchitecturePreset(applied)
            } else {
              onPatch(applied.tracery)
            }
          }}
        />
      ) : null}
      <Select
        label="Tracery example"
        tip="A–E apply distinct shared-generator configs (lancets / trefoil / quatrefoil / oculus / facade module)."
        value={exampleId}
        options={TRACERY_EXAMPLES.map(({ id, label }) => ({ id, label }))}
        onChange={(next) => {
          const applied = applyTraceryExample(next, t, stone ?? DEFAULT_STONE_SETTINGS)
          // Single state update: tracery + stone (same path as architecture presets).
          if (onApplyArchitecturePreset) {
            onApplyArchitecturePreset({
              tracery: applied.tracery,
              stone: applied.stone,
            })
          } else {
            onPatch(applied.tracery)
          }
        }}
      />

      {!foilOnly ? (
        <details className="control-section" open>
          <summary>Parent Arch</summary>
          <div className="section-controls">
            <Select
              label="Family"
              tip="Parent pointed-arch family (Step 13B generator)."
              value={t.family}
              options={Object.values(ARCH_FAMILY_META).map(({ id, label }) => ({ id, label }))}
              onChange={(family) => {
                const next = ARCH_FAMILY_META[family]
                onPatch({
                  ...t,
                  family,
                  riseRatio: next?.defaultRiseRatio ?? EQUILATERAL_RISE_RATIO,
                })
              }}
            />
            <Slider
              label="Span"
              tip="Parent clear span (m)."
              value={t.span}
              min={1.5}
              max={8}
              step={0.05}
              display={`${t.span.toFixed(2)} m`}
              onChange={(span) =>
                onPatch(
                  t.useProportionRatios
                    ? applyProportionWidths({ ...t, span })
                    : { ...t, span },
                )
              }
            />
            {riseLocked ? (
              <p className="control-hint">
                Rise locked: √3/2 ≈ {EQUILATERAL_RISE_RATIO.toFixed(4)} (equilateral)
              </p>
            ) : (
              <Slider
                label="Rise ratio h/S"
                tip={`Parent rise range ${parentMeta.minRiseRatio.toFixed(3)}–${parentMeta.maxRiseRatio.toFixed(3)}`}
                value={t.riseRatio}
                min={parentMeta.minRiseRatio}
                max={parentMeta.maxRiseRatio}
                step={0.005}
                display={t.riseRatio.toFixed(3)}
                onChange={(riseRatio) => set('riseRatio', riseRatio)}
              />
            )}
            <Slider
              label="Springing Y"
              tip="Parent springing elevation (m)."
              value={t.springingY}
              min={-0.5}
              max={1.5}
              step={0.05}
              display={`${t.springingY.toFixed(2)} m`}
              onChange={(springingY) => set('springingY', springingY)}
            />
          </div>
        </details>
      ) : null}

      {showSubdivision ? (
        <details className="control-section" open>
          <summary>Subdivision</summary>
          <div className="section-controls">
            <Toggle
              label="Symmetric"
              tip="Mullion on parent axis; equal child spans. Off unlocks subdivision ratio."
              value={t.symmetric !== false}
              onChange={(symmetric) => set('symmetric', symmetric)}
            />
            {asymmetric ? (
              <Slider
                label="Division ratio"
                tip="Left clear fraction of (span − mullion)."
                value={t.subdivisionRatio}
                min={0.25}
                max={0.75}
                step={0.01}
                display={t.subdivisionRatio.toFixed(2)}
                onChange={(subdivisionRatio) => set('subdivisionRatio', subdivisionRatio)}
              />
            ) : (
              <p className="control-hint">Subdivision ratio locked at 0.5 (symmetric).</p>
            )}
            <Slider
              label="Mullion width"
              tip="Central mullion thickness (m). Clearance must stay positive."
              value={t.mullionWidth}
              min={0.06}
              max={0.6}
              step={0.01}
              display={`${t.mullionWidth.toFixed(2)} m`}
              onChange={(mullionWidth) => set('mullionWidth', mullionWidth)}
            />
            <Slider
              label="Child rise ratio"
              tip="Child lancet h/S (lancet family)."
              value={t.childRiseRatio}
              min={ARCH_FAMILY_META.lancet.minRiseRatio}
              max={ARCH_FAMILY_META.lancet.maxRiseRatio}
              step={0.005}
              display={t.childRiseRatio.toFixed(3)}
              onChange={(childRiseRatio) => set('childRiseRatio', childRiseRatio)}
            />
          </div>
        </details>
      ) : null}

      {showOculus ? (
        <details className="control-section" open>
          <summary>Composition / Oculus</summary>
          <div className="section-controls">
            <Slider
              label="Oculus height"
              tip="Vertical position in the solvable band (alias of Oculus vertical position on skeleton / hierarchical)."
              value={t.oculusHeightRatio ?? t.oculusVerticalPosition ?? 0.55}
              min={0.15}
              max={0.95}
              step={0.01}
              display={(t.oculusHeightRatio ?? t.oculusVerticalPosition ?? 0.55).toFixed(2)}
              onChange={(oculusHeightRatio) =>
                onPatch({
                  ...t,
                  oculusHeightRatio,
                  oculusVerticalPosition: oculusHeightRatio,
                })
              }
            />
            <Slider
              label="Oculus radius"
              tip="Fraction of max feasible radius at the solved height."
              value={t.oculusRadiusRatio}
              min={0.25}
              max={1}
              step={0.01}
              display={t.oculusRadiusRatio.toFixed(2)}
              onChange={(oculusRadiusRatio) => set('oculusRadiusRatio', oculusRadiusRatio)}
            />
            <Slider
              label="Clearance"
              tip="Minimum geometric clearance (m)."
              value={t.oculusClearance}
              min={0.01}
              max={0.2}
              step={0.005}
              display={`${t.oculusClearance.toFixed(3)} m`}
              onChange={(oculusClearance) => set('oculusClearance', oculusClearance)}
            />
          </div>
        </details>
      ) : null}

      {showFoil ? (
        <details className="control-section" open>
          <summary>Foil Geometry</summary>
          <div className="section-controls">
            {foilOnly ? (
              <Slider
                label="Overall size"
                tip="Enclosing radius of the foil (m)."
                value={t.foilSize}
                min={0.4}
                max={2.5}
                step={0.05}
                display={`${t.foilSize.toFixed(2)} m`}
                onChange={(foilSize) => set('foilSize', foilSize)}
              />
            ) : (
              <>
                <Select
                  label="Foil type"
                  tip="Trefoil / quatrefoil for composed oculus; on hierarchical also drives Trefoil heads in bay heads."
                  value={
                    t.enableHierarchicalTracery
                      ? t.trefoilHeads !== false
                        ? FOIL_TYPES.trefoil
                        : FOIL_TYPES.quatrefoil
                      : t.foilType
                  }
                  options={[
                    { id: FOIL_TYPES.quatrefoil, label: 'Quatrefoil' },
                    { id: FOIL_TYPES.trefoil, label: 'Trefoil' },
                  ]}
                  onChange={(foilType) =>
                    onPatch({
                      ...t,
                      foilType,
                      trefoilHeads: foilType === FOIL_TYPES.trefoil,
                      secondaryQuatrefoils:
                        foilType === FOIL_TYPES.quatrefoil
                          ? true
                          : t.secondaryQuatrefoils,
                    })
                  }
                />
                <Slider
                  label="Foil scale"
                  tip="Foil size as a fraction of oculus radius."
                  value={t.foilScale}
                  min={0.4}
                  max={0.98}
                  step={0.01}
                  display={t.foilScale.toFixed(2)}
                  onChange={(foilScale) => set('foilScale', foilScale)}
                />
              </>
            )}
            <Slider
              label="Cusp depth"
              tip="Higher → deeper inward cusps (circle packing)."
              value={t.cuspDepth}
              min={0.15}
              max={0.9}
              step={0.01}
              display={t.cuspDepth.toFixed(2)}
              onChange={(cuspDepth) => set('cuspDepth', cuspDepth)}
            />
            <Slider
              label="Rotation"
              tip="Foil rotation (radians)."
              value={t.foilRotation}
              min={0}
              max={Math.PI * 2}
              step={0.05}
              display={`${((t.foilRotation * 180) / Math.PI).toFixed(0)}°`}
              onChange={(foilRotation) => set('foilRotation', foilRotation)}
            />
            {exampleId === 'quatrefoil' || t.foilType === FOIL_TYPES.quatrefoil ? (
              <Select
                label="Orientation"
                tip="Orthogonal (cardinal lobes) or diagonal (45°)."
                value={String(t.foilOrientation ?? 0)}
                options={[
                  { id: '0', label: 'Orthogonal' },
                  { id: String(Math.PI / 4), label: 'Diagonal' },
                ]}
                onChange={(v) => set('foilOrientation', Number(v))}
              />
            ) : null}
          </div>
        </details>
      ) : null}

      {!foilOnly ? (
        <details className="control-section" open>
          <summary>Solid / Void</summary>
          <div className="section-controls">
            <Slider
              label="Outer frame width"
              tip="Outer stone frame thickness (m). Also sets Master frame width for skeleton / hierarchical."
              value={t.outerFrameWidth ?? t.masterFrameWidth ?? 0.12}
              min={0.04}
              max={0.4}
              step={0.01}
              display={`${(t.outerFrameWidth ?? t.masterFrameWidth ?? 0.12).toFixed(2)} m`}
              onChange={(outerFrameWidth) =>
                onPatch({
                  ...t,
                  outerFrameWidth,
                  masterFrameWidth: outerFrameWidth,
                })
              }
            />
            <Slider
              label="Window base Y"
              tip="Sill / base elevation closing jambs (m). Must be below springing."
              value={t.windowBaseElevation}
              min={-1.5}
              max={0.5}
              step={0.05}
              display={`${(t.windowBaseElevation ?? -0.35).toFixed(2)} m`}
              onChange={(windowBaseElevation) => set('windowBaseElevation', windowBaseElevation)}
            />
            <Slider
              label="Min stone web"
              tip="Clearance floor (m). Constraint — raises min web / opening clearance; visible when subdivisions reject or webs tighten."
              value={t.minStoneWebWidth}
              min={0.03}
              max={0.25}
              step={0.005}
              display={`${(t.minStoneWebWidth ?? 0.08).toFixed(3)} m`}
              onChange={(minStoneWebWidth) =>
                onPatch({
                  ...t,
                  minStoneWebWidth,
                  minWebClearance: Math.max(t.minWebClearance ?? 0, minStoneWebWidth),
                  minOpeningClearance: Math.max(
                    t.minOpeningClearance ?? 0,
                    minStoneWebWidth,
                  ),
                })
              }
            />
            <p className="control-hint">
              Outer frame width = absolute outer stone thickness. Min stone web is a clearance
              floor (not continuous reshape). Child arches are clear opening edges.
            </p>
          </div>
        </details>
      ) : null}

      {showArchitecture ? (
        <>
          {showAdvanced ? (
          <details className="control-section">
            <summary>Architectural Proportions</summary>
            <div className="section-controls">
              <Toggle
                label="Use span ratios"
                tip="Derive frame / mullion / secondary widths from parent span ratios (Rayonnant refined)."
                value={t.useProportionRatios === true}
                onChange={(useProportionRatios) => {
                  if (useProportionRatios) {
                    onPatch(applyProportionWidths({ ...t, useProportionRatios: true }))
                  } else {
                    set('useProportionRatios', false)
                  }
                }}
              />
              <Slider
                label="Outer frame / span"
                tip="OUTER_FRAME width as fraction of parent clear span (exploratory)."
                value={t.outerFrameWidthRatio ?? 0.05}
                min={0.035}
                max={0.08}
                step={0.001}
                display={`${((t.outerFrameWidthRatio ?? 0.05) * 100).toFixed(1)}% → ${(t.outerFrameWidth ?? 0).toFixed(3)} m`}
                onChange={(outerFrameWidthRatio) => setRatio('outerFrameWidthRatio', outerFrameWidthRatio)}
              />
              <Slider
                label="Primary mullion / frame"
                tip="PRIMARY_MULLION width as fraction of outer frame."
                value={t.primaryMullionWidthRatio ?? 0.55}
                min={0.4}
                max={0.75}
                step={0.01}
                display={`${((t.primaryMullionWidthRatio ?? 0.55) * 100).toFixed(0)}% → ${(t.mullionWidth ?? 0).toFixed(3)} m`}
                onChange={(primaryMullionWidthRatio) =>
                  setRatio('primaryMullionWidthRatio', primaryMullionWidthRatio)
                }
              />
              <Slider
                label="Secondary tracery / frame"
                tip="SECONDARY_TRACERY / spandrel web width as fraction of outer frame."
                value={t.secondaryTraceryWidthRatio ?? 0.4}
                min={0.25}
                max={0.6}
                step={0.01}
                display={`${((t.secondaryTraceryWidthRatio ?? 0.4) * 100).toFixed(0)}% → ${(t.secondaryTraceryWidth ?? 0).toFixed(3)} m`}
                onChange={(secondaryTraceryWidthRatio) =>
                  setRatio('secondaryTraceryWidthRatio', secondaryTraceryWidthRatio)
                }
              />
            </div>
          </details>
          ) : null}
          <details className="control-section" open={showAdvanced || t.enableHierarchicalTracery === true}>
            <summary>Tracery Hierarchy</summary>
            <div className="section-controls">
              {showDebug ? (
              <>
              <Toggle
                label="Upper spandrel openings"
                tip="Symmetric circular voids flanking the oculus (REF-007 / REF-012). Constraint failure omits holes."
                value={t.enableSpandrelOpenings === true}
                onChange={(enableSpandrelOpenings) =>
                  set('enableSpandrelOpenings', enableSpandrelOpenings)
                }
              />
              <Toggle
                label="Bar network path"
                tip="Step 13D.3 — derive stone from connected bar-network graph + upper cells."
                value={t.enableBarNetwork === true}
                onChange={(enableBarNetwork) => set('enableBarNetwork', enableBarNetwork)}
              />
              <Toggle
                label="Elaborate grammar"
                tip="Step 13D.4 — hierarchical zones, nested lancets, dominant oculus, curved spandrels."
                value={t.enableElaborate === true}
                onChange={(enableElaborate) => set('enableElaborate', enableElaborate)}
              />
              <Toggle
                label="Skeleton path"
                tip="Step 13D.5 — stone = unioned centerline strips (not outer⊕holes panel)."
                value={t.enableSkeleton === true}
                onChange={(enableSkeleton) =>
                  onPatch({
                    ...t,
                    enableSkeleton,
                    enableOculusNetwork: enableSkeleton ? t.enableOculusNetwork : false,
                  })
                }
              />
              <Toggle
                label="Oculus network"
                tip="Step 13D.6 — skeleton + connected oculus ring + upper connectors (strip union)."
                value={t.enableOculusNetwork === true || t.enableSecondaryTracery === true}
                onChange={(enableOculusNetwork) =>
                  onPatch({
                    ...t,
                    enableOculusNetwork,
                    enableSkeleton: enableOculusNetwork ? true : t.enableSkeleton,
                    enableSecondaryTracery: enableOculusNetwork
                      ? t.enableSecondaryTracery
                      : false,
                  })
                }
              />
              <Toggle
                label="Secondary tracery"
                tip="Step 13D.7 — quatrefoil inside oculus + symmetric side secondary members."
                value={t.enableSecondaryTracery === true}
                onChange={(enableSecondaryTracery) =>
                  onPatch({
                    ...t,
                    enableSecondaryTracery,
                    enableOculusNetwork: enableSecondaryTracery ? true : t.enableOculusNetwork,
                    enableSkeleton: enableSecondaryTracery ? true : t.enableSkeleton,
                    oculusSubdivision: enableSecondaryTracery
                      ? 'quatrefoil'
                      : t.oculusSubdivision,
                  })
                }
              />
              </>
              ) : (
                <p className="control-hint">
                  Path flags (skeleton / oculus / secondary / elaborate) live under Debug density.
                  Hierarchical preset already enables the required path.
                </p>
              )}
              {t.enableSkeleton === true ||
              t.enableOculusNetwork === true ||
              t.enableSecondaryTracery === true ||
              t.enableHierarchicalTracery === true ? (
                <>
                  {showAdvanced ? (
                  <Slider
                    label="Master frame width"
                    tip="Alias of Outer frame width (m) — kept for skeleton workflows."
                    value={t.masterFrameWidth ?? t.outerFrameWidth ?? 0.12}
                    min={0.06}
                    max={0.2}
                    step={0.005}
                    display={`${(t.masterFrameWidth ?? t.outerFrameWidth ?? 0.12).toFixed(3)} m`}
                    onChange={(masterFrameWidth) =>
                      onPatch({
                        ...t,
                        masterFrameWidth,
                        outerFrameWidth: masterFrameWidth,
                      })
                    }
                  />
                  ) : null}
                  {showAdvanced ? (
                    <>
                      <Slider
                        label="Mullion / frame"
                        tip="PRIMARY_MULLION width as fraction of master frame."
                        value={t.mullionWidthRatio ?? 0.67}
                        min={0.4}
                        max={0.85}
                        step={0.01}
                        display={`${((t.mullionWidthRatio ?? 0.67) * 100).toFixed(0)}%`}
                        onChange={(mullionWidthRatio) =>
                          set('mullionWidthRatio', mullionWidthRatio)
                        }
                      />
                      <Slider
                        label="Child arch / frame"
                        tip="LANCET_ARCH bar width as fraction of master frame."
                        value={t.childArchWidthRatio ?? 0.54}
                        min={0.35}
                        max={0.75}
                        step={0.01}
                        display={`${((t.childArchWidthRatio ?? 0.54) * 100).toFixed(0)}%`}
                        onChange={(childArchWidthRatio) =>
                          set('childArchWidthRatio', childArchWidthRatio)
                        }
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              {t.enableOculusNetwork === true ||
              t.enableSecondaryTracery === true ||
              t.enableHierarchicalTracery === true ? (
                <details className="control-section" open>
                  <summary>Upper Tracery</summary>
                  <div className="section-controls">
                    <Slider
                      label="Oculus radius ratio"
                      tip="Fraction of max feasible radius inside the parent arch above the lancets."
                      value={t.oculusRadiusRatio ?? 0.78}
                      min={0.35}
                      max={0.95}
                      step={0.01}
                      display={(t.oculusRadiusRatio ?? 0.78).toFixed(2)}
                      onChange={(oculusRadiusRatio) => set('oculusRadiusRatio', oculusRadiusRatio)}
                    />
                    <Slider
                      label="Oculus vertical position"
                      tip="0 = just above lancet apices; 1 = toward parent apex. Synced with Oculus height."
                      value={t.oculusVerticalPosition ?? t.oculusHeightRatio ?? 0.55}
                      min={0.15}
                      max={0.9}
                      step={0.01}
                      display={(
                        t.oculusVerticalPosition ??
                        t.oculusHeightRatio ??
                        0.55
                      ).toFixed(2)}
                      onChange={(oculusVerticalPosition) =>
                        onPatch({
                          ...t,
                          oculusVerticalPosition,
                          oculusHeightRatio: oculusVerticalPosition,
                        })
                      }
                    />
                    <Slider
                      label="Oculus ring / frame"
                      tip="Oculus ring width as fraction of master frame."
                      value={t.oculusRingWidthRatio ?? 0.42}
                      min={0.25}
                      max={0.7}
                      step={0.01}
                      display={`${((t.oculusRingWidthRatio ?? 0.42) * 100).toFixed(0)}%`}
                      onChange={(oculusRingWidthRatio) =>
                        set('oculusRingWidthRatio', oculusRingWidthRatio)
                      }
                    />
                    <Slider
                      label="Connector / frame"
                      tip="Upper connector bar width as fraction of master frame."
                      value={t.connectorWidthRatio ?? 0.38}
                      min={0.2}
                      max={0.65}
                      step={0.01}
                      display={`${((t.connectorWidthRatio ?? 0.38) * 100).toFixed(0)}%`}
                      onChange={(connectorWidthRatio) =>
                        set('connectorWidthRatio', connectorWidthRatio)
                      }
                    />
                    <Slider
                      label="Upper connector curvature"
                      tip="0 = straight; 1 = strongly bowed circular arcs."
                      value={t.upperConnectorCurvature ?? 0.45}
                      min={0}
                      max={1}
                      step={0.01}
                      display={(t.upperConnectorCurvature ?? 0.45).toFixed(2)}
                      onChange={(upperConnectorCurvature) =>
                        set('upperConnectorCurvature', upperConnectorCurvature)
                      }
                    />
                    <Select
                      label="Oculus subdivision"
                      tip="NONE = plain ring; QUATREFOIL = connected foil bars inside the ring."
                      value={
                        t.enableSecondaryTracery === true
                          ? 'quatrefoil'
                          : (t.oculusSubdivision ?? 'none')
                      }
                      options={[
                        { id: 'none', label: 'None' },
                        { id: 'quatrefoil', label: 'Quatrefoil' },
                      ]}
                      onChange={(oculusSubdivision) => set('oculusSubdivision', oculusSubdivision)}
                    />
                  </div>
                </details>
              ) : null}
              {showAdvanced && t.enableSecondaryTracery === true ? (
                <details className="control-section">
                  <summary>Secondary Tracery (Advanced)</summary>
                  <div className="section-controls">
                    <Slider
                      label="Subdivision level"
                      tip="0 = oculus only; 1 = quatrefoil + side members; 2 = + clearance-gated bridges."
                      value={t.secondaryTraceryLevel ?? 1}
                      min={0}
                      max={2}
                      step={1}
                      display={String(t.secondaryTraceryLevel ?? 1)}
                      onChange={(secondaryTraceryLevel) =>
                        set('secondaryTraceryLevel', secondaryTraceryLevel)
                      }
                    />
                    <Slider
                      label="Foil scale"
                      tip="Quatrefoil size as fraction of oculus radius."
                      value={t.foilScale ?? 0.88}
                      min={0.55}
                      max={0.98}
                      step={0.01}
                      display={(t.foilScale ?? 0.88).toFixed(2)}
                      onChange={(foilScale) => set('foilScale', foilScale)}
                    />
                    <Slider
                      label="Foil cusp depth"
                      tip="Higher = deeper cusps between lobes."
                      value={t.cuspDepth ?? 0.55}
                      min={0.2}
                      max={0.9}
                      step={0.01}
                      display={(t.cuspDepth ?? 0.55).toFixed(2)}
                      onChange={(cuspDepth) => set('cuspDepth', cuspDepth)}
                    />
                    <Slider
                      label="Foil rotation"
                      tip="Quatrefoil rotation in degrees."
                      value={((t.foilRotation ?? 0) * 180) / Math.PI}
                      min={-45}
                      max={45}
                      step={1}
                      display={`${(((t.foilRotation ?? 0) * 180) / Math.PI).toFixed(0)}°`}
                      onChange={(deg) => set('foilRotation', (deg * Math.PI) / 180)}
                    />
                    <Slider
                      label="Foil bar / frame"
                      tip="FOIL_BAR width as fraction of master frame."
                      value={t.foilBarWidthRatio ?? 0.28}
                      min={0.15}
                      max={0.45}
                      step={0.01}
                      display={`${((t.foilBarWidthRatio ?? 0.28) * 100).toFixed(0)}%`}
                      onChange={(foilBarWidthRatio) => set('foilBarWidthRatio', foilBarWidthRatio)}
                    />
                    <Slider
                      label="Secondary member / frame"
                      tip="Side secondary bar width as fraction of master frame."
                      value={t.secondaryMemberWidthRatio ?? 0.32}
                      min={0.18}
                      max={0.5}
                      step={0.01}
                      display={`${((t.secondaryMemberWidthRatio ?? 0.32) * 100).toFixed(0)}%`}
                      onChange={(secondaryMemberWidthRatio) =>
                        set('secondaryMemberWidthRatio', secondaryMemberWidthRatio)
                      }
                    />
                    <Slider
                      label="Minimum clearance"
                      tip="Min web clearance for side compartments / level-2 bridges."
                      value={t.minWebClearance ?? 0.04}
                      min={0.02}
                      max={0.12}
                      step={0.005}
                      display={`${(t.minWebClearance ?? 0.04).toFixed(3)} m`}
                      onChange={(minWebClearance) => set('minWebClearance', minWebClearance)}
                    />
                    <Toggle
                      label="Side compartment subdivision"
                      tip="LEVEL 2: attempt bridges when clearance permits (no tiny hole fallback)."
                      value={t.sideCompartmentSubdivision !== false}
                      onChange={(sideCompartmentSubdivision) =>
                        set('sideCompartmentSubdivision', sideCompartmentSubdivision)
                      }
                    />
                  </div>
                </details>
              ) : null}
              {showAdvanced &&
              (t.enableOculusRefinement === true ||
                t.architecturePreset === 'rayonnant-oculus-refined' ||
                t.enableHierarchicalTracery === true) ? (
                <details className="control-section">
                  <summary>Oculus Refinement (Advanced)</summary>
                  <div className="section-controls">
                    <Slider
                      label="Oculus apex clearance"
                      tip="Min gap from oculus outer edge to parent apex. Violations shrink radius (documented fallback)."
                      value={t.oculusApexClearance ?? 0.08}
                      min={0.04}
                      max={0.18}
                      step={0.005}
                      display={`${(t.oculusApexClearance ?? 0.08).toFixed(3)} m`}
                      onChange={(oculusApexClearance) =>
                        set('oculusApexClearance', oculusApexClearance)
                      }
                    />
                    <Slider
                      label="Central junction scale"
                      tip="Caps foil half-width vs cusp radius — lower opens the central void."
                      value={t.centralJunctionScale ?? 0.55}
                      min={0.3}
                      max={0.85}
                      step={0.01}
                      display={(t.centralJunctionScale ?? 0.55).toFixed(2)}
                      onChange={(centralJunctionScale) =>
                        set('centralJunctionScale', centralJunctionScale)
                      }
                    />
                    <Slider
                      label="Foil-to-ring width"
                      tip="Radial stub width as fraction of foil bar width (tip-to-ring mode)."
                      value={t.foilToRingWidthRatio ?? 0.85}
                      min={0.55}
                      max={1}
                      step={0.01}
                      display={`${((t.foilToRingWidthRatio ?? 0.85) * 100).toFixed(0)}%`}
                      onChange={(foilToRingWidthRatio) =>
                        set('foilToRingWidthRatio', foilToRingWidthRatio)
                      }
                    />
                  </div>
                </details>
              ) : null}
              {t.enableHierarchicalTracery === true ||
              t.architecturePreset === 'rayonnant-hierarchical' ? (
                <details className="control-section" open>
                  <summary>Hierarchical Subdivision</summary>
                  <div className="section-controls">
                    <Slider
                      label="Subdivision depth"
                      tip="0 = 13D.8 only; 1 = nested secondary arches; 2 = tertiary where clearance allows."
                      value={t.hierarchicalDepth ?? 1}
                      min={0}
                      max={2}
                      step={1}
                      display={String(t.hierarchicalDepth ?? 1)}
                      onChange={(hierarchicalDepth) => set('hierarchicalDepth', hierarchicalDepth)}
                    />
                    <Toggle
                      label="Nested arches"
                      tip="RULE A: subdivide primary lancet bays into child pointed arches."
                      value={t.nestedArches !== false}
                      onChange={(nestedArches) => set('nestedArches', nestedArches)}
                    />
                    <Slider
                      label="Child arch span ratio"
                      tip="Each child clear share of parent bay clear (symmetric 0.5)."
                      value={t.childArchSpanRatio ?? 0.5}
                      min={0.4}
                      max={0.55}
                      step={0.01}
                      display={(t.childArchSpanRatio ?? 0.5).toFixed(2)}
                      onChange={(childArchSpanRatio) => set('childArchSpanRatio', childArchSpanRatio)}
                    />
                    <Slider
                      label="Child arch rise ratio"
                      tip="Rise ratio for nested pointed arches (13B constructors)."
                      value={t.childArchRiseRatio ?? 1.05}
                      min={0.95}
                      max={1.25}
                      step={0.01}
                      display={(t.childArchRiseRatio ?? 1.05).toFixed(2)}
                      onChange={(childArchRiseRatio) => set('childArchRiseRatio', childArchRiseRatio)}
                    />
                    <Toggle
                      label="Trefoil heads"
                      tip="RULE B: trefoils in eligible bay heads (depth ≥ 1). Synced with Foil type. Ineligible cells report clearance rejection — not fabricated."
                      value={t.trefoilHeads !== false}
                      onChange={(trefoilHeads) =>
                        onPatch({
                          ...t,
                          trefoilHeads,
                          foilType: trefoilHeads
                            ? FOIL_TYPES.trefoil
                            : FOIL_TYPES.quatrefoil,
                          secondaryQuatrefoils: trefoilHeads
                            ? false
                            : t.secondaryQuatrefoils,
                        })
                      }
                    />
                    {(t.hierarchicalDepth ?? 0) < 1 && t.trefoilHeads !== false ? (
                      <p className="control-hint">
                        Trefoil heads require Subdivision depth ≥ 1 (no bay cells at depth 0).
                      </p>
                    ) : null}
                    <Toggle
                      label="Secondary quatrefoils"
                      tip="RULE C: optional quatrefoil head when trefoils are off and clearance allows."
                      value={t.secondaryQuatrefoils === true}
                      onChange={(secondaryQuatrefoils) =>
                        onPatch({
                          ...t,
                          secondaryQuatrefoils,
                          trefoilHeads: secondaryQuatrefoils ? false : t.trefoilHeads,
                          foilType: secondaryQuatrefoils
                            ? FOIL_TYPES.quatrefoil
                            : t.foilType,
                        })
                      }
                    />
                    <Slider
                      label="Secondary member / frame"
                      tip="SECONDARY_ARCH width as fraction of master frame."
                      value={t.secondaryArchWidthRatio ?? 0.4}
                      min={0.22}
                      max={0.55}
                      step={0.01}
                      display={`${((t.secondaryArchWidthRatio ?? 0.4) * 100).toFixed(0)}%`}
                      onChange={(secondaryArchWidthRatio) =>
                        set('secondaryArchWidthRatio', secondaryArchWidthRatio)
                      }
                    />
                    <Slider
                      label="Minimum opening clearance"
                      tip="Stop subdivision when child openings would fall below this (m)."
                      value={t.minOpeningClearance ?? 0.05}
                      min={0.03}
                      max={0.12}
                      step={0.005}
                      display={`${(t.minOpeningClearance ?? 0.05).toFixed(3)} m`}
                      onChange={(minOpeningClearance) =>
                        set('minOpeningClearance', minOpeningClearance)
                      }
                    />
                  </div>
                </details>
              ) : null}
              {t.enableElaborate === true ? (
                <>
                  <Slider
                    label="Nesting depth"
                    tip="1 = two primary lancets; 2 = four-light nested secondary field (REF-008)."
                    value={t.nestingDepth ?? 2}
                    min={1}
                    max={2}
                    step={1}
                    display={String(t.nestingDepth ?? 2)}
                    onChange={(nestingDepth) => set('nestingDepth', nestingDepth)}
                  />
                  <Slider
                    label="Secondary mullion"
                    tip="Width of nested secondary mullions inside each primary lancet (m)."
                    value={t.secondaryMullionWidth ?? 0.045}
                    min={0.025}
                    max={0.09}
                    step={0.005}
                    display={`${(t.secondaryMullionWidth ?? 0.045).toFixed(3)} m`}
                    onChange={(secondaryMullionWidth) =>
                      set('secondaryMullionWidth', secondaryMullionWidth)
                    }
                  />
                  <Slider
                    label="Secondary lancet rise"
                    tip="Rise ratio multiplier for nested secondary pointed arches."
                    value={t.secondaryLancetRatio ?? 1.1}
                    min={0.95}
                    max={1.35}
                    step={0.01}
                    display={(t.secondaryLancetRatio ?? 1.1).toFixed(2)}
                    onChange={(secondaryLancetRatio) =>
                      set('secondaryLancetRatio', secondaryLancetRatio)
                    }
                  />
                  <Slider
                    label="Oculus scale"
                    tip="Fraction of available upper pocket used for the dominant oculus."
                    value={t.oculusScale ?? 0.94}
                    min={0.55}
                    max={1}
                    step={0.01}
                    display={(t.oculusScale ?? 0.94).toFixed(2)}
                    onChange={(oculusScale) => set('oculusScale', oculusScale)}
                  />
                  <Slider
                    label="Upper subdivision complexity"
                    tip="Zone C/D spandrel packing aggressiveness (0–1)."
                    value={t.upperSubdivisionComplexity ?? 0.85}
                    min={0.4}
                    max={1}
                    step={0.01}
                    display={(t.upperSubdivisionComplexity ?? 0.85).toFixed(2)}
                    onChange={(upperSubdivisionComplexity) =>
                      set('upperSubdivisionComplexity', upperSubdivisionComplexity)
                    }
                  />
                </>
              ) : null}
              <Slider
                label="Upper opening scale"
                tip="Fraction of available spandrel / cell pocket used for secondary opening radius."
                value={t.upperOpeningScale ?? 0.7}
                min={0.35}
                max={0.9}
                step={0.01}
                display={(t.upperOpeningScale ?? 0.7).toFixed(2)}
                onChange={(upperOpeningScale) => set('upperOpeningScale', upperOpeningScale)}
              />
              <Slider
                label="Upper subdivision density"
                tip="Bar-network packing aggressiveness for apex / shoulder cells (0–1)."
                value={t.upperSubdivisionDensity ?? 0.75}
                min={0.35}
                max={1}
                step={0.01}
                display={(t.upperSubdivisionDensity ?? 0.75).toFixed(2)}
                onChange={(upperSubdivisionDensity) =>
                  set('upperSubdivisionDensity', upperSubdivisionDensity)
                }
              />
              <Slider
                label="Min web clearance"
                tip="Minimum stone web between upper cells (m)."
                value={t.minWebClearance ?? 0.04}
                min={0.02}
                max={0.12}
                step={0.005}
                display={`${(t.minWebClearance ?? 0.04).toFixed(3)} m`}
                onChange={(minWebClearance) => set('minWebClearance', minWebClearance)}
              />
              <Slider
                label="Lancet arch / frame"
                tip="LANCET_ARCH width as fraction of outer frame (bar network)."
                value={t.lancetArchWidthRatio ?? 0.55}
                min={0.35}
                max={0.75}
                step={0.01}
                display={`${((t.lancetArchWidthRatio ?? 0.55) * 100).toFixed(0)}%`}
                onChange={(lancetArchWidthRatio) =>
                  setRatio('lancetArchWidthRatio', lancetArchWidthRatio)
                }
              />
              <Slider
                label="Oculus ring / frame"
                tip="OCULUS_RING / OCULUS_FRAME width as fraction of outer frame."
                value={t.oculusFrameWidthRatio ?? 0.42}
                min={0.25}
                max={0.6}
                step={0.01}
                display={`${((t.oculusFrameWidthRatio ?? 0.42) * 100).toFixed(0)}%`}
                onChange={(oculusFrameWidthRatio) =>
                  setRatio('oculusFrameWidthRatio', oculusFrameWidthRatio)
                }
              />
              <Slider
                label="Foil bar / frame"
                tip="FOIL_BAR semantic width (hierarchy + molding scale)."
                value={t.foilBarWidthRatio ?? 0.28}
                min={0.18}
                max={0.45}
                step={0.01}
                display={`${((t.foilBarWidthRatio ?? 0.28) * 100).toFixed(0)}%`}
                onChange={(foilBarWidthRatio) => setRatio('foilBarWidthRatio', foilBarWidthRatio)}
              />
            </div>
          </details>
        </>
      ) : null}
    </>
  )
}

function RegionInfo({ construction }) {
  const m = construction?.metadata?.regionMetrics
  const sv = construction?.metadata?.solidVoid ?? construction?.solidVoid
  const sk = sv?.skeleton ?? construction?.skeleton
  if (!m && !sv) {
    return <p className="control-hint">Region metrics available for Tracery solid/void models.</p>
  }
  const fmt = (v, digits = 3) =>
    v == null || !Number.isFinite(v) ? 'unavailable' : `${Number(v).toFixed(digits)} m²`
  const fmtM = (v) => (v == null || !Number.isFinite(v) ? 'unavailable' : `${Number(v).toFixed(3)} m`)
  const preset =
    construction?.parameters?.architecturePreset ??
    sv?.parameters?.architecturePreset ??
    sk?.parameters?.architecturePreset
  const stage = sv?.metrics?.grammarStage ?? sk?.metadata?.grammarStage ?? '—'
  return (
    <>
      {preset ? <p className="control-hint">Active preset: {preset}</p> : null}
      <p className="control-hint">Grammar stage: {stage}</p>
      {sv?.metrics?.hierarchicalTracery || sk?.type === 'hierarchicalTraceryGraph' ? (
        <>
          <p className="control-hint">
            Recursion depth: {sv?.metrics?.hierarchicalDepth ?? sk?.hierarchy?.depth ?? '—'}
          </p>
          <p className="control-hint">
            Architectural cells: {sv?.metrics?.cellCount ?? sk?.hierarchy?.cellCount ?? '—'}
          </p>
          <p className="control-hint">
            Accepted subdivisions: {sv?.metrics?.acceptedSubdivisions ?? sk?.hierarchy?.accepted ?? '—'}
          </p>
          <p className="control-hint">
            Rejected subdivisions: {sv?.metrics?.rejectedSubdivisions ?? sk?.hierarchy?.rejected ?? '—'}
          </p>
        </>
      ) : null}
      <p className="control-hint">
        Graph nodes: {sv?.metrics?.nodeCount ?? (sk?.nodes ? Object.keys(sk.nodes).length : '—')} ·
        members: {sv?.metrics?.memberCount ?? (sk?.members ? Object.keys(sk.members).length : '—')}
      </p>
      <p className="control-hint">
        Stone components:{' '}
        {sv?.metrics?.stripComponentCount ?? (m?.connectivityOk ? 1 : '—')}
      </p>
      <p className="control-hint">Solid regions: {m?.solidRegionCount ?? '—'}</p>
      <p className="control-hint">Openings: {m?.openingCount ?? '—'}</p>
      <p className="control-hint">Solid area: {fmt(m?.solidArea ?? sv?.metrics?.solidArea)}</p>
      <p className="control-hint">Opening area: {fmt(m?.openingArea ?? sv?.metrics?.openingArea)}</p>
      <p className="control-hint">Min clearance: {fmtM(m?.minDetectedClearance)}</p>
      <p className="control-hint">
        Boundaries: {m?.boundaryValid ?? sv?.metrics?.boundaryValid ? 'valid' : 'invalid'} ·
        Connected: {m?.connectivityOk ?? sv?.metrics?.connectivityOk ? 'yes' : 'no'}
      </p>
      {construction?.validation?.warnings?.length ? (
        <p className="control-hint grammar-warning-text">
          {construction.validation.warnings.slice(0, 3).join('; ')}
        </p>
      ) : null}
    </>
  )
}

function StoneControls({ stone, onPatch, assembly }) {
  const s = { ...DEFAULT_STONE_SETTINGS, ...stone }
  const set = (partial) => onPatch({ ...s, ...partial })
  const m = assembly?.metrics

  return (
    <>
      <Select
        label="Compare mode"
        tip="Compare Baseline · Refined · Bar Network at the same span, camera, and lighting."
        value={s.compareMode ?? 'off'}
        options={COMPARE_MODES.map(({ id, label }) => ({ id, label }))}
        onChange={(compareMode) => set({ compareMode })}
      />
      <Toggle
        label="Presentation clean"
        tip="Hide debug overlays / axes / normal ticks for architectural comparison."
        value={s.presentationClean === true}
        onChange={(presentationClean) => set({ presentationClean })}
      />
      <Select
        label="View preset"
        tip="Orbit camera presets for geometric inspection."
        value={s.viewPreset}
        options={STONE_VIEW_PRESETS.map(({ id, label }) => ({ id, label }))}
        onChange={(viewPreset) => set({ viewPreset })}
      />
      <Select
        label="Inspect layer"
        tip="Combined / Structural / Moldings / Network Graph / Section / normals."
        value={s.inspectLayer ?? 'combined'}
        options={STONE_INSPECT_LAYERS.map(({ id, label }) => ({ id, label }))}
        onChange={(inspectLayer) => set({ inspectLayer })}
      />
      <Toggle
        label="Show network junction IDs"
        tip="Label semantic nodes when Inspect = Network Graph."
        value={s.showNetworkIds === true}
        onChange={(showNetworkIds) => set({ showNetworkIds })}
      />
      <Toggle
        label="Show network member widths"
        tip="Annotate member class + width on the network graph."
        value={s.showNetworkWidths !== false}
        onChange={(showNetworkWidths) => set({ showNetworkWidths })}
      />
      <Toggle
        label="Hierarchy coloring"
        tip="Network Graph: color by hierarchy level (L0 parent / L1 secondary / L2 tertiary / foil)."
        value={s.hierarchyColoring === true}
        onChange={(hierarchyColoring) => set({ hierarchyColoring })}
      />
      <Select
        label="Display mode"
        tip="Solid / Wireframe / Solid + Edges."
        value={s.displayMode}
        options={STONE_DISPLAY_MODES.map(({ id, label }) => ({ id, label }))}
        onChange={(displayMode) => set({ displayMode })}
      />
      <Toggle
        label="Show structural stone"
        tip="Watertight extrusion of the 13C.1 stone region."
        value={s.showStructural !== false}
        onChange={(showStructural) => set({ showStructural })}
      />
      <Toggle
        label="Show moldings"
        tip="Decorative profile sweeps — separate meshes, not boolean-unioned."
        value={s.showMoldings !== false}
        onChange={(showMoldings) => set({ showMoldings })}
      />
      <Toggle
        label="Show normals"
        tip="Debug normal ticks on structural mesh."
        value={s.showNormals === true}
        onChange={(showNormals) => set({ showNormals })}
      />
      <Toggle
        label="Show axes"
        tip="World XYZ helper."
        value={s.showAxes !== false}
        onChange={(showAxes) => set({ showAxes })}
      />
      <Slider
        label="Stone depth"
        tip="Structural extrusion depth (meters). Default 0.25 m."
        value={s.stoneDepth}
        min={0.05}
        max={0.8}
        step={0.01}
        display={`${(s.stoneDepth ?? 0).toFixed(2)} m`}
        onChange={(stoneDepth) => set({ stoneDepth })}
      />
      <Select
        label="Depth alignment"
        tip="Front / Centered / Back along +Z."
        value={s.depthAlignment}
        options={DEPTH_ALIGNMENT_OPTIONS.map(({ id, label }) => ({ id, label }))}
        onChange={(depthAlignment) => set({ depthAlignment })}
      />
      <Select
        label="Tessellation"
        tip="Draft / Standard / High sampling of exact 2D edges."
        value={s.tessellation}
        options={TESSELLATION_OPTIONS.map(({ id, label }) => ({ id, label }))}
        onChange={(tessellation) => set({ tessellation })}
      />
      <Toggle
        label="Enable moldings"
        tip="Sweep parametric profiles along outer + opening loops. Hierarchical presets default OFF — toggle ON and keep Show moldings / Combined 3D."
        value={s.moldingEnabled === true}
        onChange={(moldingEnabled) =>
          set({
            moldingEnabled,
            showMoldings: moldingEnabled ? true : s.showMoldings,
            // Readable default section when enabling after a moldings-off preset
            ...(moldingEnabled && !(s.profileWidth > 0.04)
              ? { profileWidth: 0.055, profileDepth: 0.07 }
              : {}),
          })
        }
      />
      <Select
        label="Molding profile"
        tip="Flat / Chamfered / Rounded / Compound Gothic (computational approx.)."
        value={s.profileType}
        options={PROFILE_TYPE_OPTIONS.map(({ id, label }) => ({ id, label }))}
        onChange={(profileType) => set({ profileType })}
      />
      <Slider
        label="Profile width"
        tip="Outward extent of molding cross-section (m)."
        value={s.profileWidth}
        min={0.02}
        max={0.16}
        step={0.005}
        display={`${(s.profileWidth ?? 0).toFixed(3)} m`}
        onChange={(profileWidth) => set({ profileWidth })}
      />
      <Slider
        label="Profile depth"
        tip="Molding extent along wall depth (m)."
        value={s.profileDepth}
        min={0.03}
        max={0.2}
        step={0.005}
        display={`${(s.profileDepth ?? 0).toFixed(3)} m`}
        onChange={(profileDepth) => set({ profileDepth })}
      />
      <Slider
        label="Chamfer size"
        tip="Bevel size for chamfered / compound profiles."
        value={s.chamferSize}
        min={0}
        max={0.06}
        step={0.002}
        display={`${(s.chamferSize ?? 0).toFixed(3)} m`}
        onChange={(chamferSize) => set({ chamferSize })}
      />
      <Slider
        label="Bead radius"
        tip="Rounded / compound bead radius."
        value={s.beadRadius}
        min={0}
        max={0.04}
        step={0.002}
        display={`${(s.beadRadius ?? 0).toFixed(3)} m`}
        onChange={(beadRadius) => set({ beadRadius })}
      />
      <Slider
        label="Recess depth"
        tip="Compound Gothic recess into the profile depth."
        value={s.recessDepth}
        min={0}
        max={0.05}
        step={0.002}
        display={`${(s.recessDepth ?? 0).toFixed(3)} m`}
        onChange={(recessDepth) => set({ recessDepth })}
      />
      <details className="control-section" open>
        <summary>Stone Profiles</summary>
        <div className="section-controls">
          <Toggle
            label="Molding hierarchy"
            tip="Scale profile width/depth by member class (outer heaviest → foil finest). Preserves 13D.1 cusp/hard-edge paths."
            value={s.moldingHierarchy === true}
            onChange={(moldingHierarchy) => set({ moldingHierarchy })}
          />
          <p className="control-hint">
            OUTER_FRAME › PRIMARY_MULLION › SECONDARY_TRACERY › FOIL_BAR profile scales.
          </p>
        </div>
      </details>
      {m ? (
        <p className="control-hint">
          Structural: {m.watertight ? 'watertight' : 'NOT watertight'} · vol{' '}
          {m.structuralVolumeAvailable ? `${m.structuralVolume.toFixed(4)} m³` : 'n/a'} ·{' '}
          {m.triangleCount} tris · moldings {m.decorativeTriangleCount} tris (not unioned)
          {assembly?.meta?.openingCount != null
            ? ` · openings ${assembly.meta.openingCount}`
            : ''}
          {assembly?.meta?.barNetwork ? ' · bar network' : ''}
          {assembly?.meta?.elaborate ? ' · elaborate' : ''}
          {assembly?.meta?.hierarchicalTracery
            ? ` · hierarchical L${assembly?.meta?.hierarchicalDepth ?? '?'}`
            : assembly?.meta?.oculusRefinement
              ? ' · oculus refined'
              : assembly?.meta?.secondaryTracery
                ? ' · secondary tracery'
                : assembly?.meta?.oculusNetwork
                  ? ' · oculus network'
                  : assembly?.meta?.skeleton
                    ? ' · skeleton'
                    : ''}
          {assembly?.meta?.grammarStage ? ` · ${assembly.meta.grammarStage}` : ''}
        </p>
      ) : null}
      {assembly?.errors?.length ? (
        <p className="control-hint grammar-invalid-text">{assembly.errors.join('; ')}</p>
      ) : null}
      <p className="control-hint">
        Junctions: continuous per-loop sweeps; sharp dual-frame cusps; butt fallback across
        separate paths. Combined assembly is not a single watertight solid.
      </p>
    </>
  )
}

function AssemblyControls({
  assembly,
  facade,
  surfaceSemantics,
  tracery,
  onPatch,
  onPatchTracery,
  onEditWindowModule,
  growthAttachment = null,
  onDistributeGrowthSeeds = null,
  onClearGrowthSeeds = null,
  onDeleteSelectedGrowthAnchor = null,
  selectedGrowthAnchorId = null,
  growthPathPreview = null,
  controlTier = 'essential',
}) {
  const a = { ...DEFAULT_ASSEMBLY_SETTINGS, ...assembly }
  const set = (partial) => onPatch({ ...a, ...partial })
  const m = facade?.metrics
  const sd = surfaceSemantics?.diagnostics
  const linkMode = a.windowLinkMode ?? WINDOW_LINK_MODES.LINKED_TO_MASTER
  const linked = linkMode === WINDOW_LINK_MODES.LINKED_TO_MASTER
  const showAdvanced = controlTierAllows(controlTier, 'advanced')
  const showDebug = controlTierAllows(controlTier, 'debug')
  const ga = growthAttachment
  const gd = ga?.diagnostics

  return (
    <>
      <p className="control-hint" style={{ marginBottom: '0.5rem', opacity: 0.9 }}>
        WINDOW SOURCE:{' '}
        <strong>{linked ? 'LINKED TO STONE / 3D' : 'CUSTOM OVERRIDE'}</strong>
        {facade?.windowGeometryKey ? (
          <span style={{ display: 'block', fontSize: '0.75em', opacity: 0.7 }}>
            shared module active
          </span>
        ) : null}
      </p>
      <Select
        label="Window link"
        tip="Linked to Master uses the Stone / 3D window design. Custom Override defers per-bay edits (minimal in 13E.3.2)."
        value={linkMode}
        options={[
          { id: WINDOW_LINK_MODES.LINKED_TO_MASTER, label: 'Linked to Master' },
          { id: WINDOW_LINK_MODES.CUSTOM_OVERRIDE, label: 'Custom Override' },
        ]}
        onChange={(windowLinkMode) => set({ windowLinkMode })}
      />
      {typeof onEditWindowModule === 'function' ? (
        <button type="button" className="action-button" onClick={onEditWindowModule}>
          Edit Window Module
        </button>
      ) : null}
      <Select
        label="Assembly type"
        tip="Single Bay / Repeated Bays / Facade Elevation (shared piers + base course)."
        value={a.assemblyType}
        options={[
          { id: ASSEMBLY_TYPES.SINGLE_BAY, label: 'Single Bay' },
          { id: ASSEMBLY_TYPES.REPEATED_BAYS, label: 'Repeated Bays' },
          { id: ASSEMBLY_TYPES.FACADE_ELEVATION, label: 'Facade Elevation' },
        ]}
        onChange={(assemblyType) => set({ assemblyType })}
      />
      <Slider
        label="Bay count"
        tip="1–7 bays, origin-centered. Regenerates the full assembly."
        value={a.bayCount ?? 3}
        min={1}
        max={7}
        step={1}
        display={String(a.bayCount ?? 3)}
        onChange={(bayCount) => set({ bayCount })}
      />
      <Slider
        label="Bay spacing"
        tip="Extra gap between pier faces (m), added to bayWidth + pierWidth pitch."
        value={a.baySpacing ?? 0.05}
        min={0}
        max={0.6}
        step={0.01}
        display={`${(a.baySpacing ?? 0.05).toFixed(2)} m`}
        onChange={(baySpacing) => set({ baySpacing })}
      />
      <Slider
        label="Bay width"
        tip="Clear bay width allocated to each window module (m)."
        value={a.bayWidth ?? 3}
        min={1.6}
        max={5}
        step={0.05}
        display={`${(a.bayWidth ?? 3).toFixed(2)} m`}
        onChange={(bayWidth) => set({ bayWidth })}
      />
      <Slider
        label="Window scale"
        tip="Uniform scale applied to each module span (variation modes may override)."
        value={a.windowScale ?? 1}
        min={0.7}
        max={1.25}
        step={0.01}
        display={(a.windowScale ?? 1).toFixed(2)}
        onChange={(windowScale) => set({ windowScale })}
      />
      <Select
        label="Variation mode"
        tip="Uniform / Symmetric (mirrored) / Center Emphasis (central bay or central pair)."
        value={a.variationMode}
        options={[
          { id: VARIATION_MODES.UNIFORM, label: 'Uniform' },
          { id: VARIATION_MODES.SYMMETRIC, label: 'Symmetric' },
          { id: VARIATION_MODES.CENTER_EMPHASIS, label: 'Center Emphasis' },
        ]}
        onChange={(variationMode) => set({ variationMode })}
      />
      <Slider
        label="Pier width"
        tip="Shared vertical pier thickness between bays (m)."
        value={a.pierWidth ?? 0.28}
        min={0.12}
        max={0.55}
        step={0.01}
        display={`${(a.pierWidth ?? 0.28).toFixed(2)} m`}
        onChange={(pierWidth) => set({ pierWidth })}
      />
      <Slider
        label="Pier depth"
        tip="Pier extent along wall depth / Z (m)."
        value={a.pierDepth ?? 0.45}
        min={0.2}
        max={0.9}
        step={0.01}
        display={`${(a.pierDepth ?? 0.45).toFixed(2)} m`}
        onChange={(pierDepth) => set({ pierDepth })}
      />
      <Slider
        label="Buttress projection"
        tip="Simple forward buttress stub depth (m). 0 disables."
        value={a.buttressProjection ?? 0.2}
        min={0}
        max={0.6}
        step={0.01}
        display={`${(a.buttressProjection ?? 0.2).toFixed(2)} m`}
        onChange={(buttressProjection) => set({ buttressProjection })}
      />
      <Toggle
        label="Show structural supports"
        tip="Toggle pier / buttress placeholders and shared bay boundaries."
        value={a.showStructuralSupports !== false}
        onChange={(showStructuralSupports) => set({ showStructuralSupports })}
      />
      <Slider
        label="Window subdivision depth"
        tip="Shared with Stone / 3D hierarchicalDepth (0–2). Updates the linked window design."
        value={tracery?.hierarchicalDepth ?? a.hierarchicalDepth ?? 1}
        min={0}
        max={2}
        step={1}
        display={String(tracery?.hierarchicalDepth ?? a.hierarchicalDepth ?? 1)}
        onChange={(hierarchicalDepth) => {
          set({ hierarchicalDepth })
          if (typeof onPatchTracery === 'function') {
            onPatchTracery({
              ...(tracery ?? {}),
              hierarchicalDepth,
            })
          }
        }}
      />
      <Select
        label="View preset"
        tip="Front elevation / Three-quarter / Side / Top. Fit to Assembly after changes."
        value={a.viewPreset ?? 'front'}
        options={ASSEMBLY_VIEW_PRESETS.map(({ id, label }) => ({ id, label }))}
        onChange={(viewPreset) => set({ viewPreset })}
      />
      <Select
        label="Inspect layer"
        tip="Combined / Structural / Assembly Graph (bay + pier markers)."
        value={a.inspectLayer ?? 'combined'}
        options={ASSEMBLY_INSPECT_LAYERS.map(({ id, label }) => ({ id, label }))}
        onChange={(inspectLayer) => set({ inspectLayer })}
      />
      <details className="control-section">
        <summary>Growth Substrate</summary>
        <div className="section-controls">
          <Toggle
            label="Show semantic overlay"
            tip="SURFACE SEMANTICS inspection — does not change default stone materials."
            value={a.showSemanticOverlay === true || a.inspectLayer === 'surface-semantics'}
            onChange={(showSemanticOverlay) =>
              set({
                showSemanticOverlay,
                inspectLayer: showSemanticOverlay
                  ? 'surface-semantics'
                  : a.inspectLayer === 'surface-semantics'
                    ? 'combined'
                    : a.inspectLayer,
              })
            }
          />
          <Select
            label="Semantic view"
            tip="Component Type / Surface Orientation / Eligibility / Growth Weight / Feature Graph / Growth Zones."
            value={a.semanticView ?? 'COMPONENT_TYPE'}
            options={SEMANTIC_VIEW_OPTIONS.map(({ id, label }) => ({ id, label }))}
            onChange={(semanticView) =>
              set({
                semanticView,
                showSemanticOverlay: true,
                inspectLayer: 'surface-semantics',
              })
            }
          />
          <Slider
            label="Structural growth weight"
            tip="Default weight for piers, buttresses, bases (0–1)."
            value={a.structuralGrowthWeight ?? 0.85}
            min={0}
            max={1}
            step={0.01}
            display={(a.structuralGrowthWeight ?? 0.85).toFixed(2)}
            onChange={(structuralGrowthWeight) => set({ structuralGrowthWeight })}
          />
          <Slider
            label="Tracery growth weight"
            tip="Default weight for mullions, foils, fine tracery (0–1)."
            value={a.traceryGrowthWeight ?? 0.35}
            min={0}
            max={1}
            step={0.01}
            display={(a.traceryGrowthWeight ?? 0.35).toFixed(2)}
            onChange={(traceryGrowthWeight) => set({ traceryGrowthWeight })}
          />
          <Slider
            label="Recessed growth weight"
            tip="Weight boost for recesses / intrados candidates (0–1)."
            value={a.recessedGrowthWeight ?? 0.7}
            min={0}
            max={1}
            step={0.01}
            display={(a.recessedGrowthWeight ?? 0.7).toFixed(2)}
            onChange={(recessedGrowthWeight) => set({ recessedGrowthWeight })}
          />
          <Slider
            label="Sacred facade emphasis"
            tip="Emphasis for SACRED_FACADE front-facing stone zones (0–1)."
            value={a.sacredFacadeEmphasis ?? 0.55}
            min={0}
            max={1}
            step={0.01}
            display={(a.sacredFacadeEmphasis ?? 0.55).toFixed(2)}
            onChange={(sacredFacadeEmphasis) => set({ sacredFacadeEmphasis })}
          />
          <Toggle
            label="Protect window openings"
            tip="Policy only — empty openings never become growable surfaces when off."
            value={a.protectWindowOpenings !== false}
            onChange={(protectWindowOpenings) => set({ protectWindowOpenings })}
          />
          {sd ? (
            <p className="control-hint">
              Components {sd.componentCount} · patches {sd.surfacePatchCount} · eligible{' '}
              {sd.eligibleSurfaceArea?.toFixed?.(2) ?? '—'} m² · restricted{' '}
              {sd.restrictedSurfaceArea?.toFixed?.(2) ?? '—'} m² · openings{' '}
              {sd.protectedOpeningCount} · graph {sd.featureGraphEdgeCount} · joints{' '}
              {sd.jointDataStatus}
            </p>
          ) : null}
          <p className="control-hint">
            Semantic substrate for future vegetation (13E.3). Overlay colors do not alter
            default materials. Camera pose persists across weight edits.
          </p>
        </div>
      </details>
      <details className="control-section" open>
        <summary>Growth Attachment</summary>
        <div className="section-controls">
          <Select
            label="Placement Mode"
            tip="Manual click placement vs automatic distribution."
            value={a.growthPlacementMode ?? 'manual'}
            options={GROWTH_PLACEMENT_MODE_OPTIONS.map(({ id, label }) => ({ id, label }))}
            onChange={(growthPlacementMode) =>
              set({
                growthPlacementMode,
                growthPlaceSeedActive:
                  growthPlacementMode === 'manual' ? a.growthPlaceSeedActive : false,
              })
            }
          />
          <Select
            label="Distribution Mode"
            tip="Area-aware seed sampling strategy (automatic)."
            value={a.growthDistributionMode ?? 'WEIGHTED_BY_ELIGIBILITY'}
            options={GROWTH_DISTRIBUTION_OPTIONS.map(({ id, label }) => ({ id, label }))}
            onChange={(growthDistributionMode) => set({ growthDistributionMode })}
          />
          <Slider
            label="Seed Count"
            tip="Requested automatic seeds (accepted may be lower due to spacing)."
            value={a.growthSeedCount ?? 24}
            min={1}
            max={120}
            step={1}
            display={String(a.growthSeedCount ?? 24)}
            onChange={(growthSeedCount) => set({ growthSeedCount })}
          />
          <Slider
            label="Random Seed"
            tip="Deterministic RNG seed for automatic distribution."
            value={a.growthRandomSeed ?? 13}
            min={0}
            max={9999}
            step={1}
            display={String(a.growthRandomSeed ?? 13)}
            onChange={(growthRandomSeed) => set({ growthRandomSeed })}
          />
          <Toggle
            label="Place Seed"
            tip="Deliberate placement mode — click eligible stone patches. Orbit still works when dragging."
            value={a.growthPlaceSeedActive === true}
            onChange={(growthPlaceSeedActive) =>
              set({
                growthPlaceSeedActive,
                growthPlacementMode: growthPlaceSeedActive ? 'manual' : a.growthPlacementMode,
                showGrowthSeeds: true,
              })
            }
          />
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="action-button"
              onClick={() => onDistributeGrowthSeeds?.()}
            >
              Distribute Seeds
            </button>
            <button
              type="button"
              className="action-button"
              onClick={() => onClearGrowthSeeds?.()}
            >
              Clear Seeds
            </button>
            <button
              type="button"
              className="action-button"
              disabled={!selectedGrowthAnchorId}
              onClick={() => onDeleteSelectedGrowthAnchor?.()}
            >
              Delete Selected
            </button>
          </div>
          <Toggle
            label="Show Seeds"
            tip="Anchor markers (status-colored)."
            value={a.showGrowthSeeds !== false}
            onChange={(showGrowthSeeds) => set({ showGrowthSeeds })}
          />
          <Toggle
            label="Show Navigation Paths"
            tip="Select two anchors to preview a surface-following path."
            value={a.showGrowthNavPaths === true}
            onChange={(showGrowthNavPaths) => set({ showGrowthNavPaths })}
          />
          {showAdvanced ? (
            <>
              <Slider
                label="Minimum Seed Spacing"
                tip="Rejection distance between automatic seeds (m)."
                value={a.growthMinSeedSpacing ?? 0.22}
                min={0.05}
                max={1}
                step={0.01}
                display={`${(a.growthMinSeedSpacing ?? 0.22).toFixed(2)} m`}
                onChange={(growthMinSeedSpacing) => set({ growthMinSeedSpacing })}
              />
              <Toggle
                label="Restricted Surface Override"
                tip="Allow placement on RESTRICTED surfaces. PROHIBITED always rejected."
                value={a.growthAllowRestricted === true}
                onChange={(growthAllowRestricted) => set({ growthAllowRestricted })}
              />
              <Toggle
                label="Prefer Vertical Surfaces"
                tip="Bias automatic sampling toward upright stone faces."
                value={a.growthPreferVertical !== false}
                onChange={(growthPreferVertical) => set({ growthPreferVertical })}
              />
              <Toggle
                label="Prefer Recesses"
                tip="Bias toward RECESS / INTRADOS surfaces."
                value={a.growthPreferRecesses === true}
                onChange={(growthPreferRecesses) => set({ growthPreferRecesses })}
              />
              <Toggle
                label="Prefer Structural Junctions"
                tip="Bias feature-based distribution toward junction-rich components."
                value={a.growthPreferJunctions !== false}
                onChange={(growthPreferJunctions) => set({ growthPreferJunctions })}
              />
              <Toggle
                label="Enable Molding Attachments"
                tip="Decorative moldings stay non-attachable unless enabled (structural meshes only today)."
                value={a.growthEnableMoldingAttachments === true}
                onChange={(growthEnableMoldingAttachments) =>
                  set({ growthEnableMoldingAttachments })
                }
              />
            </>
          ) : null}
          {showDebug ? (
            <>
              <Toggle
                label="Show Normals"
                tip="Outward surface normals at anchors."
                value={a.showGrowthNormals === true}
                onChange={(showGrowthNormals) => set({ showGrowthNormals })}
              />
              <Toggle
                label="Show Tangents"
                tip="Orthonormal tangent frames at anchors."
                value={a.showGrowthTangents === true}
                onChange={(showGrowthTangents) => set({ showGrowthTangents })}
              />
              <Toggle
                label="Show Navigation Graph"
                tip="Patch-center crawl graph (no void shortcuts)."
                value={a.showGrowthNavGraph === true}
                onChange={(showGrowthNavGraph) => set({ showGrowthNavGraph })}
              />
              <Toggle
                label="Show Invalid Anchors"
                tip="ORPHANED / BLOCKED markers."
                value={a.showInvalidGrowthAnchors !== false}
                onChange={(showInvalidGrowthAnchors) => set({ showInvalidGrowthAnchors })}
              />
              <Toggle
                label="Show Collision Diagnostics"
                tip="Sparse eligible / blocked patch markers."
                value={a.showGrowthCollisionDiagnostics === true}
                onChange={(showGrowthCollisionDiagnostics) =>
                  set({ showGrowthCollisionDiagnostics })
                }
              />
              <Slider
                label="Surface Projection Tolerance"
                tip="Max distance for hit→surface projection (m)."
                value={a.growthProjectionTolerance ?? 0.08}
                min={0.01}
                max={0.4}
                step={0.01}
                display={`${(a.growthProjectionTolerance ?? 0.08).toFixed(2)} m`}
                onChange={(growthProjectionTolerance) => set({ growthProjectionTolerance })}
              />
              <Slider
                label="Navigation Gap Tolerance"
                tip="Max gap for adjacent patch links (m)."
                value={a.growthNavigationGapTolerance ?? 0.35}
                min={0.05}
                max={1.2}
                step={0.01}
                display={`${(a.growthNavigationGapTolerance ?? 0.35).toFixed(2)} m`}
                onChange={(growthNavigationGapTolerance) =>
                  set({ growthNavigationGapTolerance })
                }
              />
            </>
          ) : null}
          {ga?.anchors || ga?.distributionReport || growthPathPreview ? (
            <p className="control-hint">
              Anchors {ga?.anchors?.length ?? 0}
              {ga?.distributionReport
                ? ` · dist ${ga.distributionReport.accepted}/${ga.distributionReport.requested}`
                : ''}
              {(() => {
                const list = ga?.anchors ?? []
                if (!list.length && !gd) return ''
                const valid = list.filter((a) => a.status === 'VALID').length
                const reproj = list.filter((a) => a.status === 'REPROJECTED').length
                const blocked = list.filter((a) => a.status === 'BLOCKED').length
                const orphan = list.filter((a) => a.status === 'ORPHANED').length
                return ` · valid ${valid} · reproj ${reproj} · blocked ${blocked} · orphan ${orphan}`
              })()}
              {ga?.navigationGraph?.diagnostics
                ? ` · nav ${ga.navigationGraph.diagnostics.nodeCount}n/${ga.navigationGraph.diagnostics.edgeCount}e`
                : ''}
              {growthPathPreview
                ? ` · path ${growthPathPreview.status}${
                    Number.isFinite(growthPathPreview.totalLength)
                      ? ` ${growthPathPreview.totalLength.toFixed(2)} m`
                      : ''
                  }`
                : ''}
            </p>
          ) : null}
          <p className="control-hint">
            Growth attachment (13E.4) — seeds attach to real semantic stone surfaces. No
            vegetation geometry yet (14A). Camera persists across seed / weight edits.
          </p>
        </div>
      </details>
      <details className="control-section" open>
        <summary>Structural Articulation</summary>
        <div className="section-controls">
          <Select
            label="Support style"
            tip="Simple boxes / Clustered Pier / Stepped Buttress / Combined."
            value={a.supportStyle ?? SUPPORT_STYLES.COMBINED}
            options={[
              { id: SUPPORT_STYLES.SIMPLE, label: 'Simple' },
              { id: SUPPORT_STYLES.CLUSTERED_PIER, label: 'Clustered Pier' },
              { id: SUPPORT_STYLES.STEPPED_BUTTRESS, label: 'Stepped Buttress' },
              { id: SUPPORT_STYLES.COMBINED, label: 'Combined' },
            ]}
            onChange={(supportStyle) => set({ supportStyle })}
          />
          {(() => {
            const style = a.supportStyle ?? SUPPORT_STYLES.COMBINED
            const shaftsOn = supportStyleUsesShafts(style)
            const buttressOn = supportStyleUsesButtress(style)
            const baseCapOn = supportStyleUsesBaseCapital(style)
            const art = m?.articulation
            return (
              <>
                {!shaftsOn ? (
                  <p className="control-hint">
                    Shaft controls inactive — switch Support style to Clustered Pier or Combined.
                  </p>
                ) : null}
                <Select
                  label="Shaft arrangement"
                  tip="Engaged shaft layout on the pier core."
                  value={a.shaftArrangement ?? SHAFT_ARRANGEMENTS.FOUR_SHAFT}
                  disabled={!shaftsOn}
                  options={[
                    { id: SHAFT_ARRANGEMENTS.SIMPLE, label: 'Simple' },
                    { id: SHAFT_ARRANGEMENTS.FOUR_SHAFT, label: 'Four-Shaft' },
                    { id: SHAFT_ARRANGEMENTS.MULTI_SHAFT, label: 'Multi-Shaft' },
                  ]}
                  onChange={(shaftArrangement) => set({ shaftArrangement })}
                />
                <Slider
                  label="Shaft radius ratio"
                  tip="Engaged shaft radius as a fraction of pier half-width."
                  value={a.shaftRadiusRatio ?? 0.28}
                  min={0.12}
                  max={0.42}
                  step={0.01}
                  disabled={!shaftsOn}
                  display={(a.shaftRadiusRatio ?? 0.28).toFixed(2)}
                  onChange={(shaftRadiusRatio) => set({ shaftRadiusRatio })}
                />
                <Slider
                  label="Shaft projection"
                  tip="0 = flush to core face; 1 = strongly proud. Moves shaft centers outward."
                  value={a.shaftProjection ?? 0.55}
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={!shaftsOn}
                  display={(a.shaftProjection ?? 0.55).toFixed(2)}
                  onChange={(shaftProjection) => set({ shaftProjection })}
                />
                {!baseCapOn ? (
                  <p className="control-hint">
                    Base / capital inactive — requires Clustered Pier or Combined.
                  </p>
                ) : null}
                <Slider
                  label="Base height"
                  tip="Plinth + stepped base height (m). Also widens the base footprint."
                  value={a.baseHeight ?? 0.22}
                  min={0.08}
                  max={0.45}
                  step={0.01}
                  disabled={!baseCapOn || a.showBases === false}
                  display={`${(a.baseHeight ?? 0.22).toFixed(2)} m`}
                  onChange={(baseHeight) => set({ baseHeight })}
                />
                <Slider
                  label="Capital height"
                  tip="Collar + capital transition height (m)."
                  value={a.capitalHeight ?? 0.14}
                  min={0.06}
                  max={0.35}
                  step={0.01}
                  disabled={!baseCapOn || a.showCapitalTransitions === false}
                  display={`${(a.capitalHeight ?? 0.14).toFixed(2)} m`}
                  onChange={(capitalHeight) => set({ capitalHeight })}
                />
                {!buttressOn ? (
                  <p className="control-hint">
                    Buttress controls inactive — switch Support style to Stepped Buttress or
                    Combined.
                  </p>
                ) : null}
                <Slider
                  label="Buttress setback count"
                  tip="Number of stepped buttress stages (1–5)."
                  value={a.buttressSetbackCount ?? 3}
                  min={1}
                  max={5}
                  step={1}
                  disabled={!buttressOn}
                  display={String(a.buttressSetbackCount ?? 3)}
                  onChange={(buttressSetbackCount) => set({ buttressSetbackCount })}
                />
                <Slider
                  label="Buttress setback ratio"
                  tip="Each stage multiplies projection AND width by this ratio."
                  value={a.buttressSetbackRatio ?? 0.72}
                  min={0.5}
                  max={0.9}
                  step={0.01}
                  disabled={!buttressOn}
                  display={(a.buttressSetbackRatio ?? 0.72).toFixed(2)}
                  onChange={(buttressSetbackRatio) => set({ buttressSetbackRatio })}
                />
                <Toggle
                  label="Show bases"
                  tip="Pier plinth and stepped base transitions."
                  value={a.showBases !== false}
                  onChange={(showBases) => set({ showBases })}
                />
                <Toggle
                  label="Show capital transitions"
                  tip="Collar and capital transition blocks at pier head."
                  value={a.showCapitalTransitions !== false}
                  onChange={(showCapitalTransitions) => set({ showCapitalTransitions })}
                />
                {art ? (
                  <p className="control-hint">
                    Live pier: shafts {art.shaftCount} · offset{' '}
                    {art.meanShaftOffset?.toFixed?.(3) ?? '—'} m · base{' '}
                    {art.baseHeight?.toFixed?.(3) ?? '—'} m · capital{' '}
                    {art.capitalHeight?.toFixed?.(3) ?? '—'} m · stages{' '}
                    {art.buttressStageCount}
                  </p>
                ) : null}
              </>
            )
          })()}
        </div>
      </details>
      {m ? (
        <p className="control-hint">
          Bays {m.bayCount} · windows {m.windowModuleCount} · piers {m.pierCount ?? 0} · W{' '}
          {m.assemblyWidth?.toFixed?.(2) ?? '—'} m · vol{' '}
          {m.estimatedStoneVolume != null ? `${m.estimatedStoneVolume.toFixed(3)} m³` : '—'} ·
          cache {m.uniqueGeometries}/{m.cacheHits}
        </p>
      ) : null}
      {facade?.validation?.errors?.length ? (
        <p className="control-hint grammar-invalid-text">
          {facade.validation.errors.slice(0, 3).join('; ')}
        </p>
      ) : null}
      <p className="control-hint">
        Multi-object assembly — each window remains a validated 13D.9 strip-union solid. The
        facade is not a single watertight boolean. Camera pose persists across geometry edits
        (13E.2); use View preset / Fit to Assembly for intentional reframing.
      </p>
    </>
  )
}

function FoliateOrnamentControls({
  foliate,
  onPatch,
  growthAttachment,
  ornamentSkeleton,
  parametricMotif = null,
  onDistributeGrowthSeeds,
  onClearGrowthSeeds,
  onDeleteSelectedGrowthAnchor,
  selectedGrowthAnchorId,
  controlTier = 'essential',
}) {
  const f = { ...DEFAULT_FOLIATE_SETTINGS, ...(foliate ?? {}) }
  const set = (partial) => onPatch({ ...f, ...partial })
  const showAdvanced = controlTier === 'advanced' || controlTier === 'debug'
  const showDebug = controlTier === 'debug'
  const mode = f.compositionMode ?? COMPOSITION_MODES.SINGLE_MOTIF
  const legacy = mode === COMPOSITION_MODES.LEGACY_GROWTH
  const single = mode === COMPOSITION_MODES.SINGLE_MOTIF
  const diag = legacy
    ? ornamentSkeleton?.diagnostics ?? {}
    : parametricMotif?.diagnostics ?? {}
  const anchors = growthAttachment?.anchors?.length ?? 0
  const anchorOptions = (growthAttachment?.anchors ?? []).map((a) => ({
    id: a.anchorId,
    label: `${a.anchorId} · ${a.componentId ?? 'comp'}`,
  }))

  return (
    <>
      <p className="control-hint">
        Parametric Gothic motif laboratory (14A.1.2.1). Motifs root on shared Architectural
        Assembly initiation points — construction curves only. Refs REF-017 · REF-018 · REF-019 ·
        REF-020.
      </p>
      <Select
        label="Composition Mode"
        tip="Single Motif = one selected shared anchor; Full Facade = one motif per valid anchor; Legacy Growth = 14A.1.1 skeleton."
        value={mode}
        options={[
          { id: COMPOSITION_MODES.SINGLE_MOTIF, label: 'Single Motif' },
          { id: COMPOSITION_MODES.FULL_FACADE, label: 'Full Facade' },
          { id: COMPOSITION_MODES.LEGACY_GROWTH, label: 'Legacy Growth' },
        ]}
        onChange={(compositionMode) => set({ compositionMode })}
      />
      {!legacy ? (
        <>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="action-button" onClick={() => onDistributeGrowthSeeds?.()}>
              Distribute Initiation Points
            </button>
            <button type="button" className="action-button" onClick={() => onClearGrowthSeeds?.()}>
              Clear Points
            </button>
            <button
              type="button"
              className="action-button"
              disabled={!selectedGrowthAnchorId}
              onClick={() => onDeleteSelectedGrowthAnchor?.()}
            >
              Delete Selected
            </button>
          </div>
          {anchors < 1 ? (
            <p className="control-hint grammar-invalid-text">
              No shared initiation points. Place or distribute anchors on eligible stone (same
              system as Architectural Assembly).
            </p>
          ) : null}
          <Select
            label="Motif Type"
            tip="Composition grammar for the selected shared anchor."
            value={f.motifType ?? MOTIF_TYPES.SYMMETRICAL_SPANDREL_SCROLL}
            options={[
              {
                id: MOTIF_TYPES.SYMMETRICAL_SPANDREL_SCROLL,
                label: 'Symmetrical Gothic Spandrel Scroll',
              },
            ]}
            onChange={(motifType) => set({ motifType })}
          />
          {single ? (
            <Select
              label="Selected Anchor"
              tip="Shared GrowthAttachment anchor id — motif root must coincide with this point."
              value={
                f.selectedAnchorId ??
                selectedGrowthAnchorId ??
                growthAttachment?.anchors?.[0]?.anchorId ??
                (anchorOptions[0]?.id ?? 'none')
              }
              options={
                anchorOptions.length
                  ? anchorOptions
                  : [{ id: 'none', label: '(no shared anchors)' }]
              }
              onChange={(selectedAnchorId) => {
                if (selectedAnchorId === 'none') return
                set({ selectedAnchorId })
              }}
            />
          ) : null}
          <p className="control-hint">
            Anchor {diag.selectedAnchorId ?? f.selectedAnchorId ?? selectedGrowthAnchorId ?? '—'} ·
            host {parametricMotif?.hosts?.[0]?.kind ?? '—'} · component{' '}
            {parametricMotif?.hosts?.[0]?.hostComponentId ?? '—'} · surface{' '}
            {parametricMotif?.hosts?.[0]?.hostSurfaceId ?? '—'} · status{' '}
            {diag.emptyReason
              ? 'needs-anchor'
              : diag.rootOk === false
                ? 'root-fail'
                : diag.fitOk
                  ? 'ok'
                  : 'check'}
          </p>
          {diag.emptyReason ? (
            <p className="control-hint grammar-invalid-text">{diag.emptyReason}</p>
          ) : null}
          {(diag.invalidAnchors?.length ?? 0) > 0 ? (
            <p className="control-hint grammar-invalid-text">
              Invalid hosts:{' '}
              {diag.invalidAnchors
                .slice(0, 3)
                .map((x) => `${x.anchorId} (${x.reason})`)
                .join(' · ')}
            </p>
          ) : null}
          <Slider
            label="Motif Scale"
            tip="Overall scale of the motif inside the host area."
            value={f.motifScale ?? 1}
            min={0.4}
            max={1.4}
            step={0.01}
            display={`${Math.round((f.motifScale ?? 1) * 100)}%`}
            onChange={(motifScale) => set({ motifScale })}
          />
          <Slider
            label="Scroll Turns"
            tip="Primary volute winding count."
            value={f.scrollTurns ?? 1.25}
            min={0.5}
            max={2.5}
            step={0.05}
            display={(f.scrollTurns ?? 1.25).toFixed(2)}
            onChange={(scrollTurns) => set({ scrollTurns })}
          />
          <Slider
            label="Curl Strength"
            tip="Spiral tightness / secondary curl intensity."
            value={f.curlStrength ?? 0.7}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round((f.curlStrength ?? 0.7) * 100)}%`}
            onChange={(curlStrength) => set({ curlStrength })}
          />
          <Slider
            label="Symmetry Strength"
            tip="100% = exact local bilateral mirror; 80% soft asymmetry; 0% independent."
            value={f.symmetryStrength ?? 1}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round((f.symmetryStrength ?? 1) * 100)}%`}
            onChange={(symmetryStrength) => set({ symmetryStrength })}
          />
          <Slider
            label="Branch Hierarchy"
            tip="Amount of secondary / tertiary subordinate scrolls."
            value={f.branchHierarchy ?? 0.65}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round((f.branchHierarchy ?? 0.65) * 100)}%`}
            onChange={(branchHierarchy) => set({ branchHierarchy })}
          />
          <Slider
            label="Creature Influence"
            tip="Biomorphic / skeletal morphology (REF-018). 0% traditional order."
            value={f.creatureInfluence ?? 0.3}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round((f.creatureInfluence ?? 0.3) * 100)}%`}
            onChange={(creatureInfluence) => set({ creatureInfluence })}
          />
          <Slider
            label="Random Seed"
            tip="Deterministic variation seed."
            value={f.randomSeed ?? 42}
            min={0}
            max={9999}
            step={1}
            display={String(f.randomSeed ?? 42)}
            onChange={(randomSeed) => set({ randomSeed })}
          />
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Toggle
              label="Primary Spine"
              tip="Reveal stage: ribbed primary axis."
              value={f.showPrimarySpine !== false}
              onChange={(showPrimarySpine) => set({ showPrimarySpine })}
            />
            <Toggle
              label="Primary Volutes"
              tip="Reveal stage: mirrored primary scrolls."
              value={f.showPrimaryVolutes !== false}
              onChange={(showPrimaryVolutes) => set({ showPrimaryVolutes })}
            />
            <Toggle
              label="Secondary Curls"
              tip="Reveal stage: subordinate curling branches."
              value={f.showSecondaryCurls !== false}
              onChange={(showSecondaryCurls) => set({ showSecondaryCurls })}
            />
          </div>
          {showAdvanced ? (
            <>
              <Slider
                label="Primary Spine Curvature"
                tip="Mild S-curve of the ribbed spine."
                value={f.primarySpineCurvature ?? 0.35}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round((f.primarySpineCurvature ?? 0.35) * 100)}%`}
                onChange={(primarySpineCurvature) => set({ primarySpineCurvature })}
              />
              <Slider
                label="Volute Radius"
                tip="Primary scroll outer radius relative to host."
                value={f.voluteRadius ?? 0.42}
                min={0.15}
                max={0.8}
                step={0.01}
                display={(f.voluteRadius ?? 0.42).toFixed(2)}
                onChange={(voluteRadius) => set({ voluteRadius })}
              />
              <Slider
                label="Volute Tightness"
                tip="How quickly the spiral contracts inward."
                value={f.voluteTightness ?? 0.75}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round((f.voluteTightness ?? 0.75) * 100)}%`}
                onChange={(voluteTightness) => set({ voluteTightness })}
              />
              <Slider
                label="Secondary Curl Scale"
                tip="Relative size of secondary curls."
                value={f.secondaryCurlScale ?? 0.45}
                min={0.15}
                max={0.9}
                step={0.01}
                display={`${Math.round((f.secondaryCurlScale ?? 0.45) * 100)}%`}
                onChange={(secondaryCurlScale) => set({ secondaryCurlScale })}
              />
              <Slider
                label="Branch Attachment Position"
                tip="Where secondary curls leave the spine (0=base, 1=tip)."
                value={f.branchAttachmentPosition ?? 0.55}
                min={0.15}
                max={0.9}
                step={0.01}
                display={`${Math.round((f.branchAttachmentPosition ?? 0.55) * 100)}%`}
                onChange={(branchAttachmentPosition) => set({ branchAttachmentPosition })}
              />
              <Slider
                label="Negative Space Clearance"
                tip="Margin from host boundary and voids."
                value={f.negativeSpaceClearance ?? 0.06}
                min={0.02}
                max={0.15}
                step={0.005}
                display={`${((f.negativeSpaceClearance ?? 0.06) * 100).toFixed(1)} cm`}
                onChange={(negativeSpaceClearance) => set({ negativeSpaceClearance })}
              />
              <Slider
                label="Motif Rotation"
                tip="Reserved composition rotation (small)."
                value={f.motifRotation ?? 0}
                min={-0.25}
                max={0.25}
                step={0.01}
                display={(f.motifRotation ?? 0).toFixed(2)}
                onChange={(motifRotation) => set({ motifRotation })}
              />
              <Slider
                label="Motif Offset U"
                tip="Shift along local U (horizontal) inside host."
                value={f.motifOffsetU ?? 0}
                min={-0.5}
                max={0.5}
                step={0.01}
                display={(f.motifOffsetU ?? 0).toFixed(2)}
                onChange={(motifOffsetU) => set({ motifOffsetU })}
              />
              <Slider
                label="Motif Offset V"
                tip="Shift along local V (vertical) inside host."
                value={f.motifOffsetV ?? 0.05}
                min={-0.4}
                max={0.4}
                step={0.01}
                display={(f.motifOffsetV ?? 0.05).toFixed(2)}
                onChange={(motifOffsetV) => set({ motifOffsetV })}
              />
            </>
          ) : null}
          {showDebug ? (
            <>
              <Toggle
                label="Show Host Boundary"
                tip="Dashed UV ornament area of the selected host."
                value={f.showHostBoundary === true}
                onChange={(showHostBoundary) => set({ showHostBoundary })}
              />
              <Toggle
                label="Show Local Axes"
                tip="Host U / V / N axes at the local origin."
                value={f.showLocalAxes === true}
                onChange={(showLocalAxes) => set({ showLocalAxes })}
              />
              <Toggle
                label="Show Construction Curves"
                tip="Symmetry axis and construction guides."
                value={f.showConstructionCurves === true}
                onChange={(showConstructionCurves) => set({ showConstructionCurves })}
              />
              <Toggle
                label="Show Control Points"
                tip="Bezier / spiral control markers."
                value={f.showControlPoints === true}
                onChange={(showControlPoints) => set({ showControlPoints })}
              />
              <Toggle
                label="Show Branch Hierarchy"
                tip="Label curve roles and hierarchy levels."
                value={f.showBranchHierarchy === true}
                onChange={(showBranchHierarchy) => set({ showBranchHierarchy })}
              />
              <Toggle
                label="Show Invalid Geometry"
                tip="Dashed red for out-of-host / failed curves."
                value={f.showInvalidGeometry !== false}
                onChange={(showInvalidGeometry) => set({ showInvalidGeometry })}
              />
              <Toggle
                label="Show Clearance Zones"
                tip="Void / opening clearance circles in the host."
                value={f.showClearanceZones === true}
                onChange={(showClearanceZones) => set({ showClearanceZones })}
              />
              <Toggle
                label="Anchor Link Debug"
                tip="Source anchor marker, motif root, distance, host axes / boundary."
                value={f.showAnchorLinkDebug === true}
                onChange={(showAnchorLinkDebug) => set({ showAnchorLinkDebug })}
              />
            </>
          ) : null}
          <p className="control-hint">
            Motifs {diag.motifCount ?? 0} · anchors {diag.anchorCount ?? anchors} · unused{' '}
            {diag.unusedAnchorCount ?? 0} · curves {diag.curveCount ?? 0} · invalid{' '}
            {diag.invalidCurveCount ?? 0} · root {diag.rootOk === false ? 'fail' : 'ok'} · fit{' '}
            {diag.fitOk ? 'ok' : 'check'}
          </p>
        </>
      ) : (
        <>
          <p className="control-hint">
            Legacy Growth (14A.1.1) — branching skeleton from initiation anchors. Preserved for
            comparison.
          </p>
          {anchors < 1 ? (
            <p className="control-hint grammar-invalid-text">
              No ornament initiation points. Distribute or place anchors on eligible spandrel /
              arch-shoulder stone.
            </p>
          ) : null}
          {diag.emptyReason ? (
            <p className="control-hint grammar-invalid-text">{diag.emptyReason}</p>
          ) : null}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="action-button" onClick={() => onDistributeGrowthSeeds?.()}>
              Distribute Initiation Points
            </button>
            <button type="button" className="action-button" onClick={() => onClearGrowthSeeds?.()}>
              Clear Points
            </button>
            <button
              type="button"
              className="action-button"
              disabled={!selectedGrowthAnchorId}
              onClick={() => onDeleteSelectedGrowthAnchor?.()}
            >
              Delete Selected
            </button>
          </div>
          <Slider
            label="Growth Progress"
            tip="Reveal the precomputed skeleton (0% = initiation only)."
            value={f.growthProgress ?? 1}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round((f.growthProgress ?? 1) * 100)}%`}
            onChange={(growthProgress) => set({ growthProgress })}
          />
          <Slider
            label="Growth Length"
            tip="Primary motif spine extent along the host (m)."
            value={f.growthLength ?? 1.15}
            min={0.2}
            max={2.5}
            step={0.05}
            display={`${(f.growthLength ?? 1.15).toFixed(2)} m`}
            onChange={(growthLength) => set({ growthLength })}
          />
          <Slider
            label="Branch Density"
            tip="Number of secondary motif scrolls / offshoots."
            value={f.branchDensity ?? 0.55}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round((f.branchDensity ?? 0.55) * 100)}%`}
            onChange={(branchDensity) => set({ branchDensity })}
          />
          <Slider
            label="Curl Strength"
            tip="Scroll winding / spiral curvature."
            value={f.curlStrength ?? 0.7}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round((f.curlStrength ?? 0.7) * 100)}%`}
            onChange={(curlStrength) => set({ curlStrength })}
          />
          <Slider
            label="Symmetry Strength"
            tip="Motif-level bilateral mirroring."
            value={f.symmetryStrength ?? 1}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round((f.symmetryStrength ?? 1) * 100)}%`}
            onChange={(symmetryStrength) => set({ symmetryStrength })}
          />
          <Slider
            label="Creature Influence"
            tip="Biomorphic irregularity (REF-018)."
            value={f.creatureInfluence ?? 0.3}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round((f.creatureInfluence ?? 0.3) * 100)}%`}
            onChange={(creatureInfluence) => set({ creatureInfluence })}
          />
          <Slider
            label="Random Seed"
            tip="Deterministic RNG seed for growth variation."
            value={f.randomSeed ?? 42}
            min={0}
            max={9999}
            step={1}
            display={String(f.randomSeed ?? 42)}
            onChange={(randomSeed) => set({ randomSeed })}
          />
          {showAdvanced ? (
            <>
              <Slider
                label="Architectural Attraction"
                tip="Bias toward arch-shoulder / host tangent directions."
                value={f.architecturalAttraction ?? 0.65}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round((f.architecturalAttraction ?? 0.65) * 100)}%`}
                onChange={(architecturalAttraction) => set({ architecturalAttraction })}
              />
              <Slider
                label="Branch Angle"
                tip="Secondary split angle scale."
                value={f.branchAngle ?? 0.55}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round((f.branchAngle ?? 0.55) * 100)}%`}
                onChange={(branchAngle) => set({ branchAngle })}
              />
              <Slider
                label="Maximum Branch Depth"
                tip="Hierarchical recursion depth."
                value={f.maxBranchDepth ?? 3}
                min={0}
                max={5}
                step={1}
                display={String(f.maxBranchDepth ?? 3)}
                onChange={(maxBranchDepth) => set({ maxBranchDepth })}
              />
              <Slider
                label="Surface Adherence"
                tip="How tightly steps project onto eligible stone."
                value={f.surfaceAdherence ?? 0.85}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round((f.surfaceAdherence ?? 0.85) * 100)}%`}
                onChange={(surfaceAdherence) => set({ surfaceAdherence })}
              />
              <Slider
                label="Growth Step Size"
                tip="Skeleton sampling step (m)."
                value={f.growthStepSize ?? 0.055}
                min={0.03}
                max={0.2}
                step={0.01}
                display={`${(f.growthStepSize ?? 0.055).toFixed(2)} m`}
                onChange={(growthStepSize) => set({ growthStepSize })}
              />
              <Slider
                label="Minimum Branch Separation"
                tip="Reject steps that collide with existing skeleton."
                value={f.minBranchSeparation ?? 0.045}
                min={0.02}
                max={0.25}
                step={0.01}
                display={`${(f.minBranchSeparation ?? 0.045).toFixed(2)} m`}
                onChange={(minBranchSeparation) => set({ minBranchSeparation })}
              />
              <Slider
                label="Termination Threshold"
                tip="Length remainder that ends a branch."
                value={f.terminationThreshold ?? 0.04}
                min={0.01}
                max={0.2}
                step={0.01}
                display={`${(f.terminationThreshold ?? 0.04).toFixed(2)} m`}
                onChange={(terminationThreshold) => set({ terminationThreshold })}
              />
            </>
          ) : null}
          {showDebug ? (
            <>
              <Toggle
                label="Show Growth Nodes"
                tip="Draw node spheres along the skeleton."
                value={f.showGrowthNodes === true}
                onChange={(showGrowthNodes) => set({ showGrowthNodes })}
              />
              <Toggle
                label="Show Branch IDs"
                tip="Label branch ids in the viewport."
                value={f.showBranchIds === true}
                onChange={(showBranchIds) => set({ showBranchIds })}
              />
              <Toggle
                label="Show Surface Normals"
                tip="Debug host normals at nodes."
                value={f.showSurfaceNormals === true}
                onChange={(showSurfaceNormals) => set({ showSurfaceNormals })}
              />
              <Toggle
                label="Show Growth Directions"
                tip="Debug tangent growth vectors."
                value={f.showGrowthDirections === true}
                onChange={(showGrowthDirections) => set({ showGrowthDirections })}
              />
              <Toggle
                label="Show Invalid Segments"
                tip="Dashed segments where attachment failed."
                value={f.showInvalidSegments !== false}
                onChange={(showInvalidSegments) => set({ showInvalidSegments })}
              />
              <Toggle
                label="Show Attachment Anchors"
                tip="Initiation point markers from growth attachment."
                value={f.showAttachmentAnchors !== false}
                onChange={(showAttachmentAnchors) => set({ showAttachmentAnchors })}
              />
              <Toggle
                label="Motif Debug"
                tip="Host bounds, primary anchors, local symmetry axes."
                value={f.showMotifDebug === true}
                onChange={(showMotifDebug) => set({ showMotifDebug })}
              />
            </>
          ) : null}
          <p className="control-hint">
            Motifs {diag.motifCount ?? 0} · anchors {anchors} · nodes{' '}
            {diag.revealedNodeCount ?? diag.nodeCount ?? 0} · branches{' '}
            {diag.revealedBranchCount ?? diag.branchCount ?? 0} · rejected{' '}
            {diag.invalidSegmentCount ?? 0}
          </p>
        </>
      )}
    </>
  )
}

export default function GothicGrammarPanel({
  settings,
  onChange,
  construction,
  stoneAssembly,
  facadeAssembly,
  surfaceSemantics = null,
  growthAttachment = null,
  ornamentSkeleton = null,
  parametricMotif = null,
  onDistributeGrowthSeeds = null,
  onClearGrowthSeeds = null,
  onDeleteSelectedGrowthAnchor = null,
  selectedGrowthAnchorId = null,
  growthPathPreview = null,
}) {
  const patch = (change) => onChange({ ...settings, ...change })
  const enabledModes = CONSTRUCTION_MODES.filter((m) => m.enabled)
  const params = settings.exampleParams ?? DEFAULT_EXAMPLE_PARAMS[settings.exampleId] ?? {}
  const workspaceMode = settings.workspaceMode ?? 'pointed-arch'
  const workspaceCategory = settings.workspaceCategory ?? 'design'
  const technicalView = settings.technicalView ?? null
  const archMode = workspaceMode === 'pointed-arch' || workspaceMode === 'compare-arches'
  const traceryMode = workspaceMode === 'tracery'
  const stoneMode = workspaceMode === 'stone-3d'
  const foliateMode = workspaceMode === FOLIATE_WORKSPACE_ID
  const assemblyMode = workspaceMode === 'architectural-assembly'
  const displayModes = archMode || traceryMode
  const constructionAnatomyModes =
    workspaceMode === 'pointed-arch' || workspaceMode === 'tracery'
  const showTraceryParams = traceryMode || stoneMode
  const controlTier = settings.uiControlTier ?? 'essential'
  const showAdvanced = controlTier === 'advanced' || controlTier === 'debug'
  const showDebug = controlTier === 'debug'
  const constructionOverlay = {
    ...DEFAULT_CONSTRUCTION_OVERLAY,
    ...(settings.constructionOverlay ?? {}),
  }
  const workspaceSelectValue =
    workspaceCategory === 'technical' && technicalView
      ? technicalView
      : workspaceMode
  const workspaceOptions =
    workspaceCategory === 'technical'
      ? TECHNICAL_WORKSPACES.map(({ id, label }) => ({ id, label }))
      : DESIGN_WORKSPACES.filter((w) => w.enabled !== false).map(({ id, label }) => ({
          id,
          label,
        }))

  const setExample = (exampleId) => {
    // Geometry-only: do not bump fitToken (camera persistence — 13E.2).
    patch({
      exampleId,
      exampleParams: { ...DEFAULT_EXAMPLE_PARAMS[exampleId] },
    })
  }

  const isPerspectiveMode = (mode) =>
    mode === 'stone-3d' ||
    mode === 'architectural-assembly' ||
    mode === FOLIATE_WORKSPACE_ID

  const applyNav = (selectionId, category) => {
    const prev = settings.workspaceMode ?? 'pointed-arch'
    const nextSettings = applyWorkspaceNavigation(settings, selectionId, category)
    if (!nextSettings) return
    const next = nextSettings.workspaceMode
    const wasPerspective = isPerspectiveMode(prev)
    const nextPerspective = isPerspectiveMode(next)
    const bumpFit = !(wasPerspective && nextPerspective)
    onChange({
      ...nextSettings,
      ...(bumpFit ? { fitToken: (settings.fitToken ?? 0) + 1 } : {}),
    })
  }

  const setWorkspace = (next, { preserveCamera = false } = {}) => {
    const prev = settings.workspaceMode ?? 'pointed-arch'
    const wasPerspective = isPerspectiveMode(prev)
    const nextPerspective = isPerspectiveMode(next)
    // Stone ↔ Assembly ↔ Foliate share perspective — do not reframe (13E.3.2 / 14A.1).
    const bumpFit =
      !preserveCamera && !(wasPerspective && nextPerspective)
    patch({
      workspaceMode: next,
      workspaceCategory: next === 'kernel-examples' ? 'technical' : 'design',
      technicalView: next === 'kernel-examples' ? 'kernel-examples' : null,
      ...(bumpFit ? { fitToken: (settings.fitToken ?? 0) + 1 } : {}),
    })
  }

  const setWorkspaceCategory = (category) => {
    if (category === workspaceCategory) return
    if (category === 'technical') {
      const first = TECHNICAL_WORKSPACES[0]
      applyNav(first.id, 'technical')
      return
    }
    const designId =
      DESIGN_WORKSPACES.find((d) => d.id === workspaceMode && d.enabled !== false)?.id ??
      'pointed-arch'
    applyNav(designId, 'design')
  }

  const patchConstructionOverlay = (key, value) => {
    // Overlay options only — do not bump fitToken / regenerate camera.
    patch({
      constructionOverlay: {
        ...constructionOverlay,
        [key]: value,
      },
    })
  }

  return (
    <ControlPanel
      title="Gothic Grammar"
      hint="step 13e.4.3 · design / technical navigation · construction anatomy overlay"
    >
      <button type="button" className="action-button" onClick={() => onChange(resetGothicGrammar())}>
        Reset View Settings
      </button>
      <button
        type="button"
        className="action-button"
        onClick={() => patch({ resetViewToken: (settings.resetViewToken ?? 0) + 1 })}
      >
        Reset View
      </button>
      <button
        type="button"
        className="action-button"
        onClick={() => patch({ fitToken: (settings.fitToken ?? 0) + 1 })}
      >
        Fit to Geometry
      </button>

      <details className="control-section" open>
        <summary>Workspace</summary>
        <div className="section-controls">
          <Select
            label="Category"
            tip="Design workspaces for authoring. Technical / Inspection reuses existing overlays."
            value={workspaceCategory}
            options={WORKSPACE_CATEGORIES.map(({ id, label }) => ({ id, label }))}
            onChange={setWorkspaceCategory}
          />
          <Select
            label="Workspace"
            tip={
              workspaceCategory === 'technical'
                ? 'Kernel · Geometry Graph · Surface Semantics · Growth Navigation · Validation Diagnostics.'
                : 'Pointed Arch · Compare · Tracery · Stone / 3D · Architectural Assembly.'
            }
            value={workspaceSelectValue}
            options={workspaceOptions}
            onChange={(id) => applyNav(id, workspaceCategory)}
          />
          {displayModes ? (
            <Select
              label="Display"
              tip="Presentation / Construction overlays. Section (Tracery): solid stone + dark voids from validated regions."
              value={settings.displayState ?? 'presentation'}
              options={DISPLAY_STATES.filter(
                (d) => d.id !== 'section' || workspaceMode === 'tracery',
              ).map(({ id, label }) => ({ id, label }))}
              onChange={(displayState) =>
                patch({
                  displayState,
                  // Keep Essential toggle in sync with legacy Construction display.
                  showConstructionGeometry:
                    displayState === 'construction'
                      ? true
                      : displayState === 'presentation'
                        ? false
                        : settings.showConstructionGeometry === true,
                })
              }
            />
          ) : null}
          {constructionAnatomyModes ? (
            <Toggle
              label="Show Construction Geometry"
              tip="Reveal generator construction circles, centers, axes and guides (13E.4.3)."
              value={
                settings.showConstructionGeometry === true ||
                settings.displayState === 'construction'
              }
              onChange={(showConstructionGeometry) =>
                patch({
                  showConstructionGeometry,
                  // Prefer Essential toggle; leave Display as Presentation unless Section.
                  displayState:
                    settings.displayState === 'section'
                      ? 'section'
                      : showConstructionGeometry
                        ? settings.displayState === 'construction'
                          ? 'construction'
                          : 'presentation'
                        : settings.displayState === 'construction'
                          ? 'presentation'
                          : settings.displayState,
                })
              }
            />
          ) : null}
          {constructionAnatomyModes && showAdvanced ? (
            <>
              <p className="control-hint">Construction overlay (Advanced)</p>
              <Toggle
                label="Construction Circles"
                tip="Two-centered arch circles, oculus and foil construction circles."
                value={constructionOverlay.circles !== false}
                onChange={(circles) => patchConstructionOverlay('circles', circles)}
              />
              <Toggle
                label="Arc Centers"
                tip="Left / right arc centers and foil lobe centers."
                value={constructionOverlay.arcCenters !== false}
                onChange={(arcCenters) => patchConstructionOverlay('arcCenters', arcCenters)}
              />
              <Toggle
                label="Intersections"
                tip="Springing / apex / cusp intersection markers."
                value={constructionOverlay.intersections !== false}
                onChange={(intersections) =>
                  patchConstructionOverlay('intersections', intersections)
                }
              />
              <Toggle
                label="Symmetry Axes"
                tip="Vertical symmetry axis from the arch generator."
                value={constructionOverlay.symmetryAxes !== false}
                onChange={(symmetryAxes) =>
                  patchConstructionOverlay('symmetryAxes', symmetryAxes)
                }
              />
              <Toggle
                label="Dimension Guides"
                tip="Span / rise dimension ticks from construction data."
                value={constructionOverlay.dimensions !== false}
                onChange={(dimensions) => patchConstructionOverlay('dimensions', dimensions)}
              />
              {traceryMode ? (
                <>
                  <Toggle
                    label="Mullion Centerlines"
                    tip="Central mullion guide from tracery metadata."
                    value={constructionOverlay.mullionCenterlines !== false}
                    onChange={(mullionCenterlines) =>
                      patchConstructionOverlay('mullionCenterlines', mullionCenterlines)
                    }
                  />
                  <Toggle
                    label="Foil Construction"
                    tip="Foil lobe circles, enclosing guide and cusp markers."
                    value={constructionOverlay.foilConstruction !== false}
                    onChange={(foilConstruction) =>
                      patchConstructionOverlay('foilConstruction', foilConstruction)
                    }
                  />
                </>
              ) : null}
            </>
          ) : null}
          <Select
            label="Construct / Inspect"
            tip="Inspect and Tracery are available. Constraints arrive later."
            value={settings.constructionMode ?? 'construct'}
            options={enabledModes.map(({ id, label }) => ({ id, label }))}
            onChange={(constructionMode) => patch({ constructionMode })}
          />
          <Select
            label="Control density"
            tip="Essential · Advanced · Debug (13E.3.1). Hides specialized ratios without deleting parameters."
            value={controlTier}
            options={UI_CONTROL_TIERS.map(({ id, label }) => ({ id, label }))}
            onChange={(uiControlTier) => patch({ uiControlTier })}
          />
          <UpcomingList items={CONSTRUCTION_MODES.filter((m) => !m.enabled)} />
          <p className="control-hint">
            Working family: {WORKING_FAMILY} ({TRACERY_STATUS}). Refs: {PRIMARY_REFERENCES.join(', ')}.
          </p>
        </div>
      </details>

      {archMode ? (
        <details className="control-section" open>
          <summary>Pointed Arch Parameters</summary>
          <div className="section-controls">
            <ArchControls
              arch={settings.arch}
              workspaceMode={workspaceMode}
              onPatchArch={(arch) => patch({ arch })}
            />
            <p className="control-hint">
              Two-centered construction: c = (h² − a²)/(2a), R = (h² + a²)/(2a). Apex cusp is
              intentional.
            </p>
          </div>
        </details>
      ) : null}

      {showTraceryParams ? (
        <details className="control-section" open>
          <summary>Tracery Parameters</summary>
          <div className="section-controls">
            <TraceryControls
              tracery={settings.tracery}
              stone={settings.stone}
              controlTier={settings.uiControlTier ?? 'essential'}
              workspaceMode={workspaceMode}
              onPatch={(tracery) => patch({ tracery })}
              onApplyArchitecturePreset={(applied) =>
                patch({
                  tracery: applied.tracery,
                  stone: applied.stone,
                })
              }
            />
          </div>
        </details>
      ) : null}

      {stoneMode ? (
        <details className="control-section" open>
          <summary>Stone / 3D</summary>
          <div className="section-controls">
            <StoneControls
              stone={settings.stone}
              assembly={stoneAssembly}
              onPatch={(nextStone) => patch({ stone: nextStone })}
            />
          </div>
        </details>
      ) : null}

      {foliateMode ? (
        <details className="control-section" open>
          <summary>Foliate Ornament</summary>
          <div className="section-controls">
            <FoliateOrnamentControls
              foliate={settings.foliate}
              onPatch={(nextFoliate) => patch({ foliate: nextFoliate })}
              growthAttachment={growthAttachment}
              ornamentSkeleton={ornamentSkeleton}
              parametricMotif={parametricMotif}
              onDistributeGrowthSeeds={onDistributeGrowthSeeds}
              onClearGrowthSeeds={onClearGrowthSeeds}
              onDeleteSelectedGrowthAnchor={onDeleteSelectedGrowthAnchor}
              selectedGrowthAnchorId={selectedGrowthAnchorId}
              controlTier={settings.uiControlTier ?? 'essential'}
            />
            <Toggle
              label="Place Initiation Point"
              tip="Click eligible stone patches — shared with Architectural Assembly."
              value={settings.assembly?.growthPlaceSeedActive === true}
              onChange={(growthPlaceSeedActive) =>
                patch({
                  assembly: {
                    ...settings.assembly,
                    growthPlaceSeedActive,
                    growthPlacementMode: growthPlaceSeedActive
                      ? 'manual'
                      : settings.assembly?.growthPlacementMode,
                    showGrowthSeeds: true,
                    growthAllowRestricted: true,
                  },
                })
              }
            />
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="action-button"
                onClick={() =>
                  patch({
                    fitFrameMode: 'motif',
                    fitToken: (settings.fitToken ?? 0) + 1,
                    foliate: {
                      ...DEFAULT_FOLIATE_SETTINGS,
                      ...(settings.foliate ?? {}),
                      fitMotifToken: (settings.foliate?.fitMotifToken ?? 0) + 1,
                    },
                  })
                }
              >
                Fit to Motif
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() =>
                  patch({
                    fitFrameMode: 'facade',
                    fitToken: (settings.fitToken ?? 0) + 1,
                  })
                }
              >
                Fit to Facade
              </button>
            </div>
          </div>
        </details>
      ) : null}

      {assemblyMode ? (
        <details className="control-section" open>
          <summary>Assembly Layout</summary>
          <div className="section-controls">
            <AssemblyControls
              assembly={settings.assembly}
              facade={facadeAssembly}
              surfaceSemantics={surfaceSemantics}
              tracery={settings.tracery}
              onPatch={(nextAssembly) => patch({ assembly: nextAssembly })}
              onPatchTracery={(nextTracery) => patch({ tracery: nextTracery })}
              onEditWindowModule={() =>
                setWorkspace('stone-3d', { preserveCamera: true })
              }
              growthAttachment={growthAttachment}
              onDistributeGrowthSeeds={onDistributeGrowthSeeds}
              onClearGrowthSeeds={onClearGrowthSeeds}
              onDeleteSelectedGrowthAnchor={onDeleteSelectedGrowthAnchor}
              selectedGrowthAnchorId={selectedGrowthAnchorId}
              growthPathPreview={growthPathPreview}
              controlTier={settings.uiControlTier ?? 'essential'}
            />
            <button
              type="button"
              className="action-button"
              onClick={() => patch({ fitToken: (settings.fitToken ?? 0) + 1 })}
            >
              Fit to Assembly
            </button>
          </div>
        </details>
      ) : null}

      {workspaceMode === 'kernel-examples' ? (
        <details className="control-section" open>
          <summary>Kernel Examples</summary>
          <div className="section-controls">
            <Select
              label="Example"
              tip="Each example rebuilds from kernel functions when parameters change."
              value={settings.exampleId}
              options={EXAMPLE_IDS.map(({ id, label }) => ({ id, label }))}
              onChange={setExample}
            />
            <ParamSliders
              exampleId={settings.exampleId}
              params={params}
              onPatch={(exampleParams) => patch({ exampleParams })}
            />
          </div>
        </details>
      ) : null}

      <details className="control-section">
        <summary>Geometric Primitives</summary>
        <div className="section-controls">
          <UpcomingList items={PRIMITIVE_TOOLS} />
        </div>
      </details>

      <details className="control-section" open>
        <summary>Display Options</summary>
        <div className="section-controls">
          <Toggle
            label="Construction Grid"
            tip="XY work plane grid."
            value={settings.showGrid !== false}
            onChange={(showGrid) => patch({ showGrid })}
          />
          {displayModes ? (
            <>
              <p className="control-hint">
                Display state controls overlays. Presentation hides circles / axes / points by
                default. Construction reveals them without changing the geometry.
              </p>
              <Toggle
                label="Point labels"
                tip="Springing / apex / center / cusp labels in Construction display."
                value={settings.showLabels === true}
                onChange={(showLabels) => patch({ showLabels })}
              />
            </>
          ) : (
            <>
              <Toggle label="Show Points" tip="Control points." value={settings.showPoints !== false} onChange={(showPoints) => patch({ showPoints })} />
              <Toggle label="Show Construction" tip="Construction curves." value={settings.showConstruction !== false} onChange={(showConstruction) => patch({ showConstruction })} />
              <Toggle label="Show Centers" tip="Circle centers." value={settings.showCenters !== false} onChange={(showCenters) => patch({ showCenters })} />
              <Toggle label="Show Labels" tip="Point labels." value={settings.showLabels === true} onChange={(showLabels) => patch({ showLabels })} />
              <Toggle label="Show Dimensions" tip="Extent tick." value={settings.showDimensions === true} onChange={(showDimensions) => patch({ showDimensions })} />
              <Toggle label="Show Result" tip="Final curves." value={settings.showResult !== false} onChange={(showResult) => patch({ showResult })} />
            </>
          )}
        </div>
      </details>

      <details className="control-section" open>
        <summary>Geometry Information</summary>
        <div className="section-controls">
          <p className="control-hint">Kernel: {KERNEL_STATUS} · {KERNEL_VERSION}</p>
          <p className="control-hint">
            Construction: {construction?.id ?? '—'} · valid:{' '}
            {construction?.validation?.ok === false ? 'no' : 'yes'}
          </p>
          {construction?.validation?.errors?.length ? (
            <p className="control-hint grammar-invalid-text">
              {construction.validation.errors.join('; ')}
            </p>
          ) : null}
          {traceryMode || stoneMode ? <RegionInfo construction={construction} /> : null}
          {showDebug && construction?.metadata?.constructionGeometry ? (
            <>
              <p className="control-hint">
                Construction anatomy · circles:{' '}
                {construction.metadata.constructionGeometry.constructionCircles?.length ?? 0} ·
                points:{' '}
                {construction.metadata.constructionGeometry.constructionPoints?.length ?? 0} ·
                axes: {construction.metadata.constructionGeometry.symmetryAxes?.length ?? 0}
              </p>
              {construction.metadata.constructionGeometry.limitations?.length ? (
                <p className="control-hint">
                  Limitations:{' '}
                  {construction.metadata.constructionGeometry.limitations.join('; ')}
                </p>
              ) : null}
            </>
          ) : null}
          <p className="control-hint">
            Legacy Gothic Architecture tab remains untouched. This namespace does not import its
            generators.
          </p>
        </div>
      </details>
    </ControlPanel>
  )
}
