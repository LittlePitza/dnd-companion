import { useMemo } from 'react'
import { resolveCharacter } from '@/data/characters'
import type { Character, EffectDefinition } from '@/domain/character/types'
import {
  armorClass,
  concentrationModifier,
  initiativeModifier,
  spellAttackBonus,
  spellSaveDc,
} from '@/domain/character/derived'
import type { PlaySessionState } from '@/domain/session/types'
import { useCampaignStore } from './useCampaignStore'

/** The character currently in play. */
export function useActiveCharacter(): Character {
  const characterId = useCampaignStore((state) => state.activeCharacterId)
  return useMemo(() => resolveCharacter(characterId), [characterId])
}

export function useSession(): PlaySessionState {
  return useCampaignStore((state) => state.session)
}

/** The combined effect of everything currently switched on. */
export interface EffectModifiers {
  armorClassBase: number | undefined
  armorClassBonus: number
  spellSaveDcBonus: number
  advantageOnClassSpellAttacks: boolean
  active: EffectDefinition[]
}

export function useEffectModifiers(): EffectModifiers {
  const character = useActiveCharacter()
  const activeIds = useCampaignStore((state) => state.session.activeEffectIds)

  return useMemo(() => {
    const active = character.effects.filter((effect) => activeIds.includes(effect.id))

    return active.reduce<EffectModifiers>(
      (accumulator, effect) => ({
        armorClassBase: effect.modifiers.armorClassBase ?? accumulator.armorClassBase,
        armorClassBonus: accumulator.armorClassBonus + (effect.modifiers.armorClassBonus ?? 0),
        spellSaveDcBonus: accumulator.spellSaveDcBonus + (effect.modifiers.spellSaveDcBonus ?? 0),
        advantageOnClassSpellAttacks:
          accumulator.advantageOnClassSpellAttacks ||
          (effect.modifiers.advantageOnClassSpellAttacks ?? false),
        active,
      }),
      {
        armorClassBase: undefined,
        armorClassBonus: 0,
        spellSaveDcBonus: 0,
        advantageOnClassSpellAttacks: false,
        active,
      },
    )
  }, [character, activeIds])
}

/** Headline numbers, already adjusted for whatever is currently active. */
export interface CombatStats {
  armorClass: number
  baseArmorClass: number
  spellSaveDc: number | null
  baseSpellSaveDc: number | null
  spellAttackBonus: number | null
  initiative: number
  concentration: number
  hasAdvantageOnClassSpellAttacks: boolean
}

export function useCombatStats(): CombatStats {
  const character = useActiveCharacter()
  const effects = useEffectModifiers()

  return useMemo(
    () => ({
      armorClass: armorClass(character, effects.armorClassBase, effects.armorClassBonus),
      baseArmorClass: armorClass(character),
      spellSaveDc: spellSaveDc(character, effects.spellSaveDcBonus),
      baseSpellSaveDc: spellSaveDc(character),
      spellAttackBonus: spellAttackBonus(character),
      initiative: initiativeModifier(character),
      concentration: concentrationModifier(character),
      hasAdvantageOnClassSpellAttacks: effects.advantageOnClassSpellAttacks,
    }),
    [character, effects],
  )
}
