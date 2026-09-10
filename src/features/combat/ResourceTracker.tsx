import { availableSlotLevels } from '@/domain/character/derived'
import type { SlotLevel } from '@/domain/character/types'
import { SORCERY_POINT_RESOURCE_ID } from '@/domain/session/casting'
import { SLOT_CREATION_COST } from '@/domain/turn/actionEconomy'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Surfaces'
import { PipBank } from '@/shared/components/PipBank'
import type { PipAccent } from '@/shared/components/PipBank'
import { useActiveCharacter, useSession } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './Combat.module.css'

const RESOURCE_ACCENT: Record<string, PipAccent> = {
  'sorcery-points': 'surge',
  'innate-sorcery': 'ember',
  'heroic-inspiration': 'verdigris',
}

/**
 * Spell slots, sorcery points and every other limited use, plus the two Font of
 * Magic trades that convert between them.
 */
export function ResourceTracker() {
  const character = useActiveCharacter()
  const session = useSession()
  // Aliased: a local binding named `useSlot` would read as a React Hook call inside `setSlots`.
  const spendSlot = useCampaignStore((state) => state.useSlot)
  const refundSlot = useCampaignStore((state) => state.refundSlot)
  const adjustResourceBy = useCampaignStore((state) => state.adjustResourceBy)
  const convertSlot = useCampaignStore((state) => state.convertSlot)
  const conjureSlot = useCampaignStore((state) => state.conjureSlot)

  const slotLevels = availableSlotLevels(character)
  const sorceryPoints = session.resourcesRemaining[SORCERY_POINT_RESOURCE_ID] ?? 0
  const hasSorceryPoints = character.resources.some(
    (resource) => resource.id === SORCERY_POINT_RESOURCE_ID,
  )

  const setSlots = (level: SlotLevel, next: number) => {
    const current = session.slotsRemaining[level] ?? 0
    const delta = next - current
    for (let step = 0; step < Math.abs(delta); step += 1) {
      if (delta < 0) spendSlot(level)
      else refundSlot(level)
    }
  }

  return (
    <div className={styles.resourceStack}>
      {slotLevels.length > 0 ? (
        <Card title="Espacios de conjuro">
          <div className={styles.resourceStack}>
            {slotLevels.map((level) => (
              <PipBank
                key={level}
                label={`Nivel ${level}`}
                value={session.slotsRemaining[level] ?? 0}
                max={character.spellcasting?.slots[level] ?? 0}
                bonus={session.conjuredSlots[level] ?? 0}
                onChange={(next) => setSlots(level, next)}
              />
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="Rasgos y usos">
        <div className={styles.resourceStack}>
          {character.resources.map((resource) => (
            <PipBank
              key={resource.id}
              label={resource.shortName}
              value={session.resourcesRemaining[resource.id] ?? 0}
              max={resource.max}
              accent={RESOURCE_ACCENT[resource.id] ?? 'bone'}
              onChange={(next) =>
                adjustResourceBy(resource.id, next - (session.resourcesRemaining[resource.id] ?? 0))
              }
            />
          ))}
        </div>
      </Card>

      {hasSorceryPoints && slotLevels.length > 0 ? (
        <Card title="Fuente de Magia">
          <p className={styles.note}>
            Convertir un espacio en puntos no gasta acción. Crear un espacio cuesta tu acción
            adicional y desaparece al terminar el descanso largo.
          </p>

          <p className={styles.wildMagicHeadline} style={{ marginTop: 'var(--space-3)' }}>
            Espacio → puntos
          </p>
          <div className={styles.row}>
            {slotLevels.map((level) => (
              <Button
                key={`convert-${level}`}
                variant="chaos"
                size="small"
                disabled={(session.slotsRemaining[level] ?? 0) < 1}
                onClick={() => convertSlot(level)}
              >
                Nivel {level} → +{level} PH
              </Button>
            ))}
          </div>

          <p className={styles.wildMagicHeadline} style={{ marginTop: 'var(--space-4)' }}>
            Puntos → espacio
          </p>
          <div className={styles.row}>
            {slotLevels.map((level) => {
              const cost = SLOT_CREATION_COST[level]
              if (cost === undefined) return null
              return (
                <Button
                  key={`create-${level}`}
                  variant="chaos"
                  size="small"
                  disabled={sorceryPoints < cost || session.turn.bonusActionUsed}
                  onClick={() => conjureSlot(level)}
                >
                  {cost} PH → nivel {level}
                </Button>
              )
            })}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
