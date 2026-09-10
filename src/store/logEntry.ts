/** Visual weight of a log line, so the roll log can be read at a glance. */
export type LogTone = 'neutral' | 'good' | 'bad' | 'chaos' | 'fire'

export interface LogEntry {
  id: string
  /** Epoch milliseconds, formatted at render time. */
  at: number
  title: string
  detail: string
  tone: LogTone
  /** Headline number, when the entry has one — a roll total or damage total. */
  value?: number
}

/** How many entries the roll log keeps before the oldest are dropped. */
export const LOG_LIMIT = 50

let counter = 0

/**
 * Ids only need to be unique within a running session, so a counter paired with
 * the timestamp is enough and keeps the store free of extra dependencies.
 */
export function createLogId(): string {
  counter += 1
  return `${Date.now().toString(36)}-${counter.toString(36)}`
}

export function appendLog(
  entries: readonly LogEntry[],
  entry: Omit<LogEntry, 'id' | 'at'>,
): LogEntry[] {
  return [{ ...entry, id: createLogId(), at: Date.now() }, ...entries].slice(0, LOG_LIMIT)
}
