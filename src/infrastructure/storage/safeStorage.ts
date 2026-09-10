/**
 * The shape Zustand's `createJSONStorage` expects.
 */
export interface KeyValueStorage {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

/**
 * An in-memory stand-in used when the browser denies access to `localStorage`
 * — private windows, blocked site data, or an embedded context. The app stays
 * fully usable; only persistence between reloads is lost.
 */
function createMemoryStorage(): KeyValueStorage {
  const entries = new Map<string, string>()
  return {
    getItem: (name) => entries.get(name) ?? null,
    setItem: (name, value) => {
      entries.set(name, value)
    },
    removeItem: (name) => {
      entries.delete(name)
    },
  }
}

/**
 * Reports whether `localStorage` can actually be read and written. Merely
 * checking that the object exists is not enough: some browsers expose it and
 * throw on access.
 */
export function isPersistentStorageAvailable(): boolean {
  try {
    const probe = '__dnd_companion_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

/**
 * Returns `localStorage` when it works, and a memory-backed fallback when it
 * does not. Every operation is guarded so a quota error can never break a
 * render.
 */
export function createSafeStorage(): KeyValueStorage {
  if (typeof window === 'undefined' || !isPersistentStorageAvailable()) {
    return createMemoryStorage()
  }

  const fallback = createMemoryStorage()

  return {
    getItem: (name) => {
      try {
        return window.localStorage.getItem(name)
      } catch {
        return fallback.getItem(name)
      }
    },
    setItem: (name, value) => {
      try {
        window.localStorage.setItem(name, value)
      } catch {
        fallback.setItem(name, value)
      }
    },
    removeItem: (name) => {
      try {
        window.localStorage.removeItem(name)
      } catch {
        fallback.removeItem(name)
      }
    },
  }
}

/** Namespaced keys, kept together so a rename is a single edit. */
export const STORAGE_KEYS = {
  campaign: 'dnd-companion:campaign',
  memories: 'dnd-companion:memories',
} as const
