/* Wanted level: heat 0–500 maps to 0–5 stars. Crimes add heat;
   heat decays when no cop is close, faster in a lay-low zone
   (the parks and the marina). Stars drive police numbers. */
(function () {
  const CFG = MB.CFG;
  const CRIMES = {
    steal: CFG.stealHeat,
    hitPed: CFG.hitPedHeat,
    hitCar: 12,
    hitCop: CFG.hitCopHeat,
    shoot: CFG.shootHeat,
    killPed: CFG.killHeat,
    killCop: 150,
  };

  function starsForHeat(heat) {
    if (heat <= 0) return 0;
    return Math.min(CFG.wantedMax, Math.ceil(heat / CFG.heatPerStar));
  }

  function addCrime(kind) {
    const heat = CRIMES[kind] || 10;
    MB.S.heat = Math.min(CFG.wantedMax * CFG.heatPerStar, MB.S.heat + heat);
    const newStars = starsForHeat(MB.S.heat);
    if (newStars > MB.S.wanted) {
      MB.S.wanted = newStars;
      MB.HUD.toast(newStars >= 3 ? 'WANTED LEVEL ' + newStars + ' — roadblocks ahead!' : 'Wanted level ' + newStars);
      MB.Chase.syncPoliceCount();
    }
    MB.Wanted.lastCrimeT = MB.S.time;
  }

  function setWanted(stars) {
    MB.S.wanted = MB.Util.clamp(stars, 0, CFG.wantedMax);
    MB.S.heat = MB.S.wanted * CFG.heatPerStar;
    MB.Chase.syncPoliceCount();
  }

  function isHiding() {
    const p = MB.W.player;
    if (!p) return false;
    // Parks are lay-low zones: green blocks where heat bleeds off fast.
    const zone = MB.City.zoneAt(p.pos.x, p.pos.z);
    if (zone === 'THE MARINA') return true;
    const inPark =
      (Math.abs(p.pos.x - -150) < 22 && Math.abs(p.pos.z - 90) < 22) ||
      (Math.abs(p.pos.x - 90) < 22 && Math.abs(p.pos.z - -150) < 22) ||
      (Math.abs(p.pos.x - 150) < 22 && Math.abs(p.pos.z - 150) < 22);
    return inPark;
  }

  function copNearby(maxD) {
    const p = MB.W.player;
    if (!p) return false;
    for (let i = 0; i < MB.W.cops.length; i++) {
      if (MB.Util.dist2d(p.pos.x, p.pos.z, MB.W.cops[i].pos.x, MB.W.cops[i].pos.z) < maxD) return true;
    }
    return false;
  }

  function update(dt) {
    if (MB.S.wanted <= 0) return;
    // Heat only decays when the cops have lost sight of the player.
    if (!copNearby(55)) {
      MB.S.heat -= (isHiding() ? CFG.heatDecayHiding : CFG.heatDecayPerSec) * dt;
      if (MB.S.heat <= 0) {
        MB.S.heat = 0;
        MB.S.wanted = 0;
        MB.HUD.toast('You lost them. Stay clean, Kai.');
        MB.Chase.syncPoliceCount();
        MB.Missions.onWantedLost();
      } else {
        const s = starsForHeat(MB.S.heat);
        if (s < MB.S.wanted) { MB.S.wanted = s; MB.Chase.syncPoliceCount(); }
      }
    }
  }

  MB.Wanted = { addCrime: addCrime, setWanted: setWanted, update: update, starsForHeat: starsForHeat, lastCrimeT: -99 };
})();
