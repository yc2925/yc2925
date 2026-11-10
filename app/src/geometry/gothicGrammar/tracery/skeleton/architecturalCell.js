/**
 * Semantic architectural cell for recursive Rayonnant subdivision (Step 13D.9).
 *
 * Cells operate on actual pointed-arch field geometry — not arbitrary bboxes.
 */

import { nextId } from '../../kernel/result.js'

export const CELL_KINDS = Object.freeze({
  PARENT_ARCH: 'PARENT_ARCH',
  PRIMARY_LANCET: 'PRIMARY_LANCET',
  SECONDARY_ARCH: 'SECONDARY_ARCH',
  TERTIARY_ARCH: 'TERTIARY_ARCH',
  FOIL_HEAD: 'FOIL_HEAD',
  TERMINAL: 'TERMINAL',
})

export const SUBDIVISION_RULES = Object.freeze({
  POINTED_ARCH_SUBDIVISION: 'RULE_A_POINTED_ARCH_SUBDIVISION',
  TREFOIL_HEAD: 'RULE_B_TREFOIL_HEAD',
  QUATREFOIL_HEAD: 'RULE_C_QUATREFOIL_HEAD',
  TERMINAL: 'RULE_D_TERMINAL',
})

/**
 * @param {object} partial
 * @returns {object} architectural cell
 */
export function createArchitecturalCell(partial = {}) {
  const id = partial.id ?? nextId('cell')
  return {
    id,
    kind: partial.kind ?? CELL_KINDS.TERMINAL,
    parentId: partial.parentId ?? null,
    hierarchyLevel: partial.hierarchyLevel ?? 0,
    /** Pointed arch construction (buildPointedArch result) when applicable. */
    fieldArch: partial.fieldArch ?? null,
    boundaryCurves: partial.boundaryCurves ?? null,
    localOrigin: partial.localOrigin ?? null,
    width: partial.width ?? null,
    height: partial.height ?? null,
    allowedRules: [...(partial.allowedRules ?? [])],
    childIds: [...(partial.childIds ?? [])],
    memberIds: [...(partial.memberIds ?? [])],
    memberClass: partial.memberClass ?? null,
    constraintStatus: partial.constraintStatus ?? 'pending',
    constraintReason: partial.constraintReason ?? null,
    appliedRule: partial.appliedRule ?? null,
    metadata: { ...(partial.metadata ?? {}) },
  }
}

export function markCellAccepted(cell, rule, extras = {}) {
  return {
    ...cell,
    constraintStatus: 'accepted',
    constraintReason: null,
    appliedRule: rule,
    ...extras,
  }
}

export function markCellRejected(cell, reason, rule = SUBDIVISION_RULES.TERMINAL) {
  return {
    ...cell,
    constraintStatus: 'rejected',
    constraintReason: reason,
    appliedRule: rule,
    kind: CELL_KINDS.TERMINAL,
  }
}

export function markCellTerminal(cell, reason = 'insufficient clearance') {
  return markCellRejected(cell, reason, SUBDIVISION_RULES.TERMINAL)
}
