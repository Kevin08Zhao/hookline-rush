import Phaser from 'phaser';
import type { ContactBounds } from '../core/contactGeometry';
import {
  aimGrapplePose,
  interpolateRigPose,
  NEUTRAL_RIG_POSE,
  PLAYER_ANIMATION_CLIPS,
  RIG_DIMENSIONS,
  RIG_PART_NAMES,
  RIG_PART_WIDTHS,
  RIG_RENDER_SCALE,
  sampleAnimationClip,
  segmentEndpoint,
  selectPlayerAnimationMode,
  solveRigPose,
  rigPoseBounds,
  type PlayerAnimationMode,
  type RigPartName,
  type RigPartTransform,
  type RigPose,
  type SolvedRigPose,
} from '../core/playerAnimation';
import type { PlayerMotionState } from '../core/playerStateMachine';
import type { Vec2 } from '../types';

export interface PlayerRigFrame {
  readonly x: number;
  readonly y: number;
  readonly facing: 1 | -1;
  readonly motionState: PlayerMotionState;
  readonly speedX: number;
  readonly speedY: number;
  readonly colliderHeight: number;
  readonly isSlamming: boolean;
  readonly grappleTarget: Vec2 | null;
  readonly deltaMs: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function rotatedOffset(x: number, y: number, rotation: number): { x: number; y: number } {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return { x: x * cosine - y * sine, y: x * sine + y * cosine };
}

export class PlayerRig extends Phaser.GameObjects.Container {
  private readonly parts: Record<RigPartName, Phaser.GameObjects.Image>;
  private readonly bodyParts: readonly Phaser.GameObjects.Image[];
  private readonly accentParts: readonly Phaser.GameObjects.Image[];
  private readonly visor: Phaser.GameObjects.Image;
  private readonly chest: Phaser.GameObjects.Image;
  private readonly scarfUpper: Phaser.GameObjects.Image;
  private readonly scarfLower: Phaser.GameObjects.Image;
  private animationMode: PlayerAnimationMode = 'idle';
  private modeElapsedMs = 0;
  private scarfAngle = 0;
  private scarfStretch = 0.72;
  private renderedPose: RigPose = NEUTRAL_RIG_POSE;
  private solvedPose: SolvedRigPose = solveRigPose(NEUTRAL_RIG_POSE);
  private worldContactBoundsValue: ContactBounds = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly baseColor: number,
  ) {
    super(scene, x, y);
    scene.add.existing(this);

    const limb = (
      texture: string,
      width: number,
      length: number,
      alpha = 1,
    ): Phaser.GameObjects.Image =>
      scene.add
        .image(0, 0, texture)
        .setDisplaySize(width, length + 4)
        .setOrigin(0.5, 2 / (length + 4))
        .setAlpha(alpha);

    const upperArmBack = limb(
      'rig-upper-arm',
      RIG_PART_WIDTHS.upperArmBack,
      RIG_DIMENSIONS.upperArmLength,
      0.62,
    );
    const lowerArmBack = limb(
      'rig-forearm',
      RIG_PART_WIDTHS.lowerArmBack,
      RIG_DIMENSIONS.lowerArmLength,
      0.62,
    );
    const upperLegBack = limb(
      'rig-thigh',
      RIG_PART_WIDTHS.upperLegBack,
      RIG_DIMENSIONS.upperLegLength,
      0.7,
    );
    const lowerLegBack = limb(
      'rig-shin',
      RIG_PART_WIDTHS.lowerLegBack,
      RIG_DIMENSIONS.lowerLegLength,
      0.7,
    );
    const upperArmFront = limb(
      'rig-upper-arm',
      RIG_PART_WIDTHS.upperArmFront,
      RIG_DIMENSIONS.upperArmLength,
    );
    const lowerArmFront = limb(
      'rig-forearm',
      RIG_PART_WIDTHS.lowerArmFront,
      RIG_DIMENSIONS.lowerArmLength,
    );
    const upperLegFront = limb(
      'rig-thigh',
      RIG_PART_WIDTHS.upperLegFront,
      RIG_DIMENSIONS.upperLegLength,
    );
    const lowerLegFront = limb(
      'rig-shin',
      RIG_PART_WIDTHS.lowerLegFront,
      RIG_DIMENSIONS.lowerLegLength,
    );
    const torso = scene.add.image(0, 0, 'rig-torso').setDisplaySize(RIG_PART_WIDTHS.torso, 25);
    const head = scene.add.image(0, 0, 'rig-head').setDisplaySize(RIG_PART_WIDTHS.head, 17.5);
    this.visor = scene.add.image(0, 0, 'rig-visor').setDisplaySize(10, 4.5);
    this.chest = scene.add.image(0, 0, 'rig-chest').setDisplaySize(9, 7.5);
    this.scarfUpper = scene.add
      .image(0, 0, 'rig-scarf')
      .setDisplaySize(22, 5.5)
      .setOrigin(1, 0.5)
      .setAlpha(0.9);
    this.scarfLower = scene.add
      .image(0, 0, 'rig-scarf')
      .setDisplaySize(18, 4.5)
      .setOrigin(1, 0.5)
      .setAlpha(0.7);

    this.parts = {
      head,
      torso,
      upperArmFront,
      lowerArmFront,
      upperArmBack,
      lowerArmBack,
      upperLegFront,
      lowerLegFront,
      upperLegBack,
      lowerLegBack,
    };
    this.bodyParts = RIG_PART_NAMES.map((name) => this.parts[name]);
    this.accentParts = [this.visor, this.chest, this.scarfUpper, this.scarfLower];

    this.add([
      this.scarfLower,
      this.scarfUpper,
      upperArmBack,
      lowerArmBack,
      upperLegBack,
      lowerLegBack,
      torso,
      upperLegFront,
      lowerLegFront,
      upperArmFront,
      lowerArmFront,
      head,
      this.chest,
      this.visor,
    ]);
    this.clearRigTint();
    this.setDepth(31);
    this.applyPose(this.renderedPose);
  }

