import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useActiveCharacter } from '@/store/selectors'
import styles from './Combat.module.css'

/**
 * "What do I do this turn?" — the player picks the situation they are in and
 * gets the exact, legal sequence for it.
 */
export function TurnPlanner() {
  const character = useActiveCharacter()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = character.tactics.find((play) => play.id === selectedId) ?? null

  if (character.tactics.length === 0) return null

  return (
    <>
      <div className={styles.situations}>
        {character.tactics.map((play, index) => (
          <button
            key={play.id}
            type="button"
            className={styles.situation}
            style={{ '--stagger-index': index } as CSSProperties}
            aria-pressed={play.id === selectedId}
            onClick={() => setSelectedId(play.id === selectedId ? null : play.id)}
          >
            <span className={styles.situationCategory}>{play.category}</span>
            {play.situation}
          </button>
        ))}
      </div>

      {selected ? (
        <div className={styles.answer}>
          <h3 className={styles.answerTitle}>{selected.situation}</h3>

          <dl className={styles.sequence}>
            <dt className={styles.sequenceTerm}>A. adicional</dt>
            <dd className={styles.sequenceDetail}>{selected.bonusAction}</dd>
            <dt className={styles.sequenceTerm}>Acción</dt>
            <dd className={styles.sequenceDetail}>{selected.action}</dd>
          </dl>

          <span className={styles.cost}>{selected.cost}</span>
          <p className={styles.note}>{selected.note}</p>
        </div>
      ) : null}
    </>
  )
}
