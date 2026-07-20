import Phaser from 'phaser';
import {
  ABILITIES,
  COLORS,
  DAMAGE,
  FONT_DISPLAY,
  FONT_FAMILY,
  GRAPPLE,
  MOVEMENT,
} from '../config';
import {
  boundsOverlap,
  ellipseOverlapsBounds,
  rectangleBounds,
  triangleOverlapsBounds,
  type ContactPoint,
} from '../core/contactGeometry';
import { resolveFailure } from '../core/health';
import { selectGrappleTarget } from '../core/grappleTargeting';
import { pixelsPerSecondToMatterVelocity } from '../core/movement';
import { PlayerAvatar } from '../entities/PlayerAvatar';
import { t } from '../i18n';
import { audio } from './AudioManager';
import { InputController } from './InputController';
import type {
  AnchorKind,
  DifficultyPreset,
  GameLaunchData,
  HazardSpec,
  MaterializedStage,
  PlatformSpec,
  PlayerInputState,
  RectSpec,
} from '../types';
import { Hud } from '../ui/Hud';
import { runtimeState } from '../state';
import { activateAbility } from './abilities';
import { ProceduralMaterialRenderer } from '../visuals/proceduralMaterials';

interface CollisionCategories {
  readonly player: number;
  readonly solid: number;
}

interface PlatformRuntime {
  readonly spec: PlatformSpec;
  readonly visual: Phaser.Physics.Matter.Image;
  readonly body: any;
  readonly baseX: number;
  readonly baseY: number;
  active: boolean;
}

interface AnchorRuntime {
  readonly id: string;
  readonly kind: AnchorKind;
  readonly body: any;
  readonly outer: Phaser.GameObjects.Arc;
  readonly inner: Phaser.GameObjects.Arc;
  readonly baseX: number;
  readonly baseY: number;
  readonly moveX: number;
  readonly moveY: number;
  readonly periodMs: number;
  readonly range?: number;
  expiresAt?: number;
  active: boolean;
}

interface HazardRuntime {
  readonly spec: HazardSpec & { readonly runtimePhaseMs: number };
  readonly visual: Phaser.GameObjects.Image;
  readonly baseX: number;
  readonly baseY: number;
  body?: any;
  active: boolean;
}

interface EnemyRuntime {
  readonly spec: MaterializedStage['enemies'][number];
  readonly image: Phaser.Physics.Matter.Image;
  readonly baseX: number;
  readonly baseY: number;
  lastShotAt: number;
  frozenUntil: number;
  active: boolean;
}

interface PickupRuntime {
  readonly spec: MaterializedStage['pickups'][number];
  readonly image: Phaser.GameObjects.Image;
  active: boolean;
}

interface ProjectileRuntime {
  readonly image: Phaser.GameObjects.Image;
  readonly friendly: boolean;
  readonly vx: number;
  readonly vy: number;
  expiresAt: number;
}

export interface CourseRuntimeOptions {
  readonly scene: Phaser.Scene;
  readonly stage: MaterializedStage;
  readonly difficulty: DifficultyPreset;
  readonly launch: GameLaunchData;
  readonly owner: 'solo' | 'p1' | 'p2';
  readonly playerIndex: 0 | 1;
  readonly offsetY: number;
  readonly categories: CollisionCategories;
  readonly compactHud: boolean;
  readonly playerColor: number;
  readonly onSoloDeath: () => void;
  readonly onFinish: (course: CourseRuntime) => void;
}

export class CourseRuntime {
  readonly layer: Phaser.GameObjects.Layer;
  readonly player: PlayerAvatar;
  readonly hud: Hud;
  readonly input: InputController;
  camera!: Phaser.Cameras.Scene2D.Camera;
  deaths = 0;
  finished = false;
  finishTimeMs = 0;
  private readonly scene: Phaser.Scene;
  private readonly stage: MaterializedStage;
  private readonly difficulty: DifficultyPreset;
  private readonly launch: GameLaunchData;
  private readonly offsetY: number;
  private readonly categories: CollisionCategories;
  private readonly options: CourseRuntimeOptions;
  private readonly materials: ProceduralMaterialRenderer;
  private readonly platforms: PlatformRuntime[] = [];
  private readonly anchors: AnchorRuntime[] = [];
  private readonly hazards: HazardRuntime[] = [];
  private readonly enemies: EnemyRuntime[] = [];
  private readonly pickups: PickupRuntime[] = [];
  private readonly projectiles: ProjectileRuntime[] = [];
  private readonly ropeGraphics: Phaser.GameObjects.Graphics;
  private readonly effectGraphics: Phaser.GameObjects.Graphics;
  private readonly reticle: Phaser.GameObjects.Arc;
  private activeGrapple: AnchorRuntime | null = null;
  private selectedAnchor: AnchorRuntime | null = null;
  private grappleConstraint: any | null = null;
  private checkpointIndex = 0;
  private freezeUntil = 0;
  private lastTrailAt = 0;
  private lastReadyAbility: string | null = null;
  private tutorialPromptIndex = -1;

  constructor(options: CourseRuntimeOptions) {
    this.options = options;
    this.scene = options.scene;
    this.stage = options.stage;
    this.difficulty = options.difficulty;
    this.launch = options.launch;
    this.offsetY = options.offsetY;
    this.categories = options.categories;
    this.materials = new ProceduralMaterialRenderer(
      this.scene,
      runtimeState.save.settings.reducedEffects ? 'medium' : 'high',
    );
    this.layer = this.scene.add.layer();
    this.createBackground();
    this.createPlatforms();
    this.createHazards();
    this.createAnchors();
    this.createEnemies();
    this.createPickups();
    this.createFinishGate();
    this.createTutorialPrompts();

    this.player = new PlayerAvatar(
      this.scene,
      this.stage.start.x,
      this.stage.start.y + this.offsetY,
      options.playerIndex === 0 ? 'player-p1' : 'player-p2',
      options.playerColor,
      options.owner,
      this.categories.solid,
      this.categories.player,
      {
        onJump: (kind) => this.onJump(kind),
        onLand: (speed) => this.onLand(speed),
      },
    );
    this.layer.add([this.player, this.player.avatarVisual]);
    this.player.lastSafePosition = {
      x: this.stage.start.x,
      y: this.stage.start.y + this.offsetY,
    };
    this.input = new InputController(this.scene, options.playerIndex, this.launch);
    this.ropeGraphics = this.scene.add.graphics().setDepth(24);
    this.effectGraphics = this.scene.add.graphics().setDepth(22);
    this.reticle = this.scene.add.circle(0, 0, 18, COLORS.cyan, 0).setStrokeStyle(2, COLORS.cyan, 0.9).setDepth(25).setVisible(false);
    this.layer.add([this.ropeGraphics, this.effectGraphics, this.reticle]);
    this.hud = new Hud(
      this.scene,
      this.player,
      options.owner === 'solo'
        ? t('hud.soloLabel')
        : options.owner === 'p1'
          ? t('hud.player1Label')
          : t('hud.player2Label'),
      options.playerColor,
      this.difficulty,
      options.compactHud,
    );
    this.layer.add(this.hud.objects);
  }

