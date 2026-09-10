import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Memory, MemoriesStore, MemoryDraft } from './useMemoriesStore'
import { filterMemories, sortMemories, useMemoriesStore } from './useMemoriesStore'

/**
 * The store is a module-level singleton. This snapshot carries the actions
 * alongside the state, which is what makes a replacing reset safe.
 */
const pristine = useMemoriesStore.getState()

const store = (): MemoriesStore => useMemoriesStore.getState()
const memories = (): Memory[] => store().memories

function draft(overrides: Partial<MemoryDraft> = {}): MemoryDraft {
  return {
    title: 'El pacto del candelabro',
    body: 'Se lo vendimos al enano.',
    category: 'deal',
    ...overrides,
  }
}

/** A stored memory, for the pure helpers that never go through the store. */
function memory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'seed',
    title: 'Recuerdo',
    body: '',
    category: 'other',
    pinned: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

/** Pins the clock so `updatedAt` never depends on a millisecond going by. */
function pinClock(at: number): void {
  vi.spyOn(Date, 'now').mockReturnValue(at)
}

beforeEach(() => {
  vi.restoreAllMocks()
  useMemoriesStore.setState({ ...pristine, memories: [] }, true)
})

describe('addMemory', () => {
  it('returns the memory it created and puts it first', () => {
    const first = store().addMemory(draft({ title: 'El primero' }))
    const second = store().addMemory(draft({ title: 'El segundo' }))

    expect(memories()).toHaveLength(2)
    expect(memories()[0]).toEqual(second)
    expect(memories()[1]).toEqual(first)
    expect(second.id).not.toBe(first.id)
    expect(second.pinned).toBe(false)
  })

  it('trims the title and the body', () => {
    const created = store().addMemory(draft({ title: '  Vashtar  ', body: '  Nos debe una.  ' }))

    expect(created.title).toBe('Vashtar')
    expect(created.body).toBe('Nos debe una.')
  })

  it('falls back to a placeholder title when there is none', () => {
    const created = store().addMemory(draft({ title: '   ' }))

    expect(created.title).toBe('Sin título')
  })

  it('stamps both timestamps with the same instant', () => {
    pinClock(1_700_000_000_000)

    const created = store().addMemory(draft())

    expect(created.createdAt).toBe(1_700_000_000_000)
    expect(created.updatedAt).toBe(1_700_000_000_000)
  })

  it('keeps the session number when given and omits it when not', () => {
    const numbered = store().addMemory(draft({ sessionNumber: 7 }))
    const loose = store().addMemory(draft())

    expect(numbered.sessionNumber).toBe(7)
    expect(loose.sessionNumber).toBeUndefined()
    expect(Object.hasOwn(loose, 'sessionNumber')).toBe(false)
  })
})

describe('updateMemory', () => {
  it('patches the fields and moves updatedAt forward', () => {
    pinClock(1_000)
    const created = store().addMemory(draft())

    pinClock(5_000)
    store().updateMemory(created.id, { title: 'El pacto roto', category: 'clue' })

    const stored = memories()[0]
    expect(stored?.title).toBe('El pacto roto')
    expect(stored?.category).toBe('clue')
    expect(stored?.body).toBe(created.body)
    expect(stored?.createdAt).toBe(1_000)
    expect(stored?.updatedAt).toBe(5_000)
  })

  it('ignores an unknown id', () => {
    const created = store().addMemory(draft())

    store().updateMemory('no-such-memory', { title: 'Fantasma' })

    expect(memories()).toEqual([created])
  })
})

describe('removeMemory', () => {
  it('drops only the memory asked for', () => {
    const kept = store().addMemory(draft({ title: 'Se queda' }))
    const doomed = store().addMemory(draft({ title: 'Se va' }))

    store().removeMemory(doomed.id)

    expect(memories()).toEqual([kept])
  })

  it('ignores an unknown id', () => {
    const created = store().addMemory(draft())

    store().removeMemory('no-such-memory')

    expect(memories()).toEqual([created])
  })
})

describe('togglePinned', () => {
  it('pins, unpins and touches updatedAt each time', () => {
    pinClock(1_000)
    const created = store().addMemory(draft())

    pinClock(2_000)
    store().togglePinned(created.id)
    expect(memories()[0]?.pinned).toBe(true)
    expect(memories()[0]?.updatedAt).toBe(2_000)

    pinClock(3_000)
    store().togglePinned(created.id)
    expect(memories()[0]?.pinned).toBe(false)
    expect(memories()[0]?.updatedAt).toBe(3_000)
  })
})

describe('replaceAll and clearAll', () => {
  it('replaces the list with a copy of the one given', () => {
    store().addMemory(draft())
    const incoming = [memory({ id: 'a' }), memory({ id: 'b' })]

    store().replaceAll(incoming)

    expect(memories()).toEqual(incoming)
    // A copy, so a later edit of the caller's array cannot reach the store.
    expect(memories()).not.toBe(incoming)
  })

  it('empties the list', () => {
    store().addMemory(draft())

    store().clearAll()

    expect(memories()).toEqual([])
  })
})

describe('sortMemories', () => {
  it('puts pinned memories first and orders each group by recency', () => {
    const sorted = sortMemories([
      memory({ id: 'old', updatedAt: 100 }),
      memory({ id: 'pinned-old', pinned: true, updatedAt: 50 }),
      memory({ id: 'new', updatedAt: 300 }),
      memory({ id: 'pinned-new', pinned: true, updatedAt: 200 }),
    ])

    expect(sorted.map((entry) => entry.id)).toEqual(['pinned-new', 'pinned-old', 'new', 'old'])
  })

  it('leaves the input untouched', () => {
    const input = [memory({ id: 'a', updatedAt: 1 }), memory({ id: 'b', updatedAt: 2 })]

    sortMemories(input)

    expect(input.map((entry) => entry.id)).toEqual(['a', 'b'])
  })
})

describe('filterMemories', () => {
  const roster = [
    memory({ id: 'npc', title: 'Vashtar', body: 'Enano tratante de reliquias.', category: 'npc' }),
    memory({ id: 'deal', title: 'El pacto', body: 'VASHTAR nos debe un favor.', category: 'deal' }),
    memory({ id: 'place', title: 'La Grieta', body: 'Huele a azufre.', category: 'place' }),
  ]

  it('matches everything with an empty query and no category', () => {
    expect(filterMemories(roster, '', null)).toEqual(roster)
    expect(filterMemories(roster, '   ', null)).toEqual(roster)
  })

  it('searches the title without minding the case', () => {
    expect(filterMemories(roster, 'vashtar', null).map((entry) => entry.id)).toEqual([
      'npc',
      'deal',
    ])
  })

  it('searches the body too', () => {
    expect(filterMemories(roster, 'azufre', null).map((entry) => entry.id)).toEqual(['place'])
  })

  it('filters by category alone', () => {
    expect(filterMemories(roster, '', 'npc').map((entry) => entry.id)).toEqual(['npc'])
  })

  it('combines query and category', () => {
    expect(filterMemories(roster, 'vashtar', 'deal').map((entry) => entry.id)).toEqual(['deal'])
    expect(filterMemories(roster, 'azufre', 'npc')).toEqual([])
  })
})
