import type { DifficultyId, StageId } from '../types';

export interface GameSettings {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly screenShake: boolean;
  readonly reducedEffects: boolean;
  readonly debugOverlay: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.7,
  musicVolume: 0.35,
  sfxVolume: 0.75,
  screenShake: true,
  reducedEffects: false,
  debugOverlay: false,
};

export interface SaveData {
  readonly version: 2;
  readonly settings: GameSettings;
  readonly tutorialComplete: boolean;
  readonly bestTimes: Readonly<Record<string, number>>;
}

export const DEFAULT_SAVE: SaveData = {
  version: 2,
  settings: DEFAULT_SETTINGS,
  tutorialComplete: false,
  bestTimes: {},
};

function boundedVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

export function parseSave(raw: string | null): SaveData {
  if (!raw) return DEFAULT_SAVE;
  try {
    const parsed = JSON.parse(raw) as Partial<SaveData> & { settings?: Partial<GameSettings> };
    const settings: Partial<GameSettings> = parsed.settings ?? {};
    const bestTimes =
      parsed.version === 2 && parsed.bestTimes && typeof parsed.bestTimes === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.bestTimes).filter(
              ([key, value]) => key.length < 100 && typeof value === 'number' && value > 0,
            ),
          )
        : {};
    return {
      version: 2,
      settings: {
        masterVolume: boundedVolume(settings.masterVolume, DEFAULT_SETTINGS.masterVolume),
        musicVolume: boundedVolume(settings.musicVolume, DEFAULT_SETTINGS.musicVolume),
        sfxVolume: boundedVolume(settings.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
        screenShake:
          typeof settings.screenShake === 'boolean'
            ? settings.screenShake
            : DEFAULT_SETTINGS.screenShake,
        reducedEffects:
          typeof settings.reducedEffects === 'boolean'
            ? settings.reducedEffects
            : DEFAULT_SETTINGS.reducedEffects,
        debugOverlay:
          typeof settings.debugOverlay === 'boolean'
            ? settings.debugOverlay
            : DEFAULT_SETTINGS.debugOverlay,
      },
      tutorialComplete: parsed.tutorialComplete === true,
      bestTimes,
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

export function bestTimeKey(stageId: StageId, difficultyId: DifficultyId): string {
  return `${stageId}:${difficultyId}`;
}
