// Traffic AI: cars cruise the road grid, turn at intersections, stop for
// the car ahead, and scatter when the player causes chaos nearby.
import { CONFIG } from '../config.js';
import { Car, randomCarColor } from './cars.js';

const { roadLines } = CONFIG.world;

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.parked = [];
  }

  spawn(count) {
    for (let i = 0; i < count; i++) {
      const car = this._spawnMoving();
      if (car) this.cars.push(car);
    }
    // Parked cars along kerbs — stealable, and they make streets look lived-in.
    for (let i = 0; i < 10; i++) {
      const line = this.rng.pick(roadLines);
      const along = this.rng.range(-200, 200);
      const horizontal = this.rng.chance(0.5);
      const x = horizontal ? along : line + 4.6;
      const z = horizontal ? line + 4.6 : along;
      const angle = horizontal ? (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (this.rng.chance(0.5) ? 0 : Math.PI);
      const car = new Car(this.scene, { x, z, angle, color: randomCarColor(this.rng), kind: this.rng.pick(['sedan', 'sedan', 'truck', 'taxi']) });
      car.driver = null;
      this.parked.push(car);
    }
  }

  _spawnMoving() {
    const horizontal = this.rng.chance(0.5);
    const line = this.rng.pick(roadLines);
    const along = this.rng.range(-210, 210);
    const dir = this.rng.chance(0.5) ? 1 : -1;
    // Drive on the right: offset 3 units to the right of the centreline.
    const x = horizontal ? along : line + 3 * dir;
    const z = horizontal ? line - 3 * dir : along;
    const angle = horizontal ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
    const car = new Car(this.scene, { x, z, angle, color: randomCarColor(this.rng), kind: this.rng.pick(['sedan', 'sedan', 'sedan', 'truck', 'taxi']) });
    car.driver = 'traffic';
    car.route = { horizontal, line, dir, targetSpeed: CONFIG.car.trafficSpeed * this.rng.range(0.85, 1.15) };
    return car;
  }

  nearestParked(x, z, maxDist = 5) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.parked) {
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  nearestMoving(x, z, maxDist = 5) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (Math.abs(c.speed) > 2) continue; // only (near-)stopped traffic is jackable
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  removeFromTraffic(car) {
    const i = this.cars.indexOf(car);
    if (i !== -1) this.cars.splice(i, 1);
    const j = this.parked.indexOf(car);
    if (j !== -1) this.parked.splice(j, 1);
  }

  update(dt, game) {
    const player = game.player;
    for (const car of this.cars) {
      if (car.dead) continue;
      const r = car.route;
      // At an intersection (near a crossing road line), maybe turn.
      const along = r.horizontal ? car.pos.x : car.pos.z;
      const nearestCross = roadLines.reduce((a, b) => (Math.abs(b - along) < Math.abs(a - along) ? b : a));
      const distToCross = Math.abs(nearestCross - along);
      if (distToCross < 2.5 && !r.turnedAt?.includes(nearestCross)) {
        r.turnedAt = r.turnedAt || [];
        const choice = this.rng.next();
        if (choice < 0.3) {
          // Turn onto the crossing road.
          const newDir = this.rng.chance(0.5) ? 1 : -1;
          r.horizontal = !r.horizontal;
          r.line = nearestCross;
          r.dir = newDir;
          r.turnedAt.push(nearestCross);
          if (r.turnedAt.length > 4) r.turnedAt.shift();
        } else if (choice < 0.36) {
          r.dir *= -1; // rare U-turn
        }
      }
      // Desired heading from the route.
      let targetAngle;
      if (r.horizontal) targetAngle = r.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      else targetAngle = r.dir > 0 ? Math.PI : 0;
      // Lane offset: keep to the right side of the road.
      const laneOffset = 3;
      const desiredLinePos = r.horizontal
        ? { x: car.pos.x, z: r.line - laneOffset * r.dir }
        : { x: r.line + laneOffset * r.dir, z: car.pos.z };
      const offLane = r.horizontal ? desiredLinePos.z - car.pos.z : desiredLinePos.x - car.pos.x;
      // Steer: blend heading correction with lane re-centring.
      let angleDiff = targetAngle - car.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      let steer = Math.max(-1, Math.min(1, angleDiff * 2.2));
      steer += Math.max(-0.5, Math.min(0.5, offLane * 0.12 * (r.horizontal ? -r.dir : r.dir) * -1));
      steer = Math.max(-1, Math.min(1, steer));

      // Stop for the car (or player) ahead.
      let throttle = 0.7;
      const f = car.forward();
      const aheadX = car.pos.x + f.x * 9;
      const aheadZ = car.pos.z + f.z * 9;
      let blocked = false;
      for (const other of this.cars) {
        if (other === car) continue;
        if (Math.hypot(other.pos.x - aheadX, other.pos.z - aheadZ) < 4.5) { blocked = true; break; }
      }
      if (!blocked && player.inCar) {
        const pc = player.car;
        if (pc && Math.hypot(pc.pos.x - aheadX, pc.pos.z - aheadZ) < 5) blocked = true;
      }
      if (!blocked && !player.inCar) {
        if (Math.hypot(player.pos.x - aheadX, player.pos.z - aheadZ) < 4) blocked = true;
      }
      if (blocked) throttle = car.speed > 0.5 ? -1 : 0;
      // Flee: if the player just caused chaos nearby, floor it.
      if (game.chaosAt && Math.hypot(car.pos.x - game.chaosAt.x, car.pos.z - game.chaosAt.z) < 35) {
        throttle = 1;
      }
      const prevX = car.pos.x;
      const prevZ = car.pos.z;
      const prevSpeed = car.speed;
      car.drive(dt, throttle, steer, false);
      // Keep traffic on roads: if a turn pushed it into a building, undo.
      if (this.city.collideCircle(car.pos, CONFIG.car.radius)) {
        car.pos.x = prevX;
        car.pos.z = prevZ;
        car.group.position.copy(car.pos);
        if (Math.abs(prevSpeed) > 4) car.crash(prevSpeed * 0.5);
      }
      // Wrap around the map edge instead of driving off.
      if (Math.abs(car.pos.x) > 232 || Math.abs(car.pos.z) > 232) {
        car.route.dir *= -1;
        car.angle += Math.PI;
      }
    }
    // Parked cars just sit there; their light bars (none) need no update.
  }
}
