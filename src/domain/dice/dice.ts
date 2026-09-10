import type { RandomSource } from './rng'

/** How a d20 test is rolled. */
export type RollMode = 'normal' | 'advantage' | 'disadvantage'

/** A parsed `XdY+Z` expression. */
export interface DiceNotation {
  count: number
  sides: number
  modifier: number
}

/** The outcome of rolling a damage/utility expression such as `8d6`. */
export interface DiceRollResult {
  notation: string
  rolls: number[]
  modifier: number
  total: number
}

/** The outcome of a d20 test (attack roll, saving throw, ability check). */
export interface D20RollResult {
  mode: RollMode
  /** Every d20 face rolled — two entries under advantage or disadvantage. */
  dice: number[]
  /** The face actually used after applying advantage or disadvantage. */
  natural: number
  modifier: number
  total: number
  isCriticalHit: boolean
  isCriticalMiss: boolean
}

const NOTATION_PATTERN = /^\s*(\d*)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i

/**
 * Parses standard dice notation (`d20`, `2d6`, `8d6+4`, `1d4-1`).
 *
 * @returns the parsed notation, or `null` when the input is not valid notation.
 */
export function parseDiceNotation(input: string): DiceNotation | null {
  const match = NOTATION_PATTERN.exec(input)
  if (!match) return null

  const [, rawCount, rawSides, sign, rawModifier] = match
  const count = rawCount === '' || rawCount === undefined ? 1 : Number.parseInt(rawCount, 10)
  const sides = Number.parseInt(rawSides ?? '', 10)

  if (!Number.isFinite(count) || !Number.isFinite(sides) || count < 1 || sides < 1) {
    return null
  }

  const magnitude = rawModifier === undefined ? 0 : Number.parseInt(rawModifier, 10)
  const modifier = sign === '-' ? -magnitude : magnitude

  return { count, sides, modifier }
}

/**
 * Rolls a dice expression.
 *
 * @throws {SyntaxError} when `notation` is not valid dice notation.
 */
export function rollDice(notation: string, random: RandomSource): DiceRollResult {
  const parsed = parseDiceNotation(notation)
  if (!parsed) {
    throw new SyntaxError(`Invalid dice notation: "${notation}"`)
  }

  const rolls = Array.from({ length: parsed.count }, () => random.rollDie(parsed.sides))
  const total = sum(rolls) + parsed.modifier

  return { notation, rolls, modifier: parsed.modifier, total }
}

/** Rolls a d20 test, honouring advantage and disadvantage. */
export function rollD20(modifier: number, mode: RollMode, random: RandomSource): D20RollResult {
  const dice = mode === 'normal' ? [random.rollDie(20)] : [random.rollDie(20), random.rollDie(20)]

  const natural = mode === 'disadvantage' ? Math.min(...dice) : Math.max(...dice)

  return {
    mode,
    dice,
    natural,
    modifier,
    total: natural + modifier,
    isCriticalHit: natural === 20,
    isCriticalMiss: natural === 1,
  }
}

/** Rolls a percentile die, as used by the Wild Magic Surge table. */
export function rollPercentile(random: RandomSource): number {
  return random.rollDie(100)
}

/** Formats a modifier the way a character sheet does: `+3`, `0`, `-1`. */
export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`
}

function sum(values: readonly number[]): number {
  return values.reduce((accumulator, value) => accumulator + value, 0)
}
