import { describe, expect, it } from 'vitest';
import { DEFAULT_SAVE, bestTimeKey, parseSave } from '../src/game/core/persistence';

describe('local save serialization', () => {
  it('uses safe defaults for absent or malformed data', () => {
    expect(parseSave(null)).toEqual(DEFAULT_SAVE);
    expect(parseSave('{bad json')).toEqual(DEFAULT_SAVE);
  });

  it('bounds volume and rejects invalid best times', () => {
    const save = parseSave(
      JSON.stringify({
        version: 2,
        settings: { masterVolume: 9, musicVolume: -2, sfxVolume: 'loud', screenShake: false },
        bestTimes: { 'neon-rooftops:normal': 43210, bad: -1, nope: 'fast' },
        tutorialComplete: true,
      }),
    );
    expect(save.settings.masterVolume).toBe(1);
    expect(save.settings.musicVolume).toBe(0);
    expect(save.settings.sfxVolume).toBe(DEFAULT_SAVE.settings.sfxVolume);
    expect(save.settings.screenShake).toBe(false);
    expect(save.bestTimes).toEqual({ 'neon-rooftops:normal': 43210 });
    expect(save.tutorialComplete).toBe(true);
  });

  it('keeps preferences but resets incompatible version-one records', () => {
    const save = parseSave(JSON.stringify({
      version: 1,
      settings: { masterVolume: 0.25, reducedEffects: true },
      tutorialComplete: true,
      bestTimes: { 'neon-rooftops:normal': 12345 },
    }));
    expect(save.version).toBe(2);
    expect(save.settings.masterVolume).toBe(0.25);
    expect(save.settings.reducedEffects).toBe(true);
    expect(save.tutorialComplete).toBe(true);
    expect(save.bestTimes).toEqual({});
  });

  it('creates stable per-stage and difficulty keys', () => {
    expect(bestTimeKey('gravity-ruins', 'expert')).toBe('gravity-ruins:expert');
  });
});
