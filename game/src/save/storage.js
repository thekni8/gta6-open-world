// localStorage save / load. Keeps mission progress, cash, and the player's
// last position so Continue drops the player back into Meridian Bay.

const KEY = 'meridian-bay-save-v1';

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      missionIndex: data.missionIndex ?? 0,
      cash: data.cash ?? 0,
      hp: data.hp ?? 100,
      ammo: data.ammo ?? 12,
      reserveAmmo: data.reserveAmmo ?? 48,
      kills: data.kills ?? 0,
      position: data.position ?? null,
      savedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable; nothing to clear.
  }
}
