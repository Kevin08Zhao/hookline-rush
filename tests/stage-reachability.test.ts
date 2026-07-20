import { describe, expect, it } from 'vitest';
import { GRAPPLE, MOVEMENT, TILE_SIZE } from '../src/game/config';
import { STAGES } from '../src/game/levels/stages';

describe('retuned stage route envelopes', () => {
  it('puts a reachable authored anchor beside every required ground gap', () => {
    const conservativeRange = GRAPPLE.baseRange * 0.954;
    for (const stage of Object.values(STAGES)) {
      for (const pit of stage.hazards.filter((hazard) => hazard.type === 'pit')) {
        const takeoff = { x: pit.x - pit.width / 2, y: 610 };
        const nearest = Math.min(
          ...stage.anchors.map((anchor) => Math.hypot(anchor.x - takeoff.x, anchor.y - takeoff.y)),
        );
        // A normal jump supplies the small remaining approach for the two longest ruin gaps.
        expect(nearest, `${stage.id}:${pit.id}`).toBeLessThanOrEqual(conservativeRange + 16);
      }
    }
  });

  it('keeps the tutorial small and large obstacles inside their intended jump envelopes', () => {
    const tutorial = STAGES.tutorial;
    const groundTop = 640;
    const small = tutorial.platforms.find((platform) => platform.id === 't-small-block');
    const large = tutorial.platforms.find((platform) => platform.id === 't-large-block');
    expect(small).toBeDefined();
    expect(large).toBeDefined();
    const smallRise = groundTop - ((small?.y ?? 0) - (small?.height ?? 0) / 2);
    const largeRise = groundTop - ((large?.y ?? 0) - (large?.height ?? 0) / 2);
    const smallHeight = MOVEMENT.smallJumpVelocityPx ** 2 / (2 * MOVEMENT.gravityPx);
    expect(smallRise).toBeLessThan(smallHeight);
    expect(largeRise).toBeGreaterThan(smallHeight);
    expect(largeRise).toBeLessThan(2.3 * 54);
  });

  it('keeps non-grapple gaps below one tile where a normal jump is expected', () => {
    const tutorialSmallGap =
      (STAGES.tutorial.platforms.find((platform) => platform.id === 't-small-block')?.x ?? 0) -
      STAGES.tutorial.start.x;
    expect(tutorialSmallGap).toBeGreaterThan(TILE_SIZE);
    expect(tutorialSmallGap).toBeLessThan(MOVEMENT.maxGroundSpeedPx * 1.25);
  });

  it('makes every authored low tunnel passable only with the physical prone collider', () => {
    for (const stage of Object.values(STAGES)) {
      for (const tunnel of stage.hazards.filter((hazard) => hazard.type === 'low-tunnel')) {
        const tunnelBottom = tunnel.y + tunnel.height / 2;
        const supportingGround = stage.platforms
          .filter((candidate) => {
            const candidateLeft = candidate.x - candidate.width / 2;
            const candidateRight = candidate.x + candidate.width / 2;
            return candidateLeft <= tunnel.x && candidateRight >= tunnel.x;
          })
          .sort(
            (a, b) =>
              a.y - a.height / 2 - tunnelBottom - (b.y - b.height / 2 - tunnelBottom),
          )
          .find((candidate) => candidate.y - candidate.height / 2 > tunnelBottom);
        expect(supportingGround, `${stage.id}:${tunnel.id}:support`).toBeDefined();
        const clearance =
          (supportingGround?.y ?? 0) - (supportingGround?.height ?? 0) / 2 - tunnelBottom;
        expect(clearance, `${stage.id}:${tunnel.id}:prone-clearance`).toBeGreaterThan(
          MOVEMENT.proneColliderHeightPx + 4,
        );
        expect(clearance, `${stage.id}:${tunnel.id}:standing-clearance`).toBeLessThan(
          MOVEMENT.standingColliderHeightPx - 4,
        );
      }
    }
  });

  it('includes the tutorial prompt and moving-platform prone corridor', () => {
    const tutorial = STAGES.tutorial;
    expect(
      tutorial.tutorialPrompts?.some(
        (prompt) => prompt.titleKey === 'tutorial.movingProne.title',
      ),
    ).toBe(true);
    const floor = tutorial.platforms.find(
      (candidate) => candidate.id === 't-moving-prone-floor',
    );
    const ceiling = tutorial.platforms.find(
      (candidate) => candidate.id === 't-moving-prone-ceiling',
    );
    expect(floor?.kind).toBe('moving');
    expect(floor?.moveX).toBeGreaterThan(0);
    const clearance =
      (floor?.y ?? 0) - (floor?.height ?? 0) / 2 -
      ((ceiling?.y ?? 0) + (ceiling?.height ?? 0) / 2);
    expect(clearance).toBeGreaterThan(MOVEMENT.proneColliderHeightPx + 4);
    expect(clearance).toBeLessThan(MOVEMENT.standingColliderHeightPx - 4);
  });
});
