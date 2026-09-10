import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createSafeStorage, STORAGE_KEYS } from '@/infrastructure/storage/safeStorage'

export const MEMORY_CATEGORIES = [
  'session',
  'npc',
  'place',
  'deal',
  'loot',
  'clue',
  'surge',
  'other',
] as const

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]

/** One thing worth remembering between sessions. */
export interface Memory {
  id: string
  title: string
  body: string
  category: MemoryCategory
  /** Which session it happened in, when the player bothers to record it. */
  sessionNumber?: number
  pinned: boolean
  createdAt: number
  updatedAt: number
}

export type MemoryDraft = Pick<Memory, 'title' | 'body' | 'category'> &
  Partial<Pick<Memory, 'sessionNumber'>>

interface MemoriesState {
  memories: Memory[]
}

interface MemoriesActions {
  addMemory: (draft: MemoryDraft) => Memory
  updateMemory: (id: string, patch: Partial<MemoryDraft>) => void
  removeMemory: (id: string) => void
  togglePinned: (id: string) => void
  replaceAll: (memories: readonly Memory[]) => void
  clearAll: () => void
}

export type MemoriesStore = MemoriesState & MemoriesActions

function createMemoryId(): string {
  // `crypto.randomUUID` is unavailable in some embedded webviews.
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const useMemoriesStore = create<MemoriesStore>()(
  persist(
    (set) => ({
      memories: [],

      addMemory: (draft) => {
        const now = Date.now()
        const memory: Memory = {
          id: createMemoryId(),
          title: draft.title.trim() || 'Sin título',
          body: draft.body.trim(),
          category: draft.category,
          ...(draft.sessionNumber !== undefined ? { sessionNumber: draft.sessionNumber } : {}),
          pinned: false,
          createdAt: now,
          updatedAt: now,
        }

        set((state) => ({ memories: [memory, ...state.memories] }))
        return memory
      },

      updateMemory: (id, patch) => {
        set((state) => ({
          memories: state.memories.map((memory) =>
            memory.id === id ? { ...memory, ...patch, updatedAt: Date.now() } : memory,
          ),
        }))
      },

      removeMemory: (id) => {
        set((state) => ({ memories: state.memories.filter((memory) => memory.id !== id) }))
      },

      togglePinned: (id) => {
        set((state) => ({
          memories: state.memories.map((memory) =>
            memory.id === id
              ? { ...memory, pinned: !memory.pinned, updatedAt: Date.now() }
              : memory,
          ),
        }))
      },

      replaceAll: (memories) => {
        set({ memories: [...memories] })
      },

      clearAll: () => {
        set({ memories: [] })
      },
    }),
    {
      name: STORAGE_KEYS.memories,
      storage: createJSONStorage(createSafeStorage),
      version: 1,
    },
  ),
)

/**
 * Orders memories for display: pinned first, then most recently touched.
 */
export function sortMemories(memories: readonly Memory[]): Memory[] {
  return [...memories].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
    return right.updatedAt - left.updatedAt
  })
}

/**
 * Filters by free-text query and category. An empty query or a `null` category
 * matches everything.
 */
export function filterMemories(
  memories: readonly Memory[],
  query: string,
  category: MemoryCategory | null,
): Memory[] {
  const needle = query.trim().toLowerCase()

  return memories.filter((memory) => {
    if (category && memory.category !== category) return false
    if (!needle) return true
    return memory.title.toLowerCase().includes(needle) || memory.body.toLowerCase().includes(needle)
  })
}
