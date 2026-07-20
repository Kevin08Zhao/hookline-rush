export interface HorizontalMovementTuning {
  readonly maxGroundSpeedPx: number;
  readonly maxAirControlSpeedPx: number;
  readonly groundAccelerationPx: number;
  readonly groundDecelerationPx: number;
  readonly turnAccelerationPx: number;
  readonly airAccelerationPx: number;
  readonly grappleReleaseSoftCapPx: number;
  readonly momentumSoftDampingPx: number;
  readonly emergencyHorizontalCapPx: number;
}

export function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

export function stepHorizontalVelocity(
  currentPxPerSecond: number,
  input: number,
  grounded: boolean,
  deltaSeconds: number,
  tuning: HorizontalMovementTuning,
): number {
  const dt = Math.max(0, Math.min(deltaSeconds, 1 / 20));
  const direction = Math.abs(input) > 0.08 ? Math.sign(input) : 0;
  let velocity = currentPxPerSecond;

  if (direction === 0) {
    if (grounded) {
      velocity = moveTowards(velocity, 0, tuning.groundDecelerationPx * dt);
    }
  } else {
    const targetSpeed =
      direction * (grounded ? tuning.maxGroundSpeedPx : tuning.maxAirControlSpeedPx);
    const reversing = Math.sign(velocity) !== direction && Math.abs(velocity) > 1;
    const overspeed = !reversing && Math.abs(velocity) > Math.abs(targetSpeed);

    if (reversing) {
      velocity = moveTowards(velocity, targetSpeed, tuning.turnAccelerationPx * dt);
    } else if (!overspeed) {
      const acceleration = grounded ? tuning.groundAccelerationPx : tuning.airAccelerationPx;
      velocity = moveTowards(velocity, targetSpeed, acceleration * dt);
    } else if (grounded) {
      // Carrying extra momentum (e.g. after a grapple release) onto the ground while
      // still holding a direction: ease back down to the run cap instead of hovering
      // above it forever. In the air we keep the momentum and let the soft cap below
      // bleed it off gradually.
      velocity = moveTowards(velocity, targetSpeed, tuning.groundDecelerationPx * dt);
    }
  }

  if (Math.abs(velocity) > tuning.grappleReleaseSoftCapPx) {
    velocity = moveTowards(
      velocity,
      Math.sign(velocity) * tuning.grappleReleaseSoftCapPx,
      tuning.momentumSoftDampingPx * dt,
    );
  }

  return Math.max(
    -tuning.emergencyHorizontalCapPx,
    Math.min(tuning.emergencyHorizontalCapPx, velocity),
  );
}

export function applyAcceleration(
  velocityPxPerSecond: number,
  accelerationPxPerSecondSquared: number,
  deltaSeconds: number,
  absoluteCapPxPerSecond: number,
): number {
  const next = velocityPxPerSecond + accelerationPxPerSecondSquared * deltaSeconds;
  return Math.max(-absoluteCapPxPerSecond, Math.min(absoluteCapPxPerSecond, next));
}

export const matterVelocityToPixelsPerSecond = (velocity: number): number => velocity * 60;
export const pixelsPerSecondToMatterVelocity = (velocity: number): number => velocity / 60;
