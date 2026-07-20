import { describe, expect, it } from 'vitest';
import { DigitalButtonLatch, sampleDigitalButton } from '../src/game/core/inputButton';

describe('keyboard and gamepad digital jump edges', () => {
  it('produces equivalent transitions for either input source', () => {
    const keyboardSamples = [false, true, true, false, true];
    const gamepadSamples = [...keyboardSamples];
    const edges = (samples: boolean[]) => samples.slice(1).map((current, index) =>
      sampleDigitalButton(samples[index] ?? false, current),
    );
    expect(edges(keyboardSamples)).toEqual(edges(gamepadSamples));
    expect(edges(keyboardSamples)).toEqual([
      { down: true, pressed: true, released: false },
      { down: true, pressed: false, released: false },
      { down: false, pressed: false, released: true },
      { down: true, pressed: true, released: false },
    ]);
  });

  it('latches a press and release that both happen between update frames', () => {
    const latch = new DigitalButtonLatch();
    latch.press();
    latch.release();
    expect(latch.sample()).toEqual({ down: false, pressed: true, released: true });
    expect(latch.sample()).toEqual({ down: false, pressed: false, released: false });
  });

  it('ignores held-key and operating-system auto-repeat down events', () => {
    const latch = new DigitalButtonLatch();
    latch.press();
    latch.press(true);
    latch.press();
    expect(latch.sample()).toEqual({ down: true, pressed: true, released: false });
    expect(latch.sample()).toEqual({ down: true, pressed: false, released: false });
  });
});
