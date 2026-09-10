import type { Character } from '@/domain/character/types'
import { sorynVort } from './sorynVort'

/**
 * The campaign roster. Registering a character here is the only step needed to
 * make it selectable — no component or rule knows about a specific hero.
 */
export const CHARACTER_ROSTER: readonly Character[] = [sorynVort]

export const DEFAULT_CHARACTER_ID = sorynVort.id

export function findCharacter(id: string): Character | undefined {
  return CHARACTER_ROSTER.find((character) => character.id === id)
}

/**
 * Resolves a character id to a character, falling back to the default when the
 * id is unknown — for instance after a roster change invalidates saved state.
 */
export function resolveCharacter(id: string | undefined): Character {
  const fallback = CHARACTER_ROSTER[0]
  if (!fallback) {
    throw new Error('The character roster is empty; register at least one character.')
  }
  return (id ? findCharacter(id) : undefined) ?? fallback
}
