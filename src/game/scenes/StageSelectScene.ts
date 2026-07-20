import Phaser from 'phaser';
import { COLORS, DIFFICULTIES, DIFFICULTY_ORDER, FONT_DISPLAY, FONT_FAMILY } from '../config';
import { bestTimeKey } from '../core/persistence';
import { t } from '../i18n';
import { PLAYABLE_STAGE_IDS, STAGES } from '../levels/stages';
import { runtimeState } from '../state';
import { audio } from '../systems/AudioManager';
import type { DifficultyId, GameMode } from '../types';
import { addCornerLabel, addMenuBackdrop, addNeonButton, formatTime } from '../ui/menuUi';

interface SelectData {
  mode?: GameMode;
}

export class StageSelectScene extends Phaser.Scene {
  private mode: GameMode = 'solo';
  private stageIndex = 0;
  private difficultyIndex = 1;
  private deviceIndex = 0;
  private stageText!: Phaser.GameObjects.Text;
  private descriptionText!: Phaser.GameObjects.Text;
  private difficultyText!: Phaser.GameObjects.Text;
  private difficultyDescriptionText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private deviceText?: Phaser.GameObjects.Text;
  private readonly devices = ['shared-keyboard', 'keyboard-gamepad', 'two-gamepads'] as const;
  private readonly deviceLabels = {
    'shared-keyboard': 'device.sharedKeyboard',
    'keyboard-gamepad': 'device.keyboardGamepad',
    'two-gamepads': 'device.twoGamepads',
  } as const;

  constructor() {
    super('stage-select');
  }

  init(data: SelectData): void {
    this.mode = data.mode ?? 'solo';
    this.stageIndex = 0;
    this.difficultyIndex = 1;
    this.deviceIndex = 0;
  }

