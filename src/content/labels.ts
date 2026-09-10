import type {
  AbilityId,
  CastingTime,
  DamageType,
  MetamagicId,
  SkillId,
} from '@/domain/character/types'
import type { MemoryCategory } from '@/store/useMemoriesStore'

/**
 * Table-facing copy lives here, isolated from the rules. The domain speaks in
 * stable English identifiers; this module is the only place that turns them
 * into the language the group plays in.
 */

export const ABILITY_LABEL: Readonly<Record<AbilityId, string>> = {
  strength: 'Fuerza',
  dexterity: 'Destreza',
  constitution: 'Constitución',
  intelligence: 'Inteligencia',
  wisdom: 'Sabiduría',
  charisma: 'Carisma',
}

export const ABILITY_SHORT_LABEL: Readonly<Record<AbilityId, string>> = {
  strength: 'FUE',
  dexterity: 'DES',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'SAB',
  charisma: 'CAR',
}

export const SKILL_LABEL: Readonly<Record<SkillId, string>> = {
  acrobatics: 'Acrobacias',
  animalHandling: 'Trato con animales',
  arcana: 'Conocimiento arcano',
  athletics: 'Atletismo',
  deception: 'Engaño',
  history: 'Historia',
  insight: 'Perspicacia',
  intimidation: 'Intimidación',
  investigation: 'Investigación',
  medicine: 'Medicina',
  nature: 'Naturaleza',
  perception: 'Percepción',
  performance: 'Interpretación',
  persuasion: 'Persuasión',
  religion: 'Religión',
  sleightOfHand: 'Juego de manos',
  stealth: 'Sigilo',
  survival: 'Supervivencia',
}

export const DAMAGE_TYPE_LABEL: Readonly<Record<DamageType, string>> = {
  acid: 'ácido',
  bludgeoning: 'contundente',
  cold: 'frío',
  fire: 'fuego',
  force: 'fuerza',
  lightning: 'relámpago',
  necrotic: 'necrótico',
  piercing: 'perforante',
  poison: 'veneno',
  psychic: 'psíquico',
  radiant: 'radiante',
  slashing: 'cortante',
  thunder: 'trueno',
}

export const CASTING_TIME_LABEL: Readonly<Record<CastingTime, string>> = {
  action: '1 acción',
  'bonus-action': 'Acción adicional',
  reaction: '1 reacción',
  minute: '1 minuto',
  ritual: 'Ritual',
}

export const METAMAGIC_LABEL: Readonly<Record<MetamagicId, string>> = {
  quickened: 'Conjuro Acelerado',
  transmuted: 'Conjuro Transmutado',
  careful: 'Conjuro Cuidadoso',
  distant: 'Conjuro Distante',
  empowered: 'Conjuro Potenciado',
}

export const SPELL_LEVEL_LABEL = (level: number): string =>
  level === 0 ? 'Trucos · a voluntad' : `Nivel ${level}`

export const ROLL_MODE_LABEL = {
  normal: 'Normal',
  advantage: 'Con ventaja',
  disadvantage: 'Con desventaja',
} as const

export const MEMORY_CATEGORY_LABEL: Readonly<Record<MemoryCategory, string>> = {
  session: 'Sesión',
  npc: 'PNJ',
  place: 'Lugar',
  deal: 'Trato',
  loot: 'Botín',
  clue: 'Pista',
  surge: 'Oleada',
  other: 'Otro',
}
