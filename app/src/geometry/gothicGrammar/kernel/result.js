/**
 * Standardized construction result for future Gothic grammar modules.
 */

let _idCounter = 0

export function resetIdCounter(n = 0) {
  _idCounter = n
}

export function nextId(prefix = 'g') {
  _idCounter += 1
  return `${prefix}-${_idCounter}`
}

/**
 * @returns {{
 *   id: string,
 *   type: string,
 *   parameters: object,
 *   primitives: object[],
 *   derivedPoints: object[],
 *   constraints: object[],
 *   validation: object,
 *   curves: object[],
 *   metadata: object
 * }}
 */
export function createConstructionResult(partial = {}) {
  return {
    id: partial.id ?? nextId('construction'),
    type: partial.type ?? 'construction',
    parameters: { ...(partial.parameters ?? {}) },
    primitives: [...(partial.primitives ?? [])],
    derivedPoints: [...(partial.derivedPoints ?? [])],
    constraints: [...(partial.constraints ?? [])],
    validation: {
      ok: true,
      warnings: [],
      errors: [],
      ...(partial.validation ?? {}),
    },
    curves: [...(partial.curves ?? [])],
    metadata: {
      kernelVersion: '13A.1',
      units: 'meters',
      ...(partial.metadata ?? {}),
    },
  }
}

export function markInvalid(result, error) {
  return {
    ...result,
    validation: {
      ...result.validation,
      ok: false,
      errors: [...(result.validation.errors ?? []), error],
    },
  }
}

export function addWarning(result, warning) {
  return {
    ...result,
    validation: {
      ...result.validation,
      warnings: [...(result.validation.warnings ?? []), warning],
    },
  }
}
