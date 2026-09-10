import { useState } from 'react'
import type { CSSProperties } from 'react'
import { ABILITY_LABEL, ABILITY_SHORT_LABEL, SKILL_LABEL } from '@/content/labels'
import {
  abilityModifierOf,
  carryingCapacity,
  isSavingThrowProficient,
  passiveSkillScore,
  pushDragLiftCapacity,
  savingThrowModifier,
  skillModifier,
  totalCarriedWeight,
} from '@/domain/character/derived'
import type { Currency } from '@/domain/character/types'
import { ABILITY_IDS, SKILL_ABILITY, SKILL_IDS } from '@/domain/character/types'
import { formatModifier } from '@/domain/dice/dice'
import type { D20RollResult } from '@/domain/dice/dice'
import { Card, Grid, Section, StatTile } from '@/shared/components/Surfaces'
import { useActiveCharacter, useCombatStats } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './Sheet.module.css'

const CURRENCY: { key: keyof Currency; label: string }[] = [
  { key: 'platinum', label: 'PPT' },
  { key: 'gold', label: 'PO' },
  { key: 'electrum', label: 'PE' },
  { key: 'silver', label: 'PP' },
  { key: 'copper', label: 'PC' },
]

interface RollReadout {
  label: string
  result: D20RollResult
  /** Increments per roll so the readout replays its landing animation. */
  sequence: number
}

