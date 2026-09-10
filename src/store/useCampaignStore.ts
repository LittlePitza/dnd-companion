import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_CHARACTER_ID, resolveCharacter } from '@/data/characters'
import type { Character, DamageProfile, DamageType, SlotLevel } from '@/domain/character/types'
import { rollD20 } from '@/domain/dice/dice'
import type { D20RollResult, RollMode } from '@/domain/dice/dice'
import { cryptoRandomSource } from '@/domain/dice/rng'
import type { CastResult, DamageRollResult } from '@/domain/session/casting'
import {
  convertSlotToSorceryPoints,
  createSlotFromSorceryPoints,
  resolveCast,
  rollDamageProfile,
} from '@/domain/session/casting'
import type { DeathSaveOutcome } from '@/domain/session/hitPoints'
import {
  applyDamage,
  applyHealing,
  applyTemporaryHitPoints,
  recordDeathSave,
  spendHitDie,
} from '@/domain/session/hitPoints'
import { applyLongRest, applyShortRest, claimShortRestBenefit } from '@/domain/session/rest'
import {
  adjustResource,
  clamp,
  createSession,
  restoreSlot,
  spendSlot,
} from '@/domain/session/session'
import type { PlaySessionState } from '@/domain/session/types'
import type { CastRequest } from '@/domain/turn/types'
import { INITIAL_TURN_STATE } from '@/domain/turn/types'
import type { SurgeCheckResult } from '@/domain/wildmagic/surge'
import { checkWildMagicSurge, spendTidesOfChaos } from '@/domain/wildmagic/surge'
import { createSafeStorage, STORAGE_KEYS } from '@/infrastructure/storage/safeStorage'
import { DAMAGE_TYPE_LABEL } from '@/content/labels'
import { describeViolations } from '@/content/ruleMessages'
import type { LogEntry } from './logEntry'
import { appendLog } from './logEntry'

/** Turn resources the player can tick off by hand. */
export type TurnSlotKey = 'actionUsed' | 'bonusActionUsed' | 'reactionUsed'

interface CampaignState {
  activeCharacterId: string
  session: PlaySessionState
  log: LogEntry[]
}

interface CampaignActions {
  selectCharacter: (characterId: string) => void

  takeDamage: (amount: number) => void
  heal: (amount: number) => void
  grantTemporaryHitPoints: (amount: number) => void
  markDeathSave: (outcome: DeathSaveOutcome) => void
  useHitDie: () => void

  adjustResourceBy: (resourceId: string, delta: number) => void
  toggleEffect: (effectId: string) => void

  useSlot: (level: SlotLevel) => void
  refundSlot: (level: SlotLevel) => void
  convertSlot: (level: SlotLevel) => boolean
  conjureSlot: (level: SlotLevel) => boolean

  castSpell: (request: CastRequest) => CastResult

  toggleTurnFlag: (key: TurnSlotKey) => void
  endTurn: () => void

  useTidesOfChaos: () => void
  rollSurge: () => SurgeCheckResult

  rollCheck: (label: string, modifier: number, mode: RollMode) => D20RollResult
  rollDamage: (
    label: string,
    damage: DamageProfile,
    options?: { typeOverride?: DamageType; flatBonus?: number },
  ) => DamageRollResult

  takeShortRest: () => void
  claimBenefit: (benefitId: string) => boolean
  takeLongRest: () => void

  logNote: (title: string, detail: string) => void
  clearLog: () => void
}

export type CampaignStore = CampaignState & CampaignActions

function initialState(characterId = DEFAULT_CHARACTER_ID): CampaignState {
  return {
    activeCharacterId: characterId,
    session: createSession(resolveCharacter(characterId)),
    log: [],
  }
}

