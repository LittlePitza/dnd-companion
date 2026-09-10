import type {
  AbilityId,
  Character,
  DamageProfile,
  SkillId,
  SlotLevel,
  Spell,
  Weapon,
} from './types'
import { SKILL_ABILITY } from './types'

/**
 * Every number a player reads off a character sheet is derived here from the
 * raw scores. Nothing downstream stores a pre-computed bonus, so the sheet can
 * never disagree with itself.
 */

/** The 5e ability modifier: `floor((score - 10) / 2)`. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function abilityModifierOf(character: Character, ability: AbilityId): number {
  return abilityModifier(character.abilities[ability])
}

export function savingThrowModifier(character: Character, ability: AbilityId): number {
  const proficient = character.savingThrowProficiencies.includes(ability)
  return abilityModifierOf(character, ability) + (proficient ? character.proficiencyBonus : 0)
}

export function isSavingThrowProficient(character: Character, ability: AbilityId): boolean {
  return character.savingThrowProficiencies.includes(ability)
}

export function skillModifier(character: Character, skill: SkillId): number {
  const ability = SKILL_ABILITY[skill]
  const proficiency = character.skillProficiencies[skill] ?? 'none'

  const multiplier = proficiency === 'expertise' ? 2 : proficiency === 'proficient' ? 1 : 0
  return abilityModifierOf(character, ability) + character.proficiencyBonus * multiplier
}

/** Passive scores are `10 + the relevant modifier`. */
export function passiveSkillScore(character: Character, skill: SkillId): number {
  return 10 + skillModifier(character, skill)
}

export function initiativeModifier(character: Character): number {
  return abilityModifierOf(character, 'dexterity')
}

/**
 * Armour Class: `base + Dexterity modifier + flat bonuses`.
 *
 * @param baseOverride raised base from an effect such as Mage Armor (13).
 * @param flatBonus    stacking bonus from an effect such as Shield (+5).
 */
export function armorClass(character: Character, baseOverride?: number, flatBonus = 0): number {
  const base = baseOverride ?? character.armorClassBase
  return base + abilityModifierOf(character, 'dexterity') + flatBonus
}

/**
 * Spell save DC: `8 + proficiency bonus + spellcasting ability modifier`.
 *
 * @param bonus extra DC from an active feature, such as Innate Sorcery's +1.
 */
export function spellSaveDc(character: Character, bonus = 0): number | null {
  if (!character.spellcasting) return null
  const ability = abilityModifierOf(character, character.spellcasting.ability)
  return 8 + character.proficiencyBonus + ability + bonus
}

/** Spell attack bonus: `proficiency bonus + spellcasting ability modifier`. */
export function spellAttackBonus(character: Character): number | null {
  if (!character.spellcasting) return null
  const ability = abilityModifierOf(character, character.spellcasting.ability)
  return character.proficiencyBonus + ability
}

/** Concentration saves are Constitution saving throws. */
export function concentrationModifier(character: Character): number {
  return savingThrowModifier(character, 'constitution')
}

export function weaponAttackBonus(character: Character, weapon: Weapon): number {
  const ability = abilityModifierOf(character, weapon.ability)
  return ability + (weapon.proficient ? character.proficiencyBonus : 0)
}

/** Weapons add their ability modifier to damage; spells generally do not. */
export function weaponDamageModifier(character: Character, weapon: Weapon): number {
  return abilityModifierOf(character, weapon.ability)
}

/** Carrying capacity in pounds: `Strength score x 15`. */
export function carryingCapacity(character: Character): number {
  return character.abilities.strength * 15
}

/** Maximum weight the character can push, drag or lift: `Strength score x 30`. */
export function pushDragLiftCapacity(character: Character): number {
  return character.abilities.strength * 30
}

export function totalCarriedWeight(character: Character): number {
  return character.equipment.reduce((total, item) => total + item.quantity * item.weight, 0)
}

export function isEncumbered(character: Character): boolean {
  return totalCarriedWeight(character) > carryingCapacity(character)
}

/**
 * Scales a damage profile for the slot it is cast with.
 *
 * Two scaling shapes exist: extra dice on every instance (Fireball) and extra
 * instances (Scorching Ray, Magic Missile).
 */
export function scaleDamage(
  damage: DamageProfile,
  baseLevel: number,
  castLevel: number,
): DamageProfile {
  const levelsAbove = Math.max(0, castLevel - baseLevel)
  if (levelsAbove === 0 || !damage.upcast) return damage

  const scaled: DamageProfile = { ...damage }

  if (damage.upcast.instancesPerLevel) {
    scaled.instances = damage.instances + damage.upcast.instancesPerLevel * levelsAbove
  }

  if (damage.upcast.dicePerLevel) {
    scaled.dice = addDice(damage.dice, damage.upcast.dicePerLevel, levelsAbove)
  }

  return scaled
}

/**
 * Effective range of a spell in feet, applying the Spell Sniper bonus.
 *
 * The bonus only applies to spells that require an attack roll and have a
 * range of at least 10 feet, so saving-throw spells such as Fireball are
 * deliberately left untouched.
 *
 * @returns the boosted range, or `null` when the spell does not qualify.
 */
export function boostedSpellRangeFeet(character: Character, spell: Spell): number | null {
  const bonus = character.spellcasting?.attackRangeBonus ?? 0
  if (bonus <= 0 || !spell.attackRoll) return null

  const baseRange = parseRangeInFeet(spell.range)
  if (baseRange === null || baseRange < 10) return null

  return baseRange + bonus
}

/** Slot levels the character has, ascending. */
export function availableSlotLevels(character: Character): SlotLevel[] {
  const slots = character.spellcasting?.slots
  if (!slots) return []

  return Object.entries(slots)
    .filter(([, max]) => (max ?? 0) > 0)
    .map(([level]) => Number(level) as SlotLevel)
    .sort((a, b) => a - b)
}

/** Reads the leading number out of a range string such as `120 pies`. */
function parseRangeInFeet(range: string): number | null {
  const match = /(\d+)/.exec(range)
  if (!match?.[1]) return null
  return Number.parseInt(match[1], 10)
}

/**
 * Adds `multiplier` copies of `increment` onto `base`, both in `XdY` form.
 * Only dice of the same size can be combined, which is always the case for
 * official upcast rules.
 */
function addDice(base: string, increment: string, multiplier: number): string {
  const basePattern = /^(\d+)d(\d+)$/.exec(base)
  const incrementPattern = /^(\d+)d(\d+)$/.exec(increment)
  if (!basePattern || !incrementPattern) return base

  const baseCount = Number.parseInt(basePattern[1] ?? '0', 10)
  const baseSides = basePattern[2]
  const incrementCount = Number.parseInt(incrementPattern[1] ?? '0', 10)
  const incrementSides = incrementPattern[2]

  if (baseSides !== incrementSides) return base

  return `${baseCount + incrementCount * multiplier}d${baseSides}`
}
