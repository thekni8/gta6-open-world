// Police pursuit: cruisers spawn at the wanted level's strength, chase the
// player with ramming AI, and set roadblocks across the road at 4–5 stars.
import { CONFIG } from '../config.js';
import { Car } from '../vehicles/cars.js';

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.roadblockCars = [];
    this.roadblockTimer = 0;
    this.targetCount = 0;
  }

  setTargetCount(n) {
    this.targetCount = n;
  }

  nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of [...this.cars, ...this.roadblockCars]) {
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  spawnCruiser(game, nearX = null, nearZ = null) {
    const player = game.player;
    // Spawn on a road, 60–90 units from the player, out of immediate sight.
    let x;
    let z;
    let tries = 0;
    do {
      const pt = this.city.nearestRoadPoint(
        player.pos.x + (Math.random() - 0.5) * 170,
        player.pos.z + (Math.random() - 0.5) * 170,
      );
      x = pt.x;
      z = pt.z;
      tries++;
    } while (Math.hypot(x - player.pos.x, z - player.pos.z) < CONFIG.police.spawnDistance && tries < 12);
    if (nearX !== null) { x = nearX; z = nearZ; }
    const angle = Math.atan2(-(player.pos.x - x), -(player.pos.z - z));
    const car = new Car(this.scene, { x, z, angle, color: 0x1a3a5c, kind: 'police' });
    car.driver = 'police';
    this.cars.push(car);
    return car;
  }

  // Roadblock: two cruisers parked across the road ahead of the player.
  spawnRoadblock(game) {
    const player = game.player;
    const ahead = player.inCar && player.car
      ? player.car.forward()
      : { x: -Math.sin(player.angle), z: -Math.cos(player.angle) };
    const cx = player.pos.x + ahead.x * 42;
    const cz = player.pos.z + ahead.z * 42;
    const road = this.city.nearestRoadPoint(cx, cz);
    const across = road.axis === 'x' ? { x: 0, z: 1 } : { x: 1, z: 0 };
    const angle = road.axis === 'x' ? Math.PI / 2 : 0;
    for (const offset of [-3.4, 3.4]) {
      const car = new Car(this.scene, {
        x: road.x + across.x * offset,
        z: road.z + across.z * offset,
        angle,
        color: 0x1a3a5c,
        kind: 'police',
      });
      car.driver = 'police-block';
      this.roadblockCars.push(car);
    }
  }

  clearAll() {
    for (const c of [...this.cars, ...this.roadblockCars]) c.remove();
    this.cars = [];
    this.roadblockCars = [];
    this.targetCount = 0;
  }

  update(dt, game, t) {
    const player = game.player;
    // Match the fleet to the wanted level.
    if (this.cars.length < this.targetCount) {
      this.spawnCruiser(game);
    } else if (this.cars.length > this.targetCount) {
      const extra = this.cars.pop();
      extra.remove();
    }
    // Roadblocks at high heat, re-laid every 25 seconds.
    if (game.wanted.stars >= CONFIG.police.roadblockAtStars) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0 && this.roadblockCars.length === 0) {
        this.spawnRoadblock(game);
        this.roadblockTimer = 25;
      }
    } else if (this.roadblockCars.length > 0) {
      for (const c of this.roadblockCars) c.remove();
      this.roadblockCars = [];
    }

    for (const cop of this.cars) {
      if (cop.dead) continue;
      // Pursuit steering: aim at a point ahead of the player.
      const lead = player.inCar && player.car ? Math.abs(player.car.speed) * 0.35 : 0;
      const px = player.pos.x + (player.inCar && player.car ? player.car.forward().x * lead : 0);
      const pz = player.pos.z + (player.inCar && player.car ? player.car.forward().z * lead : 0);
      const dx = px - cop.pos.x;
      const dz = pz - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetAngle = Math.atan2(-dx, -dz);
      let diff = targetAngle - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.4));
      const throttle = dist > 4 ? 1 : 0.4;
      const prevX = cop.pos.x;
      const prevZ = cop.pos.z;
      const prevSpeed = cop.speed;
      cop.drive(dt, throttle, steer, false);
      if (this.city.collideCircle(cop.pos, CONFIG.car.radius)) {
        cop.pos.x = prevX;
        cop.pos.z = prevZ;
        cop.group.position.copy(cop.pos);
        if (Math.abs(prevSpeed) > 6) {
          cop.crash(prevSpeed * 0.4);
          game.particles.sparks(cop.pos.x, 0.8, cop.pos.z);
        }
        cop.speed *= -0.3;
        // Stuck against a wall: reverse out for a moment.
        cop.angle += 0.5;
      }
      // Ramming the player's car damages both.
      if (player.inCar && player.car) {
        const d = Math.hypot(cop.pos.x - player.car.pos.x, cop.pos.z - player.car.pos.z);
        if (d < 3.4) {
          const impact = Math.abs(cop.speed - player.car.speed);
          if (impact > 4) {
            player.car.crash(impact * 0.6);
            game.sound.crash();
            game.particles.sparks(player.car.pos.x, 0.8, player.car.pos.z);
            game.particles.addShake(0.5);
            // Shove the player car sideways.
            const push = 2.2;
            player.car.pos.x += (player.car.pos.x - cop.pos.x) / (d || 1) * push * dt * 8;
            player.car.pos.z += (player.car.pos.z - cop.pos.z) / (d || 1) * push * dt * 8;
          }
        }
      }
      // A cruiser hitting the on-foot player hurts.
      if (!player.inCar && !player.dead) {
        const d = Math.hypot(cop.pos.x - player.pos.x, cop.pos.z - player.pos.z);
        if (d < 2.4 && Math.abs(cop.speed) > 3) {
          player.damage(CONFIG.police.ramDamage, game);
          game.particles.addShake(0.6);
        }
      }
      if (cop.smoking && Math.random() < 0.3) game.particles.smoke(cop.pos.x, 1.2, cop.pos.z);
      cop.updateLights(t);
    }
    for (const block of this.roadblockCars) block.updateLights(t);
    game.sound.setSiren(this.cars.length > 0 && game.wanted.stars > 0);
  }
}
