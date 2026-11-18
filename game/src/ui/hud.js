/* HUD: health, cash, wanted stars, mission banner + timer,
   speed, ammo, toasts, and the hurt vignette. */
(function () {
  let els = {};
  let toastTimer = null;
  let hurtTimer = null;

  function init() {
    const ids = ['hud', 'health-bar', 'health-num', 'cash', 'stars', 'mission-name', 'objective',
      'timer', 'zone-label', 'speed', 'speed-wrap', 'ammo', 'crosshair', 'vignette', 'toast',
      'wanted-flash', 'controls-hint'];
    ids.forEach(function (id) { els[id] = document.getElementById(id); });
  }

  function show() { els['hud'].classList.remove('hidden'); }
  function hide() { els['hud'].classList.add('hidden'); }

  function toast(text, ms) {
    els['toast'].textContent = text;
    els['toast'].style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els['toast'].style.opacity = '0'; }, ms || 2600);
  }

  function flashHurt() {
    els['vignette'].classList.add('hurt');
    if (hurtTimer) clearTimeout(hurtTimer);
    hurtTimer = setTimeout(function () { els['vignette'].classList.remove('hurt'); }, 350);
  }

  function showIntro(def) {
    const idx = MB.S.missionIndex + 1;
    toast('MISSION ' + idx + ' · ' + def.name + ' — ' + def.intro, 4200);
  }

  function update() {
    const S = MB.S;
    els['health-bar'].style.width = S.health + '%';
    els['health-bar'].style.background = S.health > 50
      ? 'linear-gradient(90deg,#37e05a,#8cff6e)'
      : (S.health > 25 ? 'linear-gradient(90deg,#ffc93c,#ffe27a)' : 'linear-gradient(90deg,#ff3a2e,#ff7a6e)');
    els['health-num'].textContent = Math.round(S.health);
    els['cash'].textContent = '$' + S.cash.toLocaleString('en-US');
    const stars = els['stars'].children;
    for (let i = 0; i < stars.length; i++) stars[i].classList.toggle('lit', i < S.wanted);
    els['wanted-flash'].classList.toggle('on', S.wanted >= 3);
    const rt = MB.Missions.runtime();
    if (rt) {
      els['mission-name'].textContent = 'MISSION ' + (rt.index + 1) + ' · ' + rt.def.name;
      els['objective'].textContent = MB.Missions.objectiveText();
      els['timer'].textContent = MB.Util.fmtTime(rt.timer);
      els['timer'].classList.toggle('low', rt.timer < 30);
      els['timer'].style.display = '';
      els['mission-name'].style.display = '';
    } else if (S.freeRoam) {
      els['mission-name'].textContent = 'FREE ROAM';
      els['objective'].textContent = 'Free roam — explore Meridian Bay';
      els['timer'].style.display = 'none';
    } else {
      els['mission-name'].textContent = 'MERIDIAN BAY';
      els['objective'].textContent = 'Story complete — the city is yours';
      els['timer'].style.display = 'none';
    }
    els['zone-label'].textContent = S.zone;
    els['speed-wrap'].style.display = S.inCar ? '' : 'none';
    els['speed'].textContent = S.speedKmh;
    els['ammo'].textContent = 'AMMO ' + S.ammo + '/' + MB.CFG.pistolMag + ' · ' + S.reserveAmmo;
    els['crosshair'].style.display = S.inCar ? 'none' : '';
  }

  MB.HUD = { init: init, show: show, hide: hide, update: update, toast: toast, flashHurt: flashHurt, showIntro: showIntro };
})();
