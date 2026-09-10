import type {
  CastingTime,
  Character,
  DamageType,
  MetamagicId,
  SlotLevel,
} from '@/domain/character/types'
import type { CastRequest, CastResources, RuleViolation, TurnState } from './types'

/** Sorcery point cost of each metamagic option. */
export const METAMAGIC_COST: Readonly<Record<MetamagicId, number>> = {
  quickened: 2,
  transmuted: 1,
  careful: 1,
  distant: 1,
  empowered: 1,
}

/** Sorcery points needed to create a spell slot with Font of Magic. */
export const SLOT_CREATION_COST: Readonly<Partial<Record<SlotLevel, number>>> = {
  1: 2,
  2: 3,
  3: 5,
  4: 6,
  5: 7,
}

/** Damage types Transmuted Spell can convert between. */
export const TRANSMUTABLE_DAMAGE_TYPES: readonly DamageType[] = [
  'acid',
  'cold',
  'fire',
  'lightning',
  'poison',
  'thunder',
]

export function isTransmutable(type: DamageType): boolean {
  return TRANSMUTABLE_DAMAGE_TYPES.includes(type)
}

/** Total sorcery point cost of the metamagic applied to a cast. */
export function metamagicCost(options: readonly MetamagicId[]): number {
  return options.reduce((total, option) => total + METAMAGIC_COST[option], 0)
}

/**
 * The casting time actually used once metamagic is applied. Quickened Spell
 * turns an action into a bonus action.
 */
export function effectiveCastingTime(request: CastRequest): CastingTime {
  return request.metamagic.includes('quickened') ? 'bonus-action' : request.spell.castingTime
}

/** Whether the cast draws on a spell slot, as opposed to a cantrip or free casting. */
export function consumesSlot(request: CastRequest): boolean {
  return request.slotLevel > 0 && !request.useFreeCast
}

/**
 * Validates a cast against the 2024 action economy and the character's
 * remaining resources.
 *
 * Rules enforced, in the order a player would hit them:
 *  - one spell slot per turn;
 *  - Quickened Spell cannot follow, or be followed by, a level 1+ spell;
 *  - one metamagic option per spell, and only options the character knows;
 *  - Transmuted Spell needs a convertible damage type;
 *  - action, bonus action and reaction are each used at most once per turn;
 *  - slots, sorcery points and free castings must actually be available.
 *
 * @returns every violation found, so the UI can explain all of them at once.
 *          An empty array means the cast is legal.
 */
export function validateCast(
  request: CastRequest,
  turn: TurnState,
  resources: CastResources,
  character: Character,
): RuleViolation[] {
  const violations: RuleViolation[] = []
  const { spell, metamagic } = request

  violations.push(...validateMetamagic(request, resources, character))

  if (consumesSlot(request)) {
    if (turn.slotSpentThisTurn) {
      violations.push({ code: 'ONE_SLOT_PER_TURN' })
    }
    if (turn.quickenedThisTurn) {
      violations.push({ code: 'QUICKENED_LOCKOUT' })
    }
    if (request.slotLevel < spell.level) {
      violations.push({
        code: 'SLOT_LEVEL_TOO_LOW',
        context: { required: spell.level, provided: request.slotLevel },
      })
    }
    const remaining = resources.slotsRemaining[request.slotLevel as SlotLevel] ?? 0
    if (remaining < 1) {
      violations.push({ code: 'NO_SLOTS_REMAINING', context: { level: request.slotLevel } })
    }
  }

  if (request.useFreeCast) {
    const remaining = resources.freeUsesRemaining[spell.id] ?? 0
    if (remaining < 1) {
      violations.push({ code: 'NO_FREE_USES_REMAINING', context: { spell: spell.name } })
    }
  }

  // Quickened Spell forbids casting a level 1+ spell earlier in the same turn.
  if (metamagic.includes('quickened') && turn.slotSpentThisTurn) {
    violations.push({ code: 'QUICKEN_AFTER_LEVELED_SPELL' })
  }

  violations.push(...validateActionEconomy(request, turn))

  return violations
}

function validateMetamagic(
  request: CastRequest,
  resources: CastResources,
  character: Character,
): RuleViolation[] {
  const violations: RuleViolation[] = []
  const { metamagic, spell } = request

  if (metamagic.length === 0) return violations

  if (metamagic.length > 1) {
    violations.push({ code: 'ONE_METAMAGIC_PER_SPELL' })
  }

  const known = character.spellcasting?.metamagic ?? []
  for (const option of metamagic) {
    if (!known.includes(option)) {
      violations.push({ code: 'METAMAGIC_NOT_KNOWN', context: { metamagic: option } })
    }
  }

  const cost = metamagicCost(metamagic)
  if (cost > resources.sorceryPoints) {
    violations.push({
      code: 'NOT_ENOUGH_SORCERY_POINTS',
      context: { required: cost, available: resources.sorceryPoints },
    })
  }

  if (metamagic.includes('quickened') && spell.castingTime !== 'action') {
    violations.push({ code: 'QUICKEN_REQUIRES_ACTION_SPELL' })
  }

  if (metamagic.includes('transmuted') && (!spell.damage || !isTransmutable(spell.damage.type))) {
    violations.push({
      code: 'DAMAGE_TYPE_NOT_TRANSMUTABLE',
      context: { type: spell.damage?.type ?? 'none' },
    })
  }

  return violations
}

function validateActionEconomy(request: CastRequest, turn: TurnState): RuleViolation[] {
  switch (effectiveCastingTime(request)) {
    case 'action':
      return turn.actionUsed ? [{ code: 'ACTION_ALREADY_USED' }] : []
    case 'bonus-action':
      return turn.bonusActionUsed ? [{ code: 'BONUS_ACTION_ALREADY_USED' }] : []
    case 'reaction':
      return turn.reactionUsed ? [{ code: 'REACTION_ALREADY_USED' }] : []
    // Rituals and minute-long castings happen outside the combat turn structure.
    case 'minute':
    case 'ritual':
      return []
  }
}

/**
 * Applies a legal cast to the turn state.
 *
 * Callers must validate first; this function assumes the cast is allowed.
 */
export function applyCastToTurn(request: CastRequest, turn: TurnState): TurnState {
  const next: TurnState = { ...turn }

  switch (effectiveCastingTime(request)) {
    case 'action':
      next.actionUsed = true
      break
    case 'bonus-action':
      next.bonusActionUsed = true
      break
    case 'reaction':
      next.reactionUsed = true
      break
    case 'minute':
    case 'ritual':
      break
  }

  if (consumesSlot(request)) {
    next.slotSpentThisTurn = true
  }

  if (request.metamagic.includes('quickened')) {
    next.quickenedThisTurn = true
  }

  return next
}
