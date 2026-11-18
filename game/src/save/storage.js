/* localStorage save / load: mission progress, cash, and player position.
   Saves automatically on mission complete, on pause, and every 20 seconds. */
(function () {
  function save() {
    try {
      const p = MB.W.player;
      const data = {
        v: 6,
        missionIndex: MB.S.missionIndex,
        cash: MB.S.cash,
        health: MB.S.health,
        pos: p ? [Math.round(p.pos.x), Math.round(p.pos.z)] : [0, 30],
        kills: MB.S.kills,
        carsStolen: MB.S.carsStolen,
      };
      localStorage.setItem(MB.CFG.saveKey, JSON.stringify(data));
    } catch (e) { /* storage unavailable (private mode) — game still runs */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(MB.CFG.saveKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== 6) return null;
      return data;
    } catch (e) { return null; }
  }
  function applySave(data) {
    if (!data) return;
    MB.S.missionIndex = data.missionIndex || 0;
    MB.S.cash = (typeof data.cash === 'number') ? data.cash : MB.CFG.startCash;
    MB.S.kills = data.kills || 0;
    MB.S.carsStolen = data.carsStolen || 0;
    if (data.pos && MB.W.player) {
      MB.W.player.pos.set(data.pos[0], 0, data.pos[1]);
    }
  }
  function clear() {
    try { localStorage.removeItem(MB.CFG.saveKey); } catch (e) {}
  }
  MB.Storage = { save: save, load: load, applySave: applySave, clear: clear };
})();
