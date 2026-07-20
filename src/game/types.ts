import type { TranslationKey } from './i18n';

export type GameMode = 'solo' | 'race';
export type CourseId = 'solo' | 'p1' | 'p2';
export type DifficultyId = 'beginner' | 'normal' | 'advanced' | 'expert' | 'nightmare';
export type StageId = 'tutorial' | 'neon-rooftops' | 'arcane-foundry' | 'gravity-ruins';
export type AbilityId =
  | 'impact-dash'
  | 'energy-bolt'
  | 'energy-shield'
  | 'freeze-pulse'
  | 'ground-slam'
  | 'temporary-anchor';

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface RectSpec extends Vec2 {
  readonly width: number;
  readonly height: number;
}

export type AnchorKind = 'fixed' | 'moving' | 'fragile' | 'magical';

export interface AnchorSpec extends Vec2 {
  readonly id: string;
  readonly kind: AnchorKind;
  readonly range?: number;
  readonly moveX?: number;
  readonly moveY?: number;
  readonly periodMs?: number;
}

export interface PlatformSpec extends RectSpec {
  readonly id: string;
  readonly kind?: 'solid' | 'moving' | 'fragile' | 'conveyor' | 'disappearing';
  readonly moveX?: number;
  readonly moveY?: number;
  readonly periodMs?: number;
  readonly direction?: 1 | -1;
}

export type HazardType =
  | 'spikes'
  | 'low-tunnel'
  | 'cracked-wall'
  | 'crusher'
  | 'laser'
  | 'blade'
  | 'pit'
  | 'flame'
  | 'gravity-field'
  | 'wind-field';

export interface HazardSpec extends RectSpec {
  readonly id: string;
  readonly type: HazardType;
  readonly damage?: number;
  readonly periodMs?: number;
  readonly phaseMs?: number;
  readonly moveX?: number;
  readonly moveY?: number;
  readonly direction?: 1 | -1;
}

export type EnemyType = 'charger' | 'flyer' | 'turret' | 'armored-blocker';

export interface EnemySpec extends Vec2 {
  readonly id: string;
  readonly type: EnemyType;
  readonly patrol?: number;
  readonly facing?: 1 | -1;
}

export interface PickupSpec extends Vec2 {
  readonly id: string;
  readonly type: 'health' | 'skill';
  readonly ability?: AbilityId;
  readonly amount?: number;
}

export interface StageBlueprint {
  readonly id: StageId;
  readonly nameKey: TranslationKey;
  readonly subtitleKey: TranslationKey;
  readonly descriptionKey: TranslationKey;
  readonly theme: 'training' | 'neon' | 'foundry' | 'ruins';
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly start: Vec2;
  readonly finishX: number;
  readonly platforms: readonly PlatformSpec[];
  readonly anchors: readonly AnchorSpec[];
  readonly hazards: readonly HazardSpec[];
  readonly enemies: readonly EnemySpec[];
  readonly pickups: readonly PickupSpec[];
  readonly checkpoints: readonly Vec2[];
  readonly tutorialPrompts?: readonly {
    readonly x: number;
    readonly titleKey: TranslationKey;
    readonly bodyKey: TranslationKey;
  }[];
}

export interface MaterializedStage extends StageBlueprint {
  readonly hazards: readonly (HazardSpec & { readonly runtimePhaseMs: number })[];
  readonly enemies: readonly (EnemySpec & { readonly runtimePhaseMs: number })[];
}

export interface DifficultyPreset {
  readonly id: DifficultyId;
  readonly labelKey: TranslationKey;
  readonly descriptionKey: TranslationKey;
  readonly hazardSpeed: number;
  readonly enemyCadence: number;
  readonly damageScale: number;
  readonly grappleAssist: number;
  readonly healthPickupScale: number;
  readonly timingWindow: number;
  readonly cooldownScale: number;
}

export interface PlayerInputState {
  readonly horizontal: number;
  readonly vertical: number;
  readonly jump: boolean;
  readonly jumpPressed: boolean;
  readonly jumpReleased: boolean;
  readonly grapple: boolean;
  readonly grapplePressed: boolean;
  readonly skill: boolean;
  readonly skillPressed: boolean;
  readonly pausePressed: boolean;
}

export interface GameLaunchData {
  readonly mode: GameMode;
  readonly stageId: StageId;
  readonly difficultyId: DifficultyId;
  readonly deviceMode?: 'shared-keyboard' | 'keyboard-gamepad' | 'two-gamepads';
  readonly tutorial?: boolean;
}

export interface GameResultData extends GameLaunchData {
  readonly winner?: 1 | 2;
  readonly gameOver?: boolean;
  readonly p1TimeMs: number;
  readonly p2TimeMs?: number;
  readonly deaths: readonly [number, number];
}
