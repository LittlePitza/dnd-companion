import { canClaimShortRestBenefit } from '@/domain/session/rest'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Surfaces'
import { useActiveCharacter, useSession } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './Combat.module.css'

/** Short and long rests, plus any benefit a short rest can buy. */
export function RestPanel() {
  const character = useActiveCharacter()
  const session = useSession()
  const takeShortRest = useCampaignStore((state) => state.takeShortRest)
  const takeLongRest = useCampaignStore((state) => state.takeLongRest)
  const claimBenefit = useCampaignStore((state) => state.claimBenefit)

  return (
    <Card title="Descansos">
      <div className={styles.row}>
        <Button onClick={takeShortRest}>Descanso corto</Button>
        <Button variant="solid" onClick={takeLongRest}>
          Descanso largo
        </Button>
      </div>

      {character.shortRestBenefits.length > 0 ? (
        <div className={styles.row} style={{ marginTop: 'var(--space-3)' }}>
          {character.shortRestBenefits.map((benefit) => {
            const available = canClaimShortRestBenefit(session, benefit)
            return (
              <Button
                key={benefit.id}
                variant="chaos"
                size="small"
                disabled={!available}
                title={benefit.description}
                onClick={() => claimBenefit(benefit.id)}
              >
                {available ? benefit.name : `${benefit.name} · usado`}
              </Button>
            )
          })}
        </div>
      ) : null}

      <p className={styles.note}>
        El descanso largo restaura todo y borra los espacios creados con Fuente de Magia. Recuperas
        la mitad de tus dados de golpe, redondeando hacia abajo.
      </p>
    </Card>
  )
}
