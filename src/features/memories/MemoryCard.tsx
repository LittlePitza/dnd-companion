import { useId, useState } from 'react'
import { MEMORY_CATEGORY_LABEL } from '@/content/labels'
import { Button } from '@/shared/components/Button'
import type { Memory } from '@/store/useMemoriesStore'
import { useMemoriesStore } from '@/store/useMemoriesStore'
import styles from './Memories.module.css'

const dateFormatter = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** One memory, with the three things you ever want to do to it. */
export function MemoryCard({ memory, onEdit }: { memory: Memory; onEdit: () => void }) {
  const togglePinned = useMemoriesStore((state) => state.togglePinned)
  const removeMemory = useMemoriesStore((state) => state.removeMemory)
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  const titleId = useId()
  const wasTouched = memory.updatedAt !== memory.createdAt

  return (
    <article
      className={[styles.card, memory.pinned ? styles.cardPinned : undefined]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={titleId}
    >
      <h3 id={titleId} className={styles.cardTitle}>
        {memory.title}
      </h3>

      <p className={styles.meta}>
        <span className={styles.tag}>{MEMORY_CATEGORY_LABEL[memory.category]}</span>
        {memory.pinned ? <span className={styles.pinFlag}>Fijado</span> : null}
        {memory.sessionNumber !== undefined ? <span>Sesión {memory.sessionNumber}</span> : null}
        <span>{dateFormatter.format(memory.createdAt)}</span>
        {wasTouched ? <span>· editado {dateFormatter.format(memory.updatedAt)}</span> : null}
      </p>

      {memory.body ? <p className={styles.body}>{memory.body}</p> : null}

      <div className={styles.actions}>
        <Button size="small" aria-pressed={memory.pinned} onClick={() => togglePinned(memory.id)}>
          Fijar
        </Button>
        <Button size="small" onClick={onEdit}>
          Editar
        </Button>
        <Button
          size="small"
          variant={isConfirmingDelete ? 'danger' : 'ghost'}
          // Kept as the same button across both states so the finger — and the
          // focus ring — stay where they were.
          onClick={() => {
            if (isConfirmingDelete) removeMemory(memory.id)
            else setConfirmingDelete(true)
          }}
        >
          {isConfirmingDelete ? '¿Seguro?' : 'Borrar'}
        </Button>
        {isConfirmingDelete ? (
          <Button size="small" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Conservar
          </Button>
        ) : null}
      </div>
    </article>
  )
}
