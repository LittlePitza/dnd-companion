import type { Character } from '@/domain/character/types'
import { abilityModifierOf } from '@/domain/character/derived'
import { rollDice } from '@/domain/dice/dice'
import type { RandomSource } from '@/domain/dice/rng'
import type { PlaySessionState } from './types'
import { DEATH_SAVE_LIMIT, INITIAL_DEATH_SAVES } from './types'
import { clamp } from './session'

/**
 * Applies damage. Temporary hit points absorb it first, and any excess carries
 * over to real hit points.
 */
export function applyDamage(session: PlaySessionState, amount: number): PlaySessionState {
  if (amount <= 0) return session

  const absorbed = Math.min(session.temporaryHitPoints, amount)
  const remainder = amount - absorbed

  return {
    ...session,
    temporaryHitPoints: session.temporaryHitPoints - absorbed,
    currentHitPoints: Math.max(0, session.currentHitPoints - remainder),
  }
}

/**
 * Applies healing, capped at the character's maximum. Healing a character off
 * 0 hit points also wipes their death saves.
 */
export function applyHealing(
  session: PlaySessionState,
  character: Character,
  amount: number,
): PlaySessionState {
  if (amount <= 0) return session

  const healed = clamp(session.currentHitPoints + amount, 0, character.maxHitPoints)
  const revived = session.currentHitPoints === 0 && healed > 0

  return {
    ...session,
    currentHitPoints: healed,
    deathSaves: revived ? { ...INITIAL_DEATH_SAVES } : session.deathSaves,
  }
}

/** Temporary hit points never stack: the larger pool replaces the smaller one. */
export function applyTemporaryHitPoints(
  session: PlaySessionState,
  amount: number,
): PlaySessionState {
  return {
    ...session,
    temporaryHitPoints: Math.max(session.temporaryHitPoints, Math.max(0, amount)),
  }
}

export type DeathSaveOutcome = 'success' | 'failure' | 'critical-success' | 'critical-failure'

/**
 * Records a death saving throw.
 *
 * A natural 20 restores the character to 1 hit point; a natural 1 counts as
 * two failures.
 */
export function recordDeathSave(
  session: PlaySessionState,
  outcome: DeathSaveOutcome,
): PlaySessionState {
  if (outcome === 'critical-success') {
    return { ...session, currentHitPoints: 1, deathSaves: { ...INITIAL_DEATH_SAVES } }
  }

  const { successes, failures } = session.deathSaves
  const next =
    outcome === 'success'
      ? { successes: successes + 1, failures }
      : { successes, failures: failures + (outcome === 'critical-failure' ? 2 : 1) }

  return {
    ...session,
    deathSaves: {
      successes: Math.min(DEATH_SAVE_LIMIT, next.successes),
      failures: Math.min(DEATH_SAVE_LIMIT, next.failures),
    },
  }
}

export function resetDeathSaves(session: PlaySessionState): PlaySessionState {
  return { ...session, deathSaves: { ...INITIAL_DEATH_SAVES } }
}

export type VitalStatus = 'healthy' | 'bloodied' | 'critical' | 'down' | 'stable' | 'dead'

/**
 * Summarises the character's condition for the vitals display.
 *
 * "Bloodied" is the customary half-hit-points mark; "critical" flags the last
 * quarter, where one hit is likely to drop the character.
 */
export function vitalStatus(session: PlaySessionState, character: Character): VitalStatus {
  if (session.deathSaves.failures >= DEATH_SAVE_LIMIT) return 'dead'
  if (session.currentHitPoints === 0) {
    return session.deathSaves.successes >= DEATH_SAVE_LIMIT ? 'stable' : 'down'
  }

  const ratio = session.currentHitPoints / character.maxHitPoints
  if (ratio <= 0.25) return 'critical'
  if (ratio <= 0.5) return 'bloodied'
  return 'healthy'
}

export interface HitDiceSpendResult {
  session: PlaySessionState
  rolled: number
  healed: number
}

/**
 * Spends one Hit Die during a short rest, healing `die roll + Constitution
 * modifier` (minimum 0).
 *
 * @returns `null` when no Hit Dice remain.
 */
export function spendHitDie(
  session: PlaySessionState,
  character: Character,
  random: RandomSource,
): HitDiceSpendResult | null {
  if (session.hitDiceRemaining < 1) return null

  const roll = rollDice(`1d${character.hitDice.sides}`, random)
  const healing = Math.max(0, roll.total + abilityModifierOf(character, 'constitution'))
  const before = session.currentHitPoints

  const healedSession = applyHealing(
    { ...session, hitDiceRemaining: session.hitDiceRemaining - 1 },
    character,
    healing,
  )

  return {
    session: healedSession,
    rolled: roll.total,
    healed: healedSession.currentHitPoints - before,
  }
}
