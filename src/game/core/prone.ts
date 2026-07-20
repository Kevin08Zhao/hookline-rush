import { moveTowards } from './movement';

export interface ProneMovementTuning {
  readonly proneMoveMaxSpeedPx: number;
  readonly proneAccelerationPx: number;
  readonly proneDecelerationPx: number;
  readonly proneTurnAccelerationPx: number;
}

export interface ColliderLike {
  readonly position: { x: number; y: number };
  readonly bounds: { min: { x: number; y: number }; max: { x: number; y: number } };
}

export interface ClearanceRegion {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export type DownAction = 'none' | 'prone' | 'fast-fall';

export function resolveDownAction(grounded: boolean, downHeld: boolean): DownAction {
  if (!downHeld) return 'none';
  return grounded ? 'prone' : 'fast-fall';
}

export function stepProneVelocity(
  currentPxPerSecond: number,
  horizontalInput: number,
  deltaSeconds: number,
  tuning: ProneMovementTuning,
): number {
  const dt = Math.max(0, Math.min(deltaSeconds, 1 / 20));
  const direction = Math.abs(horizontalInput) > 0.08 ? Math.sign(horizontalInput) : 0;
  let velocity = Math.max(
    -tuning.proneMoveMaxSpeedPx,
    Math.min(tuning.proneMoveMaxSpeedPx, currentPxPerSecond),
  );

  if (direction === 0) {
    velocity = moveTowards(velocity, 0, tuning.proneDecelerationPx * dt);
  } else {
    const target = direction * tuning.proneMoveMaxSpeedPx;
    const reversing = Math.sign(velocity) !== direction && Math.abs(velocity) > 1;
    velocity = moveTowards(
      velocity,
      target,
      (reversing ? tuning.proneTurnAccelerationPx : tuning.proneAccelerationPx) * dt,
    );
  }

  return Math.max(-tuning.proneMoveMaxSpeedPx, Math.min(tuning.proneMoveMaxSpeedPx, velocity));
}

export function colliderWidth(body: ColliderLike): number {
  return body.bounds.max.x - body.bounds.min.x;
}

export function colliderHeight(body: ColliderLike): number {
  return body.bounds.max.y - body.bounds.min.y;
}

export function colliderFootY(centerY: number, height: number): number {
  return centerY + height / 2;
}

export function colliderCenterForFoot(footY: number, height: number): number {
  return footY - height / 2;
}

export function resizeColliderInPlace<T extends ColliderLike>(
  body: T,
  targetWidth: number,
  targetHeight: number,
  scale: (body: T, scaleX: number, scaleY: number) => void,
  setPosition: (body: T, position: { x: number; y: number }) => void,
  sourceWidth = colliderWidth(body),
  sourceHeight = colliderHeight(body),
): T {
  if (sourceWidth <= 0 || sourceHeight <= 0) return body;
  if (Math.abs(sourceWidth - targetWidth) < 0.01 && Math.abs(sourceHeight - targetHeight) < 0.01) {
    return body;
  }

  const footY = colliderFootY(body.position.y, sourceHeight);
  const x = body.position.x;
  scale(body, targetWidth / sourceWidth, targetHeight / sourceHeight);
  setPosition(body, { x, y: colliderCenterForFoot(footY, targetHeight) });
  return body;
}

export function standingHeadroomRegion(
  x: number,
  footY: number,
  currentHeight: number,
  standingHeight: number,
  standingWidth: number,
): ClearanceRegion | null {
  if (currentHeight >= standingHeight - 0.01) return null;
  return {
    left: x - standingWidth / 2 + 2,
    right: x + standingWidth / 2 - 2,
    top: footY - standingHeight + 1,
    bottom: footY - currentHeight - 1,
  };
}

export function proneSideRegions(
  x: number,
  footY: number,
  currentWidth: number,
  proneWidth: number,
  proneHeight: number,
): readonly ClearanceRegion[] {
  if (proneWidth <= currentWidth + 0.01) return [];
  const top = footY - proneHeight + 2;
  const bottom = footY - 2;
  return [
    {
      left: x - proneWidth / 2 + 1,
      right: x - currentWidth / 2 - 1,
      top,
      bottom,
    },
    {
      left: x + currentWidth / 2 + 1,
      right: x + proneWidth / 2 - 1,
      top,
      bottom,
    },
  ].filter((region) => region.right > region.left);
}

export function regionOverlaps(
  region: ClearanceRegion,
  rectangle: { x: number; y: number; width: number; height: number },
): boolean {
  const left = rectangle.x - rectangle.width / 2;
  const right = rectangle.x + rectangle.width / 2;
  const top = rectangle.y - rectangle.height / 2;
  const bottom = rectangle.y + rectangle.height / 2;
  return !(
    region.right <= left ||
    region.left >= right ||
    region.bottom <= top ||
    region.top >= bottom
  );
}
