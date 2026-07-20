import Phaser from 'phaser';
import {
  ABILITIES,
  COLORS,
  DAMAGE,
  FONT_DISPLAY,
  FONT_FAMILY,
  FONT_MONO,
  RACE_VIEWPORT_WIDTH,
} from '../config';
import { t } from '../i18n';
import type { DifficultyPreset } from '../types';
import { formatTime } from './menuUi';
import type { PlayerAvatar } from '../entities/PlayerAvatar';

export class Hud {
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly skillText: Phaser.GameObjects.Text;
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly debugText: Phaser.GameObjects.Text;
  private readonly noticeText: Phaser.GameObjects.Text;
  private noticeUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerAvatar,
    label: string,
    color: number,
    private readonly difficulty: DifficultyPreset,
    compact: boolean,
  ) {
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(200);
    this.label = scene.add.text(22, 18, label, {
      fontFamily: FONT_DISPLAY,
      fontStyle: 'bold',
      fontSize: compact ? '12px' : '14px',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      letterSpacing: 2,
    }).setScrollFactor(0).setDepth(201);
    this.skillText = scene.add.text(282, 38, t('hud.noSkill'), {
      fontFamily: FONT_FAMILY,
      fontSize: compact ? '9px' : '10px',
      color: '#cbd5ea',
      fontStyle: 'bold',
      align: 'left',
      lineSpacing: 1,
      wordWrap: { width: 108, useAdvancedWrap: true },
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(201);
    this.healthText = scene.add.text(111, 47, '', {
      fontFamily: FONT_FAMILY,
      fontSize: compact ? '8px' : '9px',
      color: '#f2f7ff',
      fontStyle: 'bold',
      stroke: '#071126',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.progressText = scene.add.text(compact ? RACE_VIEWPORT_WIDTH - 20 : 1195, 20, '0%', {
      fontFamily: FONT_DISPLAY,
      fontStyle: 'bold',
      fontSize: compact ? '14px' : '17px',
      color: '#f2f7ff',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(201);
    this.timerText = scene.add.text(compact ? RACE_VIEWPORT_WIDTH - 20 : 1195, 43, '0:00.000', {
      fontFamily: FONT_FAMILY,
      fontSize: compact ? '10px' : '12px',
      color: '#8192b8',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(201);
    this.debugText = scene.add.text(22, compact ? 70 : 82, '', {
      fontFamily: FONT_MONO,
      fontSize: '10px',
      color: '#d5dcff',
      backgroundColor: '#070918aa',
      padding: { x: 5, y: 4 },
    }).setScrollFactor(0).setDepth(201);
    this.noticeText = scene.add.text(compact ? RACE_VIEWPORT_WIDTH / 2 : 640, compact ? 89 : 116, '', {
      fontFamily: FONT_DISPLAY,
      fontStyle: 'bold',
      fontSize: compact ? '15px' : '20px',
      color: '#f2f7ff',
      backgroundColor: '#10162fcc',
      padding: { x: 14, y: 8 },
      align: 'center',
      lineSpacing: 3,
      wordWrap: { width: compact ? RACE_VIEWPORT_WIDTH - 96 : 720, useAdvancedWrap: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setAlpha(0);
    this.objects.push(this.graphics, this.label, this.skillText, this.healthText, this.progressText, this.timerText, this.debugText, this.noticeText);
  }

  update(now: number, elapsed: number, progress: number, showDebug: boolean, grappleName: string): void {
    const healthRatio = this.player.health.health / DAMAGE.maxHealth;
    const ability = this.player.skills.ability;
    const remaining = this.player.skills.remaining(now);
    const cooldown = ability ? ABILITIES[ability].cooldownMs * this.difficulty.cooldownScale : 1;
    const readyRatio = ability ? 1 - Math.min(1, remaining / cooldown) : 0;
    const skillColor = ability ? ABILITIES[ability].color : COLORS.muted;
    this.graphics.clear();
    this.graphics.fillStyle(COLORS.ink, 0.74).fillRoundedRect(14, 10, 390, 56, 9);
    this.graphics.lineStyle(1, COLORS.cyan, 0.24).strokeRoundedRect(14, 10, 390, 56, 9);
    this.graphics.fillStyle(0x1c2546, 0.9).fillRoundedRect(22, 42, 178, 10, 4);
    this.graphics.fillStyle(healthRatio > 0.3 ? COLORS.health : COLORS.danger, 1).fillRoundedRect(22, 42, 178 * healthRatio, 10, 4);
    this.graphics.lineStyle(3, skillColor, 0.22).strokeCircle(250, 38, 21);
    this.graphics.lineStyle(4, skillColor, 0.95).beginPath().arc(250, 38, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * readyRatio).strokePath();
    this.graphics.fillStyle(skillColor, ability && remaining <= 0 ? 0.95 : 0.35).fillCircle(250, 38, 11);

    this.skillText.setText(
      ability
        ? remaining > 0
          ? t('hud.skillCooldown', {
              skill: t(ABILITIES[ability].nameKey),
              seconds: (remaining / 1000).toFixed(1),
            })
          : t('hud.skillReady', { skill: t(ABILITIES[ability].nameKey) })
        : t('hud.noSkill'),
    );
    this.healthText.setText(t('hud.health', { current: Math.ceil(this.player.health.health) }));
    this.progressText.setText(`${Math.floor(progress * 100)}%`);
    this.timerText.setText(formatTime(elapsed));
    this.debugText.setVisible(showDebug).setText(
      `v ${(this.player.body as any).velocity.x.toFixed(2)}, ${(this.player.body as any).velocity.y.toFixed(2)}\n` +
        `state ${this.player.motionState}  body ${this.player.currentColliderWidth.toFixed(1)}×${this.player.currentColliderHeight.toFixed(1)}\n` +
        `ground ${this.player.grounded}  grapple ${grappleName || 'none'}\n` +
        `hp ${this.player.health.health}  fps ${Math.round(this.scene.game.loop.actualFps)}`,
    );
    this.noticeText.setAlpha(now < this.noticeUntil ? 1 : Math.max(0, this.noticeText.alpha - 0.08));
  }

  notice(text: string, now: number, color = '#f2f7ff'): void {
    this.noticeText.setText(text).setColor(color).setAlpha(1);
    this.noticeUntil = now + 1400;
  }
}
