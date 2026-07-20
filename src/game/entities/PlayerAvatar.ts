import Phaser from 'phaser';
import { DAMAGE, MOVEMENT } from '../config';
import type { ContactBounds } from '../core/contactGeometry';
import { HealthModel } from '../core/health';
import { isWithinCoyoteWindow, JumpTapState } from '../core/jumpTap';
import { PlayerStateMachine, type PlayerMotionState } from '../core/playerStateMachine';
import {
  applyAcceleration,
  matterVelocityToPixelsPerSecond,
  pixelsPerSecondToMatterVelocity,
  stepHorizontalVelocity,
} from '../core/movement';
import {
  proneSideRegions,
  resizeColliderInPlace,
  resolveDownAction,
  standingHeadroomRegion,
  stepProneVelocity,
} from '../core/prone';
import { SkillSlot } from '../core/skillSlot';
import type { CourseId, PlayerInputState, Vec2 } from '../types';
import { PlayerRig } from '../visuals/PlayerRig';

export interface PlayerCallbacks {
  readonly onJump: (kind: 'small' | 'large' | 'wall') => void;
  readonly onLand: (speed: number) => void;
}

export class PlayerAvatar extends Phaser.Physics.Matter.Sprite {
  readonly health = new HealthModel(DAMAGE.maxHealth);
  readonly skills = new SkillSlot();
  readonly avatarVisual: PlayerRig;
  facing: 1 | -1 = 1;
  grounded = false;
  isDashing = false;
  isSlamming = false;
  dashUntil = 0;
  lastSafePosition: Vec2;
  wallJumpsRemaining = MOVEMENT.maxWallJumps;
  private lastGroundedAt = -Infinity;
  private wasGrounded = false;
  private previousVelocityY = 0;
  private readonly motion = new PlayerStateMachine('airborne');
  private colliderIsProne = false;
  private colliderWidthPx: number = MOVEMENT.standingColliderWidthPx;
  private colliderHeightPx: number = MOVEMENT.standingColliderHeightPx;
  private grappleActive = false;
  private grappleTarget: Vec2 | null = null;
  private knockbackUntil = 0;
  private readonly jumpTap = new JumpTapState({
    doubleTapWindowMs: MOVEMENT.doubleTapWindowMs,
    doubleTapUpgradeCutoffMs: MOVEMENT.doubleTapUpgradeCutoffMs,
    jumpBufferMs: MOVEMENT.jumpBufferMs,
  });

  private get matterBody(): any {
    return this.body as any;
  }

  get isProne(): boolean {
    return this.motion.state === 'prone';
  }

  get motionState(): PlayerMotionState {
    return this.motion.state;
  }

  get currentColliderHeight(): number {
    return this.colliderHeightPx;
  }

  get currentColliderWidth(): number {
    return this.colliderWidthPx;
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    visualColor: number,
    readonly owner: CourseId,
    private readonly solidCategory: number,
    playerCategory: number,
    private readonly callbacks: PlayerCallbacks,
  ) {
    super(scene.matter.world, x, y, texture);
    scene.add.existing(this);
    this.avatarVisual = new PlayerRig(scene, x, y, visualColor);
    this.setRectangle(MOVEMENT.standingColliderWidthPx, MOVEMENT.standingColliderHeightPx, {
      chamfer: { radius: 8 },
      label: `player:${owner}`,
    });
    this.setFixedRotation();
    // The horizontal/vertical velocity controller fully owns the player's motion each
    // frame, so any Matter friction only fights it and produces jittery, inconsistent
    // speeds. Zeroing friction lets the tuning in `movement.ts` drive motion cleanly.
    this.setFriction(0, 0, 0);
    this.setFrictionAir(0);
    this.setBounce(0);
    this.setCollisionCategory(playerCategory);
    this.setCollidesWith(solidCategory);
    this.setDepth(30);
    this.setVisible(false);
    this.lastSafePosition = { x, y };
    this.avatarVisual.updatePose({
      x,
      y,
      facing: this.facing,
      motionState: this.motion.state,
      speedX: 0,
      speedY: 0,
      colliderHeight: this.colliderHeightPx,
      isSlamming: false,
      grappleTarget: null,
      deltaMs: 0,
    });
    this.syncHorizontalColliderToVisual();
  }