  updatePose(frame: PlayerRigFrame): void {
    const nextMode = selectPlayerAnimationMode(frame);
    const modeChanged = nextMode !== this.animationMode;
    if (modeChanged) {
      this.animationMode = nextMode;
      this.modeElapsedMs = 0;
    } else {
      this.modeElapsedMs += Math.min(Math.max(frame.deltaMs, 0), 50);
    }

    const progress = this.animationProgress(nextMode, frame);
    let targetPose = sampleAnimationClip(PLAYER_ANIMATION_CLIPS[nextMode], progress);
    if (nextMode === 'run') {
      const strideWeight = clamp(Math.abs(frame.speedX) / 190, 0.28, 1);
      targetPose = interpolateRigPose(NEUTRAL_RIG_POSE, targetPose, strideWeight);
    }
    if (nextMode === 'grapple' && frame.grappleTarget) {
      const localTargetX = (frame.grappleTarget.x - frame.x) * frame.facing;
      const targetY = frame.grappleTarget.y - frame.y;
      const targetAngle = Math.atan2(-localTargetX, targetY);
      targetPose = aimGrapplePose(targetPose, targetAngle);
    }

    const clampedDeltaSeconds = Math.min(Math.max(frame.deltaMs, 0), 50) / 1000;
    const response = nextMode === 'run' ? 24 : 19;
    const blendAmount = 1 - Math.exp(-response * clampedDeltaSeconds);
    this.renderedPose =
      modeChanged && nextMode === 'prone'
        ? targetPose
        : interpolateRigPose(this.renderedPose, targetPose, blendAmount);

    const renderedBounds = rigPoseBounds(this.renderedPose, RIG_RENDER_SCALE);
    const renderedCenterX = (renderedBounds.left + renderedBounds.right) / 2;
    const footY = frame.y + frame.colliderHeight / 2;
    const rigX = frame.x - renderedCenterX * frame.facing;
    const rigY = footY - renderedBounds.bottom;
    this.setPosition(rigX, rigY);
    this.setScale(frame.facing * RIG_RENDER_SCALE, RIG_RENDER_SCALE);
    this.updateScarf(frame, clampedDeltaSeconds);
    this.applyPose(this.renderedPose);
    this.worldContactBoundsValue =
      frame.facing === 1
        ? {
            left: rigX + renderedBounds.left,
            top: rigY + renderedBounds.top,
            right: rigX + renderedBounds.right,
            bottom: rigY + renderedBounds.bottom,
          }
        : {
            left: rigX - renderedBounds.right,
            top: rigY + renderedBounds.top,
            right: rigX - renderedBounds.left,
            bottom: rigY + renderedBounds.bottom,
          };
  }

