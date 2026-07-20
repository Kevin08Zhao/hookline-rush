export interface DamageResult {
  readonly applied: boolean;
  readonly shieldConsumed: boolean;
  readonly died: boolean;
  readonly health: number;
}

export class HealthModel {
  health: number;
  invulnerableUntil = 0;
  shieldUntil = 0;

  constructor(readonly maxHealth = 100) {
    this.health = maxHealth;
  }

  takeDamage(amount: number, now: number, invulnerabilityMs: number): DamageResult {
    if (now < this.invulnerableUntil) {
      return { applied: false, shieldConsumed: false, died: false, health: this.health };
    }

    if (now < this.shieldUntil) {
      this.shieldUntil = 0;
      this.invulnerableUntil = now + 220;
      return { applied: false, shieldConsumed: true, died: false, health: this.health };
    }

    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.invulnerableUntil = now + invulnerabilityMs;
    return {
      applied: true,
      shieldConsumed: false,
      died: this.health === 0,
      health: this.health,
    };
  }

  heal(amount: number): number {
    this.health = Math.min(this.maxHealth, this.health + Math.max(0, amount));
    return this.health;
  }

  activateShield(now: number, durationMs: number): void {
    this.shieldUntil = Math.max(this.shieldUntil, now + durationMs);
  }

  reset(now = 0): void {
    this.health = this.maxHealth;
    this.invulnerableUntil = now + 1100;
    this.shieldUntil = 0;
  }
}

export type FailureAction = 'game-over' | 'race-respawn' | 'recover-checkpoint';

export function resolveFailure(mode: 'solo' | 'race', healthAfterDamage: number): FailureAction {
  if (healthAfterDamage > 0) return 'recover-checkpoint';
  return mode === 'solo' ? 'game-over' : 'race-respawn';
}
