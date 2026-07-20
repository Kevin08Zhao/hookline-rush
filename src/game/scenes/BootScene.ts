import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../config';
import { t } from '../i18n';
import { assertValidStage } from '../levels/validate';
import { STAGES } from '../levels/stages';
import { runtimeState } from '../state';
import { ProceduralMaterialRenderer } from '../visuals/proceduralMaterials';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    runtimeState.load();
    Object.values(STAGES).forEach(assertValidStage);
    this.createTextures();
    this.cameras.main.setBackgroundColor('#070a18');
    this.add
      .text(640, 360, t('app.loading'), {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#aebbd5',
      })
      .setOrigin(0.5);
    this.time.delayedCall(80, () => this.scene.start('menu'));
  }

  private createTextures(): void {
    const graphics = this.add.graphics();
    const texture = (name: string, width: number, height: number, draw: () => void): void => {
      graphics.clear();
      draw();
      graphics.generateTexture(name, width, height);
    };

    texture('player-p1', 42, 54, () => {
      graphics.fillStyle(COLORS.cyan).fillCircle(25, 9, 7);
      graphics.fillRoundedRect(13, 16, 19, 23, 6);
      graphics.fillTriangle(16, 35, 22, 35, 11, 52);
      graphics.fillTriangle(25, 35, 31, 35, 38, 50);
      graphics.fillStyle(COLORS.white).fillTriangle(9, 22, 14, 19, 12, 34);
    });
    texture('player-p2', 42, 54, () => {
      graphics.fillStyle(COLORS.magenta).fillCircle(25, 9, 7);
      graphics.fillRoundedRect(13, 16, 19, 23, 6);
      graphics.fillTriangle(16, 35, 22, 35, 11, 52);
      graphics.fillTriangle(25, 35, 31, 35, 38, 50);
      graphics.fillStyle(COLORS.white).fillTriangle(9, 22, 14, 19, 12, 34);
    });
    // The Comet Courier is built from opaque overlapping puppet parts. The generous
    // cuffs hide the joints while keeping every existing animation clip reusable.
    texture('rig-head', 28, 24, () => {
      graphics.fillStyle(0x070918).fillTriangle(2, 2, 14, 4, 7, 11);
      graphics.fillStyle(0xff6f61).fillTriangle(3, 3, 14, 5, 7, 9);
      graphics.fillStyle(0x070918).fillEllipse(16, 13, 23, 21);
      graphics.fillStyle(0xf3efe3).fillEllipse(16, 11.5, 21, 19);
      graphics.fillStyle(0xc9c6bd).fillEllipse(10, 14, 6, 7);
      graphics.fillStyle(0x171a35).fillCircle(8.5, 14, 3.5);
      graphics.lineStyle(1.4, 0x434264).strokeCircle(8.5, 14, 2.2);
      graphics.fillStyle(0xd8d4ca, 0.78).fillCircle(14, 6.5, 1.5);
      graphics.fillStyle(0xffffff, 0.8).fillCircle(18, 5.5, 1.1);
    });
    texture('rig-torso', 28, 34, () => {
      graphics.fillStyle(0x070918).fillRoundedRect(2, 1, 24, 32, 7);
      graphics.fillStyle(0x121b3d).fillRoundedRect(4, 3, 20, 28, 6);
      graphics.fillStyle(0x27345f).fillRoundedRect(6, 4, 6, 25, 3);
      graphics.fillStyle(0xf3efe3).fillRoundedRect(3, 5, 8, 9, 4);
      graphics.fillStyle(0xff6f61).fillTriangle(22, 4, 26, 9, 22, 16);
      graphics.fillStyle(0xff6f61).fillRect(5, 28, 17, 2);
      graphics.lineStyle(1, 0x66729b, 0.7).lineBetween(13, 6, 13, 28);
    });
    texture('rig-upper-arm', 14, 24, () => {
      graphics.fillStyle(0x070918).fillRoundedRect(1, 1, 12, 22, 6);
      graphics.fillStyle(0xf3efe3).fillRoundedRect(2, 2, 10, 8, 5);
      graphics.fillStyle(0x182347).fillRoundedRect(3, 8, 8, 14, 4);
      graphics.fillStyle(0xff6f61).fillTriangle(4, 4, 10, 4, 7, 8);
      graphics.lineStyle(1.2, 0x444c77).strokeCircle(7, 20, 2.6);
    });
    texture('rig-forearm', 14, 24, () => {
      graphics.fillStyle(0x070918).fillRoundedRect(1, 1, 12, 22, 6);
      graphics.fillStyle(0x182347).fillRoundedRect(3, 2, 8, 12, 4);
      graphics.fillStyle(0xf3efe3).fillRoundedRect(2, 11, 10, 10, 4);
      graphics.fillStyle(0xff6f61).fillRect(3, 17, 8, 3);
      graphics.fillStyle(0x22284e).fillCircle(7, 3.5, 2.5);
      graphics.fillStyle(0x070918).fillRoundedRect(4, 20, 6, 3, 2);
    });
    texture('rig-thigh', 16, 26, () => {
      graphics.fillStyle(0x070918).fillRoundedRect(1, 1, 14, 24, 7);
      graphics.fillStyle(0x152143).fillRoundedRect(3, 2, 10, 22, 5);
      graphics.fillStyle(0x26345d).fillRoundedRect(4, 3, 4, 18, 2);
      graphics.fillStyle(0xff6f61).fillRect(4, 6, 8, 2);
      graphics.lineStyle(1.2, 0x4a527e).strokeCircle(8, 22, 3);
    });
    texture('rig-shin', 18, 28, () => {
      graphics.fillStyle(0x070918).fillRoundedRect(2, 1, 13, 24, 6);
      graphics.fillStyle(0x172144).fillRoundedRect(4, 2, 9, 17, 4);
      graphics.fillStyle(0xf3efe3).fillRoundedRect(3, 16, 13, 9, 4);
      graphics.fillStyle(0xff6f61).fillRoundedRect(3, 22, 14, 4, 2);
      graphics.fillStyle(0x1e294f).fillTriangle(7, 17, 16, 18, 16, 22);
      graphics.fillStyle(0x070918).fillRect(5, 25, 11, 2);
    });
    texture('rig-visor', 12, 6, () => {
      graphics.fillStyle(0x070918).fillRoundedRect(0, 0, 12, 6, 3);
      graphics.fillStyle(COLORS.white).fillRoundedRect(1.5, 1.25, 9.5, 3.5, 2);
    });
    texture('rig-chest', 12, 10, () => {
      graphics.fillStyle(0x070918).fillTriangle(0, 1, 12, 1, 6, 10);
      graphics.fillStyle(COLORS.white).fillTriangle(2, 2.5, 10, 2.5, 6, 8);
    });
    texture('rig-scarf', 28, 8, () => {
      graphics.fillStyle(0x070918).fillTriangle(1, 4, 28, 0, 28, 8);
      graphics.fillStyle(COLORS.white).fillTriangle(3, 4, 26, 1.5, 26, 6.5);
    });
    new ProceduralMaterialRenderer(this).createEnemyTextures();
    texture('projectile', 18, 10, () => {
      graphics.fillStyle(COLORS.magenta).fillEllipse(9, 5, 18, 8);
      graphics.fillStyle(COLORS.white).fillEllipse(12, 5, 6, 4);
    });
    texture('health', 30, 30, () => {
      graphics.fillStyle(COLORS.health).fillRoundedRect(0, 8, 30, 14, 5);
      graphics.fillRoundedRect(8, 0, 14, 30, 5);
      graphics.lineStyle(2, COLORS.white, 0.8).strokeCircle(15, 15, 14);
    });
    texture('skill-core', 34, 34, () => {
      graphics.fillStyle(COLORS.violet).fillCircle(17, 17, 15);
      graphics.lineStyle(3, COLORS.white).strokeTriangle(17, 4, 29, 25, 5, 25);
      graphics.fillStyle(COLORS.cyan).fillCircle(17, 17, 5);
    });
    graphics.destroy();
  }
}
