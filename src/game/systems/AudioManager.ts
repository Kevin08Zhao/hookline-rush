import { runtimeState } from '../state';
import type { StageId } from '../types';

export type MusicTrack =
  | 'menu'
  | 'neon-rooftops'
  | 'arcane-foundry'
  | 'gravity-ruins'
  | 'results';

const MUSIC_URLS: Readonly<Record<MusicTrack, string>> = {
  menu: new URL('../../../musics/main-menu.mp3', import.meta.url).href,
  'neon-rooftops': new URL('../../../musics/neon-rooftops.mp3', import.meta.url).href,
  'arcane-foundry': new URL('../../../musics/arcane-foundry.mp3', import.meta.url).href,
  'gravity-ruins': new URL('../../../musics/gravity-ruins.mp3', import.meta.url).href,
  results: new URL('../../../musics/results.mp3', import.meta.url).href,
};

export type SoundCue =
  | 'navigate'
  | 'confirm'
  | 'jump'
  | 'largeJump'
  | 'land'
  | 'grapple'
  | 'release'
  | 'fail'
  | 'skill'
  | 'ready'
  | 'damage'
  | 'health'
  | 'defeat'
  | 'countdown'
  | 'respawn'
  | 'finish';

const CUES: Readonly<Record<SoundCue, readonly [number, number, OscillatorType]>> = {
  navigate: [360, 0.04, 'sine'],
  confirm: [620, 0.09, 'triangle'],
  jump: [420, 0.08, 'square'],
  largeJump: [760, 0.14, 'triangle'],
  land: [120, 0.06, 'triangle'],
  grapple: [760, 0.1, 'sine'],
  release: [310, 0.07, 'sine'],
  fail: [140, 0.1, 'sawtooth'],
  skill: [540, 0.13, 'square'],
  ready: [920, 0.08, 'sine'],
  damage: [95, 0.16, 'sawtooth'],
  health: [680, 0.14, 'sine'],
  defeat: [180, 0.1, 'square'],
  countdown: [500, 0.08, 'square'],
  respawn: [280, 0.18, 'triangle'],
  finish: [840, 0.35, 'triangle'],
};

class AudioManager {
  private context: AudioContext | null = null;
  private music: HTMLAudioElement | null = null;
  private musicTrack: MusicTrack | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined' || !window.AudioContext) return null;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  play(cue: SoundCue): void {
    const context = this.ensureContext();
    if (!context) return;
    this.resumeMusic();
    const [frequency, duration, type] = CUES[cue];
    const volume =
      runtimeState.save.settings.masterVolume * runtimeState.save.settings.sfxVolume * 0.09;
    if (volume <= 0) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(45, frequency * (cue === 'damage' ? 0.45 : 1.35)),
      context.currentTime + duration,
    );
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }

  playMusic(track: MusicTrack): void {
    if (typeof Audio === 'undefined') return;
    if (this.musicTrack === track && this.music) {
      this.refreshVolumes();
      return;
    }

    this.music?.pause();
    const music = new Audio(MUSIC_URLS[track]);
    music.loop = true;
    music.preload = 'auto';
    this.music = music;
    this.musicTrack = track;
    this.refreshVolumes();
  }

  playStageMusic(stageId: StageId): void {
    this.playMusic(stageId === 'tutorial' ? 'menu' : stageId);
  }

  refreshVolumes(): void {
    if (!this.music) return;
    this.music.volume = Math.min(
      1,
      runtimeState.save.settings.masterVolume * runtimeState.save.settings.musicVolume,
    );
    if (this.music.volume <= 0) this.music.pause();
    else this.resumeMusic();
  }

  private resumeMusic(): void {
    if (!this.music || this.music.volume <= 0 || !this.music.paused) return;
    void this.music.play().catch(() => {
      // Browsers block autoplay until the first pointer or keyboard interaction.
    });
  }
}

export const audio = new AudioManager();
