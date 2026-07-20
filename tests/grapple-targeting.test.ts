import { describe, expect, it } from 'vitest';
import { selectGrappleTarget } from '../src/game/core/grappleTargeting';

const defaults = {
  origin: { x: 0, y: 0 },
  blockers: [],
  facing: 1 as const,
  upwardBias: false,
  baseRange: 500,
  assistScale: 1,
  forwardConeDot: -0.1,
};

describe('grapple target filtering and priority', () => {
  it('filters anchors outside effective range', () => {
    const target = selectGrappleTarget({
      ...defaults,
      anchors: [
        { id: 'far', x: 600, y: -50 },
        { id: 'near', x: 320, y: -30 },
      ],
    });
    expect(target?.id).toBe('near');
  });

  it('never selects through a nearer solid wall', () => {
    const target = selectGrappleTarget({
      ...defaults,
      anchors: [
        { id: 'blocked', x: 350, y: -20 },
        { id: 'clear', x: 120, y: -220 },
      ],
      blockers: [{ x: 180, y: -10, width: 30, height: 160 }],
    });
    expect(target?.id).toBe('clear');
  });

  it('uses upward input to bias a viable high anchor', () => {
    const anchors = [
      { id: 'low', x: 250, y: -20 },
      { id: 'high', x: 280, y: -260 },
    ];
    expect(selectGrappleTarget({ ...defaults, anchors })?.id).toBe('low');
    expect(selectGrappleTarget({ ...defaults, anchors, upwardBias: true })?.id).toBe('high');
  });

  it('rejects inactive and rear-cone anchors', () => {
    expect(
      selectGrappleTarget({
        ...defaults,
        anchors: [
          { id: 'inactive', x: 80, y: -20, active: false },
          { id: 'behind', x: -150, y: -20 },
        ],
      }),
    ).toBeNull();
  });

  it('keeps authored anchors reachable when high difficulty lowers assistance', () => {
    expect(
      selectGrappleTarget({
        ...defaults,
        baseRange: 470,
        assistScale: 0.54,
        anchors: [{ id: 'route-anchor', x: 190, y: -390 }],
      })?.id,
    ).toBe('route-anchor');
  });
});
