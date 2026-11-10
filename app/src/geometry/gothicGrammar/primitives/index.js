/**
 * Construction primitives over the kernel.
 */

export const PRIMITIVES_STATUS = 'ready'

export {
  ARCH_FAMILIES,
  ARCH_FAMILY_META,
  ARCH_SEMANTICS,
  DEFAULT_ARCH_PARAMS,
  EQUILATERAL_RISE_RATIO,
  resolveRise,
} from './archFamilies.js'

export {
  buildPointedArch,
  buildArchFamily,
  upperMinorSweep,
} from './pointedArch.js'

export { validatePointedArch, archConstraintResiduals } from './archValidation.js'
