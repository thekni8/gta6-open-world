// Live minimap: a big, bright full-city view — green land, pale streets,
// blue sea — with the player arrow, objective diamond, police and traffic.
// The static city layer is pre-rendered once; only blips redraw per frame.
import { CONFIG } from '../config.js';

export class Minimap {
  constructor(canvas, city) {
    this.canvas = canvas;
    this.city = city;
    this.size = CONFIG.hud.minimapSize;
    canvas.width = this.size;
    canvas.height = this.size;
    this.ctx = canvas.getContext('2d');
    this.staticLayer = document.createElement('canvas');
    this.staticLayer.width = this.size;
    this.staticLayer.height = this.size;
    this._renderStatic();
  }

  // World (-240..240) -> map pixels. North (z=-240) is up.
  _toMap(x, z) {
    const s = this.size / (CONFIG.world.half * 2);
    return [(x + CONFIG.world.half) * s, (z + CONFIG.world.half) * s];
  }

  _renderStatic() {
    const ctx = this.staticLayer.getContext('2d');
    const s = this.size / (CONFIG.world.half * 2);
    // Land: bright fresh green, so the map reads at a glance.
    ctx.fillStyle = '#7cc45e';
    ctx.fillRect(0, 0, this.size, this.size);
    // Sea along the south edge.
    ctx.fillStyle = '#2fa8c9';
    ctx.fillRect(0, this._toMap(0, 240)[1], this.size, this.size);
    // Beach sand strip.
    ctx.fillStyle = '#f0dca8';
    const [, beachY] = this._toMap(0, 196);
    ctx.fillRect(0, beachY, this.size, this._toMap(0, 240)[1] - beachY);
    // Park: deeper green block.
    ctx.fillStyle = '#4da34d';
    const [px, py] = this._toMap(28, 84);
    ctx.fillRect(px, py, (140 - 28) * s, (168 - 84) * s);
    // Port strip: industrial grey-beige.
    ctx.fillStyle = '#b8a888';
    ctx.fillRect(0, this._toMap(0, -28)[1], ( -168 + 240) * s, (196 + 28) * s);
    // Blocks: pale sidewalk slabs between roads.
    ctx.fillStyle = '#d9d2bd';
    const lines = CONFIG.world.roadLines;
    const edges = [-240, ...lines.map((l) => l - 6)];
    const edges2 = [...lines.map((l) => l + 6), 240];
    for (let i = 0; i < edges.length; i++) {
      for (let j = 0; j < edges.length; j++) {
        const [bx, bz] = this._toMap(edges[i], edges[j]);
        ctx.fillRect(bx, bz, (edges2[i] - edges[i]) * s, (edges2[j] - edges[j]) * s);
      }
    }
    // Roads: bright pale strips over the blocks.
    ctx.fillStyle = '#f2efe4';
    for (const l of lines) {
      const [, ry] = this._toMap(0, l);
      ctx.fillRect(0, ry - 6 * s, this.size, 12 * s);
      const [rx] = this._toMap(l, 0);
      ctx.fillRect(rx - 6 * s, 0, 12 * s, this.size);
    }
    // Buildings: their real pastel colours, slightly darkened.
    for (const b of this.city.buildings) {
      const [bx, bz] = this._toMap(b.x - b.w / 2, b.z - b.d / 2);
      ctx.fillStyle = `#${b.color.toString(16).padStart(6, '0')}`;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(bx, bz, Math.max(1.5, b.w * s), Math.max(1.5, b.d * s));
    }
    ctx.globalAlpha = 1;
    // District labels, small but legible.
    ctx.fillStyle = 'rgba(20, 60, 20, 0.75)';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const labels = [
      ['DOWNTOWN', 0, 0], ['OLD TOWN', -160, -140], ['NORTHSIDE', 80, -160],
      ['BAYFRONT', 0, 215], ['PORT', -205, 80], ['MARINA', 210, 60], ['PARK', 84, 126],
    ];
    for (const [text, x, z] of labels) {
      const [lx, ly] = this._toMap(x, z);
      ctx.fillText(text, lx, ly);
    }
  }

  draw(game, t) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.drawImage(this.staticLayer, 0, 0);
    // Circular clip for the classic minimap look.
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(this.staticLayer, 0, 0);
    const player = game.player;

    // Traffic dots.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of game.traffic.cars) {
      const [x, y] = this._toMap(c.pos.x, c.pos.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Enemy dots.
    ctx.fillStyle = '#ff2222';
    for (const e of game.weapons.aliveEnemies()) {
      const [x, y] = this._toMap(e.pos.x, e.pos.z);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police: flashing blue/red dots.
    for (const cop of [...game.police.cars, ...game.police.roadblockCars]) {
      const [x, y] = this._toMap(cop.pos.x, cop.pos.z);
      ctx.fillStyle = Math.sin(t * 10) > 0 ? '#2244ff' : '#ff2222';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Objective diamond (pulsing).
    const step = game.missions.currentStep();
    const target = this._objectiveTarget(game, step);
    if (target) {
      const [x, y] = this._toMap(target.x, target.z);
      const r = 7 + Math.sin(t * 5) * 1.5;
      ctx.fillStyle = '#ffd23d';
      ctx.strokeStyle = '#7a5200';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Choice markers (mission 5).
    if (step?.type === 'choice') {
      for (const opt of step.options) {
        const [x, y] = this._toMap(opt.x, opt.z);
        ctx.fillStyle = `#${opt.color.toString(16).padStart(6, '0')}`;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();

    // Player arrow: big white triangle with a dark outline, rotated to face travel.
    const [px, py] = this._toMap(player.pos.x, player.pos.z);
    const heading = player.inCar && player.car ? player.car.angle + Math.PI : player.angle;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(7.5, 8);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-7.5, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // North tick.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', this.size / 2, 14);
  }

  _objectiveTarget(game, step) {
    if (!step) return null;
    if (step.type === 'goto' || step.type === 'gotoCar' || step.type === 'steal') {
      return { x: step.x, z: step.z };
    }
    if (step.type === 'eliminate') {
      const alive = game.weapons.aliveEnemies();
      if (alive.length > 0) return { x: alive[0].pos.x, z: alive[0].pos.z };
      const spawns = step.spawns || game.missions.active?.rivalSpawns;
      if (spawns?.length) return { x: spawns[0][0], z: spawns[0][1] };
    }
    if (step.type === 'loseHeat') return { x: 96, z: 130 }; // hideout
    return null;
  }
}
