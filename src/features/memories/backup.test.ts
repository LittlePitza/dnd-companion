import { describe, expect, it } from 'vitest'
import type { Memory } from '@/store/useMemoriesStore'
import { BACKUP_FORMAT, BACKUP_VERSION, parseMemoriesBackup, serializeMemories } from './backup'

const EXPORTED_AT = '2025-03-01T20:00:00.000Z'

function memory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem-1',
    title: 'El trato con Vessa',
    body: 'Le debemos un favor.\nNo dijo cuál.',
    category: 'deal',
    sessionNumber: 4,
    pinned: true,
    createdAt: 1_740_000_000_000,
    updatedAt: 1_740_000_500_000,
    ...overrides,
  }
}

/** Builds a backup envelope with one deliberately broken memory. */
function envelopeWith(entry: unknown): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: EXPORTED_AT,
    memories: [entry],
  })
}

describe('serializeMemories', () => {
  it('wraps the memories in a versioned envelope', () => {
    const raw = serializeMemories([memory()], EXPORTED_AT)
    const parsed: unknown = JSON.parse(raw)

    expect(parsed).toEqual({
      format: 'dnd-companion/memories',
      version: 1,
      exportedAt: EXPORTED_AT,
      memories: [memory()],
    })
  })

  it('is deterministic for the same input', () => {
    expect(serializeMemories([memory()], EXPORTED_AT)).toBe(
      serializeMemories([memory()], EXPORTED_AT),
    )
  })

  it('drops fields that are not part of a memory', () => {
    const contaminated = { ...memory(), secret: 'no' } as Memory
    const raw = serializeMemories([contaminated], EXPORTED_AT)

    expect(raw).not.toContain('secret')
  })

  it('omits an absent session number instead of writing null', () => {
    const raw = serializeMemories([memory({ sessionNumber: undefined })], EXPORTED_AT)

    expect(raw).not.toContain('sessionNumber')
  })
})

describe('parseMemoriesBackup', () => {
  it('reads back what serializeMemories wrote', () => {
    const memories = [memory(), memory({ id: 'mem-2', title: 'La puerta de sal', pinned: false })]
    const result = parseMemoriesBackup(serializeMemories(memories, EXPORTED_AT))

    expect(result).toEqual({ ok: true, memories })
  })

  it('keeps a memory without a session number', () => {
    const source = memory({ sessionNumber: undefined })
    const result = parseMemoriesBackup(serializeMemories([source], EXPORTED_AT))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.memories[0]?.sessionNumber).toBeUndefined()
  })

  it('rejects text that is not JSON', () => {
    const result = parseMemoriesBackup('esto no es un respaldo')

    expect(result).toEqual({ ok: false, error: 'El archivo no es un JSON válido.' })
  })

  it('rejects JSON that is not an object', () => {
    expect(parseMemoriesBackup('[]').ok).toBe(false)
    expect(parseMemoriesBackup('"hola"').ok).toBe(false)
    expect(parseMemoriesBackup('null').ok).toBe(false)
  })

  it('rejects an envelope from another application', () => {
    const raw = JSON.stringify({ format: 'otra-app/notas', version: 1, memories: [memory()] })
    const result = parseMemoriesBackup(raw)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('no es un respaldo de recuerdos')
  })

  it('rejects a backup with no envelope at all', () => {
    expect(parseMemoriesBackup(JSON.stringify({ memories: [memory()] })).ok).toBe(false)
  })

  it('rejects a version it cannot read', () => {
    const raw = JSON.stringify({ format: BACKUP_FORMAT, version: 2, memories: [memory()] })
    const result = parseMemoriesBackup(raw)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('versión 2')
  })

  it('rejects a memories field that is not a list', () => {
    const raw = JSON.stringify({ format: BACKUP_FORMAT, version: 1, memories: { one: memory() } })
    const result = parseMemoriesBackup(raw)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('lista de recuerdos')
  })

  it('rejects an empty backup, because restoring it would wipe the campaign', () => {
    const raw = JSON.stringify({ format: BACKUP_FORMAT, version: 1, memories: [] })
    const result = parseMemoriesBackup(raw)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('ningún recuerdo')
  })

  it('rejects a memory that is not an object', () => {
    const result = parseMemoriesBackup(envelopeWith('El trato con Vessa'))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('n.º 1')
  })

  it('rejects a memory without an id', () => {
    const { id: _id, ...rest } = memory()
    const result = parseMemoriesBackup(envelopeWith(rest))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('identificador')
  })

  it('rejects a memory with a blank title', () => {
    const result = parseMemoriesBackup(envelopeWith({ ...memory(), title: '   ' }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('título')
  })

  it('rejects a body that is not text', () => {
    const result = parseMemoriesBackup(envelopeWith({ ...memory(), body: 42 }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('cuerpo de texto')
  })

  it('rejects an unknown category', () => {
    const result = parseMemoriesBackup(envelopeWith({ ...memory(), category: 'dragón' }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('categoría desconocida')
  })

  it('rejects a pinned flag that is not a boolean', () => {
    const result = parseMemoriesBackup(envelopeWith({ ...memory(), pinned: 'sí' }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('fijado')
  })

  it('rejects unreadable timestamps', () => {
    const result = parseMemoriesBackup(envelopeWith({ ...memory(), createdAt: 'ayer' }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('fechas ilegibles')
  })

  it('rejects a session number that is not a positive integer', () => {
    expect(parseMemoriesBackup(envelopeWith({ ...memory(), sessionNumber: 'cuatro' })).ok).toBe(
      false,
    )
    expect(parseMemoriesBackup(envelopeWith({ ...memory(), sessionNumber: 0 })).ok).toBe(false)
    expect(parseMemoriesBackup(envelopeWith({ ...memory(), sessionNumber: 2.5 })).ok).toBe(false)
  })

  it('rejects repeated identifiers', () => {
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: EXPORTED_AT,
      memories: [memory(), memory({ title: 'Otro' })],
    })
    const result = parseMemoriesBackup(raw)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('repite el identificador')
  })
})
