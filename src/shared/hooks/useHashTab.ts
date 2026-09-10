import { useCallback, useEffect, useState } from 'react'

/**
 * Keeps the active tab in the URL hash so a refresh, a bookmark and the browser
 * back button all behave — without pulling in a router for five static views.
 */
export function useHashTab<T extends string>(
  tabs: readonly T[],
  fallback: T,
): [T, (tab: T) => void] {
  const read = useCallback((): T => {
    const raw = window.location.hash.replace(/^#\/?/, '')
    return tabs.includes(raw as T) ? (raw as T) : fallback
  }, [tabs, fallback])

  const [active, setActive] = useState<T>(read)

  useEffect(() => {
    const onHashChange = () => {
      setActive(read())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [read])

  const select = useCallback((tab: T) => {
    window.location.hash = `/${tab}`
    setActive(tab)
  }, [])

  return [active, select]
}
