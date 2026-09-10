import { describe, expect, it } from 'vitest'
import { sorynVort } from '@/data/characters/sorynVort'
import { createSequenceRandomSource } from '@/domain/dice/rng'
import type { Spell } from '@/domain/character/types'
import type { CastRequest } from '@/domain/turn/types'
import {
  SORCERY_POINT_RESOURCE_ID,
  convertSlotToSorceryPoints,
  createSlotFromSorceryPoints,
  resolveCast,
} from './casting'
import {
  applyDamage,
  applyHealing,
  applyTemporaryHitPoints,
  recordDeathSave,
  spendHitDie,
  vitalStatus,
} from './hitPoints'
import { applyLongRest, applyShortRest, claimShortRestBenefit } from './rest'
import { createSession, slotsAvailableAt } from './session'
import { spendTidesOfChaos } from '@/domain/wildmagic/surge'

function spellNamed(id: string): Spell {
  const spell = sorynVort.spells.find((candidate) => candidate.id === id)
  if (!spell) throw new Error(`Missing fixture spell: ${id}`)
  return spell
}

function cast(id: string, overrides: Partial<CastRequest> = {}): CastRequest {
  const spell = spellNamed(id)
  return { spell, slotLevel: spell.level, metamagic: [], ...overrides }
}

describe('createSession', () => {
  it('starts fully rested', () => {
    const session = createSession(sorynVort)

    expect(session.currentHitPoints).toBe(32)
    expect(session.hitDiceRemaining).toBe(5)
    expect(session.slotsRemaining).toEqual({ 1: 4, 2: 3, 3: 2 })
    expect(session.resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(5)
    expect(session.freeUsesRemaining['detect-magic']).toBe(1)
  })
})

describe('hit points', () => {
  it('spends temporary hit points before real ones', () => {
    const session = applyTemporaryHitPoints(createSession(sorynVort), 5)
    const hurt = applyDamage(session, 8)

    expect(hurt.temporaryHitPoints).toBe(0)
    expect(hurt.currentHitPoints).toBe(29)
  })

  it('does not stack temporary hit points', () => {
    const session = applyTemporaryHitPoints(createSession(sorynVort), 5)
    expect(applyTemporaryHitPoints(session, 3).temporaryHitPoints).toBe(5)
    expect(applyTemporaryHitPoints(session, 9).temporaryHitPoints).toBe(9)
  })

  it('never falls below zero or heals above the maximum', () => {
    const session = createSession(sorynVort)
    expect(applyDamage(session, 999).currentHitPoints).toBe(0)
    expect(applyHealing(session, sorynVort, 999).currentHitPoints).toBe(32)
  })

  it('clears death saves when healed off zero', () => {
    let session = applyDamage(createSession(sorynVort), 40)
    session = recordDeathSave(session, 'failure')
    session = applyHealing(session, sorynVort, 4)

    expect(session.currentHitPoints).toBe(4)
    expect(session.deathSaves).toEqual({ successes: 0, failures: 0 })
  })

  it('counts a natural one as two failures and a natural twenty as a revival', () => {
    const down = applyDamage(createSession(sorynVort), 40)

    expect(recordDeathSave(down, 'critical-failure').deathSaves.failures).toBe(2)

    const revived = recordDeathSave(down, 'critical-success')
    expect(revived.currentHitPoints).toBe(1)
    expect(revived.deathSaves).toEqual({ successes: 0, failures: 0 })
  })

  it('reports the vital status the header shows', () => {
    const session = createSession(sorynVort)

    expect(vitalStatus(session, sorynVort)).toBe('healthy')
    expect(vitalStatus(applyDamage(session, 17), sorynVort)).toBe('bloodied')
    expect(vitalStatus(applyDamage(session, 25), sorynVort)).toBe('critical')
    expect(vitalStatus(applyDamage(session, 32), sorynVort)).toBe('down')
  })

  it('heals with a Hit Die plus the Constitution modifier', () => {
    const hurt = applyDamage(createSession(sorynVort), 20)
    const result = spendHitDie(hurt, sorynVort, createSequenceRandomSource([4]))

    expect(result).not.toBeNull()
    expect(result?.rolled).toBe(4)
    // 4 on the d6 plus Constitution +2.
    expect(result?.healed).toBe(6)
    expect(result?.session.hitDiceRemaining).toBe(4)
  })
})

describe('resolveCast', () => {
  it('spends the slot and rolls damage', () => {
    const session = createSession(sorynVort)
    const random = createSequenceRandomSource([6, 6, 6, 6, 6, 6, 6, 6, 1])
    const result = resolveCast(cast('fireball'), session, sorynVort, random)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.outcome.damage?.total).toBe(48)
    expect(result.outcome.damage?.type).toBe('fire')
    expect(result.outcome.session.slotsRemaining[3]).toBe(1)
    expect(result.outcome.session.turn.slotSpentThisTurn).toBe(true)
    expect(result.outcome.session.turn.actionUsed).toBe(true)
  })

  it('rejects an illegal second levelled spell and changes nothing', () => {
    const session = createSession(sorynVort)
    const random = createSequenceRandomSource([1])
    const first = resolveCast(cast('fireball'), session, sorynVort, random)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = resolveCast(cast('magic-missile'), first.outcome.session, sorynVort, random)

    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.violations.map((violation) => violation.code)).toContain('ONE_SLOT_PER_TURN')
  })

  it('charges sorcery points for metamagic', () => {
    const session = createSession(sorynVort)
    const result = resolveCast(
      cast('fireball', { metamagic: ['quickened'] }),
      session,
      sorynVort,
      createSequenceRandomSource([3]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.outcome.sorceryPointsSpent).toBe(2)
    expect(result.outcome.session.resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(3)
    expect(result.outcome.session.turn.bonusActionUsed).toBe(true)
    expect(result.outcome.session.turn.actionUsed).toBe(false)
  })

  it('retypes damage when Transmuted Spell is applied', () => {
    const result = resolveCast(
      cast('fireball', { metamagic: ['transmuted'], transmutedDamageType: 'cold' }),
      createSession(sorynVort),
      sorynVort,
      createSequenceRandomSource([1]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.outcome.damage?.type).toBe('cold')
  })

  it('rolls five darts when Magic Missile is upcast to level 3', () => {
    const result = resolveCast(
      cast('magic-missile', { slotLevel: 3 }),
      createSession(sorynVort),
      sorynVort,
      createSequenceRandomSource([4]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.outcome.damage?.instances).toHaveLength(5)
    // Five darts of 1d4+1, each rolling a 4.
    expect(result.outcome.damage?.total).toBe(25)
  })

  it('runs the surge check only for sorcerer spells cast with a slot', () => {
    const withSlot = resolveCast(
      cast('fireball'),
      createSession(sorynVort),
      sorynVort,
      createSequenceRandomSource([1]),
    )
    expect(withSlot.ok && withSlot.outcome.surge).not.toBeNull()

    const cantrip = resolveCast(
      cast('fire-bolt'),
      createSession(sorynVort),
      sorynVort,
      createSequenceRandomSource([1]),
    )
    expect(cantrip.ok && cantrip.outcome.surge).toBeNull()
  })

  it('surges automatically after Tides of Chaos and hands the use back', () => {
    const session = createSession(sorynVort)
    const armed = { ...session, wildMagic: spendTidesOfChaos(session.wildMagic) }

    const result = resolveCast(cast('fireball'), armed, sorynVort, createSequenceRandomSource([2]))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.outcome.surge?.automatic).toBe(true)
    expect(result.outcome.surge?.triggered).toBe(true)
    expect(result.outcome.session.wildMagic.tidesOfChaosAvailable).toBe(true)
  })

  it('spends a free casting instead of a slot', () => {
    const result = resolveCast(
      cast('detect-magic', { slotLevel: 0, useFreeCast: true }),
      createSession(sorynVort),
      sorynVort,
      createSequenceRandomSource([1]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.outcome.session.freeUsesRemaining['detect-magic']).toBe(0)
    expect(result.outcome.session.slotsRemaining[1]).toBe(4)
  })
})

describe('Font of Magic', () => {
  it('converts a slot into sorcery points equal to its level', () => {
    const session = createSession(sorynVort)
    const spent = convertSlotToSorceryPoints(
      {
        ...session,
        resourcesRemaining: { ...session.resourcesRemaining, [SORCERY_POINT_RESOURCE_ID]: 0 },
      },
      sorynVort,
      2,
    )

    expect(spent).not.toBeNull()
    expect(spent?.slotsRemaining[2]).toBe(2)
    expect(spent?.resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(2)
  })

  it('creates a conjured slot for the listed price, using the bonus action', () => {
    const created = createSlotFromSorceryPoints(createSession(sorynVort), sorynVort, 3)

    expect(created).not.toBeNull()
    expect(created?.resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(0)
    expect(created && slotsAvailableAt(created, 3)).toBe(3)
    expect(created?.turn.bonusActionUsed).toBe(true)
  })

  it('refuses when the points or the bonus action are gone', () => {
    const session = createSession(sorynVort)
    const poor = { ...session, resourcesRemaining: { [SORCERY_POINT_RESOURCE_ID]: 1 } }
    expect(createSlotFromSorceryPoints(poor, sorynVort, 3)).toBeNull()

    const busy = { ...session, turn: { ...session.turn, bonusActionUsed: true } }
    expect(createSlotFromSorceryPoints(busy, sorynVort, 1)).toBeNull()
  })

  it('drops conjured slots on a long rest instead of refilling them', () => {
    const created = createSlotFromSorceryPoints(createSession(sorynVort), sorynVort, 1)
    expect(created).not.toBeNull()

    const rested = applyLongRest(created!, sorynVort)
    expect(rested.conjuredSlots).toEqual({})
    expect(rested.slotsRemaining[1]).toBe(4)
  })
})

describe('rests', () => {
  it('buys back sorcery points with Sorcerous Restoration', () => {
    const session = createSession(sorynVort)
    const drained = {
      ...session,
      resourcesRemaining: { ...session.resourcesRemaining, [SORCERY_POINT_RESOURCE_ID]: 0 },
    }
    const benefit = sorynVort.shortRestBenefits[0]
    expect(benefit).toBeDefined()

    const claimed = claimShortRestBenefit(applyShortRest(drained, sorynVort), sorynVort, benefit!)

    expect(claimed?.resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(2)
    expect(claimed?.resourcesRemaining['sorcerous-restoration']).toBe(0)
    expect(claimed && claimShortRestBenefit(claimed, sorynVort, benefit!)).toBeNull()
  })

  it('never pushes a resource past its maximum', () => {
    const session = createSession(sorynVort)
    const benefit = sorynVort.shortRestBenefits[0]!
    const claimed = claimShortRestBenefit(session, sorynVort, benefit)

    expect(claimed?.resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(5)
  })

  it('restores everything on a long rest', () => {
    let session = applyDamage(createSession(sorynVort), 25)
    session = {
      ...session,
      slotsRemaining: {},
      resourcesRemaining: {},
      activeEffectIds: ['mage-armor'],
    }

    const rested = applyLongRest(session, sorynVort)

    expect(rested.currentHitPoints).toBe(32)
    expect(rested.slotsRemaining).toEqual({ 1: 4, 2: 3, 3: 2 })
    expect(rested.resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(5)
    expect(rested.activeEffectIds).toEqual([])
    expect(rested.wildMagic.tidesOfChaosAvailable).toBe(true)
  })

  it('returns half the Hit Dice, rounded down', () => {
    const session = { ...createSession(sorynVort), hitDiceRemaining: 0 }
    expect(applyLongRest(session, sorynVort).hitDiceRemaining).toBe(2)
  })
})
