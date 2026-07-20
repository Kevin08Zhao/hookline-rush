import { describe, expect, it } from 'vitest';
import { ABILITIES, DIFFICULTIES } from '../src/game/config';
import { EN_US, translate } from '../src/game/i18n';
import { STAGES } from '../src/game/levels/stages';

describe('English localization', () => {
  it('contains non-empty translations for all declared keys', () => {
    expect(Object.keys(EN_US).length).toBeGreaterThan(100);
    for (const value of Object.values(EN_US)) {
      expect(value.trim()).not.toBe('');
      expect(value).not.toMatch(/\p{Script=Han}/u);
    }
  });

  it('covers every stage, difficulty, skill, and tutorial key', () => {
    const keys = [
      ...Object.values(STAGES).flatMap((stage) => [
        stage.nameKey,
        stage.subtitleKey,
        stage.descriptionKey,
        ...(stage.tutorialPrompts?.flatMap((prompt) => [prompt.titleKey, prompt.bodyKey]) ?? []),
      ]),
      ...Object.values(DIFFICULTIES).flatMap((difficulty) => [difficulty.labelKey, difficulty.descriptionKey]),
      ...Object.values(ABILITIES).flatMap((ability) => [ability.nameKey, ability.descriptionKey]),
    ];
    for (const key of keys) expect(translate(key)).not.toBe(`[[${key}]]`);
  });

  it('interpolates variables and safely marks a missing development key', () => {
    expect(translate('results.resets', { count: 3 })).toContain('3');
    expect(translate('missing.development.key')).toBe('[[missing.development.key]]');
  });
});