  updatePlayer(input: PlayerInputState, now: number, deltaMs: number): void {
    this.grounded = this.detectGround();
    const wallDirection = this.detectWall();
    const landed = this.grounded && !this.wasGrounded;
    if (landed) this.jumpTap.land(now);
    if (this.grounded) {
      this.lastGroundedAt = now;
      this.wallJumpsRemaining = MOVEMENT.maxWallJumps;
    }

    if (landed && this.previousVelocityY > 4.5) {
      this.callbacks.onLand(matterVelocityToPixelsPerSecond(this.previousVelocityY));
    }
    this.wasGrounded = this.grounded;
    const downAction = resolveDownAction(this.grounded, input.vertical > 0.45);
    this.updateMotionState(downAction === 'prone', now);

    if (input.jumpReleased) this.jumpTap.release();
    const pressResult = input.jumpPressed ? this.jumpTap.press(now) : 'ignored';
    let tookOffThisFrame = false;
    if (
      pressResult === 'upgrade' &&
      this.jumpTap.canApplyUpgrade(now, this.matterBody.velocity.y)
    ) {
      const currentVelocityPx = matterVelocityToPixelsPerSecond(this.matterBody.velocity.y);
      const targetVelocityPx = -MOVEMENT.largeJumpVelocityPx;
      const upgradedVelocityPx = Math.max(
        targetVelocityPx,
        currentVelocityPx - MOVEMENT.largeJumpUpgradeMaxDeltaPx,
      );
      this.setVelocityY(pixelsPerSecondToMatterVelocity(upgradedVelocityPx));
      this.callbacks.onJump('large');
    }

    const jumpBuffered = this.jumpTap.hasBufferedPress(now);
    const canCoyote = isWithinCoyoteWindow(now, this.lastGroundedAt, MOVEMENT.coyoteTimeMs);
    if (jumpBuffered && canCoyote) {
      const canTakeOff = !this.isProne || this.leaveProne(now, 'airborne');
      if (canTakeOff) {
        this.jumpTap.consumeTakeoff(now);
        if (!this.isProne) this.motion.transition('airborne', now);
        this.setVelocityY(-pixelsPerSecondToMatterVelocity(MOVEMENT.smallJumpVelocityPx));
        this.lastGroundedAt = -Infinity;
        tookOffThisFrame = true;
        this.callbacks.onJump('small');
      }
    } else if (jumpBuffered && wallDirection !== 0 && this.wallJumpsRemaining > 0) {
      const canTakeOff = !this.isProne || this.leaveProne(now, 'airborne');
      if (canTakeOff) {
        if (!this.isProne) this.motion.transition('airborne', now);
        this.facing = wallDirection === -1 ? 1 : -1;
        this.setVelocity(
          this.facing * pixelsPerSecondToMatterVelocity(MOVEMENT.wallJumpVelocityXPx),
          -pixelsPerSecondToMatterVelocity(MOVEMENT.wallJumpVelocityYPx),
        );
        this.wallJumpsRemaining -= 1;
        this.jumpTap.reset();
        tookOffThisFrame = true;
        this.callbacks.onJump('wall');
      }
    }

    this.isDashing = now < this.dashUntil;
    if (Math.abs(input.horizontal) > 0.08) {
      this.facing = input.horizontal >= 0 ? 1 : -1;
    }
    if (!this.isDashing) {
      const currentVelocityPx = matterVelocityToPixelsPerSecond(this.matterBody.velocity.x);
      const nextVelocityPx = this.isProne
        ? stepProneVelocity(currentVelocityPx, input.horizontal, deltaMs / 1000, MOVEMENT)
        : stepHorizontalVelocity(
            currentVelocityPx,
            input.horizontal,
            this.grounded && !tookOffThisFrame,
            deltaMs / 1000,
            MOVEMENT,
          );
      this.setVelocityX(pixelsPerSecondToMatterVelocity(nextVelocityPx));
    }

    if (downAction === 'fast-fall') {
      const velocityY = applyAcceleration(
        matterVelocityToPixelsPerSecond(this.matterBody.velocity.y),
        MOVEMENT.fastFallAccelerationPx,
        deltaMs / 1000,
        MOVEMENT.terminalFallSpeedPx,
      );
      this.setVelocityY(pixelsPerSecondToMatterVelocity(velocityY));
    }
    const safeVerticalVelocityPx = Phaser.Math.Clamp(
      matterVelocityToPixelsPerSecond(this.matterBody.velocity.y),
      -MOVEMENT.emergencyVerticalCapPx,
      MOVEMENT.terminalFallSpeedPx,
    );
    this.setVelocityY(pixelsPerSecondToMatterVelocity(safeVerticalVelocityPx));
    if (!this.isProne) this.restoreStandingColliderIfClear();
    this.avatarVisual.updatePose({
      x: this.x,
      y: this.y,
      facing: this.facing,
      motionState: this.motion.state,
      speedX: matterVelocityToPixelsPerSecond(this.matterBody.velocity.x),
      speedY: matterVelocityToPixelsPerSecond(this.matterBody.velocity.y),
      colliderHeight: this.colliderHeightPx,
      isSlamming: this.isSlamming,
      grappleTarget: this.grappleTarget,
      deltaMs,
    });
    this.syncHorizontalColliderToVisual();

    this.avatarVisual.setAlpha(
      now < this.health.invulnerableUntil && Math.floor(now / 80) % 2 === 0 ? 0.38 : 1,
    );
    if (this.health.shieldUntil > now) this.avatarVisual.setRigTint(0x8ff7ff);
    else if (this.isDashing) this.avatarVisual.setRigTint(0xffffff);
    else this.avatarVisual.clearRigTint();
    this.previousVelocityY = this.matterBody.velocity.y;
  }

