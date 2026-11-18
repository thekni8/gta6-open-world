// HUD: health bar, cash, wanted stars, objective + countdown, speed,
// ammo, zone label, controls hint, damage flash, and the "press E" prompt.
// Everything a screenshot needs to read as a complete game, all at once.
import { fmtTime } from '../util/random.js';
import { districtAt } from '../config.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    root: $('hud'),
    healthFill: $('health-fill'),
    healthNum: $('health-num'),
    cash: $('cash'),
    stars: $('stars'),
    objective: $('objective-text'),
    timer: $('objective-timer'),
    zone: $('zone-label'),
    zoneBanner: $('zone-banner'),
    speed: $('speed'),
    speedNum: $('speed-num'),
    ammo: $('ammo'),
    ammoNum: $('ammo-num'),
    hint: $('controls-hint'),
    crosshair: $('crosshair'),
    prompt: $('prompt'),
    damage: $('damage-flash'),
    toast: $('toast'),
    missionTag: $('mission-tag'),
  };
  let lastZone = '';
  let zoneT = 0;
  let toastT = 0;
  let damageT = 0;

  function setStars(n) {
    let html = '';
    for (let i = 0; i < 5; i++) {
      html += `<span class="star ${i < n ? 'lit' : ''}">★</span>`;
    }
    el.stars.innerHTML = html;
  }
  setStars(0);

  return {
    show() { el.root.style.display = 'block'; },
    hide() { el.root.style.display = 'none'; },
    flashDamage() {
      damageT = 0.5;
      el.damage.style.opacity = '0.55';
    },
    toast(text, seconds = 3) {
      el.toast.textContent = text;
      el.toast.style.opacity = '1';
      toastT = seconds;
    },
    update(dt, s) {
      // Health / cash / stars (top-left).
      el.healthFill.style.width = Math.max(0, s.health) + '%';
      el.healthFill.className = 'fill ' + (s.health > 50 ? 'good' : s.health > 25 ? 'warn' : 'bad');
      el.healthNum.textContent = Math.round(s.health);
      el.cash.textContent = '$' + s.cash.toLocaleString('en-US');
      if (el.stars.dataset.n !== String(s.stars)) {
        el.stars.dataset.n = String(s.stars);
        setStars(s.stars);
      }
      // Objective + timer (top-center). A mission is always on screen.
      el.objective.textContent = s.objective;
      if (s.timeLeft > 0) {
        el.timer.textContent = fmtTime(s.timeLeft);
        el.timer.style.display = 'block';
        el.timer.classList.toggle('urgent', s.timeLeft < 30);
      } else {
        el.timer.style.display = 'none';
      }
      el.missionTag.textContent = s.missionTitle ? `MISSION ${s.missionIndex} · ${s.missionTitle}` : 'FREE ROAM';
      // Zone label + banner on change.
      const zone = districtAt(s.x, s.z);
      el.zone.textContent = zone;
      if (zone !== lastZone) {
        lastZone = zone;
        el.zoneBanner.textContent = zone;
        el.zoneBanner.style.opacity = '1';
        zoneT = 2.4;
      }
      if (zoneT > 0) {
        zoneT -= dt;
        if (zoneT <= 0) el.zoneBanner.style.opacity = '0';
      }
      // Speed (bottom-right, driving only) + ammo (always).
      if (s.driving) {
        el.speed.style.display = 'block';
        el.speedNum.textContent = s.speedKmh;
      } else {
        el.speed.style.display = 'none';
      }
      el.ammoNum.textContent = s.reloading ? 'RELOADING…' : `${s.ammo}/${s.mag}`;
      el.crosshair.style.display = s.driving ? 'none' : 'block';
      // Context prompt ("E — Enter car" / "E — Steal car").
      if (s.prompt) {
        el.prompt.textContent = s.prompt;
        el.prompt.style.display = 'block';
      } else {
        el.prompt.style.display = 'none';
      }
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0) el.toast.style.opacity = '0';
      }
      if (damageT > 0) {
        damageT -= dt;
        el.damage.style.opacity = String(Math.max(0, damageT) * 1.1);
      }
    },
  };
}
