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
import { Icon } from '@/shared/components/Icon'
import { useHashTab } from '@/shared/hooks/useHashTab'
import { useTheme } from '@/shared/hooks/useTheme'
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
  const { theme, toggleTheme } = useTheme()
  const canPersist = usePersistenceCheck()

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const tabStripRef = useRef<HTMLDivElement | null>(null)
  const hasMounted = useRef(false)

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
   * On a narrow screen the tab strip scrolls sideways; centre the active tab so
   * the player can always see where they are.
   *
   * The strip is scrolled directly rather than through `scrollIntoView`, which
   * would also scroll the page vertically as a side effect. Centring is redone
   * once the web font has loaded and whenever the window resizes, because both
   * change the tab widths this calculation depends on.
   */
  useEffect(() => {
    const centreActiveTab = (behavior: ScrollBehavior) => {
      const strip = tabStripRef.current
      const activeTab = tabRefs.current[TABS.indexOf(tab)]
      if (!strip || !activeTab) return

      const centred = activeTab.offsetLeft - (strip.clientWidth - activeTab.clientWidth) / 2
      strip.scrollTo({ left: Math.max(0, centred), behavior })
    }

    centreActiveTab('smooth')

    // Font swap reflows the strip after this effect has already run.
    void document.fonts?.ready.then(() => centreActiveTab('auto'))

    const onResize = () => centreActiveTab('auto')
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [tab])

  /**
   * Switching tabs starts a new page, so it starts at the top. Skipped on the
   * first render, where the browser is still restoring its own scroll position.
   */
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [tab])

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

  const summary = [
    `${character.className} ${character.level}`,
    character.subclass,
    character.species,
    character.background,
    character.alignment,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.crest} aria-hidden="true">
            {character.name.charAt(0)}
          </span>
          <div className={styles.identityText}>
            <h1 className={styles.title}>{character.name}</h1>
            <p className={styles.subtitle}>{summary}</p>
          </div>
        </div>

        <div className={styles.headerControls}>
          <label className={styles.pickerLabel} htmlFor="character-select">
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

          <button
            type="button"
            className={styles.iconButton}
            aria-label={theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
            onClick={toggleTheme}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
          </button>
        </div>
      </header>

      {/* Tabs and vitals stick together as one unit: two independent sticky
          elements would swap places as soon as the page scrolled. */}
      <div className={styles.stickyHeader}>
        <div
          ref={tabStripRef}
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

        <VitalsBar />
      </div>

      {!canPersist ? (
        <p className={styles.storageWarning}>
          Este navegador no permite guardar datos. La app funciona igual, pero se perderá todo al
          cerrar la pestaña.
        </p>
      ) : null}

      <main
        key={tab}
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