  dash(now: number): void {
    this.isDashing = true;
    this.dashUntil = now + 330;
    this.setVelocity(
      this.facing * pixelsPerSecondToMatterVelocity(MOVEMENT.impactDashSpeedPx),
      Math.min(this.matterBody.velocity.y, 0),
    );
  }

  slam(): void {
    if (this.grounded || this.isProne) return;
    this.isSlamming = true;
    this.setVelocityY(pixelsPerSecondToMatterVelocity(MOVEMENT.groundSlamSpeedPx));
  }

  clearTransientMotion(now = this.scene.time.now): void {
    this.isDashing = false;
    this.isSlamming = false;
    this.dashUntil = 0;
    this.grappleActive = false;
    this.grappleTarget = null;
    this.knockbackUntil = 0;
    this.motion.transition('respawning', now);
    this.setProneCollider(false, true);
    this.jumpTap.reset();
  }

  respawn(position: Vec2, now: number, fullReset: boolean): void {
    this.clearTransientMotion(now);
    this.setPosition(position.x, position.y);
    this.setVelocity(0, 0);
    if (fullReset) {
      this.health.reset(now);
      this.skills.clear();
    } else {
      this.health.invulnerableUntil = now + 1100;
    }
  }

  cancelJumpSequence(): void {
    this.jumpTap.reset();
  }

  beginGrapple(now: number): boolean {
    if (!this.restoreStandingColliderIfClear()) return false;
    this.grappleActive = true;
    this.motion.transition('grappling', now);
    this.jumpTap.reset();
    return true;
  }

  endGrapple(now: number): void {
    this.grappleActive = false;
    this.grappleTarget = null;
    this.motion.transition(this.grounded ? 'grounded-run' : 'airborne', now);
    this.restoreStandingColliderIfClear();
  }

