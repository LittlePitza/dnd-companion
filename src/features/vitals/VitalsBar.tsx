import { SORCERY_POINT_RESOURCE_ID } from '@/domain/session/casting'
import { vitalStatus } from '@/domain/session/hitPoints'
import { availableSlotLevels } from '@/domain/character/derived'
import { slotsAvailableAt } from '@/domain/session/session'
import { useActiveCharacter, useCombatStats, useSession } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './VitalsBar.module.css'

const STATUS_CLASS: Record<string, string | undefined> = {
  bloodied: styles.bloodied,
  critical: styles.critical,
  down: styles.down,
  dead: styles.down,
}

/**
 * The always-visible strip of numbers a player glances at mid-combat: hit
 * points, Armour Class, remaining slots, sorcery points and what the current
 * turn has already spent.
 */
export function VitalsBar() {
  const character = useActiveCharacter()
  const session = useSession()
  const stats = useCombatStats()
  const endTurn = useCampaignStore((state) => state.endTurn)

  const status = vitalStatus(session, character)
  const slotLevels = availableSlotLevels(character)
  const sorceryPoints = session.resourcesRemaining[SORCERY_POINT_RESOURCE_ID]

  const turnFlags = [
    { label: 'acción', used: session.turn.actionUsed },
    { label: 'acción adicional', used: session.turn.bonusActionUsed },
    { label: 'reacción', used: session.turn.reactionUsed },
    { label: 'espacio de conjuro', used: session.turn.slotSpentThisTurn },
  ]

  return (
    <div className={styles.bar}>
      <span className={[styles.cell, STATUS_CLASS[status]].filter(Boolean).join(' ')}>
        PG{' '}
        <b className={styles.value}>
          {session.currentHitPoints}
          {session.temporaryHitPoints > 0 ? `+${session.temporaryHitPoints}` : ''}
        </b>
        / {character.maxHitPoints}
      </span>

      <span className={styles.cell}>
        CA <b className={styles.value}>{stats.armorClass}</b>
      </span>

      {slotLevels.length > 0 ? (
        <span className={styles.cell}>
          Esp{' '}
          <b className={styles.value}>
            {slotLevels.map((level) => slotsAvailableAt(session, level)).join('·')}
          </b>
        </span>
      ) : null}

      {sorceryPoints !== undefined ? (
        <span className={styles.cell}>
          PH <b className={styles.value}>{sorceryPoints}</b>
        </span>
      ) : null}

      {stats.spellSaveDc !== null ? (
        <span className={styles.cell}>
          CD <b className={styles.value}>{stats.spellSaveDc}</b>
        </span>
      ) : null}

      <span className={[styles.cell, styles.turnCell].join(' ')}>
        <span>Turno</span>
        <span className={styles.dots}>
          {turnFlags.map((flag) => (
            <span
              key={flag.label}
              className={[styles.dot, flag.used ? styles.dotUsed : undefined]
                .filter(Boolean)
                .join(' ')}
              title={`${flag.label}: ${flag.used ? 'usada' : 'disponible'}`}
            />
          ))}
        </span>
      </span>

      <button type="button" className={styles.endTurn} onClick={endTurn}>
        Terminar turno
      </button>
    </div>
  )
}
