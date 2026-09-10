import type { RuleViolation, RuleViolationCode } from '@/domain/turn/types'
import { METAMAGIC_LABEL } from './labels'
import type { MetamagicId } from '@/domain/character/types'

type MessageBuilder = (context: Record<string, string | number>) => string

/**
 * Turns a domain rule code into an explanation the player can act on. Kept
 * apart from the rules themselves so wording changes never touch logic.
 */
const MESSAGES: Readonly<Record<RuleViolationCode, MessageBuilder>> = {
  ONE_SLOT_PER_TURN: () =>
    'Ya gastaste un espacio de conjuro este turno. Solo puedes lanzar trucos.',
  QUICKENED_LOCKOUT: () =>
    'Aceleraste un conjuro este turno: ya no puedes lanzar nada de nivel 1 o superior.',
  QUICKEN_AFTER_LEVELED_SPELL: () =>
    'No puedes acelerar: ya lanzaste un conjuro de nivel 1 o superior este turno.',
  QUICKEN_REQUIRES_ACTION_SPELL: () =>
    'Conjuro Acelerado solo funciona en conjuros que se lanzan con una acción.',
  ACTION_ALREADY_USED: () => 'Ya usaste tu acción este turno.',
  BONUS_ACTION_ALREADY_USED: () => 'Ya usaste tu acción adicional este turno.',
  REACTION_ALREADY_USED: () => 'Ya usaste tu reacción. Vuelve en tu próximo turno.',
  NO_SLOTS_REMAINING: (context) => `No te quedan espacios de nivel ${context.level ?? '?'}.`,
  SLOT_LEVEL_TOO_LOW: (context) =>
    `Ese conjuro necesita al menos un espacio de nivel ${context.required ?? '?'}.`,
  NOT_ENOUGH_SORCERY_POINTS: (context) =>
    `Necesitas ${context.required ?? '?'} puntos de hechicería y tienes ${context.available ?? 0}.`,
  ONE_METAMAGIC_PER_SPELL: () => 'Solo puedes aplicar una metamagia por conjuro.',
  METAMAGIC_NOT_KNOWN: (context) =>
    `No conoces ${METAMAGIC_LABEL[context.metamagic as MetamagicId] ?? 'esa metamagia'}.`,
  DAMAGE_TYPE_NOT_TRANSMUTABLE: () =>
    'Conjuro Transmutado no puede cambiar este daño. Solo convierte entre ácido, frío, fuego, relámpago, veneno y trueno.',
  NO_FREE_USES_REMAINING: (context) =>
    `Ya gastaste el lanzamiento gratuito de ${context.spell ?? 'ese conjuro'} de este descanso largo.`,
}

export function describeViolation(violation: RuleViolation): string {
  return MESSAGES[violation.code](violation.context ?? {})
}

export function describeViolations(violations: readonly RuleViolation[]): string {
  return violations.map(describeViolation).join(' ')
}
