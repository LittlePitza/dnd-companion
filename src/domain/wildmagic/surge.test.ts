import { describe, expect, it } from 'vitest'
import { sorynVort } from '@/data/characters/sorynVort'
import type { Spell } from '@/domain/character/types'
import { createSequenceRandomSource } from '@/domain/dice/rng'
import type { CastRequest } from '@/domain/turn/types'
import { INITIAL_TURN_STATE } from '@/domain/turn/types'
import {
  INITIAL_WILD_MAGIC_STATE,
  canCheckSurge,
  checkWildMagicSurge,
  spendTidesOfChaos,
} from './surge'

function spellNamed(id: string): Spell {
  const spell = sorynVort.spells.find((candidate) => candidate.id === id)
  if (!spell) throw new Error(`Missing fixture spell: ${id}`)
  return spell
}

function cast(id: string, overrides: Partial<CastRequest> = {}): CastRequest {
  const spell = spellNamed(id)
  return { spell, slotLevel: spell.level, metamagic: [], ...overrides }
}

describe('canCheckSurge', () => {
  it('allows a check after a sorcerer spell cast with a slot', () => {
    expect(canCheckSurge(cast('fireball'), INITIAL_TURN_STATE)).toBe(true)
  })

  it('refuses cantrips, which never spend a slot', () => {
    expect(canCheckSurge(cast('fire-bolt'), INITIAL_TURN_STATE)).toBe(false)
  })

  it('refuses feat-granted spells, which are not sorcerer spells', () => {
    expect(canCheckSurge(cast('detect-magic', { useFreeCast: true }), INITIAL_TURN_STATE)).toBe(
      false,
    )
  })

  it('only allows one check per turn', () => {
    expect(
      canCheckSurge(cast('fireball'), { ...INITIAL_TURN_STATE, surgeCheckedThisTurn: true }),
    ).toBe(false)
  })
})

describe('checkWildMagicSurge', () => {
  it('surges on a natural twenty and rolls the table', () => {
    const random = createSequenceRandomSource([20, 42])
    const { result, nextState } = checkWildMagicSurge(INITIAL_WILD_MAGIC_STATE, random)

    expect(result.d20).toBe(20)
    expect(result.triggered).toBe(true)
    expect(result.tableRoll).toBe(42)
    expect(nextState.tidesOfChaosAvailable).toBe(true)
  })

  it('does nothing on any other face', () => {
    const { result } = checkWildMagicSurge(
      INITIAL_WILD_MAGIC_STATE,
      createSequenceRandomSource([19]),
    )

    expect(result.triggered).toBe(false)
    expect(result.tableRoll).toBeNull()
  })
})

describe('Tides of Chaos', () => {
  it('arms a guaranteed surge once spent', () => {
    const spent = spendTidesOfChaos(INITIAL_WILD_MAGIC_STATE)

    expect(spent.tidesOfChaosAvailable).toBe(false)
    expect(spent.surgePending).toBe(true)
  })

  it('cannot be spent twice before it recharges', () => {
    const spent = spendTidesOfChaos(INITIAL_WILD_MAGIC_STATE)
    expect(spendTidesOfChaos(spent)).toEqual(spent)
  })

  it('guarantees the next surge and hands the use straight back', () => {
    const spent = spendTidesOfChaos(INITIAL_WILD_MAGIC_STATE)
    const { result, nextState } = checkWildMagicSurge(spent, createSequenceRandomSource([7]))

    expect(result.automatic).toBe(true)
    expect(result.triggered).toBe(true)
    expect(result.d20).toBeNull()
    expect(result.tableRoll).toBe(7)
    expect(result.tidesRecharged).toBe(true)
    expect(nextState).toEqual(INITIAL_WILD_MAGIC_STATE)
  })
})