  create(): void {
    audio.playMusic('menu');
    addMenuBackdrop(this, this.mode === 'race' ? COLORS.magenta : COLORS.cyan);
    addCornerLabel(this, t(this.mode === 'race' ? 'mode.raceEyebrow' : 'mode.singleEyebrow'));
    this.add.text(640, 80, t(this.mode === 'race' ? 'stageSelect.raceTitle' : 'stageSelect.title'), {
      fontFamily: FONT_DISPLAY,
      fontSize: '39px',
      color: '#f2f7ff',
    }).setOrigin(0.5);

    this.add.rectangle(640, 266, 900, 300, 0x10162f, 0.92).setStrokeStyle(2, this.mode === 'race' ? COLORS.magenta : COLORS.cyan, 0.7);
    this.stageText = this.add.text(640, 164, '', { fontFamily: FONT_DISPLAY, fontSize: '34px', fontStyle: 'bold', color: '#f2f7ff' }).setOrigin(0.5);
    this.descriptionText = this.add.text(640, 232, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#aebbd5', align: 'center', lineSpacing: 6, wordWrap: { width: 730 } }).setOrigin(0.5);
    this.add.text(235, 266, '‹', { fontFamily: FONT_FAMILY, fontSize: '54px', color: '#32e9ff' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changeStage(-1));
    this.add.text(1045, 266, '›', { fontFamily: FONT_FAMILY, fontSize: '54px', color: '#32e9ff' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changeStage(1));
    this.bestText = this.add.text(640, 344, '', { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#8192b8', letterSpacing: 1 }).setOrigin(0.5);

    this.add.text(440, 438, t('stageSelect.difficulty'), { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#8192b8', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5);
    this.difficultyText = this.add.text(440, 476, '', { fontFamily: FONT_DISPLAY, fontSize: '22px', fontStyle: 'bold', color: '#ffc857' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changeDifficulty(1));
    this.difficultyDescriptionText = this.add.text(440, 520, '', { fontFamily: FONT_FAMILY, fontSize: '12px', color: '#8192b8', align: 'center', wordWrap: { width: 350 } }).setOrigin(0.5);

    if (this.mode === 'race') {
      this.add.text(840, 438, t('stageSelect.deviceAssignment'), { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#8192b8', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5);
      this.deviceText = this.add.text(840, 476, '', { fontFamily: FONT_DISPLAY, fontSize: '18px', fontStyle: 'bold', color: '#ff4fc3' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changeDevice());
      this.add.text(840, 520, t('stageSelect.changeDevice'), { fontFamily: FONT_FAMILY, fontSize: '12px', color: '#7382a1' }).setOrigin(0.5);
    } else {
      this.add.text(840, 480, t('stageSelect.difficultyHint'), { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#7382a1', align: 'center', wordWrap: { width: 340 } }).setOrigin(0.5);
    }

    addNeonButton(this, 640, 590, 280, t(this.mode === 'race' ? 'stageSelect.startRace' : 'stageSelect.startRun'), () => this.startGame(), this.mode === 'race' ? COLORS.magenta : COLORS.cyan);
    addNeonButton(this, 175, 658, 180, t('common.back'), () => this.scene.start('menu'), COLORS.violet);
    this.add.text(1100, 660, t('stageSelect.keyboardHint'), { fontFamily: FONT_FAMILY, fontSize: '12px', color: '#7382a1' }).setOrigin(1, 0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.changeStage(-1));
    keyboard?.on('keydown-RIGHT', () => this.changeStage(1));
    keyboard?.on('keydown-UP', () => this.changeDifficulty(1));
    keyboard?.on('keydown-DOWN', () => this.changeDifficulty(-1));
    keyboard?.on('keydown-D', () => this.changeDevice());
    keyboard?.on('keydown-ENTER', () => {
      audio.play('confirm');
      this.startGame();
    });
    keyboard?.on('keydown-ESC', () => {
      audio.play('confirm');
      this.scene.start('menu');
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard?.removeAllListeners());
    this.refresh();
  }

  private changeStage(delta: number): void {
    this.stageIndex = Phaser.Math.Wrap(this.stageIndex + delta, 0, PLAYABLE_STAGE_IDS.length);
    audio.play('navigate');
    this.refresh();
  }

  private changeDifficulty(delta: number): void {
    this.difficultyIndex = Phaser.Math.Wrap(this.difficultyIndex + delta, 0, DIFFICULTY_ORDER.length);
    audio.play('navigate');
    this.refresh();
  }

  private changeDevice(): void {
    if (this.mode !== 'race') return;
    this.deviceIndex = (this.deviceIndex + 1) % this.devices.length;
    audio.play('navigate');
    this.refresh();
  }

  private refresh(): void {
    const stageId = PLAYABLE_STAGE_IDS[this.stageIndex] ?? 'neon-rooftops';
    const difficultyId: DifficultyId = DIFFICULTY_ORDER[this.difficultyIndex] ?? 'normal';
    const stage = STAGES[stageId];
    this.stageText.setText(t(stage.nameKey));
    this.descriptionText.setText(`${t(stage.subtitleKey)}\n${t(stage.descriptionKey)}`);
    const difficulty = DIFFICULTIES[difficultyId];
    this.difficultyText.setText(`‹  ${t(difficulty.labelKey)}  ›`);
    this.difficultyDescriptionText.setText(t(difficulty.descriptionKey));
    const best = runtimeState.save.bestTimes[bestTimeKey(stageId, difficultyId)] ?? 0;
    this.bestText.setText(
      this.mode === 'solo'
        ? t('stageSelect.bestTime', { time: best > 0 ? formatTime(best) : t('stageSelect.noBestTime') })
        : t('stageSelect.isolated'),
    );
    const deviceKey = this.devices[this.deviceIndex] ?? 'shared-keyboard';
    this.deviceText?.setText(t(this.deviceLabels[deviceKey]));
  }

  private startGame(): void {
    const stageId = PLAYABLE_STAGE_IDS[this.stageIndex] ?? 'neon-rooftops';
    const difficultyId = DIFFICULTY_ORDER[this.difficultyIndex] ?? 'normal';
    this.scene.start('gameplay', {
      mode: this.mode,
      stageId,
      difficultyId,
      deviceMode: this.mode === 'race' ? this.devices[this.deviceIndex] : undefined,
    });
  }
}
