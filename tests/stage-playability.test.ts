import { describe, expect, it } from 'vitest';
import { GRAPPLE, MOVEMENT } from '../src/game/config';
import { selectGrappleTarget } from '../src/game/core/grappleTargeting';
import { PLAYABLE_STAGE_IDS, STAGES } from '../src/game/levels/stages';
import type { PlatformSpec, StageBlueprint } from '../src/game/types';

interface GroundGap {
  readonly from: number;
  readonly to: number;
  readonly width: number;
}

function groundSegments(stage: StageBlueprint): readonly PlatformSpec[] {
  return stage.platforms
    .filter((platform) => platform.height >= 80 && platform.y >= 680)
    .sort((a, b) => a.x - b.x);
}

function groundGaps(stage: StageBlueprint): readonly GroundGap[] {
  const segments = groundSegments(stage);
  return segments.slice(0, -1).flatMap((segment, index) => {
    const next = segments[index + 1];
    if (!next) return [];
    const from = segment.x + segment.width / 2;
    const to = next.x - next.width / 2;
    return to - from > 10 ? [{ from, to, width: to - from }] : [];
  });
}

describe('current-movement stage playability', () => {
  it('keeps tutorial jump obstacles inside the real small/large jump envelopes', () => {
    const tutorial = STAGES.tutorial;
    const groundTop = 640;
    const smallHeight = MOVEMENT.smallJumpVelocityPx ** 2 / (2 * MOVEMENT.gravityPx);
    const largeHeight = MOVEMENT.largeJumpVelocityPx ** 2 / (2 * MOVEMENT.gravityPx);
    const small = tutorial.platforms.find((platform) => platform.id === 't-small-block');
    const large = tutorial.platforms.find((platform) => platform.id === 't-large-block');
    const smallRise = groundTop - ((small?.y ?? 0) - (small?.height ?? 0) / 2);
    const largeRise = groundTop - ((large?.y ?? 0) - (large?.height ?? 0) / 2);
    expect(smallRise).toBeLessThanOrEqual(smallHeight - 12);
    expect(largeRise).toBeGreaterThan(smallHeight + 6);
    expect(largeRise).toBeLessThanOrEqual(largeHeight - 12);
  });

  it('gives each formal stage a readable opening jump with a fair safety margin', () => {
    const smallHeight = MOVEMENT.smallJumpVelocityPx ** 2 / (2 * MOVEMENT.gravityPx);
    for (const stageId of PLAYABLE_STAGE_IDS) {
      const stage = STAGES[stageId];
      const step = stage.platforms.find((platform) => platform.id.endsWith('step-1'));
      expect(step, stageId).toBeDefined();
      const rise = 640 - ((step?.y ?? 0) - (step?.height ?? 0) / 2);
      expect(rise, `${stageId}:minimum challenge`).toBeGreaterThanOrEqual(40);
      expect(rise, `${stageId}:small-jump margin`).toBeLessThanOrEqual(smallHeight - 3);
    }
  });

  it('represents every ground gap clearly and provides either a jump or reachable grapple', () => {
    const largeFlightSeconds = (MOVEMENT.largeJumpVelocityPx * 2) / MOVEMENT.gravityPx;
    const conservativeLargeTravel = MOVEMENT.maxGroundSpeedPx * largeFlightSeconds * 0.9;
    const conservativeGrappleRange = GRAPPLE.baseRange * 0.954;

    for (const stage of Object.values(STAGES)) {
      for (const gap of groundGaps(stage)) {
        const pit = stage.hazards.find(
          (hazard) =>
            hazard.type === 'pit' &&
            Math.abs(hazard.x - (gap.from + gap.to) / 2) <= 2 &&
            hazard.width >= gap.width - 2,
        );
        expect(pit, `${stage.id}:${gap.from}-${gap.to}:visible pit`).toBeDefined();

        const requiredCenterTravel = gap.width + MOVEMENT.standingColliderWidthPx;
        if (requiredCenterTravel <= conservativeLargeTravel) continue;
        const nearestAnchor = Math.min(
          ...stage.anchors.map((anchor) =>
            Math.hypot(anchor.x - gap.from, anchor.y - stage.start.y),
          ),
        );
        expect(nearestAnchor, `${stage.id}:${gap.from}-${gap.to}:grapple`).toBeLessThanOrEqual(
          conservativeGrappleRange,
        );
      }
    }
  });

  it('leaves a readable control runway before every required gap', () => {
    const minimumRunway = 120;
    for (const stage of Object.values(STAGES)) {
      for (const gap of groundGaps(stage)) {
        const previousObstacleRight = Math.max(
          -Infinity,
          ...stage.hazards
            .filter((hazard) => hazard.type !== 'pit' && hazard.x + hazard.width / 2 <= gap.from)
            .map((hazard) => hazard.x + hazard.width / 2),
        );
        if (!Number.isFinite(previousObstacleRight)) continue;
        expect(gap.from - previousObstacleRight, `${stage.id}:${gap.from}:runway`).toBeGreaterThanOrEqual(
          minimumRunway,
        );
      }
    }
  });

  it('keeps at least one authored grapple line selectable at every required long gap', () => {
    const largeFlightSeconds = (MOVEMENT.largeJumpVelocityPx * 2) / MOVEMENT.gravityPx;
    const conservativeLargeTravel = MOVEMENT.maxGroundSpeedPx * largeFlightSeconds * 0.9;
    for (const stage of Object.values(STAGES)) {
      const blockers = [
        ...stage.platforms.map((platform) => ({
          x: platform.x,
          y: platform.y,
          width: platform.width,
          height: platform.height,
        })),
        ...stage.hazards
          .filter((hazard) => ['low-tunnel', 'cracked-wall'].includes(hazard.type))
          .map((hazard) => ({
            x: hazard.x,
            y: hazard.y,
            width: hazard.width,
            height: hazard.height,
          })),
      ];
      for (const gap of groundGaps(stage)) {
        if (gap.width + MOVEMENT.standingColliderWidthPx <= conservativeLargeTravel) continue;
        const target = selectGrappleTarget({
          origin: { x: gap.from - 24, y: stage.start.y },
          anchors: stage.anchors.map((anchor) => ({ ...anchor, active: true })),
          blockers,
          facing: 1,
          upwardBias: false,
          baseRange: GRAPPLE.baseRange,
          assistScale: 1,
          forwardConeDot: GRAPPLE.forwardConeDot,
        });
        expect(target, `${stage.id}:${gap.from}-${gap.to}:clear grapple line`).not.toBeNull();
      }
    }
  });

  it('provides a recovery landing zone after every ground gap', () => {
    const minimumLandingRun = 140;
    for (const stage of Object.values(STAGES)) {
      for (const gap of groundGaps(stage)) {
        const nextObstacleLeft = Math.min(
          Infinity,
          ...stage.hazards
            .filter((hazard) => hazard.type !== 'pit' && hazard.x - hazard.width / 2 >= gap.to)
            .map((hazard) => hazard.x - hazard.width / 2),
        );
        if (!Number.isFinite(nextObstacleLeft)) continue;
        expect(nextObstacleLeft - gap.to, `${stage.id}:${gap.to}:landing`).toBeGreaterThanOrEqual(
          minimumLandingRun,
        );
      }
    }
  });

  it('places every checkpoint on a stable full-height ground segment', () => {
    for (const stage of Object.values(STAGES)) {
      const segments = groundSegments(stage);
      for (const checkpoint of stage.checkpoints) {
        expect(
          segments.some(
            (segment) =>
              checkpoint.x >= segment.x - segment.width / 2 + 24 &&
              checkpoint.x <= segment.x + segment.width / 2 - 24,
          ),
          `${stage.id}:checkpoint@${checkpoint.x}`,
        ).toBe(true);
      }
    }
  });

  it('keeps challenge variety without stacking every mechanic at once', () => {
    for (const stageId of PLAYABLE_STAGE_IDS) {
      const stage = STAGES[stageId];
      expect(new Set(stage.hazards.map((hazard) => hazard.type)).size, stageId).toBeGreaterThanOrEqual(5);
      expect(
        stage.platforms.some((platform) =>
          ['moving', 'fragile', 'conveyor', 'disappearing'].includes(platform.kind ?? 'solid'),
        ),
        stageId,
      ).toBe(true);
      expect(stage.checkpoints.length, stageId).toBeGreaterThanOrEqual(6);
    }
  });

  it('keeps tutorial instruction cards separated after the route expansion', () => {
    const prompts = STAGES.tutorial.tutorialPrompts ?? [];
    for (let index = 1; index < prompts.length; index += 1) {
      expect((prompts[index]?.x ?? 0) - (prompts[index - 1]?.x ?? 0)).toBeGreaterThanOrEqual(220);
    }
  });
});
