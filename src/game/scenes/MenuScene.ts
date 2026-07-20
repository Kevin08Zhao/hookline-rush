import Phaser from 'phaser';
import { COLORS, FONT_DISPLAY, FONT_FAMILY } from '../config';
import { t } from '../i18n';
import { audio } from '../systems/AudioManager';
import { addCornerLabel, addMenuBackdrop, addNeonButton } from '../ui/menuUi';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    audio.playMusic('menu');
    addMenuBackdrop(this);
    addCornerLabel(this, t('menu.eyebrow'));

    this.add
      .text(640, 133, t('app.title'), {
        fontFamily: FONT_DISPLAY,
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#f2f7ff',
        stroke: '#126d88',
        strokeThickness: 2,
        letterSpacing: 6,
      })
      .setOrigin(0.5);
    this.add
      .text(640, 208, t('app.subtitle'), {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#32e9ff',
        letterSpacing: 3,
      })
      .setOrigin(0.5);
    this.add
      .text(640, 251, t('menu.tagline'), {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: '#9aa9c8',
        letterSpacing: 5,
      })
      .setOrigin(0.5);

    const go = (scene: string, data?: object): void => {
      this.scene.start(scene, data);
    };
    addNeonButton(this, 640, 325, 350, t('menu.singlePlayer'), () => go('stage-select', { mode: 'solo' }));
    addNeonButton(
      this,
      640,
      389,
      350,
      t('menu.twoPlayerRace'),
      () => go('stage-select', { mode: 'race' }),
      COLORS.magenta,
    );
    addNeonButton(
      this,
      640,
      453,
      350,
      t('menu.tutorial'),
      () =>
        go('gameplay', {
          mode: 'solo',
          stageId: 'tutorial',
          difficultyId: 'beginner',
          tutorial: true,
        }),
      COLORS.gold,
    );
    addNeonButton(this, 552, 529, 170, t('menu.controls'), () => go('info', { page: 'controls' }), COLORS.violet);
    addNeonButton(this, 728, 529, 170, t('menu.settings'), () => go('info', { page: 'settings' }), COLORS.violet);

    this.add
      .text(640, 635, t('menu.footer'), {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        letterSpacing: 0.5,
        color: '#6f7f9f',
      })
      .setOrigin(0.5);

    const enter = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    enter?.once('down', () => {
      audio.play('confirm');
      go('stage-select', { mode: 'solo' });
    });
  }
}
