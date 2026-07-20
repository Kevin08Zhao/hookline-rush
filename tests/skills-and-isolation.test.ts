import { describe, expect, it } from 'vitest';
import { CourseState } from '../src/game/core/courseState';
import { SkillSlot } from '../src/game/core/skillSlot';
import { STAGES } from '../src/game/levels/stages';
import { ABILITY_REGISTRY, activateAbility } from '../src/game/systems/abilities';

describe('skill slot', () => {
  it('equips, replaces, cools down, and becomes ready independently', () => {
    const slot = new SkillSlot();
    slot.equip('impact-dash');
    expect(slot.use(1000).used).toBe(true);
    expect(slot.isReady(5999)).toBe(false);
    expect(slot.isReady(6000)).toBe(true);
    slot.equip('energy-bolt');
    expect(slot.ability).toBe('energy-bolt');
    expect(slot.isReady(1001)).toBe(true);
    expect(slot.use(2000, 1.25).readyAt).toBe(5750);
  });

  it('registers all six abilities behind one activation contract', () => {
    expect(Object.keys(ABILITY_REGISTRY)).toHaveLength(6);
    let activated = '';
    activateAbility('temporary-anchor', {
      now: 100,
      impactDash: () => (activated = 'dash'),
      energyBolt: () => (activated = 'bolt'),
      energyShield: () => (activated = 'shield'),
      freezePulse: () => (activated = 'freeze'),
      groundSlam: () => (activated = 'slam'),
      temporaryAnchor: () => (activated = 'anchor'),
    });
    expect(activated).toBe('anchor');
  });
});

describe('course instance isolation', () => {
  it('keeps pickups, defeated enemies, and freeze state private to the owner', () => {
    const stage = STAGES['neon-rooftops'];
    const p1 = new CourseState('p1', stage.pickups, stage.enemies);
    const p2 = new CourseState('p2', stage.pickups, stage.enemies);
    const pickupId = stage.pickups[0]?.id ?? '';
    const enemyId = stage.enemies[0]?.id ?? '';

    expect(p1.collect(pickupId)).not.toBeNull();
    expect(p1.defeat(enemyId)).toBe(true);
    p1.freeze(enemyId, 5000);

    expect(p2.collected.has(pickupId)).toBe(false);
    expect(p2.defeated.has(enemyId)).toBe(false);
    expect(p2.frozenUntil.has(enemyId)).toBe(false);
    expect(p2.collect(pickupId)).not.toBeNull();
  });
});