  readInput(): PlayerInputState {
    return this.input.read();
  }

  update(now: number, delta: number, elapsed: number, input: PlayerInputState, active: boolean): void {
    this.updatePlatforms(now);
    this.updateAnchors(now);
    this.updateHazards(now);
    this.updateEnemies(now, delta, active);
    this.updateProjectiles(now, delta, active);
    if (active && !this.finished) {
      this.player.setGrappleTarget(
        this.activeGrapple
          ? {
              x: this.activeGrapple.body.position.x,
              y: this.activeGrapple.body.position.y,
            }
          : null,
      );
      this.player.updatePlayer(input, now, delta);
      this.updateGrapple(input, now, delta);
      this.updateAbilities(input, now);
      this.updatePickups(now);
      this.updateCheckpoint(now);
      this.checkHazards(now, delta);
      this.checkEnemies(now);
      this.checkBreakables(now);
      this.checkFall(now);
      this.checkFinish(elapsed);
      this.updateTutorial(now);
      this.updateTrail(now);
    }
    this.drawEffects(now);
    this.hud.update(
      now,
      elapsed,
      Phaser.Math.Clamp((this.player.x - this.stage.start.x) / (this.stage.finishX - this.stage.start.x), 0, 1),
      runtimeState.save.settings.debugOverlay,
      this.activeGrapple?.id ?? this.selectedAnchor?.id ?? '',
    );
  }

  progress(): number {
    return Phaser.Math.Clamp(this.player.x / this.stage.finishX, 0, 1);
  }

  destroy(): void {
    this.detachGrapple(false);
    this.projectiles.forEach((projectile) => projectile.image.destroy());
    this.layer.destroy(true);
  }

  private createBackground(): void {
    const themeColors = {
      training: [0x09152b, 0x152449],
      neon: [0x071126, 0x132244],
      foundry: [0x160e1e, 0x3a1828],
      ruins: [0x100c2b, 0x25144a],
    } as const;
    const [dark, light] = themeColors[this.stage.theme];
    const sky = this.scene.add.graphics().setDepth(-100);
    sky.fillGradientStyle(light, dark, dark, dark, 1);
    sky.fillRect(0, this.offsetY, this.stage.width, this.stage.height);
    const wallTexture = this.materials.createBackdropTile(this.stage.theme, this.stage.seed);
    const wall = this.scene.add
      .tileSprite(
        this.stage.width / 2,
        this.offsetY + this.stage.height / 2,
        this.stage.width,
        this.stage.height,
        wallTexture,
      )
      .setAlpha(this.stage.theme === 'training' || this.stage.theme === 'ruins' ? 0.34 : 0.2)
      .setDepth(-95);
    this.layer.add([sky, wall]);
    for (let x = 0; x < this.stage.width; x += 420) {
      const height = 110 + ((x / 420) % 5) * 32;
      const silhouette = this.scene.add.rectangle(
        x + 160,
        this.offsetY + 640 - height / 2,
        250,
        height,
        light,
        0.42,
      ).setDepth(-70);
      const rune = this.scene.add.polygon(
        x + 100,
        this.offsetY + 250 + ((x / 420) % 3) * 60,
        [0, -20, 18, 0, 0, 20, -18, 0],
        this.stage.theme === 'foundry' ? COLORS.gold : COLORS.violet,
        0.13,
      ).setStrokeStyle(1, this.stage.theme === 'neon' ? COLORS.cyan : COLORS.violet, 0.24).setDepth(-80);
      this.layer.add([silhouette, rune]);
    }
    const horizon = this.scene.add.rectangle(this.stage.width / 2, this.offsetY + 638, this.stage.width, 3, COLORS.cyan, 0.12).setDepth(-60);
    this.layer.add(horizon);
  }

  private createPlatforms(): void {
    for (const spec of this.stage.platforms) {
      const texture = this.materials.createPlatformTexture(this.stage.theme, this.stage.seed, spec);
      const visual = this.scene.matter.add.image(spec.x, spec.y + this.offsetY, texture, undefined, {
        isStatic: true,
        label: `solid:${this.options.owner}:${spec.id}`,
        collisionFilter: { category: this.categories.solid, mask: this.categories.player },
      }).setDepth(5);
      visual.setFixedRotation();
      const body = visual.body as any;
      this.layer.add(visual);
      this.platforms.push({ spec, visual, body, baseX: spec.x, baseY: spec.y + this.offsetY, active: true });
    }
  }

  private createAnchors(): void {
    for (const spec of this.stage.anchors) {
      this.addAnchor({
        id: spec.id,
        kind: spec.kind,
        x: spec.x,
        y: spec.y + this.offsetY,
        moveX: spec.moveX ?? 0,
        moveY: spec.moveY ?? 0,
        periodMs: spec.periodMs ?? 3000,
        range: spec.range,
      });
    }
  }

  private addAnchor(options: {
    id: string;
    kind: AnchorKind;
    x: number;
    y: number;
    moveX?: number;
    moveY?: number;
    periodMs?: number;
    range?: number;
    expiresAt?: number;
  }): AnchorRuntime {
    const color = options.kind === 'moving' || options.kind === 'fragile' ? COLORS.gold : options.kind === 'magical' ? COLORS.violet : COLORS.cyan;
    const outer = this.scene.add.circle(options.x, options.y, 13, color, 0.14).setStrokeStyle(3, color, 0.95).setDepth(18);
    const inner = this.scene.add.circle(options.x, options.y, 4, COLORS.white, 0.95).setDepth(19);
    const body = this.scene.matter.add.circle(options.x, options.y, 9, {
      isStatic: true,
      isSensor: true,
      label: `anchor:${this.options.owner}:${options.id}`,
      collisionFilter: { category: 0x4000, mask: 0 },
    });
    const anchor: AnchorRuntime = {
      id: options.id,
      kind: options.kind,
      body,
      outer,
      inner,
      baseX: options.x,
      baseY: options.y,
      moveX: options.moveX ?? 0,
      moveY: options.moveY ?? 0,
      periodMs: options.periodMs ?? 3000,
      range: options.range,
      expiresAt: options.expiresAt,
      active: true,
    };
    this.anchors.push(anchor);
    this.layer.add([outer, inner]);
    return anchor;
  }

