import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../src/game/config';
import { PlayerStateMachine } from '../src/game/core/playerStateMachine';

describe('player motion state machine', () => {
  it('supports every required prone transition', () => {
    const grounded = new PlayerStateMachine('grounded-run');
    expect(grounded.transition('prone', 10)).toBe(true);
    expect(grounded.state).toBe('prone');
    expect(grounded.transition('grounded-run', 20)).toBe(true);

    for (const target of ['airborne', 'grappling', 'knockback', 'respawning'] as const) {
      const machine = new PlayerStateMachine('prone');
      expect(machine.transition(target, 30), target).toBe(true);
      expect(machine.state).toBe(target);
    }
  });

  it('supports entering and leaving prone through one direct state', () => {
    const machine = new PlayerStateMachine('grounded-run');
    expect(machine.transition('prone', 10)).toBe(true);
    expect(machine.transition('grounded-run', 320)).toBe(true);
  });

  it('provides a visible prone window for short keyboard taps', () => {
    const machine = new PlayerStateMachine('grounded-run');
    machine.transition('prone', 1_000);
    expect(machine.timeInState(1_000 + MOVEMENT.proneMinimumDurationMs - 1)).toBeLessThan(
      MOVEMENT.proneMinimumDurationMs,
    );
    expect(machine.timeInState(1_000 + MOVEMENT.proneMinimumDurationMs)).toBe(
      MOVEMENT.proneMinimumDurationMs,
    );
  });

  it('keeps player state instances fully isolated', () => {
    const playerOne = new PlayerStateMachine('grounded-run');
    const playerTwo = new PlayerStateMachine('grounded-run');
    playerOne.transition('prone', 100);
    expect(playerOne.state).toBe('prone');
    expect(playerTwo.state).toBe('grounded-run');
  });

  it('does not recreate or re-enter the same state on repeated input', () => {
    const machine = new PlayerStateMachine('grounded-run');
    expect(machine.transition('prone', 100)).toBe(true);
    expect(machine.transition('prone', 120)).toBe(false);
    expect(machine.enteredAt).toBe(100);
  });
});
