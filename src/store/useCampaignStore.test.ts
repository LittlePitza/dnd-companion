import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sorynVort } from '@/data/characters/sorynVort'
import type { Spell } from '@/domain/character/types'
import { createSequenceRandomSource, cryptoRandomSource } from '@/domain/dice/rng'
import { SORCERY_POINT_RESOURCE_ID } from '@/domain/session/casting'
import { createSession } from '@/domain/session/session'
import type { PlaySessionState } from '@/domain/session/types'
import type { CastRequest } from '@/domain/turn/types'
import { INITIAL_TURN_STATE } from '@/domain/turn/types'
import { STORAGE_KEYS } from '@/infrastructure/storage/safeStorage'
import type { LogEntry } from './logEntry'
import { LOG_LIMIT } from './logEntry'
import type { CampaignStore } from './useCampaignStore'
import { useCampaignStore } from './useCampaignStore'

/**
 * The store is a module-level singleton. This snapshot carries the actions
 * alongside the state, which is what makes a replacing reset safe.
 */
const pristine = useCampaignStore.getState()

const store = (): CampaignStore => useCampaignStore.getState()
const session = (): PlaySessionState => store().session
const log = (): LogEntry[] => store().log
const latest = (): LogEntry | undefined => store().log[0]

/** Puts the session into a shape a test needs without going through an action. */
function patchSession(patch: Partial<PlaySessionState>): void {
  useCampaignStore.setState({ session: { ...session(), ...patch } })
}

function drainResource(resourceId: string): void {
  patchSession({ resourcesRemaining: { ...session().resourcesRemaining, [resourceId]: 0 } })
}

/**
 * Pins the randomness the store reaches for, so assertions can name exact
 * totals instead of ranges.
 */
function scriptDice(...faces: number[]): void {
  const source = createSequenceRandomSource(faces)
  vi.spyOn(cryptoRandomSource, 'rollDie').mockImplementation((sides) => source.rollDie(sides))
}

function spellNamed(id: string): Spell {
  const spell = sorynVort.spells.find((candidate) => candidate.id === id)
  if (!spell) throw new Error(`Missing fixture spell: ${id}`)
  return spell
}

function cast(id: string, overrides: Partial<CastRequest> = {}): CastRequest {
  const spell = spellNamed(id)
  return { spell, slotLevel: spell.level, metamagic: [], ...overrides }
}

beforeEach(() => {
  vi.restoreAllMocks()
  useCampaignStore.setState({ ...pristine, session: createSession(sorynVort), log: [] }, true)
})

describe('initial state', () => {
  it('starts on the default character, fully rested and with an empty log', () => {
    expect(store().activeCharacterId).toBe(sorynVort.id)
    expect(session()).toEqual(createSession(sorynVort))
    expect(log()).toEqual([])
  })

  it('keeps the actions reachable after the test reset', () => {
    expect(typeof store().castSpell).toBe('function')
    expect(typeof store().takeLongRest).toBe('function')
    expect(typeof store().clearLog).toBe('function')
  })
})

describe('selectCharacter', () => {
  it('restarts the session and the log for a different character', () => {
    store().takeDamage(10)
    store().useSlot(1)

    store().selectCharacter('otro-heroe')

    expect(store().activeCharacterId).toBe('otro-heroe')
    expect(session().currentHitPoints).toBe(sorynVort.maxHitPoints)
    expect(session().slotsRemaining[1]).toBe(4)
    expect(log()).toEqual([])
    // Unknown ids fall back to the first character in the roster.
    expect(session().characterId).toBe(sorynVort.id)
  })

  it('does nothing when the same character is selected again', () => {
    store().takeDamage(10)
    const before = session()

    store().selectCharacter(sorynVort.id)

    expect(session()).toBe(before)
    expect(log()).toHaveLength(1)
  })
})

