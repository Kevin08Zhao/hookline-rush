import Phaser from 'phaser';
import { COLORS, FONT_DISPLAY, FONT_FAMILY, VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { audio } from '../systems/AudioManager';

export function addMenuBackdrop(scene: Phaser.Scene, accent: number = COLORS.cyan): void {
  scene.cameras.main.setBackgroundColor(COLORS.ink);
  const graphics = scene.add.graphics();
  graphics.fillGradientStyle(0x17123d, 0x10162f, 0x090b1d, 0x070918, 1);
  graphics.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  graphics.lineStyle(1, accent, 0.09);
  for (let x = -VIEW_HEIGHT; x < VIEW_WIDTH + VIEW_HEIGHT; x += 84) {
    graphics.lineBetween(x, VIEW_HEIGHT, x + VIEW_HEIGHT, 0);
  }
  graphics.lineStyle(1, 0xffffff, 0.035);
  for (let y = 70; y < VIEW_HEIGHT; y += 70) graphics.lineBetween(0, y, VIEW_WIDTH, y);

  for (let i = 0; i < 44; i += 1) {
    const x = (i * 173 + 41) % VIEW_WIDTH;
    const y = (i * 97 + 83) % VIEW_HEIGHT;
    const radius = i % 5 === 0 ? 2 : 1;
    graphics.fillStyle(i % 3 === 0 ? accent : COLORS.violet, 0.35).fillCircle(x, y, radius);
  }
}

export function addCornerLabel(scene: Phaser.Scene, text: string): Phaser.GameObjects.Text {
  return scene.add
    .text(44, 35, text.toUpperCase(), {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: '#8192b8',
      letterSpacing: 3,
    })
    .setOrigin(0, 0.5);
}

export function addNeonButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  label: string,
  onSelect: () => void,
  accent: number = COLORS.cyan,
): Phaser.GameObjects.Container {
  const panel = scene.add
    .rectangle(0, 0, width, 50, COLORS.navy, 0.9)
    .setStrokeStyle(1, accent, 0.75);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT_DISPLAY,
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#f2f7ff',
      letterSpacing: 1,
    })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [panel, text]).setSize(width, 50).setInteractive({ useHandCursor: true });
  container.on('pointerover', () => {
    panel.setFillStyle(accent, 0.22);
    container.setScale(1.025);
  });
  container.on('pointerout', () => {
    panel.setFillStyle(COLORS.navy, 0.9);
    container.setScale(1);
  });
  container.on('pointerdown', () => {
    audio.play('confirm');
    onSelect();
  });
  return container;
}

export function formatTime(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '--:--.---';
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = Math.floor(milliseconds % 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}
