import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../src/game/config';
import { isWithinCoyoteWindow, JumpTapState } from '../src/game/core/jumpTap';

const tuning = {
  doubleTapWindowMs: MOVEMENT.doubleTapWindowMs,
  doubleTapUpgradeCutoffMs: MOVEMENT.doubleTapUpgradeCutoffMs,
  jumpBufferMs: MOVEMENT.jumpBufferMs,
};

function startSmallJump(state: JumpTapState, pressAt = 1_000, takeoffAt = pressAt): void {
  expect(state.press(pressAt)).toBe('buffered');
  expect(state.hasBufferedPress(takeoffAt)).toBe(true);
  expect(state.consumeTakeoff(takeoffAt)).not.toBeNull();
}

describe('single-tap and double-tap jump state', () => {
  it('makes the first press immediately available for a small jump', () => {
    const state = new JumpTapState(tuning);
    expect(state.press(1_000)).toBe('buffered');
    expect(state.consumeTakeoff(1_000)).toBe(1);
    expect(state.snapshot().upgraded).toBe(false);
  });

  it('never upgrades a single press by waiting', () => {
    const state = new JumpTapState(tuning);
    startSmallJump(state);
    expect(state.canApplyUpgrade(1_150, -2)).toBe(false);
    expect(state.snapshot().upgraded).toBe(false);
  });

  it('upgrades exactly once after a real release and timely second press', () => {
    const state = new JumpTapState(tuning);
    startSmallJump(state);
    state.release();
    expect(state.press(1_170)).toBe('upgrade');
    expect(state.canApplyUpgrade(1_170, -2)).toBe(true);
    expect(state.press(1_190)).toBe('ignored');
  });

  it('rejects late taps, held-button repeat, and a third boost', () => {
    const late = new JumpTapState(tuning);
    startSmallJump(late);
    late.release();
    expect(late.press(1_000 + MOVEMENT.doubleTapWindowMs + 1)).not.toBe('upgrade');

    const repeated = new JumpTapState(tuning);
    startSmallJump(repeated);
    repeated.release();
    expect(repeated.press(1_100, true)).toBe('ignored');
    expect(repeated.snapshot().upgraded).toBe(false);

    const third = new JumpTapState(tuning);
    startSmallJump(third);
    third.release();
    expect(third.press(1_100)).toBe('upgrade');
    third.release();
    expect(third.press(1_150)).toBe('ignored');
  });

  it('preserves a fresh landing buffer and resets active state on lifecycle resets', () => {
    const buffered = new JumpTapState(tuning);
    startSmallJump(buffered, 1_000);
    buffered.release();
    expect(buffered.press(1_500)).toBe('buffered');
    buffered.release();
    buffered.land(1_560);
    expect(buffered.snapshot().active).toBe(false);
    expect(buffered.hasBufferedPress(1_560)).toBe(true);
    expect(buffered.consumeTakeoff(1_560)).not.toBeNull();

    for (const reset of ['death', 'respawn', 'restart', 'scene-change', 'grapple'] as const) {
      const state = new JumpTapState(tuning);
      startSmallJump(state);
      state.reset();
      expect(state.snapshot(), reset).toMatchObject({ buffered: false, active: false, upgraded: false });
    }
  });

  it('keeps independent player states isolated', () => {
    const playerOne = new JumpTapState(tuning);
    const playerTwo = new JumpTapState(tuning);
    startSmallJump(playerOne);
    playerOne.release();
    expect(playerOne.press(1_100)).toBe('upgrade');
    expect(playerTwo.snapshot()).toMatchObject({ active: false, upgraded: false });
  });

  it('keeps coyote time and jump-buffer boundaries deterministic', () => {
    expect(isWithinCoyoteWindow(1_110, 1_000, MOVEMENT.coyoteTimeMs)).toBe(true);
    expect(isWithinCoyoteWindow(1_111, 1_000, MOVEMENT.coyoteTimeMs)).toBe(false);
    const state = new JumpTapState(tuning);
    state.press(2_000);
    expect(state.hasBufferedPress(2_000 + MOVEMENT.jumpBufferMs)).toBe(true);
    expect(state.hasBufferedPress(2_000 + MOVEMENT.jumpBufferMs + 1)).toBe(false);
  });
});
