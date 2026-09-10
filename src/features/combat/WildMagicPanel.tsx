import { useState } from 'react'
import type { SurgeCheckResult } from '@/domain/wildmagic/surge'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Surfaces'
import { useSession } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import { useMemoriesStore } from '@/store/useMemoriesStore'
import styles from './Combat.module.css'

/**
 * Wild Magic Surge: the d20 check, Tides of Chaos, and a shortcut to record the
 * result as a campaign memory before the table forgets what happened.
 */
export function WildMagicPanel({ onSurge }: { onSurge: () => void }) {
  const session = useSession()
  const rollSurge = useCampaignStore((state) => state.rollSurge)
  const useTidesOfChaos = useCampaignStore((state) => state.useTidesOfChaos)
  const addMemory = useMemoriesStore((state) => state.addMemory)

  const [lastResult, setLastResult] = useState<SurgeCheckResult | null>(null)
  const [saved, setSaved] = useState(false)

  const { tidesOfChaosAvailable, surgePending } = session.wildMagic

  return (
    <Card title="Magia salvaje">
      <div className={styles.wildMagic}>
        <button
          type="button"
          className={[styles.die, lastResult?.triggered ? styles.dieHit : undefined]
            .filter(Boolean)
            .join(' ')}
          aria-label="Tirar el d20 de Oleada de Magia Salvaje"
          onClick={() => {
            const result = rollSurge()
            setLastResult(result)
            setSaved(false)
            if (result.triggered) onSurge()
          }}
        >
          {lastResult === null ? 'd20' : lastResult.automatic ? '★' : lastResult.d20}
        </button>

        <div className={styles.wildMagicBody}>
          <p
            className={[
              styles.wildMagicHeadline,
              lastResult?.triggered ? styles.wildMagicHit : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {lastResult === null
              ? 'Tira tras lanzar un conjuro de hechicero con espacio'
              : lastResult.triggered
                ? '¡Oleada de Magia Salvaje!'
                : 'Sin oleada'}
          </p>

          <p className={styles.note}>
            {lastResult === null ? (
              surgePending ? (
                <>
                  Mareas de Caos está gastado: tu siguiente conjuro de hechicero con espacio dispara
                  la oleada <strong>automáticamente</strong> y te devuelve el uso.
                </>
              ) : (
                'Una vez por turno, justo después de gastar un espacio en un conjuro de hechicero. Con un 20 natural, tiras en la tabla.'
              )
            ) : lastResult.triggered ? (
              <>
                Tira <strong>{lastResult.tableRoll}</strong> en la tabla de Oleada de Magia Salvaje
                (Player&apos;s Handbook 2024, pág. 149).
                {lastResult.tidesRecharged ? ' Mareas de Caos vuelve a estar disponible.' : ''}
              </>
            ) : (
              `Sacaste ${lastResult.d20}. La magia se portó bien.`
            )}
          </p>

          <div className={styles.row} style={{ marginTop: 'var(--space-3)' }}>
            <Button
              variant="chaos"
              size="small"
              aria-pressed={surgePending}
              disabled={!tidesOfChaosAvailable}
              onClick={useTidesOfChaos}
            >
              {surgePending ? 'Caos armado' : 'Mareas de Caos'}
            </Button>

            {lastResult?.triggered ? (
              <Button
                size="small"
                disabled={saved}
                onClick={() => {
                  addMemory({
                    title: `Oleada — resultado ${lastResult.tableRoll}`,
                    body: `Salió ${lastResult.tableRoll} en la tabla de Oleada de Magia Salvaje. Anota qué pasó.`,
                    category: 'surge',
                  })
                  setSaved(true)
                }}
              >
                {saved ? 'Guardado' : 'Guardar en Recuerdos'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  )
}
