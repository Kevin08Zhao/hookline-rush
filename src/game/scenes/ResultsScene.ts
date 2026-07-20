import Phaser from 'phaser';
import { COLORS, FONT_DISPLAY, FONT_FAMILY } from '../config';
import { t } from '../i18n';
import { STAGES } from '../levels/stages';
import { audio } from '../systems/AudioManager';
import type { GameResultData } from '../types';
import { addCornerLabel, addMenuBackdrop, addNeonButton, formatTime } from '../ui/menuUi';

export class ResultsScene extends Phaser.Scene {
  private result!: GameResultData;

  constructor() {
    super('results');
  }

  init(data: GameResultData): void {
    this.result = data;
  }

  create(): void {
    audio.playMusic('results');
    const accent = this.result.gameOver ? COLORS.danger : this.result.winner === 2 ? COLORS.magenta : COLORS.gold;
    addMenuBackdrop(this, accent);
    addCornerLabel(this, t(this.result.mode === 'race' ? 'results.raceEyebrow' : 'results.stageEyebrow'));
    const title = this.result.gameOver
      ? t('results.gameOver')
      : this.result.mode === 'race'
        ? t('results.playerWins', { player: this.result.winner ?? 1 })
        : t('results.stageClear');
    this.add.text(640, 112, title, {
      fontFamily: FONT_DISPLAY,
      fontSize: '48px',
      color: '#f2f7ff',
      stroke: Phaser.Display.Color.IntegerToColor(accent).rgba,
      strokeThickness: 2,
      letterSpacing: 3,
    }).setOrigin(0.5);
    this.add.text(640, 176, t(STAGES[this.result.stageId].nameKey), {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: '#9aa9c8', letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.rectangle(640, 330, 760, 220, 0x10162f, 0.94).setStrokeStyle(1, accent, 0.68);
    if (this.result.mode === 'solo') {
      this.add.text(640, 278, t(this.result.gameOver ? 'results.healthDepleted' : 'results.clearTime'), { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#8192b8', fontStyle: 'bold', letterSpacing: 3 }).setOrigin(0.5);
      this.add.text(640, 338, this.result.gameOver ? t('results.retryPrompt') : formatTime(this.result.p1TimeMs), { fontFamily: FONT_DISPLAY, fontSize: '38px', fontStyle: 'bold', color: this.result.gameOver ? '#ff7b82' : '#ffc857' }).setOrigin(0.5);
      this.add.text(640, 398, t(this.result.gameOver ? 'results.failureHint' : 'results.bestSaved'), {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: '#aebbd5',
        align: 'center',
        wordWrap: { width: 650, useAdvancedWrap: true },
      }).setOrigin(0.5);
    } else {
      const rows = [
        { label: t('results.player1'), time: formatTime(this.result.p1TimeMs), deaths: this.result.deaths[0], color: '#32e9ff' },
        { label: t('results.player2'), time: formatTime(this.result.p2TimeMs ?? 0), deaths: this.result.deaths[1], color: '#ff4fc3' },
      ];
      rows.forEach((row, index) => {
        const y = 294 + index * 76;
        this.add.text(330, y, row.label, { fontFamily: FONT_DISPLAY, fontSize: '17px', fontStyle: 'bold', color: row.color }).setOrigin(0, 0.5);
        this.add.text(640, y, row.time, { fontFamily: FONT_DISPLAY, fontSize: '24px', fontStyle: 'bold', color: '#f2f7ff' }).setOrigin(0.5);
        this.add.text(940, y, t('results.resets', { count: row.deaths }), { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#8192b8' }).setOrigin(1, 0.5);
      });
      this.add.text(640, 425, t('results.raceHint'), { fontFamily: FONT_FAMILY, fontSize: '12px', color: '#8192b8', letterSpacing: 1 }).setOrigin(0.5);
    }

    const replay = (): void => {
      this.scene.start('gameplay', this.result);
    };
    addNeonButton(this, 640, 508, 300, t(this.result.mode === 'race' ? 'results.rematch' : 'results.retryStage'), replay, accent);
    addNeonButton(this, 520, 574, 220, t('results.stageSelect'), () => this.scene.start('stage-select', { mode: this.result.mode }), COLORS.violet);
    addNeonButton(this, 760, 574, 220, t('results.mainMenu'), () => this.scene.start('menu'), COLORS.violet);
    this.add.text(640, 656, t('results.keyHint'), { fontFamily: FONT_FAMILY, fontSize: '12px', color: '#7382a1' }).setOrigin(0.5);
    this.input.keyboard?.once('keydown-ENTER', () => {
      audio.play('confirm');
      replay();
    });
    this.input.keyboard?.once('keydown-ESC', () => {
      audio.play('confirm');
      this.scene.start('stage-select', { mode: this.result.mode });
    });
  }
}
