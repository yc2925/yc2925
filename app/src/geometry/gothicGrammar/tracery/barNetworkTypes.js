/**
 * Semantic bar-tracery network vocabulary (Step 13D.3).
 * Node / member classes for a connected stone graph — not a silhouette copy.
 */

export const NETWORK_NODE_TYPES = Object.freeze({
  ARCH_APEX: 'ARCH_APEX',
  SPRINGING_POINT: 'SPRINGING_POINT',
  MULLION_JUNCTION: 'MULLION_JUNCTION',
  TRACERY_JUNCTION: 'TRACERY_JUNCTION',
  OCULUS_JUNCTION: 'OCULUS_JUNCTION',
  BOUNDARY_CONNECTION: 'BOUNDARY_CONNECTION',
})

export const NETWORK_MEMBER_TYPES = Object.freeze({
  OUTER_FRAME: 'OUTER_FRAME',
  PRIMARY_MULLION: 'PRIMARY_MULLION',
  LANCET_ARCH: 'LANCET_ARCH',
  SECONDARY_TRACERY: 'SECONDARY_TRACERY',
  OCULUS_RING: 'OCULUS_RING',
  FOIL_BAR: 'FOIL_BAR',
})

/** Relative width ratios vs master OUTER_FRAME (exploratory, not historical). */
export const BAR_NETWORK_WIDTH_RATIOS = Object.freeze({
  OUTER_FRAME: 1.0,
  PRIMARY_MULLION: 0.6,
  LANCET_ARCH: 0.55,
  SECONDARY_TRACERY: 0.35,
  OCULUS_RING: 0.4,
  FOIL_BAR: 0.25,
})

export const NETWORK_MEMBER_COLORS = Object.freeze({
  OUTER_FRAME: '#c4b59a',
  PRIMARY_MULLION: '#a89070',
  LANCET_ARCH: '#9a8060',
  SECONDARY_TRACERY: '#7a6a55',
  OCULUS_RING: '#8a7558',
  FOIL_BAR: '#6a5a48',
})

export function createNetworkNode(partial) {
  return {
    id: partial.id,
    type: partial.type,
    position: { x: partial.position.x, y: partial.position.y },
    memberIds: [...(partial.memberIds ?? [])],
    parentConstructionId: partial.parentConstructionId ?? null,
    constraints: { ...(partial.constraints ?? {}) },
    metadata: { ...(partial.metadata ?? {}) },
  }
}

export function createNetworkMember(partial) {
  return {
    id: partial.id,
    type: partial.type,
    startNodeId: partial.startNodeId ?? null,
    endNodeId: partial.endNodeId ?? null,
    /** Exact path: arcs and/or segments (not only sampled polylines). */
    path: [...(partial.path ?? [])],
    closed: Boolean(partial.closed),
    memberClass: partial.memberClass ?? partial.type,
    width: partial.width,
    depth: partial.depth ?? null,
    profileType: partial.profileType ?? 'compound_gothic',
    parentId: partial.parentId ?? null,
    childIds: [...(partial.childIds ?? [])],
    constraints: { ...(partial.constraints ?? {}) },
    metadata: { ...(partial.metadata ?? {}) },
  }
}
