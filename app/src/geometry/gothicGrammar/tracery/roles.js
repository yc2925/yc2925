/**
 * Semantic roles for Rayonnant tracery construction graphs (Step 13C).
 * Computational design vocabulary — not a historical taxonomy claim.
 */

export const TRACERY_ROLES = Object.freeze({
  PARENT_ARCH: 'PARENT_ARCH',
  PRIMARY_MULLION: 'PRIMARY_MULLION',
  CHILD_LANCET: 'CHILD_LANCET',
  TREFOIL: 'TREFOIL',
  QUATREFOIL: 'QUATREFOIL',
  UPPER_OCULUS: 'UPPER_OCULUS',
  OPENING_BOUNDARY: 'OPENING_BOUNDARY',
})

export const TRACERY_ELEMENT_TYPES = Object.freeze({
  pointedArch: 'pointedArch',
  mullion: 'mullion',
  foil: 'foil',
  oculus: 'oculus',
  opening: 'opening',
  composition: 'composition',
  subdivision: 'subdivision',
})

export const FOIL_TYPES = Object.freeze({
  trefoil: 'trefoil',
  quatrefoil: 'quatrefoil',
  none: 'none',
  circle: 'circle',
})

export const TRACERY_EXAMPLES = Object.freeze([
  {
    id: 'lancet-subdivision',
    label: 'A. Lancet Subdivision',
    tip: 'Parent pointed arch subdivided into two child lancets with a central mullion.',
  },
  {
    id: 'trefoil',
    label: 'B. Trefoil',
    tip: 'Threefold cusped foil from intersecting construction circles.',
  },
  {
    id: 'quatrefoil',
    label: 'C. Quatrefoil',
    tip: 'Fourfold cusped foil; orthogonal or rotated orientation.',
  },
  {
    id: 'oculus-placement',
    label: 'D. Oculus Placement',
    tip: 'Circular oculus solved inside a parent arch with clearance checks.',
  },
  {
    id: 'composed-window',
    label: 'E. Composed Window',
    tip: 'Two lancets + upper quatrefoil hierarchical composition.',
  },
])
