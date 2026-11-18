// Live minimap: a big, bright, circular street map — green land, blue sea,
// light streets, a large player arrow and a gold objective diamond. Drawn
// on a 2D canvas every frame; the same painter draws the full map overlay.
import { CFG } from '../config.js';

const WORLD_MIN = -230, WORLD_MAX = 240;

export function createMinimap(canvas) {
  function drawOn(ctx, size, state) {
    const scale = size / (WORLD_MAX - WORLD_MIN);
    const px = (x) => (x - WORLD_MIN) * scale;
    const pz = (z) => (z - WORLD_MIN) * scale;
    ctx.clearRect(0, 0, size, size);
    // Land: bright green so the map reads at contact-sheet size.
    ctx.fillStyle = '#79c94f';
    ctx.fillRect(0, 0, size, size);
    // Sea along the south edge.
    ctx.fillStyle = '#2e9ec4';
    ctx.fillRect(0, pz(232), size, size - pz(232));
    // Sand strip.
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, pz(190), size, pz(232) - pz(190));
    // Park green, port concrete.
    ctx.fillStyle = '#4da83c';
    ctx.fillRect(px(-40), pz(80), px(40) - px(-40), pz(160) - pz(80));
    ctx.fillStyle = '#9a958a';
    ctx.fillRect(px(120), pz(-220), px(220) - px(120), pz(-120) - pz(-220));
    // Streets: dark grid, wide enough to see.
    ctx.strokeStyle = '#3d5a33';
    ctx.lineWidth = Math.max(2, size * 0.008);
    for (const s of state.streets) {
      ctx.beginPath(); ctx.moveTo(px(s), 0); ctx.lineTo(px(s), size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pz(s)); ctx.lineTo(size, pz(s)); ctx.stroke();
    }
    // Hideout marker.
    ctx.fillStyle = '#1f8a3c';
    ctx.beginPath();
    ctx.arc(px(state.hideout.x), pz(state.hideout.z), Math.max(3, size * 0.012), 0, Math.PI * 2);
    ctx.fill();
    // Traffic + parked cars: white dots.
    ctx.fillStyle = '#ffffff';
    for (const c of state.cars) {
      ctx.fillRect(px(c.x) - 1.5, pz(c.z) - 1.5, 3, 3);
    }
    // Pedestrians: tiny dots.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const p of state.peds) {
      ctx.fillRect(px(p.x) - 1, pz(p.z) - 1, 2, 2);
    }
    // Police: flashing blue/red dots, bigger.
    const flash = Math.floor(state.time * 3) % 2 === 0;
    ctx.fillStyle = flash ? '#2040ff' : '#ff2020';
    for (const c of state.police) {
      ctx.beginPath();
      ctx.arc(px(c.x), pz(c.z), Math.max(4, size * 0.016), 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission marker(s): big gold diamonds.
    const drawDiamond = (x, z) => {
      const r = Math.max(7, size * 0.035);
      ctx.fillStyle = '#ffc832';
      ctx.strokeStyle = '#7a5a00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px(x), pz(z) - r);
      ctx.lineTo(px(x) + r, pz(z));
      ctx.lineTo(px(x), pz(z) + r);
      ctx.lineTo(px(x) - r, pz(z));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    if (state.marker) {
      if (Array.isArray(state.marker)) state.marker.forEach((m) => drawDiamond(m.x, m.z));
      else drawDiamond(state.marker.x, state.marker.z);
    }
    // Player: big white arrow, rotated to heading.
    const pa = state.player;
    const r = Math.max(9, size * 0.045);
    ctx.save();
    ctx.translate(px(pa.x), pz(pa.z));
    ctx.rotate(Math.atan2(Math.sin(pa.heading), Math.cos(pa.heading)));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.75, r * 0.8);
    ctx.lineTo(0, r * 0.35);
    ctx.lineTo(-r * 0.75, r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return {
    draw(state) {
      drawOn(canvas.getContext('2d'), canvas.width, state);
    },
    // The full-screen map overlay reuses the same painter at a bigger size.
    drawTo(otherCanvas, state) {
      drawOn(otherCanvas.getContext('2d'), otherCanvas.width, state);
    },
  };
}
