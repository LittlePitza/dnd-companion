import { describe, expect, it } from 'vitest'
import { sorynVort } from '@/data/characters/sorynVort'
import {
  abilityModifier,
  armorClass,
  boostedSpellRangeFeet,
  carryingCapacity,
  concentrationModifier,
  initiativeModifier,
  passiveSkillScore,
  pushDragLiftCapacity,
  savingThrowModifier,
  scaleDamage,
  skillModifier,
  spellAttackBonus,
  spellSaveDc,
  totalCarriedWeight,
  weaponAttackBonus,
  weaponDamageModifier,
} from './derived'
import type { DamageProfile, Spell } from './types'

/**
 * These assertions mirror Soryn's official sheet. If a number here changes, the
 * character data drifted from the sheet the player actually uses at the table.
 */
describe('abilityModifier', () => {
  it('follows the 5e table', () => {
    expect(abilityModifier(8)).toBe(-1)
    expect(abilityModifier(10)).toBe(0)
    expect(abilityModifier(11)).toBe(0)
    expect(abilityModifier(13)).toBe(1)
    expect(abilityModifier(15)).toBe(2)
    expect(abilityModifier(16)).toBe(3)
  })
})

describe("Soryn Vort's derived statistics", () => {
  it('matches the saving throws on the sheet', () => {
    expect(savingThrowModifier(sorynVort, 'constitution')).toBe(5)
    expect(savingThrowModifier(sorynVort, 'charisma')).toBe(6)
    expect(savingThrowModifier(sorynVort, 'dexterity')).toBe(1)
    expect(savingThrowModifier(sorynVort, 'strength')).toBe(-1)
  })

  it('matches the skill modifiers on the sheet', () => {
    expect(skillModifier(sorynVort, 'deception')).toBe(6)
    expect(skillModifier(sorynVort, 'persuasion')).toBe(6)
    expect(skillModifier(sorynVort, 'intimidation')).toBe(6)
    expect(skillModifier(sorynVort, 'perception')).toBe(4)
    expect(skillModifier(sorynVort, 'sleightOfHand')).toBe(4)
    expect(skillModifier(sorynVort, 'nature')).toBe(3)
    expect(skillModifier(sorynVort, 'performance')).toBe(3)
    expect(skillModifier(sorynVort, 'athletics')).toBe(-1)
    expect(skillModifier(sorynVort, 'arcana')).toBe(0)
  })

  it('matches the passive scores noted on the sheet', () => {
    expect(passiveSkillScore(sorynVort, 'perception')).toBe(14)
    expect(passiveSkillScore(sorynVort, 'insight')).toBe(14)
    expect(passiveSkillScore(sorynVort, 'investigation')).toBe(10)
  })

  it('computes spell DC 14 and attack bonus +6', () => {
    expect(spellSaveDc(sorynVort)).toBe(14)
    expect(spellAttackBonus(sorynVort)).toBe(6)
  })

  it('raises the DC to 15 while Innate Sorcery is active', () => {
    expect(spellSaveDc(sorynVort, 1)).toBe(15)
  })

  it('has initiative +1 and concentration +5', () => {
    expect(initiativeModifier(sorynVort)).toBe(1)
    expect(concentrationModifier(sorynVort)).toBe(5)
  })

  it('is AC 11 unarmoured and 14 under Mage Armor, 19 with Shield', () => {
    expect(armorClass(sorynVort)).toBe(11)
    expect(armorClass(sorynVort, 13)).toBe(14)
    expect(armorClass(sorynVort, 13, 5)).toBe(19)
  })

  it('matches the weapon attack and damage bonuses on the sheet', () => {
    const [dagger, spear, unarmed] = sorynVort.weapons
    expect(dagger && weaponAttackBonus(sorynVort, dagger)).toBe(4)
    expect(dagger && weaponDamageModifier(sorynVort, dagger)).toBe(1)
    expect(spear && weaponAttackBonus(sorynVort, spear)).toBe(2)
    expect(spear && weaponDamageModifier(sorynVort, spear)).toBe(-1)
    expect(unarmed && weaponAttackBonus(sorynVort, unarmed)).toBe(2)
  })

  it('matches the carrying figures on the sheet', () => {
    expect(carryingCapacity(sorynVort)).toBe(120)
    expect(pushDragLiftCapacity(sorynVort)).toBe(240)
    expect(totalCarriedWeight(sorynVort)).toBeCloseTo(76, 1)
  })
})

describe('boostedSpellRangeFeet (Spell Sniper)', () => {
  const spellNamed = (id: string): Spell => {
    const spell = sorynVort.spells.find((candidate) => candidate.id === id)
    if (!spell) throw new Error(`Missing fixture spell: ${id}`)
    return spell
  }

  it('extends attack-roll spells by 60 feet', () => {
    expect(boostedSpellRangeFeet(sorynVort, spellNamed('fire-bolt'))).toBe(180)
    expect(boostedSpellRangeFeet(sorynVort, spellNamed('poison-spray'))).toBe(90)
    expect(boostedSpellRangeFeet(sorynVort, spellNamed('scorching-ray'))).toBe(180)
  })

  it('leaves saving-throw spells alone', () => {
    expect(boostedSpellRangeFeet(sorynVort, spellNamed('fireball'))).toBeNull()
    expect(boostedSpellRangeFeet(sorynVort, spellNamed('mind-sliver'))).toBeNull()
  })
})

describe('scaleDamage', () => {
  it('adds dice per level, as Fireball does', () => {
    const fireball: DamageProfile = {
      instances: 1,
      dice: '8d6',
      type: 'fire',
      upcast: { dicePerLevel: '1d6' },
    }

    expect(scaleDamage(fireball, 3, 3).dice).toBe('8d6')
    expect(scaleDamage(fireball, 3, 5).dice).toBe('10d6')
  })

  it('adds instances per level, as Scorching Ray and Magic Missile do', () => {
    const scorchingRay: DamageProfile = {
      instances: 3,
      dice: '2d6',
      type: 'fire',
      upcast: { instancesPerLevel: 1 },
    }

    expect(scaleDamage(scorchingRay, 2, 3).instances).toBe(4)
    expect(scaleDamage(scorchingRay, 2, 2).instances).toBe(3)
  })

  it('gives Magic Missile five darts from a level 3 slot', () => {
    const magicMissile = sorynVort.spells.find((spell) => spell.id === 'magic-missile')?.damage
    expect(magicMissile).toBeDefined()
    expect(scaleDamage(magicMissile!, 1, 3).instances).toBe(5)
  })
})
