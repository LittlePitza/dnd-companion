import { useCallback, useEffect, useState } from 'react'
import { createSafeStorage } from '@/infrastructure/storage/safeStorage'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'dnd-companion:theme'

const storage = createSafeStorage()

/** Reads the stored choice, falling back to whatever the system prefers. */
function initialTheme(): Theme {
  const stored = storage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored

  // `matchMedia` is missing in some embedded webviews; light is the safe default.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Light or dark, remembered between sessions. A table playing by lamplight
 * wants the dark sheet; the same table in daylight does not.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    storage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, toggleTheme }
}
