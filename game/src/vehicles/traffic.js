// Traffic: cars that drive the street grid in lanes, turn at intersections,
// slow for the car ahead, and stop for the player in the way. Parked cars
// (stealable) are spawned here too — the city needs something to steal.
import { CFG } from '../config.js';
import { makeRng, clamp } from '../util/random.js';
import { createCar } from './cars.js';

export function createTraffic(scene, city, rngSeed = 777) {
  const rng = makeRng(rngSeed);
  const cars = [];
  const parked = [];

  function spawnTrafficCar() {
    const p = city.randomRoadPoint(rng);
    const vertical = Math.abs(p.x % 40) < 1 || rng.chance(0.5);
    const type = rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sports']);
    const car = createCar(scene, {
      type, color: rng.pick(CFG.carColors), role: 'traffic',
      x: p.x, z: p.z, heading: 0,
    });
    const alongX = rng.chance(0.5);
    const dir = rng.sign();
    car.lane = { alongX, dir, street: alongX ? p.z : p.x };
    car.cruise = CFG.trafficSpeed * rng.range(0.8, 1.15);
    car.wait = 0;
    // Snap onto the lane: offset 3.5 to the right of travel.
    if (alongX) {
      car.setPos(p.x, car.lane.street + (dir > 0 ? 3.5 : -3.5) * -1);
      car.setHeading(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      car.setPos(car.lane.street + (dir > 0 ? -3.5 : 3.5), p.z);
      car.setHeading(dir > 0 ? 0 : Math.PI);
    }
    cars.push(car);
    return car;
  }

  for (let i = 0; i < CFG.trafficCount; i++) spawnTrafficCar();

  // Parked cars along curbs — the player's first ride is always nearby.
  for (let i = 0; i < 12; i++) {
    const p = city.randomRoadPoint(rng);
    const alongX = rng.chance(0.5);
    const car = createCar(scene, {
      type: rng.pick(['sedan', 'sedan', 'sports', 'taxi']),
      color: rng.pick(CFG.carColors), role: 'parked',
      x: 0, z: 0,
    });
    if (alongX) {
      car.setPos(p.x, Math.round(p.z / 40) * 40 + rng.pick([-5.6, 5.6]));
      car.setHeading(rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    } else {
      car.setPos(Math.round(p.x / 40) * 40 + rng.pick([-5.6, 5.6]), p.z);
      car.setHeading(rng.chance(0.5) ? 0 : Math.PI);
    }
    parked.push(car);
  }

  function carAhead(car, others, playerCar) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let best = 26;
    const check = (o) => {
      if (o === car) return;
      const dx = o.x - car.x, dz = o.z - car.z;
      const along = dx * fx + dz * fz;
      if (along < 0 || along > best) return;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < 2.6) best = along;
    };
    for (const o of others) check(o);
    if (playerCar) check(playerCar);
    return best;
  }

  return {
    cars,
    parked,
    all() { return cars.concat(parked); },
    update(dt, playerCar, playerPos, policeCars) {
      const others = cars.concat(parked, policeCars || []);
      for (const car of cars) {
        // Maybe turn at an intersection (street crossing every 40 units).
        const nearX = Math.abs(car.x - Math.round(car.x / 40) * 40) < 1.2;
        const nearZ = Math.abs(car.z - Math.round(car.z / 40) * 40) < 1.2;
        if ((nearX || nearZ) && car.wait <= 0 && rng.chance(dt * 0.5)) {
          car.lane.alongX = !car.lane.alongX;
          car.lane.dir = rng.sign();
          if (car.lane.alongX) {
            car.lane.street = Math.round(car.z / 40) * 40;
            car.setHeading(car.lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          } else {
            car.lane.street = Math.round(car.x / 40) * 40;
            car.setHeading(car.lane.dir > 0 ? 0 : Math.PI);
          }
          car.wait = 1.5;
        }
        car.wait = Math.max(0, car.wait - dt);
        // Slow down for whatever is ahead, including the player on foot.
        const gap = carAhead(car, others, playerCar);
        let want = car.cruise;
        if (gap < 12) want = car.cruise * clamp((gap - 4) / 8, 0, 1);
        if (playerPos && !playerCar) {
          const dx = playerPos.x - car.x, dz = playerPos.z - car.z;
          const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
          const along = dx * fx + dz * fz;
          const side = Math.abs(dx * fz - dz * fx);
          if (along > 0 && along < 9 && side < 2.2) want = 0;
        }
        car.speed += (want - car.speed) * Math.min(1, dt * 1.8);
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        // Stay in the lane: ease back to the lane line.
        let lx = nx, lz = nz;
        if (car.lane.alongX) {
          const laneZ = car.lane.street + (car.lane.dir > 0 ? -3.5 : 3.5);
          lz = nz + (laneZ - nz) * Math.min(1, dt * 2);
        } else {
          const laneX = car.lane.street + (car.lane.dir > 0 ? -3.5 : 3.5);
          lx = nx + (laneX - nx) * Math.min(1, dt * 2);
        }
        const fixed = city.resolveCircle(lx, lz, CFG.carRadius);
        car.setPos(fixed.x, fixed.z);
        // Wrap around the edge: a car that leaves the grid re-enters elsewhere.
        if (Math.abs(car.x) > 215 || Math.abs(car.z) > 215) {
          const p = city.randomRoadPoint(rng);
          car.setPos(p.x, p.z);
          car.lane.alongX = rng.chance(0.5);
          car.lane.dir = rng.sign();
          car.lane.street = car.lane.alongX ? p.z : p.x;
        }
        // Wheel spin
        for (const w of car.group.userData.wheels) w.rotation.x += (car.speed * dt) / 0.42;
      }
    },
    nearestParked(x, z, maxD) {
      let best = null, bd = maxD;
      for (const c of parked) {
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },
    claimParked(car) {
      const i = parked.indexOf(car);
      if (i >= 0) parked.splice(i, 1);
      car.role = 'player';
    },
  };
}
