/**
 * Undo / redo over the project document (Phase A1).
 *
 * Commands with the same `coalesce` key in a row (e.g. one point drag)
 * collapse into a single undo step.
 */

import { applyCommand } from './project.js'

const MAX_HISTORY = 200

export function createHistory(present) {
  return { past: [], present, future: [], lastCoalesce: null }
}

export function dispatch(history, cmd, { coalesce = null } = {}) {
  const next = applyCommand(history.present, cmd)
  if (next === history.present) return history
  if (coalesce && coalesce === history.lastCoalesce) {
    return { ...history, present: next, future: [] }
  }
  const past = [...history.past, history.present].slice(-MAX_HISTORY)
  return { past, present: next, future: [], lastCoalesce: coalesce }
}

/** Ends a coalescing run so the next command starts a new undo step. */
export function seal(history) {
  return history.lastCoalesce ? { ...history, lastCoalesce: null } : history
}

export function undo(history) {
  if (!history.past.length) return history
  const previous = history.past[history.past.length - 1]
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastCoalesce: null,
  }
}

export function redo(history) {
  if (!history.future.length) return history
  const [next, ...rest] = history.future
  return { past: [...history.past, history.present], present: next, future: rest, lastCoalesce: null }
}

export function replacePresent(history, present) {
  return createHistory(present)
}
