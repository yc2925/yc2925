/**
 * Semantic construction graph for Gothic tracery (Step 13C).
 * Stores exact primitives and relationships — not only sampled vertices.
 */

import { nextId } from '../kernel/result.js'

/**
 * @param {object} partial
 * @returns {object} graph element
 */
export function createTraceryElement(partial = {}) {
  const id = partial.id ?? nextId('tr')
  return {
    id,
    type: partial.type ?? 'element',
    role: partial.role ?? null,
    parentId: partial.parentId ?? null,
    childIds: [...(partial.childIds ?? [])],
    geometry: {
      points: { ...(partial.geometry?.points ?? {}) },
      circles: [...(partial.geometry?.circles ?? [])],
      arcs: [...(partial.geometry?.arcs ?? [])],
      segments: [...(partial.geometry?.segments ?? [])],
      samples: [...(partial.geometry?.samples ?? [])],
      ...(partial.geometry ?? {}),
    },
    parameters: { ...(partial.parameters ?? {}) },
    derived: { ...(partial.derived ?? {}) },
    constraints: [...(partial.constraints ?? [])],
    validation: {
      ok: true,
      errors: [],
      warnings: [],
      ...(partial.validation ?? {}),
    },
    semantic: partial.semantic ?? partial.role ?? null,
    metadata: { ...(partial.metadata ?? {}) },
  }
}

export function createTraceryGraph(partial = {}) {
  return {
    id: partial.id ?? nextId('graph'),
    type: 'traceryGraph',
    rootId: partial.rootId ?? null,
    elements: { ...(partial.elements ?? {}) },
    parameters: { ...(partial.parameters ?? {}) },
    derived: { ...(partial.derived ?? {}) },
    constraints: [...(partial.constraints ?? [])],
    validation: {
      ok: true,
      errors: [],
      warnings: [],
      ...(partial.validation ?? {}),
    },
    metadata: {
      kernelVersion: '13A.1',
      units: 'meters',
      references: ['REF-011', 'REF-006', 'REF-008', 'REF-007', 'REF-009'],
      ...(partial.metadata ?? {}),
    },
  }
}

export function addElement(graph, element) {
  const next = {
    ...graph,
    elements: { ...graph.elements, [element.id]: element },
  }
  if (element.parentId && next.elements[element.parentId]) {
    const parent = next.elements[element.parentId]
    if (!parent.childIds.includes(element.id)) {
      next.elements[element.parentId] = {
        ...parent,
        childIds: [...parent.childIds, element.id],
      }
    }
  }
  return next
}

export function linkChild(graph, parentId, childId) {
  const parent = graph.elements[parentId]
  const child = graph.elements[childId]
  if (!parent || !child) return graph
  const childIds = parent.childIds.includes(childId)
    ? parent.childIds
    : [...parent.childIds, childId]
  return {
    ...graph,
    elements: {
      ...graph.elements,
      [parentId]: { ...parent, childIds },
      [childId]: { ...child, parentId },
    },
  }
}

export function markGraphInvalid(graph, error) {
  return {
    ...graph,
    validation: {
      ...graph.validation,
      ok: false,
      errors: [...(graph.validation.errors ?? []), error],
    },
  }
}

export function collectGraphErrors(graph) {
  const errors = [...(graph.validation?.errors ?? [])]
  for (const el of Object.values(graph.elements ?? {})) {
    if (el.validation?.ok === false) {
      errors.push(...(el.validation.errors ?? [`${el.id} invalid`]))
    }
  }
  return errors
}

export function finalizeGraph(graph) {
  const errors = collectGraphErrors(graph)
  if (!errors.length) return { ...graph, validation: { ...graph.validation, ok: true, errors: [] } }
  return {
    ...graph,
    validation: { ...graph.validation, ok: false, errors },
  }
}
