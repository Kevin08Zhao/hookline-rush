import Phaser from 'phaser';
import {
  COLORS,
  COURSE_ROW_HEIGHT,
  DIFFICULTIES,
  FONT_DISPLAY,
  FONT_FAMILY,
  RACE_CAMERA_ZOOM,
  RACE_DIVIDER_WIDTH,
  RACE_SECOND_VIEWPORT_X,
  RACE_VIEWPORT_WIDTH,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from '../config';
import { bestTimeKey } from '../core/persistence';
import { materializeStage, STAGES } from '../levels/stages';
import { runtimeState } from '../state';
import { t } from '../i18n';
import { audio } from '../systems/AudioManager';
import { CourseRuntime } from '../systems/CourseRuntime';
import type { GameLaunchData, PlayerInputState } from '../types';

const EMPTY_INPUT: PlayerInputState = {
  horizontal: 0,
  vertical: 0,
  jump: false,
  jumpPressed: false,
  jumpReleased: false,
  grapple: false,
  grapplePressed: false,
  skill: false,
  skillPressed: false,
  pausePressed: false,
};

export class GameplayScene extends Phaser.Scene {
  private launch!: GameLaunchData;
  private courses: CourseRuntime[] = [];
  private overlayLayer!: Phaser.GameObjects.Layer;
  private overlayCamera?: Phaser.Cameras.Scene2D.Camera;
  private countdownTexts: Phaser.GameObjects.Text[] = [];
  private raceGraphics?: Phaser.GameObjects.Graphics;
  private pauseControl!: Phaser.GameObjects.Container;
  private pausePanel!: Phaser.GameObjects.Container;
  private runStartAt = 0;
  private pauseStartedAt = 0;
  private pausedDuration = 0;
  private paused = false;
  private ending = false;
  private lastCountdown = 4;

  constructor() {
    super('gameplay');
  }

  init(data: GameLaunchData): void {
    this.launch = data;
    this.courses = [];
    this.paused = false;
    this.ending = false;
    this.runStartAt = 0;
    this.pausedDuration = 0;
    this.lastCountdown = 4;
  }

  create(): void {
    const blueprint = STAGES[this.launch.stageId];
    const difficulty = DIFFICULTIES[this.launch.difficultyId];
    audio.playStageMusic(this.launch.stageId);
    this.matter.world.setBounds(0, -100, blueprint.width + 200, this.launch.mode === 'race' ? COURSE_ROW_HEIGHT * 2 + 100 : COURSE_ROW_HEIGHT + 100, 200, false, false, false, false);
    this.overlayLayer = this.add.layer().setDepth(1000);

    const p1 = new CourseRuntime({
      scene: this,
      stage: materializeStage(blueprint, blueprint.seed),
      difficulty,
      launch: this.launch,
      owner: this.launch.mode === 'solo' ? 'solo' : 'p1',
      playerIndex: 0,
      offsetY: 0,
      categories: { player: 0x0001, solid: 0x0002 },
      compactHud: this.launch.mode === 'race',
      playerColor: COLORS.cyan,
      onSoloDeath: () => this.endRun(true),
      onFinish: (course) => this.handleFinish(course),
    });
    this.courses.push(p1);

    if (this.launch.mode === 'race') {
      const p2 = new CourseRuntime({
        scene: this,
        stage: materializeStage(blueprint, blueprint.seed),
        difficulty,
        launch: this.launch,
        owner: 'p2',
        playerIndex: 1,
        offsetY: COURSE_ROW_HEIGHT,
        categories: { player: 0x0004, solid: 0x0008 },
        compactHud: true,
        playerColor: COLORS.magenta,
        onSoloDeath: () => undefined,
        onFinish: (course) => this.handleFinish(course),
      });
      this.courses.push(p2);
    }

    this.configureCameras();
    this.createOverlay();
    this.createPausePanel();

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-R', () => {
      if (this.paused) this.restartRun();
    });
    keyboard?.on('keydown-M', () => {
      if (this.paused) this.returnToStageSelect();
    });
    keyboard?.on('keydown-K', () => {
      if (this.paused) this.toggleSetting('screenShake');
    });
    keyboard?.on('keydown-V', () => {
      if (this.paused) this.toggleMute();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.removeAllListeners();
      this.courses.forEach((course) => course.destroy());
    });

    if (this.launch.mode === 'race' && this.launch.deviceMode !== 'shared-keyboard') {
      this.time.delayedCall(1000, () => {
        this.courses.forEach((course, index) => {
          const expectsGamepad =
            this.launch.deviceMode === 'two-gamepads' ||
            (this.launch.deviceMode === 'keyboard-gamepad' && index === 1);
          if (expectsGamepad && !course.input.gamepadConnected()) {
            course.hud.notice(
              t('notice.gamepadMissing'),
              this.time.now,
              '#ffc857',
            );
          }
        });
      });
    }
  }

  update(_time: number, delta: number): void {
    const time = this.time.now;
    if (this.runStartAt === 0) this.runStartAt = time + 3000;
    const inputs = this.courses.map((course) => course.readInput());
    if (inputs.some((input) => input.pausePressed) && !this.ending) this.togglePause();
    const currentPauseDuration = this.paused ? time - this.pauseStartedAt : 0;
    const simulationTime = time - this.pausedDuration - currentPauseDuration;
    const countdownRemaining = Math.max(0, this.runStartAt - simulationTime);
    const active = countdownRemaining <= 0 && !this.paused && !this.ending;
    const elapsed = Math.max(0, simulationTime - this.runStartAt);

    this.updateCountdown(countdownRemaining);
    this.courses.forEach((course, index) => {
      course.update(
        simulationTime,
        this.paused ? 0 : delta,
        elapsed,
        this.paused ? EMPTY_INPUT : (inputs[index] ?? EMPTY_INPUT),
        active,
      );
    });
    this.updateRaceOverlay();
  }

  private configureCameras(): void {
    const p1 = this.courses[0];
    if (!p1) return;
    const main = this.cameras.main;
    p1.camera = main;
    if (this.launch.mode === 'solo') {
      main.setViewport(0, 0, VIEW_WIDTH, VIEW_HEIGHT).setBounds(0, 0, STAGES[this.launch.stageId].width, STAGES[this.launch.stageId].height);
      main.startFollow(p1.player, true, 0.1, 0.13, -125, 28).setDeadzone(300, 180);
      return;
    }

    const p2 = this.courses[1];
    if (!p2) return;
    main
      .setViewport(0, 0, RACE_VIEWPORT_WIDTH, VIEW_HEIGHT)
      .setBounds(0, 0, STAGES[this.launch.stageId].width, STAGES[this.launch.stageId].height)
      .setZoom(RACE_CAMERA_ZOOM);
    main.startFollow(p1.player, true, 0.11, 0.14, -105, 18).setDeadzone(190, 220);
    const second = this.cameras
      .add(RACE_SECOND_VIEWPORT_X, 0, RACE_VIEWPORT_WIDTH, VIEW_HEIGHT)
      .setBounds(
        0,
        COURSE_ROW_HEIGHT,
        STAGES[this.launch.stageId].width,
        STAGES[this.launch.stageId].height,
      )
      .setZoom(RACE_CAMERA_ZOOM);
    second.startFollow(p2.player, true, 0.11, 0.14, -105, 18).setDeadzone(190, 220);
    p2.camera = second;
    this.overlayCamera = this.cameras.add(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    main.ignore([p2.layer, this.overlayLayer]);
    second.ignore([p1.layer, this.overlayLayer]);
    this.overlayCamera.ignore([p1.layer, p2.layer]);
  }

  private createOverlay(): void {
    const countdownPositions = this.launch.mode === 'race'
      ? [RACE_VIEWPORT_WIDTH / 2, RACE_SECOND_VIEWPORT_X + RACE_VIEWPORT_WIDTH / 2]
      : [VIEW_WIDTH / 2];
    this.countdownTexts = countdownPositions.map((x) => {
      const text = this.add.text(x, 330, '3', {
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
        fontSize: this.launch.mode === 'race' ? '70px' : '92px',
        color: '#f2f7ff',
        stroke: '#10162f',
        strokeThickness: 8,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1100);
      this.overlayLayer.add(text);
      return text;
    });
    if (this.launch.mode === 'race') {
      this.raceGraphics = this.add.graphics().setScrollFactor(0).setDepth(1050);
      this.overlayLayer.add(this.raceGraphics);
    }
    const pauseBackground = this.add
      .rectangle(0, 0, 92, 34, COLORS.ink, 0.88)
      .setStrokeStyle(1, COLORS.violet, 0.75);
    const pauseLabel = this.add.text(0, 0, `Ⅱ  ${t('controls.pause')}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f2f7ff',
    }).setOrigin(0.5);
    this.pauseControl = this.add
      .container(VIEW_WIDTH / 2, 28, [pauseBackground, pauseLabel])
      .setSize(92, 34)
      .setScrollFactor(0)
      .setDepth(1150)
      .setInteractive({ useHandCursor: true });
    this.pauseControl.on('pointerover', () => pauseBackground.setFillStyle(COLORS.violet, 0.25));
    this.pauseControl.on('pointerout', () => pauseBackground.setFillStyle(COLORS.ink, 0.88));
    this.pauseControl.on('pointerdown', () => this.togglePause());
    this.overlayLayer.add(this.pauseControl);
  }

  private createPausePanel(): void {
    const shade = this.add.rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x03040b, 0.86).setOrigin(0);
    const panel = this.add.rectangle(640, 360, 520, 540, 0x10162f, 0.98).setStrokeStyle(2, COLORS.violet, 0.8);
    const title = this.add.text(640, 135, this.launch.mode === 'race' ? t('pause.raceTitle') : t('pause.runTitle'), {
      fontFamily: FONT_DISPLAY, fontSize: '34px', fontStyle: 'bold', color: '#f2f7ff', letterSpacing: 2,
    }).setOrigin(0.5);
    const objects: Phaser.GameObjects.GameObject[] = [shade, panel, title];
    const button = (y: number, label: string, action: () => void, color: number = COLORS.cyan): void => {
      const background = this.add.rectangle(640, y, 340, 48, COLORS.ink, 0.9).setStrokeStyle(1, color, 0.75).setInteractive({ useHandCursor: true });
      const text = this.add.text(640, y, label, { fontFamily: FONT_FAMILY, fontSize: '15px', color: '#f2f7ff', fontStyle: 'bold' }).setOrigin(0.5);
      background.on('pointerover', () => background.setFillStyle(color, 0.22));
      background.on('pointerout', () => background.setFillStyle(COLORS.ink, 0.9));
      background.on('pointerdown', action);
      objects.push(background, text);
    };
    button(215, t('pause.resume'), () => this.togglePause());
    button(275, t('pause.restart'), () => this.restartRun(), COLORS.gold);
    button(335, t('pause.stageSelect'), () => this.returnToStageSelect(), COLORS.magenta);
    button(405, t('pause.screenShake'), () => this.toggleSetting('screenShake'), COLORS.violet);
    button(465, t('pause.audio'), () => this.toggleMute(), COLORS.violet);
    const hint = this.add.text(640, 545, t('pause.hint'), {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: '#8192b8',
      align: 'center',
      wordWrap: { width: 450, useAdvancedWrap: true },
    }).setOrigin(0.5);
    objects.push(hint);
    this.pausePanel = this.add.container(0, 0, objects).setScrollFactor(0).setDepth(1200).setVisible(false);
    this.overlayLayer.add(this.pausePanel);
  }

  private updateCountdown(remaining: number): void {
    if (remaining <= 0) {
      if (this.lastCountdown !== 0) {
        this.lastCountdown = 0;
        this.countdownTexts.forEach((text) => {
          text.setText(t('countdown.go')).setColor('#50f29a');
          this.tweens.add({ targets: text, alpha: 0, scale: 1.5, duration: 520 });
        });
        audio.play('finish');
      }
      return;
    }
    const value = Math.ceil(remaining / 1000);
    if (value !== this.lastCountdown) {
      this.lastCountdown = value;
      this.countdownTexts.forEach((text) => {
        text.setAlpha(1).setScale(1).setText(String(value)).setColor('#f2f7ff');
      });
      audio.play('countdown');
    }
  }

  private updateRaceOverlay(): void {
    if (!this.raceGraphics) return;
    const p1 = this.courses[0]?.progress() ?? 0;
    const p2 = this.courses[1]?.progress() ?? 0;
    const trackTop = 14;
    const trackHeight = VIEW_HEIGHT - trackTop * 2;
    const markerY = (progress: number): number =>
      VIEW_HEIGHT - trackTop - Phaser.Math.Clamp(progress, 0, 1) * trackHeight;
    const dividerLeft = RACE_VIEWPORT_WIDTH;
    this.raceGraphics.clear();
    this.raceGraphics
      .fillStyle(0x03040b, 1)
      .fillRect(dividerLeft, 0, RACE_DIVIDER_WIDTH, VIEW_HEIGHT);
    this.raceGraphics
      .lineStyle(2, COLORS.cyan, 0.45)
      .lineBetween(dividerLeft + 4, trackTop, dividerLeft + 4, VIEW_HEIGHT - trackTop);
    this.raceGraphics
      .lineStyle(2, COLORS.magenta, 0.45)
      .lineBetween(dividerLeft + RACE_DIVIDER_WIDTH - 4, trackTop, dividerLeft + RACE_DIVIDER_WIDTH - 4, VIEW_HEIGHT - trackTop);
    this.raceGraphics.fillStyle(COLORS.cyan).fillCircle(dividerLeft + 4, markerY(p1), 4);
    this.raceGraphics
      .fillStyle(COLORS.magenta)
      .fillCircle(dividerLeft + RACE_DIVIDER_WIDTH - 4, markerY(p2), 4);
  }

  private togglePause(): void {
    if (this.ending) return;
    this.paused = !this.paused;
    this.pausePanel.setVisible(this.paused);
    this.pauseControl.setVisible(!this.paused);
    if (this.paused) {
      this.pauseStartedAt = this.time.now;
      this.matter.world.pause();
    } else {
      this.pausedDuration += this.time.now - this.pauseStartedAt;
      this.matter.world.resume();
    }
    audio.play('confirm');
  }

  private restartRun(): void {
    audio.play('confirm');
    this.matter.world.resume();
    this.scene.restart(this.launch);
  }

  private returnToStageSelect(): void {
    audio.play('confirm');
    this.matter.world.resume();
    this.scene.start('stage-select', { mode: this.launch.mode });
  }

  private toggleSetting(key: 'screenShake'): void {
    runtimeState.update((save) => ({ ...save, settings: { ...save.settings, [key]: !save.settings[key] } }));
    audio.play('navigate');
  }

  private toggleMute(): void {
    const muting = runtimeState.save.settings.masterVolume > 0;
    if (muting) audio.play('navigate');
    runtimeState.update((save) => ({
      ...save,
      settings: { ...save.settings, masterVolume: muting ? 0 : 0.7 },
    }));
    audio.refreshVolumes();
    if (!muting) audio.play('navigate');
  }

  private handleFinish(course: CourseRuntime): void {
    if (this.ending) return;
    if (this.launch.mode === 'race') {
      const winner = course === this.courses[0] ? 1 : 2;
      this.endRun(false, winner);
    } else this.endRun(false);
  }

  private endRun(gameOver: boolean, winner?: 1 | 2): void {
    if (this.ending) return;
    this.ending = true;
    const p1 = this.courses[0];
    const p2 = this.courses[1];
    const currentPauseDuration = this.paused ? this.time.now - this.pauseStartedAt : 0;
    const elapsed = Math.max(
      0,
      this.time.now - this.pausedDuration - currentPauseDuration - this.runStartAt,
    );
    const p1TimeMs = p1?.finished ? p1.finishTimeMs : elapsed;
    if (!gameOver && this.launch.mode === 'solo') {
      const key = bestTimeKey(this.launch.stageId, this.launch.difficultyId);
      runtimeState.update((save) => ({
        ...save,
        tutorialComplete: save.tutorialComplete || this.launch.tutorial === true,
        bestTimes: {
          ...save.bestTimes,
          [key]: Math.min(save.bestTimes[key] ?? Number.POSITIVE_INFINITY, p1TimeMs),
        },
      }));
    }
    this.time.delayedCall(gameOver ? 650 : 1050, () => {
      this.scene.start('results', {
        ...this.launch,
        winner,
        gameOver,
        p1TimeMs,
        p2TimeMs: p2?.finished ? p2.finishTimeMs : elapsed,
        deaths: [p1?.deaths ?? 0, p2?.deaths ?? 0],
      });
    });
  }
}
