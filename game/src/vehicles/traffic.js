// Traffic: cars that drive the road grid, turn at intersections, brake for
// the car ahead and keep the city feeling alive. They stay near the player:
// cars that drift far away are respawned on a road nearby.

import { CFG, CAR_COLORS } from '../config.js';
import { Car } from './cars.js';
import { SeededRandom, angleDiff, clamp } from '../util/random.js';

export class Traffic {
  constructor(G) {
    this.G = G;
    this.rng = new SeededRandom(G.seed + 77);
    this.cars = [];
    this.spawnInitial();
  }

  spawnInitial() {
    for (let i = 0; i < CFG.trafficCount; i++) {
      this.spawnCar(true);
    }
  }

  spawnCar(anywhere) {
    const G = this.G;
    const p = G.city.randomRoadPoint(this.rng);
    if (!anywhere) {
      const d = Math.hypot(p.x - G.player.x, p.z - G.player.z);
      if (d > 170) return null;
    }
    const dir = this.rng.chance(0.5) ? 1 : -1;
    const heading = p.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    // Right-hand lane: offset to the right of the direction of travel.
    const lane = 3.5;
    const ox = p.axis === 'x' ? 0 : -dir * lane;
    const oz = p.axis === 'x' ? dir * lane : 0;
    const car = new Car(G, p.x + ox, p.z + oz, heading, {
      driver: 'traffic',
      color: this.rng.pick(CAR_COLORS),
      kind: this.rng.chance(0.18) ? 'van' : 'sedan',
    });
    car.road = { axis: p.axis, coord: p.road, dir };
    car.cruise = CFG.trafficSpeed * this.rng.range(0.8, 1.15);
    car.speed = car.cruise * 0.6;
    this.cars.push(car);
    return car;
  }

  removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i !== -1) this.cars.splice(i, 1);
  }

  update(dt) {
    const G = this.G;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.dead) {
        // Wrecks linger a while, then get towed away.
        car.wreckTimer = (car.wreckTimer || 0) + dt;
        if (car.wreckTimer > 25) {
          car.dispose();
          this.cars.splice(i, 1);
        }
        continue;
      }
      this.driveTrafficCar(car, dt);
      car.updateSmoke(dt);
      car.syncMesh();
      const d = Math.hypot(car.x - G.player.x, car.z - G.player.z);
      if (d > 220) {
        car.dispose();
        this.cars.splice(i, 1);
      }
    }
    while (this.cars.length < CFG.trafficCount) {
      if (!this.spawnCar(false)) break;
    }
  }

  driveTrafficCar(car, dt) {
    const G = this.G;
    const road = car.road;
    // Desired heading from the road we are on.
    let wantHeading;
    if (road.axis === 'x') wantHeading = road.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    else wantHeading = road.dir > 0 ? 0 : Math.PI;
    // At an intersection, sometimes turn onto the crossing road.
    const along = road.axis === 'x' ? car.x : car.z;
    const nearest = G.city.nearestRoadCoord(along);
    if (Math.abs(along - nearest) < 1.2 && !car.turnedAt?.includes?.(nearest)) {
      if (this.rng.chance(0.35)) {
        const newAxis = road.axis === 'x' ? 'z' : 'x';
        const newDir = this.rng.chance(0.5) ? 1 : -1;
        car.road = { axis: newAxis, coord: nearest, dir: newDir };
        car.turnedAt = [nearest];
        wantHeading = newAxis === 'x'
          ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (newDir > 0 ? 0 : Math.PI);
      }
    }
    if (Math.abs(along - nearest) > 8) car.turnedAt = null;

    // Steer toward the wanted heading, and stay in the lane.
    const steerErr = angleDiff(car.heading, wantHeading);
    let steer = clamp(steerErr * 2.2, -1, 1);
    // Lane keeping: nudge toward the lane centre line.
    const lane = 3.5;
    const laneOffset = road.axis === 'x'
      ? (car.z - road.coord) - road.dir * lane
      : (car.x - road.coord) + road.dir * lane;
    steer = clamp(steer - laneOffset * 0.12 * road.dir * (road.axis === 'x' ? 1 : -1), -1, 1);

    // Brake for whatever is ahead: player car, another car, or a police chase.
    let throttle = 1;
    const ahead = this.obstacleAhead(car, 13);
    if (ahead !== null) {
      throttle = ahead < 7 ? -0.6 : 0.15;
    }
    if (car.speed > car.cruise) throttle = 0;
    car.driveStep(dt, throttle, steer, false);
    car.collideWorld();
  }

  // Distance to the nearest car ahead in our lane, or null.
  obstacleAhead(car, maxD) {
    const G = this.G;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    let best = null;
    const others = [G.player.inCar, ...this.cars, ...G.police.cars];
    for (const o of others) {
      if (!o || o === car || o.dead) continue;
      const dx = o.x - car.x;
      const dz = o.z - car.z;
      const ahead = dx * fx + dz * fz;
      if (ahead < 0 || ahead > maxD) continue;
      const side = Math.abs(-dx * fz + dz * fx);
      if (side > 3.2) continue;
      if (best === null || ahead < best) best = ahead;
    }
    return best;
  }
}
