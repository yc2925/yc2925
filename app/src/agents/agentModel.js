/**
 * Step 11A — Agent data model.
 */

import * as THREE from 'three'
import { seededRandom } from '../gothic/primitives.js'

export const ROLE = {
  EXPLORER: 'explorer',
  BUILDER: 'builder',
  REGULATOR: 'regulator',
}

export const STATE = {
  DORMANT: 'dormant',
  EXPLORING: 'exploring',
  DEPOSITING: 'depositing',
  BUILDING: 'building',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
}

const ROLE_CYCLE = [ROLE.EXPLORER, ROLE.BUILDER, ROLE.REGULATOR]

/**
 * Assign roles with a slight explorer bias (more surface scouts).
 */
export function roleForIndex(index, rand) {
  const r = rand()
  if (r < 0.5) return ROLE.EXPLORER
  if (r < 0.82) return ROLE.BUILDER
  return ROLE.REGULATOR
}

/**
 * Create a single agent record. Position is world-space; graph location optional.
 */
export function createAgent({
  id,
  role,
  position,
  featureId = null,
  featureType = null,
  curveId = null,
  s = 0,
  travelSign = 1,
  sensingRadius = 0.28,
  energyBudget = 1.4,
  seed = 1,
  parentId = null,
  mirrorOf = null,
  activationDelay = 0,
}) {
  const pos =
    position instanceof THREE.Vector3
      ? position.clone()
      : new THREE.Vector3(position.x, position.y, position.z ?? 0)

  return {
    id,
    role: role ?? ROLE.EXPLORER,
    position: pos,
    velocity: new THREE.Vector3(0, 0, 0),
    featureId,
    featureType,
    state: STATE.DORMANT,
    sensingRadius,
    energy: energyBudget,
    energyMax: energyBudget,
    trail: [{ x: pos.x, y: pos.y, z: pos.z }],
    parentId,
    seed,
    // Graph locomotion
    curveId,
    s,
    travelSign,
    // FSM bookkeeping
    activationDelay,
    exploreSteps: 0,
    depositSteps: 0,
    buildSteps: 0,
    blockedTicks: 0,
    redirectAttempts: 0,
    lastDecision: null,
    // Symmetry
    mirrorOf,
    isMirror: mirrorOf != null,
    // Step 11C — construction archive (deposit/build samples only)
    constructionPath: [],
    constructionStartTime: null,
    constructionEndTime: null,
    fieldAccum: { attraction: 0, inhibition: 0, occupancy: 0, samples: 0 },
  }
}

/**
 * Snapshot for deterministic equality tests (no Vector3 refs).
 */
export function serializeAgent(a) {
  return {
    id: a.id,
    role: a.role,
    state: a.state,
    x: +a.position.x.toFixed(5),
    y: +a.position.y.toFixed(5),
    z: +a.position.z.toFixed(5),
    vx: +a.velocity.x.toFixed(5),
    vy: +a.velocity.y.toFixed(5),
    vz: +a.velocity.z.toFixed(5),
    featureId: a.featureId,
    curveId: a.curveId,
    s: +a.s.toFixed(5),
    travelSign: a.travelSign,
    energy: +a.energy.toFixed(5),
    seed: a.seed,
    mirrorOf: a.mirrorOf,
    exploreSteps: a.exploreSteps,
    depositSteps: a.depositSteps,
    blockedTicks: a.blockedTicks,
  }
}

/**
 * Deterministic per-agent RNG derived from global seed + agent seed.
 */
export function agentRng(globalSeed, agentSeed) {
  return seededRandom(globalSeed, (agentSeed | 0) * 9973 + 17)
}

export { ROLE_CYCLE }
