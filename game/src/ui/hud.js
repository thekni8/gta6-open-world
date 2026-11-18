// HUD: health, cash, wanted stars, speed, objective, toasts, banners and
// the crosshair. All DOM — the 3D canvas stays clean for the game itself.

import { formatCash } from '../util/random.js';

export class HUD {
  constructor(G) {
    this.G = G;
    this.el = {};
    for (const id of [
      'hud', 'stars', 'cash', 'health-fill', 'health-text', 'speed', 'speed-value',
      'objective', 'objective-dist', 'location', 'ammo', 'toast', 'banner',
      'banner-title', 'banner-sub', 'crosshair', 'hitmarker', 'damage-vignette',
      'busted-meter', 'busted-fill', 'laylow', 'wanted-flash', 'help-hint',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.toastTimer = 0;
    this.bannerTimer = 0;
    this.lastStars = -1;
    this.lastCash = -1;
    this.lastObjective = '';
    this.locationShown = '';
    this.hintTimer = 14;
  }

  show() {
    this.el.hud.style.display = 'block';
  }

  hide() {
    this.el.hud.style.display = 'none';
  }

  toast(text) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('show');
    this.toastTimer = 4;
  }

  showBanner(title, sub) {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub || '';
    this.el.banner.classList.add('show');
    this.bannerTimer = 6;
  }

  hideBanner() {
    this.el.banner.classList.remove('show');
    this.bannerTimer = 0;
  }

  setObjective(text) {
    this.lastObjective = text;
    this.el.objective.textContent = text;
  }

  setAmmo(n, reloading) {
    this.el.ammo.textContent = reloading ? 'RELOADING…' : `AMMO ${n} / 12`;
    this.el.ammo.style.display = this.G.player.inCar ? 'none' : 'block';
  }

  setLayLow(active) {
    this.el.laylow.style.display = active ? 'block' : 'none';
  }

  setBusted(p) {
    const m = this.el['busted-meter'];
    if (p > 0) {
      m.style.display = 'block';
      this.el['busted-fill'].style.width = `${Math.round(p * 100)}%`;
    } else {
      m.style.display = 'none';
    }
  }

  damageFlash() {
    const v = this.el['damage-vignette'];
    v.classList.remove('flash');
    void v.offsetWidth; // restart the CSS animation
    v.classList.add('flash');
  }

  flashWanted() {
    const f = this.el['wanted-flash'];
    f.classList.remove('flash');
    void f.offsetWidth;
    f.classList.add('flash');
  }

  kickCrosshair() {
    const c = this.el.crosshair;
    c.classList.remove('kick');
    void c.offsetWidth;
    c.classList.add('kick');
  }

  hitMarker() {
    const h = this.el.hitmarker;
    h.classList.remove('show');
    void h.offsetWidth;
    h.classList.add('show');
    setTimeout(() => h.classList.remove('show'), 180);
  }

  update(dt) {
    const G = this.G;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show');
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.classList.remove('show');
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.el['help-hint'].style.opacity = '0';
    }
    const player = G.player;
    const healthPct = Math.max(0, Math.round((player.health / player.maxHealth) * 100));
    this.el['health-fill'].style.width = `${healthPct}%`;
    this.el['health-fill'].className = 'health-fill' + (healthPct < 30 ? ' low' : '');
    this.el['health-text'].textContent = `${healthPct}`;
    if (G.save.cash !== this.lastCash) {
      this.lastCash = G.save.cash;
      this.el.cash.textContent = formatCash(G.save.cash);
    }
    const stars = G.wanted.stars;
    if (stars !== this.lastStars) {
      this.lastStars = stars;
      let s = '';
      for (let i = 0; i < 5; i++) s += i < stars ? '★' : '☆';
      this.el.stars.textContent = s;
      this.el.stars.className = 'stars' + (stars > 0 ? ' hot' : '');
    }
    const car = player.inCar;
    if (car) {
      this.el.speed.style.display = 'block';
      this.el['speed-value'].textContent = `${Math.round(Math.abs(car.speed) * 3.2)}`;
      this.el.crosshair.style.display = 'none';
    } else {
      this.el.speed.style.display = 'none';
      this.el.crosshair.style.display = 'block';
    }
    // Objective distance readout.
    const d = G.missions.distanceToTarget();
    this.el['objective-dist'].textContent = d === null ? '' : `${Math.round(d)}m`;
    // District name, only when it changes.
    const district = G.cityDistrict || '';
    if (district !== this.locationShown) {
      this.locationShown = district;
      this.el.location.textContent = district;
      this.el.location.classList.remove('pop');
      void this.el.location.offsetWidth;
      this.el.location.classList.add('pop');
    }
  }
}
