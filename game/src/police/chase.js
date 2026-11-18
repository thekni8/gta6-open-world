/* Police chase AI: cruisers spawn at the map edge, hunt the player,
   ram to stop the car, and set roadblocks at 3+ stars. On foot, an
   officer gets out and chases on foot at close range. */
(function () {
  const CFG = MB.CFG;
  let roadblockTimer = 0;
  let spawnTimer = 0;

  function wantedToCount(stars) {
    return [0, 2, 3, 4, 5, 6][stars] || 0;
  }

  function spawnCop(nearPlayer) {
    const p = MB.W.player;
    const rng = MB.Random.makeRng((Math.random() * 1e9) | 0);
    let x, z;
    if (nearPlayer && p) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(45, 70);
      x = MB.Util.clamp(p.pos.x + Math.sin(a) * d, -225, 225);
      z = MB.Util.clamp(p.pos.z + Math.cos(a) * d, -225, 225);
      // Snap to the nearest road so the cruiser starts on tarmac.
      const lx = MB.City.nearestRoadLine(x), lz = MB.City.nearestRoadLine(z);
      if (Math.abs(x - lx) < Math.abs(z - lz)) x = lx; else z = lz;
    } else {
      const line = rng.pick(CFG.roadLines);
      x = rng.chance(0.5) ? line : rng.range(-220, 220);
      z = (x === line) ? rng.range(-220, 220) : line;
    }
    const car = MB.Cars.createCar(x, z, rng.range(0, Math.PI * 2), { police: true });
    car.ai = { kind: 'cop', state: 'chase', stuckT: 0, lastX: x, lastZ: z };
    car.speed = 10;
    MB.W.cops.push(car);
    return car;
  }

  function syncPoliceCount() {
    const want = wantedToCount(MB.S.wanted);
    while (MB.W.cops.length < want) spawnCop(true);
    while (MB.W.cops.length > want) {
      const c = MB.W.cops.pop();
      MB.W.scene.remove(c.mesh);
    }
  }

  function clearAll() {
    for (let i = 0; i < MB.W.cops.length; i++) MB.W.scene.remove(MB.W.cops[i].mesh);
    MB.W.cops.length = 0;
  }

  // Roadblock: two cruisers parked across the road ahead of the player.
  function placeRoadblock() {
    const p = MB.W.player;
    const car = MB.W.currentCar;
    if (!p) return;
    const heading = MB.S.inCar && car ? car.heading : p.heading;
    const ahead = 42;
    const cx = p.pos.x + Math.sin(heading) * ahead;
    const cz = p.pos.z + Math.cos(heading) * ahead;
    const px = Math.cos(heading), pz = -Math.sin(heading); // perpendicular
    [-4.5, 4.5].forEach(function (off, i) {
      const bx = MB.Util.clamp(cx + px * off, -225, 225);
      const bz = MB.Util.clamp(cz + pz * off, -225, 225);
      const cop = MB.Cars.createCar(bx, bz, heading + Math.PI / 2, { police: true });
      cop.ai = { kind: 'cop', state: 'block', blockT: 14 };
      MB.W.cops.push(cop);
    });
    MB.HUD.toast('ROADBLOCK AHEAD!');
  }

  function update(dt) {
    const p = MB.W.player;
    if (!p) return;
    const px = p.pos.x, pz = p.pos.z;
    // Roadblocks at 3+ stars, at most one every 25 seconds.
    roadblockTimer -= dt;
    if (MB.S.wanted >= 3 && roadblockTimer <= 0) {
      placeRoadblock();
      roadblockTimer = 25;
    }
    // Trickle-spawn replacements for wrecked cruisers.
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 3;
      const want = wantedToCount(MB.S.wanted);
      const active = MB.W.cops.filter(function (c) { return !c.dead; }).length;
      if (active < want) spawnCop(true);
    }
    for (let i = 0; i < MB.W.cops.length; i++) {
      const cop = MB.W.cops[i];
      MB.Cars.flashPoliceLights(cop, MB.S.time);
      if (cop.dead) { cop.speed = Math.max(0, cop.speed - 25 * dt); MB.Cars.syncMesh(cop, dt); continue; }
      const ai = cop.ai;
      if (!ai) continue;
      if (ai.state === 'block') {
        ai.blockT -= dt;
        cop.speed = 0;
        if (ai.blockT <= 0) ai.state = 'chase';
        MB.Cars.syncMesh(cop, dt);
        continue;
      }
      if (ai.state === 'cruise') {
        // Formation driving: straight ahead at a fixed speed, no hunting.
        // Used to stage chase shots; the cruiser joins the hunt if the
        // player gets far away.
        const dx = px - cop.pos.x, dz = pz - cop.pos.z;
        if (Math.hypot(dx, dz) > 60) ai.state = 'chase';
        cop.speed = ai.cruiseSpeed || 12;
        const nx = cop.pos.x + Math.sin(cop.heading) * cop.speed * dt;
        const nz = cop.pos.z + Math.cos(cop.heading) * cop.speed * dt;
        MB.Cars.collideCar(cop, nx, nz);
        MB.Cars.syncMesh(cop, dt);
        continue;
      }
      // Chase: steer toward the player, faster than traffic, rams on contact.
      const dx = px - cop.pos.x, dz = pz - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - cop.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      cop.heading += MB.Util.clamp(dh, -2.4 * dt, 2.4 * dt);
      const topSpeed = 30 + MB.S.wanted * 2.5;
      const target = dist > 6 ? topSpeed : 6;
      cop.speed = MB.Util.lerp(cop.speed, target, Math.min(1, dt * 1.8));
      const nx = cop.pos.x + Math.sin(cop.heading) * cop.speed * dt;
      const nz = cop.pos.z + Math.cos(cop.heading) * cop.speed * dt;
      const hit = MB.Cars.collideCar(cop, nx, nz);
      if (hit && cop.speed > 12) {
        cop.damage = Math.min(100, cop.damage + 6);
        MB.FX.sparks(cop.pos.x, 1, cop.pos.z);
        if (cop.damage >= 100) { cop.dead = true; MB.Wanted.addCrime('killCop'); }
      }
      // Stuck against a building? Reverse out and re-aim.
      if (Math.hypot(cop.pos.x - ai.lastX, cop.pos.z - ai.lastZ) < 0.5 && cop.speed > 5) {
        ai.stuckT += dt;
        if (ai.stuckT > 1.2) {
          cop.heading += Math.PI * 0.6;
          cop.pos.x -= Math.sin(cop.heading) * 4;
          cop.pos.z -= Math.cos(cop.heading) * 4;
          ai.stuckT = 0;
        }
      } else ai.stuckT = 0;
      ai.lastX = cop.pos.x; ai.lastZ = cop.pos.z;
      // Ram damage to the player's car, or a shove on foot.
      if (dist < 3.6) {
        if (MB.S.inCar && MB.W.currentCar) {
          MB.W.currentCar.damage = Math.min(100, MB.W.currentCar.damage + 12 * dt);
          MB.FX.shake(0.2);
        } else if (Math.random() < dt * 0.8) {
          MB.Character.damage(4);
          MB.HUD.toast('The cops are on you!');
        }
      }
      MB.Cars.syncMesh(cop, dt);
    }
  }

  MB.Chase = { syncPoliceCount: syncPoliceCount, clearAll: clearAll, spawnCop: spawnCop, update: update, placeRoadblock: placeRoadblock };
})();
