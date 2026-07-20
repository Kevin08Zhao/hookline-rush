import Phaser from 'phaser';
import { COLORS, FONT_DISPLAY, FONT_FAMILY } from '../config';
import { t } from '../i18n';
import { runtimeState } from '../state';
import { audio } from '../systems/AudioManager';
import { addCornerLabel, addMenuBackdrop, addNeonButton } from '../ui/menuUi';

interface InfoData {
  page?: 'controls' | 'settings';
}

export class InfoScene extends Phaser.Scene {
  private page: 'controls' | 'settings' = 'controls';

  constructor() {
    super('info');
  }

  init(data: InfoData): void {
    this.page = data.page ?? 'controls';
  }

  create(): void {
    audio.playMusic('menu');
    addMenuBackdrop(this, COLORS.violet);
    addCornerLabel(this, t(this.page === 'controls' ? 'controls.eyebrow' : 'settings.eyebrow'));
    if (this.page === 'controls') this.createControls();
    else this.createSettings();
    addNeonButton(this, 640, 658, 220, t('common.back'), () => this.scene.start('menu'), COLORS.violet);
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).once('down', () => {
      audio.play('confirm');
      this.scene.start('menu');
    });
  }

  private createControls(): void {
    this.add
      .text(640, 88, t('controls.title'), {
        fontFamily: FONT_DISPLAY,
        fontSize: '38px',
        color: '#f2f7ff',
      })
      .setOrigin(0.5);

    const rows = [
      [t('controls.move'), 'A / D', '← / →', t('controls.leftStick')],
      [t('controls.biasProne'), 'W / S', '↑ / ↓', t('controls.stickOrDpad')],
      [t('controls.jump'), 'Space', 'Right Shift', t('controls.aCross')],
      [t('controls.grapple'), 'E', 'Enter', t('controls.rightTrigger')],
      [t('controls.skill'), 'Q', '/', t('controls.xSquare')],
      [t('controls.pause'), 'Esc', 'Esc', t('controls.startMenu')],
    ];
    const headers = [t('controls.action'), t('controls.player1'), t('controls.player2'), t('controls.gamepad')];
    headers.forEach((header, index) =>
      this.add
        .text(230 + index * 260, 172, header, {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: 'bold',
          color: index === 0 ? '#8192b8' : '#32e9ff',
          letterSpacing: 2,
        })
        .setOrigin(0.5),
    );
    rows.forEach((row, rowIndex) => {
      const y = 220 + rowIndex * 58;
      this.add.rectangle(640, y, 1080, 44, rowIndex % 2 ? 0x111631 : 0x171a38, 0.84);
      row.forEach((value, index) =>
        this.add
          .text(230 + index * 260, y, value ?? '', {
            fontFamily: FONT_FAMILY,
            fontSize: '15px',
            color: index === 0 ? '#c4cee3' : '#f2f7ff',
          })
          .setOrigin(0.5),
      );
    });
    this.add
      .text(640, 590, t('controls.hint'), {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: '#9aa9c8',
        align: 'center',
        lineSpacing: 3,
        wordWrap: { width: 1030, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  private createSettings(): void {
    this.add
      .text(640, 88, t('settings.title'), {
        fontFamily: FONT_DISPLAY,
        fontSize: '42px',
        color: '#f2f7ff',
      })
      .setOrigin(0.5);
    const settings = runtimeState.save.settings;
    const rows: Array<{
      label: string;
      value: () => string;
      change: () => void;
    }> = [
      {
        label: t('settings.masterVolume'),
        value: () => `${Math.round(runtimeState.save.settings.masterVolume * 100)}%`,
        change: () => this.changeVolume('masterVolume'),
      },
      {
        label: t('settings.musicVolume'),
        value: () => `${Math.round(runtimeState.save.settings.musicVolume * 100)}%`,
        change: () => this.changeVolume('musicVolume'),
      },
      {
        label: t('settings.sfxVolume'),
        value: () => `${Math.round(runtimeState.save.settings.sfxVolume * 100)}%`,
        change: () => this.changeVolume('sfxVolume'),
      },
      { label: t('settings.screenShake'), value: () => t(runtimeState.save.settings.screenShake ? 'common.on' : 'common.off'), change: () => this.toggle('screenShake') },
      { label: t('settings.reducedEffects'), value: () => t(runtimeState.save.settings.reducedEffects ? 'common.on' : 'common.off'), change: () => this.toggle('reducedEffects') },
      { label: t('settings.debugOverlay'), value: () => t(runtimeState.save.settings.debugOverlay ? 'common.on' : 'common.off'), change: () => this.toggle('debugOverlay') },
    ];
    rows.forEach((row, index) => {
      const y = 170 + index * 68;
      this.add.rectangle(640, y, 720, 50, index % 2 ? 0x111631 : 0x171a38, 0.9).setStrokeStyle(1, COLORS.violet, 0.4);
      this.add.text(330, y, row.label, { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#aebbd5', fontStyle: 'bold' }).setOrigin(0, 0.5);
      const valueText = this.add.text(930, y, row.value(), { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#f2f7ff', fontStyle: 'bold' }).setOrigin(1, 0.5);
      const hit = this.add.rectangle(640, y, 720, 50, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        row.change();
        valueText.setText(row.value());
        audio.play('navigate');
      });
    });
    addNeonButton(this, 640, 598, 240, t('settings.fullscreen'), () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    }, COLORS.cyan);
    void settings;
  }

  private changeVolume(key: 'masterVolume' | 'musicVolume' | 'sfxVolume'): void {
    runtimeState.update((save) => ({
      ...save,
      settings: {
        ...save.settings,
        [key]: save.settings[key] >= 0.99 ? 0 : Math.min(1, save.settings[key] + 0.25),
      },
    }));
    audio.refreshVolumes();
  }

  private toggle(key: 'screenShake' | 'reducedEffects' | 'debugOverlay'): void {
    runtimeState.update((save) => ({
      ...save,
      settings: { ...save.settings, [key]: !save.settings[key] },
    }));
  }
}