export const useCampaignStore = create<CampaignStore>()(
  persist(
    (set, get) => {
      /** Applies a pure session transition and keeps the log untouched. */
      const updateSession = (
        transform: (session: PlaySessionState, character: Character) => PlaySessionState | null,
      ): void => {
        const { session, activeCharacterId } = get()
        const next = transform(session, resolveCharacter(activeCharacterId))
        if (next) set({ session: next })
      }

      const pushLog = (entry: Omit<LogEntry, 'id' | 'at'>): void => {
        set((state) => ({ log: appendLog(state.log, entry) }))
      }

      const character = (): Character => resolveCharacter(get().activeCharacterId)

      return {
        ...initialState(),

        selectCharacter: (characterId) => {
          if (characterId === get().activeCharacterId) return
          set(initialState(characterId))
        },

        takeDamage: (amount) => {
          if (amount <= 0) return
          updateSession((session) => applyDamage(session, amount))
          pushLog({ title: 'Daño recibido', detail: `−${amount} puntos de golpe`, tone: 'bad' })
        },

        heal: (amount) => {
          if (amount <= 0) return
          updateSession((session, hero) => applyHealing(session, hero, amount))
          pushLog({ title: 'Curación', detail: `+${amount} puntos de golpe`, tone: 'good' })
        },

        grantTemporaryHitPoints: (amount) => {
          updateSession((session) => applyTemporaryHitPoints(session, amount))
          pushLog({ title: 'PG temporales', detail: `${amount} puntos temporales`, tone: 'good' })
        },

        markDeathSave: (outcome) => {
          updateSession((session) => recordDeathSave(session, outcome))
          const labels: Record<DeathSaveOutcome, string> = {
            success: 'Éxito en salvación de muerte',
            failure: 'Fallo en salvación de muerte',
            'critical-success': '20 natural: vuelves con 1 punto de golpe',
            'critical-failure': '1 natural: cuenta como dos fallos',
          }
          pushLog({
            title: 'Salvación de muerte',
            detail: labels[outcome],
            tone: outcome.includes('failure') ? 'bad' : 'good',
          })
        },

        useHitDie: () => {
          const { session } = get()
          const result = spendHitDie(session, character(), cryptoRandomSource)
          if (!result) {
            pushLog({
              title: 'Sin dados de golpe',
              detail: 'No te quedan dados que gastar.',
              tone: 'bad',
            })
            return
          }
          set({ session: result.session })
          pushLog({
            title: 'Dado de golpe',
            detail: `Sacaste ${result.rolled} y recuperas ${result.healed} puntos de golpe.`,
            tone: 'good',
            value: result.healed,
          })
        },

        adjustResourceBy: (resourceId, delta) => {
          updateSession((session, hero) => adjustResource(session, hero, resourceId, delta))
        },

        toggleEffect: (effectId) => {
          const hero = character()
          const effect = hero.effects.find((candidate) => candidate.id === effectId)
          if (!effect) return

          const { session } = get()
          const isActive = session.activeEffectIds.includes(effectId)

          if (isActive) {
            set({
              session: {
                ...session,
                activeEffectIds: session.activeEffectIds.filter((id) => id !== effectId),
              },
            })
            pushLog({
              title: `${effect.name} termina`,
              detail: 'Efecto desactivado.',
              tone: 'neutral',
            })
            return
          }

          if (effect.resourceId && (session.resourcesRemaining[effect.resourceId] ?? 0) < 1) {
            pushLog({
              title: `No puedes activar ${effect.name}`,
              detail: 'No te quedan usos de este rasgo.',
              tone: 'bad',
            })
            return
          }

          if (effect.costsBonusAction && session.turn.bonusActionUsed) {
            pushLog({
              title: `No puedes activar ${effect.name}`,
              detail: 'Ya usaste tu acción adicional este turno.',
              tone: 'bad',
            })
            return
          }

          let next: PlaySessionState = {
            ...session,
            activeEffectIds: [...session.activeEffectIds, effectId],
          }
          if (effect.resourceId) next = adjustResource(next, hero, effect.resourceId, -1)
          if (effect.costsBonusAction)
            next = { ...next, turn: { ...next.turn, bonusActionUsed: true } }

          set({ session: next })
          pushLog({ title: `${effect.name} activo`, detail: effect.description, tone: 'chaos' })
        },

        useSlot: (level) => {
          updateSession((session) => spendSlot(session, level))
        },

        refundSlot: (level) => {
          updateSession((session, hero) => restoreSlot(session, hero, level))
        },

        convertSlot: (level) => {
          const next = convertSlotToSorceryPoints(get().session, character(), level)
          if (!next) {
            pushLog({
              title: 'No se pudo convertir',
              detail: `No te quedan espacios de nivel ${level}.`,
              tone: 'bad',
            })
            return false
          }
          set({ session: next })
          pushLog({
            title: 'Fuente de Magia',
            detail: `Un espacio de nivel ${level} se convierte en ${level} puntos de hechicería.`,
            tone: 'chaos',
          })
          return true
        },

        conjureSlot: (level) => {
          const next = createSlotFromSorceryPoints(get().session, character(), level)
          if (!next) {
            pushLog({
              title: 'No se pudo crear el espacio',
              detail: 'Te faltan puntos de hechicería o ya usaste la acción adicional.',
              tone: 'bad',
            })
            return false
          }
          set({ session: next })
          pushLog({
            title: 'Fuente de Magia',
            detail: `Creas un espacio de nivel ${level}. Desaparece al terminar el descanso largo.`,
            tone: 'chaos',
          })
          return true
        },

        castSpell: (request) => {
          const result = resolveCast(request, get().session, character(), cryptoRandomSource)

          if (!result.ok) {
            pushLog({
              title: `No puedes lanzar ${request.spell.name}`,
              detail: describeViolations(result.violations),
              tone: 'bad',
            })
            return result
          }

          const { outcome } = result
          set({ session: outcome.session })

          const parts: string[] = []
          if (request.metamagic.length > 0) parts.push('con metamagia')
          if (outcome.slotLevel > request.spell.level) {
            parts.push(`con espacio de nivel ${outcome.slotLevel}`)
          }
          if (outcome.usedFreeCast) parts.push('lanzamiento gratuito')

          pushLog({
            title: `${request.spell.name} lanzado`,
            detail: outcome.damage
              ? `${outcome.damage.total} de daño de ${DAMAGE_TYPE_LABEL[outcome.damage.type]} (${outcome.damage.notation})${parts.length ? ` · ${parts.join(' · ')}` : ''}`
              : parts.join(' · ') || 'Sin daño directo.',
            tone: outcome.damage ? 'fire' : 'neutral',
            ...(outcome.damage ? { value: outcome.damage.total } : {}),
          })

          if (outcome.surge?.triggered) {
            pushLog({
              title: '¡Oleada de Magia Salvaje!',
              detail: outcome.surge.automatic
                ? `Mareas de Caos la garantizó. Tira ${outcome.surge.tableRoll} en la tabla de Oleada (PHB 2024, pág. 149).`
                : `Veinte natural. Tira ${outcome.surge.tableRoll} en la tabla de Oleada (PHB 2024, pág. 149).`,
              tone: 'chaos',
              ...(outcome.surge.tableRoll !== null ? { value: outcome.surge.tableRoll } : {}),
            })
          }

          return result
        },

        toggleTurnFlag: (key) => {
          set((state) => ({
            session: {
              ...state.session,
              turn: { ...state.session.turn, [key]: !state.session.turn[key] },
            },
          }))
        },

        endTurn: () => {
          set((state) => ({ session: { ...state.session, turn: { ...INITIAL_TURN_STATE } } }))
        },

        useTidesOfChaos: () => {
          const { session } = get()
          if (!session.wildMagic.tidesOfChaosAvailable) return

          set({ session: { ...session, wildMagic: spendTidesOfChaos(session.wildMagic) } })
          pushLog({
            title: 'Mareas de Caos',
            detail:
              'Ventaja en una prueba de d20. Tu siguiente conjuro de hechicero con espacio dispara la oleada automáticamente.',
            tone: 'chaos',
          })
        },

        rollSurge: () => {
          const { session } = get()
          const { result, nextState } = checkWildMagicSurge(session.wildMagic, cryptoRandomSource)

          set({
            session: {
              ...session,
              wildMagic: nextState,
              turn: { ...session.turn, surgeCheckedThisTurn: true },
            },
          })

          pushLog({
            title: result.triggered ? '¡Oleada de Magia Salvaje!' : 'Sin oleada',
            detail: result.triggered
              ? `Tira ${result.tableRoll} en la tabla de Oleada (PHB 2024, pág. 149).`
              : `Sacaste ${result.d20} en el d20. La magia se portó bien.`,
            tone: result.triggered ? 'chaos' : 'neutral',
            ...(result.tableRoll !== null ? { value: result.tableRoll } : {}),
          })

          return result
        },

        rollCheck: (label, modifier, mode) => {
          const result = rollD20(modifier, mode, cryptoRandomSource)
          const extra = result.isCriticalHit
            ? ' · ¡20 natural!'
            : result.isCriticalMiss
              ? ' · 1 natural'
              : ''

          pushLog({
            title: label,
            detail: `d20 ${result.natural}${result.dice.length > 1 ? ` (${result.dice.join(', ')})` : ''} ${modifier >= 0 ? '+' : '−'} ${Math.abs(modifier)}${extra}`,
            tone: result.isCriticalHit ? 'good' : result.isCriticalMiss ? 'bad' : 'neutral',
            value: result.total,
          })

          return result
        },

        rollDamage: (label, damage, options = {}) => {
          const result = rollDamageProfile(
            damage,
            cryptoRandomSource,
            options.typeOverride,
            options.flatBonus ?? 0,
          )

          const breakdown =
            result.instances.length > 1
              ? ` (${result.instances.map((instance) => instance.total).join(' · ')})`
              : ` (${result.instances[0]?.rolls.join(' + ') ?? ''})`

          pushLog({
            title: label,
            detail: `${result.notation} de daño de ${DAMAGE_TYPE_LABEL[result.type]}${breakdown}`,
            tone: 'fire',
            value: result.total,
          })

          return result
        },

        takeShortRest: () => {
          updateSession((session, hero) => applyShortRest(session, hero))
          pushLog({
            title: 'Descanso corto',
            detail: 'Recursos de descanso corto restaurados. Gasta dados de golpe si lo necesitas.',
            tone: 'good',
          })
        },

        claimBenefit: (benefitId) => {
          const hero = character()
          const benefit = hero.shortRestBenefits.find((candidate) => candidate.id === benefitId)
          if (!benefit) return false

          const next = claimShortRestBenefit(get().session, hero, benefit)
          if (!next) {
            pushLog({
              title: `${benefit.name} no disponible`,
              detail: 'Ya lo usaste en este descanso largo.',
              tone: 'bad',
            })
            return false
          }

          set({ session: next })
          pushLog({ title: benefit.name, detail: benefit.description, tone: 'good' })
          return true
        },

        takeLongRest: () => {
          updateSession((session, hero) => applyLongRest(session, hero))
          pushLog({ title: 'Descanso largo', detail: 'Día nuevo. Todo restaurado.', tone: 'good' })
        },

        logNote: (title, detail) => {
          pushLog({ title, detail, tone: 'neutral' })
        },

        clearLog: () => {
          set({ log: [] })
        },
      }
    },
    {
      name: STORAGE_KEYS.campaign,
      storage: createJSONStorage(createSafeStorage),
      version: 1,
      // The roll log is a within-session convenience, not campaign state.
      partialize: (state) => ({
        activeCharacterId: state.activeCharacterId,
        session: state.session,
      }),
      /**
       * Character data lives in source control and can change between releases.
       * Reconcile the restored session so a lowered maximum can never leave the
       * sheet showing more hit points than the character has.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const hero = resolveCharacter(state.activeCharacterId)
        state.session = {
          ...state.session,
          characterId: hero.id,
          currentHitPoints: clamp(state.session.currentHitPoints, 0, hero.maxHitPoints),
          hitDiceRemaining: clamp(state.session.hitDiceRemaining, 0, hero.hitDice.count),
        }
      },
    },
  ),
)
