import Phaser from 'phaser';
import { DigitalButtonLatch, sampleDigitalButton } from '../core/inputButton';
import { t } from '../i18n';
import type { GameLaunchData, PlayerInputState } from '../types';

type InputKeyMap = Record<'left' | 'right' | 'up' | 'down' | 'jump' | 'grapple' | 'skill' | 'pause', Phaser.Input.Keyboard.Key>;

export class InputController {
  private readonly keys: InputKeyMap;
  private readonly keyboardButtons = {
    left: new DigitalButtonLatch(),
    right: new DigitalButtonLatch(),
    up: new DigitalButtonLatch(),
    down: new DigitalButtonLatch(),
    jump: new DigitalButtonLatch(),
    grapple: new DigitalButtonLatch(),
    skill: new DigitalButtonLatch(),
    pause: new DigitalButtonLatch(),
  };
  private previous = { jump: false, grapple: false, skill: false, pause: false };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly playerIndex: 0 | 1,
    private readonly launch: GameLaunchData,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error(t('error.keyboardUnavailable'));
    const codes =
      playerIndex === 0
        ? {
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
            grapple: Phaser.Input.Keyboard.KeyCodes.E,
            skill: Phaser.Input.Keyboard.KeyCodes.Q,
            pause: Phaser.Input.Keyboard.KeyCodes.ESC,
          }
        : {
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            jump: Phaser.Input.Keyboard.KeyCodes.SHIFT,
            grapple: Phaser.Input.Keyboard.KeyCodes.ENTER,
            skill: Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH,
            pause: Phaser.Input.Keyboard.KeyCodes.ESC,
          };
    this.keys = Object.fromEntries(
      Object.entries(codes).map(([name, code]) => [name, keyboard.addKey(code)]),
    ) as InputKeyMap;
    for (const name of ['left', 'right', 'up', 'down', 'jump', 'grapple', 'skill', 'pause'] as const) {
      const latch = this.keyboardButtons[name];
      this.keys[name].on('down', (_key: Phaser.Input.Keyboard.Key, event?: KeyboardEvent) => {
        latch.press(event?.repeat === true);
      });
      this.keys[name].on('up', () => latch.release());
    }
  }

  private assignedGamepad(): Phaser.Input.Gamepad.Gamepad | null {
    const pads = this.scene.input.gamepad?.gamepads ?? [];
    if (this.launch.deviceMode === 'two-gamepads') return pads[this.playerIndex] ?? null;
    if (this.launch.deviceMode === 'keyboard-gamepad' && this.playerIndex === 1) return pads[0] ?? null;
    return null;
  }

  read(): PlayerInputState {
    const pad = this.assignedGamepad();
    const keyboardDirections = {
      left: this.keyboardButtons.left.sample(),
      right: this.keyboardButtons.right.sample(),
      up: this.keyboardButtons.up.sample(),
      down: this.keyboardButtons.down.sample(),
    };
    const directionActive = (name: keyof typeof keyboardDirections): boolean => {
      const edge = keyboardDirections[name];
      return edge.down || edge.pressed;
    };
    const keyboardHorizontal =
      Number(directionActive('right')) - Number(directionActive('left'));
    const keyboardVertical = Number(directionActive('down')) - Number(directionActive('up'));
    const horizontal = pad
      ? Math.abs(pad.leftStick.x) > 0.18
        ? pad.leftStick.x
        : Number(pad.right) - Number(pad.left)
      : keyboardHorizontal;
    const vertical = pad
      ? Math.abs(pad.leftStick.y) > 0.18
        ? pad.leftStick.y
        : Number(pad.down) - Number(pad.up)
      : keyboardVertical;
    const jumpEdge = pad
      ? sampleDigitalButton(this.previous.jump, pad.A)
      : this.keyboardButtons.jump.sample();
    const grappleEdge = pad
      ? sampleDigitalButton(this.previous.grapple, (pad.buttons[7]?.value ?? 0) > 0.2)
      : this.keyboardButtons.grapple.sample();
    const skillEdge = pad
      ? sampleDigitalButton(this.previous.skill, pad.X)
      : this.keyboardButtons.skill.sample();
    const pauseEdge = pad
      ? sampleDigitalButton(this.previous.pause, Boolean(pad.buttons[9]?.pressed))
      : this.keyboardButtons.pause.sample();
    const state: PlayerInputState = {
      horizontal,
      vertical,
      jump: jumpEdge.down,
      jumpPressed: jumpEdge.pressed,
      jumpReleased: jumpEdge.released,
      grapple: grappleEdge.down,
      grapplePressed: grappleEdge.pressed,
      skill: skillEdge.down,
      skillPressed: skillEdge.pressed,
      pausePressed: pauseEdge.pressed,
    };
    this.previous = {
      jump: jumpEdge.down,
      grapple: grappleEdge.down,
      skill: skillEdge.down,
      pause: pauseEdge.down,
    };
    return state;
  }

  gamepadConnected(): boolean {
    return this.assignedGamepad() !== null;
  }
}
