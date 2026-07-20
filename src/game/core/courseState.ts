import type { AbilityId, CourseId, EnemySpec, PickupSpec } from '../types';

export class CourseState {
  readonly collected = new Set<string>();
  readonly defeated = new Set<string>();
  readonly frozenUntil = new Map<string, number>();

  constructor(
    readonly owner: CourseId,
    readonly pickups: readonly PickupSpec[],
    readonly enemies: readonly EnemySpec[],
  ) {}

  collect(id: string): PickupSpec | null {
    if (this.collected.has(id)) return null;
    const pickup = this.pickups.find((candidate) => candidate.id === id) ?? null;
    if (pickup) this.collected.add(id);
    return pickup;
  }

  defeat(id: string): boolean {
    if (!this.enemies.some((enemy) => enemy.id === id) || this.defeated.has(id)) return false;
    this.defeated.add(id);
    return true;
  }

  freeze(id: string, until: number): void {
    if (this.enemies.some((enemy) => enemy.id === id) && !this.defeated.has(id)) {
      this.frozenUntil.set(id, until);
    }
  }

  resetTemporarySkill(_ability: AbilityId | null): null {
    return null;
  }
}