  beginKnockback(now: number): void {
    this.grappleActive = false;
    this.grappleTarget = null;
    this.knockbackUntil = now + 180;
    if (this.restoreStandingColliderIfClear()) this.motion.transition('knockback', now);
    this.jumpTap.reset();
  }

  applyExternalAcceleration(
    accelerationXPx: number,
    accelerationYPx: number,
    deltaMs: number,
  ): void {
    const deltaSeconds = Math.max(0, Math.min(deltaMs / 1000, 1 / 20));
    const velocityX = applyAcceleration(
      matterVelocityToPixelsPerSecond(this.matterBody.velocity.x),
      accelerationXPx,
      deltaSeconds,
      MOVEMENT.emergencyHorizontalCapPx,
    );
    const velocityY = applyAcceleration(
      matterVelocityToPixelsPerSecond(this.matterBody.velocity.y),
      accelerationYPx,
      deltaSeconds,
      MOVEMENT.emergencyVerticalCapPx,
    );
    this.setVelocity(
      pixelsPerSecondToMatterVelocity(velocityX),
      pixelsPerSecondToMatterVelocity(velocityY),
    );
  }

  horizontalSpeedPx(): number {
    return matterVelocityToPixelsPerSecond(this.matterBody.velocity.x);
  }

  setGrappleTarget(target: Vec2 | null): void {
    this.grappleTarget = target ? { ...target } : null;
  }

  grappleVisualOrigin(): Vec2 {
    return this.avatarVisual.grappleOriginWorld();
  }

  visualContactBounds(): ContactBounds {
    return this.avatarVisual.contactBounds();
  }

  private updateMotionState(proneHeld: boolean, now: number): void {
    if (this.grappleActive) {
      this.motion.transition('grappling', now);
      return;
    }
    if (this.motion.state === 'respawning') {
      this.motion.transition(this.grounded ? 'grounded-run' : 'airborne', now);
    }
    if (this.motion.state === 'knockback' && now < this.knockbackUntil) return;

    if (!this.grounded) {
      if (this.isProne) {
        if (!this.leaveProne(now, 'airborne')) return;
      } else {
        this.motion.transition('airborne', now);
      }
      return;
    }

    if (this.colliderIsProne && !this.canUseStandingCollider() && !this.isProne) {
      this.motion.transition('prone', now);
      return;
    }

    if (proneHeld) {
      if (!this.isProne) this.enterProne(now);
      return;
    }

    if (this.isProne) {
      if (
        this.motion.timeInState(now) >= MOVEMENT.proneMinimumDurationMs &&
        this.canUseStandingCollider()
      ) {
        this.leaveProne(now, 'grounded-run');
      }
      return;
    }
    this.motion.transition('grounded-run', now);
    this.restoreStandingColliderIfClear();
  }

  private enterProne(now: number): void {
    if (!this.grounded || this.isProne || !this.motion.canTransition('prone')) return;
    if (!this.canUseProneCollider() || !this.setProneCollider(true)) return;
    this.motion.transition('prone', now);
  }

  private leaveProne(now: number, nextState: PlayerMotionState): boolean {
    if (!this.isProne) return false;
    if (!this.restoreStandingColliderIfClear()) return false;
    this.motion.transition(nextState, now);
    return true;
  }

  private setProneCollider(prone: boolean, force = false): boolean {
    if (prone === this.colliderIsProne) return true;
    if (prone && !force && !this.canUseProneCollider()) return false;
    if (!prone && !force && !this.canUseStandingCollider()) return false;
    const body = this.matterBody;
    const targetWidth = prone ? MOVEMENT.proneColliderWidthPx : this.colliderWidthPx;
    const targetHeight = prone
      ? MOVEMENT.proneColliderHeightPx
      : MOVEMENT.standingColliderHeightPx;
    resizeColliderInPlace(
      body,
      targetWidth,
      targetHeight,
      (collider, scaleX, scaleY) => this.scene.matter.body.scale(collider, scaleX, scaleY),
      (collider, position) => this.scene.matter.body.setPosition(collider, position, false),
      this.colliderWidthPx,
      this.colliderHeightPx,
    );
    this.x = body.position.x;
    this.y = body.position.y;
    this.colliderIsProne = prone;
    this.colliderWidthPx = targetWidth;
    this.colliderHeightPx = targetHeight;
    return true;
  }

