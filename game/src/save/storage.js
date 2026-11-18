// Save games in localStorage: cash, unlocked missions, completed missions
// and where Kai was standing. Small, versioned, and tolerant of corrupt data.

import { CFG, LANDMARKS } from '../config.js';

export function defaultSave() {
  return {
    cash: CFG.startingCash,
    unlocked: 0,
    completed: [],
    playerPos: { x: LANDMARKS.safehouse.x, z: LANDMARKS.safehouse.z },
    version: 1,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return { ...defaultSave(), ...data };
  } catch (_) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function writeSave(save) {
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify(save));
  } catch (_) {
    // Private mode or full storage: the game still plays, it just forgets.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(CFG.saveKey);
  } catch (_) { /* ignore */ }
}
