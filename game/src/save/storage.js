// localStorage save: cash, mission progress, and where Kai was standing.
// The wanted level is never saved — a fresh session always starts clean,
// as the design brief requires.

import { CONFIG } from '../config.js';

export const Save = {
  load() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
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
      // Storage full or blocked — the game still plays, it just won't save.
      return false;
    }
  },

  clear() {
    try {
      localStorage.removeItem(CONFIG.saveKey);
    } catch {
      // Nothing to do: no storage, no save to clear.
    }
  },
};
