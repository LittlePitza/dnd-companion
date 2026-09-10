import { availableSlotLevels } from '@/domain/character/derived'
import { formatModifier } from '@/domain/dice/dice'
import { SORCERY_POINT_RESOURCE_ID } from '@/domain/session/casting'
import { vitalStatus } from '@/domain/session/hitPoints'
import { slotsAvailableAt } from '@/domain/session/session'
import { Icon } from '@/shared/components/Icon'
import type { IconName } from '@/shared/components/Icon'
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
 * The row a player glances at mid-combat: hit points with a depletion bar,
 * Armour Class, initiative, save DC, and what this turn has already spent.
 */
export function VitalsBar() {
  const character = useActiveCharacter()
  const session = useSession()
  const stats = useCombatStats()
  const endTurn = useCampaignStore((state) => state.endTurn)

  const status = vitalStatus(session, character)
  const slotLevels = availableSlotLevels(character)
  const sorceryPoints = session.resourcesRemaining[SORCERY_POINT_RESOURCE_ID]
  const hitPointRatio = Math.max(0, session.currentHitPoints / character.maxHitPoints) * 100

  const turnFlags = [
    { label: 'Acción', used: session.turn.actionUsed },
    { label: 'Acción adicional', used: session.turn.bonusActionUsed },
    { label: 'Reacción', used: session.turn.reactionUsed },
    { label: 'Espacio de conjuro', used: session.turn.slotSpentThisTurn },
  ]

  return (
    <div className={styles.bar}>
      <div
        className={[styles.pod, styles.hitPoints, STATUS_CLASS[status]].filter(Boolean).join(' ')}
      >
        <span className={styles.podLabel}>
          <Icon name="heart" size={11} strokeWidth={2.5} /> Puntos de golpe
        </span>
        <span className={styles.podValue}>
          {session.currentHitPoints}
          <span className={styles.podUnit}> / {character.maxHitPoints}</span>
          {session.temporaryHitPoints > 0 ? (
            <span className={styles.temp}> +{session.temporaryHitPoints}</span>
          ) : null}
        </span>
        <span className={styles.hpTrack}>
          <span className={styles.hpFill} style={{ width: `${hitPointRatio}%` }} />
        </span>
      </div>

      <Pod icon="shield" label="Armadura" value={stats.armorClass} accent="accent" />
      <Pod icon="zap" label="Iniciativa" value={formatModifier(stats.initiative)} />

      {stats.spellSaveDc !== null ? (
        <Pod icon="sparkles" label="CD salv." value={stats.spellSaveDc} accent="arcane" />
      ) : null}

      {stats.spellAttackBonus !== null ? (
        <Pod label="Ataque" value={formatModifier(stats.spellAttackBonus)} />
      ) : null}

      {slotLevels.length > 0 ? (
        <Pod
          label="Espacios"
          value={slotLevels.map((level) => slotsAvailableAt(session, level)).join(' · ')}
        />
      ) : null}

      {sorceryPoints !== undefined ? <Pod label="Puntos hech." value={sorceryPoints} /> : null}

      <div className={styles.turn}>
        <span className={styles.dots} role="img" aria-label="Recursos gastados este turno">
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

        <button type="button" className={styles.endTurn} onClick={endTurn}>
          Terminar turno
        </button>
      </div>
    </div>
  )
}

function Pod({
  icon,
  label,
  value,
  accent,
}: {
  icon?: IconName
  label: string
  value: string | number
  accent?: 'accent' | 'arcane'
}) {
  const accentClass =
    accent === 'accent' ? styles.accented : accent === 'arcane' ? styles.arcane : undefined

  return (
    <div className={[styles.pod, accentClass].filter(Boolean).join(' ')}>
      <span className={styles.podLabel}>
        {icon ? <Icon name={icon} size={11} strokeWidth={2.5} /> : null} {label}
      </span>
      <span className={styles.podValue}>{value}</span>
    </div>
  )
}
