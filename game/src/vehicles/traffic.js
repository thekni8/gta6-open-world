// Traffic: cars that cruise the road grid in their lane, turn at
// intersections, brake for the car ahead, and slow down near the player on
// foot. They are the city's pulse — and the cars the player steals.

import { CONFIG } from '../config.js';
import { range, choice } from '../util/random.js';
import { Car, randomPaint, randomKind } from './cars.js';

const TURNS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    for (let i = 0; i < CONFIG.crowd.trafficCars; i++) this.spawnCar();
  }

  spawnCar(at) {
    const p = at ?? this.city.randomRoadPoint();
    const heading = choice(this.rng, TURNS);
    // Keep the car on its road: nudge onto the nearest centre line.
    const road = this.city.nearestRoad(p.x, p.z);
    const car = new Car(
      this.scene,
      randomPaint(this.rng),
      randomKind(this.rng),
      road.x,
      road.z,
      heading,
    );
    car.cruise = range(this.rng, CONFIG.crowd.cruiseMin, CONFIG.crowd.cruiseMax);
    this.cars.push(car);
    return car;
  }

  /** Nearest drivable car to a point (for E / stealing), within `maxDist`. */
  nearestCar(x, z, maxDist = 5) {
    let best = null;
    let bd = maxDist;
    for (const car of this.cars) {
      const d = Math.hypot(car.pos.x - x, car.pos.z - z);
      if (d < bd) {
        bd = d;
        best = car;
      }
    }
    return best;
  }

  removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    car.remove();
  }

  update(dt, playerPos, playerCar) {
    const roads = this.city.roadCoords;
    for (const car of this.cars) {
      if (car === playerCar) continue;
      if (car.cruise === undefined) car.cruise = 9; // a car the player drove rejoins traffic
      // At an intersection, sometimes turn onto the cross road.
      const nearX = roads.some((r) => Math.abs(car.pos.x - r) < 1.2);
      const nearZ = roads.some((r) => Math.abs(car.pos.z - r) < 1.2);
      if (nearX && nearZ && this.rng() < dt * 0.35) {
        car.heading = choice(this.rng, TURNS);
      }
      // Brake for the car ahead (traffic or the player's).
      let targetSpeed = car.cruise;
      const ahead = this.carAhead(car, playerCar);
      if (ahead !== null && ahead < 9) targetSpeed = 0;
      // Slow near the player on foot so they don't plough through crowds.
      const pd = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      if (pd < 7 && !playerCar) targetSpeed = Math.min(targetSpeed, 3);
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2.5);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      this.city.collideCircle(car.pos, CONFIG.car.radius);
      car.group.position.copy(car.pos);
      car.group.rotation.y = car.heading;
      const spin = (car.speed * dt) / 0.36;
      for (const w of car.group.userData.wheels) w.rotation.x += spin;
      // Respawn far-off cars back into the city so traffic never thins out.
      if (Math.abs(car.pos.x) > 320 || Math.abs(car.pos.z) > 320) {
        const p = this.city.randomRoadPoint();
        car.pos.set(p.x, 0, p.z);
        car.speed = 0;
      }
    }
    // Top the traffic back up if the player stole a few cars.
    while (this.cars.length < CONFIG.crowd.trafficCars) this.spawnCar();
  }

  /** Distance to the nearest car directly ahead of `car`, or null. */
  carAhead(car, playerCar) {
    let best = null;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const all = playerCar ? [...this.cars, playerCar] : this.cars;
    for (const other of all) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const along = dx * fx + dz * fz;
      if (along <= 0 || along > 22) continue;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < 2.6 && (best === null || along < best)) best = along;
    }
    return best;
  }
}
