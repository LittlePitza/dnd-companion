import { useId, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { MEMORY_CATEGORY_LABEL } from '@/content/labels'
import { Button } from '@/shared/components/Button'
import { Section } from '@/shared/components/Surfaces'
import type { Memory, MemoryCategory } from '@/store/useMemoriesStore'
import {
  MEMORY_CATEGORIES,
  filterMemories,
  sortMemories,
  useMemoriesStore,
} from '@/store/useMemoriesStore'
import { parseMemoriesBackup, serializeMemories } from './backup'
import { MemoryCard } from './MemoryCard'
import { MemoryEditor } from './MemoryEditor'
import styles from './Memories.module.css'

/** Which editor, if any, is open. */
type EditorState = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; memory: Memory }

/**
 * The campaign log: everything worth remembering between sessions, searchable,
 * and backed up to a file the player keeps. Memories live only in this
 * browser, so import deliberately asks before it overwrites anything.
 */
export function MemoriesView() {
  const memories = useMemoriesStore((state) => state.memories)
  const replaceAll = useMemoriesStore((state) => state.replaceAll)

  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MemoryCategory | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<Memory[] | null>(null)

  const fieldId = useId()
  const searchId = `${fieldId}-search`
  const filterId = `${fieldId}-filter`
  const importId = `${fieldId}-import`

  const visible = useMemo(
    () => sortMemories(filterMemories(memories, query, category)),
    [memories, query, category],
  )

  const isFiltered = query.trim() !== '' || category !== null

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Clearing the value lets the same file be picked twice in a row.
    event.target.value = ''
    if (!file) return

    setImportError(null)
    setPendingImport(null)

    const result = parseMemoriesBackup(await file.text())
    if (result.ok) setPendingImport(result.memories)
    else setImportError(result.error)
  }

  return (
    <Section
      heading="Recuerdos"
      lede="Anota lo que la mesa va a olvidar: quién te debe un favor, qué prometiste y cómo salió aquella oleada."
    >
      <div className={styles.backupRow}>
        <Button
          variant="solid"
          size="small"
          onClick={() => setEditor(editor.mode === 'new' ? { mode: 'closed' } : { mode: 'new' })}
        >
          Añadir recuerdo
        </Button>

        <Button
          size="small"
          disabled={memories.length === 0}
          onClick={() => downloadBackup(memories)}
        >
          Exportar respaldo
        </Button>

        <input
          id={importId}
          className={styles.fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="Importar respaldo"
          onChange={(event) => void handleFile(event)}
        />
        <label className={styles.fileLabel} htmlFor={importId}>
          Importar respaldo
        </label>
      </div>

      {importError ? (
        <p className={styles.notice} role="alert">
          {importError}
        </p>
      ) : null}

      {pendingImport ? (
        <div className={styles.confirm}>
          <p className={styles.confirmText}>
            El respaldo trae {countLabel(pendingImport.length)}. Importarlo reemplaza los{' '}
            {countLabel(memories.length)} que tienes ahora. No hay vuelta atrás.
          </p>
          <div className={styles.actions}>
            <Button
              variant="danger"
              size="small"
              onClick={() => {
                replaceAll(pendingImport)
                setPendingImport(null)
              }}
            >
              Reemplazar todo
            </Button>
            <Button variant="ghost" size="small" onClick={() => setPendingImport(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {editor.mode !== 'closed' ? (
        <MemoryEditor
          key={editor.mode === 'edit' ? editor.memory.id : 'new'}
          {...(editor.mode === 'edit' ? { memory: editor.memory } : {})}
          onDone={() => setEditor({ mode: 'closed' })}
        />
      ) : null}

      <div className={styles.toolbar}>
        <div className={[styles.field, styles.grow].join(' ')}>
          <label className={styles.label} htmlFor={searchId}>
            Buscar
          </label>
          <input
            id={searchId}
            className={styles.input}
            type="search"
            autoComplete="off"
            placeholder="Título o contenido"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={filterId}>
            Filtrar por categoría
          </label>
          <select
            id={filterId}
            className={styles.select}
            value={category ?? 'all'}
            onChange={(event) => {
              const value = event.target.value
              setCategory(value === 'all' ? null : (value as MemoryCategory))
            }}
          >
            <option value="all">Todas</option>
            {MEMORY_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {MEMORY_CATEGORY_LABEL[option]}
              </option>
            ))}
          </select>
        </div>

        <p className={styles.count}>
          {isFiltered ? `${visible.length} de ${memories.length}` : countLabel(memories.length)}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className={styles.empty}>
          {memories.length === 0
            ? 'Todavía no hay nada anotado. El primer recuerdo suele ser una deuda.'
            : 'Ningún recuerdo coincide con ese filtro.'}
        </p>
      ) : (
        <div className={styles.list}>
          {visible.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={() => setEditor({ mode: 'edit', memory })}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

function countLabel(total: number): string {
  return `${total} ${total === 1 ? 'recuerdo' : 'recuerdos'}`
}

/** Hands the player a file they can keep, move to another device, or re-import. */
function downloadBackup(memories: readonly Memory[]): void {
  const contents = serializeMemories(memories, new Date().toISOString())
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `recuerdos-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()

  URL.revokeObjectURL(url)
}
