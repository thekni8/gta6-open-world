// Police response: black-and-white interceptors that spawn at the edge of
// sight, chase the player along the roads, ram, and — at 3+ stars — set
// roadblocks across the road ahead. Light bars flash red/blue; the siren
// is the sound engine's job.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, angleDelta, range } from '../util/random.js';
import { Car } from '../vehicles/cars.js';

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.flashTimer = 0;
    this.onRam = null; // () => {} — wired by main for damage + shake
  }

  makePoliceCar(x, z, heading) {
    const car = new Car(this.scene, CONFIG.palette.police, 'sedan', x, z, heading);
    // White doors: a thin white box over the body.
    const doors = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.4, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }),
    );
    doors.position.set(0, 0.62, 0);
    car.group.add(doors);
    // Light bar: two emissive blocks, toggled red/blue.
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    red.position.set(-0.4, 1.66, -0.2);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }),
    );
    blue.position.set(0.4, 1.66, -0.2);
    car.group.add(red);
    car.group.add(blue);
    car.lightRed = red;
    car.lightBlue = blue;
    car.isPolice = true;
    return car;
  }

  /** How many police cars the current stars call for. */
  desiredCount(stars) {
    return CONFIG.police.carsPerStar[clamp(stars, 0, 5)];
  }

  spawnNear(playerPos, minDist = 45) {
    // Spawn on a road ring around the player.
    for (let tries = 0; tries < 12; tries++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = range(this.rng, minDist, minDist + 40);
      const x = playerPos.x + Math.sin(angle) * dist;
      const z = playerPos.z + Math.cos(angle) * dist;
      const road = this.city.nearestRoad(x, z);
      if (Math.abs(road.x) > 300 || Math.abs(road.z) > 300) continue;
      const car = this.makePoliceCar(road.x, road.z, Math.atan2(playerPos.x - road.x, playerPos.z - road.z));
      this.cars.push(car);
      return car;
    }
    return null;
  }

  /** A roadblock: two police cars parked across the road ahead of the player. */
  roadblock(playerPos, playerHeading) {
    const ahead = 34;
    const cx = playerPos.x + Math.sin(playerHeading) * ahead;
    const cz = playerPos.z + Math.cos(playerHeading) * ahead;
    const road = this.city.nearestRoad(cx, cz);
    const perp = playerHeading + Math.PI / 2;
    for (const side of [-1, 1]) {
      const car = this.makePoliceCar(
        road.x + Math.sin(perp) * side * 2.4,
        road.z + Math.cos(perp) * side * 2.4,
        playerHeading + Math.PI / 2,
      );
      car.speed = 0;
      car.blocker = true;
      this.cars.push(car);
    }
  }

  /** Can any police car see the player right now? */
  canSee(playerPos) {
    for (const car of this.cars) {
      const d = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      if (d < CONFIG.police.sightRange) return true;
    }
    return false;
  }

  clearAll() {
    for (const car of this.cars) car.remove();
    this.cars = [];
  }

  update(dt, stars, playerPos, playerHeading, playerCar, onPlayerHit) {
    this.flashTimer += dt;
    const flash = Math.floor(this.flashTimer * 6) % 2 === 0;
    // Match the fleet to the wanted level.
    const want = this.desiredCount(stars);
    while (this.cars.length < want) this.spawnNear(playerPos);
    while (this.cars.length > want) {
      // Drop the farthest car first.
      let far = 0;
      let fd = -1;
      this.cars.forEach((c, i) => {
        const d = Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z);
        if (d > fd) { fd = d; far = i; }
      });
      this.cars[far].remove();
      this.cars.splice(far, 1);
    }
    // Roadblocks at 3+ stars, at most once every 25 s.
    this.blockTimer = (this.blockTimer ?? 0) - dt;
    if (stars >= CONFIG.police.roadblockAtStars && this.blockTimer <= 0) {
      this.roadblock(playerPos, playerHeading);
      this.blockTimer = 25;
    }
    for (const car of this.cars) {
      car.lightRed.visible = flash;
      car.lightBlue.visible = !flash;
      if (car.blocker) {
        // Parked across the road; it just sits there flashing.
        continue;
      }
      // Chase: steer toward the player, throttle up, ram on contact.
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      const turn = clamp(angleDelta(car.heading, wantHeading), -1, 1);
      car.steer = turn * 0.6;
      car.speed += (CONFIG.police.chaseSpeed - car.speed) * Math.min(1, dt * 0.8);
      car.heading += turn * 1.8 * dt * Math.sign(car.speed || 1);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      this.city.collideCircle(car.pos, CONFIG.car.radius);
      car.group.position.copy(car.pos);
      car.group.rotation.y = car.heading;
      const spin = (car.speed * dt) / 0.36;
      for (const w of car.group.userData.wheels) w.rotation.x += spin;
      // Ram: close contact damages the player's car or the player.
      if (dist < 3.4) {
        car.speed *= 0.4;
        onPlayerHit?.(CONFIG.police.ramDamage);
        this.onRam?.();
        // Bounce the police car back so it doesn't stick.
        car.pos.x -= Math.sin(car.heading) * 1.2;
        car.pos.z -= Math.cos(car.heading) * 1.2;
      }
      // Give up if hopelessly far away.
      if (dist > 260) {
        const road = this.city.nearestRoad(playerPos.x, playerPos.z);
        car.pos.set(road.x, 0, road.z);
        car.speed = 0;
      }
    }
    // Drop blockers once the heat is gone.
    if (stars < CONFIG.police.roadblockAtStars) {
      for (let i = this.cars.length - 1; i >= 0; i--) {
        if (this.cars[i].blocker) {
          this.cars[i].remove();
          this.cars.splice(i, 1);
        }
      }
    }
  }
}
