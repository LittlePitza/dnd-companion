import type { Character, ShortRestBenefit } from '@/domain/character/types'
import { INITIAL_TURN_STATE } from '@/domain/turn/types'
import { INITIAL_WILD_MAGIC_STATE } from '@/domain/wildmagic/surge'
import type { PlaySessionState } from './types'
import { INITIAL_DEATH_SAVES } from './types'
import { adjustResource, maxFreeUses, maxResources, maxSlots, resourceRemaining } from './session'

/**
 * A short rest refreshes resources that recharge on a short rest and clears the
 * turn tracker. Hit Dice are spent separately, one at a time, by the player.
 */
export function applyShortRest(session: PlaySessionState, character: Character): PlaySessionState {
  const resourcesRemaining = { ...session.resourcesRemaining }

  for (const resource of character.resources) {
    if (resource.recharge === 'short-rest') {
      resourcesRemaining[resource.id] = resource.max
    }
  }

  return {
    ...session,
    resourcesRemaining,
    turn: { ...INITIAL_TURN_STATE },
  }
}

/** Whether the character can still claim a short-rest benefit such as Sorcerous Restoration. */
export function canClaimShortRestBenefit(
  session: PlaySessionState,
  benefit: ShortRestBenefit,
): boolean {
  return resourceRemaining(session, benefit.costResourceId) > 0
}

/**
 * Claims a short-rest benefit: spends its limited use and refunds the granted
 * resource, capped at that resource's maximum.
 *
 * @returns the updated session, or `null` when the benefit is unavailable.
 */
export function claimShortRestBenefit(
  session: PlaySessionState,
  character: Character,
  benefit: ShortRestBenefit,
): PlaySessionState | null {
  if (!canClaimShortRestBenefit(session, benefit)) return null

  const spent = adjustResource(session, character, benefit.costResourceId, -1)
  return adjustResource(spent, character, benefit.grantsResourceId, benefit.amount)
}

/**
 * A long rest resets the character completely: full hit points, refreshed
 * slots and resources, half the total Hit Dice back, and no lingering effects.
 * Slots conjured with Font of Magic disappear rather than carrying over.
 */
export function applyLongRest(session: PlaySessionState, character: Character): PlaySessionState {
  return {
    ...session,
    currentHitPoints: character.maxHitPoints,
    temporaryHitPoints: 0,
    hitDiceRemaining: recoveredHitDice(session, character),
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

/**
 * A long rest returns half the character's total Hit Dice, rounded down, to a
 * minimum of one.
 */
function recoveredHitDice(session: PlaySessionState, character: Character): number {
  const recovered = Math.max(1, Math.floor(character.hitDice.count / 2))
  return Math.min(character.hitDice.count, session.hitDiceRemaining + recovered)
}
