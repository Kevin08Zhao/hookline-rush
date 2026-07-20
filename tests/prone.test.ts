import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../src/game/config';
import { JumpTapState } from '../src/game/core/jumpTap';
import { PlayerStateMachine } from '../src/game/core/playerStateMachine';
import {
  colliderFootY,
  proneSideRegions,
  regionOverlaps,
  resizeColliderInPlace,
  resolveDownAction,
  standingHeadroomRegion,
  stepProneVelocity,
} from '../src/game/core/prone';

interface FakeBody {
  position: { x: number; y: number };
  bounds: { min: { x: number; y: number }; max: { x: number; y: number } };
  velocity: { x: number; y: number };
  collisionFilter: { category: number; mask: number };
  isSensor: boolean;
  label: string;
  owner: string;
}

function fakeBody(
  width: number = MOVEMENT.standingColliderWidthPx,
  height: number = MOVEMENT.standingColliderHeightPx,
): FakeBody {
  return {
    position: { x: 120, y: 300 },
    bounds: {
      min: { x: 120 - width / 2, y: 300 - height / 2 },
      max: { x: 120 + width / 2, y: 300 + height / 2 },
    },
    velocity: { x: 4, y: -2 },
    collisionFilter: { category: 0x0001, mask: 0x0002 },
    isSensor: false,
    label: 'player:p1',
    owner: 'p1',
  };
}

function resize(body: FakeBody, width: number, height: number): FakeBody {
  return resizeColliderInPlace(
    body,
    width,
    height,
    (target, scaleX, scaleY) => {
      const halfWidth = ((target.bounds.max.x - target.bounds.min.x) * scaleX) / 2;
      const halfHeight = ((target.bounds.max.y - target.bounds.min.y) * scaleY) / 2;
      target.bounds.min.x = target.position.x - halfWidth;
      target.bounds.max.x = target.position.x + halfWidth;
      target.bounds.min.y = target.position.y - halfHeight;
      target.bounds.max.y = target.position.y + halfHeight;
    },
    (target, position) => {
      const deltaX = position.x - target.position.x;
      const deltaY = position.y - target.position.y;
      target.position = position;
      target.bounds.min.x += deltaX;
      target.bounds.max.x += deltaX;
      target.bounds.min.y += deltaY;
      target.bounds.max.y += deltaY;
    },
  );
}

