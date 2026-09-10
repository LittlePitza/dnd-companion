import type { Spell } from '@/domain/character/types'
import { rollD20, rollPercentile } from '@/domain/dice/dice'
import type { RandomSource } from '@/domain/dice/rng'
import type { CastRequest, TurnState } from '@/domain/turn/types'
import { consumesSlot } from '@/domain/turn/actionEconomy'

/** The face on the surge d20 that sets off a surge without Tides of Chaos. */
export const SURGE_TRIGGER_FACE = 20

export interface WildMagicState {
  /** Tides of Chaos is charged and can be spent for advantage. */
  tidesOfChaosAvailable: boolean
  /**
   * Tides of Chaos has been spent. The next sorcerer spell cast with a slot
   * surges automatically and recharges the feature.
   */
  surgePending: boolean
}

export const INITIAL_WILD_MAGIC_STATE: WildMagicState = {
  tidesOfChaosAvailable: true,
  surgePending: false,
}

export interface SurgeCheckResult {
  /** The surge was guaranteed by a spent Tides of Chaos. */
  automatic: boolean
  /** The d20 rolled, or `null` when the surge was automatic. */
  d20: number | null
  triggered: boolean
  /** The d100 result to look up on the Wild Magic Surge table. */
  tableRoll: number | null
  /** Tides of Chaos came back as a result of this check. */
  tidesRecharged: boolean
}

/**
 * A surge check happens once per turn, immediately after casting a spell from
 * the sorcerer's own list using a spell slot. Cantrips and feat-granted spells
 * never qualify.
 */
export function canCheckSurge(request: CastRequest, turn: TurnState): boolean {
  return request.spell.origin === 'class' && consumesSlot(request) && !turn.surgeCheckedThisTurn
}

/** Spends Tides of Chaos for advantage, arming the automatic surge. */
export function spendTidesOfChaos(state: WildMagicState): WildMagicState {
  if (!state.tidesOfChaosAvailable) return state
  return { tidesOfChaosAvailable: false, surgePending: true }
}

/**
 * Resolves the Wild Magic Surge check.
 *
 * With a surge pending from a spent Tides of Chaos the surge is automatic and
 * Tides recharges; otherwise a natural 20 on a d20 sets it off.
 */
export function checkWildMagicSurge(
  state: WildMagicState,
  random: RandomSource,
): { result: SurgeCheckResult; nextState: WildMagicState } {
  if (state.surgePending) {
    return {
      result: {
        automatic: true,
        d20: null,
        triggered: true,
        tableRoll: rollPercentile(random),
        tidesRecharged: true,
      },
      nextState: { tidesOfChaosAvailable: true, surgePending: false },
    }
  }

  const roll = rollD20(0, 'normal', random)
  const triggered = roll.natural === SURGE_TRIGGER_FACE

  return {
    result: {
      automatic: false,
      d20: roll.natural,
      triggered,
      tableRoll: triggered ? rollPercentile(random) : null,
      tidesRecharged: false,
    },
    nextState: state,
  }
}

/** Whether a spell benefits from sorcerer class features such as Innate Sorcery. */
export function benefitsFromClassFeatures(spell: Spell): boolean {
  return spell.origin === 'class'
}
