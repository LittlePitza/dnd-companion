import { Grid, Section } from '@/shared/components/Surfaces'
import { RollLog } from '@/features/log/RollLog'
import { EffectToggles } from './EffectToggles'
import { HitPointTracker } from './HitPointTracker'
import { ResourceTracker } from './ResourceTracker'
import { RestPanel } from './RestPanel'
import { TurnPlanner } from './TurnPlanner'
import { TurnTracker } from './TurnTracker'
import { WildMagicPanel } from './WildMagicPanel'

/** The table-side console: what to do, what it costs, and what is left. */
export function CombatView({ onSurge }: { onSurge: () => void }) {
  return (
    <>
      <Section
        heading="¿Qué hago este turno?"
        lede="Toca tu situación y te doy la secuencia exacta, ya comprobada contra las reglas de 2024."
      >
        <TurnPlanner />
      </Section>

      <Section heading="Estado">
        <Grid>
          <HitPointTracker />
          <TurnTracker />
        </Grid>
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

      <Section heading="Descanso y bitácora">
        <Grid>
          <RestPanel />
          <RollLog />
        </Grid>
      </Section>
    </>
  )
}
