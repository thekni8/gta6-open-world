// Police chase: patrol cars spawn on nearby roads, hunt the player with
// pursuit steering, ram to slow them down, and set roadblocks across the
// road ahead at 3+ stars. Flashing light bars, sirens handled by audio.
import { CFG } from '../config.js';
import { clamp } from '../util/random.js';
import { createCar } from '../vehicles/cars.js';

export function createChase(scene, city) {
  const cars = [];
  const roadblocks = [];
  let spawnT = 0;
  let blockT = 0;

  function spawnPoliceCar(nearX, nearZ) {
    const p = city.nearestStreetPoint(nearX, nearZ);
    // Spawn a block or two away so they arrive, not pop in on top of you.
    const dx = nearX - p.x, dz = nearZ - p.z;
    const off = 55;
    const sx = p.x + (dx >= 0 ? -off : off) * (Math.abs(dx) > Math.abs(dz) ? 1 : 0);
    const sz = p.z + (dz >= 0 ? -off : off) * (Math.abs(dx) > Math.abs(dz) ? 0 : 1);
    const car = createCar(scene, {
      type: 'police', color: 0xf2f2f2, role: 'police',
      x: sx, z: sz, heading: Math.atan2(nearX - sx, nearZ - sz),
    });
    car.pursuit = 0;
    cars.push(car);
    return car;
  }

  function spawnRoadblock(playerPos, playerHeading) {
    // Two police cars parked sideways across the road ahead of the player.
    const ahead = 34;
    const bx = playerPos.x + Math.sin(playerHeading) * ahead;
    const bz = playerPos.z + Math.cos(playerHeading) * ahead;
    const p = city.nearestStreetPoint(bx, bz);
    const side = playerHeading + Math.PI / 2;
    const made = [];
    for (const off of [-4.5, 4.5]) {
      const car = createCar(scene, {
        type: 'police', color: 0xf2f2f2, role: 'roadblock',
        x: p.x + Math.sin(side) * off, z: p.z + Math.cos(side) * off,
        heading: side,
      });
      car.blockT = 0;
      roadblocks.push(car);
      made.push(car);
    }
    return made;
  }

  function removeCar(car) {
    scene.remove(car.group);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    const j = roadblocks.indexOf(car);
    if (j >= 0) roadblocks.splice(j, 1);
  }

  return {
    cars,
    roadblocks,
    all() { return cars.concat(roadblocks); },
    clearAll() {
      for (const c of [...cars, ...roadblocks]) removeCar(c);
    },
    spawnPoliceCar,
    spawnRoadblock,
    nearestDist(x, z) {
      let best = Infinity;
      for (const c of cars) best = Math.min(best, Math.hypot(c.x - x, c.z - z));
      return best;
    },
    update(dt, stars, playerPos, playerHeading, playerSpeed, time, onRam) {
      spawnT -= dt;
      blockT -= dt;
      const want = stars <= 0 ? 0 : stars <= 2 ? 1 : stars === 3 ? 2 : stars === 4 ? 3 : 4;
      // Spawn up to the wanted count; despawn the furthest when stars drop.
      if (cars.length < want && spawnT <= 0 && stars > 0) {
        spawnPoliceCar(playerPos.x, playerPos.z);
        spawnT = 1.2;
      }
      while (cars.length > want) {
        let far = cars[0], fd = -1;
        for (const c of cars) {
          const d = Math.hypot(c.x - playerPos.x, c.z - playerPos.z);
          if (d > fd) { fd = d; far = c; }
        }
        removeCar(far);
      }
      // Roadblocks at 3+ stars while the player is speeding in a car.
      if (stars >= 3 && Math.abs(playerSpeed) > 16 && blockT <= 0 && roadblocks.length < 2) {
        spawnRoadblock(playerPos, playerHeading);
        blockT = 22;
      }
      // Roadblock cars hold position for a while, then join the chase.
      for (const rb of [...roadblocks]) {
        rb.blockT += dt;
        if (rb.blockT > 18) {
          rb.role = 'police';
          roadblocks.splice(roadblocks.indexOf(rb), 1);
          cars.push(rb);
        }
      }
      // Pursuit steering: aim at the player's predicted position.
      const maxSpeed = 30 + stars * 3.2;
      for (const car of cars) {
        const px = playerPos.x + Math.sin(playerHeading) * playerSpeed * 0.5;
        const pz = playerPos.z + Math.cos(playerHeading) * playerSpeed * 0.5;
        const wantHeading = Math.atan2(px - car.x, pz - car.z);
        let d = wantHeading - car.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const dist = Math.hypot(px - car.x, pz - car.z);
        const targetSpeed = dist > 4 ? maxSpeed : 6;
        car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.4);
        car.heading += clamp(d, -2.4 * dt, 2.4 * dt);
        car.setHeading(car.heading);
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        const fixed = city.resolveCircle(nx, nz, CFG.carRadius);
        const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
        if (hitWall) {
          car.speed *= 0.3;
          car.heading += 0.9; // scrape off the wall and keep hunting
        }
        car.setPos(fixed.x, fixed.z);
        // Ram contact with the player.
        const pd = Math.hypot(car.x - playerPos.x, car.z - playerPos.z);
        if (pd < 4.4 && onRam) onRam(car, pd);
        for (const w of car.group.userData.wheels) w.rotation.x += (car.speed * dt) / 0.42;
      }
      // Flash the light bars.
      const phase = Math.floor(time * 6) % 2 === 0;
      for (const c of this.all()) {
        const bar = c.group.userData.lightBar;
        if (!bar) continue;
        bar.children[0].material.color.setHex(phase ? 0xff2020 : 0x701010);
        bar.children[1].material.color.setHex(phase ? 0x102070 : 0x2040ff);
      }
    },
  };
}
