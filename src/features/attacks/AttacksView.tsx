import { useState } from 'react'
import type { CSSProperties } from 'react'
import { DAMAGE_TYPE_LABEL } from '@/content/labels'
import { formatModifier } from '@/domain/dice/dice'
import type { RollMode } from '@/domain/dice/dice'
import { Button } from '@/shared/components/Button'
import { Section } from '@/shared/components/Surfaces'
import { useCampaignStore } from '@/store/useCampaignStore'
import { useCombatStats } from '@/store/selectors'
import type { AttackOption } from './useAttackOptions'
import { useAttackOptions } from './useAttackOptions'
import styles from './Attacks.module.css'

interface AttackResult {
  kind: 'attack' | 'damage'
  headline: number
  detail: string
  outcome?: 'critical' | 'fumble'
}

/**
 * Every attack on one screen, each with its own roll buttons. Rolling here
 * never spends a spell slot: casting with resource tracking lives in Conjuros.
 */
export function AttacksView() {
  const attacks = useAttackOptions()
  const stats = useCombatStats()

  return (
    <Section
      heading="Ataques"
      lede="Tira aquí para ver el número. Lanzar un conjuro con espacio, con su coste y sus reglas, se hace en Conjuros."
    >
      <div className={styles.list}>
        {attacks.map((attack, index) => (
          <AttackRow key={attack.id} attack={attack} index={index} />
        ))}
      </div>

      {stats.hasAdvantageOnClassSpellAttacks ? (
        <p className={styles.notes} style={{ marginTop: 'var(--space-4)' }}>
          Hechicería Innata está activa: tus ataques de conjuro de hechicero ya tiran con ventaja.
        </p>
      ) : null}
    </Section>
  )
}

function AttackRow({ attack, index }: { attack: AttackOption; index: number }) {
  const rollCheck = useCampaignStore((state) => state.rollCheck)
  const rollDamage = useCampaignStore((state) => state.rollDamage)
  const [result, setResult] = useState<AttackResult | null>(null)
  // Bumped on every roll so the readout replays its landing animation.
  const [rollSequence, setRollSequence] = useState(0)

  const attackWith = (mode: RollMode) => {
    const roll = rollCheck(`Ataque · ${attack.name}`, attack.attackBonus, mode)
    setRollSequence((value) => value + 1)
    setResult({
      kind: 'attack',
      headline: roll.total,
      detail: `d20 ${roll.natural}${roll.dice.length > 1 ? ` de (${roll.dice.join(', ')})` : ''} ${formatModifier(attack.attackBonus)}`,
      ...(roll.isCriticalHit
        ? { outcome: 'critical' as const }
        : roll.isCriticalMiss
          ? { outcome: 'fumble' as const }
          : {}),
    })
  }

  const damageOptions = attack.damageBonus !== 0 ? { flatBonus: attack.damageBonus } : undefined

  return (
    <article className={styles.attack} style={{ '--stagger-index': index } as CSSProperties}>
      <div className={styles.header}>
        <span className={styles.bonus}>{formatModifier(attack.attackBonus)}</span>
        <h3 className={styles.name}>
          {attack.name}
          <span className={styles.english}>{attack.englishName}</span>
        </h3>

        <div className={styles.tags}>
          {attack.hasAdvantage ? (
            <span className={[styles.tag, styles.tagAdvantage].join(' ')}>Ventaja</span>
          ) : null}
          {attack.requiresSlot ? (
            <span className={[styles.tag, styles.tagSlot].join(' ')}>Gasta espacio</span>
          ) : null}
          {attack.properties.map((property) => (
            <span key={property} className={styles.tag}>
              {property}
            </span>
          ))}
        </div>
      </div>

      <p className={styles.meta}>
        <span>
          {attack.damage.instances > 1 ? `${attack.damage.instances} × ` : ''}
          {attack.damage.dice}
          {attack.damageBonus !== 0 ? formatModifier(attack.damageBonus) : ''}{' '}
          {DAMAGE_TYPE_LABEL[attack.damage.type]}
        </span>
        <span>{attack.range}</span>
      </p>

      {attack.notes ? <p className={styles.notes}>{attack.notes}</p> : null}

      <div className={styles.actions}>
        <Button
          variant={attack.hasAdvantage ? 'chaos' : 'solid'}
          size="small"
          onClick={() => attackWith(attack.hasAdvantage ? 'advantage' : 'normal')}
        >
          Atacar
        </Button>
        {!attack.hasAdvantage ? (
          <Button variant="chaos" size="small" onClick={() => attackWith('advantage')}>
            Con ventaja
          </Button>
        ) : (
          <Button size="small" onClick={() => attackWith('normal')}>
            Sin ventaja
          </Button>
        )}
        <Button size="small" onClick={() => attackWith('disadvantage')}>
          Con desventaja
        </Button>
        <Button
          variant="hot"
          size="small"
          onClick={() => {
            const roll = rollDamage(`Daño · ${attack.name}`, attack.damage, damageOptions)
            setRollSequence((value) => value + 1)
            setResult({
              kind: 'damage',
              headline: roll.total,
              detail: `${roll.notation} de ${DAMAGE_TYPE_LABEL[roll.type]}${
                roll.instances.length > 1
                  ? ` · ${roll.instances.map((instance) => instance.total).join(' · ')}`
                  : ''
              }`,
            })
          }}
        >
          Daño
        </Button>
      </div>

      {result ? (
        <p className={styles.result}>
          <span
            key={rollSequence}
            className={[
              styles.total,
              'landing',
              result.outcome === 'critical' ? styles.critical : undefined,
              result.outcome === 'fumble' ? styles.fumble : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {result.headline}
          </span>
          <span>{result.detail}</span>
          {result.outcome === 'critical' ? (
            <span className={styles.critical}>¡20 natural!</span>
          ) : null}
          {result.outcome === 'fumble' ? <span className={styles.fumble}>1 natural</span> : null}
        </p>
      ) : null}
    </article>
  )
}
