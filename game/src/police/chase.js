// Police pursuit: cruisers spawn on nearby roads, chase with pursuit
// steering, ram the player's car, and at 4+ stars throw roadblocks across
// the road ahead. Light bars flash red/blue while they hunt.

import { CFG } from '../config.js';
import { Car } from '../vehicles/cars.js';
import { SeededRandom, angleDiff, clamp } from '../util/random.js';

export class Police {
  constructor(G) {
    this.G = G;
    this.rng = new SeededRandom(G.seed + 55);
    this.cars = [];
    this.spawnTimer = 0;
    this.roadblockTimer = 0;
    this.flashTimer = 0;
    this.flashOn = false;
  }

  spawnCruiser(nearX, nearZ, minD, maxD) {
    const G = this.G;
    const p = G.city.roadPointNear(nearX, nearZ, minD, maxD, this.rng);
    const heading = Math.atan2(nearX - p.x, nearZ - p.z);
    const car = new Car(G, p.x, p.z, heading, {
      driver: 'police',
      isPolice: true,
      color: 0xf5f6fa,
      kind: 'sedan',
    });
    car.cruise = CFG.policeTopSpeed;
    this.cars.push(car);
    return car;
  }

  spawnRoadblock() {
    const G = this.G;
    const player = G.player;
    const car = player.inCar;
    if (!car) return;
    // Two cruisers parked across the road ahead of the player.
    const ahead = 42;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const bx = car.x + fx * ahead;
    const bz = car.z + fz * ahead;
    const sideX = -fz;
    const sideZ = fx;
    for (const off of [-4.5, 4.5]) {
      const cruiser = new Car(G, bx + sideX * off, bz + sideZ * off, car.heading + Math.PI / 2, {
        driver: 'police',
        isPolice: true,
        color: 0xf5f6fa,
        kind: 'sedan',
      });
      cruiser.roadblock = true;
      cruiser.blockTimer = 0;
      this.cars.push(cruiser);
    }
    G.hud.toast('ROADBLOCK AHEAD — find another route!');
    G.audio.sirenSting();
  }

  update(dt) {
    const G = this.G;
    const wanted = G.wanted;
    const target = wanted.targetPoliceCount;
    this.flashTimer += dt;
    if (this.flashTimer > 0.28) {
      this.flashTimer = 0;
      this.flashOn = !this.flashOn;
    }
    // Keep the fleet at the wanted level's strength.
    this.spawnTimer -= dt;
    const active = this.cars.filter((c) => !c.dead).length;
    if (active < target && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      this.spawnCruiser(G.player.x, G.player.z, 55, 110);
    }
    // Roadblocks at high heat, while the player is driving fast.
    this.roadblockTimer -= dt;
    const playerCar = G.player.inCar;
    if (wanted.stars >= CFG.roadblockStars && playerCar && Math.abs(playerCar.speed) > 14
      && this.roadblockTimer <= 0) {
      this.roadblockTimer = 26;
      this.spawnRoadblock();
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.dead) {
        car.wreckTimer = (car.wreckTimer || 0) + dt;
        if (car.wreckTimer > 20) {
          car.dispose();
          this.cars.splice(i, 1);
        }
        continue;
      }
      if (wanted.stars === 0 && !car.roadblock) {
        // Heat off: cruisers give up and drive away, then despawn.
        car.givingUp = true;
      }
      if (car.givingUp) {
        car.driveStep(dt, 0.7, 0, false);
        car.collideWorld();
        car.syncMesh();
        const d = Math.hypot(car.x - G.player.x, car.z - G.player.z);
        if (d > 130) {
          car.dispose();
          this.cars.splice(i, 1);
        }
        continue;
      }
      if (car.roadblock) {
        car.blockTimer += dt;
        // A roadblock holds its ground, then joins the chase.
        if (car.blockTimer > 14) car.roadblock = false;
        car.syncMesh();
        this.flashLightBar(car);
        continue;
      }
      this.chasePlayer(car, dt);
      car.updateSmoke(dt);
      car.syncMesh();
      this.flashLightBar(car);
      const d = Math.hypot(car.x - G.player.x, car.z - G.player.z);
      if (d > 260) {
        car.dispose();
        this.cars.splice(i, 1);
      }
    }
  }

  flashLightBar(car) {
    const bar = car.mesh.userData.lightBar;
    if (!bar) return;
    bar.red.material.emissiveIntensity = this.flashOn ? 2.2 : 0.15;
    bar.blue.material.emissiveIntensity = this.flashOn ? 0.15 : 2.2;
  }

  chasePlayer(car, dt) {
    const G = this.G;
    const player = G.player;
    // Pursuit point: aim slightly ahead of a moving player car.
    let tx = player.x;
    let tz = player.z;
    const playerCar = player.inCar;
    if (playerCar) {
      tx += Math.sin(playerCar.heading) * playerCar.speed * 0.35;
      tz += Math.cos(playerCar.heading) * playerCar.speed * 0.35;
    }
    const dx = tx - car.x;
    const dz = tz - car.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    const err = angleDiff(car.heading, wantHeading);
    let steer = clamp(err * 2.4, -1, 1);
    // If we are nose-first into a wall, back out and turn around.
    if (car.stuckTimer === undefined) car.stuckTimer = 0;
    if (Math.abs(car.speed) < 1.5 && dist > 8) car.stuckTimer += dt;
    else car.stuckTimer = 0;
    let throttle = 1;
    if (car.stuckTimer > 1.1) {
      throttle = -1;
      steer = -steer;
      if (car.stuckTimer > 2.0) car.stuckTimer = 0;
    }
    // On foot and close: pull up alongside instead of running the player over.
    if (!playerCar && dist < 7) throttle = -0.4;
    car.driveStep(dt, throttle, steer, false);
    const hitBuilding = car.collideWorld();
    if (hitBuilding) car.stuckTimer += dt * 0.5;
    // Ram the player's car: damage on contact.
    if (playerCar && !playerCar.dead) {
      const pdx = playerCar.x - car.x;
      const pdz = playerCar.z - car.z;
      const pd2 = pdx * pdx + pdz * pdz;
      const min = CFG.carRadius * 2 - 0.3;
      if (pd2 < min * min && pd2 > 1e-6) {
        const pd = Math.sqrt(pd2);
        const push = (min - pd) / 2;
        const ux = pdx / pd;
        const uz = pdz / pd;
        playerCar.x += ux * push;
        playerCar.z += uz * push;
        car.x -= ux * push;
        car.z -= uz * push;
        const rel = Math.abs(car.speed - playerCar.speed);
        if (rel > 4) {
          playerCar.damage(rel * 0.5);
          car.damage(rel * 0.3);
          G.fx.sparks(playerCar.x, 1, playerCar.z, 6);
          G.audio.crash(0.4);
          G.fx.shake(0.3);
        }
        playerCar.speed *= 0.85;
        car.speed *= 0.85;
        playerCar.syncMesh();
      }
    }
  }

  nearestChaserDistance() {
    const G = this.G;
    let best = Infinity;
    for (const car of this.cars) {
      if (car.dead || car.givingUp) continue;
      best = Math.min(best, Math.hypot(car.x - G.player.x, car.z - G.player.z));
    }
    return best;
  }

  clearAll() {
    for (const car of this.cars) car.dispose();
    this.cars = [];
  }
}
