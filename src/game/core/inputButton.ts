export interface ButtonEdges {
  readonly down: boolean;
  readonly pressed: boolean;
  readonly released: boolean;
}

export function sampleDigitalButton(previous: boolean, current: boolean): ButtonEdges {
  return {
    down: current,
    pressed: current && !previous,
    released: !current && previous,
  };
}

export class DigitalButtonLatch {
  private down = false;
  private pressed = false;
  private released = false;

  press(repeated = false): void {
    if (repeated || this.down) return;
    this.down = true;
    this.pressed = true;
  }

  release(): void {
    if (!this.down) return;
    this.down = false;
    this.released = true;
  }

  sample(): ButtonEdges {
    const edges = { down: this.down, pressed: this.pressed, released: this.released };
    this.pressed = false;
    this.released = false;
    return edges;
  }
}
