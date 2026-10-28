/**
 * Steps 11A–11B.5 — Agent finite state machine.
 * Transitions depend on simulation conditions, not animation clocks.
 */

import { ROLE, STATE } from './agentModel.js'

/**
 * Evaluate the next state for an agent given its local context.
 *
 * @param {object} agent
 * @param {object} ctx
 */
export function transition(agent, ctx) {
  const s = agent.state

  if (s === STATE.COMPLETED) return STATE.COMPLETED

  if (s === STATE.DORMANT) {
    if (ctx.activated) return STATE.EXPLORING
    return STATE.DORMANT
  }

  if (s === STATE.EXPLORING) {
    if (ctx.budgetExhausted) return STATE.COMPLETED
    if (ctx.noValidPath) return STATE.BLOCKED
    // Meaningful scout phase before depositing (was 4/7/10 — too short → everyone BUILDING)
    const need = agent.role === ROLE.EXPLORER ? 18 : agent.role === ROLE.BUILDER ? 28 : 36
    if (ctx.hasValidDirection && agent.exploreSteps >= need) return STATE.DEPOSITING
    return STATE.EXPLORING
  }

  if (s === STATE.BLOCKED) {
    if (ctx.budgetExhausted) return STATE.COMPLETED
    if (ctx.redirectSucceeded) return STATE.EXPLORING
    if (agent.blockedTicks > 45 && ctx.stillBlocked) return STATE.COMPLETED
    return STATE.BLOCKED
  }

  if (s === STATE.DEPOSITING) {
    if (ctx.budgetExhausted) return STATE.COMPLETED
    if (ctx.noValidPath) return STATE.BLOCKED
    if (ctx.trailAccepted) return STATE.BUILDING
    return STATE.DEPOSITING
  }

  if (s === STATE.BUILDING) {
    if (ctx.budgetExhausted) return STATE.COMPLETED
    if (ctx.noValidPath) return STATE.BLOCKED
    // Finish after sustained build work (not merely sitting in BUILDING)
    if (ctx.buildComplete) return STATE.COMPLETED
    // Heavy local inhibition: pause building and re-scout (condition-based, not timer)
    if (ctx.reexplore) return STATE.EXPLORING
    return STATE.BUILDING
  }

  return s
}

/**
 * Energy drain rate per fixed step by state + role.
 */
export function energyCost(agent) {
  const roleMul =
    agent.role === ROLE.BUILDER ? 1.15 : agent.role === ROLE.REGULATOR ? 0.85 : 1
  switch (agent.state) {
    case STATE.EXPLORING:
      return 0.0035 * roleMul
    case STATE.DEPOSITING:
      return 0.0055 * roleMul
    case STATE.BUILDING:
      return 0.012 * roleMul
    case STATE.BLOCKED:
      return 0.002 * roleMul
    default:
      return 0
  }
}

/**
 * Minimum deposit trail length (world units) before BUILDING.
 */
export function depositAcceptLength(agent) {
  if (agent.role === ROLE.BUILDER) return 0.42
  if (agent.role === ROLE.REGULATOR) return 0.55
  return 0.32
}

/**
 * Deposit steps required before trail is accepted into BUILDING.
 */
export function depositAcceptSteps(agent) {
  if (agent.role === ROLE.BUILDER) return 10
  if (agent.role === ROLE.REGULATOR) return 14
  return 8
}

/**
 * Build-work quota (steps while BUILDING) before COMPLETED.
 * Scales lightly with energy budget so longer lives still finish.
 */
export function buildCompleteQuota(agent) {
  const base = agent.role === ROLE.BUILDER ? 55 : agent.role === ROLE.REGULATOR ? 40 : 45
  const energyScale = Math.max(0.7, Math.min(1.4, (agent.energyMax ?? 2.2) / 2.2))
  return Math.round(base * energyScale)
}
