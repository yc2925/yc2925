/**
 * Compatibility entry — prefer generateArchitecture() from grammar.js.
 * Kept so earlier Phase 1 imports of createGothicBay keep working.
 */
export { createGothicBay, countFeatures, generateArchitecture } from './grammar.js'
export { pointedArchOutline, pointedArchHalf } from './primitives.js'
