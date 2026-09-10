import { useMemo } from 'react'
import {
  boostedSpellRangeFeet,
  spellAttackBonus,
  weaponAttackBonus,
  weaponDamageModifier,
} from '@/domain/character/derived'
import type { DamageProfile } from '@/domain/character/types'
import { useActiveCharacter, useCombatStats } from '@/store/selectors'

/** A weapon or an attack-roll spell, flattened into one shape the list can render. */
export interface AttackOption {
  id: string
  name: string
  englishName: string
  kind: 'weapon' | 'spell'
  attackBonus: number
  damage: DamageProfile
  /** Added to each damage instance — a weapon's ability modifier. */
  damageBonus: number
  range: string
  properties: readonly string[]
  notes?: string
  /** The attack currently rolls with advantage, e.g. under Innate Sorcery. */
  hasAdvantage: boolean
  /** Spending a spell slot is required, so casting belongs in the Spells tab. */
  requiresSlot: boolean
}

/**
 * Everything the character can attack with, in the order a sheet lists it:
 * damaging cantrips first, then levelled attack spells, then weapons.
 */
export function useAttackOptions(): AttackOption[] {
  const character = useActiveCharacter()
  const stats = useCombatStats()

  return useMemo(() => {
    const spellBonus = spellAttackBonus(character)

    const spellAttacks: AttackOption[] =
      spellBonus === null
        ? []
        : character.spells
            .filter((spell) => spell.attackRoll && spell.damage)
            .map((spell) => {
              const boostedRange = boostedSpellRangeFeet(character, spell)
              return {
                id: `spell-${spell.id}`,
                name: spell.name,
                englishName: spell.englishName,
                kind: 'spell' as const,
                attackBonus: spellBonus,
                damage: spell.damage!,
                damageBonus: 0,
                range: boostedRange !== null ? `${boostedRange} pies` : spell.range,
                properties: spell.level === 0 ? ['Truco'] : [`Nivel ${spell.level}`],
                ...(spell.caution ? { notes: spell.caution } : {}),
                // Class features such as Innate Sorcery never reach feat-granted spells.
                hasAdvantage: stats.hasAdvantageOnClassSpellAttacks && spell.origin === 'class',
                requiresSlot: spell.level > 0,
              }
            })
            .sort((left, right) => Number(left.requiresSlot) - Number(right.requiresSlot))

    const weaponAttacks: AttackOption[] = character.weapons.map((weapon) => ({
      id: `weapon-${weapon.id}`,
      name: weapon.name,
      englishName: weapon.englishName,
      kind: 'weapon' as const,
      attackBonus: weaponAttackBonus(character, weapon),
      damage: weapon.damage,
      damageBonus: weaponDamageModifier(character, weapon),
      range: weapon.range,
      properties: weapon.properties,
      ...(weapon.notes ? { notes: weapon.notes } : {}),
      hasAdvantage: false,
      requiresSlot: false,
    }))

    return [...spellAttacks, ...weaponAttacks]
  }, [character, stats.hasAdvantageOnClassSpellAttacks])
}