describe('hit points', () => {
  it('records damage and logs it', () => {
    store().takeDamage(7)

    expect(session().currentHitPoints).toBe(25)
    expect(latest()?.title).toBe('Daño recibido')
    expect(latest()?.tone).toBe('bad')
  })

  it('ignores damage and healing of zero or less', () => {
    const before = session()

    store().takeDamage(0)
    store().takeDamage(-5)
    store().heal(0)
    store().heal(-5)

    expect(session()).toBe(before)
    expect(log()).toEqual([])
  })

  it('never drops below zero or heals above the maximum', () => {
    store().takeDamage(999)
    expect(session().currentHitPoints).toBe(0)

    store().heal(999)
    expect(session().currentHitPoints).toBe(sorynVort.maxHitPoints)
  })

  it('spends temporary hit points before real ones', () => {
    store().grantTemporaryHitPoints(5)
    store().takeDamage(8)

    expect(session().temporaryHitPoints).toBe(0)
    expect(session().currentHitPoints).toBe(29)
    expect(latest()?.title).toBe('Daño recibido')
  })

  it('leaves temporary hit points alone when granted nothing', () => {
    store().grantTemporaryHitPoints(4)
    store().grantTemporaryHitPoints(0)

    expect(session().temporaryHitPoints).toBe(4)
  })
})

describe('markDeathSave', () => {
  beforeEach(() => {
    store().takeDamage(999)
  })

  it('counts a success', () => {
    store().markDeathSave('success')

    expect(session().deathSaves).toEqual({ successes: 1, failures: 0 })
    expect(latest()?.tone).toBe('good')
  })

  it('counts a failure', () => {
    store().markDeathSave('failure')

    expect(session().deathSaves).toEqual({ successes: 0, failures: 1 })
    expect(latest()?.tone).toBe('bad')
  })

  it('counts a natural one as two failures', () => {
    store().markDeathSave('critical-failure')

    expect(session().deathSaves).toEqual({ successes: 0, failures: 2 })
    expect(latest()?.tone).toBe('bad')
  })

  it('brings the character back on a natural twenty', () => {
    store().markDeathSave('failure')
    store().markDeathSave('critical-success')

    expect(session().currentHitPoints).toBe(1)
    expect(session().deathSaves).toEqual({ successes: 0, failures: 0 })
    expect(latest()?.tone).toBe('good')
  })
})

describe('useHitDie', () => {
  it('heals for the die plus Constitution and spends the die', () => {
    store().takeDamage(20)
    scriptDice(4)

    store().useHitDie()

    // 4 on the d6 plus Constitution +2.
    expect(session().currentHitPoints).toBe(18)
    expect(session().hitDiceRemaining).toBe(4)
    expect(latest()?.title).toBe('Dado de golpe')
    expect(latest()?.value).toBe(6)
  })

  it('logs the refusal and changes nothing when no dice remain', () => {
    store().takeDamage(20)
    patchSession({ hitDiceRemaining: 0 })
    const before = session()

    store().useHitDie()

    expect(session()).toBe(before)
    expect(latest()?.title).toBe('Sin dados de golpe')
    expect(latest()?.tone).toBe('bad')
  })
})

describe('spell slots', () => {
  it('spends and refunds a slot', () => {
    store().useSlot(2)
    expect(session().slotsRemaining[2]).toBe(2)

    store().refundSlot(2)
    expect(session().slotsRemaining[2]).toBe(3)
  })

  it('never refunds past the maximum', () => {
    store().refundSlot(1)

    expect(session().slotsRemaining[1]).toBe(4)
  })

  it('does nothing when the level is empty', () => {
    patchSession({ slotsRemaining: { ...session().slotsRemaining, 3: 0 } })
    const before = session()

    store().useSlot(3)

    expect(session()).toBe(before)
  })
})

