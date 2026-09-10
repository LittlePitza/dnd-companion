import type { Memory, MemoryCategory } from '@/store/useMemoriesStore'
import { MEMORY_CATEGORIES } from '@/store/useMemoriesStore'

/**
 * Memories only ever live in this browser's storage, so the export file is the
 * campaign's only real backup. It carries a versioned envelope: a future format
 * can then be recognised and refused instead of half-read.
 */
export const BACKUP_FORMAT = 'dnd-companion/memories'
export const BACKUP_VERSION = 1

export interface MemoriesBackup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  memories: Memory[]
}

export type MemoriesBackupResult = { ok: true; memories: Memory[] } | { ok: false; error: string }

/**
 * `exportedAt` is a parameter rather than a `Date.now()` call so the output is
 * a pure function of its input.
 */
export function serializeMemories(memories: readonly Memory[], exportedAt: string): string {
  const backup: MemoriesBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    memories: memories.map(toPlainMemory),
  }

  return JSON.stringify(backup, null, 2)
}

/**
 * Reads a backup file. The input is whatever the user picked from their disk,
 * so nothing is trusted: envelope, version and every field of every memory are
 * checked before anything is handed back.
 */
export function parseMemoriesBackup(raw: string): MemoriesBackupResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' }
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'El archivo no contiene un respaldo de recuerdos.' }
  }

  if (parsed.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'El archivo no es un respaldo de recuerdos de esta consola.' }
  }

  if (parsed.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `Respaldo de la versión ${describe(parsed.version)}; esta consola solo lee la ${BACKUP_VERSION}.`,
    }
  }

  const entries = parsed.memories
  if (!isUnknownArray(entries)) {
    return { ok: false, error: 'El respaldo no trae una lista de recuerdos.' }
  }

  if (entries.length === 0) {
    return { ok: false, error: 'El respaldo no contiene ningún recuerdo.' }
  }

  const memories: Memory[] = []
  const seenIds = new Set<string>()

  for (const [index, entry] of entries.entries()) {
    const result = parseMemory(entry, index)
    if (!result.ok) return result

    if (seenIds.has(result.memory.id)) {
      return { ok: false, error: `El respaldo repite el identificador «${result.memory.id}».` }
    }

    seenIds.add(result.memory.id)
    memories.push(result.memory)
  }

  return { ok: true, memories }
}

type MemoryResult = { ok: true; memory: Memory } | { ok: false; error: string }

function parseMemory(value: unknown, index: number): MemoryResult {
  // Humans count from one; the file they are looking at does too.
  const position = index + 1

  if (!isRecord(value)) {
    return { ok: false, error: `El recuerdo n.º ${position} no es un objeto.` }
  }

  if (!isFilledString(value.id)) {
    return { ok: false, error: `El recuerdo n.º ${position} no tiene identificador.` }
  }

  if (!isFilledString(value.title)) {
    return { ok: false, error: `El recuerdo n.º ${position} no tiene título.` }
  }

  if (typeof value.body !== 'string') {
    return { ok: false, error: `El recuerdo «${value.title}» no tiene un cuerpo de texto.` }
  }

  if (!isMemoryCategory(value.category)) {
    return {
      ok: false,
      error: `El recuerdo «${value.title}» tiene una categoría desconocida: ${describe(value.category)}.`,
    }
  }

  if (typeof value.pinned !== 'boolean') {
    return { ok: false, error: `El recuerdo «${value.title}» no dice si está fijado.` }
  }

  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) {
    return { ok: false, error: `El recuerdo «${value.title}» tiene fechas ilegibles.` }
  }

  if (value.sessionNumber !== undefined && !isSessionNumber(value.sessionNumber)) {
    return {
      ok: false,
      error: `El recuerdo «${value.title}» tiene un número de sesión inválido: ${describe(value.sessionNumber)}.`,
    }
  }

  // Rebuilt field by field: anything else the file carried is dropped rather
  // than smuggled into the store.
  return {
    ok: true,
    memory: {
      id: value.id,
      title: value.title,
      body: value.body,
      category: value.category,
      ...(value.sessionNumber !== undefined ? { sessionNumber: value.sessionNumber } : {}),
      pinned: value.pinned,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    },
  }
}

function toPlainMemory(memory: Memory): Memory {
  return {
    id: memory.id,
    title: memory.title,
    body: memory.body,
    category: memory.category,
    ...(memory.sessionNumber !== undefined ? { sessionNumber: memory.sessionNumber } : {}),
    pinned: memory.pinned,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function isFilledString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isMemoryCategory(value: unknown): value is MemoryCategory {
  return typeof value === 'string' && (MEMORY_CATEGORIES as readonly string[]).includes(value)
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isSessionNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** A short, quotable rendering of a bad value for the error message. */
function describe(value: unknown): string {
  if (typeof value === 'string') return `«${value}»`
  if (value === null) return 'nulo'
  if (value === undefined) return 'ausente'
  return String(value)
}
