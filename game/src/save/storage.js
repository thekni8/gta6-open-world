// localStorage save: mission progress, cash, and where Kai was standing.
// Wanted level is never saved — a fresh session starts clean, as the
// design brief requires.

import { CONFIG } from '../config.js';

export const Save = {
  load() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return null;
      return data;
    } catch {
      return null;
    }
  },

  write(data) {
    try {
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },

  clear() {
    try {
      localStorage.removeItem(CONFIG.saveKey);
    } catch {
      // Storage unavailable — the game still plays, it just won't save.
    }
  },
};
