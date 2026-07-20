import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../src/game/config';
import {
  aimGrapplePose,
  interpolateRigPose,
  NEUTRAL_RIG_POSE,
  PLAYER_ANIMATION_CLIPS,
  RIG_DIMENSIONS,
  RIG_PART_NAMES,
  RIG_RENDER_SCALE,
  rigPoseBounds,
  sampleAnimationClip,
  segmentEndpoint,
  selectPlayerAnimationMode,
  solveRigPose,
} from '../src/game/core/playerAnimation';

describe('articulated player animation', () => {
  it('interpolates positions and rotations without taking the long angular path', () => {
    const from = {
      ...NEUTRAL_RIG_POSE,
      rootX: 0,
      torsoRotation: Math.PI - 0.1,
    };
    const to = {
      ...NEUTRAL_RIG_POSE,
      rootX: 12,
      torsoRotation: -Math.PI + 0.1,
    };
    const halfway = interpolateRigPose(from, to, 0.5);

    expect(halfway.rootX).toBeCloseTo(6);
    expect(Math.abs(halfway.torsoRotation)).toBeCloseTo(Math.PI);
  });

  it('samples keyframes smoothly and keeps looping clips seamless', () => {
    const clip = PLAYER_ANIMATION_CLIPS.run;
    const start = sampleAnimationClip(clip, 0);
    const wrapped = sampleAnimationClip(clip, 1);
    const betweenFrames = sampleAnimationClip(clip, 0.125);

    expect(wrapped).toEqual(start);
    expect(betweenFrames.upperLegFrontRotation).toBeGreaterThan(
      Math.min(
        clip.keyframes[0]?.pose.upperLegFrontRotation ?? 0,
        clip.keyframes[1]?.pose.upperLegFrontRotation ?? 0,
      ),
    );
    expect(betweenFrames.upperLegFrontRotation).toBeLessThan(
      Math.max(
        clip.keyframes[0]?.pose.upperLegFrontRotation ?? 0,
        clip.keyframes[1]?.pose.upperLegFrontRotation ?? 0,
      ),
    );
  });

  it('keeps elbows and knees connected while every segment rotates independently', () => {
    const solved = solveRigPose(sampleAnimationClip(PLAYER_ANIMATION_CLIPS.run, 0.37));
    const expectedElbow = segmentEndpoint(
      solved.upperArmFront,
      solved.upperArmFront.rotation,
      RIG_DIMENSIONS.upperArmLength,
    );
    const expectedKnee = segmentEndpoint(
      solved.upperLegBack,
      solved.upperLegBack.rotation,
      RIG_DIMENSIONS.upperLegLength,
    );

    expect(solved.lowerArmFront.x).toBeCloseTo(expectedElbow.x);
    expect(solved.lowerArmFront.y).toBeCloseTo(expectedElbow.y);
    expect(solved.lowerLegBack.x).toBeCloseTo(expectedKnee.x);
    expect(solved.lowerLegBack.y).toBeCloseTo(expectedKnee.y);
    expect(solved.lowerArmFront.rotation).not.toBe(solved.upperArmFront.rotation);
  });

  it('selects dedicated poses for movement, prone crawling, jumping, and grappling', () => {
    expect(
      selectPlayerAnimationMode({
        motionState: 'grounded-run',
        speedX: 220,
        speedY: 0,
        isSlamming: false,
      }),
    ).toBe('run');
    expect(
      selectPlayerAnimationMode({
        motionState: 'prone',
        speedX: 0,
        speedY: 0,
        isSlamming: false,
      }),
    ).toBe('prone');
    expect(
      selectPlayerAnimationMode({
        motionState: 'airborne',
        speedX: 100,
        speedY: -200,
        isSlamming: false,
      }),
    ).toBe('jump-rise');
    expect(
      selectPlayerAnimationMode({
        motionState: 'grappling',
        speedX: 100,
        speedY: 50,
        isSlamming: false,
      }),
    ).toBe('grapple');
  });

  it('aims both articulated arms toward the grapple point', () => {
    const targetAngle = -2.2;
    const aimed = aimGrapplePose(NEUTRAL_RIG_POSE, targetAngle);

    expect(aimed.upperArmFrontRotation).toBeCloseTo(targetAngle + 0.12);
    expect(aimed.lowerArmFrontRotation).toBeCloseTo(targetAngle - 0.025);
    expect(aimed.upperArmBackRotation).toBeCloseTo(targetAngle - 0.1);
  });

  it('produces finite transforms for every body part in every clip', () => {
    for (const clip of Object.values(PLAYER_ANIMATION_CLIPS)) {
      for (const progress of [0, 0.17, 0.5, 0.83, 1]) {
        const solved = solveRigPose(sampleAnimationClip(clip, progress));
        for (const partName of RIG_PART_NAMES) {
          expect(Number.isFinite(solved[partName].x)).toBe(true);
          expect(Number.isFinite(solved[partName].y)).toBe(true);
          expect(Number.isFinite(solved[partName].rotation)).toBe(true);
        }
      }
    }
  });

  it('keeps every authored pose inside its matching physical collider', () => {
    const violations: string[] = [];
    for (const [mode, clip] of Object.entries(PLAYER_ANIMATION_CLIPS)) {
      for (let step = 0; step <= 40; step += 1) {
        const bounds = rigPoseBounds(sampleAnimationClip(clip, step / 40), RIG_RENDER_SCALE);
        const colliderWidth =
          mode === 'prone' ? MOVEMENT.proneColliderWidthPx : MOVEMENT.standingColliderWidthPx;
        const colliderHeight =
          mode === 'prone' ? MOVEMENT.proneColliderHeightPx : MOVEMENT.standingColliderHeightPx;
        if (bounds.right - bounds.left + MOVEMENT.solidContactSkinPx > colliderWidth) {
          violations.push(`${mode}:${step}:width=${bounds.right - bounds.left}`);
        }
        if (bounds.bottom - bounds.top > colliderHeight) {
          violations.push(`${mode}:${step}:height=${bounds.bottom - bounds.top}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps rope-aimed arms inside the standing collider at every target angle', () => {
    const basePose = sampleAnimationClip(PLAYER_ANIMATION_CLIPS.grapple, 0.35);
    for (let step = 0; step < 32; step += 1) {
      const angle = -Math.PI + (step / 31) * Math.PI * 2;
      const bounds = rigPoseBounds(aimGrapplePose(basePose, angle), RIG_RENDER_SCALE);
      expect(
        bounds.right - bounds.left + MOVEMENT.solidContactSkinPx,
        `${angle}:width`,
      ).toBeLessThanOrEqual(MOVEMENT.standingColliderWidthPx);
      expect(bounds.bottom - bounds.top, `${angle}:height`).toBeLessThanOrEqual(
        MOVEMENT.standingColliderHeightPx,
      );
    }
  });

  it('provides pose-width contact envelopes without the old fixed-width air gap', () => {
    const idleBounds = rigPoseBounds(
      sampleAnimationClip(PLAYER_ANIMATION_CLIPS.idle, 0),
      RIG_RENDER_SCALE,
    );
    const idleContactWidth = idleBounds.right - idleBounds.left + MOVEMENT.solidContactSkinPx;
    expect(idleContactWidth).toBeGreaterThanOrEqual(MOVEMENT.minimumContactWidthPx);
    expect(idleContactWidth).toBeLessThan(MOVEMENT.standingColliderWidthPx - 30);
    expect(MOVEMENT.solidContactSkinPx / 2).toBeLessThanOrEqual(0.1);

    for (const [mode, clip] of Object.entries(PLAYER_ANIMATION_CLIPS)) {
      const maximumWidth =
        mode === 'prone' ? MOVEMENT.proneColliderWidthPx : MOVEMENT.standingColliderWidthPx;
      for (let step = 0; step <= 40; step += 1) {
        const bounds = rigPoseBounds(sampleAnimationClip(clip, step / 40), RIG_RENDER_SCALE);
        expect(
          bounds.right - bounds.left + MOVEMENT.solidContactSkinPx,
          `${mode}:${step}`,
        ).toBeLessThanOrEqual(maximumWidth);
      }
    }
  });
});
