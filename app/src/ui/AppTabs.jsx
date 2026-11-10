import { useCallback, useEffect, useId, useRef, useState } from 'react'

/**
 * Single source of truth for top-level view tabs.
 * Order preserved for LAB menu generation.
 */
export const APP_TABS = [
  { id: 'particles', label: 'Particles' },
  { id: 'noise2d', label: 'Noise 2D' },
  { id: 'noise3d', label: 'Noise 3D' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'voxelLab', label: 'Voxel Lab' },
  { id: 'shaders', label: 'Shaders' },
  { id: 'growthLab', label: 'Growth Lab' },
  { id: 'lsystems', label: 'L-Systems' },
  { id: 'gothic', label: 'Gothic Architecture' },
  { id: 'gothicGrammar', label: 'Gothic Grammar' },
  { id: 'ornament', label: 'Ornament System' },
  { id: 'agents', label: 'Agent Simulation' },
]

export const PRIMARY_TAB_ID = 'gothicGrammar'

export const LAB_TABS = APP_TABS.filter((item) => item.id !== PRIMARY_TAB_ID)

const PRIMARY_TAB = APP_TABS.find((item) => item.id === PRIMARY_TAB_ID)

function isLabTab(tabId) {
  return LAB_TABS.some((item) => item.id === tabId)
}

function labLabelFor(tabId) {
  return LAB_TABS.find((item) => item.id === tabId)?.label ?? null
}

export default function AppTabs({ tab, onTabChange }) {
  const [labOpen, setLabOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(-1)
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const labButtonRef = useRef(null)
  const itemRefs = useRef([])
  const menuId = useId()

  const labActive = isLabTab(tab)
  const activeLabLabel = labLabelFor(tab)

  const closeLab = useCallback((restoreFocus = false) => {
    setLabOpen(false)
    setFocusIndex(-1)
    if (restoreFocus) {
      labButtonRef.current?.focus()
    }
  }, [])

  const openLab = useCallback(() => {
    setLabOpen(true)
    const activeIdx = LAB_TABS.findIndex((item) => item.id === tab)
    setFocusIndex(activeIdx >= 0 ? activeIdx : 0)
  }, [tab])

  const selectLabTab = useCallback(
    (id) => {
      onTabChange(id)
      closeLab(true)
    },
    [onTabChange, closeLab],
  )

  useEffect(() => {
    if (!labOpen) return undefined

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        closeLab()
      }
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeLab(true)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [labOpen, closeLab])

  useEffect(() => {
    if (!labOpen || focusIndex < 0) return
    itemRefs.current[focusIndex]?.focus()
  }, [labOpen, focusIndex])

  const onLabButtonKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!labOpen) openLab()
      else setFocusIndex(0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!labOpen) {
        openLab()
        setFocusIndex(LAB_TABS.length - 1)
      } else {
        setFocusIndex(LAB_TABS.length - 1)
      }
    }
  }

  const onMenuKeyDown = (event) => {
    if (!LAB_TABS.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusIndex((i) => (i + 1) % LAB_TABS.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusIndex((i) => (i - 1 + LAB_TABS.length) % LAB_TABS.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setFocusIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setFocusIndex(LAB_TABS.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (focusIndex >= 0) selectLabTab(LAB_TABS[focusIndex].id)
    } else if (event.key === 'Tab') {
      closeLab()
    }
  }

  return (
    <nav className="app-tabs" aria-label="Views" ref={rootRef}>
      <button
        type="button"
        className={tab === PRIMARY_TAB_ID ? 'is-active' : undefined}
        aria-current={tab === PRIMARY_TAB_ID ? 'page' : undefined}
        onClick={() => {
          closeLab()
          onTabChange(PRIMARY_TAB_ID)
        }}
      >
        {PRIMARY_TAB.label}
      </button>

      <div className={`app-tabs-lab${labActive ? ' is-lab-active' : ''}${labOpen ? ' is-open' : ''}`}>
        <button
          ref={labButtonRef}
          type="button"
          className={labActive ? 'is-active' : undefined}
          aria-haspopup="menu"
          aria-expanded={labOpen}
          aria-controls={menuId}
          aria-current={labActive ? 'true' : undefined}
          onClick={() => (labOpen ? closeLab() : openLab())}
          onKeyDown={onLabButtonKeyDown}
        >
          Lab
          <span className="app-tabs-lab-caret" aria-hidden="true">
            {labOpen ? '▲' : '▼'}
          </span>
        </button>

        {labOpen ? (
          <ul
            ref={menuRef}
            id={menuId}
            className="app-tabs-lab-menu"
            role="menu"
            aria-label="Lab experiments"
            onKeyDown={onMenuKeyDown}
          >
            {LAB_TABS.map((item, index) => (
              <li key={item.id} role="none">
                <button
                  ref={(el) => {
                    itemRefs.current[index] = el
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={focusIndex === index ? 0 : -1}
                  className={item.id === tab ? 'is-active' : undefined}
                  aria-current={item.id === tab ? 'page' : undefined}
                  onClick={() => selectLabTab(item.id)}
                  onMouseEnter={() => setFocusIndex(index)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {labActive && activeLabLabel ? (
        <span className="app-tabs-lab-current" aria-live="polite">
          {activeLabLabel}
        </span>
      ) : null}
    </nav>
  )
}
