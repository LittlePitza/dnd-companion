import { describe, expect, it } from 'vitest'
import { sorynVort } from '@/data/characters/sorynVort'
import type { Spell } from '@/domain/character/types'
import { applyCastToTurn, effectiveCastingTime, metamagicCost, validateCast } from './actionEconomy'
import type { CastRequest, CastResources, RuleViolationCode, TurnState } from './types'
import { INITIAL_TURN_STATE } from './types'

function spellNamed(id: string): Spell {
  const spell = sorynVort.spells.find((candidate) => candidate.id === id)
  if (!spell) throw new Error(`Missing fixture spell: ${id}`)
  return spell
}

const fullResources: CastResources = {
  slotsRemaining: { 1: 4, 2: 3, 3: 2 },
  sorceryPoints: 5,
  freeUsesRemaining: { 'detect-magic': 1 },
}

function cast(overrides: Partial<CastRequest> & { spell: Spell }): CastRequest {
  return { slotLevel: overrides.spell.level, metamagic: [], ...overrides }
}

function codes(
  request: CastRequest,
  turn: Partial<TurnState> = {},
  resources: CastResources = fullResources,
): RuleViolationCode[] {
  return validateCast(request, { ...INITIAL_TURN_STATE, ...turn }, resources, sorynVort).map(
    (violation) => violation.code,
  )
}

describe('one spell slot per turn (2024)', () => {
  it('allows the first levelled spell of the turn', () => {
    expect(codes(cast({ spell: spellNamed('fireball') }))).toEqual([])
  })

  it('blocks a second levelled spell in the same turn', () => {
    expect(codes(cast({ spell: spellNamed('fireball') }), { slotSpentThisTurn: true })).toContain(
      'ONE_SLOT_PER_TURN',
    )
  })

  it('still allows cantrips after a slot has been spent', () => {
    const request = cast({ spell: spellNamed('fire-bolt') })
    expect(codes(request, { slotSpentThisTurn: true })).toEqual([])
  })

  it('blocks Misty Step followed by Scorching Ray, the classic illegal turn', () => {
    const afterMistyStep = applyCastToTurn(
      cast({ spell: spellNamed('misty-step') }),
      INITIAL_TURN_STATE,
    )

    expect(codes(cast({ spell: spellNamed('scorching-ray') }), afterMistyStep)).toContain(
      'ONE_SLOT_PER_TURN',
    )
  })

  it('allows Misty Step followed by a cantrip', () => {
    const afterMistyStep = applyCastToTurn(
      cast({ spell: spellNamed('misty-step') }),
      INITIAL_TURN_STATE,
    )

    expect(codes(cast({ spell: spellNamed('fire-bolt') }), afterMistyStep)).toEqual([])
  })
})

describe('Quickened Spell', () => {
  it('turns an action spell into a bonus action', () => {
    const request = cast({ spell: spellNamed('fireball'), metamagic: ['quickened'] })
    expect(effectiveCastingTime(request)).toBe('bonus-action')
  })

  it('costs two sorcery points', () => {
    expect(metamagicCost(['quickened'])).toBe(2)
    expect(metamagicCost(['transmuted'])).toBe(1)
  })

  it('cannot follow a levelled spell cast earlier in the turn', () => {
    const request = cast({ spell: spellNamed('fireball'), metamagic: ['quickened'] })
    expect(codes(request, { slotSpentThisTurn: true })).toContain('QUICKEN_AFTER_LEVELED_SPELL')
  })

  it('locks out levelled spells cast afterwards', () => {
    const quickened = cast({ spell: spellNamed('fireball'), metamagic: ['quickened'] })
    const afterQuicken = applyCastToTurn(quickened, INITIAL_TURN_STATE)

    expect(afterQuicken.quickenedThisTurn).toBe(true)
    expect(codes(cast({ spell: spellNamed('magic-missile') }), afterQuicken)).toContain(
      'QUICKENED_LOCKOUT',
    )
  })

  it('still permits a cantrip after a quickened spell — the legal nova turn', () => {
    const quickened = cast({ spell: spellNamed('fireball'), metamagic: ['quickened'] })
    const afterQuicken = applyCastToTurn(quickened, INITIAL_TURN_STATE)

    expect(codes(cast({ spell: spellNamed('fire-bolt') }), afterQuicken)).toEqual([])
  })

  it('rejects quickening a spell that is not cast with an action', () => {
    const request = cast({ spell: spellNamed('misty-step'), metamagic: ['quickened'] })
    expect(codes(request)).toContain('QUICKEN_REQUIRES_ACTION_SPELL')
  })

  it('needs two sorcery points on hand', () => {
    const request = cast({ spell: spellNamed('fireball'), metamagic: ['quickened'] })
    expect(codes(request, {}, { ...fullResources, sorceryPoints: 1 })).toContain(
      'NOT_ENOUGH_SORCERY_POINTS',
    )
  })
})

