import { describe, expect, it } from 'vitest';
import { MOVEMENT, TILE_SIZE } from '../src/game/config';
import { applyAcceleration, stepHorizontalVelocity } from '../src/game/core/movement';

function simulate(seconds: number, hz: number, input: number, grounded = true, initial = 0): number {
  let velocity = initial;
  const steps = Math.round(seconds * hz);
  for (let step = 0; step < steps; step += 1) {
    velocity = stepHorizontalVelocity(velocity, input, grounded, 1 / hz, MOVEMENT);
  }
  return velocity;
}

describe('precision movement tuning', () => {
  it('is stable at 30, 60, and 120 Hz', () => {
    const speeds = [30, 60, 120].map((hz) => simulate(0.2, hz, 1));
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeLessThan(1);
  });

  it('gives grounded and airborne movement the same fast directional response', () => {
    expect(MOVEMENT.maxGroundSpeedPx).toBe(MOVEMENT.maxAirControlSpeedPx);
    expect(MOVEMENT.groundAccelerationPx).toBe(MOVEMENT.airAccelerationPx);
    expect(MOVEMENT.maxGroundSpeedPx / TILE_SIZE).toBeGreaterThanOrEqual(4.2);
    expect(MOVEMENT.maxGroundSpeedPx / TILE_SIZE).toBeLessThanOrEqual(4.7);
    expect(MOVEMENT.maxGroundSpeedPx / MOVEMENT.groundAccelerationPx).toBeGreaterThanOrEqual(0.14);
    expect(MOVEMENT.maxGroundSpeedPx / MOVEMENT.groundAccelerationPx).toBeLessThanOrEqual(0.2);
    for (const hz of [30, 60, 120]) {
      expect(simulate(0.15, hz, 1, true)).toBeCloseTo(simulate(0.15, hz, 1, false), 5);
      expect(simulate(0.12, hz, -1, true, 180)).toBeCloseTo(
        simulate(0.12, hz, -1, false, 180),
        5,
      );
    }
    const stopDistance = MOVEMENT.maxGroundSpeedPx ** 2 / (2 * MOVEMENT.groundDecelerationPx);
    expect(stopDistance / TILE_SIZE).toBeLessThanOrEqual(0.6);
  });

  it('eases external momentum to the soft cap and enforces the emergency cap', () => {
    const eased = simulate(0.25, 60, 0, false, 500);
    expect(eased).toBeLessThan(500);
    expect(eased).toBeGreaterThanOrEqual(MOVEMENT.grappleReleaseSoftCapPx);
    expect(simulate(1 / 60, 60, 0, false, 5_000)).toBe(MOVEMENT.emergencyHorizontalCapPx);
    expect(applyAcceleration(640, 1_000, 1 / 60, 650)).toBe(650);
  });

  it('produces a one-height small jump and a clearly higher double-tap jump', () => {
    const smallHeight = MOVEMENT.smallJumpVelocityPx ** 2 / (2 * MOVEMENT.gravityPx);
    expect(smallHeight / 54).toBeGreaterThanOrEqual(1);
    expect(smallHeight / 54).toBeLessThanOrEqual(1.3);
    const doubleTapHeight = (tapSeconds: number): number => {
      const ascentBeforeTap =
        MOVEMENT.smallJumpVelocityPx * tapSeconds -
        0.5 * MOVEMENT.gravityPx * tapSeconds ** 2;
      const velocityAtTap = Math.max(
        0,
        MOVEMENT.smallJumpVelocityPx - MOVEMENT.gravityPx * tapSeconds,
      );
      const upgradedVelocity = Math.min(
        MOVEMENT.largeJumpVelocityPx,
        velocityAtTap + MOVEMENT.largeJumpUpgradeMaxDeltaPx,
      );
      return ascentBeforeTap + upgradedVelocity ** 2 / (2 * MOVEMENT.gravityPx);
    };
    for (const tapSeconds of [0.08, 0.14, 0.22]) {
      expect(doubleTapHeight(tapSeconds) / 54).toBeGreaterThanOrEqual(1.75);
      expect(doubleTapHeight(tapSeconds) / 54).toBeLessThanOrEqual(2.3);
    }
  });
});
