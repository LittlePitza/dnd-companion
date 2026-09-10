import { useState } from 'react'
import { DEATH_SAVE_LIMIT } from '@/domain/session/types'
import { vitalStatus } from '@/domain/session/hitPoints'
import { Button } from '@/shared/components/Button'
import { Icon } from '@/shared/components/Icon'
import { useValueFlash } from '@/shared/hooks/useValueFlash'
import { useActiveCharacter, useSession } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './HitPointTracker.module.css'

const STEPS = [10, 5, 1]

const STATUS_CLASS: Record<string, string | undefined> = {
  bloodied: styles.bloodied,
  critical: styles.critical,
  down: styles.down,
  dead: styles.down,
}

/**
 * The control a player touches most. Damage and healing are two separate
 * segmented groups so the two directions cannot be confused mid-fight, with a
 * free-text field for the big hits and death saves once the character drops.
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
  const flash = useValueFlash(session.currentHitPoints)

  const status = vitalStatus(session, character)
  const isDown = session.currentHitPoints === 0
  const ratio = Math.max(0, session.currentHitPoints / character.maxHitPoints) * 100

  const parsed = Number.parseInt(amount, 10)
  const hasAmount = Number.isFinite(parsed) && parsed > 0

  const applyExact = (action: (value: number) => void) => {
    if (!hasAmount) return
    action(parsed)
    setAmount('')
  }

  return (
    <section className={[styles.panel, STATUS_CLASS[status]].filter(Boolean).join(' ')}>
      <h3 className={styles.heading}>
        <Icon name="heart" size={12} strokeWidth={2.5} /> Puntos de golpe
      </h3>

      <p className={styles.readout}>
        <span
          className={[
            styles.current,
            flash === 'down' ? styles.flashDown : undefined,
            flash === 'up' ? styles.flashUp : undefined,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-live="polite"
        >
          {session.currentHitPoints}
        </span>
        <span className={styles.max}>/ {character.maxHitPoints}</span>
        {session.temporaryHitPoints > 0 ? (
          <span className={styles.temp}>+{session.temporaryHitPoints} temp.</span>
        ) : null}
      </p>

      <div className={styles.track}>
        <span className={styles.fill} style={{ width: `${ratio}%` }} />
      </div>

      <div className={styles.steps}>
        <div className={[styles.group, styles.damageGroup].join(' ')}>
          {STEPS.map((step) => (
            <button
              key={`damage-${step}`}
              type="button"
              className={styles.step}
              aria-label={`Recibir ${step} de daño`}
              onClick={() => takeDamage(step)}
            >
              −{step}
            </button>
          ))}
        </div>

        <div className={[styles.group, styles.healGroup].join(' ')}>
          {[...STEPS].reverse().map((step) => (
            <button
              key={`heal-${step}`}
              type="button"
              className={styles.step}
              aria-label={`Curar ${step} puntos de golpe`}
              onClick={() => heal(step)}
            >
              +{step}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.exact}>
        <label className="visually-hidden" htmlFor="hp-amount">
          Cantidad exacta de puntos de golpe
        </label>
        <input
          id="hp-amount"
          className={styles.input}
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Button size="small" disabled={!hasAmount} onClick={() => applyExact(takeDamage)}>
          Daño
        </Button>
        <Button size="small" disabled={!hasAmount} onClick={() => applyExact(heal)}>
          Curar
        </Button>
        <Button size="small" disabled={!hasAmount} onClick={() => applyExact(grantTemporary)}>
          Temp.
        </Button>
        <Button
          variant="chaos"
          size="small"
          disabled={session.hitDiceRemaining < 1}
          onClick={useHitDie}
        >
          Dado {session.hitDiceRemaining}
        </Button>
      </div>

      {isDown ? (
        <div className={styles.deathSaves}>
          <p className={styles.deathRow}>
            Éxitos
            <span className={styles.deathDots}>
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
          </p>

          <p className={styles.deathRow}>
            Fallos
            <span className={styles.deathDots}>
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
          </p>

          <div className={styles.deathActions}>
            <Button size="small" onClick={() => markDeathSave('success')}>
              Éxito
            </Button>
            <Button variant="danger" size="small" onClick={() => markDeathSave('failure')}>
              Fallo
            </Button>
            <Button variant="chaos" size="small" onClick={() => markDeathSave('critical-success')}>
              20 nat.
            </Button>
            <Button variant="danger" size="small" onClick={() => markDeathSave('critical-failure')}>
              1 nat.
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
