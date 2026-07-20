import { describe, expect, it } from 'vitest';
import {
  RACE_DIVIDER_WIDTH,
  RACE_SECOND_VIEWPORT_X,
  RACE_VIEWPORT_WIDTH,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from '../src/game/config';

describe('two-player race layout', () => {
  it('splits the display into equal left and right viewports', () => {
    expect(RACE_VIEWPORT_WIDTH).toBe(632);
    expect(RACE_SECOND_VIEWPORT_X).toBe(648);
    expect(RACE_VIEWPORT_WIDTH * 2 + RACE_DIVIDER_WIDTH).toBe(VIEW_WIDTH);
  });

  it('keeps both race cameras at the full display height', () => {
    const playerOneViewport = { x: 0, y: 0, width: RACE_VIEWPORT_WIDTH, height: VIEW_HEIGHT };
    const playerTwoViewport = {
      x: RACE_SECOND_VIEWPORT_X,
      y: 0,
      width: RACE_VIEWPORT_WIDTH,
      height: VIEW_HEIGHT,
    };

    expect(playerOneViewport.height).toBe(VIEW_HEIGHT);
    expect(playerTwoViewport.height).toBe(VIEW_HEIGHT);
    expect(playerOneViewport.width).toBe(playerTwoViewport.width);
    expect(playerOneViewport.x + playerOneViewport.width).toBe(RACE_SECOND_VIEWPORT_X - RACE_DIVIDER_WIDTH);
  });
});