  private restoreStandingColliderIfClear(): boolean {
    return !this.colliderIsProne || this.setProneCollider(false);
  }

  private canUseStandingCollider(): boolean {
    if (!this.colliderIsProne) return true;
    const body = this.matterBody;
    const height = this.colliderHeightPx;
    const region = standingHeadroomRegion(
      body.position.x,
      body.position.y + height / 2,
      height,
      MOVEMENT.standingColliderHeightPx,
      this.colliderWidthPx,
    );
    if (!region) return true;
    return this.queryRegion(region.left, region.top, region.right, region.bottom).length === 0;
  }

  private canUseProneCollider(): boolean {
    if (this.colliderIsProne) return true;
    const footY = this.matterBody.position.y + this.colliderHeightPx / 2;
    return proneSideRegions(
      this.matterBody.position.x,
      footY,
      this.colliderWidthPx,
      MOVEMENT.proneColliderWidthPx,
      MOVEMENT.proneColliderHeightPx,
    ).every(
      (region) =>
        this.queryRegion(region.left, region.top, region.right, region.bottom).length === 0,
    );
  }

  private syncHorizontalColliderToVisual(): void {
    const bounds = this.avatarVisual.contactBounds();
    const visualWidth = bounds.right - bounds.left;
    const maximumWidth = this.colliderIsProne
      ? MOVEMENT.proneColliderWidthPx
      : MOVEMENT.standingColliderWidthPx;
    const targetWidth = Phaser.Math.Clamp(
      visualWidth + MOVEMENT.solidContactSkinPx,
      MOVEMENT.minimumContactWidthPx,
      maximumWidth,
    );
    if (Math.abs(targetWidth - this.colliderWidthPx) < 0.1) return;

    const body = this.matterBody;
    resizeColliderInPlace(
      body,
      targetWidth,
      this.colliderHeightPx,
      (collider, scaleX, scaleY) => this.scene.matter.body.scale(collider, scaleX, scaleY),
      (collider, position) => this.scene.matter.body.setPosition(collider, position, false),
      this.colliderWidthPx,
      this.colliderHeightPx,
    );
    this.x = body.position.x;
    this.y = body.position.y;
    this.colliderWidthPx = targetWidth;
  }

  private queryRegion(left: number, top: number, right: number, bottom: number): any[] {
    const bodies = (this.scene.matter.world as any).localWorld.bodies as any[];
    return this.scene.matter.query.region(bodies, { min: { x: left, y: top }, max: { x: right, y: bottom } }).filter(
      (body: any) =>
        body !== this.body &&
        body !== this.matterBody.parent &&
        (body.collisionFilter.category & this.solidCategory) !== 0 &&
        !body.isSensor,
    );
  }

  private detectGround(): boolean {
    const footY = this.matterBody.position.y + this.colliderHeightPx / 2;
    return this.queryRegion(this.x - 11, footY - 2, this.x + 11, footY + 7).length > 0;
  }

  private detectWall(): -1 | 0 | 1 {
    const halfHeight = Math.max(9, this.currentColliderHeight / 2 - 4);
    const halfWidth = this.currentColliderWidth / 2;
    const left =
      this.queryRegion(
        this.x - halfWidth - 7,
        this.y - halfHeight,
        this.x - halfWidth + 1,
        this.y + halfHeight,
      ).length > 0;
    const right =
      this.queryRegion(
        this.x + halfWidth - 1,
        this.y - halfHeight,
        this.x + halfWidth + 7,
        this.y + halfHeight,
      ).length > 0;
    if (left && !right) return -1;
    if (right && !left) return 1;
    return 0;
  }
}
