import type {
  DamageType,
  MetamagicId,
  SlotLevel,
  Spell,
  SpellLevel,
} from '@/domain/character/types'

/**
 * Everything the 2024 action economy needs to remember between the start and
 * the end of a single turn.
 */
export interface TurnState {
  actionUsed: boolean
  bonusActionUsed: boolean
  reactionUsed: boolean
  /** A spell slot was already spent this turn — the 2024 one-slot-per-turn rule. */
  slotSpentThisTurn: boolean
  /** A spell was quickened this turn, which locks out further level 1+ casting. */
  quickenedThisTurn: boolean
  /** The once-per-turn Wild Magic Surge check has already been made. */
  surgeCheckedThisTurn: boolean
}

export const INITIAL_TURN_STATE: TurnState = {
  actionUsed: false,
  bonusActionUsed: false,
  reactionUsed: false,
  slotSpentThisTurn: false,
  quickenedThisTurn: false,
  surgeCheckedThisTurn: false,
}

/** A request to cast a spell, before any rule has been checked. */
export interface CastRequest {
  spell: Spell
  /** Slot level consumed. `0` means a cantrip or a slot-free casting. */
  slotLevel: SpellLevel
  metamagic: readonly MetamagicId[]
  /** Spend a feat-granted free casting instead of a spell slot. */
  useFreeCast?: boolean
  /** The damage type chosen when Transmuted Spell is applied. */
  transmutedDamageType?: DamageType
}

/** The pool of resources a cast may draw from. */
export interface CastResources {
  slotsRemaining: Readonly<Partial<Record<SlotLevel, number>>>
  sorceryPoints: number
  /** Remaining feat-granted free castings, keyed by spell id. */
  freeUsesRemaining: Readonly<Record<string, number>>
}

export type RuleViolationCode =
  | 'ONE_SLOT_PER_TURN'
  | 'QUICKENED_LOCKOUT'
  | 'QUICKEN_AFTER_LEVELED_SPELL'
  | 'QUICKEN_REQUIRES_ACTION_SPELL'
  | 'ACTION_ALREADY_USED'
  | 'BONUS_ACTION_ALREADY_USED'
  | 'REACTION_ALREADY_USED'
  | 'NO_SLOTS_REMAINING'
  | 'SLOT_LEVEL_TOO_LOW'
  | 'NOT_ENOUGH_SORCERY_POINTS'
  | 'ONE_METAMAGIC_PER_SPELL'
  | 'METAMAGIC_NOT_KNOWN'
  | 'DAMAGE_TYPE_NOT_TRANSMUTABLE'
  | 'NO_FREE_USES_REMAINING'

/**
 * A broken rule. The domain reports a stable `code`; the presentation layer
 * turns it into table-language prose, which keeps rules logic free of copy.
 */
export interface RuleViolation {
  code: RuleViolationCode
  /** Values the message template may interpolate. */
  context?: Record<string, string | number>
}
