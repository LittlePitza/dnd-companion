import type { LogTone } from '@/store/logEntry'
import { Button } from '@/shared/components/Button'
import { Card, EmptyState } from '@/shared/components/Surfaces'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './RollLog.module.css'

const TONE_CLASS: Record<LogTone, string | undefined> = {
  neutral: styles.neutral,
  good: styles.good,
  bad: styles.bad,
  chaos: styles.chaos,
  fire: styles.fire,
}

const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
})

/** Everything that happened this session, newest first. */
export function RollLog() {
  const log = useCampaignStore((state) => state.log)
  const clearLog = useCampaignStore((state) => state.clearLog)

  return (
    <Card title="Bitácora de la sesión">
      {log.length === 0 ? (
        <EmptyState>
          Aquí van tus tiradas, conjuros y oleadas. Se borra al cerrar la app.
        </EmptyState>
      ) : (
        <>
          <ul className={styles.list}>
            {log.map((entry) => (
              <li
                key={entry.id}
                className={[styles.entry, TONE_CLASS[entry.tone]].filter(Boolean).join(' ')}
              >
                {entry.value !== undefined ? (
                  <span className={styles.value}>{entry.value}</span>
                ) : null}
                <span className={styles.body}>
                  <span className={styles.title}>{entry.title}</span>
                  <br />
                  <span className={styles.detail}>{entry.detail}</span>
                </span>
                <span className={styles.time}>{timeFormatter.format(entry.at)}</span>
              </li>
            ))}
          </ul>

          <Button
            size="small"
            variant="ghost"
            onClick={clearLog}
            style={{ marginTop: 'var(--space-3)' }}
          >
            Limpiar bitácora
          </Button>
        </>
      )}
    </Card>
  )
}