describe('Font of Magic', () => {
  it('converts a slot into sorcery points', () => {
    drainResource(SORCERY_POINT_RESOURCE_ID)

    expect(store().convertSlot(2)).toBe(true)
    expect(session().slotsRemaining[2]).toBe(2)
    expect(session().resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(2)
    expect(latest()?.title).toBe('Fuente de Magia')
    expect(latest()?.tone).toBe('chaos')
  })

  it('refuses to convert a level with no slots left', () => {
    patchSession({ slotsRemaining: { ...session().slotsRemaining, 3: 0 } })

    expect(store().convertSlot(3)).toBe(false)
    expect(session().resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(5)
    expect(latest()?.title).toBe('No se pudo convertir')
    expect(latest()?.tone).toBe('bad')
  })

  it('conjures a slot for sorcery points and the bonus action', () => {
    expect(store().conjureSlot(1)).toBe(true)
    expect(session().conjuredSlots[1]).toBe(1)
    expect(session().resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(3)
    expect(session().turn.bonusActionUsed).toBe(true)
    expect(latest()?.tone).toBe('chaos')
  })

  it('refuses to conjure without enough sorcery points', () => {
    patchSession({
      resourcesRemaining: { ...session().resourcesRemaining, [SORCERY_POINT_RESOURCE_ID]: 1 },
    })

    expect(store().conjureSlot(1)).toBe(false)
    expect(session().conjuredSlots).toEqual({})
    expect(latest()?.title).toBe('No se pudo crear el espacio')
  })

  it('refuses to conjure once the bonus action is gone', () => {
    store().toggleTurnFlag('bonusActionUsed')

    expect(store().conjureSlot(1)).toBe(false)
    expect(session().resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(5)
    expect(latest()?.tone).toBe('bad')
  })
})

describe('toggleEffect', () => {
  it('switches a free effect on and off again', () => {
    store().toggleEffect('mage-armor')

    expect(session().activeEffectIds).toEqual(['mage-armor'])
    expect(latest()?.title).toBe('Armadura de Mago activo')
    expect(latest()?.tone).toBe('chaos')

    store().toggleEffect('mage-armor')

    expect(session().activeEffectIds).toEqual([])
    expect(latest()?.title).toBe('Armadura de Mago termina')
    expect(latest()?.tone).toBe('neutral')
  })

  it('charges the resource and the bonus action of an effect that costs both', () => {
    store().toggleEffect('innate-sorcery')

    expect(session().activeEffectIds).toContain('innate-sorcery')
    expect(session().resourcesRemaining['innate-sorcery']).toBe(1)
    expect(session().turn.bonusActionUsed).toBe(true)
  })

  it('refuses when the resource is spent', () => {
    drainResource('innate-sorcery')

    store().toggleEffect('innate-sorcery')

    expect(session().activeEffectIds).toEqual([])
    expect(session().turn.bonusActionUsed).toBe(false)
    expect(latest()?.title).toBe('No puedes activar Hechicería Innata')
    expect(latest()?.tone).toBe('bad')
  })

  it('refuses when the bonus action is already spent', () => {
    store().toggleTurnFlag('bonusActionUsed')

    store().toggleEffect('innate-sorcery')

    expect(session().activeEffectIds).toEqual([])
    expect(session().resourcesRemaining['innate-sorcery']).toBe(2)
    expect(latest()?.detail).toBe('Ya usaste tu acción adicional este turno.')
  })

  it('ignores an unknown effect', () => {
    const before = session()

    store().toggleEffect('no-such-effect')

    expect(session()).toBe(before)
    expect(log()).toEqual([])
  })
})

describe('adjustResourceBy', () => {
  it('clamps the resource between zero and its maximum', () => {
    store().adjustResourceBy(SORCERY_POINT_RESOURCE_ID, -2)
    expect(session().resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(3)

    store().adjustResourceBy(SORCERY_POINT_RESOURCE_ID, 99)
    expect(session().resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(5)

    store().adjustResourceBy(SORCERY_POINT_RESOURCE_ID, -99)
    expect(session().resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(0)
  })
})

describe('castSpell', () => {
  it('spends the slot, rolls the damage and writes the log line', () => {
    // Eight sixes for the Fireball, then a six on the surge d20: no surge.
    scriptDice(6)

    const result = store().castSpell(cast('fireball'))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.outcome.damage?.total).toBe(48)
    expect(session().slotsRemaining[3]).toBe(1)
    expect(session().turn.actionUsed).toBe(true)
    expect(session().turn.slotSpentThisTurn).toBe(true)
    expect(latest()?.title).toBe('Bola de Fuego lanzado')
    expect(latest()?.tone).toBe('fire')
    expect(latest()?.value).toBe(48)
    expect(latest()?.detail).toContain('48 de daño de fuego')
  })

  it('rejects an illegal cast, leaves the session untouched and says why', () => {
    scriptDice(6)
    store().castSpell(cast('fireball'))
    const afterFirst = session()

    const result = store().castSpell(cast('magic-missile'))

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.violations.map((violation) => violation.code)).toContain('ONE_SLOT_PER_TURN')
    expect(session()).toBe(afterFirst)
    expect(latest()?.title).toBe('No puedes lanzar Proyectil Mágico')
    expect(latest()?.detail).toContain('Ya gastaste un espacio de conjuro este turno')
    expect(latest()?.tone).toBe('bad')
  })

  it('logs the surge Tides of Chaos guaranteed', () => {
    scriptDice(6)
    store().useTidesOfChaos()

    const result = store().castSpell(cast('fireball'))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.outcome.surge?.automatic).toBe(true)
    expect(session().wildMagic.tidesOfChaosAvailable).toBe(true)
    expect(latest()?.title).toBe('¡Oleada de Magia Salvaje!')
    expect(latest()?.value).toBe(6)
    expect(log()[1]?.title).toBe('Bola de Fuego lanzado')
  })
})

describe('turn tracker', () => {
  it('toggles a flag on and off', () => {
    store().toggleTurnFlag('reactionUsed')
    expect(session().turn.reactionUsed).toBe(true)

    store().toggleTurnFlag('reactionUsed')
    expect(session().turn.reactionUsed).toBe(false)
  })

  it('clears the whole turn when it ends', () => {
    scriptDice(6)
    store().castSpell(cast('fireball'))
    store().toggleTurnFlag('reactionUsed')

    store().endTurn()

    expect(session().turn).toEqual(INITIAL_TURN_STATE)
    // Ending the turn is not a rest: what was spent stays spent.
    expect(session().slotsRemaining[3]).toBe(1)
  })
})

describe('wild magic', () => {
  it('spends Tides of Chaos once and ignores further attempts', () => {
    store().useTidesOfChaos()

    expect(session().wildMagic).toEqual({ tidesOfChaosAvailable: false, surgePending: true })
    expect(latest()?.title).toBe('Mareas de Caos')

    store().useTidesOfChaos()

    expect(log()).toHaveLength(1)
  })

  it('reports a surge on a natural twenty and rolls the table', () => {
    scriptDice(20, 77)

    const result = store().rollSurge()

    expect(result.triggered).toBe(true)
    expect(result.tableRoll).toBe(77)
    expect(session().turn.surgeCheckedThisTurn).toBe(true)
    expect(latest()?.title).toBe('¡Oleada de Magia Salvaje!')
    expect(latest()?.value).toBe(77)
  })

  it('reports a quiet check on anything else', () => {
    scriptDice(7)

    const result = store().rollSurge()

    expect(result.triggered).toBe(false)
    expect(result.tableRoll).toBeNull()
    expect(latest()?.title).toBe('Sin oleada')
    expect(latest()?.tone).toBe('neutral')
  })

  it('surges automatically and recharges Tides of Chaos', () => {
    scriptDice(42)
    store().useTidesOfChaos()

    const result = store().rollSurge()

    expect(result.automatic).toBe(true)
    expect(result.triggered).toBe(true)
    expect(session().wildMagic).toEqual({ tidesOfChaosAvailable: true, surgePending: false })
  })
})

describe('manual rolls', () => {
  it('logs a d20 test with its total', () => {
    scriptDice(20)

    const result = store().rollCheck('Salvación de Destreza', 3, 'normal')

    expect(result.total).toBe(23)
    expect(latest()?.title).toBe('Salvación de Destreza')
    expect(latest()?.value).toBe(23)
    expect(latest()?.detail).toContain('¡20 natural!')
    expect(latest()?.tone).toBe('good')
  })

  it('keeps the better die under advantage', () => {
    scriptDice(5, 17)

    const result = store().rollCheck('Arcanos', 0, 'advantage')

    expect(result.natural).toBe(17)
    expect(latest()?.detail).toContain('(5, 17)')
  })

  it('logs a damage roll with its flat bonus', () => {
    scriptDice(4)

    const result = store().rollDamage(
      'Daga',
      { instances: 1, dice: '1d4', type: 'piercing' },
      { flatBonus: 3 },
    )

    expect(result.total).toBe(7)
    expect(latest()?.value).toBe(7)
    expect(latest()?.tone).toBe('fire')
    expect(latest()?.detail).toContain('perforante')
  })
})

describe('rests', () => {
  it('clears the turn on a short rest', () => {
    store().toggleTurnFlag('actionUsed')

    store().takeShortRest()

    expect(session().turn).toEqual(INITIAL_TURN_STATE)
    expect(latest()?.title).toBe('Descanso corto')
    expect(latest()?.tone).toBe('good')
  })

  it('claims Sorcerous Restoration once per long rest', () => {
    drainResource(SORCERY_POINT_RESOURCE_ID)

    expect(store().claimBenefit('sorcerous-restoration')).toBe(true)
    expect(session().resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(2)
    expect(session().resourcesRemaining['sorcerous-restoration']).toBe(0)
    expect(latest()?.title).toBe('Restauración de Hechicero')

    expect(store().claimBenefit('sorcerous-restoration')).toBe(false)
    expect(session().resourcesRemaining[SORCERY_POINT_RESOURCE_ID]).toBe(2)
    expect(latest()?.title).toBe('Restauración de Hechicero no disponible')
    expect(latest()?.tone).toBe('bad')
  })

  it('ignores a benefit the character does not have', () => {
    expect(store().claimBenefit('no-such-benefit')).toBe(false)
    expect(log()).toEqual([])
  })

  it('restores everything on a long rest', () => {
    scriptDice(6)
    store().takeDamage(20)
    store().castSpell(cast('fireball'))
    store().toggleEffect('mage-armor')

    store().takeLongRest()

    expect(session().currentHitPoints).toBe(sorynVort.maxHitPoints)
    expect(session().slotsRemaining).toEqual({ 1: 4, 2: 3, 3: 2 })
    expect(session().activeEffectIds).toEqual([])
    expect(session().turn).toEqual(INITIAL_TURN_STATE)
    expect(latest()?.title).toBe('Descanso largo')
  })
})

describe('the log', () => {
  it('writes a note and clears the whole log', () => {
    store().logNote('Trato con el hostelero', 'Nos guarda las monturas por 2 po.')

    expect(latest()?.title).toBe('Trato con el hostelero')
    expect(latest()?.tone).toBe('neutral')
    expect(latest()?.id).toBeTruthy()
    expect(latest()?.at).toBeGreaterThan(0)

    store().clearLog()

    expect(log()).toEqual([])
  })

  it('keeps the newest entries and drops the oldest past the limit', () => {
    for (let index = 1; index <= LOG_LIMIT + 5; index += 1) {
      store().logNote(`Nota ${index}`, 'Detalle')
    }

    expect(log()).toHaveLength(LOG_LIMIT)
    expect(log()[0]?.title).toBe(`Nota ${LOG_LIMIT + 5}`)
    expect(log()[LOG_LIMIT - 1]?.title).toBe('Nota 6')
  })
})

describe('persistence', () => {
  it('saves the session but never the log', () => {
    store().takeDamage(7)
    store().logNote('Solo para esta sesión', 'No debería sobrevivir a la recarga.')

    const raw = window.localStorage.getItem(STORAGE_KEYS.campaign)
    expect(raw).not.toBeNull()

    const persisted = JSON.parse(raw ?? '{}') as { state?: Record<string, unknown> }
    expect(persisted.state).toHaveProperty('activeCharacterId')
    expect(persisted.state).toHaveProperty('session')
    expect(persisted.state).not.toHaveProperty('log')
    expect(log()).toHaveLength(2)
  })
})
