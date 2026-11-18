// Wanted level: crimes add heat, heat maps to 1–5 stars, and heat cools off
// when the player stays out of sight. Getting caught on foot builds the
// busted meter; the spray shop clears the heat outright.

import { CFG, LANDMARKS } from '../config.js';
import { clamp } from '../util/random.js';

export class Wanted {
  constructor(G) {
    this.G = G;
    this.heat = 0;
    this.lastCrimeAt = -99;
    this.lastSeenAt = -99;
    this.bustedProgress = 0;
    this.starsShown = 0;
    this.layLowTimer = 0;
  }

  get stars() {
    let s = 0;
    for (const t of CFG.starThresholds) {
      if (this.heat >= t) s++;
    }
    return s;
  }

  get targetPoliceCount() {
    return CFG.policeTargetByStars[this.stars];
  }

  addCrime(type) {
    const amount = CFG.crimeHeat[type] ?? 10;
    if (amount === 0) return;
    const before = this.stars;
    this.heat = clamp(this.heat + amount, 0, 100);
    this.lastCrimeAt = this.G.time;
    if (this.stars > before) {
      this.G.hud.flashWanted();
      this.G.hud.toast(`Wanted level ${this.stars} — the Meridian PD is on you`);
      this.G.audio.sirenSting();
    }
  }

  setHeat(value) {
    this.heat = clamp(value, 0, 100);
    this.lastCrimeAt = this.G.time;
  }

  clear(reason) {
    if (this.stars > 0) {
      this.G.hud.toast(reason || 'You lost them. Heat is off.');
    }
    this.heat = 0;
    this.bustedProgress = 0;
  }

  // True while any police car can plausibly see the player.
  policeCanSeePlayer() {
    const G = this.G;
    for (const car of G.police.cars) {
      if (car.dead) continue;
      if (Math.hypot(car.x - G.player.x, car.z - G.player.z) < 55) return true;
    }
    return false;
  }

  update(dt) {
    const G = this.G;
    // Heat decay: only when unseen and no fresh crime.
    if (this.policeCanSeePlayer()) {
      this.lastSeenAt = G.time;
    }
    const quietFor = G.time - Math.max(this.lastCrimeAt, this.lastSeenAt);
    if (this.heat > 0 && quietFor > CFG.heatDecayDelay) {
      this.heat = Math.max(0, this.heat - CFG.heatDecayPerSecond * dt);
    }
    // Lay-low zone: sit in the spray shop and the heat bleeds off fast.
    const spray = LANDMARKS.sprayShop;
    const dSpray = Math.hypot(G.player.x - spray.x, G.player.z - spray.z);
    const playerCar = G.player.inCar;
    const slow = playerCar ? Math.abs(playerCar.speed) < 2 : G.player.speed < 1;
    if (dSpray < 14 && slow && this.heat > 0) {
      this.layLowTimer += dt;
      this.heat = Math.max(0, this.heat - 26 * dt);
      if (this.layLowTimer > 0.5) {
        G.hud.setLayLow(this.heat > 0);
      }
      if (this.heat === 0) {
        G.hud.setLayLow(false);
        G.hud.toast('Clean. The spray shop worked its magic.');
      }
    } else {
      this.layLowTimer = 0;
      G.hud.setLayLow(false);
    }
    // Busted: on foot, a cop car parked on top of you, not moving.
    if (this.stars > 0 && !playerCar && !G.player.dead) {
      let nearest = 999;
      for (const car of G.police.cars) {
        if (car.dead) continue;
        nearest = Math.min(nearest, Math.hypot(car.x - G.player.x, car.z - G.player.z));
      }
      if (nearest < CFG.bustedRange && G.player.speed < 1.5) {
        this.bustedProgress += dt / CFG.bustedSeconds;
        G.hud.setBusted(this.bustedProgress);
        if (this.bustedProgress >= 1) {
          this.bustedProgress = 0;
          G.hud.setBusted(0);
          G.onPlayerBusted();
        }
      } else {
        this.bustedProgress = Math.max(0, this.bustedProgress - dt * 0.5);
        G.hud.setBusted(this.bustedProgress);
      }
    } else {
      this.bustedProgress = 0;
      G.hud.setBusted(0);
    }
    if (this.stars !== this.starsShown) {
      this.starsShown = this.stars;
      G.audio.setSiren(this.stars > 0);
    }
  }
}
