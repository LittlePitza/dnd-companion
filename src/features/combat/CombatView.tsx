import { Grid, Section } from '@/shared/components/Surfaces'
import { RollLog } from '@/features/log/RollLog'
import { EffectToggles } from './EffectToggles'
import { HitPointTracker } from './HitPointTracker'
import { ResourceTracker } from './ResourceTracker'
import { RestPanel } from './RestPanel'
import { TurnPlanner } from './TurnPlanner'
import { TurnTracker } from './TurnTracker'
import { WildMagicPanel } from './WildMagicPanel'
import styles from './CombatView.module.css'

/** The table-side console: what to do, what it costs, and what is left. */
export function CombatView({ onSurge }: { onSurge: () => void }) {
  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <Section
          heading="¿Qué hago este turno?"
          lede="Toca tu situación y te doy la secuencia exacta, ya comprobada contra las reglas de 2024."
        >
          <TurnPlanner />
        </Section>

        <Section heading="Recursos">
          <ResourceTracker />
        </Section>

        <Section heading="Efectos y caos">
          <Grid>
            <EffectToggles />
            <WildMagicPanel onSurge={onSurge} />
          </Grid>
        </Section>
      </div>

      <aside className={styles.side} aria-label="Estado del personaje">
        <HitPointTracker />
        <TurnTracker />
        <RestPanel />
        <RollLog />
      </aside>
    </div>
  )
}
