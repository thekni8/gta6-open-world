// The live minimap: a player-centered canvas showing roads, the sea and
// the port, traffic, pedestrians, police, the mission marker and the
// hideout. North-up, redrawn every frame.

import { ROAD_LINES } from '../world/city.js';

export class Minimap {
  constructor(canvasId, size = 220, range = 130) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.size = size;
    this.range = range; // world metres shown from the center to an edge
    this.canvas.width = size;
    this.canvas.height = size;
  }

  toMap(wx, wz, cx, cz) {
    const s = this.size / (this.range * 2);
    return {
      x: this.size / 2 + (wx - cx) * s,
      y: this.size / 2 + (wz - cz) * s,
    };
  }

  draw(state) {
    const { ctx, size } = this;
    const { playerX, playerZ, playerHeading, traffic, peds, police, marker, hideout, time } = state;
    ctx.clearRect(0, 0, size, size);

    // Land background.
    ctx.fillStyle = '#23282e';
    ctx.fillRect(0, 0, size, size);

    // Sea to the south, port concrete to the east.
    const seaTop = this.toMap(0, 340, playerX, playerZ).y;
    if (seaTop < size) {
      ctx.fillStyle = '#1f8fa8';
      ctx.fillRect(0, Math.max(0, seaTop), size, size - Math.max(0, seaTop));
    }
    const portLeft = this.toMap(300, 0, playerX, playerZ).x;
    if (portLeft < size) {
      ctx.fillStyle = '#4a4e54';
      ctx.fillRect(Math.max(0, portLeft), 0, size - Math.max(0, portLeft), size);
    }

    // Roads.
    ctx.strokeStyle = '#3d434b';
    ctx.lineWidth = Math.max(2, size / (this.range * 2) * 14);
    for (const line of ROAD_LINES) {
      const vx = this.toMap(line, 0, playerX, playerZ).x;
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx, size);
      ctx.stroke();
      const hz = this.toMap(0, line, playerX, playerZ).y;
      ctx.beginPath();
      ctx.moveTo(0, hz);
      ctx.lineTo(size, hz);
      ctx.stroke();
    }

    const dot = (wx, wz, r, color) => {
      const p = this.toMap(wx, wz, playerX, playerZ);
      if (p.x < -4 || p.x > size + 4 || p.y < -4 || p.y > size + 4) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    for (const p of peds) dot(p.x, p.z, 1.6, '#9aa0a6');
    for (const t of traffic) dot(t.x, t.z, 2.6, '#4fb0c9');
    const policeColor = Math.floor(time * 3) % 2 === 0 ? '#ff4040' : '#4080ff';
    for (const p of police) dot(p.x, p.z, 3.2, policeColor);

    // Hideout marker (yellow house diamond), clamped to the edge when far.
    if (hideout) {
      const raw = this.toMap(hideout.x, hideout.z, playerX, playerZ);
      {
        const p = {
          x: Math.max(8, Math.min(size - 8, raw.x)),
          y: Math.max(8, Math.min(size - 8, raw.y)),
        };
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 6);
        ctx.lineTo(p.x + 5, p.y);
        ctx.lineTo(p.x, p.y + 6);
        ctx.lineTo(p.x - 5, p.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#23282e';
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
    }

    // Mission marker: pulsing yellow waypoint, clamped to the edge.
    if (marker) {
      const drawMarker = (mx, mz) => {
        let p = this.toMap(mx, mz, playerX, playerZ);
        const edge = p.x < 8 || p.x > size - 8 || p.y < 8 || p.y > size - 8;
        p = {
          x: Math.max(8, Math.min(size - 8, p.x)),
          y: Math.max(8, Math.min(size - 8, p.y)),
        };
        const pulse = 5 + Math.sin(time * 4) * 1.5;
        ctx.fillStyle = edge ? '#ffd23f' : '#ffe066';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - pulse);
        ctx.lineTo(p.x + pulse, p.y);
        ctx.lineTo(p.x, p.y + pulse);
        ctx.lineTo(p.x - pulse, p.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#23282e';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      };
      drawMarker(marker.x, marker.z);
      if (marker.second) drawMarker(marker.second.x, marker.second.z);
    }

    // Player: white arrow, rotated by heading (map north is -z, so +PI).
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(playerHeading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#23282e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Border ring.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
  }
}

// Meridian Bay round 9 — witness touch