  private createHazards(): void {
    for (const spec of this.stage.hazards) {
      const y = spec.y + this.offsetY;
      const texture = this.materials.createHazardTexture(this.stage.theme, this.stage.seed, spec);
      const visual = this.scene.add
        .image(spec.x, y, texture)
        .setDepth(spec.type === 'pit' ? 0 : spec.type === 'blade' ? 14 : 12)
        .setAlpha(spec.type.includes('field') ? 0.18 : spec.type === 'pit' ? 0.86 : 1);
      this.layer.add(visual);
      const runtime: HazardRuntime = { spec, visual, baseX: spec.x, baseY: y, active: true };
      if (spec.type === 'cracked-wall' || spec.type === 'low-tunnel') {
        this.scene.matter.add.gameObject(visual, {
          isStatic: true,
          label: `solid:${this.options.owner}:${spec.id}`,
          collisionFilter: { category: this.categories.solid, mask: this.categories.player },
        });
        runtime.body = (visual as any).body;
      }
      this.hazards.push(runtime);
    }
  }

  private createEnemies(): void {
    for (const spec of this.stage.enemies) {
      const y = spec.y + this.offsetY;
      const image = this.scene.matter.add.image(spec.x, y, spec.type, undefined, {
        isStatic: spec.type === 'armored-blocker',
        isSensor: spec.type !== 'armored-blocker',
        label: `enemy:${this.options.owner}:${spec.id}`,
        collisionFilter: {
          category: spec.type === 'armored-blocker' ? this.categories.solid : 0x2000,
          mask: spec.type === 'armored-blocker' ? this.categories.player : 0,
        },
      });
      if (spec.type === 'armored-blocker') {
        image.setRectangle(50, 62, {
          isStatic: true,
          label: `enemy:${this.options.owner}:${spec.id}`,
          collisionFilter: {
            category: this.categories.solid,
            mask: this.categories.player,
          },
        });
      }
      image.setFixedRotation().setDepth(20);
      this.layer.add(image);
      this.enemies.push({
        spec,
        image,
        baseX: spec.x,
        baseY: y,
        lastShotAt: -Infinity,
        frozenUntil: 0,
        active: true,
      });
    }
  }

  private createPickups(): void {
    for (const spec of this.stage.pickups) {
      const image = this.scene.add.image(spec.x, spec.y + this.offsetY, spec.type === 'health' ? 'health' : 'skill-core').setDepth(21);
      if (spec.type === 'skill' && spec.ability) image.setTint(ABILITIES[spec.ability].color);
      this.layer.add(image);
      this.pickups.push({ spec, image, active: true });
    }
  }

