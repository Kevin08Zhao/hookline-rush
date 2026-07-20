import type { TranslationKey } from './i18n';
import type { AbilityId, DifficultyId, DifficultyPreset } from './types';

export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;
export const COURSE_ROW_HEIGHT = 820;
export const RACE_DIVIDER_WIDTH = 16;
export const RACE_VIEWPORT_WIDTH = (VIEW_WIDTH - RACE_DIVIDER_WIDTH) / 2;
export const RACE_SECOND_VIEWPORT_X = RACE_VIEWPORT_WIDTH + RACE_DIVIDER_WIDTH;
export const RACE_CAMERA_ZOOM = 0.82;
export const TILE_SIZE = 64;

export const FONT_FAMILY =
  '"Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif';
export const FONT_DISPLAY =
  '"Avenir Next Condensed", "Arial Narrow", "Segoe UI", sans-serif';
export const FONT_MONO = 'SFMono-Regular, Consolas, Liberation Mono, monospace';

export const MOVEMENT = {
  maxGroundSpeedPx: 285,
  maxAirControlSpeedPx: 285,
  groundAccelerationPx: 1550,
  groundDecelerationPx: 1550,
  turnAccelerationPx: 2000,
  airAccelerationPx: 1550,
  gravityPx: 1450,
  matterGravityY: 1.45,
  terminalFallSpeedPx: 880,
  fastFallAccelerationPx: 980,
  grappleReleaseSoftCapPx: 410,
  momentumSoftDampingPx: 720,
  emergencyHorizontalCapPx: 650,
  emergencyVerticalCapPx: 960,
  smallJumpVelocityPx: 400,
  largeJumpVelocityPx: 480,
  largeJumpUpgradeMaxDeltaPx: 280,
  doubleTapWindowMs: 220,
  doubleTapUpgradeCutoffMs: 260,
  wallJumpVelocityXPx: 225,
  wallJumpVelocityYPx: 455,
  coyoteTimeMs: 110,
  jumpBufferMs: 130,
  maxWallJumps: 2,
  standingColliderWidthPx: 64,
  standingColliderHeightPx: 64,
  proneColliderWidthPx: 60,
  proneColliderHeightPx: 26,
  minimumContactWidthPx: 18,
  solidContactSkinPx: 0.2,
  proneMinimumDurationMs: 140,
  proneMoveMaxSpeedPx: 92,
  proneAccelerationPx: 720,
  proneDecelerationPx: 1180,
  proneTurnAccelerationPx: 1380,
  damageKnockbackXPx: 255,
  damageKnockbackYPx: 235,
  impactDashSpeedPx: 430,
  groundSlamSpeedPx: 720,
  highSpeedImpactMinPx: 365,
  speedTrailMinPx: 330,
  grapplePumpAccelerationPx: 390,
  grappleAssistAccelerationPx: 125,
  gravityFieldAccelerationPx: 520,
  windFieldAccelerationPx: 460,
  conveyorAccelerationPx: 360,
} as const;

export const GRAPPLE = {
  baseRange: 470,
  forwardConeDot: -0.1,
  stiffness: 0.014,
  reticleRangeMultiplier: 1.08,
  temporaryAnchorLifetimeMs: 6500,
} as const;

export const DAMAGE = {
  smallEnemy: 10,
  projectile: 15,
  spikes: 20,
  laser: 25,
  crusher: 25,
  heavyEnemy: 30,
  fall: 25,
  invulnerabilityMs: 950,
  maxHealth: 100,
} as const;

export const ABILITIES: Readonly<
  Record<
    AbilityId,
    { nameKey: TranslationKey; descriptionKey: TranslationKey; cooldownMs: number; color: number }
  >
> = {
  'impact-dash': { nameKey: 'skill.impactDash.name', descriptionKey: 'skill.impactDash.description', cooldownMs: 5000, color: 0x32e9ff },
  'energy-bolt': { nameKey: 'skill.energyBolt.name', descriptionKey: 'skill.energyBolt.description', cooldownMs: 3000, color: 0xff4fc3 },
  'energy-shield': { nameKey: 'skill.energyShield.name', descriptionKey: 'skill.energyShield.description', cooldownMs: 10000, color: 0x71f7ff },
  'freeze-pulse': { nameKey: 'skill.freezePulse.name', descriptionKey: 'skill.freezePulse.description', cooldownMs: 10000, color: 0x95d9ff },
  'ground-slam': { nameKey: 'skill.groundSlam.name', descriptionKey: 'skill.groundSlam.description', cooldownMs: 4000, color: 0xffb44a },
  'temporary-anchor': { nameKey: 'skill.temporaryAnchor.name', descriptionKey: 'skill.temporaryAnchor.description', cooldownMs: 10000, color: 0xc979ff },
};

export const DIFFICULTIES: Readonly<Record<DifficultyId, DifficultyPreset>> = {
  beginner: {
    id: 'beginner',
    labelKey: 'difficulty.beginner.name',
    descriptionKey: 'difficulty.beginner.description',
    hazardSpeed: 0.72,
    enemyCadence: 0.72,
    damageScale: 0.75,
    grappleAssist: 1.4,
    healthPickupScale: 1.45,
    timingWindow: 1.25,
    cooldownScale: 0.9,
  },
  normal: {
    id: 'normal',
    labelKey: 'difficulty.normal.name',
    descriptionKey: 'difficulty.normal.description',
    hazardSpeed: 1,
    enemyCadence: 1,
    damageScale: 1,
    grappleAssist: 1,
    healthPickupScale: 1,
    timingWindow: 1,
    cooldownScale: 1,
  },
  advanced: {
    id: 'advanced',
    labelKey: 'difficulty.advanced.name',
    descriptionKey: 'difficulty.advanced.description',
    hazardSpeed: 1.16,
    enemyCadence: 1.2,
    damageScale: 1.1,
    grappleAssist: 0.86,
    healthPickupScale: 0.72,
    timingWindow: 0.9,
    cooldownScale: 1.04,
  },
  expert: {
    id: 'expert',
    labelKey: 'difficulty.expert.name',
    descriptionKey: 'difficulty.expert.description',
    hazardSpeed: 1.34,
    enemyCadence: 1.42,
    damageScale: 1.2,
    grappleAssist: 0.7,
    healthPickupScale: 0.5,
    timingWindow: 0.78,
    cooldownScale: 1.15,
  },
  nightmare: {
    id: 'nightmare',
    labelKey: 'difficulty.nightmare.name',
    descriptionKey: 'difficulty.nightmare.description',
    hazardSpeed: 1.52,
    enemyCadence: 1.68,
    damageScale: 1.35,
    grappleAssist: 0.54,
    healthPickupScale: 0.28,
    timingWindow: 0.68,
    cooldownScale: 1.25,
  },
};

export const DIFFICULTY_ORDER: readonly DifficultyId[] = [
  'beginner',
  'normal',
  'advanced',
  'expert',
  'nightmare',
];

export const COLORS = {
  ink: 0x070918,
  navy: 0x10162f,
  cyan: 0x32e9ff,
  magenta: 0xff4fc3,
  violet: 0x9b68ff,
  gold: 0xffc857,
  danger: 0xff5c63,
  health: 0x50f29a,
  white: 0xf2f7ff,
  muted: 0x8192b8,
} as const;