/** The full character sheet: scores, skills, features, gear and money. */
export function SheetView() {
  const character = useActiveCharacter()
  const stats = useCombatStats()
  const rollCheck = useCampaignStore((state) => state.rollCheck)

  const [lastRoll, setLastRoll] = useState<RollReadout | null>(null)

  const roll = (label: string, modifier: number) => {
    setLastRoll((previous) => ({
      label,
      result: rollCheck(label, modifier, 'normal'),
      sequence: (previous?.sequence ?? 0) + 1,
    }))
  }

  const carried = totalCarriedWeight(character)
  const sortedSkills = [...SKILL_IDS].sort((left, right) =>
    SKILL_LABEL[left].localeCompare(SKILL_LABEL[right], 'es'),
  )

  return (
    <>
      <Section heading="Características" lede="Toca cualquier fila para tirarla.">
        <div className={styles.abilityGrid}>
          {ABILITY_IDS.map((ability, index) => (
            <div
              key={ability}
              className={styles.ability}
              style={{ '--stagger-index': index } as CSSProperties}
            >
              <span className={styles.abilityName}>{ABILITY_LABEL[ability]}</span>
              <span className={styles.abilityModifier}>
                {formatModifier(abilityModifierOf(character, ability))}
              </span>
              <span className={styles.abilityScore}>{character.abilities[ability]}</span>
            </div>
          ))}
        </div>

        <Grid>
          <div className={styles.panel}>
            <h3 className={styles.panelHeading}>Tiradas de salvación</h3>
            <div className={styles.saveGrid}>
              {ABILITY_IDS.map((ability) => {
                const proficient = isSavingThrowProficient(character, ability)
                const modifier = savingThrowModifier(character, ability)

                return (
                  <button
                    key={ability}
                    type="button"
                    className={[styles.row, proficient ? styles.rowProficient : undefined]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => roll(`Salvación de ${ABILITY_LABEL[ability]}`, modifier)}
                  >
                    <span
                      className={[styles.dot, proficient ? styles.dotFilled : undefined]
                        .filter(Boolean)
                        .join(' ')}
                    />
                    <span className={styles.rowName}>{ABILITY_SHORT_LABEL[ability]}</span>
                    <span className={styles.rowValue}>{formatModifier(modifier)}</span>
                  </button>
                )
              })}
            </div>

            <h4 className={styles.subHeading}>Puntuaciones pasivas</h4>
            <div className={styles.passiveRow}>
              <PassiveScore label="Percepción" value={passiveSkillScore(character, 'perception')} />
              <PassiveScore label="Perspicacia" value={passiveSkillScore(character, 'insight')} />
              <PassiveScore
                label="Investigación"
                value={passiveSkillScore(character, 'investigation')}
              />
            </div>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.panelHeading}>Habilidades</h3>
            <div className={styles.skillGrid}>
              {sortedSkills.map((skill) => {
                const proficiency = character.skillProficiencies[skill] ?? 'none'
                const modifier = skillModifier(character, skill)

                return (
                  <button
                    key={skill}
                    type="button"
                    className={[
                      styles.row,
                      proficiency !== 'none' ? styles.rowProficient : undefined,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => roll(SKILL_LABEL[skill], modifier)}
                  >
                    <span
                      className={[
                        styles.dot,
                        proficiency === 'proficient' ? styles.dotFilled : undefined,
                        proficiency === 'expertise' ? styles.dotExpertise : undefined,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                    <span className={styles.rowAbility}>
                      {ABILITY_SHORT_LABEL[SKILL_ABILITY[skill]]}
                    </span>
                    <span className={styles.rowName}>{SKILL_LABEL[skill]}</span>
                    <span className={styles.rowValue}>{formatModifier(modifier)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </Grid>

        <p className={styles.rollResult} aria-live="polite">
          {lastRoll ? (
            <>
              <span
                key={lastRoll.sequence}
                className={[
                  styles.rollTotal,
                  'landing',
                  lastRoll.result.isCriticalHit ? styles.critical : undefined,
                  lastRoll.result.isCriticalMiss ? styles.fumble : undefined,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {lastRoll.result.total}
              </span>
              <span>
                <strong>{lastRoll.label}</strong> · d20 {lastRoll.result.natural}{' '}
                {formatModifier(lastRoll.result.modifier)}
              </span>
              {lastRoll.result.isCriticalHit ? (
                <span className={styles.critical}>¡20 natural!</span>
              ) : null}
              {lastRoll.result.isCriticalMiss ? (
                <span className={styles.fumble}>1 natural</span>
              ) : null}
            </>
          ) : (
            'Ninguna tirada todavía.'
          )}
        </p>
      </Section>

      <Section heading="Resumen">
        <Grid density="narrow">
          <StatTile
            label="Armadura"
            value={stats.armorClass}
            hint={
              stats.armorClass !== stats.baseArmorClass ? `Base ${stats.baseArmorClass}` : undefined
            }
            accent={stats.armorClass !== stats.baseArmorClass ? 'surge' : 'none'}
          />
          <StatTile label="Iniciativa" value={formatModifier(stats.initiative)} />
          <StatTile label="Velocidad" value={character.speed} unit="pies" />
          <StatTile label="Competencia" value={formatModifier(character.proficiencyBonus)} />
          <StatTile label="Concentración" value={formatModifier(stats.concentration)} />
          <StatTile
            label="Dados de golpe"
            value={`${character.hitDice.count}d${character.hitDice.sides}`}
          />
        </Grid>
      </Section>

      <Section heading="Rasgos y dotes">
        <Grid>
          {character.features.map((feature, index) => (
            <div key={feature.id} style={{ '--stagger-index': index } as CSSProperties}>
              <Card className="stagger">
                <p className={styles.featureName}>
                  {feature.name}
                  <span className={styles.featureSource}>{feature.source}</span>
                </p>
                <p className={styles.featureBody}>{feature.description}</p>
              </Card>
            </div>
          ))}
        </Grid>
      </Section>

      <Section heading="Equipo y recursos">
        <Grid>
          <Card title="Inventario">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Objeto</th>
                  <th scope="col" className={styles.numeric}>
                    Cant.
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Peso
                  </th>
                </tr>
              </thead>
              <tbody>
                {character.equipment.map((item) => (
                  <tr key={item.name}>
                    <td>
                      {item.name}
                      {item.notes ? ` · ${item.notes}` : ''}
                    </td>
                    <td className={styles.numeric}>{item.quantity}</td>
                    <td className={styles.numeric}>
                      {Math.round(item.quantity * item.weight * 10) / 10} lb
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className={styles.featureBody}>
              Cargas {Math.round(carried * 10) / 10} lb. Sobrecargado a{' '}
              {carryingCapacity(character)} lb. Empujar, arrastrar o levantar hasta{' '}
              {pushDragLiftCapacity(character)} lb.
            </p>
          </Card>

          <Card title="Monedas, idiomas y competencias">
            <div className={styles.currency}>
              {CURRENCY.map(({ key, label }) => (
                <span key={label} className={styles.coin}>
                  {label} <span className={styles.coinValue}>{character.currency[key]}</span>
                </span>
              ))}
            </div>

            <p className={styles.inlineList}>
              <strong>Idiomas.</strong> {character.languages.join(' · ')}
              <br />
              <strong>Armaduras.</strong> {character.proficiencies.armor.join(', ')}
              <br />
              <strong>Armas.</strong> {character.proficiencies.weapons.join(', ')}
              <br />
              <strong>Herramientas.</strong> {character.proficiencies.tools.join(', ')}
            </p>

            {character.notes && character.notes.length > 0 ? (
              <ul className={styles.inlineList} style={{ marginTop: 'var(--space-3)' }}>
                {character.notes.map((note) => (
                  <li key={note}>· {note}</li>
                ))}
              </ul>
            ) : null}
          </Card>
        </Grid>
      </Section>
    </>
  )
}

function PassiveScore({ label, value }: { label: string; value: number }) {
  return (
    <span className={styles.passive}>
      <span className={styles.passiveValue}>{value}</span>
      <span className={styles.passiveLabel}>{label}</span>
    </span>
  )
}
