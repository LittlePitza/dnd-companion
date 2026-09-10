import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { MEMORY_CATEGORY_LABEL } from '@/content/labels'
import { Button } from '@/shared/components/Button'
import type { Memory, MemoryCategory, MemoryDraft } from '@/store/useMemoriesStore'
import { MEMORY_CATEGORIES, useMemoriesStore } from '@/store/useMemoriesStore'
import styles from './Memories.module.css'

interface FieldError {
  field: 'title' | 'sessionNumber'
  message: string
}

/**
 * Writes one memory, new or existing. It talks to the store itself and only
 * calls `onDone` once the write has landed, so the caller decides where the
 * form appears and nothing else.
 */
export function MemoryEditor({ memory, onDone }: { memory?: Memory; onDone: () => void }) {
  const addMemory = useMemoriesStore((state) => state.addMemory)
  const updateMemory = useMemoriesStore((state) => state.updateMemory)

  const fieldId = useId()
  const [title, setTitle] = useState(memory?.title ?? '')
  const [body, setBody] = useState(memory?.body ?? '')
  const [category, setCategory] = useState<MemoryCategory>(memory?.category ?? 'session')
  const [sessionNumber, setSessionNumber] = useState(
    memory?.sessionNumber === undefined ? '' : String(memory.sessionNumber),
  )
  const [error, setError] = useState<FieldError | null>(null)

  const titleId = `${fieldId}-title`
  const bodyId = `${fieldId}-body`
  const categoryId = `${fieldId}-category`
  const sessionId = `${fieldId}-session`
  const errorId = `${fieldId}-error`

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanTitle = title.trim()
    if (cleanTitle === '') {
      setError({
        field: 'title',
        message: 'Ponle un título: es lo que vas a leer cuando lo busques dentro de tres sesiones.',
      })
      return
    }

    const rawSession = sessionNumber.trim()
    const parsedSession = rawSession === '' ? undefined : Number.parseInt(rawSession, 10)
    if (parsedSession !== undefined && (!Number.isFinite(parsedSession) || parsedSession < 1)) {
      setError({
        field: 'sessionNumber',
        message: 'El número de sesión debe ser un entero positivo, o déjalo vacío.',
      })
      return
    }

    const draft: MemoryDraft = {
      title: cleanTitle,
      body: body.trim(),
      category,
      ...(parsedSession !== undefined ? { sessionNumber: parsedSession } : {}),
    }

    // On an edit the session number is sent even when empty: an explicit
    // `undefined` is how the field gets cleared again.
    if (memory) updateMemory(memory.id, { ...draft, sessionNumber: parsedSession })
    else addMemory(draft)

    onDone()
  }

  return (
    <form className={styles.editor} onSubmit={handleSubmit}>
      <h3 className={styles.editorTitle}>{memory ? 'Editar recuerdo' : 'Nuevo recuerdo'}</h3>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={titleId}>
          Título
        </label>
        <input
          id={titleId}
          className={styles.input}
          type="text"
          autoComplete="off"
          value={title}
          aria-invalid={error?.field === 'title'}
          aria-describedby={error?.field === 'title' ? errorId : undefined}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={bodyId}>
          Qué pasó
        </label>
        <textarea
          id={bodyId}
          className={styles.textarea}
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>

      <div className={styles.editorRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={categoryId}>
            Categoría
          </label>
          <select
            id={categoryId}
            className={styles.select}
            value={category}
            onChange={(event) => setCategory(event.target.value as MemoryCategory)}
          >
            {MEMORY_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {MEMORY_CATEGORY_LABEL[option]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={sessionId}>
            Sesión
          </label>
          <input
            id={sessionId}
            className={styles.input}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="Opcional"
            value={sessionNumber}
            aria-invalid={error?.field === 'sessionNumber'}
            aria-describedby={error?.field === 'sessionNumber' ? errorId : undefined}
            onChange={(event) => setSessionNumber(event.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error.message}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button type="submit" variant="solid">
          Guardar
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
