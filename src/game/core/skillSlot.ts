import { ABILITIES } from '../config';
import type { AbilityId } from '../types';

export interface SkillUseResult {
  readonly used: boolean;
  readonly ability: AbilityId | null;
  readonly readyAt: number;
}

export class SkillSlot {
  ability: AbilityId | null = null;
  readyAt = 0;

  equip(ability: AbilityId): void {
    this.ability = ability;
    this.readyAt = 0;
  }

  clear(): void {
    this.ability = null;
    this.readyAt = 0;
  }

  isReady(now: number): boolean {
    return this.ability !== null && now >= this.readyAt;
  }

  use(now: number, cooldownScale = 1): SkillUseResult {
    if (!this.ability || !this.isReady(now)) {
      return { used: false, ability: this.ability, readyAt: this.readyAt };
    }
    const ability = this.ability;
    this.readyAt = now + ABILITIES[ability].cooldownMs * cooldownScale;
    return { used: true, ability, readyAt: this.readyAt };
  }

  remaining(now: number): number {
    return Math.max(0, this.readyAt - now);
  }
}
