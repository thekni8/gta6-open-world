// Traffic AI: cars driving the road grid, turning at intersections,
// braking for the car ahead, and fleeing when violence breaks out nearby.

import { CONFIG, CAR_COLORS } from '../config.js';
import { Car } from './cars.js';
import { makeRng } from '../util/random.js';
import { ROAD_LINES } from '../world/city.js';

const LANE = 3.6; // right-hand lane offset from the road center

export class TrafficManager {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.cars = [];
    this.rng = makeRng(777);
    this.fleeUntil = 0;
    this.fleePoint = null;
  }

  spawn(count) {
    for (let i = 0; i < count; i++) {
      const car = this.spawnOne();
      if (car) this.cars.push(car);
    }
  }

  // Spawn a traffic car on a random road, or at a given spot.
  spawnOne(at = null) {
    const color = this.rng.pick(CAR_COLORS);
    const car = new Car(this.scene, this.colliders, color);
    const axis = at?.axis ?? (this.rng.chance(0.5) ? 'x' : 'z');
    const road = at?.road ?? this.rng.pick(ROAD_LINES);
    const dir = at?.dir ?? (this.rng.chance(0.5) ? 1 : -1);
    const along = at?.along ?? this.rng.range(-260, 260);
    let x;
    let z;
    let heading;
    if (axis === 'x') {
      x = along;
      z = road + LANE * dir;
      heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = road + LANE * dir;
      z = along;
      heading = dir > 0 ? 0 : Math.PI;
    }
    car.setPosition(x, z, heading);
    car.ai = { axis, road, dir, speed: CONFIG.trafficSpeed * this.rng.range(0.85, 1.15), flee: 0 };
    return car;
  }

  // Place a traffic car exactly (used by screenshot staging).
  placeAt(x, z, heading, color = null) {
    const car = new Car(this.scene, this.colliders, color ?? this.rng.pick(CAR_COLORS));
    car.setPosition(x, z, heading);
    const axis = Math.abs(Math.sin(heading)) > 0.5 ? 'x' : 'z';
    car.ai = { axis, road: axis === 'x' ? z : x, dir: 1, speed: CONFIG.trafficSpeed, flee: 0, parked: true };
    this.cars.push(car);
    return car;
  }

  scare(point) {
    this.fleeUntil = performance.now() / 1000 + 5;
    this.fleePoint = { x: point.x, z: point.z };
    for (const car of this.cars) {
      const d = Math.hypot(car.x - point.x, car.z - point.z);
      if (d < 60) car.ai.flee = 4;
    }
  }

  update(dt, now, playerPos) {
    for (const car of this.cars) {
      const ai = car.ai;
      if (ai.parked) {
        car.drive(dt, 0, 0, false);
        continue;
      }
      let targetSpeed = ai.speed;
      if (ai.flee > 0) {
        ai.flee -= dt;
        targetSpeed = ai.speed * 1.9;
      }
      // Brake for the car ahead on the same lane.
      const f = car.forward();
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        if (ahead > 0 && ahead < 11 && side < 2.6) {
          targetSpeed = 0;
          break;
        }
      }
      // Brake for the player standing in the way.
      if (playerPos) {
        const dx = playerPos.x - car.x;
        const dz = playerPos.z - car.z;
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        if (ahead > 0 && ahead < 9 && side < 2.2) targetSpeed = 0;
      }
      // Steer toward the lane line; turn at intersections sometimes.
      const laneCoord = ai.axis === 'x' ? car.z : car.x;
      const laneTarget = ai.road + LANE * ai.dir;
      const wantHeading = ai.axis === 'x'
        ? (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (ai.dir > 0 ? 0 : Math.PI);
      let headingError = wantHeading - car.heading;
      while (headingError > Math.PI) headingError -= Math.PI * 2;
      while (headingError < -Math.PI) headingError += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, headingError * 1.6 + (laneTarget - laneCoord) * 0.06 * ai.dir));
      const throttle = car.speed < targetSpeed ? 0.7 : (car.speed > targetSpeed + 1 ? -0.6 : 0);
      car.drive(dt, throttle, steer, false);
      // Turn at an intersection: switch axis near a crossing road line.
      const along = ai.axis === 'x' ? car.x : car.z;
      for (const line of ROAD_LINES) {
        if (Math.abs(along - line) < 3 && this.rng.chance(0.02)) {
          const newAxis = ai.axis === 'x' ? 'z' : 'x';
          const newDir = this.rng.chance(0.5) ? 1 : -1;
          ai.axis = newAxis;
          ai.road = line;
          ai.dir = newDir;
          break;
        }
      }
      // Wrap around the map edges.
      if (car.x > 300) car.setPosition(-290, car.z, car.heading);
      if (car.x < -300) car.setPosition(290, car.z, car.heading);
      if (car.z > 285) car.setPosition(car.x, -290, car.heading);
      if (car.z < -300) car.setPosition(car.x, 280, car.heading);
    }
  }

  positions() {
    return this.cars.map((c) => ({ x: c.x, z: c.z, police: false }));
  }
}
