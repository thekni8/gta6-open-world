// Save — localStorage. Mission progress, cash, completed missions and the
// player's position survive a reload; the wanted level never does.
import { SAVE_KEY } from '../config.js';

export function saveGame(g) {
  try {
    const data = {
      cash: g.player.cash,
      missionIndex: g.mission.index,
      completed: g.mission.completed,
      choice: g.mission.choice,
      x: g.player.pos.x,
      z: g.player.pos.z,
      health: g.player.health,
      ammo: g.combat.ammo,
      reserve: g.combat.reserve,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