describe('physical prone crawling model', () => {
  it('routes grounded Down to prone and airborne Down to fast-fall', () => {
    expect(resolveDownAction(true, true)).toBe('prone');
    expect(resolveDownAction(false, true)).toBe('fast-fall');
    expect(resolveDownAction(true, false)).toBe('none');
  });

  it('uses a controlled crawl speed and discards running momentum immediately', () => {
    const fromRun = stepProneVelocity(MOVEMENT.maxGroundSpeedPx, 1, 1 / 60, MOVEMENT);
    expect(fromRun).toBe(MOVEMENT.proneMoveMaxSpeedPx);

    let velocity = 0;
    for (let frame = 0; frame < 90; frame += 1) {
      velocity = stepProneVelocity(velocity, 1, 1 / 60, MOVEMENT);
      expect(Math.abs(velocity)).toBeLessThanOrEqual(MOVEMENT.proneMoveMaxSpeedPx);
    }
    expect(velocity).toBe(MOVEMENT.proneMoveMaxSpeedPx);
    const firstReverseFrame = stepProneVelocity(velocity, -1, 1 / 60, MOVEMENT);
    expect(firstReverseFrame).toBeGreaterThan(0);
    expect(firstReverseFrame).toBeLessThan(velocity);
  });

  it('uses a wide, low maximum collider matching a fully prone silhouette', () => {
    expect(MOVEMENT.proneColliderWidthPx).toBeGreaterThanOrEqual(58);
    expect(MOVEMENT.proneColliderWidthPx).toBeLessThanOrEqual(MOVEMENT.standingColliderWidthPx);
    const ratio = MOVEMENT.proneColliderHeightPx / MOVEMENT.standingColliderHeightPx;
    expect(ratio).toBeGreaterThanOrEqual(0.4);
    expect(ratio).toBeLessThanOrEqual(0.5);
  });

  it('resizes the same body while preserving feet, velocity, filters, and owner', () => {
    const body = fakeBody();
    const identity = body;
    const footBefore = colliderFootY(body.position.y, MOVEMENT.standingColliderHeightPx);
    resize(body, MOVEMENT.proneColliderWidthPx, MOVEMENT.proneColliderHeightPx);

    expect(body).toBe(identity);
    expect(body.bounds.max.y).toBeCloseTo(footBefore, 5);
    expect(body.bounds.max.x - body.bounds.min.x).toBeCloseTo(MOVEMENT.proneColliderWidthPx);
    expect(body.velocity).toEqual({ x: 4, y: -2 });
    expect(body.collisionFilter).toEqual({ category: 0x0001, mask: 0x0002 });
    expect(body.isSensor).toBe(false);
    expect(body.label).toBe('player:p1');
    expect(body.owner).toBe('p1');
  });

  it('uses tracked source dimensions when Matter bounds are velocity-expanded', () => {
    const body = fakeBody(62, 66);
    const standingFoot = colliderFootY(body.position.y, MOVEMENT.standingColliderHeightPx);
    resizeColliderInPlace(
      body,
      MOVEMENT.proneColliderWidthPx,
      MOVEMENT.proneColliderHeightPx,
      (target, scaleX, scaleY) => {
        const halfWidth = ((target.bounds.max.x - target.bounds.min.x) * scaleX) / 2;
        const halfHeight = ((target.bounds.max.y - target.bounds.min.y) * scaleY) / 2;
        target.bounds.min.x = target.position.x - halfWidth;
        target.bounds.max.x = target.position.x + halfWidth;
        target.bounds.min.y = target.position.y - halfHeight;
        target.bounds.max.y = target.position.y + halfHeight;
      },
      (target, position) => {
        target.position = position;
      },
      MOVEMENT.standingColliderWidthPx,
      MOVEMENT.standingColliderHeightPx,
    );
    expect(body.position.y + MOVEMENT.proneColliderHeightPx / 2).toBeCloseTo(standingFoot, 5);
  });

  it('blocks standing under a ceiling and permits it after leaving the tunnel', () => {
    const footY = 640;
    const region = standingHeadroomRegion(
      200,
      footY,
      MOVEMENT.proneColliderHeightPx,
      MOVEMENT.standingColliderHeightPx,
      MOVEMENT.standingColliderWidthPx,
    );
    expect(region).not.toBeNull();
    expect(regionOverlaps(region!, { x: 200, y: 556, width: 260, height: 100 })).toBe(true);
    expect(regionOverlaps(region!, { x: 500, y: 556, width: 260, height: 100 })).toBe(false);
  });

  it('does not expand sideways when entering prone beside a wall', () => {
    const regions = proneSideRegions(
      200,
      640,
      MOVEMENT.standingColliderWidthPx,
      MOVEMENT.proneColliderWidthPx,
      MOVEMENT.proneColliderHeightPx,
    );
    expect(regions).toHaveLength(0);
  });

  it('supports jumping directly from prone and one double-tap upgrade', () => {
    const motion = new PlayerStateMachine('prone');
    expect(motion.transition('airborne', 1_000)).toBe(true);
    const jump = new JumpTapState({
      doubleTapWindowMs: MOVEMENT.doubleTapWindowMs,
      doubleTapUpgradeCutoffMs: MOVEMENT.doubleTapUpgradeCutoffMs,
      jumpBufferMs: MOVEMENT.jumpBufferMs,
    });
    expect(jump.press(1_000)).toBe('buffered');
    expect(jump.consumeTakeoff(1_000)).not.toBeNull();
    jump.release();
    expect(jump.press(1_120)).toBe('upgrade');
    expect(jump.press(1_150)).toBe('ignored');
  });

  it('survives repeated prone/standing transitions without replacing the body', () => {
    const body = fakeBody();
    const identity = body;
    for (let cycle = 0; cycle < 50; cycle += 1) {
      resize(body, MOVEMENT.proneColliderWidthPx, MOVEMENT.proneColliderHeightPx);
      resize(body, MOVEMENT.standingColliderWidthPx, MOVEMENT.standingColliderHeightPx);
    }
    expect(body).toBe(identity);
    expect(body.bounds.max.x - body.bounds.min.x).toBeCloseTo(MOVEMENT.standingColliderWidthPx, 5);
    expect(body.bounds.max.y - body.bounds.min.y).toBeCloseTo(MOVEMENT.standingColliderHeightPx, 5);
    expect(body.collisionFilter).toEqual({ category: 0x0001, mask: 0x0002 });
  });
});
