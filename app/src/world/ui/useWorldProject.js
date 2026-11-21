/**
 * Project document + undo/redo + local autosave (Step 47).
 * Autosave is a per-browser convenience (localStorage); the document holds
 * only source data, so the world is rebuilt deterministically on load.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createEmptyProject, deserializeProject, serializeProject } from '../model/project.js'
import { createHistory, dispatch as dispatchHistory, redo, seal, undo } from '../model/history.js'

export const AUTOSAVE_KEY = 'yc2925.world.v1'

function loadInitial(storageKey, initial) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw) return deserializeProject(raw)
  } catch {
    /* storage blocked or corrupt → start from the initial project */
  }
  return initial()
}

/**
 * One project store. The main world uses AUTOSAVE_KEY; the Sample tab uses its
 * own key and starts from the procedural sample, so editing one never touches the other.
 */
export function useWorldProject({ storageKey = AUTOSAVE_KEY, initial = createEmptyProject } = {}) {
  const [history, setHistory] = useState(() => createHistory(loadInitial(storageKey, initial)))

  const dispatch = useCallback((cmd, opts) => setHistory((h) => dispatchHistory(h, cmd, opts)), [])
  const endGesture = useCallback(() => setHistory((h) => seal(h)), [])
  const doUndo = useCallback(() => setHistory((h) => undo(h)), [])
  const doRedo = useCallback(() => setHistory((h) => redo(h)), [])
  const reset = useCallback(() => setHistory(createHistory(initial())), [initial])

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, serializeProject(history.present))
      } catch {
        /* ignore quota / privacy errors */
      }
    }, 400)
    return () => window.clearTimeout(id)
  }, [history.present, storageKey])

  return useMemo(
    () => ({
      project: history.present,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      dispatch,
      endGesture,
      undo: doUndo,
      redo: doRedo,
      reset,
    }),
    [history, dispatch, endGesture, doUndo, doRedo, reset],
  )
}
