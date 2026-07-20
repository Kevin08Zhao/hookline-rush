export type PlayerMotionState =
  | 'grounded-run'
  | 'prone'
  | 'airborne'
  | 'grappling'
  | 'knockback'
  | 'respawning';

const TRANSITIONS: Readonly<Record<PlayerMotionState, readonly PlayerMotionState[]>> = {
  'grounded-run': ['prone', 'airborne', 'grappling', 'knockback', 'respawning'],
  prone: ['grounded-run', 'airborne', 'grappling', 'knockback', 'respawning'],
  airborne: ['grounded-run', 'prone', 'grappling', 'knockback', 'respawning'],
  grappling: ['grounded-run', 'prone', 'airborne', 'knockback', 'respawning'],
  knockback: ['grounded-run', 'prone', 'airborne', 'grappling', 'respawning'],
  respawning: ['grounded-run', 'airborne'],
};

export class PlayerStateMachine {
  state: PlayerMotionState;
  enteredAt: number;

  constructor(initialState: PlayerMotionState = 'airborne', now = 0) {
    this.state = initialState;
    this.enteredAt = now;
  }

  canTransition(next: PlayerMotionState): boolean {
    return next === this.state || TRANSITIONS[this.state].includes(next);
  }

  transition(next: PlayerMotionState, now: number): boolean {
    if (next === this.state || !this.canTransition(next)) return false;
    this.state = next;
    this.enteredAt = now;
    return true;
  }

  timeInState(now: number): number {
    return Math.max(0, now - this.enteredAt);
  }
}
