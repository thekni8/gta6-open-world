// Wanted level: crimes add heat, heat maps to 1–5 stars, heat decays when
// the police lose sight of you — faster in the Harbor Park hideout. The
// chase module reads the star count to decide how hard to come at you.
import { CFG } from '../config.js';
import { clamp } from '../util/random.js';

export function createWanted(city) {
  let heat = 0;
  let lastCrimeT = 0;
  let time = 0;

  function stars() {
    if (heat <= 0) return 0;
    return clamp(Math.ceil(heat / CFG.heatPerStar), 1, 5);
  }

  return {
    get heat() { return heat; },
    stars,
    addHeat(amount, kind) {
      heat = clamp(heat + amount, 0, 100);
      lastCrimeT = time;
      return stars();
    },
    setStars(n) {
      heat = n <= 0 ? 0 : (n - 1) * CFG.heatPerStar + 8;
    },
    clear() { heat = 0; },
    update(dt, playerPos, policeNear) {
      time += dt;
      if (heat <= 0) return;
      // No eyes on you: heat bleeds off. The hideout bleeds it fast.
      const inHideout = Math.hypot(playerPos.x - city.hideout.x, playerPos.z - city.hideout.z) < 26;
      const grace = time - lastCrimeT > 4;
      if (grace && !policeNear) {
        heat = Math.max(0, heat - (inHideout ? CFG.heatDecayHideout : CFG.heatDecayFar) * dt);
      }
    },
  };
}
