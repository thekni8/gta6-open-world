// Wanted level: 0–5 stars for crimes, with heat that bleeds off when the
// player stays out of police sight. The safehouse block is a lay-low zone
// where stars drop fast.

import { CONFIG } from '../config.js';
import { clamp } from '../util/random.js';

export class Wanted {
  constructor() {
    this.stars = 0;
    this.heat = 0; // 0..1 within the current star
    this.unseenTimer = 0;
    this.onChange = null; // (stars) => {}
  }

  addCrime(kind) {
    const gain = CONFIG.wanted[kind] ?? 1;
    const before = this.stars;
    this.stars = clamp(this.stars + gain, 0, CONFIG.wanted.maxStars);
    this.heat = 0.4;
    this.unseenTimer = 0;
    if (this.stars !== before) this.onChange?.(this.stars);
  }

  clear() {
    if (this.stars === 0) return;
    this.stars = 0;
    this.heat = 0;
    this.unseenTimer = 0;
    this.onChange?.(0);
  }

  /** Tick: decay when unseen, fast decay in the lay-low zone. */
  update(dt, policeCanSee, inLayLow) {
    if (this.stars === 0) return;
    if (policeCanSee) {
      this.unseenTimer = 0;
      this.heat = Math.min(1, this.heat + dt * 0.05);
    } else {
      this.unseenTimer += dt;
      const rate = inLayLow ? 2.5 : 1;
      if (this.unseenTimer > CONFIG.police.decaySeconds / rate) {
        this.stars -= 1;
        this.unseenTimer = 0;
        this.heat = 0;
        this.onChange?.(this.stars);
      }
    }
  }
}
