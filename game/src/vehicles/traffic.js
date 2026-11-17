// Traffic — cars that drive the road grid in loops, stop for the car ahead,
// and pull over (briefly) when the player rams them.
import * as THREE from 'three';
import { TRAFFIC } from '../config.js';
import { createCar } from './cars.js';
import { clamp } from '../util/random.js';

/** Pick a fresh waypoint: the next intersection along the current road. */
function nextWaypoint(car, roadCenters, rng) {
  const alongX = Math.abs(Math.sin(car.heading)) > 0.7;
  const step = 74;
  if (alongX) {
    const nx = car.pos.x + Math.sign(Math.sin(car.heading)) * step;
    if (Math.abs(nx) > 240 || rng.chance(0.35)) {
      // Turn onto a cross street at this intersection.
      const nz = car.pos.z + (rng.chance(0.5) ? step : -step);
      return { x: car.pos.x, z: clamp(nz, -222, 222), turn: true };
    }
    return { x: clamp(nx, -222, 222), z: car.pos.z, turn: false };
  }
  const nz = car.pos.z + Math.sign(Math.cos(car.heading)) * step;
  if (Math.abs(nz) > 240 || rng.chance(0.35)) {
    const nx = car.pos.x + (rng.chance(0.5) ? step : -step);
    return { x: clamp(nx, -222, 222), z: car.pos.z, turn: true };
  }
  return { x: car.pos.x, z: clamp(nz, -222, 222), turn: false };
}

export function createTraffic(scene, rng, roadCenters) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const horizontal = rng.chance(0.5);
    const road = roadCenters[rng.int(0, roadCenters.length - 1)];
    const along = rng.range(-222, 222);
    const x = horizontal ? along : road + (rng.chance(0.5) ? 3.2 : -3.2);
    const z = horizontal ? road + (rng.chance(0.5) ? 3.2 : -3.2) : along;
    const heading = horizontal ? (x > 0 ? Math.PI / 2 : -Math.PI / 2) : (z > 0 ? 0 : Math.PI);
    // Drive on the right: offset the lane by the heading.
    const car = createCar(scene, x, z, heading, { kind: rng.chance(0.2) ? 'taxi' : 'sedan', color: rng.chance(0.15) ? 0xf2c200 : undefined });
    car.target = nextWaypoint(car, roadCenters, rng);
    car.stopped = 0;
    cars.push(car);
  }
  return cars;
}

/** Advance every traffic car one step: follow waypoints, brake for traffic ahead. */
export function updateTraffic(cars, playerCar, dt, colliders, roadCenters, rng) {
  const all = playerCar ? [...cars, playerCar] : cars;
  for (const car of cars) {
    if (car.health <= 0) continue;
    const dx = car.target.x - car.pos.x;
    const dz = car.target.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) {
      car.target = nextWaypoint(car, roadCenters, rng);
      continue;
    }
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Slow for the turn, brake for the car ahead.
    let speed = TRAFFIC.speed;
    if (Math.abs(diff) > 0.5) speed = 4;
    let blocked = false;
    for (const other of all) {
      if (other === car || other.health <= 0) continue;
      const ox = other.pos.x - car.pos.x;
      const oz = other.pos.z - car.pos.z;
      const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
      const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
      if (ahead > 0 && ahead < TRAFFIC.minGap && side < 3) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      car.speed = Math.max(0, car.speed - 20 * dt);
    } else {
      car.heading += clamp(diff, -1.4 * dt, 1.4 * dt);
      car.speed += (speed - car.speed) * Math.min(1, dt * 2);
    }
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
    for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.38;
  }
  return cars;
}

/** Spawn one parked car on a road edge (stealable, or a mission target). */
export function spawnParkedCar(scene, x, z, heading, options = {}) {
  const car = createCar(scene, x, z, heading, options);
  car.parked = true;
  return car;
}
