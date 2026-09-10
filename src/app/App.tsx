import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { CHARACTER_ROSTER } from '@/data/characters'
import { isPersistentStorageAvailable } from '@/infrastructure/storage/safeStorage'
import { AttacksView } from '@/features/attacks/AttacksView'
import { CombatView } from '@/features/combat/CombatView'
import { MemoriesView } from '@/features/memories/MemoriesView'
import { SheetView } from '@/features/sheet/SheetView'
import { SpellsView } from '@/features/spells/SpellsView'
import { VitalsBar } from '@/features/vitals/VitalsBar'
import { useHashTab } from '@/shared/hooks/useHashTab'
import { useActiveCharacter } from '@/store/selectors'
import { useCampaignStore } from '@/store/useCampaignStore'
import styles from './App.module.css'

const TABS = ['combate', 'ataques', 'conjuros', 'hoja', 'recuerdos'] as const
type TabId = (typeof TABS)[number]

const TAB_LABEL: Record<TabId, string> = {
  combate: 'Combate',
  ataques: 'Ataques',
  conjuros: 'Conjuros',
  hoja: 'Hoja',
  recuerdos: 'Recuerdos',
}

const SURGE_FLASH_MS = 900

export function App() {
  const character = useActiveCharacter()
  const selectCharacter = useCampaignStore((state) => state.selectCharacter)
  const [tab, setTab] = useHashTab<TabId>(TABS, 'combate')
  const [isSurging, setSurging] = useState(false)
  const canPersist = usePersistenceCheck()

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const flashSurge = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setSurging(true)
  }, [])

  useEffect(() => {
    if (!isSurging) return
    const timer = window.setTimeout(() => setSurging(false), SURGE_FLASH_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [isSurging])

  /**
   * Arrow keys walk the tab strip and wrap around, so it is never a dead end
   * when someone is navigating one-handed mid-combat.
   */
  const handleTabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (offset === 0) return

    event.preventDefault()
    const current = TABS.indexOf(tab)
    const next = TABS[(current + offset + TABS.length) % TABS.length]
    if (!next) return

    setTab(next)
    tabRefs.current[TABS.indexOf(next)]?.focus()
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.kicker}>Consola de mesa · D&amp;D 2024</p>
        <h1 className={styles.title}>{character.name}</h1>
        <p className={styles.subtitle}>
          {character.className} {character.level}
          {character.subclass ? ` · ${character.subclass}` : ''} · {character.species} ·{' '}
          {character.background}
          {character.alignment ? ` · ${character.alignment}` : ''}
        </p>

        <div className={styles.characterPicker}>
          <label className={styles.kicker} htmlFor="character-select">
            Personaje activo
          </label>
          <select
            id="character-select"
            className={styles.select}
            value={character.id}
            onChange={(event) => selectCharacter(event.target.value)}
          >
            {CHARACTER_ROSTER.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <VitalsBar />

      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Secciones de la consola"
        onKeyDown={handleTabKeys}
      >
        {TABS.map((id, index) => {
          const isActive = id === tab
          return (
            <button
              key={id}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-controls={`panel-${id}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={[styles.tab, isActive ? styles.tabActive : undefined]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setTab(id)}
            >
              {TAB_LABEL[id]}
            </button>
          )
        })}
      </div>

      {!canPersist ? (
        <p className={styles.storageWarning}>
          Este navegador no permite guardar datos. La app funciona igual, pero se perderá todo al
          cerrar la pestaña.
        </p>
      ) : null}

      <main
        className={styles.view}
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={-1}
      >
        {tab === 'combate' ? <CombatView onSurge={flashSurge} /> : null}
        {tab === 'ataques' ? <AttacksView /> : null}
        {tab === 'conjuros' ? <SpellsView /> : null}
        {tab === 'hoja' ? <SheetView /> : null}
        {tab === 'recuerdos' ? <MemoriesView /> : null}
      </main>

      {isSurging ? <div className={styles.surgeFlash} aria-hidden="true" /> : null}
    </div>
  )
}

/**
 * Checks once whether anything written will survive a reload.
 *
 * The probe runs in a lazy initialiser rather than an effect: the answer cannot
 * change while the app is open, so re-rendering to discover it would be waste.
 */
function usePersistenceCheck(): boolean {
  const [canPersist] = useState(isPersistentStorageAvailable)
  return canPersist
}
