/**
 * Randomness is modelled as an explicit port so every rule that depends on a
 * die roll stays deterministic under test. Production code injects
 * {@link cryptoRandomSource}; tests inject a scripted sequence.
 */
export interface RandomSource {
  /** Returns a uniformly distributed integer in the inclusive range `[1, sides]`. */
  rollDie(sides: number): number
}

const MAX_UINT32 = 0xffffffff

/**
 * Rejection sampling over `crypto.getRandomValues` keeps the distribution
 * uniform: a plain modulo would bias the low faces of the die.
 */
function nextUnbiasedInt(sides: number): number {
  const limit = Math.floor((MAX_UINT32 + 1) / sides) * sides
  const buffer = new Uint32Array(1)

  let value: number
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0] ?? 0
  } while (value >= limit)

  return (value % sides) + 1
}

function assertValidDie(sides: number): void {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new RangeError(`A die must have a positive whole number of sides, received: ${sides}`)
  }
}

/** The production randomness source, backed by the Web Crypto API. */
export const cryptoRandomSource: RandomSource = {
  rollDie(sides) {
    assertValidDie(sides)
    if (typeof crypto?.getRandomValues === 'function') {
      return nextUnbiasedInt(sides)
    }
    return Math.floor(Math.random() * sides) + 1
  },
}

/**
 * Replays a fixed sequence of die faces, cycling once exhausted. Test-only
 * helper that makes rule assertions reproducible.
 */
export function createSequenceRandomSource(sequence: readonly number[]): RandomSource {
  if (sequence.length === 0) {
    throw new RangeError('A sequence random source needs at least one value')
  }

  let cursor = 0
  return {
    rollDie() {
      const value = sequence[cursor % sequence.length] ?? 1
      cursor += 1
      return value
    },
  }
}
