import { describe, expect, it } from 'vitest';
import {
  createSeededNoise,
  hashSeed,
  sampleFractalNoise,
} from '../src/game/core/proceduralNoise';

describe('procedural material noise', () => {
  it('is stable for the same world position and seed', () => {
    const seed = hashSeed('neon-rooftops', 'nr-spike-1', 'metal');
    const first = sampleFractalNoise(760, 628, seed, 3, 0.04);
    const second = sampleFractalNoise(760, 628, seed, 3, 0.04);

    expect(second).toBe(first);
    expect(first).toBeGreaterThanOrEqual(-1);
    expect(first).toBeLessThanOrEqual(1);
  });

  it('changes with world position without changing texture density', () => {
    const seed = hashSeed('stone', 99017);
    const samples = Array.from({ length: 8 }, (_, index) =>
      sampleFractalNoise(index * 12, 42, seed, 3, 0.04),
    );

    expect(new Set(samples).size).toBeGreaterThan(4);
  });

  it('creates reproducible seeded random sequences', () => {
    const first = createSeededNoise(51109);
    const second = createSeededNoise(51109);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });
});
