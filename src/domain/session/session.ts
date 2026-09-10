import type { Character, SlotLevel } from '@/domain/character/types'
import { INITIAL_TURN_STATE } from '@/domain/turn/types'
import { INITIAL_WILD_MAGIC_STATE } from '@/domain/wildmagic/surge'
import type { PlaySessionState, SlotPool } from './types'
import { INITIAL_DEATH_SAVES } from './types'

/** Builds a fully rested session for a character. */
export function createSession(character: Character): PlaySessionState {
  return {
    characterId: character.id,
    currentHitPoints: character.maxHitPoints,
    temporaryHitPoints: 0,
    hitDiceRemaining: character.hitDice.count,
    deathSaves: { ...INITIAL_DEATH_SAVES },
    slotsRemaining: maxSlots(character),
    conjuredSlots: {},
    resourcesRemaining: maxResources(character),
    freeUsesRemaining: maxFreeUses(character),
    activeEffectIds: [],
    turn: { ...INITIAL_TURN_STATE },
    wildMagic: { ...INITIAL_WILD_MAGIC_STATE },
  }
}

export function maxSlots(character: Character): SlotPool {
  return { ...(character.spellcasting?.slots ?? {}) }
}

export function maxResources(character: Character): Record<string, number> {
  return Object.fromEntries(character.resources.map((resource) => [resource.id, resource.max]))
}

export function maxFreeUses(character: Character): Record<string, number> {
  return Object.fromEntries(
    character.spells
      .filter((spell) => spell.freeUses !== undefined)
      .map((spell) => [spell.id, spell.freeUses?.max ?? 0]),
  )
}

/** Total slots available at a level, counting those conjured with Font of Magic. */
export function slotsAvailableAt(session: PlaySessionState, level: SlotLevel): number {
  return (session.slotsRemaining[level] ?? 0) + (session.conjuredSlots[level] ?? 0)
}

/** Combined pool of standard and conjured slots, for rule validation. */
export function combinedSlotPool(session: PlaySessionState): SlotPool {
  const levels = new Set<SlotLevel>([
    ...(Object.keys(session.slotsRemaining).map(Number) as SlotLevel[]),
    ...(Object.keys(session.conjuredSlots).map(Number) as SlotLevel[]),
  ])

  const pool: SlotPool = {}
  for (const level of levels) {
    pool[level] = slotsAvailableAt(session, level)
  }
  return pool
}

/**
 * Spends one slot at `level`, drawing on conjured slots first so the
 * shorter-lived resource is used before the one that survives to a long rest.
 *
 * @returns the updated session, or `null` when no slot is available.
 */
export function spendSlot(session: PlaySessionState, level: SlotLevel): PlaySessionState | null {
  if ((session.conjuredSlots[level] ?? 0) > 0) {
    return {
      ...session,
      conjuredSlots: { ...session.conjuredSlots, [level]: (session.conjuredSlots[level] ?? 0) - 1 },
    }
  }

  if ((session.slotsRemaining[level] ?? 0) > 0) {
    return {
      ...session,
      slotsRemaining: {
        ...session.slotsRemaining,
        [level]: (session.slotsRemaining[level] ?? 0) - 1,
      },
    }
  }

  return null
}

/** Returns one slot at `level` to the standard pool, never exceeding the maximum. */
export function restoreSlot(
  session: PlaySessionState,
  character: Character,
  level: SlotLevel,
): PlaySessionState {
  const max = character.spellcasting?.slots[level] ?? 0
  const current = session.slotsRemaining[level] ?? 0
  return {
    ...session,
    slotsRemaining: { ...session.slotsRemaining, [level]: Math.min(max, current + 1) },
  }
}

export function resourceRemaining(session: PlaySessionState, resourceId: string): number {
  return session.resourcesRemaining[resourceId] ?? 0
}

export function resourceMax(character: Character, resourceId: string): number {
  return character.resources.find((resource) => resource.id === resourceId)?.max ?? 0
}

/**
 * Adjusts a resource by `delta`, clamped to `[0, max]`.
 */
export function adjustResource(
  session: PlaySessionState,
  character: Character,
  resourceId: string,
  delta: number,
): PlaySessionState {
  const max = resourceMax(character, resourceId)
  const next = clamp(resourceRemaining(session, resourceId) + delta, 0, max)

  return {
    ...session,
    resourcesRemaining: { ...session.resourcesRemaining, [resourceId]: next },
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
