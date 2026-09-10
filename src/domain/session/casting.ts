import type {
  Character,
  DamageProfile,
  DamageType,
  SlotLevel,
  Spell,
  SpellLevel,
} from '@/domain/character/types'
import { scaleDamage } from '@/domain/character/derived'
import { rollDice } from '@/domain/dice/dice'
import type { RandomSource } from '@/domain/dice/rng'
import {
  applyCastToTurn,
  consumesSlot,
  metamagicCost,
  validateCast,
} from '@/domain/turn/actionEconomy'
import type { CastRequest, RuleViolation } from '@/domain/turn/types'
import type { SurgeCheckResult } from '@/domain/wildmagic/surge'
import { canCheckSurge, checkWildMagicSurge } from '@/domain/wildmagic/surge'
import type { PlaySessionState } from './types'
import { adjustResource, combinedSlotPool, spendSlot } from './session'
import { SLOT_CREATION_COST } from '@/domain/turn/actionEconomy'

/** The resource id every sorcery-point rule reads from. */
export const SORCERY_POINT_RESOURCE_ID = 'sorcery-points'

export interface DamageInstanceRoll {
  rolls: number[]
  total: number
}

export interface DamageRollResult {
  notation: string
  type: DamageType
  instances: DamageInstanceRoll[]
  total: number
}

export interface CastOutcome {
  session: PlaySessionState
  spell: Spell
  slotLevel: SpellLevel
  damage: DamageRollResult | null
  surge: SurgeCheckResult | null
  sorceryPointsSpent: number
  usedFreeCast: boolean
}

export type CastResult =
  { ok: true; outcome: CastOutcome } | { ok: false; violations: RuleViolation[] }

/**
 * Validates and resolves a cast: spends the slot, sorcery points and free uses,
 * advances the turn tracker, rolls damage and runs the Wild Magic Surge check.
 *
 * Nothing is mutated — the caller receives a new session on success.
 */
export function resolveCast(
  request: CastRequest,
  session: PlaySessionState,
  character: Character,
  random: RandomSource,
): CastResult {
  const violations = validateCast(
    request,
    session.turn,
    {
      slotsRemaining: combinedSlotPool(session),
      sorceryPoints: session.resourcesRemaining[SORCERY_POINT_RESOURCE_ID] ?? 0,
      freeUsesRemaining: session.freeUsesRemaining,
    },
    character,
  )

  if (violations.length > 0) {
    return { ok: false, violations }
  }

  let next = session

  if (consumesSlot(request)) {
    const afterSlot = spendSlot(next, request.slotLevel as SlotLevel)
    // Validation already proved a slot exists; this guard keeps the types honest.
    if (!afterSlot) return { ok: false, violations: [{ code: 'NO_SLOTS_REMAINING' }] }
    next = afterSlot
  }

  if (request.useFreeCast) {
    next = {
      ...next,
      freeUsesRemaining: {
        ...next.freeUsesRemaining,
        [request.spell.id]: Math.max(0, (next.freeUsesRemaining[request.spell.id] ?? 0) - 1),
      },
    }
  }

  const pointsSpent = metamagicCost(request.metamagic)
  if (pointsSpent > 0) {
    next = adjustResource(next, character, SORCERY_POINT_RESOURCE_ID, -pointsSpent)
  }

  next = { ...next, turn: applyCastToTurn(request, next.turn) }

  const damage = rollSpellDamage(request, random)

  let surge: SurgeCheckResult | null = null
  if (canCheckSurge(request, session.turn)) {
    const check = checkWildMagicSurge(next.wildMagic, random)
    surge = check.result
    next = {
      ...next,
      wildMagic: check.nextState,
      turn: { ...next.turn, surgeCheckedThisTurn: true },
    }
  }

  return {
    ok: true,
    outcome: {
      session: next,
      spell: request.spell,
      slotLevel: request.slotLevel,
      damage,
      surge,
      sorceryPointsSpent: pointsSpent,
      usedFreeCast: request.useFreeCast ?? false,
    },
  }
}

/**
 * Rolls a spell's damage, scaled for the slot used and retyped when Transmuted
 * Spell is applied.
 *
 * @returns `null` for spells that deal no damage.
 */
export function rollSpellDamage(
  request: CastRequest,
  random: RandomSource,
): DamageRollResult | null {
  const { spell } = request
  if (!spell.damage) return null

  const scaled = scaleDamage(spell.damage, spell.level, request.slotLevel)
  return rollDamageProfile(scaled, random, resolveDamageType(request, scaled))
}

/**
 * Rolls every instance of a damage profile.
 *
 * @param typeOverride replaces the profile's own type, for Transmuted Spell.
 * @param flatBonus    added to each instance, for a weapon's ability modifier.
 */
export function rollDamageProfile(
  damage: DamageProfile,
  random: RandomSource,
  typeOverride?: DamageType,
  flatBonus = 0,
): DamageRollResult {
  const notation =
    flatBonus === 0
      ? damage.dice
      : `${damage.dice}${flatBonus > 0 ? '+' : '-'}${Math.abs(flatBonus)}`

  const instances = Array.from({ length: damage.instances }, () => {
    const roll = rollDice(notation, random)
    // Damage never heals a target, so a negative modifier floors the instance at zero.
    return { rolls: roll.rolls, total: Math.max(0, roll.total) }
  })

  return {
    notation: damage.instances > 1 ? `${damage.instances} x ${notation}` : notation,
    type: typeOverride ?? damage.type,
    instances,
    total: instances.reduce((sum, instance) => sum + instance.total, 0),
  }
}

function resolveDamageType(request: CastRequest, damage: DamageProfile): DamageType {
  if (request.metamagic.includes('transmuted') && request.transmutedDamageType) {
    return request.transmutedDamageType
  }
  return damage.type
}

/**
 * Font of Magic: converts a spell slot into sorcery points equal to the slot's
 * level. Requires no action.
 *
 * @returns the updated session, or `null` when the slot is unavailable.
 */
export function convertSlotToSorceryPoints(
  session: PlaySessionState,
  character: Character,
  level: SlotLevel,
): PlaySessionState | null {
  const afterSpend = spendSlot(session, level)
  if (!afterSpend) return null

  return adjustResource(afterSpend, character, SORCERY_POINT_RESOURCE_ID, level)
}

/**
 * Font of Magic: creates a spell slot with sorcery points, as a bonus action.
 * The slot is conjured, so it disappears at the end of the next long rest.
 *
 * @returns the updated session, or `null` when the points or the bonus action
 *          are unavailable.
 */
export function createSlotFromSorceryPoints(
  session: PlaySessionState,
  character: Character,
  level: SlotLevel,
): PlaySessionState | null {
  const cost = SLOT_CREATION_COST[level]
  if (cost === undefined) return null
  if (session.turn.bonusActionUsed) return null
  if ((session.resourcesRemaining[SORCERY_POINT_RESOURCE_ID] ?? 0) < cost) return null

  const afterSpend = adjustResource(session, character, SORCERY_POINT_RESOURCE_ID, -cost)

  return {
    ...afterSpend,
    conjuredSlots: {
      ...afterSpend.conjuredSlots,
      [level]: (afterSpend.conjuredSlots[level] ?? 0) + 1,
    },
    turn: { ...afterSpend.turn, bonusActionUsed: true },
  }
}
