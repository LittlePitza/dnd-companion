/**
 * The character model is deliberately data-driven: every rule in `src/domain`
 * reads from these structures and nothing is hard-coded to a specific hero.
 * Adding a character means adding a data file, not changing logic.
 */

export const ABILITY_IDS = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const

export type AbilityId = (typeof ABILITY_IDS)[number]

export type AbilityScores = Record<AbilityId, number>

export type ProficiencyLevel = 'none' | 'proficient' | 'expertise'

export type SpellLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** Spell levels that consume a slot. Cantrips (level 0) never do. */
export type SlotLevel = Exclude<SpellLevel, 0>

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const

export type DamageType = (typeof DAMAGE_TYPES)[number]

export type CastingTime = 'action' | 'bonus-action' | 'reaction' | 'minute' | 'ritual'

/** When a spent resource comes back. */
export type RechargeRule = 'short-rest' | 'long-rest' | 'turn' | 'manual'

export const SKILL_IDS = [
  'acrobatics',
  'animalHandling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleightOfHand',
  'stealth',
  'survival',
] as const

export type SkillId = (typeof SKILL_IDS)[number]

/** The ability each skill keys off. Fixed by the rules, not by the character. */
export const SKILL_ABILITY: Readonly<Record<SkillId, AbilityId>> = {
  acrobatics: 'dexterity',
  animalHandling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleightOfHand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom',
}

export interface DamageProfile {
  /** Separate damage instances rolled at once — rays, darts, beams. */
  instances: number
  /** Dice notation for a single instance, e.g. `2d6`. */
  dice: string
  type: DamageType
  /** How the spell scales when cast with a higher-level slot. */
  upcast?: {
    /** Extra dice added to every instance per level above base, e.g. Fireball. */
    dicePerLevel?: string
    /** Extra instances per level above base, e.g. Scorching Ray. */
    instancesPerLevel?: number
  }
}

export interface SpellSave {
  ability: AbilityId
  /** Half damage on a successful save. */
  halfOnSuccess: boolean
}

export interface LimitedUse {
  max: number
  recharge: RechargeRule
}

export interface Spell {
  id: string
  /** Display name in the table's language. */
  name: string
  /** English name, for cross-referencing D&D Beyond and rulebooks. */
  englishName: string
  level: SpellLevel
  /**
   * Where the spell comes from. Class features such as Innate Sorcery and
   * Wild Magic Surge only apply to `class` spells, never to feat-granted ones.
   */
  origin: 'class' | 'feat' | 'species'
  castingTime: CastingTime
  range: string
  components: string
  duration: string
  concentration: boolean
  ritual: boolean
  /** Whether the spell requires an attack roll (and so benefits from Spell Sniper). */
  attackRoll: boolean
  save?: SpellSave
  damage?: DamageProfile
  /** Automatically hits — no attack roll, no saving throw (e.g. Magic Missile). */
  autoHit?: boolean
  /** One-line summary rendered on the collapsed row. */
  summary: string
  /** Tactical guidance shown when the row is expanded. */
  usage: string
  /** A caveat worth remembering at the table. */
  caution?: string
  /** Free castings granted by a feat, independent of spell slots. */
  freeUses?: LimitedUse
}

export interface Weapon {
  id: string
  name: string
  englishName: string
  /** Ability used for the attack and damage rolls. */
  ability: AbilityId
  proficient: boolean
  damage: DamageProfile
  range: string
  properties: string[]
  notes?: string
}

export interface ResourceDefinition {
  id: string
  name: string
  /** Short label used in the compact vitals bar. */
  shortName: string
  max: number
  recharge: RechargeRule
  description?: string
}

/**
 * A resource refund a short rest can buy, such as the sorcerer's Sorcerous
 * Restoration. Kept as data so the rest logic never names a specific feature.
 */
