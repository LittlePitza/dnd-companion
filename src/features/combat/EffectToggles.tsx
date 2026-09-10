import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Surfaces'
import { useActiveCharacter, useSession } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './Combat.module.css'

/**
 * Buffs the player switches on and off. Toggling one recomputes Armour Class
 * and spell save DC everywhere, and spends the underlying resource when the
 * feature has one.
 */
export function EffectToggles() {
  const character = useActiveCharacter()
  const session = useSession()
  const toggleEffect = useCampaignStore((state) => state.toggleEffect)

  if (character.effects.length === 0) return null

  return (
    <Card title="Efectos activos">
      <div className={styles.effectList}>
        {character.effects.map((effect) => {
          const isActive = session.activeEffectIds.includes(effect.id)
          const usesLeft = effect.resourceId
            ? (session.resourcesRemaining[effect.resourceId] ?? 0)
            : null

          return (
            <div
              key={effect.id}
              className={[styles.effectRow, isActive ? styles.effectActive : undefined]
                .filter(Boolean)
                .join(' ')}
            >
              <div>
                <p className={styles.effectName}>{effect.name}</p>
                <p className={styles.effectDescription}>{effect.description}</p>
                <p className={styles.effectDuration}>
                  {effect.duration}
                  {usesLeft !== null ? ` · ${usesLeft} usos restantes` : ''}
                  {effect.costsBonusAction ? ' · acción adicional' : ''}
                </p>
              </div>

              <Button
                variant={isActive ? 'chaos' : 'default'}
                size="small"
                aria-pressed={isActive}
                disabled={!isActive && usesLeft !== null && usesLeft < 1}
                onClick={() => toggleEffect(effect.id)}
              >
                {isActive ? 'Activo' : 'Activar'}
              </Button>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
