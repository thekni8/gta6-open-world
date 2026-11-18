// Wanted level: crimes add heat, heat bands map to 1–5 stars, and heat
// decays while the police can't see the player — fast inside the hideout.
import { CONFIG } from '../config.js';

export class Wanted {
  constructor() {
    this.heat = 0;
    this.stars = 0;
    this.lastCrimeAt = 0;
    this.seenTimer = 0;
    this.bustTimer = 0;
  }

  commit(crime, game) {
    const points = CONFIG.wanted[crime] || 10;
    this.heat = Math.min(150, this.heat + points);
    this.lastCrimeAt = game.time;
    this._recomputeStars(game);
  }

  _recomputeStars(game) {
    const bands = CONFIG.wanted.starBands;
    let stars = 0;
    for (let i = 1; i < bands.length; i++) {
      if (this.heat >= bands[i]) stars = i;
    }
    if (stars !== this.stars) {
      this.stars = stars;
      if (game) game.onWantedChange(stars);
    }
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.bustTimer = 0;
  }

  setStars(n, game) {
    const bands = CONFIG.wanted.starBands;
    this.heat = bands[Math.max(0, Math.min(5, n))];
    this._recomputeStars(game);
  }

  // Called every frame: decay heat, check bust, check "seen" state.
  update(dt, game) {
    const player = game.player;
    // Is any police car close enough to see the player?
    let seen = false;
    for (const cop of game.police.cars) {
      if (Math.hypot(cop.pos.x - player.pos.x, cop.pos.z - player.pos.z) < CONFIG.wanted.seenRadius) {
        seen = true;
        break;
      }
    }
    this.seenTimer = seen ? 2.5 : Math.max(0, this.seenTimer - dt);
    const effectivelySeen = seen || this.seenTimer > 0;

    if (this.stars > 0 && !effectivelySeen) {
      const inHideout = game.missions?.inHideout(player.pos.x, player.pos.z);
      this.heat -= (inHideout ? CONFIG.wanted.hideoutDecay : CONFIG.wanted.decayPerSecond) * dt;
      if (this.heat < 0) this.heat = 0;
      this._recomputeStars(game);
    }

    // Busted: a police car sits on top of a slow, on-foot player.
    if (this.stars > 0 && !player.inCar && !player.dead) {
      let touching = false;
      for (const cop of game.police.cars) {
        if (Math.hypot(cop.pos.x - player.pos.x, cop.pos.z - player.pos.z) < CONFIG.wanted.bustRadius) {
          touching = true;
          break;
        }
      }
      if (touching) {
        this.bustTimer += dt;
        if (this.bustTimer >= CONFIG.wanted.bustSeconds) {
          game.busted();
        }
      } else {
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = 0;
    }
  }
}
