import type { TurnSlotKey } from '@/store/useCampaignStore'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Surfaces'
import { useSession } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './Combat.module.css'

const TURN_FLAGS: { key: TurnSlotKey; label: string }[] = [
  { key: 'actionUsed', label: 'Acción' },
  { key: 'bonusActionUsed', label: 'Acción adicional' },
  { key: 'reactionUsed', label: 'Reacción' },
]

/**
 * The action economy, editable by hand. Casting updates it automatically, but
 * the player still needs to mark an Attack, a Dash or a Dodge.
 */
export function TurnTracker() {
  const session = useSession()
  const toggleTurnFlag = useCampaignStore((state) => state.toggleTurnFlag)
  const endTurn = useCampaignStore((state) => state.endTurn)

  const spent: string[] = []
  if (session.turn.actionUsed) spent.push('acción usada')
  if (session.turn.bonusActionUsed) spent.push('acción adicional usada')
  if (session.turn.reactionUsed) spent.push('reacción usada')
  if (session.turn.slotSpentThisTurn) spent.push('espacio gastado')
  if (session.turn.quickenedThisTurn) spent.push('aceleraste: nada de nivel 1+')

  return (
    <Card title="Este turno">
      <div className={styles.row}>
        {TURN_FLAGS.map((flag) => (
          <Button
            key={flag.key}
            size="small"
            aria-pressed={session.turn[flag.key]}
            onClick={() => toggleTurnFlag(flag.key)}
          >
            {flag.label}
          </Button>
        ))}
        <Button variant="solid" size="small" onClick={endTurn}>
          Terminar turno
        </Button>
      </div>

      <p className={styles.note}>
        {spent.length > 0
          ? `Este turno: ${spent.join(' · ')}.`
          : 'Turno limpio. Puedes hacerlo todo.'}
      </p>
    </Card>
  )
}