describe('Transmuted Spell', () => {
  it('accepts a fire spell', () => {
    const request = cast({
      spell: spellNamed('fireball'),
      metamagic: ['transmuted'],
      transmutedDamageType: 'cold',
    })
    expect(codes(request)).toEqual([])
  })

  it('rejects force damage, which Magic Missile deals', () => {
    const request = cast({ spell: spellNamed('magic-missile'), metamagic: ['transmuted'] })
    expect(codes(request)).toContain('DAMAGE_TYPE_NOT_TRANSMUTABLE')
  })

  it('rejects a spell with no damage at all', () => {
    const request = cast({ spell: spellNamed('misty-step'), metamagic: ['transmuted'] })
    expect(codes(request)).toContain('DAMAGE_TYPE_NOT_TRANSMUTABLE')
  })
})

describe('metamagic limits', () => {
  it('allows only one option per spell', () => {
    const request = cast({
      spell: spellNamed('fireball'),
      metamagic: ['quickened', 'transmuted'],
      transmutedDamageType: 'cold',
    })
    expect(codes(request)).toContain('ONE_METAMAGIC_PER_SPELL')
  })

  it('rejects options the character has not learned', () => {
    const request = cast({ spell: spellNamed('fireball'), metamagic: ['careful'] })
    expect(codes(request)).toContain('METAMAGIC_NOT_KNOWN')
  })
})

describe('action economy', () => {
  it('blocks a second action spell', () => {
    expect(codes(cast({ spell: spellNamed('fire-bolt') }), { actionUsed: true })).toContain(
      'ACTION_ALREADY_USED',
    )
  })

  it('blocks a second bonus action spell', () => {
    expect(codes(cast({ spell: spellNamed('misty-step') }), { bonusActionUsed: true })).toContain(
      'BONUS_ACTION_ALREADY_USED',
    )
  })

  it('blocks a second reaction', () => {
    expect(codes(cast({ spell: spellNamed('shield') }), { reactionUsed: true })).toContain(
      'REACTION_ALREADY_USED',
    )
  })

  it('lets Shield be cast as a reaction on a turn where the action was already spent', () => {
    expect(codes(cast({ spell: spellNamed('shield') }), { actionUsed: true })).toEqual([])
  })
})

describe('resource availability', () => {
  it('refuses a slot level the character has run out of', () => {
    const request = cast({ spell: spellNamed('fireball') })
    expect(
      codes(request, {}, { ...fullResources, slotsRemaining: { 1: 4, 2: 3, 3: 0 } }),
    ).toContain('NO_SLOTS_REMAINING')
  })

  it('refuses a slot below the spell level', () => {
    const request = cast({ spell: spellNamed('fireball'), slotLevel: 2 })
    expect(codes(request)).toContain('SLOT_LEVEL_TOO_LOW')
  })

  it('allows upcasting into a higher slot', () => {
    const request = cast({ spell: spellNamed('magic-missile'), slotLevel: 3 })
    expect(codes(request)).toEqual([])
  })

  it('tracks feat-granted free castings', () => {
    const request = cast({ spell: spellNamed('detect-magic'), slotLevel: 0, useFreeCast: true })
    expect(codes(request)).toEqual([])
    expect(
      codes(request, {}, { ...fullResources, freeUsesRemaining: { 'detect-magic': 0 } }),
    ).toContain('NO_FREE_USES_REMAINING')
  })

  it('does not count a free casting against the one-slot-per-turn rule', () => {
    const request = cast({ spell: spellNamed('detect-magic'), slotLevel: 0, useFreeCast: true })
    expect(codes(request, { slotSpentThisTurn: true })).toEqual([])
  })
})
