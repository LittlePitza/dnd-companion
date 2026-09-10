import { useMemo, useState } from 'react'
import { SPELL_LEVEL_LABEL } from '@/content/labels'
import { formatModifier } from '@/domain/dice/dice'
import type { Spell, SpellLevel } from '@/domain/character/types'
import { Eyebrow, EmptyState, Grid, Section, StatTile } from '@/shared/components/Surfaces'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import type { Segment } from '@/shared/components/SegmentedControl'
import { useActiveCharacter, useCombatStats } from '@/store/selectors'
import { SpellRow } from './SpellRow'
import styles from './SpellsView.module.css'

/** `all` shows everything; otherwise the value is a spell level as a string. */
type LevelFilter = string

/** The spell list, grouped by level, with the rules engine behind every cast. */
export function SpellsView() {
  const character = useActiveCharacter()
  const stats = useCombatStats()
  const [filter, setFilter] = useState<LevelFilter>('all')

  const grouped = useMemo(() => groupByLevel(character.spells), [character.spells])

  const segments = useMemo<Segment<LevelFilter>[]>(
    () => [
      { value: 'all', label: 'Todos', count: character.spells.length },
      ...grouped.map(([level, spells]) => ({
        value: String(level),
        label: level === 0 ? 'Trucos' : `Nivel ${level}`,
        count: spells.length,
      })),
    ],
    [character.spells.length, grouped],
  )

  const visible = filter === 'all' ? grouped : grouped.filter(([level]) => String(level) === filter)

  if (!character.spellcasting) {
    return (
      <Section heading="Conjuros">
        <EmptyState icon="sparkles">Este personaje no lanza conjuros.</EmptyState>
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
          value={formatModifier(stats.spellAttackBonus ?? 0)}
          hint={stats.hasAdvantageOnClassSpellAttacks ? 'Con ventaja' : undefined}
          accent={stats.hasAdvantageOnClassSpellAttacks ? 'surge' : 'none'}
        />
        <StatTile label="Concentración" value={formatModifier(stats.concentration)} />
      </Grid>

      <div className={styles.filters}>
        <SegmentedControl
          label="Filtrar conjuros por nivel"
          segments={segments}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {visible.map(([level, spells]) => (
        <section key={level}>
          {filter === 'all' ? <Eyebrow>{SPELL_LEVEL_LABEL(level)}</Eyebrow> : null}
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
