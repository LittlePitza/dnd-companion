import { useMemo } from 'react'
import { SPELL_LEVEL_LABEL } from '@/content/labels'
import type { Spell, SpellLevel } from '@/domain/character/types'
import { Eyebrow, Grid, Section, StatTile } from '@/shared/components/Surfaces'
import { useActiveCharacter, useCombatStats } from '@/store/selectors'
import { SpellRow } from './SpellRow'

/** The spell list, grouped by level, with the rules engine behind every cast. */
export function SpellsView() {
  const character = useActiveCharacter()
  const stats = useCombatStats()

  const grouped = useMemo(() => groupByLevel(character.spells), [character.spells])

  if (!character.spellcasting) {
    return (
      <Section heading="Conjuros" lede="Este personaje no lanza conjuros.">
        <span />
      </Section>
    )
  }

  return (
    <Section
      heading="Conjuros"
      lede="Lanzar desde aquí gasta el espacio, cobra la metamagia y comprueba la economía de acciones. Si la jugada es ilegal, te dice por qué."
    >
      <Grid density="narrow">
        <StatTile
          label="CD de salvación"
          value={stats.spellSaveDc}
          hint={
            stats.spellSaveDc !== stats.baseSpellSaveDc
              ? `Base ${stats.baseSpellSaveDc}`
              : undefined
          }
          accent={stats.spellSaveDc !== stats.baseSpellSaveDc ? 'surge' : 'none'}
        />
        <StatTile
          label="Ataque de conjuro"
          value={`+${stats.spellAttackBonus}`}
          hint={stats.hasAdvantageOnClassSpellAttacks ? 'Con ventaja' : undefined}
          accent={stats.hasAdvantageOnClassSpellAttacks ? 'surge' : 'none'}
        />
        <StatTile label="Concentración" value={`+${stats.concentration}`} />
      </Grid>

      {grouped.map(([level, spells]) => (
        <section key={level}>
          <Eyebrow>{SPELL_LEVEL_LABEL(level)}</Eyebrow>
          {spells.map((spell) => (
            <SpellRow key={spell.id} spell={spell} />
          ))}
        </section>
      ))}
    </Section>
  )
}

/** Groups spells by level, ascending, preserving the order within each level. */
function groupByLevel(spells: readonly Spell[]): [SpellLevel, Spell[]][] {
  const buckets = new Map<SpellLevel, Spell[]>()

  for (const spell of spells) {
    const bucket = buckets.get(spell.level)
    if (bucket) bucket.push(spell)
    else buckets.set(spell.level, [spell])
  }

  return [...buckets.entries()].sort(([left], [right]) => left - right)
}
