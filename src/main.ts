import Phaser from 'phaser';
import './styles.css';
import { MOVEMENT, VIEW_HEIGHT, VIEW_WIDTH } from './game/config';
import { BootScene } from './game/scenes/BootScene';
import { GameplayScene } from './game/scenes/GameplayScene';
import { InfoScene } from './game/scenes/InfoScene';
import { MenuScene } from './game/scenes/MenuScene';
import { ResultsScene } from './game/scenes/ResultsScene';
import { StageSelectScene } from './game/scenes/StageSelectScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: '#070918',
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: MOVEMENT.matterGravityY },
      enableSleeping: false,
      debug: false,
    },
  },
  input: {
    gamepad: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
  },
  render: {
    powerPreference: 'high-performance',
    antialias: true,
  },
  scene: [BootScene, MenuScene, StageSelectScene, InfoScene, GameplayScene, ResultsScene],
});

declare global {
  interface Window {
    hooklineRush: Phaser.Game;
  }
}

window.hooklineRush = game;