  contactBounds(): ContactBounds {
    return { ...this.worldContactBoundsValue };
  }

  grappleOriginWorld(): Vec2 {
    const forearm = this.solvedPose.lowerArmFront;
    const hand = segmentEndpoint(forearm, forearm.rotation, RIG_DIMENSIONS.lowerArmLength);
    return {
      x: this.x + hand.x * this.scaleX,
      y: this.y + hand.y * this.scaleY,
    };
  }

  setRigTint(color: number): this {
    [...this.bodyParts, ...this.accentParts].forEach((part) => part.setTint(color));
    return this;
  }

  clearRigTint(): this {
    [...this.bodyParts, ...this.accentParts].forEach((part) => part.clearTint());
    this.accentParts.forEach((part) => part.setTint(this.baseColor));
    return this;
  }

  private animationProgress(mode: PlayerAnimationMode, frame: PlayerRigFrame): number {
    switch (mode) {
      case 'idle':
        return this.modeElapsedMs / 1_500;
      case 'run': {
        const cadence = clamp(Math.abs(frame.speedX) / 285, 0.4, 1.35);
        return (this.modeElapsedMs / 500) * cadence;
      }
      case 'prone': {
        const crawlCadence = clamp(Math.abs(frame.speedX) / 92, 0, 1);
        return (this.modeElapsedMs / 720) * crawlCadence;
      }
      case 'jump-rise':
        return 1 - clamp(-frame.speedY / 480, 0, 1);
      case 'jump-fall':
        return clamp(frame.speedY / 700, 0, 1);
      case 'grapple':
        return this.modeElapsedMs / 760;
      case 'slam':
        return clamp(frame.speedY / 720, 0, 1);
      case 'knockback':
        return clamp(this.modeElapsedMs / 180, 0, 1);
    }
  }

  private applyPose(poseToApply: RigPose): void {
    this.solvedPose = solveRigPose(poseToApply);
    for (const name of RIG_PART_NAMES) this.applyPart(this.parts[name], this.solvedPose[name]);

    const head = this.solvedPose.head;
    const visorOffset = rotatedOffset(3.9, -0.2, head.rotation);
    this.visor
      .setPosition(head.x + visorOffset.x, head.y + visorOffset.y)
      .setRotation(head.rotation);

    const torso = this.solvedPose.torso;
    const chestOffset = rotatedOffset(2.1, -1.2, torso.rotation);
    this.chest
      .setPosition(torso.x + chestOffset.x, torso.y + chestOffset.y)
      .setRotation(torso.rotation);

    const scarfAnchor = rotatedOffset(-6.2, -8.2, torso.rotation);
    const scarfX = torso.x + scarfAnchor.x;
    const scarfY = torso.y + scarfAnchor.y;
    this.scarfUpper
      .setPosition(scarfX, scarfY - 0.7)
      .setRotation(torso.rotation + this.scarfAngle - 0.08)
      .setScale(this.scarfStretch, 1);
    this.scarfLower
      .setPosition(scarfX - 0.4, scarfY + 1.3)
      .setRotation(torso.rotation + this.scarfAngle + 0.12)
      .setScale(this.scarfStretch * 0.86, 1);
  }

  private updateScarf(frame: PlayerRigFrame, deltaSeconds: number): void {
    const speedWeight = clamp(Math.abs(frame.speedX) / 285, 0, 1);
    const targetAngle = clamp(frame.speedY / 850, -0.38, 0.38);
    const response = 1 - Math.exp(-12 * deltaSeconds);
    this.scarfAngle += (targetAngle - this.scarfAngle) * response;
    const targetStretch = 0.7 + speedWeight * 0.42 + (this.animationMode === 'grapple' ? 0.12 : 0);
    this.scarfStretch += (targetStretch - this.scarfStretch) * response;
  }

  private applyPart(image: Phaser.GameObjects.Image, transform: RigPartTransform): void {
    image.setPosition(transform.x, transform.y).setRotation(transform.rotation);
  }
}
