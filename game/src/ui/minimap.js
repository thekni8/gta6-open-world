/* Live minimap (top-right, big and bright) and the full-city map
   overlay (M key). Green land, light streets, blue sea, sand beach,
   player arrow, objective diamond, police and enemies as dots. */
(function () {
  const CFG = MB.CFG;
  let cv = null, g = null, big = null, bigG = null;
  const SIZE = 220;

  function init() {
    cv = document.getElementById('minimap');
    g = cv.getContext('2d');
    big = document.getElementById('bigmap-canvas');
    bigG = big.getContext('2d');
  }

  // World (-240..240) -> map (0..SIZE).
  function wx(x) { return (x + CFG.worldHalf) / (CFG.worldHalf * 2) * SIZE; }
  function wz(z) { return (z + CFG.worldHalf) / (CFG.worldHalf * 2) * SIZE; }

  function drawBase(ctx, size, scale) {
    const s = scale || 1;
    // Land: bright green.
    ctx.fillStyle = '#69c24a';
    ctx.fillRect(0, 0, size, size);
    // Parks: darker green patches.
    ctx.fillStyle = '#4da336';
    [[-150, 90], [90, -150], [150, 150]].forEach(function (p) {
      ctx.fillRect(wx(p[0] - 22) * s, wz(p[1] - 22) * s, 44 / 480 * size * s, 44 / 480 * size * s);
    });
    // Port strip: concrete grey.
    ctx.fillStyle = '#9a938a';
    ctx.fillRect(0, 0, size, wz(CFG.portZ) * s);
    // Beach sand + sea (east edge).
    ctx.fillStyle = '#f2ddae';
    ctx.fillRect(wx(CFG.beachX) * s, 0, (wx(CFG.seaX) - wx(CFG.beachX)) * s, size);
    ctx.fillStyle = '#1fa8c9';
    ctx.fillRect(wx(CFG.seaX) * s, 0, size - wx(CFG.seaX) * s, size);
    // Streets: light grey grid, wide enough to read at a glance.
    ctx.strokeStyle = '#e8e4d8';
    ctx.lineWidth = 5 * s;
    CFG.roadLines.forEach(function (c) {
      ctx.beginPath(); ctx.moveTo(wx(c) * s, 0); ctx.lineTo(wx(c) * s, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, wz(c) * s); ctx.lineTo(size, wz(c) * s); ctx.stroke();
    });
    ctx.strokeStyle = '#2b2f36';
    ctx.lineWidth = 2.5 * s;
    CFG.roadLines.forEach(function (c) {
      ctx.beginPath(); ctx.moveTo(wx(c) * s, 0); ctx.lineTo(wx(c) * s, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, wz(c) * s); ctx.lineTo(size, wz(c) * s); ctx.stroke();
    });
  }

  function drawDiamond(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawPlayerArrow(ctx, x, y, heading, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)) + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#123';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11 * s); ctx.lineTo(8 * s, 8 * s); ctx.lineTo(0, 3 * s); ctx.lineTo(-8 * s, 8 * s);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function draw(ctx, size, isBig) {
    const s = size / SIZE;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    if (!isBig) {
      // Circular clip for the round minimap.
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    drawBase(ctx, size, s);
    const p = MB.W.player;
    // Mission objective diamond(s).
    const rt = MB.Missions.runtime();
    if (rt) {
      const step = rt.def.steps[rt.step];
      if (step && step.type === 'choose') {
        step.options.forEach(function (o) {
          drawDiamond(ctx, wx(o.x) * s, wz(o.z) * s, 9 * s, o.side === 'kings' ? '#2c6fd3' : '#a8231e');
        });
      } else {
        const pos = MB.Missions.objectivePos();
        if (pos) drawDiamond(ctx, wx(pos.x) * s, wz(pos.z) * s, 10 * s, '#ffc93c');
      }
    }
    // Police: flashing blue dots. Enemies: red dots. Traffic: white specks.
    MB.W.cops.forEach(function (c) {
      ctx.fillStyle = Math.floor(MB.S.time * 4) % 2 ? '#2244ff' : '#ff2222';
      ctx.beginPath(); ctx.arc(wx(c.pos.x) * s, wz(c.pos.z) * s, 4.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    });
    MB.W.enemies.forEach(function (e) {
      if (e.dead) return;
      ctx.fillStyle = '#d21f14';
      ctx.beginPath(); ctx.arc(wx(e.pos.x) * s, wz(e.pos.z) * s, 4.5 * s, 0, Math.PI * 2); ctx.fill();
    });
    MB.W.roadCars.forEach(function (c) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(wx(c.pos.x) * s - 1.5 * s, wz(c.pos.z) * s - 1.5 * s, 3 * s, 3 * s);
    });
    // Player arrow, big and centered on top.
    if (p) {
      const heading = MB.S.inCar && MB.W.currentCar ? MB.W.currentCar.heading : p.heading;
      drawPlayerArrow(ctx, wx(p.pos.x) * s, wz(p.pos.z) * s, heading, s);
    }
    ctx.restore();
    if (!isBig) {
      // North tick.
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(13 * s) + 'px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('N', size / 2, 15 * s);
    }
  }

  function update() {
    if (cv) draw(g, SIZE, false);
    const bigmap = document.getElementById('bigmap');
    if (bigmap && !bigmap.classList.contains('hidden')) draw(bigG, 640, true);
  }

  MB.Minimap = { init: init, update: update };
})();