  private createFinishGate(): void {
    const gate = this.scene.add.graphics().setDepth(10);
    const y = this.offsetY;
    gate.lineStyle(8, COLORS.gold, 0.8).lineBetween(this.stage.finishX, y + 350, this.stage.finishX, y + 650);
    gate.lineStyle(2, COLORS.white, 0.9).strokeCircle(this.stage.finishX, y + 370, 46);
    gate.lineStyle(2, COLORS.gold, 0.7).strokeCircle(this.stage.finishX, y + 370, 34);
    const label = this.scene.add
      .text(this.stage.finishX, y + 300, t('stage.finish'), {
        fontFamily: FONT_DISPLAY,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffc857',
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    this.layer.add([gate, label]);
  }

  private createTutorialPrompts(): void {
    const inputVariables =
      this.options.playerIndex === 0
        ? { left: 'A', right: 'D', jump: 'Space', grapple: 'E', skill: 'Q' }
        : { left: '←', right: '→', jump: 'Right Shift', grapple: 'Enter', skill: '/' };
    for (const prompt of this.stage.tutorialPrompts ?? []) {
      const panel = this.scene.add
        .rectangle(prompt.x, this.offsetY + 410, 184, 118, COLORS.ink, 0.88)
        .setStrokeStyle(1, COLORS.gold, 0.55)
        .setDepth(15);
      const title = this.scene.add
        .text(prompt.x, this.offsetY + 376, t(prompt.titleKey), {
          fontFamily: FONT_DISPLAY,
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffc857',
          letterSpacing: 1,
        })
        .setOrigin(0.5)
        .setDepth(16);
      const body = this.scene.add
        .text(prompt.x, this.offsetY + 423, t(prompt.bodyKey, inputVariables), {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          color: '#d7def0',
          align: 'center',
          lineSpacing: 2,
          wordWrap: { width: 160, useAdvancedWrap: true },
        })
        .setOrigin(0.5)
        .setDepth(16);
      this.layer.add([panel, title, body]);
    }
  }

  private createFinishBurst(): void {
    this.effectGraphics.clear();
    this.effectGraphics.lineStyle(5, COLORS.gold, 0.9);
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2;
      this.effectGraphics.lineBetween(this.player.x, this.player.y, this.player.x + Math.cos(angle) * 120, this.player.y + Math.sin(angle) * 120);
    }
  }

  private updatePlatforms(now: number): void {
    for (const platform of this.platforms) {
      if (
        now < this.freezeUntil &&
        (platform.spec.kind === 'moving' || platform.spec.kind === 'disappearing')
      ) {
        continue;
      }
      const period = (platform.spec.periodMs ?? 3000) / this.difficulty.hazardSpeed;
      const phase = (now / period) * Math.PI * 2;
      const x = platform.baseX + Math.sin(phase) * (platform.spec.moveX ?? 0);
      const y = platform.baseY + Math.sin(phase) * (platform.spec.moveY ?? 0);
      if (platform.spec.kind === 'moving') {
        this.scene.matter.body.setPosition(platform.body, { x, y }, true);
        platform.visual.setPosition(x, y);
      }
      if (platform.spec.kind === 'disappearing') {
        const active = Math.sin(phase) > -0.38;
        if (active !== platform.active) {
          platform.active = active;
          platform.body.isSensor = !active;
          platform.body.collisionFilter.mask = active ? this.categories.player : 0;
        }
        platform.visual.setAlpha(active ? 0.9 : 0.14);
      }
      if (platform.spec.kind === 'fragile') platform.visual.setAlpha(platform.active ? 1 : 0.12);
    }
  }

  private updateAnchors(now: number): void {
    for (const anchor of this.anchors) {
      if (anchor.expiresAt && now >= anchor.expiresAt) {
        if (this.activeGrapple === anchor) this.detachGrapple(true);
        anchor.active = false;
        anchor.outer.setVisible(false);
        anchor.inner.setVisible(false);
        continue;
      }
      if (!anchor.active) continue;
      const phase = (now / anchor.periodMs) * Math.PI * 2;
      const x = anchor.baseX + Math.sin(phase) * anchor.moveX;
      const y = anchor.baseY + Math.cos(phase) * anchor.moveY;
      this.scene.matter.body.setPosition(anchor.body, { x, y });
      anchor.outer.setPosition(x, y).setScale(1 + Math.sin(now / 180) * 0.08);
      anchor.inner.setPosition(x, y);
    }
  }

  private updateHazards(now: number): void {
    for (const hazard of this.hazards) {
      if (!hazard.active) continue;
      const period = (hazard.spec.periodMs ?? 2500) / this.difficulty.hazardSpeed;
      const phase = ((now + hazard.spec.runtimePhaseMs) % period) / period;
      if (hazard.spec.type === 'laser') {
        const active = phase > 0.53;
        hazard.visual.setAlpha(active ? 0.96 : phase > 0.39 ? 0.5 : 0.12);
        hazard.visual.setTint(active ? 0xffffff : COLORS.gold);
      } else if (hazard.spec.type === 'flame') {
        const active = phase > 0.48 && phase < 0.8;
        hazard.visual.setScale(1, active ? 1 : 0.22).setAlpha(active ? 0.9 : 0.22);
      } else if (hazard.spec.type === 'blade' && now >= this.freezeUntil) {
        hazard.visual.setRotation(now * 0.006 * this.difficulty.hazardSpeed);
      } else if (hazard.spec.type === 'crusher' && now >= this.freezeUntil) {
        const y = hazard.baseY + Math.sin(phase * Math.PI * 2) * (hazard.spec.moveY ?? 150) * 0.5;
        hazard.visual.setY(y);
        if (hazard.body) this.scene.matter.body.setPosition(hazard.body, { x: hazard.baseX, y });
      } else if (hazard.spec.type.includes('field')) {
        hazard.visual.setAlpha(0.1 + Math.sin(now / 220) * 0.04);
      }
    }
  }

  private updateEnemies(now: number, _delta: number, active: boolean): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const frozen = now < enemy.frozenUntil;
      enemy.image.setTint(frozen ? 0x9ee8ff : 0xffffff).setAlpha(frozen ? 0.76 : 1);
      if (frozen || !active) continue;
      const period = 3800 / this.difficulty.enemyCadence;
      const phase = ((now + enemy.spec.runtimePhaseMs) % period) / period;
      let x = enemy.baseX;
      let y = enemy.baseY;
      if (enemy.spec.type === 'flyer') {
        x += Math.sin(phase * Math.PI * 2) * (enemy.spec.patrol ?? 140);
        y += Math.cos(phase * Math.PI * 2) * 42;
      } else if (enemy.spec.type === 'charger') {
        const facing = enemy.spec.facing ?? -1;
        if (phase > 0.58 && phase < 0.78) x += facing * ((phase - 0.58) / 0.2) * (enemy.spec.patrol ?? 260);
        enemy.image.setTint(phase > 0.46 && phase < 0.58 ? COLORS.gold : 0xffffff);
      }
      this.scene.matter.body.setPosition(enemy.image.body as any, { x, y });
      enemy.image.setPosition(x, y);
      if ((enemy.spec.type === 'flyer' || enemy.spec.type === 'turret') && Math.abs(this.player.x - x) < 720) {
        const cadence = (enemy.spec.type === 'turret' ? 2300 : 2800) / this.difficulty.enemyCadence;
        if (now - enemy.lastShotAt >= cadence) {
          enemy.lastShotAt = now;
          this.spawnHostileProjectile(enemy.image.x, enemy.image.y, now);
        }
      }
    }
  }

  private updateProjectiles(now: number, delta: number, active: boolean): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      if (!projectile) continue;
      if (active) {
        projectile.image.x += projectile.vx * (delta / 1000);
        projectile.image.y += projectile.vy * (delta / 1000);
      }
      let remove = now >= projectile.expiresAt;
      if (!remove && projectile.friendly) {
        const enemy = this.enemies.find((candidate) => candidate.active && Phaser.Math.Distance.Between(projectile.image.x, projectile.image.y, candidate.image.x, candidate.image.y) < 44);
        if (enemy) {
          this.defeatEnemy(enemy);
          remove = true;
        }
        const wall = this.hazards.find((hazard) => hazard.active && hazard.spec.type === 'cracked-wall' && Phaser.Math.Distance.Between(projectile.image.x, projectile.image.y, hazard.visual.x, hazard.visual.y) < 44);
        if (wall) {
          this.breakHazard(wall);
          remove = true;
        }
      } else if (!remove && !projectile.friendly && this.projectileTouchesPlayer(projectile.image)) {
        this.damagePlayer(DAMAGE.projectile, now, projectile.image.x < this.player.x ? 1 : -1);
        remove = true;
      }
      if (remove) {
        projectile.image.destroy();
        this.projectiles.splice(index, 1);
      }
    }
  }

  private updateGrapple(input: PlayerInputState, now: number, delta: number): void {
    if (!this.activeGrapple) {
      const blockers = this.currentBlockers();
      const target = selectGrappleTarget({
        origin: { x: this.player.x, y: this.player.y },
        anchors: this.anchors.filter((anchor) => anchor.active).map((anchor) => ({
          id: anchor.id,
          x: anchor.body.position.x,
          y: anchor.body.position.y,
          active: anchor.active,
          range: anchor.range,
        })),
        blockers,
        facing: this.player.facing,
        upwardBias: input.vertical < -0.35,
        baseRange: GRAPPLE.baseRange,
        assistScale: this.difficulty.grappleAssist,
        forwardConeDot: GRAPPLE.forwardConeDot,
      });
      this.selectedAnchor = target ? this.anchors.find((anchor) => anchor.id === target.id) ?? null : null;
      if (this.selectedAnchor) {
        this.reticle.setPosition(this.selectedAnchor.body.position.x, this.selectedAnchor.body.position.y).setVisible(true).setAlpha(0.55 + Math.sin(now / 110) * 0.25);
      } else this.reticle.setVisible(false);
    }

    if (input.grapplePressed && !this.activeGrapple) {
      if (this.selectedAnchor) this.attachGrapple(this.selectedAnchor);
      else {
        audio.play('fail');
        this.hud.notice(t('notice.noAnchor'), now, '#ff7b82');
      }
    }
    if (!input.grapple && this.activeGrapple) this.detachGrapple(true);
    if (this.activeGrapple) {
      const dx = this.activeGrapple.body.position.x - this.player.x;
      const dy = this.activeGrapple.body.position.y - this.player.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const tangent = { x: -dy / length, y: dx / length };
      this.player.applyExternalAcceleration(
        tangent.x * input.horizontal * MOVEMENT.grapplePumpAccelerationPx,
        tangent.y * input.horizontal * MOVEMENT.grapplePumpAccelerationPx -
          MOVEMENT.grappleAssistAccelerationPx * this.difficulty.grappleAssist,
        delta,
      );
    }
  }

  private updateAbilities(input: PlayerInputState, now: number): void {
    if (!input.skillPressed) return;
    if (this.player.skills.ability === 'ground-slam' && this.player.grounded) {
      audio.play('fail');
      this.hud.notice(t('notice.skillUnavailable'), now, '#ff7b82');
      return;
    }
    const use = this.player.skills.use(now, this.difficulty.cooldownScale);
    if (!use.used || !use.ability) {
      audio.play('fail');
      this.hud.notice(
        this.player.skills.ability ? t('notice.skillRecharging') : t('notice.noSkill'),
        now,
        '#ff7b82',
      );
      return;
    }
    audio.play('skill');
    this.hud.notice(
      t('notice.skillUsed', { skill: t(ABILITIES[use.ability].nameKey) }),
      now,
      Phaser.Display.Color.IntegerToColor(ABILITIES[use.ability].color).rgba,
    );
    activateAbility(use.ability, {
      now,
      impactDash: () => this.player.dash(now),
      energyBolt: () => this.spawnFriendlyProjectile(now),
      energyShield: () => this.player.health.activateShield(now, 3600),
      freezePulse: () => {
        this.freezeUntil = now + 2600;
        for (const enemy of this.enemies) {
          if (enemy.active && Math.abs(enemy.image.x - this.player.x) < 500) {
            enemy.frozenUntil = now + 3000;
          }
        }
      },
      groundSlam: () => this.player.slam(),
      temporaryAnchor: () => this.createTemporaryAnchor(now),
    });
  }

  private updatePickups(now: number): void {
    for (const pickup of this.pickups) {
      if (!pickup.active) continue;
      pickup.image.setRotation(pickup.image.rotation + 0.018);
      pickup.image.setScale(1 + Math.sin(now / 150 + pickup.image.x) * 0.08);
      if (Phaser.Math.Distance.Between(pickup.image.x, pickup.image.y, this.player.x, this.player.y) > 42) continue;
      pickup.active = false;
      pickup.image.setVisible(false);
      if (pickup.spec.type === 'health') {
        this.player.health.heal((pickup.spec.amount ?? 25) * this.difficulty.healthPickupScale);
        audio.play('health');
        this.hud.notice(t('notice.healthRestored'), now, '#50f29a');
      } else if (pickup.spec.ability) {
        this.player.skills.equip(pickup.spec.ability);
        this.lastReadyAbility = pickup.spec.ability;
        audio.play('ready');
        this.hud.notice(
          t('notice.skillEquipped', {
            skill: t(ABILITIES[pickup.spec.ability].nameKey),
          }),
          now,
          Phaser.Display.Color.IntegerToColor(ABILITIES[pickup.spec.ability].color).rgba,
        );
      }
    }
    const ability = this.player.skills.ability;
    if (ability && this.player.skills.isReady(now) && this.lastReadyAbility !== ability) {
      this.lastReadyAbility = ability;
      audio.play('ready');
    } else if (ability && !this.player.skills.isReady(now)) this.lastReadyAbility = null;
  }

  private updateCheckpoint(now: number): void {
    for (let index = this.checkpointIndex + 1; index < this.stage.checkpoints.length; index += 1) {
      const checkpoint = this.stage.checkpoints[index];
      if (checkpoint && this.player.x >= checkpoint.x) {
        this.checkpointIndex = index;
        this.player.lastSafePosition = { x: checkpoint.x, y: checkpoint.y + this.offsetY };
        this.hud.notice(
          t('notice.checkpoint', {
            current: index + 1,
            total: this.stage.checkpoints.length,
          }),
          now,
          '#50f29a',
        );
      }
    }
  }

  private checkHazards(now: number, delta: number): void {
    for (const hazard of this.hazards) {
      const hazardX = hazard.visual.x;
      const hazardY = hazard.visual.y;
      if (
        !hazard.active ||
        !this.hazardTouchesPlayer(hazard, hazardX, hazardY)
      ) {
        continue;
      }
      const period = (hazard.spec.periodMs ?? 2500) / this.difficulty.hazardSpeed;
      const phase = ((now + hazard.spec.runtimePhaseMs) % period) / period;
      if (hazard.spec.type === 'spikes') this.damagePlayer(hazard.spec.damage ?? DAMAGE.spikes, now, this.player.x < hazardX ? -1 : 1);
      else if (hazard.spec.type === 'laser' && phase > 0.53) this.damagePlayer(hazard.spec.damage ?? DAMAGE.laser, now, 0);
      else if (hazard.spec.type === 'crusher' && now >= this.freezeUntil) this.damagePlayer(hazard.spec.damage ?? DAMAGE.crusher, now, 0);
      else if (hazard.spec.type === 'blade' && now >= this.freezeUntil) this.damagePlayer(hazard.spec.damage ?? DAMAGE.laser, now, this.player.x < hazardX ? -1 : 1);
      else if (hazard.spec.type === 'flame' && phase > 0.48 && phase < 0.8) this.damagePlayer(hazard.spec.damage ?? DAMAGE.spikes, now, 0);
      else if (hazard.spec.type === 'gravity-field') {
        this.player.applyExternalAcceleration(
          0,
          MOVEMENT.gravityFieldAccelerationPx * (hazard.spec.direction ?? -1),
          delta,
        );
      } else if (hazard.spec.type === 'wind-field') {
        this.player.applyExternalAcceleration(
          MOVEMENT.windFieldAccelerationPx * (hazard.spec.direction ?? -1),
          -80,
          delta,
        );
      }
    }
    for (const platform of this.platforms) {
      if (platform.active && platform.spec.kind === 'conveyor' && this.player.grounded && Math.abs(this.player.x - platform.visual.x) < platform.spec.width / 2) {
        this.player.applyExternalAcceleration(
          MOVEMENT.conveyorAccelerationPx * (platform.spec.direction ?? 1),
          0,
          delta,
        );
      }
    }
  }

  private checkEnemies(now: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.active || !this.enemyTouchesPlayer(enemy)) continue;
      const speedPx = Math.abs(this.player.horizontalSpeedPx());
      const fastImpact = speedPx >= MOVEMENT.highSpeedImpactMinPx;
      if (this.player.isDashing || (fastImpact && enemy.spec.type !== 'armored-blocker')) this.defeatEnemy(enemy);
      else this.damagePlayer(enemy.spec.type === 'armored-blocker' ? DAMAGE.heavyEnemy : DAMAGE.smallEnemy, now, this.player.x < enemy.image.x ? -1 : 1);
    }
  }

  private checkBreakables(now: number): void {
    if (this.player.isDashing) {
      for (const hazard of this.hazards) {
        if (hazard.active && hazard.spec.type === 'cracked-wall' && Phaser.Math.Distance.Between(this.player.x, this.player.y, hazard.visual.x, hazard.visual.y) < 85) this.breakHazard(hazard);
      }
      for (const enemy of this.enemies) {
        if (enemy.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.image.x, enemy.image.y) < 86) this.defeatEnemy(enemy);
      }
    }
    if (this.player.isSlamming && this.player.grounded) {
      this.player.isSlamming = false;
      for (const platform of this.platforms) {
        if (platform.active && platform.spec.kind === 'fragile' && Math.abs(platform.visual.x - this.player.x) < platform.spec.width / 2 + 70) this.breakPlatform(platform);
      }
      for (const enemy of this.enemies) {
        if (enemy.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.image.x, enemy.image.y) < 150) this.defeatEnemy(enemy);
      }
      this.effectGraphics.lineStyle(5, COLORS.gold, 0.9).strokeCircle(this.player.x, this.player.y + 20, 120);
      this.camera.shake(120, 0.006);
      audio.play('land');
      void now;
    }
  }

  private checkFall(now: number): void {
    if (this.player.y < this.offsetY + this.stage.height + 20) return;
    const result = this.player.health.takeDamage(DAMAGE.fall * this.difficulty.damageScale, now, DAMAGE.invulnerabilityMs);
    audio.play('damage');
    this.detachGrapple(false);
    if (resolveFailure(this.launch.mode, result.health) === 'recover-checkpoint') {
      this.player.respawn(this.player.lastSafePosition, now, false);
      this.hud.notice(
        t('notice.fallRecovery', {
          damage: Math.round(DAMAGE.fall * this.difficulty.damageScale),
        }),
        now,
        '#ff7b82',
      );
    } else this.handleDeath(now);
  }

  private checkFinish(elapsed: number): void {
    if (this.player.x < this.stage.finishX) return;
    this.finished = true;
    this.finishTimeMs = elapsed;
    this.detachGrapple(false);
    this.player.setVelocity(0, 0);
    this.createFinishBurst();
    audio.play('finish');
    this.hud.notice(t('notice.stageClear'), this.scene.time.now, '#ffc857');
    this.options.onFinish(this);
  }

  private updateTutorial(now: number): void {
    const prompts = this.stage.tutorialPrompts ?? [];
    const index = prompts.findIndex((prompt, promptIndex) => this.player.x >= prompt.x - 80 && this.player.x < (prompts[promptIndex + 1]?.x ?? Infinity) - 80);
    if (index >= 0 && index !== this.tutorialPromptIndex) {
      this.tutorialPromptIndex = index;
      const prompt = prompts[index];
      if (prompt) {
        const variables =
          this.options.playerIndex === 0
            ? { left: 'A', right: 'D', jump: 'Space', grapple: 'E', skill: 'Q' }
            : { left: '←', right: '→', jump: 'Right Shift', grapple: 'Enter', skill: '/' };
        this.hud.notice(
          `${t(prompt.titleKey)}: ${t(prompt.bodyKey, variables)}`,
          now,
          '#ffc857',
        );
      }
    }
  }

  private updateTrail(now: number): void {
    if (
      Math.abs(this.player.horizontalSpeedPx()) < MOVEMENT.speedTrailMinPx ||
      now - this.lastTrailAt < 65
    ) return;
    this.lastTrailAt = now;
    const ghost = this.scene.add
      .ellipse(
        this.player.x - this.player.facing * 17,
        this.player.y,
        18,
        38,
        this.options.playerColor,
        0.18,
      )
      .setDepth(10);
    this.layer.add(ghost);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      x: ghost.x - this.player.horizontalSpeedPx() * 0.05,
      duration: 220,
      onComplete: () => ghost.destroy(),
    });
  }

  private drawEffects(now: number): void {
    this.ropeGraphics.clear();
    if (this.activeGrapple) {
      const anchor = this.activeGrapple.body.position;
      const origin = this.player.grappleVisualOrigin();
      this.ropeGraphics.lineStyle(5, COLORS.cyan, 0.14).lineBetween(origin.x, origin.y, anchor.x, anchor.y);
      this.ropeGraphics.lineStyle(2, COLORS.white, 0.86).lineBetween(origin.x, origin.y, anchor.x, anchor.y);
      const steps = 8;
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        this.ropeGraphics.fillStyle(i % 2 ? COLORS.cyan : COLORS.violet, 0.8).fillCircle(Phaser.Math.Linear(origin.x, anchor.x, t), Phaser.Math.Linear(origin.y, anchor.y, t), 2 + Math.sin(now / 80 + i) * 0.5);
      }
    }
    if (now >= this.player.health.shieldUntil && now >= this.freezeUntil) this.effectGraphics.clear();
    if (this.player.health.shieldUntil > now) {
      this.effectGraphics.clear().lineStyle(3, COLORS.cyan, 0.8).strokeCircle(this.player.x, this.player.y, 38 + Math.sin(now / 100) * 3);
    } else if (this.freezeUntil > now) {
      this.effectGraphics.clear().lineStyle(3, 0x9ee8ff, 0.6).strokeCircle(this.player.x, this.player.y, 150 + Math.sin(now / 120) * 20);
    }
  }

  private currentBlockers(): RectSpec[] {
    return [
      ...this.platforms.filter((platform) => platform.active).map((platform) => ({ x: platform.visual.x, y: platform.visual.y, width: platform.spec.width, height: platform.spec.height })),
      ...this.hazards.filter((hazard) => hazard.active && (hazard.spec.type === 'cracked-wall' || hazard.spec.type === 'low-tunnel')).map((hazard) => ({ x: hazard.visual.x, y: hazard.visual.y, width: hazard.spec.width, height: hazard.spec.height })),
    ];
  }

  private attachGrapple(anchor: AnchorRuntime): void {
    this.player.setGrappleTarget({ x: anchor.body.position.x, y: anchor.body.position.y });
    if (!this.player.beginGrapple(this.scene.time.now)) {
      this.player.setGrappleTarget(null);
      audio.play('fail');
      this.hud.notice(t('notice.needHeadroom'), this.scene.time.now, '#ff7b82');
      return;
    }
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, anchor.body.position.x, anchor.body.position.y);
    this.grappleConstraint = this.scene.matter.add.constraint(this.player.body as any, anchor.body, distance, GRAPPLE.stiffness);
    this.activeGrapple = anchor;
    this.player.cancelJumpSequence();
    this.selectedAnchor = anchor;
    this.reticle.setVisible(false);
    audio.play('grapple');
  }

  private detachGrapple(playSound: boolean): void {
    const wasActive = this.activeGrapple !== null;
    if (this.grappleConstraint) this.scene.matter.world.removeConstraint(this.grappleConstraint);
    if (this.activeGrapple?.kind === 'fragile') {
      this.activeGrapple.active = false;
      this.activeGrapple.outer.setAlpha(0.12);
      this.activeGrapple.inner.setVisible(false);
    }
    this.grappleConstraint = null;
    this.activeGrapple = null;
    this.player.setGrappleTarget(null);
    if (wasActive) this.player.endGrapple(this.scene.time.now);
    if (playSound) audio.play('release');
  }

  private createTemporaryAnchor(now: number): void {
    let x = this.player.x + this.player.facing * 290;
    let y = this.player.y - 190;
    const blockers = this.currentBlockers();
    if (blockers.some((blocker) => Math.abs(x - blocker.x) < blocker.width / 2 + 20 && Math.abs(y - blocker.y) < blocker.height / 2 + 20)) y -= 120;
    x = Phaser.Math.Clamp(x, this.player.x - 380, this.player.x + 380);
    this.addAnchor({ id: `temp-${this.options.owner}-${Math.floor(now)}`, kind: 'magical', x, y, expiresAt: now + GRAPPLE.temporaryAnchorLifetimeMs });
  }

  private spawnFriendlyProjectile(now: number): void {
    const image = this.scene.add.image(this.player.x + this.player.facing * 28, this.player.y - 3, 'projectile').setTint(COLORS.cyan).setDepth(26);
    image.setFlipX(this.player.facing < 0);
    this.layer.add(image);
    this.projectiles.push({ image, friendly: true, vx: this.player.facing * 720, vy: 0, expiresAt: now + 1700 });
  }

  private spawnHostileProjectile(x: number, y: number, now: number): void {
    const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
    const speed = 280 * this.difficulty.enemyCadence;
    const image = this.scene.add.image(x, y, 'projectile').setTint(COLORS.magenta).setDepth(25);
    this.layer.add(image);
    this.projectiles.push({ image, friendly: false, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, expiresAt: now + 4200 });
  }

  private damagePlayer(amount: number, now: number, direction: number): void {
    const result = this.player.health.takeDamage(Math.round(amount * this.difficulty.damageScale), now, DAMAGE.invulnerabilityMs);
    if (result.shieldConsumed) {
      audio.play('fail');
      this.hud.notice(t('notice.shieldBlock'), now, '#8ff7ff');
      return;
    }
    if (!result.applied) return;
    audio.play('damage');
    this.detachGrapple(false);
    this.player.beginKnockback(now);
    this.player.setVelocity(
      direction * pixelsPerSecondToMatterVelocity(MOVEMENT.damageKnockbackXPx),
      -pixelsPerSecondToMatterVelocity(MOVEMENT.damageKnockbackYPx),
    );
    if (runtimeState.save.settings.screenShake) this.camera.shake(120, 0.006);
    if (result.died) this.handleDeath(now);
  }

  private handleDeath(now: number): void {
    this.detachGrapple(false);
    if (this.launch.mode === 'race') {
      this.deaths += 1;
      this.checkpointIndex = 0;
      this.player.lastSafePosition = { x: this.stage.start.x, y: this.stage.start.y + this.offsetY };
      this.player.respawn(this.player.lastSafePosition, now, true);
      this.hud.notice(t('notice.systemReset'), now, '#ff7b82');
      audio.play('respawn');
    } else {
      this.player.setVelocity(0, 0);
      this.options.onSoloDeath();
    }
  }

  private defeatEnemy(enemy: EnemyRuntime): void {
    if (!enemy.active) return;
    enemy.active = false;
    enemy.image.setVisible(false);
    if (enemy.spec.type === 'armored-blocker') this.scene.matter.world.remove(enemy.image.body as any);
    audio.play('defeat');
    const burst = this.scene.add.circle(enemy.image.x, enemy.image.y, 20, COLORS.magenta, 0.8).setDepth(27);
    this.layer.add(burst);
    this.scene.tweens.add({ targets: burst, radius: 70, alpha: 0, duration: 260, onComplete: () => burst.destroy() });
  }

  private breakHazard(hazard: HazardRuntime): void {
    if (!hazard.active) return;
    hazard.active = false;
    hazard.visual.setAlpha(0.12);
    if (hazard.body) this.scene.matter.world.remove(hazard.body);
    audio.play('defeat');
  }

  private breakPlatform(platform: PlatformRuntime): void {
    platform.active = false;
    platform.visual.setAlpha(0.12);
    this.scene.matter.world.remove(platform.body);
    audio.play('defeat');
  }

  private projectileTouchesPlayer(image: Phaser.GameObjects.Image): boolean {
    return ellipseOverlapsBounds(
      this.player.visualContactBounds(),
      image.x,
      image.y,
      image.displayWidth / 2,
      image.displayHeight * 0.4,
    );
  }

  private hazardTouchesPlayer(hazard: HazardRuntime, x: number, y: number): boolean {
    const playerBounds = this.player.visualContactBounds();
    if (hazard.spec.type === 'spikes') {
      const count = Math.max(2, Math.floor(hazard.spec.width / 24));
      const segmentWidth = hazard.spec.width / count;
      for (let index = 0; index < count; index += 1) {
        const left = x - hazard.spec.width / 2 + index * segmentWidth;
        if (
          triangleOverlapsBounds(
            playerBounds,
            { x: left, y: y + hazard.spec.height / 2 },
            { x: left + segmentWidth / 2, y: y - hazard.spec.height / 2 },
            { x: left + segmentWidth, y: y + hazard.spec.height / 2 },
          )
        ) {
          return true;
        }
      }
      return false;
    }

    if (hazard.spec.type === 'blade') {
      const vertices: ContactPoint[] = [];
      for (let index = 0; index < 16; index += 1) {
        const radius = index % 2 === 0 ? hazard.spec.width * 0.5 : hazard.spec.width * 0.2;
        const angle = -Math.PI / 2 + hazard.visual.rotation + (index * Math.PI) / 8;
        vertices.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
      }
      const center = { x, y };
      return vertices.some((vertex, index) =>
        triangleOverlapsBounds(
          playerBounds,
          center,
          vertex,
          vertices[(index + 1) % vertices.length]!,
        ),
      );
    }

    return boundsOverlap(
      playerBounds,
      rectangleBounds(x, y, hazard.spec.width, hazard.spec.height),
    );
  }

  private enemyTouchesPlayer(enemy: EnemyRuntime): boolean {
    const playerBounds = this.player.visualContactBounds();
    const image = enemy.image;
    const point = (
      sourceX: number,
      sourceY: number,
      sourceWidth: number,
      sourceHeight: number,
    ): ContactPoint => ({
      x: image.x + (sourceX / sourceWidth - 0.5) * image.displayWidth,
      y: image.y + (sourceY / sourceHeight - 0.5) * image.displayHeight,
    });

    if (enemy.spec.type === 'charger') {
      return triangleOverlapsBounds(
        playerBounds,
        point(4, 37, 58, 44),
        point(22, 7, 58, 44),
        point(53, 37, 58, 44),
      );
    }

    if (enemy.spec.type === 'flyer') {
      const core = point(30, 19, 60, 38);
      if (
        ellipseOverlapsBounds(
          playerBounds,
          core.x,
          core.y,
          (13 / 60) * image.displayWidth,
          (13 / 38) * image.displayHeight,
        )
      ) {
        return true;
      }
      return (
        triangleOverlapsBounds(
          playerBounds,
          point(0, 10, 60, 38),
          point(20, 15, 60, 38),
          point(9, 28, 60, 38),
        ) ||
        triangleOverlapsBounds(
          playerBounds,
          point(60, 10, 60, 38),
          point(40, 15, 60, 38),
          point(51, 28, 60, 38),
        )
      );
    }

    if (enemy.spec.type === 'turret') {
      const bodyCenter = point(25, 38, 50, 54);
      const headCenter = point(25, 22, 50, 54);
      const barrelCenter = point(26.5, 15, 50, 54);
      return (
        boundsOverlap(
          playerBounds,
          rectangleBounds(
            bodyCenter.x,
            bodyCenter.y,
            (36 / 50) * image.displayWidth,
            (28 / 54) * image.displayHeight,
          ),
        ) ||
        ellipseOverlapsBounds(
          playerBounds,
          headCenter.x,
          headCenter.y,
          (12 / 50) * image.displayWidth,
          (12 / 54) * image.displayHeight,
        ) ||
        boundsOverlap(
          playerBounds,
          rectangleBounds(
            barrelCenter.x,
            barrelCenter.y,
            (5 / 50) * image.displayWidth,
            (20 / 54) * image.displayHeight,
          ),
        )
      );
    }

    const blockerCenter = point(29, 35, 58, 68);
    return boundsOverlap(
      playerBounds,
      rectangleBounds(
        blockerCenter.x,
        blockerCenter.y,
        (50 / 58) * image.displayWidth + MOVEMENT.solidContactSkinPx,
        (62 / 68) * image.displayHeight,
      ),
    );
  }

  private onJump(kind: 'small' | 'large' | 'wall'): void {
    audio.play(kind === 'large' ? 'largeJump' : 'jump');
    if (kind === 'large') {
      this.hud.notice(t('notice.largeJump'), this.scene.time.now, '#ffc857');
      const ring = this.scene.add
        .circle(this.player.x, this.player.y, 18, COLORS.gold, 0)
        .setStrokeStyle(3, COLORS.gold, 0.85)
        .setDepth(28);
      this.layer.add(ring);
      this.scene.tweens.add({
        targets: ring,
        radius: 52,
        alpha: 0,
        duration: 220,
        onComplete: () => ring.destroy(),
      });
    } else if (kind === 'wall' && !runtimeState.save.settings.reducedEffects) {
      const spark = this.scene.add
        .circle(this.player.x - this.player.facing * 16, this.player.y, 8, COLORS.violet, 0.7)
        .setDepth(28);
      this.layer.add(spark);
      this.scene.tweens.add({
        targets: spark,
        radius: 24,
        alpha: 0,
        duration: 160,
        onComplete: () => spark.destroy(),
      });
    }
  }

  private onLand(speed: number): void {
    audio.play('land');
    if (!runtimeState.save.settings.reducedEffects) {
      for (let index = 0; index < Math.min(7, Math.floor(speed)); index += 1) {
        const particle = this.scene.add.circle(this.player.x, this.player.y + 22, 3, COLORS.cyan, 0.55).setDepth(23);
        this.layer.add(particle);
        this.scene.tweens.add({
          targets: particle,
          x: particle.x + (index - 3) * 13,
          y: particle.y - 18 - (index % 3) * 8,
          alpha: 0,
          duration: 260,
          onComplete: () => particle.destroy(),
        });
      }
    }
  }
}
