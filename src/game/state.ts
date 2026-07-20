import { DEFAULT_SAVE, parseSave, type SaveData } from './core/persistence';

const STORAGE_KEY = 'hookline-rush-save-v2';
const LEGACY_STORAGE_KEY = 'hookline-rush-save-v1';

class RuntimeState {
  save: SaveData = DEFAULT_SAVE;

  load(): void {
    const storage = globalThis.localStorage;
    this.save = parseSave(storage?.getItem(STORAGE_KEY) ?? storage?.getItem(LEGACY_STORAGE_KEY) ?? null);
  }

  update(mutator: (save: SaveData) => SaveData): void {
    this.save = mutator(this.save);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.save));
    } catch {
      // Storage can be disabled; the current session should remain playable.
    }
  }
}

export const runtimeState = new RuntimeState();
