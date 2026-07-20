import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/config';
import { materializeStage, STAGES } from '../src/game/levels/stages';
import { validateStage } from '../src/game/levels/validate';

describe('stage data and deterministic generation', () => {
  it('materializes equivalent course instances from the same seed', () => {
    const stage = STAGES['gravity-ruins'];
    const p1 = materializeStage(stage, 8842);
    const p2 = materializeStage(stage, 8842);
    expect(p1).toEqual(p2);
    expect(p1).not.toBe(p2);
    expect(p1.hazards).not.toBe(p2.hazards);
  });

  it('changes deterministic phases with a different seed', () => {
    const stage = STAGES['arcane-foundry'];
    expect(materializeStage(stage, 1).hazards).not.toEqual(materializeStage(stage, 2).hazards);
  });

  it('validates every shipped blueprint', () => {
    for (const stage of Object.values(STAGES)) expect(validateStage(stage)).toEqual([]);
  });

  it('orders difficulty modifiers from forgiving to severe', () => {
    expect(DIFFICULTIES.beginner.grappleAssist).toBeGreaterThan(DIFFICULTIES.normal.grappleAssist);
    expect(DIFFICULTIES.nightmare.hazardSpeed).toBeGreaterThan(DIFFICULTIES.expert.hazardSpeed);
    expect(DIFFICULTIES.nightmare.healthPickupScale).toBeLessThan(DIFFICULTIES.advanced.healthPickupScale);
    expect(DIFFICULTIES.expert.cooldownScale).toBeGreaterThan(1);
  });
});
