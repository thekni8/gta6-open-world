/* Traffic AI: cars cruise the road grid, turn at intersections,
   brake for the car ahead, and stop when the player blocks the road.
   Parked cars line the curbs for stealing. */
(function () {
  const CFG = MB.CFG;

  function spawnTraffic() {
    const rng = MB.Random.makeRng(4242);
    for (let i = 0; i < CFG.trafficCount; i++) {
      const vertical = rng.chance(0.5);
      const line = rng.pick(CFG.roadLines);
      const along = rng.range(-220, 220);
      const dir = rng.chance(0.5) ? 1 : -1;
      const x = vertical ? line + (dir > 0 ? 3.1 : -3.1) : along;
      const z = vertical ? along : line + (dir > 0 ? -3.1 : 3.1);
      const heading = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const car = MB.Cars.createCar(x, z, heading, { taxi: rng.chance(0.12) });
      car.ai = {
        kind: 'traffic',
        vertical: vertical,
        line: line,
        dir: dir,
        speed: CFG.trafficSpeed * rng.range(0.8, 1.15),
        wait: 0,
      };
      car.speed = car.ai.speed;
      MB.W.roadCars.push(car);
    }
    // Parked cars along curbs — the stealable fleet.
    for (let i = 0; i < 14; i++) {
      const line = rng.pick(CFG.roadLines);
      const along = rng.range(-200, 200);
      const side = rng.chance(0.5) ? 1 : -1;
      const vertical = rng.chance(0.5);
      const x = vertical ? line + side * 5.2 : along;
      const z = vertical ? along : line + side * 5.2;
      if (x > CFG.beachX - 4 || z < CFG.portZ + 4) continue;
      const car = MB.Cars.createCar(x, z, vertical ? 0 : Math.PI / 2, { parked: true });
      MB.W.roadCars.push(car);
    }
  }

  function carAhead(car, look) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let best = Infinity;
    const all = MB.W.roadCars.concat(MB.W.cops);
    for (let i = 0; i < all.length; i++) {
      const o = all[i];
      if (o === car) continue;
      const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < look && side < 2.4) best = Math.min(best, along);
    }
    // The player on foot also blocks traffic.
    if (!MB.S.inCar && MB.W.player) {
      const p = MB.W.player.pos;
      const dx = p.x - car.pos.x, dz = p.z - car.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < look && side < 2.2) best = Math.min(best, along);
    }
    return best;
  }

  function update(dt) {
    for (let i = 0; i < MB.W.roadCars.length; i++) {
      const car = MB.W.roadCars[i];
      const ai = car.ai;
      if (!ai || ai.kind !== 'traffic') continue;
      if (car.dead) { car.speed = Math.max(0, car.speed - 20 * dt); MB.Cars.syncMesh(car, dt); continue; }
      // Intersection? Maybe turn onto the cross street.
      const along = ai.vertical ? car.pos.z : car.pos.x;
      const nearest = MB.City.nearestRoadLine(along);
      if (Math.abs(along - nearest) < 1.2 && !ai.turnedAt && Math.random() < 0.35) {
        ai.turnedAt = nearest;
        const newDir = Math.random() < 0.5 ? 1 : -1;
        const wasVertical = ai.vertical;
        ai.vertical = !wasVertical;
        ai.dir = newDir;
        ai.line = nearest;
        car.heading = ai.vertical ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      if (ai.turnedAt !== undefined && Math.abs(along - ai.turnedAt) > 8) ai.turnedAt = undefined;
      // Brake for the car ahead.
      const gap = carAhead(car, 13);
      let target = ai.speed;
      if (gap < 13) target = gap < 5 ? 0 : ai.speed * (gap - 5) / 8;
      car.speed = MB.Util.lerp(car.speed, target, Math.min(1, dt * 2.5));
      // Stay glued to the lane.
      const laneOff = ai.dir > 0 ? 3.1 : -3.1;
      if (ai.vertical) car.pos.x = MB.Util.lerp(car.pos.x, ai.line + laneOff, Math.min(1, dt * 3));
      else car.pos.z = MB.Util.lerp(car.pos.z, ai.line - laneOff, Math.min(1, dt * 3));
      const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
      // Wrap around the map edge: recycle to the far side.
      if (nx > 232 || nx < -232 || nz > 232 || nz < -232) {
        car.pos.x = -car.pos.x * 0.96;
        car.pos.z = -car.pos.z * 0.96;
      } else {
        car.pos.x = nx; car.pos.z = nz;
      }
      MB.Cars.syncMesh(car, dt);
    }
  }

  MB.Traffic = { spawnTraffic: spawnTraffic, update: update };
})();
