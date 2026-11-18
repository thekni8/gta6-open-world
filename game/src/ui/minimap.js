// Live minimap: a pre-rendered static layer (roads, blocks, sea) with
// moving blips for the player, cars, police, peds and the mission marker.
// M opens the same map large.

import { CFG, LANDMARKS } from '../config.js';

const WORLD = 620; // world units across the map, centred on (0, 0)

export class Minimap {
  constructor(G) {
    this.G = G;
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.bigCanvas = document.getElementById('bigmap-canvas');
    this.bigCtx = this.bigCanvas ? this.bigCanvas.getContext('2d') : null;
    this.size = this.canvas.width;
    this.staticLayer = this.renderStatic(this.size);
    this.bigStatic = this.bigCanvas ? this.renderStatic(this.bigCanvas.width) : null;
    this.pulse = 0;
  }

  worldToMap(x, z, size) {
    return [
      ((x + WORLD / 2) / WORLD) * size,
      ((z + WORLD / 2) / WORLD) * size,
    ];
  }

  renderStatic(size) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const s = size / WORLD;
    // Land.
    g.fillStyle = '#8fae7e';
    g.fillRect(0, 0, size, size);
    // City slab.
    g.fillStyle = '#b5ad9c';
    g.fillRect((30) * s, (30) * s, 560 * s, 560 * s);
    // Sea + sand (south edge).
    g.fillStyle = '#2e8fa3';
    g.fillRect(0, (CFG.seaStart + 310) * s, size, size);
    g.fillStyle = '#ead9a8';
    g.fillRect(0, (CFG.beachStart + 310) * s, size, (CFG.seaStart - CFG.beachStart) * s);
    // Roads.
    g.strokeStyle = '#3a3f45';
    g.lineWidth = Math.max(2, 14 * s);
    for (const r of CFG.roadCoords) {
      const p = (r + 310) * s;
      g.beginPath();
      g.moveTo(0, p);
      g.lineTo(size, p);
      g.stroke();
      g.beginPath();
      g.moveTo(p, 0);
      g.lineTo(p, size);
      g.stroke();
    }
    // Buildings as darker blocks.
    g.fillStyle = '#9a938a';
    for (const b of this.G.city.colliders) {
      const w = b.maxX - b.minX;
      const d = b.maxZ - b.minZ;
      if (w < 4 || d < 4) continue;
      g.fillRect((b.minX + 310) * s, (b.minZ + 310) * s, w * s, d * s);
    }
    return c;
  }

  draw(ctx, staticLayer, size, big) {
    const G = this.G;
    this.pulse += 0.06;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    if (!big) {
      // Circular minimap with a dark rim.
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(staticLayer, 0, 0);
    const dot = (x, z, r, color) => {
      const [mx, my] = this.worldToMap(x, z, size);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const label = (x, z, text, color) => {
      const [mx, my] = this.worldToMap(x, z, size);
      ctx.fillStyle = color;
      ctx.font = `bold ${big ? 13 : 9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(text, mx, my - (big ? 8 : 6));
    };
    // Fixed landmarks.
    dot(LANDMARKS.safehouse.x, LANDMARKS.safehouse.z, big ? 5 : 3, '#2ecc71');
    label(LANDMARKS.safehouse.x, LANDMARKS.safehouse.z, 'HOME', '#2ecc71');
    dot(LANDMARKS.sprayShop.x, LANDMARKS.sprayShop.z, big ? 5 : 3, '#9b59b6');
    label(LANDMARKS.sprayShop.x, LANDMARKS.sprayShop.z, 'SPRAY', '#9b59b6');
    dot(LANDMARKS.garage.x, LANDMARKS.garage.z, big ? 5 : 3, '#1abc9c');
    // Pedestrians and traffic, small and dim.
    for (const p of G.peds.list) dot(p.x, p.z, big ? 2 : 1.2, '#dddddd');
    for (const car of G.traffic.cars) {
      if (!car.dead) dot(car.x, car.z, big ? 2.5 : 1.6, '#f1c40f');
    }
    for (const car of G.parkedCars) {
      if (!car.dead) dot(car.x, car.z, big ? 2.5 : 1.6, '#f39c12');
    }
    // Police flash blue/red.
    const policeColor = Math.floor(this.pulse * 2) % 2 === 0 ? '#3498db' : '#e74c3c';
    for (const car of G.police.cars) {
      if (!car.dead) dot(car.x, car.z, big ? 4 : 2.6, policeColor);
    }
    // Enemies show red.
    for (const e of G.combat.enemies) {
      if (!e.dead) dot(e.x, e.z, big ? 3.5 : 2.2, '#ff3333');
    }
    // Mission target: pulsing yellow diamond.
    const target = G.missions.targetPos;
    if (target) {
      const [mx, my] = this.worldToMap(target.x, target.z, size);
      const r = (big ? 9 : 6) + Math.sin(this.pulse * 2) * 1.5;
      ctx.fillStyle = '#ffd54a';
      ctx.strokeStyle = '#00000088';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, my - r);
      ctx.lineTo(mx + r, my);
      ctx.lineTo(mx, my + r);
      ctx.lineTo(mx - r, my);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Player: white arrow pointing along the heading.
    const player = G.player;
    const heading = player.inCar ? player.inCar.heading : player.heading;
    const [px, py] = this.worldToMap(player.x, player.z, size);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - heading);
    const a = big ? 9 : 6;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -a);
    ctx.lineTo(a * 0.7, a * 0.7);
    ctx.lineTo(0, a * 0.3);
    ctx.lineTo(-a * 0.7, a * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    if (!big) {
      ctx.strokeStyle = '#ffffff55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  update() {
    this.draw(this.ctx, this.staticLayer, this.size, false);
    if (this.bigCtx && this.G.bigMapOpen) {
      this.draw(this.bigCtx, this.bigStatic, this.bigCanvas.width, true);
    }
  }
}
