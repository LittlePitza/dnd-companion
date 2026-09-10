import type { SlotLevel } from '@/domain/character/types'
import type { TurnState } from '@/domain/turn/types'
import type { WildMagicState } from '@/domain/wildmagic/surge'

/** Remaining spell slots, keyed by level. */
export type SlotPool = Partial<Record<SlotLevel, number>>

export interface DeathSaveState {
  successes: number
  failures: number
}

/**
 * Everything that changes during play and resets on a rest. The character
 * definition stays immutable; this is the mutable layer on top of it.
 */
export interface PlaySessionState {
  characterId: string
  currentHitPoints: number
  temporaryHitPoints: number
  hitDiceRemaining: number
  deathSaves: DeathSaveState
  slotsRemaining: SlotPool
  /**
   * Slots conjured with Font of Magic. Tracked separately because they vanish
   * at the end of a long rest instead of being refilled.
   */
  conjuredSlots: SlotPool
  /** Remaining uses of each generic resource, keyed by resource id. */
  resourcesRemaining: Record<string, number>
  /** Remaining feat-granted free castings, keyed by spell id. */
  freeUsesRemaining: Record<string, number>
  activeEffectIds: string[]
  turn: TurnState
  wildMagic: WildMagicState
}

export const DEATH_SAVE_LIMIT = 3

export const INITIAL_DEATH_SAVES: DeathSaveState = { successes: 0, failures: 0 }
