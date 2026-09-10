import { useState } from 'react'
import { ABILITY_LABEL, SKILL_LABEL } from '@/content/labels'
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
import type { AbilityId, Currency, SkillId } from '@/domain/character/types'
import { ABILITY_IDS, SKILL_IDS } from '@/domain/character/types'
import { formatModifier } from '@/domain/dice/dice'
import type { D20RollResult } from '@/domain/dice/dice'
import { Card, Eyebrow, Grid, Section, StatTile } from '@/shared/components/Surfaces'
import { useActiveCharacter, useCombatStats } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './Sheet.module.css'

/** Coin abbreviations, biggest coin first. Keyed off `Currency`, never a loose string. */
const CURRENCY_LABELS: readonly (readonly [keyof Currency, string])[] = [
  ['platinum', 'PPT'],
  ['gold', 'PO'],
  ['electrum', 'PE'],
  ['silver', 'PP'],
  ['copper', 'PC'],
]

/** The full character sheet: scores, skills, features, gear and money. */
export function SheetView() {
  const character = useActiveCharacter()
  const stats = useCombatStats()
  const rollCheck = useCampaignStore((state) => state.rollCheck)

  const [lastRoll, setLastRoll] = useState<{ label: string; result: D20RollResult } | null>(null)

  const roll = (label: string, modifier: number) => {
    setLastRoll({ label, result: rollCheck(label, modifier, 'normal') })
  }

  const carried = totalCarriedWeight(character)

  return (
    <>
      <Section heading="Resumen">
        <Grid density="narrow">
          <StatTile
            label="Clase de armadura"
            value={stats.armorClass}
            hint={
              stats.armorClass !== stats.baseArmorClass ? `Base ${stats.baseArmorClass}` : undefined
            }
            accent={stats.armorClass !== stats.baseArmorClass ? 'surge' : 'none'}
          />
          <StatTile label="Iniciativa" value={formatModifier(stats.initiative)} />
          <StatTile label="Velocidad" value={`${character.speed} pies`} />
          <StatTile label="Competencia" value={formatModifier(character.proficiencyBonus)} />
          <StatTile
            label="Percepción pasiva"
            value={passiveSkillScore(character, 'perception')}
            hint={`Perspicacia ${passiveSkillScore(character, 'insight')} · Investigación ${passiveSkillScore(character, 'investigation')}`}
          />
          <StatTile
            label="Dados de golpe"
            value={`${character.hitDice.count}d${character.hitDice.sides}`}
          />
        </Grid>
      </Section>

      <Section
        heading="Características y salvaciones"
        lede="Toca una salvación o una habilidad para tirarla."
      >
        <div className={styles.abilityGrid}>
          {ABILITY_IDS.map((ability) => (
            <AbilityCard key={ability} ability={ability} onRoll={roll} />
          ))}
        </div>

        <Eyebrow>Habilidades</Eyebrow>
        <div className={styles.skillGrid}>
          {[...SKILL_IDS]
            .sort((left, right) => skillModifier(character, right) - skillModifier(character, left))
            .map((skill) => (
              <SkillButton key={skill} skill={skill} onRoll={roll} />
            ))}
        </div>

        <p className={styles.rollResult} aria-live="polite">
          {lastRoll ? (
            <>
              <span
                className={[
                  styles.rollTotal,
                  lastRoll.result.isCriticalHit ? styles.critical : undefined,
                  lastRoll.result.isCriticalMiss ? styles.fumble : undefined,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {lastRoll.result.total}
              </span>
              <span>
                {lastRoll.label} · d20 {lastRoll.result.natural}{' '}
                {formatModifier(lastRoll.result.modifier)}
              </span>
              {lastRoll.result.isCriticalHit ? (
                <span className={styles.critical}>¡20 natural!</span>
              ) : null}
              {lastRoll.result.isCriticalMiss ? (
                <span className={styles.fumble}>1 natural</span>
              ) : null}
            </>
          ) : null}
        </p>
      </Section>

      <Section heading="Rasgos y dotes">
        <Grid>
          {character.features.map((feature) => (
            <Card key={feature.id}>
              <p className={styles.featureName}>
                {feature.name}
                <span className={styles.featureSource}>{feature.source}</span>
              </p>
              <p className={styles.featureBody}>{feature.description}</p>
            </Card>
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
            <p className={styles.currency}>
              {CURRENCY_LABELS.map(([key, label]) => (
                <span key={key}>
                  {label} <span className={styles.currencyValue}>{character.currency[key]}</span>
                </span>
              ))}
            </p>

            <Eyebrow>Idiomas</Eyebrow>
            <p className={styles.inlineList}>{character.languages.join(' · ')}</p>

            <Eyebrow>Competencias</Eyebrow>
            <p className={styles.inlineList}>
              Armaduras: {character.proficiencies.armor.join(', ')}
              <br />
              Armas: {character.proficiencies.weapons.join(', ')}
              <br />
              Herramientas: {character.proficiencies.tools.join(', ')}
            </p>

            {character.notes && character.notes.length > 0 ? (
              <>
                <Eyebrow>Notas de la hoja</Eyebrow>
                <ul className={styles.inlineList}>
                  {character.notes.map((note) => (
                    <li key={note}>· {note}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
        </Grid>
      </Section>
    </>
  )
}

function AbilityCard({
  ability,
  onRoll,
}: {
  ability: AbilityId
  onRoll: (label: string, modifier: number) => void
}) {
  const character = useActiveCharacter()
  const modifier = abilityModifierOf(character, ability)
  const save = savingThrowModifier(character, ability)
  const proficient = isSavingThrowProficient(character, ability)

  return (
    <div className={styles.ability}>
      <p className={styles.abilityName}>{ABILITY_LABEL[ability]}</p>
      <p className={styles.abilityScore}>
        {character.abilities[ability]}
        <span className={styles.abilityModifier}>{formatModifier(modifier)}</span>
      </p>
      <button
        type="button"
        className={[styles.skill, proficient ? styles.skillProficient : undefined]
          .filter(Boolean)
          .join(' ')}
        style={{ marginTop: 'var(--space-2)', width: '100%' }}
        onClick={() => onRoll(`Salvación de ${ABILITY_LABEL[ability]}`, save)}
      >
        <span>Salvación</span>
        <span className={styles.skillValue}>{formatModifier(save)}</span>
      </button>
    </div>
  )
}

function SkillButton({
  skill,
  onRoll,
}: {
  skill: SkillId
  onRoll: (label: string, modifier: number) => void
}) {
  const character = useActiveCharacter()
  const modifier = skillModifier(character, skill)
  const proficient = (character.skillProficiencies[skill] ?? 'none') !== 'none'

  return (
    <button
      type="button"
      className={[styles.skill, proficient ? styles.skillProficient : undefined]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onRoll(SKILL_LABEL[skill], modifier)}
    >
      <span>{SKILL_LABEL[skill]}</span>
      <span className={styles.skillValue}>{formatModifier(modifier)}</span>
    </button>
  )
}
