// The wanted system: crimes raise heat, heat sets the star count, and
// heat fades when the player is out of sight — faster inside a lay-low zone.

import { CONFIG } from '../config.js';

export const CRIME_HEAT = {
  stealCar: 25,
  hitPed: 30,
  hitCop: 40,
  shoot: 8,
  killPed: 50,
  killCop: 60,
  crashCop: 20,
};

const STAR_HEAT = [0, 15, 35, 55, 75, 90];

export class WantedSystem {
  constructor() {
    this.heat = 0;
    this.stars = 0;
    this.unseenTimer = 0;
    this.layLowZones = [
      { x: -34, z: -34, r: CONFIG.layLowRadius, name: 'HIDEOUT' },
      { x: 204, z: 204, r: 24, name: 'PARKING GARAGE' },
      { x: -204, z: -204, r: 24, name: 'OLD TOWN ALLEY' },
    ];
  }

  addCrime(type) {
    const gain = CRIME_HEAT[type] ?? 10;
    this.heat = Math.min(100, this.heat + gain);
    this.unseenTimer = 0;
    this.recompute();
  }

  setStars(n) {
    this.stars = Math.max(0, Math.min(CONFIG.maxWanted, n));
    this.heat = STAR_HEAT[this.stars] ?? 0;
  }

  recompute() {
    let stars = 0;
    for (let i = 1; i <= CONFIG.maxWanted; i++) {
      if (this.heat >= STAR_HEAT[i]) stars = i;
    }
    this.stars = stars;
  }

  inLayLowZone(x, z) {
    for (const zone of this.layLowZones) {
      if (Math.hypot(x - zone.x, z - zone.z) < zone.r) return zone;
    }
    return null;
  }

  // Call every frame. policeNear = a cruiser is within sight range.
  update(dt, playerPos, policeNear) {
    if (this.stars === 0) return;
    const zone = this.inLayLowZone(playerPos.x, playerPos.z);
    if (!policeNear || zone) {
      this.unseenTimer += dt * (zone ? 2.5 : 1);
      if (this.unseenTimer >= CONFIG.wantedDecaySeconds) {
        this.unseenTimer = 0;
        this.heat = Math.max(0, this.heat - 20);
        this.recompute();
      }
    } else {
      this.unseenTimer = 0;
    }
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.unseenTimer = 0;
  }
}

// Meridian Bay round 9 — witness touch
