import type { PlayerMotionState } from './playerStateMachine';

export const RIG_PART_NAMES = [
  'head',
  'torso',
  'upperArmFront',
  'lowerArmFront',
  'upperArmBack',
  'lowerArmBack',
  'upperLegFront',
  'lowerLegFront',
  'upperLegBack',
  'lowerLegBack',
] as const;

export type RigPartName = (typeof RIG_PART_NAMES)[number];

const POSE_KEYS = [
  'rootX',
  'rootY',
  'torsoRotation',
  'headX',
  'headY',
  'headRotation',
  'upperArmFrontRotation',
  'lowerArmFrontRotation',
  'upperArmBackRotation',
  'lowerArmBackRotation',
  'upperLegFrontRotation',
  'lowerLegFrontRotation',
  'upperLegBackRotation',
  'lowerLegBackRotation',
] as const;

type PoseKey = (typeof POSE_KEYS)[number];

const ROTATION_KEYS = new Set<PoseKey>(POSE_KEYS.filter((key) => key.endsWith('Rotation')));

export type RigPose = Readonly<Record<PoseKey, number>>;

export interface RigPartTransform {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

export type SolvedRigPose = Readonly<Record<RigPartName, RigPartTransform>>;

export interface AnimationKeyframe {
  readonly at: number;
  readonly pose: RigPose;
}

export interface AnimationClip {
  readonly loop: boolean;
  readonly keyframes: readonly AnimationKeyframe[];
}

export type PlayerAnimationMode =
  'idle' | 'run' | 'prone' | 'jump-rise' | 'jump-fall' | 'grapple' | 'slam' | 'knockback';

export interface PlayerAnimationState {
  readonly motionState: PlayerMotionState;
  readonly speedX: number;
  readonly speedY: number;
  readonly isSlamming: boolean;
}

export const RIG_DIMENSIONS = {
  upperArmLength: 11.5,
  lowerArmLength: 11,
  upperLegLength: 12,
  lowerLegLength: 12,
} as const;

export const RIG_RENDER_SCALE = 0.88;

export const RIG_PART_WIDTHS: Readonly<Record<RigPartName, number>> = {
  head: 17,
  torso: 19,
  upperArmFront: 6.6,
  lowerArmFront: 5.8,
  upperArmBack: 5.8,
  lowerArmBack: 5.2,
  upperLegFront: 8,
  lowerLegFront: 7,
  upperLegBack: 7,
  lowerLegBack: 6.2,
};

export interface RigBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export const NEUTRAL_RIG_POSE: RigPose = {
  rootX: 0,
  rootY: 0,
  torsoRotation: 0.035,
  headX: 0,
  headY: 0,
  headRotation: -0.035,
  upperArmFrontRotation: -0.12,
  lowerArmFrontRotation: -0.05,
  upperArmBackRotation: 0.12,
  lowerArmBackRotation: 0.06,
  upperLegFrontRotation: -0.07,
  lowerLegFrontRotation: 0.02,
  upperLegBackRotation: 0.08,
  lowerLegBackRotation: -0.02,
};

function pose(overrides: Partial<RigPose> = {}): RigPose {
  return { ...NEUTRAL_RIG_POSE, ...overrides };
}

function frame(at: number, overrides: Partial<RigPose> = {}): AnimationKeyframe {
  return { at, pose: pose(overrides) };
}

export const PLAYER_ANIMATION_CLIPS: Readonly<Record<PlayerAnimationMode, AnimationClip>> = {
  idle: {
    loop: true,
    keyframes: [
      frame(0),
      frame(0.5, {
        rootY: -0.7,
        torsoRotation: 0.055,
        headY: -0.25,
        headRotation: -0.055,
        upperArmFrontRotation: -0.15,
        upperArmBackRotation: 0.15,
      }),
      frame(1),
    ],
  },
  run: {
    loop: true,
    keyframes: [
      frame(0, {
        rootY: 0.4,
        torsoRotation: 0.12,
        headRotation: -0.11,
        upperArmFrontRotation: 0.7,
        lowerArmFrontRotation: 0.3,
        upperArmBackRotation: -0.62,
        lowerArmBackRotation: -0.18,
        upperLegFrontRotation: -0.68,
        lowerLegFrontRotation: 0.18,
        upperLegBackRotation: 0.56,
        lowerLegBackRotation: 0.94,
      }),
      frame(0.25, {
        rootY: -1.45,
        torsoRotation: 0.105,
        headRotation: -0.09,
        upperArmFrontRotation: 0.12,
        lowerArmFrontRotation: 0.44,
        upperArmBackRotation: -0.08,
        lowerArmBackRotation: -0.36,
        upperLegFrontRotation: -0.05,
        lowerLegFrontRotation: 0.62,
        upperLegBackRotation: 0.04,
        lowerLegBackRotation: -0.12,
      }),
      frame(0.5, {
        rootY: 0.4,
        torsoRotation: 0.12,
        headRotation: -0.11,
        upperArmFrontRotation: -0.62,
        lowerArmFrontRotation: -0.18,
        upperArmBackRotation: 0.7,
        lowerArmBackRotation: 0.3,
        upperLegFrontRotation: 0.56,
        lowerLegFrontRotation: 0.94,
        upperLegBackRotation: -0.68,
        lowerLegBackRotation: 0.18,
      }),
      frame(0.75, {
        rootY: -1.45,
        torsoRotation: 0.105,
        headRotation: -0.09,
        upperArmFrontRotation: -0.08,
        lowerArmFrontRotation: -0.36,
        upperArmBackRotation: 0.12,
        lowerArmBackRotation: 0.44,
        upperLegFrontRotation: 0.04,
        lowerLegFrontRotation: -0.12,
        upperLegBackRotation: -0.05,
        lowerLegBackRotation: 0.62,
      }),
      frame(1, {
        rootY: 0.4,
        torsoRotation: 0.12,
        headRotation: -0.11,
        upperArmFrontRotation: 0.7,
        lowerArmFrontRotation: 0.3,
        upperArmBackRotation: -0.62,
        lowerArmBackRotation: -0.18,
        upperLegFrontRotation: -0.68,
        lowerLegFrontRotation: 0.18,
        upperLegBackRotation: 0.56,
        lowerLegBackRotation: 0.94,
      }),
    ],
  },
  prone: {
    loop: true,
    keyframes: [
      frame(0, {
        rootY: 4,
        torsoRotation: 1.48,
        headX: 0.5,
        headY: 0.8,
        headRotation: -1.22,
        upperArmFrontRotation: -1.3,
        lowerArmFrontRotation: -1.48,
        upperArmBackRotation: -1.72,
        lowerArmBackRotation: -1.18,
        upperLegFrontRotation: 1.18,
        lowerLegFrontRotation: 1.48,
        upperLegBackRotation: 1.68,
        lowerLegBackRotation: 1.22,
      }),
      frame(0.25, {
        rootX: 0.5,
        rootY: 3.6,
        torsoRotation: 1.5,
        headX: 0.8,
        headY: 0.4,
        headRotation: -1.25,
        upperArmFrontRotation: -1.62,
        lowerArmFrontRotation: -1.02,
        upperArmBackRotation: -1.18,
        lowerArmBackRotation: -1.5,
        upperLegFrontRotation: 1.58,
        lowerLegFrontRotation: 1.12,
        upperLegBackRotation: 1.2,
        lowerLegBackRotation: 1.52,
      }),
      frame(0.5, {
        rootY: 4,
        torsoRotation: 1.48,
        headX: 0.5,
        headY: 0.8,
        headRotation: -1.22,
        upperArmFrontRotation: -1.72,
        lowerArmFrontRotation: -1.18,
        upperArmBackRotation: -1.3,
        lowerArmBackRotation: -1.48,
        upperLegFrontRotation: 1.68,
        lowerLegFrontRotation: 1.22,
        upperLegBackRotation: 1.18,
        lowerLegBackRotation: 1.48,
      }),
      frame(0.75, {
        rootX: -0.5,
        rootY: 3.6,
        torsoRotation: 1.5,
        headX: 0.8,
        headY: 0.4,
        headRotation: -1.25,
        upperArmFrontRotation: -1.18,
        lowerArmFrontRotation: -1.5,
        upperArmBackRotation: -1.62,
        lowerArmBackRotation: -1.02,
        upperLegFrontRotation: 1.2,
        lowerLegFrontRotation: 1.52,
        upperLegBackRotation: 1.58,
        lowerLegBackRotation: 1.12,
      }),
      frame(1, {
        rootY: 4,
        torsoRotation: 1.48,
        headX: 0.5,
        headY: 0.8,
        headRotation: -1.22,
        upperArmFrontRotation: -1.3,
        lowerArmFrontRotation: -1.48,
        upperArmBackRotation: -1.72,
        lowerArmBackRotation: -1.18,
        upperLegFrontRotation: 1.18,
        lowerLegFrontRotation: 1.48,
        upperLegBackRotation: 1.68,
        lowerLegBackRotation: 1.22,
      }),
    ],
  },
  'jump-rise': {
    loop: false,
    keyframes: [
      frame(0, {
        rootY: 1,
        torsoRotation: 0.14,
        headRotation: -0.12,
        upperArmFrontRotation: -1.55,
        lowerArmFrontRotation: -2.12,
        upperArmBackRotation: -1.12,
        lowerArmBackRotation: -1.86,
        upperLegFrontRotation: -0.62,
        lowerLegFrontRotation: 0.42,
        upperLegBackRotation: 0.46,
        lowerLegBackRotation: 0.98,
      }),
      frame(1, {
        rootY: -1,
        torsoRotation: 0.06,
        headY: -0.5,
        headRotation: -0.04,
        upperArmFrontRotation: -2.28,
        lowerArmFrontRotation: -2.62,
        upperArmBackRotation: -2.02,
        lowerArmBackRotation: -2.45,
        upperLegFrontRotation: -0.88,
        lowerLegFrontRotation: 0.2,
        upperLegBackRotation: 0.58,
        lowerLegBackRotation: 1.12,
      }),
    ],
  },
  'jump-fall': {
    loop: false,
    keyframes: [
      frame(0, {
        rootY: -1,
        torsoRotation: 0.04,
        upperArmFrontRotation: -0.86,
        lowerArmFrontRotation: -0.44,
        upperArmBackRotation: 0.8,
        lowerArmBackRotation: 0.4,
        upperLegFrontRotation: -0.7,
        lowerLegFrontRotation: 0.24,
        upperLegBackRotation: 0.52,
        lowerLegBackRotation: 1.02,
      }),
      frame(1, {
        rootY: 1.2,
        torsoRotation: -0.04,
        headY: 0.6,
        headRotation: 0.08,
        upperArmFrontRotation: -0.68,
        lowerArmFrontRotation: -0.3,
        upperArmBackRotation: 0.62,
        lowerArmBackRotation: 0.28,
        upperLegFrontRotation: -0.28,
        lowerLegFrontRotation: 0.12,
        upperLegBackRotation: 0.3,
        lowerLegBackRotation: -0.08,
      }),
    ],
  },
  grapple: {
    loop: true,
    keyframes: [
      frame(0, {
        rootY: 0.4,
        torsoRotation: 0.09,
        headRotation: -0.05,
        upperLegFrontRotation: -0.42,
        lowerLegFrontRotation: 0.38,
        upperLegBackRotation: 0.36,
        lowerLegBackRotation: 0.82,
      }),
      frame(0.5, {
        rootY: -0.5,
        torsoRotation: -0.04,
        headRotation: 0.08,
        upperLegFrontRotation: 0.28,
        lowerLegFrontRotation: 0.76,
        upperLegBackRotation: -0.48,
        lowerLegBackRotation: 0.24,
      }),
      frame(1, {
        rootY: 0.4,
        torsoRotation: 0.09,
        headRotation: -0.05,
        upperLegFrontRotation: -0.42,
        lowerLegFrontRotation: 0.38,
        upperLegBackRotation: 0.36,
        lowerLegBackRotation: 0.82,
      }),
    ],
  },
  slam: {
    loop: false,
    keyframes: [
      frame(0, {
        rootY: 1.3,
        torsoRotation: -0.03,
        headY: 1,
        upperArmFrontRotation: -2.8,
        lowerArmFrontRotation: 2.95,
        upperArmBackRotation: 2.75,
        lowerArmBackRotation: -2.9,
        upperLegFrontRotation: -0.36,
        lowerLegFrontRotation: 0.52,
        upperLegBackRotation: 0.38,
        lowerLegBackRotation: 0.84,
      }),
      frame(1, {
        rootY: 1.5,
        torsoRotation: 0.02,
        headY: 1.4,
        upperArmFrontRotation: -2.95,
        lowerArmFrontRotation: 3.05,
        upperArmBackRotation: 2.9,
        lowerArmBackRotation: -3.02,
        upperLegFrontRotation: -0.18,
        lowerLegFrontRotation: 0.15,
        upperLegBackRotation: 0.2,
        lowerLegBackRotation: -0.12,
      }),
    ],
  },
  knockback: {
    loop: false,
    keyframes: [
      frame(0, {
        torsoRotation: -0.32,
        headX: -1,
        headY: 1,
        headRotation: 0.42,
        upperArmFrontRotation: 1.35,
        lowerArmFrontRotation: 0.76,
        upperArmBackRotation: -1.42,
        lowerArmBackRotation: -0.74,
        upperLegFrontRotation: -0.48,
        lowerLegFrontRotation: 0.34,
        upperLegBackRotation: 0.5,
        lowerLegBackRotation: 0.88,
      }),
      frame(1, {
        torsoRotation: -0.12,
        headX: -0.4,
        headY: 0.4,
        headRotation: 0.18,
        upperArmFrontRotation: 0.92,
        lowerArmFrontRotation: 0.44,
        upperArmBackRotation: -1.02,
        lowerArmBackRotation: -0.42,
        upperLegFrontRotation: -0.24,
        lowerLegFrontRotation: 0.16,
        upperLegBackRotation: 0.26,
        lowerLegBackRotation: 0.42,
      }),
    ],
  },
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function interpolateAngle(from: number, to: number, amount: number): number {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + difference * amount;
}

export function interpolateRigPose(from: RigPose, to: RigPose, amount: number): RigPose {
  const normalizedAmount = clamp(amount, 0, 1);
  const result = { ...from } as Record<PoseKey, number>;
  for (const key of POSE_KEYS) {
    result[key] = ROTATION_KEYS.has(key)
      ? interpolateAngle(from[key], to[key], normalizedAmount)
      : from[key] + (to[key] - from[key]) * normalizedAmount;
  }
  return result;
}

export function sampleAnimationClip(clip: AnimationClip, progress: number): RigPose {
  const first = clip.keyframes[0];
  const last = clip.keyframes[clip.keyframes.length - 1];
  if (!first || !last) return NEUTRAL_RIG_POSE;

  const normalizedProgress = clip.loop
    ? progress - Math.floor(progress)
    : clamp(progress, first.at, last.at);
  if (normalizedProgress <= first.at) return first.pose;

  for (let index = 1; index < clip.keyframes.length; index += 1) {
    const right = clip.keyframes[index];
    const left = clip.keyframes[index - 1];
    if (!left || !right || normalizedProgress > right.at) continue;
    const duration = Math.max(0.0001, right.at - left.at);
    const localProgress = clamp((normalizedProgress - left.at) / duration, 0, 1);
    const easedProgress = localProgress * localProgress * (3 - 2 * localProgress);
    return interpolateRigPose(left.pose, right.pose, easedProgress);
  }
  return last.pose;
}

export function selectPlayerAnimationMode(state: PlayerAnimationState): PlayerAnimationMode {
  if (state.motionState === 'grappling') return 'grapple';
  if (state.motionState === 'prone') return 'prone';
  if (state.motionState === 'knockback') return 'knockback';
  if (state.isSlamming) return 'slam';
  if (state.motionState === 'airborne') return state.speedY < -35 ? 'jump-rise' : 'jump-fall';
  return Math.abs(state.speedX) >= 28 ? 'run' : 'idle';
}

export function aimGrapplePose(basePose: RigPose, targetAngle: number): RigPose {
  return {
    ...basePose,
    headRotation: clamp(targetAngle * 0.12, -0.25, 0.25),
    upperArmFrontRotation: targetAngle + 0.12,
    lowerArmFrontRotation: targetAngle - 0.025,
    upperArmBackRotation: targetAngle - 0.1,
    lowerArmBackRotation: targetAngle + 0.035,
  };
}

function rotatePoint(x: number, y: number, rotation: number): { x: number; y: number } {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return { x: x * cosine - y * sine, y: x * sine + y * cosine };
}

export function segmentEndpoint(
  start: Readonly<{ x: number; y: number }>,
  rotation: number,
  length: number,
): { x: number; y: number } {
  return {
    x: start.x - Math.sin(rotation) * length,
    y: start.y + Math.cos(rotation) * length,
  };
}

export function solveRigPose(poseToSolve: RigPose): SolvedRigPose {
  const torso = {
    x: poseToSolve.rootX,
    y: poseToSolve.rootY - 4,
    rotation: poseToSolve.torsoRotation,
  };
  const localHead = rotatePoint(
    poseToSolve.headX,
    -18 + poseToSolve.headY,
    poseToSolve.torsoRotation,
  );
  const frontShoulderOffset = rotatePoint(5.4, -7, poseToSolve.torsoRotation);
  const backShoulderOffset = rotatePoint(-4.6, -6.2, poseToSolve.torsoRotation);
  const frontHipOffset = rotatePoint(4.1, 8, poseToSolve.torsoRotation);
  const backHipOffset = rotatePoint(-4, 8, poseToSolve.torsoRotation);

  const upperArmFront = {
    x: torso.x + frontShoulderOffset.x,
    y: torso.y + frontShoulderOffset.y,
    rotation: poseToSolve.upperArmFrontRotation,
  };
  const upperArmBack = {
    x: torso.x + backShoulderOffset.x,
    y: torso.y + backShoulderOffset.y,
    rotation: poseToSolve.upperArmBackRotation,
  };
  const upperLegFront = {
    x: torso.x + frontHipOffset.x,
    y: torso.y + frontHipOffset.y,
    rotation: poseToSolve.upperLegFrontRotation,
  };
  const upperLegBack = {
    x: torso.x + backHipOffset.x,
    y: torso.y + backHipOffset.y,
    rotation: poseToSolve.upperLegBackRotation,
  };

  return {
    head: {
      x: torso.x + localHead.x,
      y: torso.y + localHead.y,
      rotation: poseToSolve.torsoRotation + poseToSolve.headRotation,
    },
    torso,
    upperArmFront,
    lowerArmFront: {
      ...segmentEndpoint(upperArmFront, upperArmFront.rotation, RIG_DIMENSIONS.upperArmLength),
      rotation: poseToSolve.lowerArmFrontRotation,
    },
    upperArmBack,
    lowerArmBack: {
      ...segmentEndpoint(upperArmBack, upperArmBack.rotation, RIG_DIMENSIONS.upperArmLength),
      rotation: poseToSolve.lowerArmBackRotation,
    },
    upperLegFront,
    lowerLegFront: {
      ...segmentEndpoint(upperLegFront, upperLegFront.rotation, RIG_DIMENSIONS.upperLegLength),
      rotation: poseToSolve.lowerLegFrontRotation,
    },
    upperLegBack,
    lowerLegBack: {
      ...segmentEndpoint(upperLegBack, upperLegBack.rotation, RIG_DIMENSIONS.upperLegLength),
      rotation: poseToSolve.lowerLegBackRotation,
    },
  };
}

export function rigPoseBounds(poseToMeasure: RigPose, renderScale = RIG_RENDER_SCALE): RigBounds {
  const solved = solveRigPose(poseToMeasure);
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  const measurePart = (name: RigPartName, topExtent: number, bottomExtent: number): void => {
    const transform = solved[name];
    const halfWidth = RIG_PART_WIDTHS[name] / 2;
    const cosine = Math.cos(transform.rotation);
    const sine = Math.sin(transform.rotation);
    for (const localX of [-halfWidth, halfWidth]) {
      for (const localY of [-topExtent, bottomExtent]) {
        const x = (transform.x + localX * cosine - localY * sine) * renderScale;
        const y = (transform.y + localX * sine + localY * cosine) * renderScale;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  };

  measurePart('head', 8.75, 8.75);
  measurePart('torso', 12.5, 12.5);
  measurePart('upperArmFront', 2, RIG_DIMENSIONS.upperArmLength + 2);
  measurePart('lowerArmFront', 2, RIG_DIMENSIONS.lowerArmLength + 2);
  measurePart('upperArmBack', 2, RIG_DIMENSIONS.upperArmLength + 2);
  measurePart('lowerArmBack', 2, RIG_DIMENSIONS.lowerArmLength + 2);
  measurePart('upperLegFront', 2, RIG_DIMENSIONS.upperLegLength + 2);
  measurePart('lowerLegFront', 2, RIG_DIMENSIONS.lowerLegLength + 2);
  measurePart('upperLegBack', 2, RIG_DIMENSIONS.upperLegLength + 2);
  measurePart('lowerLegBack', 2, RIG_DIMENSIONS.lowerLegLength + 2);

  return { left, top, right, bottom };
}
