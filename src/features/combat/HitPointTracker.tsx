import { useState } from 'react'
import { vitalStatus } from '@/domain/session/hitPoints'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Surfaces'
import { useActiveCharacter, useSession } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import { DEATH_SAVE_LIMIT } from '@/domain/session/types'
import styles from './Combat.module.css'

const QUICK_STEPS = [1, 5, 10]

const STATUS_CLASS: Record<string, string | undefined> = {
  bloodied: styles.bloodied,
  critical: styles.critical,
  down: styles.down,
  dead: styles.down,
}

/**
 * Hit point control: quick steps for the common cases, a free-text field for
 * the big hits, and death saves once the character is down.
 */
export function HitPointTracker() {
  const character = useActiveCharacter()
  const session = useSession()
  const takeDamage = useCampaignStore((state) => state.takeDamage)
  const heal = useCampaignStore((state) => state.heal)
  const grantTemporary = useCampaignStore((state) => state.grantTemporaryHitPoints)
  const markDeathSave = useCampaignStore((state) => state.markDeathSave)
  const useHitDie = useCampaignStore((state) => state.useHitDie)

  const [amount, setAmount] = useState('')
  const status = vitalStatus(session, character)
  const isDown = session.currentHitPoints === 0

  const parsedAmount = Number.parseInt(amount, 10)
  const hasAmount = Number.isFinite(parsedAmount) && parsedAmount > 0

  return (
    <Card title="Puntos de golpe">
      <p className={styles.hitPoints}>
        <span className={[styles.hitPointsValue, STATUS_CLASS[status]].filter(Boolean).join(' ')}>
          {session.currentHitPoints}
        </span>
        <span className={styles.hitPointsMax}>
          / {character.maxHitPoints}
          {session.temporaryHitPoints > 0 ? ` · ${session.temporaryHitPoints} temporales` : ''}
        </span>
      </p>

      <div className={styles.row}>
        {QUICK_STEPS.map((step) => (
          <Button
            key={`damage-${step}`}
            variant="hot"
            size="small"
            onClick={() => takeDamage(step)}
          >
            −{step}
          </Button>
        ))}
        {QUICK_STEPS.map((step) => (
          <Button key={`heal-${step}`} size="small" onClick={() => heal(step)}>
            +{step}
          </Button>
        ))}
      </div>

      <div className={styles.customDamage}>
        <label className="visually-hidden" htmlFor="hp-amount">
          Cantidad exacta de puntos de golpe
        </label>
        <input
          id="hp-amount"
          className={styles.numberInput}
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Button
          variant="hot"
          size="small"
          disabled={!hasAmount}
          onClick={() => {
            takeDamage(parsedAmount)
            setAmount('')
          }}
        >
          Daño
        </Button>
        <Button
          size="small"
          disabled={!hasAmount}
          onClick={() => {
            heal(parsedAmount)
            setAmount('')
          }}
        >
          Curar
        </Button>
        <Button
          size="small"
          disabled={!hasAmount}
          onClick={() => {
            grantTemporary(parsedAmount)
            setAmount('')
          }}
        >
          Temporales
        </Button>
        <Button
          variant="chaos"
          size="small"
          disabled={session.hitDiceRemaining < 1}
          onClick={useHitDie}
        >
          Dado de golpe ({session.hitDiceRemaining})
        </Button>
      </div>

      {isDown ? (
        <div className={styles.deathSaves}>
          <span className={styles.deathSaveGroup}>
            Éxitos
            {Array.from({ length: DEATH_SAVE_LIMIT }, (_, index) => (
              <span
                key={index}
                className={[
                  styles.deathDot,
                  index < session.deathSaves.successes ? styles.deathDotSuccess : undefined,
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
          </span>

          <span className={styles.deathSaveGroup}>
            Fallos
            {Array.from({ length: DEATH_SAVE_LIMIT }, (_, index) => (
              <span
                key={index}
                className={[
                  styles.deathDot,
                  index < session.deathSaves.failures ? styles.deathDotFailure : undefined,
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
          </span>

          <div className={styles.row}>
            <Button size="small" onClick={() => markDeathSave('success')}>
              Éxito
            </Button>
            <Button variant="hot" size="small" onClick={() => markDeathSave('failure')}>
              Fallo
            </Button>
            <Button variant="chaos" size="small" onClick={() => markDeathSave('critical-success')}>
              20 natural
            </Button>
            <Button variant="danger" size="small" onClick={() => markDeathSave('critical-failure')}>
              1 natural
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
