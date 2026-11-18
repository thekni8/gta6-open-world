// HUD: health, cash, wanted stars, objective + countdown timer, speed,
// ammo, zone label, toasts, and the mission complete/failed overlays.
// Everything stays big and high-contrast for contact-sheet legibility.
export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of [
      'hud', 'health-fill', 'health-text', 'cash', 'stars', 'objective-title',
      'objective-text', 'objective-timer', 'speed', 'speed-value', 'ammo',
      'ammo-value', 'controls-hint', 'zone-label', 'toast', 'toast-title',
      'toast-body', 'crosshair', 'damage-flash', 'mission-overlay',
      'mission-overlay-title', 'mission-overlay-body', 'mission-overlay-btn',
      'busted-overlay', 'wasted-overlay', 'interact-prompt', 'hit-layer',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.zoneTimer = 0;
    this.toastTimer = 0;
    this.lastZone = '';
    this.el['mission-overlay-btn']?.addEventListener('click', () => {
      this.game.sound.ensure();
      this.game.sound.uiClick();
      this.hideMissionOverlay();
      this.game.resumeAfterMissionEnd();
    });
  }

  showToast(title, body, seconds = 5) {
    this.el['toast-title'].textContent = title;
    this.el['toast-body'].textContent = body;
    this.el.toast.classList.add('visible');
    this.toastTimer = seconds;
  }

  hideToast() {
    this.toastTimer = 0;
    this.el.toast.classList.remove('visible');
  }

  // Floating "-34" damage number near the crosshair.
  showDamageNumber(amount) {
    const layer = this.el['hit-layer'];
    if (!layer) return;
    const div = document.createElement('div');
    div.className = 'hit-number';
    div.textContent = `-${amount}`;
    const ox = (Math.random() - 0.5) * 90;
    const oy = (Math.random() - 0.5) * 50 - 30;
    div.style.left = `calc(50% + ${ox}px)`;
    div.style.top = `calc(50% + ${oy}px)`;
    layer.appendChild(div);
    requestAnimationFrame(() => div.classList.add('fly'));
    setTimeout(() => div.remove(), 900);
  }

  showZone(name) {
    if (name === this.lastZone) return;
    this.lastZone = name;
    this.el['zone-label'].textContent = name;
    this.el['zone-label'].classList.add('visible');
    this.zoneTimer = 2.6;
  }

  showMissionComplete(def) {
    this.el['mission-overlay-title'].textContent = 'MISSION COMPLETE';
    this.el['mission-overlay-title'].style.color = '#7be382';
    this.el['mission-overlay-body'].innerHTML =
      `<strong>${def.title}</strong><br>${def.outro}<br><br>` +
      `<span class="reward">+$${def.reward.toLocaleString()}</span>`;
    this.el['mission-overlay-btn'].textContent = 'Continue';
    this.el['mission-overlay'].classList.add('visible');
  }

  showMissionFailed(def, reason) {
    this.el['mission-overlay-title'].textContent = 'MISSION FAILED';
    this.el['mission-overlay-title'].style.color = '#ff6b6b';
    this.el['mission-overlay-body'].innerHTML =
      `<strong>${def.title}</strong><br>${reason}<br><br>Press Continue to retry the mission.`;
    this.el['mission-overlay-btn'].textContent = 'Retry mission';
    this.el['mission-overlay'].classList.add('visible');
  }

  hideMissionOverlay() {
    this.el['mission-overlay'].classList.remove('visible');
  }

  showBusted() {
    this.el['busted-overlay'].classList.add('visible');
  }

  showWasted() {
    this.el['wasted-overlay'].classList.add('visible');
  }

  hideEndOverlays() {
    this.el['busted-overlay'].classList.remove('visible');
    this.el['wasted-overlay'].classList.remove('visible');
  }

  flashDamage() {
    const f = this.el['damage-flash'];
    f.classList.add('visible');
    setTimeout(() => f.classList.remove('visible'), 220);
  }

  formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    // Timers for transient labels.
    if (this.zoneTimer > 0) {
      this.zoneTimer -= dt;
      if (this.zoneTimer <= 0) this.el['zone-label'].classList.remove('visible');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('visible');
    }
    // Health.
    const hp = Math.max(0, Math.round(player.health));
    this.el['health-fill'].style.width = `${hp}%`;
    this.el['health-fill'].style.background = hp > 50 ? '#7be382' : hp > 25 ? '#ffd23d' : '#ff6b6b';
    this.el['health-text'].textContent = `${hp}`;
    // Cash.
    this.el.cash.textContent = `$${game.cash.toLocaleString()}`;
    // Wanted stars: 5 big stars, filled gold up to the current level.
    let starsHtml = '';
    for (let i = 0; i < 5; i++) {
      starsHtml += `<span class="star ${i < game.wanted.stars ? 'lit' : ''}">★</span>`;
    }
    this.el.stars.innerHTML = starsHtml;
    // Objective + timer (always visible during a mission).
    const mission = game.missions.active;
    if (mission) {
      this.el['objective-title'].textContent = `★ ${mission.def.title.toUpperCase()} — ${mission.def.giver}`;
      this.el['objective-text'].textContent = game.missions.objectiveText();
      this.el['objective-timer'].textContent = this.formatTime(mission.timeLeft);
      this.el['objective-timer'].classList.toggle('urgent', mission.timeLeft < 30);
      this.el['objective-timer'].style.display = 'block';
    } else {
      const next = game.missions.nextMission();
      this.el['objective-title'].textContent = next ? 'FREE ROAM' : 'STORY COMPLETE';
      this.el['objective-text'].textContent = next
        ? `Press M to start: ${next.title} ($${next.reward}) — or explore Meridian Bay`
        : 'You finished the story. Meridian Bay is yours — free roam forever.';
      this.el['objective-timer'].style.display = 'none';
    }
    // Speed + ammo.
    if (player.inCar && player.car) {
      this.el.speed.style.display = 'flex';
      this.el['speed-value'].textContent = `${Math.round(player.car.speedKmh())}`;
      this.el.ammo.style.display = 'none';
    } else {
      this.el.speed.style.display = 'none';
      this.el.ammo.style.display = 'flex';
      this.el['ammo-value'].textContent = `${player.ammo} / ${player.reserve}`;
    }
    // Crosshair only on foot while playing.
    this.el.crosshair.style.display = (!player.inCar && game.state === 'playing') ? 'block' : 'none';
    // Interaction prompt: [E] Enter car when a car is in reach on foot.
    const prompt = this.el['interact-prompt'];
    if (prompt) {
      const nearCar = !player.inCar && game.state === 'playing' && (
        game.traffic.nearestParked(player.pos.x, player.pos.z, 4.5)
        || game.traffic.nearestMoving(player.pos.x, player.pos.z, 4.5)
        || game.police.nearestCar(player.pos.x, player.pos.z, 4.5)
      );
      prompt.style.display = nearCar ? 'flex' : 'none';
    }
    // Zone label on district change.
    const zone = game.currentZone();
    this.showZone(zone);
  }
}
