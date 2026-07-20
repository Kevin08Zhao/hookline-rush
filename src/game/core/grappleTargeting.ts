import type { RectSpec, Vec2 } from '../types';

export interface TargetableAnchor extends Vec2 {
  readonly id: string;
  readonly active?: boolean;
  readonly range?: number;
}

export interface GrappleTargetOptions {
  readonly origin: Vec2;
  readonly anchors: readonly TargetableAnchor[];
  readonly blockers: readonly RectSpec[];
  readonly facing: 1 | -1;
  readonly upwardBias: boolean;
  readonly baseRange: number;
  readonly assistScale: number;
  readonly forwardConeDot: number;
}

function segmentIntersectsRect(from: Vec2, to: Vec2, rect: RectSpec): boolean {
  const left = rect.x - rect.width / 2;
  const right = rect.x + rect.width / 2;
  const top = rect.y - rect.height / 2;
  const bottom = rect.y + rect.height / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let near = 0;
  let far = 1;

  for (const [p, q] of [
    [-dx, from.x - left],
    [dx, right - from.x],
    [-dy, from.y - top],
    [dy, bottom - from.y],
  ] as const) {
    if (p === 0 && q < 0) return false;
    if (p !== 0) {
      const t = q / p;
      if (p < 0) near = Math.max(near, t);
      else far = Math.min(far, t);
      if (near > far) return false;
    }
  }
  return true;
}

export function selectGrappleTarget(options: GrappleTargetOptions): TargetableAnchor | null {
  // Difficulty changes targeting generosity without shrinking the rope so far that a
  // stage-authored anchor becomes unreachable. Swing assistance is tuned separately.
  const assistRangeScale = Math.max(0.92, Math.min(1.08, 0.9 + options.assistScale * 0.1));
  const range = options.baseRange * assistRangeScale;
  const candidates = options.anchors
    .filter((anchor) => anchor.active !== false)
    .map((anchor) => {
      const dx = anchor.x - options.origin.x;
      const dy = anchor.y - options.origin.y;
      const distance = Math.hypot(dx, dy);
      const allowedRange = Math.min(range, anchor.range ?? range);
      const facingDot = distance === 0 ? 1 : (dx / distance) * options.facing;
      const occluded = options.blockers.some((blocker) =>
        segmentIntersectsRect(options.origin, anchor, blocker),
      );
      const verticalScore = options.upwardBias ? Math.max(0, -dy) * 0.65 : 0;
      const forwardScore = Math.max(0, dx * options.facing) * 0.18;
      return {
        anchor,
        distance,
        valid: distance <= allowedRange && facingDot >= options.forwardConeDot && !occluded,
        score: distance - verticalScore - forwardScore,
      };
    })
    .filter((candidate) => candidate.valid)
    .sort((a, b) => a.score - b.score || a.anchor.id.localeCompare(b.anchor.id));

  return candidates[0]?.anchor ?? null;
}
