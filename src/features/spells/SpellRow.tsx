import { useState } from 'react'
import {
  ABILITY_SHORT_LABEL,
  CASTING_TIME_LABEL,
  DAMAGE_TYPE_LABEL,
  METAMAGIC_LABEL,
} from '@/content/labels'
import { describeViolations } from '@/content/ruleMessages'
import { boostedSpellRangeFeet } from '@/domain/character/derived'
import type {
  DamageType,
  MetamagicId,
  SlotLevel,
  Spell,
  SpellLevel,
} from '@/domain/character/types'
import { formatModifier } from '@/domain/dice/dice'
import { slotsAvailableAt } from '@/domain/session/session'
import {
  METAMAGIC_COST,
  TRANSMUTABLE_DAMAGE_TYPES,
  isTransmutable,
} from '@/domain/turn/actionEconomy'
import { Button } from '@/shared/components/Button'
import { RichText } from '@/shared/components/RichText'
import { useActiveCharacter, useCombatStats, useSession } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './Spells.module.css'

interface CastFeedback {
  blocked: boolean
  message: string
  total?: number
  surge?: string
}

/**
 * A single spell: reference on top, and the controls to actually cast it —
 * slot level, metamagic, and the rules engine's verdict — underneath.
 */
export function SpellRow({ spell }: { spell: Spell }) {
  const character = useActiveCharacter()
  const session = useSession()
  const stats = useCombatStats()
  const castSpell = useCampaignStore((state) => state.castSpell)

  const [slotLevel, setSlotLevel] = useState<SpellLevel>(spell.level)
  const [metamagic, setMetamagic] = useState<MetamagicId | null>(null)
  const [transmutedType, setTransmutedType] = useState<DamageType>('cold')
  const [feedback, setFeedback] = useState<CastFeedback | null>(null)

  const knownMetamagic = character.spellcasting?.metamagic ?? []
  const freeUses = session.freeUsesRemaining[spell.id] ?? 0
  const boostedRange = boostedSpellRangeFeet(character, spell)
  const maxSlotLevel = Math.max(
    spell.level,
    ...Object.keys(character.spellcasting?.slots ?? {}).map(Number),
  )

  const upcastChoices: SlotLevel[] =
    spell.level === 0
      ? []
      : Array.from(
          { length: maxSlotLevel - spell.level + 1 },
          (_, index) => (spell.level + index) as SlotLevel,
        )

  const rollLabel = spell.attackRoll
    ? `Ataque ${formatModifier(stats.spellAttackBonus ?? 0)}`
    : spell.save
      ? `Salvación ${ABILITY_SHORT_LABEL[spell.save.ability]} CD ${stats.spellSaveDc}`
      : spell.autoHit
        ? 'Impacto automático'
        : '—'

  const cast = (useFreeCast: boolean) => {
    const result = castSpell({
      spell,
      slotLevel: useFreeCast ? 0 : slotLevel,
      metamagic: metamagic ? [metamagic] : [],
      ...(useFreeCast ? { useFreeCast: true } : {}),
      ...(metamagic === 'transmuted' ? { transmutedDamageType: transmutedType } : {}),
    })

    if (!result.ok) {
      setFeedback({ blocked: true, message: describeViolations(result.violations) })
      return
    }

    const { outcome } = result
    const damage = outcome.damage

    setFeedback({
      blocked: false,
      message: damage
        ? `${damage.notation} de ${DAMAGE_TYPE_LABEL[damage.type]}${
            damage.instances.length > 1
              ? ` · ${damage.instances.map((instance) => instance.total).join(' · ')}`
              : ` · ${damage.instances[0]?.rolls.join(' + ') ?? ''}`
          }`
        : 'Lanzado.',
      ...(damage ? { total: damage.total } : {}),
      ...(outcome.surge?.triggered
        ? {
            surge: `¡Oleada! Tira ${outcome.surge.tableRoll} en la tabla (PHB 2024, pág. 149).`,
          }
        : {}),
    })
  }

  return (
    <details
      className={[styles.spell, spell.origin === 'feat' ? styles.spellFeat : undefined]
        .filter(Boolean)
        .join(' ')}
    >
      <summary className={styles.summary}>
        <span
          className={[styles.level, spell.level === 0 ? styles.levelCantrip : undefined]
            .filter(Boolean)
            .join(' ')}
        >
          {spell.level === 0 ? 'TR' : spell.level}
        </span>
        <span className={styles.name}>
          {spell.name}
          <span className={styles.english}>
            {spell.englishName}
            {spell.origin === 'feat' ? ' · del dote' : ''}
          </span>
        </span>
        <span className={styles.quick}>{spell.summary}</span>
      </summary>

      <div className={styles.body}>
        <div className={styles.stats}>
          <div>
            <p className={styles.statKey}>Lanzamiento</p>
            <p className={styles.statValue}>{CASTING_TIME_LABEL[spell.castingTime]}</p>
          </div>
          <div>
            <p className={styles.statKey}>Alcance</p>
            <p className={styles.statValue}>
              {boostedRange !== null ? `${boostedRange} pies` : spell.range}
            </p>
          </div>
          <div>
            <p className={styles.statKey}>Tirada</p>
            <p className={styles.statValue}>{rollLabel}</p>
          </div>
          <div>
            <p className={styles.statKey}>Duración</p>
            <p className={styles.statValue}>
              {spell.duration}
              {spell.ritual ? ' · ritual' : ''}
            </p>
          </div>
        </div>

        <RichText className={styles.usage}>{spell.usage}</RichText>
        {spell.caution ? (
          <p className={styles.caution}>
            <strong>Ojo.</strong> {spell.caution}
          </p>
        ) : null}

        <div className={styles.controls}>
          {upcastChoices.length > 1 ? (
            <>
              <label className="visually-hidden" htmlFor={`slot-${spell.id}`}>
                Nivel del espacio para {spell.name}
              </label>
              <select
                id={`slot-${spell.id}`}
                className={styles.select}
                value={slotLevel}
                onChange={(event) => setSlotLevel(Number(event.target.value) as SpellLevel)}
              >
                {upcastChoices.map((level) => (
                  <option key={level} value={level}>
                    Nivel {level} ({slotsAvailableAt(session, level)} disp.)
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {knownMetamagic.map((option) => {
            const disabled =
              option === 'transmuted' && !(spell.damage && isTransmutable(spell.damage.type))
            return (
              <Button
                key={option}
                variant="chaos"
                size="small"
                aria-pressed={metamagic === option}
                disabled={disabled}
                title={disabled ? 'Este conjuro no admite esta metamagia.' : undefined}
                onClick={() => setMetamagic(metamagic === option ? null : option)}
              >
                {METAMAGIC_LABEL[option]} · {METAMAGIC_COST[option]} PH
              </Button>
            )
          })}

          {metamagic === 'transmuted' ? (
            <>
              <label className="visually-hidden" htmlFor={`transmute-${spell.id}`}>
                Nuevo tipo de daño
              </label>
              <select
                id={`transmute-${spell.id}`}
                className={styles.select}
                value={transmutedType}
                onChange={(event) => setTransmutedType(event.target.value as DamageType)}
              >
                {TRANSMUTABLE_DAMAGE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DAMAGE_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <Button variant="solid" size="small" onClick={() => cast(false)}>
            Lanzar
          </Button>

          {spell.freeUses ? (
            <Button variant="hot" size="small" disabled={freeUses < 1} onClick={() => cast(true)}>
              Gratis ({freeUses})
            </Button>
          ) : null}
        </div>

        {feedback ? (
          <p className={styles.outcome}>
            {feedback.blocked ? (
              <span className={styles.blocked}>{feedback.message}</span>
            ) : (
              <>
                {feedback.total !== undefined ? (
                  <span className={styles.outcomeTotal}>{feedback.total}</span>
                ) : null}
                <span className={styles.outcomeDetail}>{feedback.message}</span>
                {feedback.surge ? <span className={styles.surge}>{feedback.surge}</span> : null}
              </>
            )}
          </p>
        ) : null}
      </div>
    </details>
  )
}
