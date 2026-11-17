// Wanted level — the heat. Crimes add stars; staying out of sight and out of
// trouble lets them fade, twice as fast while laying low on the beach.
import { WANTED, POLICE_PER_STAR } from '../config.js';

export function createWanted() {
  return {
    stars: 0,
    quietTimer: 0, // seconds since the last crime
    seenTimer: 0, // seconds the police have had eyes on the player
    heat: 0, // 0..1, how "hot" the player is right now
  };
}

/** Add stars for a crime, capped at 5. Returns the new star count. */
export function addWanted(wanted, stars, reason) {
  wanted.stars = Math.min(WANTED.maxStars, wanted.stars + stars);
  wanted.quietTimer = 0;
  wanted.heat = 1;
  wanted.lastCrime = reason;
  return wanted.stars;
}

export function clearWanted(wanted) {
  wanted.stars = 0;
  wanted.quietTimer = 0;
  wanted.heat = 0;
}

/** Advance the wanted clock: decay stars after enough quiet time. */
export function updateWanted(wanted, dt, layingLow, policeSeePlayer) {
  if (wanted.stars === 0) {
    wanted.heat = Math.max(0, wanted.heat - dt);
    return;
  }
  if (policeSeePlayer) {
    wanted.quietTimer = 0;
    wanted.seenTimer += dt;
    wanted.heat = 1;
    return;
  }
  wanted.seenTimer = Math.max(0, wanted.seenTimer - dt * 2);
  wanted.quietTimer += dt * (layingLow ? WANTED.layLowMultiplier : 1);
  wanted.heat = Math.max(0, 1 - wanted.quietTimer / WANTED.decaySeconds);
  if (wanted.quietTimer >= WANTED.decaySeconds) {
    wanted.stars -= 1;
    wanted.quietTimer = 0;
  }
}

/** How many police cars the current heat calls for. */
export function policeWanted(wanted) {
  return POLICE_PER_STAR[wanted.stars];
}

/** Render stars as text for the HUD: ★★★☆☆ */
export function starsText(wanted) {
  return '★'.repeat(wanted.stars) + '☆'.repeat(WANTED.maxStars - wanted.stars);
}
