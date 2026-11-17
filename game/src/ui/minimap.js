// Minimap — a live top-down canvas: roads, the sea, the player arrow, cars,
// police blinkers, pedestrians and the gold mission marker.
import { CITY } from '../config.js';

export function createMinimap(canvas) {
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    size: canvas.width,
    big: false,
  };
}

function toMap(minimap, x, z) {
  const span = 700; // world units across the map
  const s = minimap.size / span;
  return [(x + span / 2) * s, (z + span / 2) * s];
}

export function drawMinimap(minimap, g) {
  const { ctx, size } = minimap;
  const s = size / 700;
  ctx.clearRect(0, 0, size, size);
  // Backing.
  ctx.fillStyle = 'rgba(20, 28, 38, 0.85)';
  ctx.fillRect(0, 0, size, size);
  // Sea (east) and sand.
  ctx.fillStyle = '#1f7f8f';
  ctx.fillRect((CITY.waterX + 350) * s, 0, size, size);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect((CITY.beachX + 350) * s, 0, (CITY.waterX - CITY.beachX) * s, size);
  // Roads.
  ctx.fillStyle = '#6a7078';
  for (const c of g.city.roadCenters) {
    ctx.fillRect((c - 7 + 350) * s, 0, 14 * s, size);
    ctx.fillRect(0, (c - 7 + 350) * s, size, 14 * s);
  }
  // Blocks.
  ctx.fillStyle = '#3d4654';
  for (const b of g.city.blockCenters) {
    for (const b2 of g.city.blockCenters) {
      ctx.fillRect((b - 30 + 350) * s, (b2 - 30 + 350) * s, 60 * s, 60 * s);
    }
  }
  // Mission marker (pulsing gold diamond).
  const target = g.missionTarget;
  if (target) {
    const [mx, mz] = toMap(minimap, target.x, target.z);
    const pulse = 6 + Math.sin(performance.now() * 0.006) * 2;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(mx, mz - pulse);
    ctx.lineTo(mx + pulse, mz);
    ctx.lineTo(mx, mz + pulse);
    ctx.lineTo(mx - pulse, mz);
    ctx.closePath();
    ctx.fill();
  }
  // Pedestrians (tiny white dots).
  ctx.fillStyle = '#ffffff';
  for (const ped of g.peds) {
    if (ped.dead) continue;
    const [px, pz] = toMap(minimap, ped.pos.x, ped.pos.z);
    ctx.fillRect(px - 1, pz - 1, 2, 2);
  }
  // Traffic (grey squares) and the player's car (green).
  ctx.fillStyle = '#c8ccd2';
  for (const car of g.traffic) {
    if (car.health <= 0) continue;
    const [cx, cz] = toMap(minimap, car.pos.x, car.pos.z);
    ctx.fillRect(cx - 2, cz - 2, 4, 4);
  }
  // Police (flashing red/blue).
  const blink = Math.sin(performance.now() * 0.012) > 0;
  ctx.fillStyle = blink ? '#ff2222' : '#2266ff';
  for (const cop of g.police) {
    const [cx, cz] = toMap(minimap, cop.pos.x, cop.pos.z);
    ctx.beginPath();
    ctx.arc(cx, cz, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow (rotates with heading).
  const [px, pz] = toMap(minimap, g.player.pos.x, g.player.pos.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(g.inCar ? g.playerCar.heading : g.player.heading);
  ctx.fillStyle = '#3aa655';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Border.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
}
