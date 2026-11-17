// Live minimap: a 2D canvas top-down view of Meridian Bay — roads, the
// sea, the player arrow, traffic dots, flashing police dots, and the
// mission marker. M toggles a large overlay map.

import { CONFIG } from '../config.js';

export class Minimap {
  constructor(canvas, city) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.city = city;
    this.size = canvas.width;
    this.half = 330; // world units shown from centre to edge
  }

  worldToMap(x, z) {
    const s = this.size / (this.half * 2);
    return [this.size / 2 + x * s, this.size / 2 + z * s];
  }

  /** Draw one frame from the live game state. */
  draw(s) {
    const g = this.ctx;
    const size = this.size;
    g.clearRect(0, 0, size, size);
    // Sea + land.
    g.fillStyle = '#1f6f7c';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#5d7a4a';
    const [bx] = this.worldToMap(-262, 0);
    g.fillRect(bx, 0, size - bx, size);
    // Roads.
    g.strokeStyle = '#3a3f46';
    g.lineWidth = 5;
    for (const c of this.city.roadCoords) {
      const [x] = this.worldToMap(c, 0);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, size); g.stroke();
      const [, z] = this.worldToMap(0, c);
      g.beginPath(); g.moveTo(0, z); g.lineTo(size, z); g.stroke();
    }
    // Safehouse zone.
    const sh = this.city.landmarks.safehouse;
    const [shx, shy] = this.worldToMap(sh.x, sh.z);
    g.fillStyle = 'rgba(80,200,120,0.5)';
    g.beginPath(); g.arc(shx, shy, 7, 0, Math.PI * 2); g.fill();
    // Mission marker (pulsing gold diamond).
    if (s.marker) {
      const [mx, my] = this.worldToMap(s.marker.x, s.marker.z);
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.moveTo(mx, my - pulse); g.lineTo(mx + pulse, my); g.lineTo(mx, my + pulse); g.lineTo(mx - pulse, my);
      g.closePath(); g.fill();
      g.strokeStyle = '#7a5a00';
      g.lineWidth = 1.5;
      g.stroke();
    }
    // Choice markers (Harbor gold, Vesper purple).
    if (s.choiceMarkers) {
      for (const [key, color] of [['harbor', '#ffd23f'], ['vesper', '#b45fd9']]) {
        const m = s.choiceMarkers[key];
        const [mx, my] = this.worldToMap(m.x, m.z);
        g.fillStyle = color;
        g.beginPath(); g.arc(mx, my, 6, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#111';
        g.stroke();
      }
    }
    // Traffic dots.
    g.fillStyle = '#e8e8e8';
    for (const c of s.traffic) {
      const [tx, ty] = this.worldToMap(c.x, c.z);
      g.fillRect(tx - 1.5, ty - 1.5, 3, 3);
    }
    // Police dots, flashing red/blue.
    const flashRed = Math.floor(performance.now() / 250) % 2 === 0;
    g.fillStyle = flashRed ? '#ff3030' : '#3060ff';
    for (const c of s.police) {
      const [px, py] = this.worldToMap(c.x, c.z);
      g.beginPath(); g.arc(px, py, 3, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    const [px, py] = this.worldToMap(s.player.x, s.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(s.playerHeading);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#111';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6);
    g.closePath(); g.fill(); g.stroke();
    g.restore();
    // North tick.
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px sans-serif';
    g.fillText('N', size - 14, 14);
  }
}
