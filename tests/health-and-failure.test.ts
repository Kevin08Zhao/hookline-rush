import { describe, expect, it } from 'vitest';
import { HealthModel, resolveFailure } from '../src/game/core/health';

describe('health, invulnerability, and mode failure rules', () => {
  it('prevents a damage loop during invulnerability', () => {
    const health = new HealthModel(100);
    expect(health.takeDamage(20, 1000, 950).health).toBe(80);
    expect(health.takeDamage(30, 1200, 950).applied).toBe(false);
    expect(health.health).toBe(80);
    expect(health.takeDamage(30, 2000, 950).health).toBe(50);
  });

  it('consumes a shield before health', () => {
    const health = new HealthModel(100);
    health.activateShield(500, 2000);
    const result = health.takeDamage(40, 800, 950);
    expect(result.shieldConsumed).toBe(true);
    expect(health.health).toBe(100);
    expect(health.shieldUntil).toBe(0);
  });

  it('recovers nonfatal falls but distinguishes zero-HP solo and race outcomes', () => {
    expect(resolveFailure('solo', 75)).toBe('recover-checkpoint');
    expect(resolveFailure('race', 75)).toBe('recover-checkpoint');
    expect(resolveFailure('solo', 0)).toBe('game-over');
    expect(resolveFailure('race', 0)).toBe('race-respawn');
  });

  it('race respawn restoration can reset health and grant a safe window', () => {
    const health = new HealthModel(100);
    health.takeDamage(100, 1000, 950);
    health.reset(1500);
    expect(health.health).toBe(100);
    expect(health.invulnerableUntil).toBe(2600);
  });
});
