import type { AbilityId } from '../types';

export interface AbilityActivationContext {
  readonly now: number;
  readonly impactDash: () => void;
  readonly energyBolt: () => void;
  readonly energyShield: () => void;
  readonly freezePulse: () => void;
  readonly groundSlam: () => void;
  readonly temporaryAnchor: () => void;
}

export interface AbilityDefinition {
  readonly id: AbilityId;
  readonly activate: (context: AbilityActivationContext) => void;
}

export const ABILITY_REGISTRY: Readonly<Record<AbilityId, AbilityDefinition>> = {
  'impact-dash': {
    id: 'impact-dash',
    activate: (context) => context.impactDash(),
  },
  'energy-bolt': {
    id: 'energy-bolt',
    activate: (context) => context.energyBolt(),
  },
  'energy-shield': {
    id: 'energy-shield',
    activate: (context) => context.energyShield(),
  },
  'freeze-pulse': {
    id: 'freeze-pulse',
    activate: (context) => context.freezePulse(),
  },
  'ground-slam': {
    id: 'ground-slam',
    activate: (context) => context.groundSlam(),
  },
  'temporary-anchor': {
    id: 'temporary-anchor',
    activate: (context) => context.temporaryAnchor(),
  },
};

export function activateAbility(id: AbilityId, context: AbilityActivationContext): void {
  ABILITY_REGISTRY[id].activate(context);
}
