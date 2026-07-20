export interface JumpTapTuning {
  readonly doubleTapWindowMs: number;
  readonly doubleTapUpgradeCutoffMs: number;
  readonly jumpBufferMs: number;
}

export type JumpPressResult = 'buffered' | 'upgrade' | 'ignored';

export function isWithinCoyoteWindow(
  now: number,
  lastGroundedAt: number,
  coyoteTimeMs: number,
): boolean {
  return now - lastGroundedAt <= coyoteTimeMs;
}

export class JumpTapState {
  private bufferedAt = -Infinity;
  private pendingRelease = false;
  private takeoffAt = -Infinity;
  private firstPressAt = -Infinity;
  private releasedAfterTakeoff = false;
  private upgraded = false;
  private sequenceId = 0;

  constructor(private readonly tuning: JumpTapTuning) {}

  press(now: number, repeated = false): JumpPressResult {
    if (repeated) return 'ignored';
    if (this.hasActiveSequence()) {
      const inTapWindow = now - this.firstPressAt <= this.tuning.doubleTapWindowMs;
      const beforeCutoff = now - this.takeoffAt <= this.tuning.doubleTapUpgradeCutoffMs;
      if (this.releasedAfterTakeoff && !this.upgraded && inTapWindow && beforeCutoff) {
        this.upgraded = true;
        return 'upgrade';
      }
      if (this.upgraded && inTapWindow) return 'ignored';
    }

    if (!this.hasActiveSequence() && Number.isFinite(this.bufferedAt)) {
      return 'ignored';
    }

    this.bufferedAt = now;
    this.pendingRelease = false;
    return 'buffered';
  }

  release(): void {
    if (Number.isFinite(this.bufferedAt)) this.pendingRelease = true;
    if (this.hasActiveSequence()) this.releasedAfterTakeoff = true;
  }

  hasBufferedPress(now: number): boolean {
    return now - this.bufferedAt <= this.tuning.jumpBufferMs;
  }

  consumeTakeoff(now: number): number | null {
    if (!this.hasBufferedPress(now)) return null;
    this.sequenceId += 1;
    this.firstPressAt = this.bufferedAt;
    this.takeoffAt = now;
    this.releasedAfterTakeoff = this.pendingRelease;
    this.upgraded = false;
    this.bufferedAt = -Infinity;
    this.pendingRelease = false;
    return this.sequenceId;
  }

  canApplyUpgrade(now: number, verticalVelocity: number): boolean {
    return (
      this.hasActiveSequence() &&
      this.upgraded &&
      verticalVelocity < 0 &&
      now - this.takeoffAt <= this.tuning.doubleTapUpgradeCutoffMs
    );
  }

  cancelBufferedPress(): void {
    this.bufferedAt = -Infinity;
    this.pendingRelease = false;
  }

  land(now: number): void {
    const bufferedAt = this.hasBufferedPress(now) ? this.bufferedAt : -Infinity;
    const pendingRelease = Number.isFinite(bufferedAt) && this.pendingRelease;
    this.takeoffAt = -Infinity;
    this.firstPressAt = -Infinity;
    this.releasedAfterTakeoff = false;
    this.upgraded = false;
    this.bufferedAt = bufferedAt;
    this.pendingRelease = pendingRelease;
  }

  reset(): void {
    this.bufferedAt = -Infinity;
    this.pendingRelease = false;
    this.takeoffAt = -Infinity;
    this.firstPressAt = -Infinity;
    this.releasedAfterTakeoff = false;
    this.upgraded = false;
  }

  snapshot(): Readonly<{
    sequenceId: number;
    buffered: boolean;
    active: boolean;
    released: boolean;
    upgraded: boolean;
  }> {
    return {
      sequenceId: this.sequenceId,
      buffered: Number.isFinite(this.bufferedAt),
      active: this.hasActiveSequence(),
      released: this.releasedAfterTakeoff,
      upgraded: this.upgraded,
    };
  }

  private hasActiveSequence(): boolean {
    return Number.isFinite(this.takeoffAt);
  }
}
