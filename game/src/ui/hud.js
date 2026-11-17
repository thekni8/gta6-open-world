// HUD: health bar, cash, wanted stars, mission objective, speed, ammo,
// timer, toasts and the damage vignette. Pure DOM — updated once per
// frame from the game state, never rebuilt.

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      healthFill: document.getElementById('health-fill'),
      healthNum: document.getElementById('health-num'),
      cash: document.getElementById('cash'),
      stars: document.getElementById('stars'),
      objective: document.getElementById('objective'),
      timer: document.getElementById('timer'),
      speed: document.getElementById('speed'),
      ammo: document.getElementById('ammo'),
      message: document.getElementById('message'),
      crosshair: document.getElementById('crosshair'),
      vignette: document.getElementById('vignette'),
    };
    this.messageTimer = null;
    this.lastStars = -1;
  }

  show() {
    this.el.hud.classList.remove('hidden');
  }

  hide() {
    this.el.hud.classList.add('hidden');
  }

  /** One frame of HUD state. */
  update(s) {
    this.el.healthFill.style.width = `${Math.max(0, s.health)}%`;
    this.el.healthFill.classList.toggle('low', s.health < 30);
    this.el.healthNum.textContent = Math.ceil(Math.max(0, s.health));
    this.el.cash.textContent = `$${s.cash.toLocaleString('en-US')}`;
    if (s.stars !== this.lastStars) {
      this.lastStars = s.stars;
      this.el.stars.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.className = i < s.stars ? 'star on' : 'star';
        this.el.stars.appendChild(star);
      }
    }
    this.el.objective.textContent = s.objective;
    if (s.timeLeft != null && s.timeLeft > 0) {
      const t = Math.ceil(s.timeLeft);
      this.el.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      this.el.timer.classList.toggle('urgent', t < 30);
    } else {
      this.el.timer.textContent = '';
    }
    this.el.speed.textContent = s.driving ? `${Math.round(Math.abs(s.speed) * 3.6)} km/h` : '';
    this.el.ammo.textContent = s.reloading ? 'RELOADING…' : `AMMO ${s.ammo}/12`;
    this.el.crosshair.classList.toggle('hidden', s.driving);
  }

  /** A toast line under the objective, fading after a few seconds. */
  toast(text, ms = 4200) {
    this.el.message.textContent = text;
    this.el.message.classList.remove('hidden');
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.el.message.classList.add('hidden'), ms);
  }

  /** Red flash at the screen edges when Kai takes a hit. */
  flashDamage() {
    this.el.vignette.classList.remove('flash');
    void this.el.vignette.offsetWidth; // restart the animation
    this.el.vignette.classList.add('flash');
  }
}
