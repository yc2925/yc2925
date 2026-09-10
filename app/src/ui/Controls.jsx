import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function LabelWithTip({ children, tip }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  if (!tip) {
    return <span className="control-label">{children}</span>
  }

  function show() {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const width = 220
    const gap = 10
    let left = rect.left - width - gap
    if (left < 8) left = rect.right + gap
    setPos({ top: rect.top, left })
    setOpen(true)
  }

  return (
    <>
      <span
        ref={ref}
        className="control-label has-tip"
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        tabIndex={0}
      >
        {children}
      </span>
      {open
        ? createPortal(
            <div className="tooltip" style={{ top: pos.top, left: pos.left }} role="tooltip">
              {tip}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export function Slider({
  label,
  tip,
  value,
  min,
  max,
  step,
  display,
  className,
  disabled = false,
  onChange,
}) {
  const fill = ((value - min) / (max - min)) * 100

  return (
    <label className={`slider ${className ?? ''} ${disabled ? 'slider-disabled' : ''}`.trim()}>
      <span className="slider-meta">
        <LabelWithTip tip={tip}>{label}</LabelWithTip>
        <span className="slider-value">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--fill': `${fill}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function Select({ label, tip, value, options, onChange }) {
  return (
    <label className="select">
      <span className="slider-meta">
        <LabelWithTip tip={tip}>{label}</LabelWithTip>
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Toggle({ label, tip, value, onChange }) {
  return (
    <div className="toggle-row">
      <LabelWithTip tip={tip}>{label}</LabelWithTip>
      <button
        type="button"
        className={value ? 'is-on' : undefined}
        onClick={() => onChange(!value)}
      >
        {value ? 'On' : 'Off'}
      </button>
    </div>
  )
}

export function ControlPanel({ title, hint, children }) {
  return (
    <aside className="side-panel" aria-label="Controls">
      <h2>{title}</h2>
      <p className="side-panel-hint">{hint}</p>
      <div className="control-stack">{children}</div>
    </aside>
  )
}
