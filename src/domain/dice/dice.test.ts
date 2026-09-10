import { describe, expect, it } from 'vitest'
import { formatModifier, parseDiceNotation, rollD20, rollDice } from './dice'
import { createSequenceRandomSource, cryptoRandomSource } from './rng'

describe('parseDiceNotation', () => {
  it('parses a bare die', () => {
    expect(parseDiceNotation('d20')).toEqual({ count: 1, sides: 20, modifier: 0 })
  })

  it('parses a count and sides', () => {
    expect(parseDiceNotation('8d6')).toEqual({ count: 8, sides: 6, modifier: 0 })
  })

  it('parses positive and negative modifiers', () => {
    expect(parseDiceNotation('1d4+1')).toEqual({ count: 1, sides: 4, modifier: 1 })
    expect(parseDiceNotation('1d6-1')).toEqual({ count: 1, sides: 6, modifier: -1 })
  })

  it('tolerates whitespace and capitals', () => {
    expect(parseDiceNotation(' 2 D 10 + 3 ')).toEqual({ count: 2, sides: 10, modifier: 3 })
  })

  it('rejects anything that is not dice notation', () => {
    expect(parseDiceNotation('fireball')).toBeNull()
    expect(parseDiceNotation('0d6')).toBeNull()
    expect(parseDiceNotation('')).toBeNull()
  })
})

describe('rollDice', () => {
  it('rolls one die per count and applies the modifier', () => {
    const random = createSequenceRandomSource([3, 5])
    const result = rollDice('2d6+2', random)

    expect(result.rolls).toEqual([3, 5])
    expect(result.modifier).toBe(2)
    expect(result.total).toBe(10)
  })

  it('rejects invalid notation', () => {
    expect(() => rollDice('nope', cryptoRandomSource)).toThrow(SyntaxError)
  })

  it('keeps every face within range across many rolls', () => {
    for (let index = 0; index < 500; index += 1) {
      const { total } = rollDice('1d20', cryptoRandomSource)
      expect(total).toBeGreaterThanOrEqual(1)
      expect(total).toBeLessThanOrEqual(20)
    }
  })
})

describe('rollD20', () => {
  it('keeps the higher die with advantage', () => {
    const result = rollD20(6, 'advantage', createSequenceRandomSource([7, 15]))

    expect(result.dice).toEqual([7, 15])
    expect(result.natural).toBe(15)
    expect(result.total).toBe(21)
  })

  it('keeps the lower die with disadvantage', () => {
    const result = rollD20(6, 'disadvantage', createSequenceRandomSource([7, 15]))

    expect(result.natural).toBe(7)
    expect(result.total).toBe(13)
  })

  it('rolls a single die when the mode is normal', () => {
    const result = rollD20(0, 'normal', createSequenceRandomSource([11]))
    expect(result.dice).toHaveLength(1)
  })

  it('flags natural twenties and natural ones', () => {
    const critical = rollD20(0, 'normal', createSequenceRandomSource([20]))
    expect(critical.isCriticalHit).toBe(true)
    expect(critical.isCriticalMiss).toBe(false)

    const fumble = rollD20(0, 'normal', createSequenceRandomSource([1]))
    expect(fumble.isCriticalMiss).toBe(true)
  })
})

describe('formatModifier', () => {
  it('signs the number the way a character sheet does', () => {
    expect(formatModifier(3)).toBe('+3')
    expect(formatModifier(0)).toBe('+0')
    expect(formatModifier(-1)).toBe('-1')
  })
})
