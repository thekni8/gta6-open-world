// HUD — health, cash, wanted stars, objective, speed, ammo, messages and the
// damage vignette. Plain DOM over the WebGL canvas, updated once a frame.
import { starsText } from '../police/wanted.js';

export function createHud() {
  const root = document.getElementById('hud');
  return {
    healthFill: document.getElementById('health-fill'),
    healthText: document.getElementById('health-text'),
    cash: document.getElementById('cash'),
    stars: document.getElementById('stars'),
    objective: document.getElementById('objective'),
    speed: document.getElementById('speed'),
    ammo: document.getElementById('ammo'),
    message: document.getElementById('message'),
    vignette: document.getElementById('vignette'),
    crosshair: document.getElementById('crosshair'),
    hint: document.getElementById('hint'),
    root,
  };
}

export function updateHud(hud, g) {
  const hp = Math.max(0, Math.round(g.player.health));
  hud.healthFill.style.width = `${hp}%`;
  hud.healthFill.style.background = hp > 50 ? '#3aa655' : hp > 25 ? '#e8a832' : '#c23b2e';
  hud.healthText.textContent = `${hp}`;
  hud.cash.textContent = `$${g.player.cash.toLocaleString('en-US')}`;
  hud.stars.textContent = starsText(g.wanted);
  hud.stars.style.color = g.wanted.stars > 0 ? '#ffd23e' : '#ffffff';
  hud.objective.textContent = g.objective;
  const kmh = Math.round(Math.abs(g.playerCar ? g.playerCar.speed : 0) * 3.6);
  hud.speed.textContent = g.inCar ? `${kmh} km/h` : '';
  hud.ammo.textContent = g.inCar ? '' : `🔫 ${g.combat.ammo} / ${g.combat.reserve}`;
  hud.message.textContent = g.mission.messageTimer > 0 ? g.mission.message : '';
  hud.message.style.opacity = g.mission.messageTimer > 0 ? '1' : '0';
  hud.vignette.style.opacity = hp < 100 ? String((100 - hp) / 160) : '0';
  hud.crosshair.style.display = g.inCar ? 'none' : 'block';
  // Context hint: what E does right now.
  let hint = '';
  if (!g.inCar && g.nearCar) hint = '[E] Steal car';
  else if (g.inCar) hint = '[E] Exit car · [Space] Handbrake';
  else if (g.nearMissionCar) hint = '[E] Take the coupe';
  hud.hint.textContent = hint;
}
