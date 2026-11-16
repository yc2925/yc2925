/**
 * World Outliner + context parameter panel (Step 47, slice scope).
 * Panel follows the existing Essential / Advanced tier pattern.
 */

import { useState } from 'react'
import { SKELETON_PARAM_SPECS } from '../skeleton/params.js'
import { LITHIC_PARAM_SPECS } from '../lithic/params.js'

const STATUS_LABEL = {
  empty: 'needs ≥2 pts',
  queued: 'queued',
  generating: 'generating…',
  preview: 'preview',
  final: 'final',
  stale: 'stale',
  error: 'error',
}

export function Outliner({ structures, statusOf, ui, setUi, dispatch }) {
  return (
    <div className="world-outliner">
      <div className="world-outliner-head">World outliner</div>
      <ul>
        <li className="world-outliner-row is-root">World · {structures.length} curve{structures.length === 1 ? '' : 's'}</li>
        {structures.map((s) => {
          const selected = s.curveId === ui.selectedCurveId
          const status = statusOf(s)
          const skelOk = s.skeleton.members.length > 0
          return (
            <li key={s.structureId} className={selected ? 'is-selected' : undefined}>
              <div className="world-outliner-row">
                <button type="button" className="world-outliner-name" onClick={() => setUi((u) => ({ ...u, selectedCurveId: s.curveId, selectedPoint: null }))}>
                  {s.curve.name}
                </button>
                <button
                  type="button"
                  className="world-icon-btn"
                  title={s.curve.visibility ? 'Hide' : 'Show'}
                  onClick={() => dispatch({ type: 'setCurveField', curveId: s.curveId, field: 'visibility', value: !s.curve.visibility })}
                >
                  {s.curve.visibility ? 'VIS' : 'HID'}
                </button>
                <button
                  type="button"
                  className="world-icon-btn"
                  title={s.curve.locked ? 'Unlock' : 'Lock'}
                  onClick={() =>
                    // Unlock must bypass the locked guard: toggle via a dedicated field write.
                    dispatch({ type: 'setCurveField', curveId: s.curveId, field: 'locked', value: !s.curve.locked })
                  }
                >
                  {s.curve.locked ? 'LCK' : 'EDT'}
                </button>
                <button
                  type="button"
                  className="world-icon-btn"
                  title="Delete curve and its structure"
                  onClick={() => {
                    dispatch({ type: 'deleteCurve', curveId: s.curveId })
                    setUi((u) => (u.selectedCurveId === s.curveId ? { ...u, selectedCurveId: null, selectedPoint: null, drawingCurveId: null } : u))
                  }}
                >
                  DEL
                </button>
              </div>
              <div className="world-outliner-child">
                <span>Gothic skeleton</span>
                <span className={skelOk ? 'is-ok' : 'is-warn'}>{skelOk ? `${s.skeleton.stats.bayCount} bays` : 'empty'}</span>
              </div>
              <div className="world-outliner-child">
                <span>Lithic formation</span>
                <span className={`is-${status}`}>{STATUS_LABEL[status]}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ParamRows({ specs, values, overrides, tier, onChange }) {
  return specs
    .filter((spec) => tier === 'advanced' || spec.tier === 'essential')
    .map((spec) => {
      const value = values[spec.key]
      const overridden = overrides && Object.prototype.hasOwnProperty.call(overrides, spec.key)
      return (
        <label key={spec.key} className={`world-param${overridden ? ' is-override' : ''}`}>
          <span className="world-param-label">
            {spec.label}
            <span className="world-param-value">
              {Number(value).toFixed(spec.step >= 1 ? 0 : 2)}
              {spec.unit ? ` ${spec.unit}` : ''}
            </span>
          </span>
          <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value} onChange={(e) => onChange(spec.key, Number(e.target.value))} />
        </label>
      )
    })
}

export function ParamPanel({ stage, project, structure, lithicState, statusOf, dispatch, refine, regenerate, onFit }) {
  const [tier, setTier] = useState('essential')
  const curve = structure?.curve
  const showSkeleton = stage === 'curves' || stage === 'skeleton'
  const group = showSkeleton ? 'skeleton' : 'lithic'
  const specs = showSkeleton ? SKELETON_PARAM_SPECS : LITHIC_PARAM_SPECS
  const values = curve ? structure.params[group] : project.world[group]
  const overrides = curve ? (group === 'skeleton' ? curve.architecturalParameters : curve.lithicParameters) : null

  const onChange = (key, value) => {
    if (curve) dispatch({ type: 'setCurveParam', curveId: curve.curveId, group, key, value }, { coalesce: `p-${curve.curveId}-${group}-${key}` })
    else dispatch({ type: 'setWorldParam', group, key, value }, { coalesce: `w-${group}-${key}` })
  }

  const stats = structure?.skeleton?.stats
  const lstats = lithicState?.stats
  return (
    <aside className="world-panel">
      <div className="world-panel-head">
        <span>{showSkeleton ? 'Gothic skeleton' : 'Lithic formation'}</span>
        <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Control tier">
          <option value="essential">Essential</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>
      <p className="world-panel-scope">
        {curve ? (
          <>
            Editing <strong>{curve.name}</strong> (per-structure override)
          </>
        ) : (
          'No curve selected — editing world defaults'
        )}
      </p>
      {curve ? (
        <label className="world-param">
          <span className="world-param-label">Name</span>
          <input
            type="text"
            value={curve.name}
            onChange={(e) => dispatch({ type: 'setCurveField', curveId: curve.curveId, field: 'name', value: e.target.value }, { coalesce: `name-${curve.curveId}` })}
          />
        </label>
      ) : null}
      {curve ? (
        <label className="world-param">
          <span className="world-param-label">Curve type</span>
          <select value={curve.curveType} onChange={(e) => dispatch({ type: 'setCurveField', curveId: curve.curveId, field: 'curveType', value: e.target.value })}>
            <option value="catmullRom">Smooth spline</option>
            <option value="polyline">Polyline</option>
          </select>
        </label>
      ) : null}
      <ParamRows specs={specs} values={values} overrides={overrides} tier={tier} onChange={onChange} />
      {curve ? (
        <label className="world-param">
          <span className="world-param-label">
            Random seed<span className="world-param-value">{curve.randomSeed}</span>
          </span>
          <input type="range" min={0} max={9999} step={1} value={curve.randomSeed} onChange={(e) => dispatch({ type: 'setCurveField', curveId: curve.curveId, field: 'randomSeed', value: Number(e.target.value) }, { coalesce: `seed-${curve.curveId}` })} />
        </label>
      ) : null}

      {structure ? (
        <div className="world-panel-actions">
          <button type="button" onClick={() => onFit(structure)}>
            Fit to structure
          </button>
          {!showSkeleton ? (
            <>
              <button type="button" onClick={() => regenerate(structure.structureId)}>
                Regenerate
              </button>
              <button type="button" onClick={() => refine(structure.structureId)}>
                Refine (final)
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {structure ? (
        <dl className="world-stats">
          <dt>Skeleton</dt>
          <dd>
            {stats?.bayCount ?? 0} bays · {stats?.members ?? 0} members · {(structure.skeleton.buildMs ?? 0).toFixed(1)} ms
          </dd>
          {stats?.length ? (
            <>
              <dt>Curve</dt>
              <dd>
                {stats.length.toFixed(1)} m · springing {stats.springing.toFixed(1)} m · apex {stats.vaultApex.toFixed(1)} m
              </dd>
            </>
          ) : null}
          <dt>Lithic</dt>
          <dd>
            {STATUS_LABEL[statusOf(structure)]}
            {lstats ? ` · ${Math.round(lstats.triangles / 1000)}k tris · ${Math.round(lstats.ms)} ms · cell ${lstats.cellSize.toFixed(2)} m` : ''}
          </dd>
          {lithicState?.error ? (
            <>
              <dt>Error</dt>
              <dd>{lithicState.error}</dd>
            </>
          ) : null}
          {structure.skeleton.warnings.length ? (
            <>
              <dt>Note</dt>
              <dd>{structure.skeleton.warnings.join(' ')}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </aside>
  )
}
