// localStorage save/load: mission progress, cash, and where the player
// was standing. Small, versioned, and tolerant of corrupt data.
import { CONFIG } from '../config.js';

export function defaultSave() {
  return {
    version: 1,
    missionIndex: 0, // next mission to play (0..5; 5 = story complete)
    missionsDone: [],
    cash: 250,
    playerX: 0,
    playerZ: 40,
    savedAt: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return { ...defaultSave(), ...data };
  } catch {
    return null;
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(
      CONFIG.saveKey,
      JSON.stringify({ ...save, savedAt: Date.now() }),
    );
  } catch {
    /* storage full or blocked: the game still runs, it just won't persist */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(CONFIG.saveKey);
  } catch {
    /* ignore */
  }
}

export function hasSave() {
  return loadSave() !== null;
}
