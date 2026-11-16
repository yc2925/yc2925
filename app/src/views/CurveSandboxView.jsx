import { useCallback, useRef, useState } from 'react'

/**
 * Curve Sandbox — a standalone test bench for parametric curves.
 * Cubic Bézier with draggable control points and a de Casteljau
 * construction overlay at parameter t. Independent of other systems.
 */

const VIEW_W = 1000
const VIEW_H = 700

const INITIAL_POINTS = [
  { x: 220, y: 520 },
  { x: 340, y: 180 },
  { x: 660, y: 180 },
  { x: 780, y: 520 },
]

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** Returns every de Casteljau level: [controls, level1, level2, [point]]. */
function deCasteljauLevels(points, t) {
  const levels = [points]
  let current = points
  while (current.length > 1) {
    const next = []
    for (let i = 0; i < current.length - 1; i += 1) next.push(lerp(current[i], current[i + 1], t))
    levels.push(next)
    current = next
  }
  return levels
}

function sampleCurve(points, segments) {
  const out = []
  for (let i = 0; i <= segments; i += 1) {
    const levels = deCasteljauLevels(points, i / segments)
    out.push(levels[levels.length - 1][0])
  }
  return out
}

const toPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

export default function CurveSandboxView() {
  const svgRef = useRef(null)
  const [points, setPoints] = useState(INITIAL_POINTS)
  const [t, setT] = useState(0.5)
  const [segments, setSegments] = useState(64)
  const [showConstruction, setShowConstruction] = useState(true)
  const [dragIndex, setDragIndex] = useState(-1)

  const toSvgPoint = useCallback((event) => {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = event.clientX
    pt.y = event.clientY
    const local = pt.matrixTransform(svg.getScreenCTM().inverse())
    return {
      x: Math.min(VIEW_W, Math.max(0, local.x)),
      y: Math.min(VIEW_H, Math.max(0, local.y)),
    }
  }, [])

  const onPointerMove = (event) => {
    if (dragIndex < 0) return
    const p = toSvgPoint(event)
    setPoints((prev) => prev.map((q, i) => (i === dragIndex ? p : q)))
  }

  const levels = deCasteljauLevels(points, t)
  const curve = sampleCurve(points, segments)
  const onCurve = levels[levels.length - 1][0]
  const levelColors = ['var(--line-strong)', '#6c8cff', '#5fd0a0']

  return (
    <div className="curve-sandbox">
      <svg
        ref={svgRef}
        className="curve-sandbox-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragIndex(-1)}
        onPointerLeave={() => setDragIndex(-1)}
      >
        {showConstruction
          ? levels.slice(0, -1).map((level, li) => (
              <g key={li}>
                <path d={toPath(level)} fill="none" stroke={levelColors[li]} strokeWidth="1" strokeDasharray={li ? '4 4' : 'none'} />
                {li > 0 ? level.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={levelColors[li]} />) : null}
              </g>
            ))
          : null}

        <path d={toPath(curve)} fill="none" stroke="var(--text)" strokeWidth="2.5" />

        <circle cx={onCurve.x} cy={onCurve.y} r="6" fill="var(--signal)" />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="9"
              className={`curve-sandbox-handle${dragIndex === i ? ' is-dragging' : ''}`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId)
                setDragIndex(i)
              }}
            />
            <text x={p.x + 14} y={p.y - 12} className="curve-sandbox-label">
              P{i}
            </text>
          </g>
        ))}
      </svg>

      <aside className="curve-sandbox-panel">
        <h2>Curve Sandbox</h2>
        <p>Cubic Bézier · de Casteljau construction. Drag P0–P3.</p>

        <label>
          <span>t = {t.toFixed(2)}</span>
          <input type="range" min="0" max="1" step="0.01" value={t} onChange={(e) => setT(Number(e.target.value))} />
        </label>

        <label>
          <span>Segments = {segments}</span>
          <input type="range" min="2" max="128" step="1" value={segments} onChange={(e) => setSegments(Number(e.target.value))} />
        </label>

        <label className="curve-sandbox-check">
          <input type="checkbox" checked={showConstruction} onChange={(e) => setShowConstruction(e.target.checked)} />
          <span>Show construction</span>
        </label>

        <button type="button" onClick={() => setPoints(INITIAL_POINTS)}>
          Reset points
        </button>

        <dl>
          <dt>B(t)</dt>
          <dd>
            {onCurve.x.toFixed(1)}, {onCurve.y.toFixed(1)}
          </dd>
        </dl>
      </aside>
    </div>
  )
}
