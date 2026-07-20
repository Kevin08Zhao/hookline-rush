import { describe, expect, it } from 'vitest';
import {
  boundsOverlap,
  circleOverlapsBounds,
  ellipseOverlapsBounds,
  rectangleBounds,
  triangleOverlapsBounds,
} from '../src/game/core/contactGeometry';

describe('visible contact geometry', () => {
  const player = rectangleBounds(0, 0, 20, 40);

  it('requires real contact instead of accepting a nearby gap', () => {
    expect(boundsOverlap(player, rectangleBounds(20.01, 0, 20, 40))).toBe(false);
    expect(boundsOverlap(player, rectangleBounds(20, 0, 20, 40))).toBe(true);
  });

  it('rejects empty corners around circular and elliptical hazards', () => {
    const corner = rectangleBounds(8, 8, 2, 2);
    expect(boundsOverlap(corner, rectangleBounds(0, 0, 20, 20))).toBe(true);
    expect(circleOverlapsBounds(corner, 0, 0, 5)).toBe(false);
    expect(ellipseOverlapsBounds(corner, 0, 0, 8, 3)).toBe(false);
    expect(ellipseOverlapsBounds(rectangleBounds(8.5, 0, 1, 2), 0, 0, 8, 3)).toBe(true);
  });

  it('uses the filled triangle rather than its surrounding air', () => {
    const a = { x: 0, y: 10 };
    const b = { x: 10, y: -10 };
    const c = { x: 20, y: 10 };
    expect(triangleOverlapsBounds(rectangleBounds(1, -8, 1, 1), a, b, c)).toBe(false);
    expect(triangleOverlapsBounds(rectangleBounds(10, -10, 1, 1), a, b, c)).toBe(true);
    expect(triangleOverlapsBounds(rectangleBounds(20.5, 10, 1, 1), a, b, c)).toBe(true);
  });
});