export interface ShortRestBenefit {
  id: string
  name: string
  description: string
  /** The limited-use resource consumed to claim the benefit. */
  costResourceId: string
  /** The resource replenished. */
  grantsResourceId: string
  /** How much of `grantsResourceId` comes back, capped at its maximum. */
  amount: number
}

export interface CharacterFeature {
  id: string
  name: string
  englishName?: string
  /** Where the feature comes from, e.g. `Hechicero 2` or `Dote de origen`. */
  source: string
  description: string
  /** Links the feature to the resource it spends, when there is one. */
  resourceId?: string
}

export interface EquipmentItem {
  name: string
  quantity: number
  /** Weight of a single unit, in pounds. */
  weight: number
  notes?: string
}

export interface Currency {
  copper: number
  silver: number
  electrum: number
  gold: number
  platinum: number
}

/**
 * A toggleable buff — Mage Armor, Innate Sorcery, Shield. Modelled as data so
 * derived statistics recompute from whatever is currently active.
 */
export interface EffectDefinition {
  id: string
  name: string
  description: string
  duration: string
  modifiers: {
    /** Replaces the number Dexterity is added to for AC, e.g. Mage Armor's 13. */
    armorClassBase?: number
    /** Flat AC bonus that stacks, e.g. Shield's +5. */
    armorClassBonus?: number
    /** Raises the spell save DC, e.g. Innate Sorcery's +1. */
    spellSaveDcBonus?: number
    /** Grants advantage on attack rolls made with the character's class spells. */
    advantageOnClassSpellAttacks?: boolean
  }
  /** Consumes a resource while active, e.g. an Innate Sorcery use. */
  resourceId?: string
  /** Activating it costs the bonus action, as Innate Sorcery does. */
  costsBonusAction?: boolean
}

/** A pre-planned turn the player can look up mid-combat. */
export interface TacticalPlay {
  id: string
  category: string
  situation: string
  bonusAction: string
  action: string
  cost: string
  note: string
}

export interface SpellcastingProfile {
  ability: AbilityId
  /** Maximum slots per level. Absent levels mean the character has none. */
  slots: Partial<Record<SlotLevel, number>>
  /**
   * Extra range, in feet, added to spells that require an attack roll.
   * Granted by the Spell Sniper feat.
   */
  attackRangeBonus: number
  /** Metamagic options the character knows. */
  metamagic: MetamagicId[]
}

export const METAMAGIC_IDS = ['quickened', 'transmuted', 'careful', 'distant', 'empowered'] as const

export type MetamagicId = (typeof METAMAGIC_IDS)[number]

export interface Character {
  id: string
  name: string
  playerName?: string
  className: string
  subclass?: string
  level: number
  species: string
  background: string
  alignment?: string
  size: string
  experience?: number
  proficiencyBonus: number

  abilities: AbilityScores
  savingThrowProficiencies: readonly AbilityId[]
  skillProficiencies: Readonly<Partial<Record<SkillId, ProficiencyLevel>>>

  /**
   * The number Dexterity is added to for Armour Class while unarmoured — `10`
   * for most characters. Effects such as Mage Armor raise this base to 13.
   */
  armorClassBase: number
  maxHitPoints: number
  hitDice: { count: number; sides: number }
  /** Walking speed in feet. */
  speed: number

  spellcasting?: SpellcastingProfile
  spells: readonly Spell[]
  weapons: readonly Weapon[]
  resources: readonly ResourceDefinition[]
  shortRestBenefits: readonly ShortRestBenefit[]
  effects: readonly EffectDefinition[]
  features: readonly CharacterFeature[]
  equipment: readonly EquipmentItem[]
  currency: Currency
  languages: readonly string[]
  proficiencies: {
    armor: readonly string[]
    weapons: readonly string[]
    tools: readonly string[]
  }
  tactics: readonly TacticalPlay[]
  /** Free-form notes that belong to the sheet rather than the campaign log. */
  notes?: readonly string[]
}
