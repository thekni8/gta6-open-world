// Police chases: cruisers spawn on the roads, hunt the player, ram, and
// at four stars and up throw a T-bone roadblock across the road ahead.

import { CONFIG } from '../config.js';
import { Car } from '../vehicles/cars.js';
import { makeRng } from '../util/random.js';
import { ROAD_LINES } from '../world/city.js';

const CRUISERS_PER_STAR = [0, 1, 2, 3, 4, 5];

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export class PoliceManager {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.cruisers = [];
    this.roadblock = [];
    this.rng = makeRng(99);
    this.glowTexture = makeGlowTexture();
    this.bustedTimer = 0;
    this.spawnCooldown = 0;
  }

  wantedCount(stars) {
    return CRUISERS_PER_STAR[Math.max(0, Math.min(5, stars))] ?? 0;
  }

  spawnCruiserNear(playerPos, ahead = 0) {
    const car = new Car(this.scene, this.colliders, 0xf2f2f2, { police: true });
    // Spawn on the nearest road, a little ahead of the player.
    let best = null;
    let bestD = Infinity;
    for (const line of ROAD_LINES) {
      const d = Math.min(Math.abs(playerPos.x - line), Math.abs(playerPos.z - line));
      if (d < bestD) {
        bestD = d;
        best = line;
      }
    }
    const onXRoad = Math.abs(playerPos.z - best) < Math.abs(playerPos.x - best);
    let x;
    let z;
    let heading;
    if (onXRoad) {
      x = playerPos.x + ahead + this.rng.range(25, 45);
      z = best;
      heading = -Math.PI / 2;
    } else {
      x = best;
      z = playerPos.z + ahead + this.rng.range(25, 45);
      heading = Math.PI;
    }
    car.setPosition(x, z, heading);
    car.ai = { mode: 'chase' };
    // Red/blue glow pooled on the asphalt under the cruiser.
    const glowMat = new THREE.MeshBasicMaterial({
      map: this.glowTexture, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, color: 0xff2222,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.08;
    car.group.add(glow);
    car.glowMat = glowMat;
    this.cruisers.push(car);
    return car;
  }

  // Two cruisers parked across the road ahead, T-bone style.
  deployRoadblock(playerPos, heading) {
    this.clearRoadblock();
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const cx = playerPos.x + fx * 42;
    const cz = playerPos.z + fz * 42;
    const sideX = -fz;
    const sideZ = fx;
    for (const [off, angle] of [[-4.5, 0.6], [4.5, -0.6]]) {
      const car = new Car(this.scene, this.colliders, 0xf2f2f2, { police: true });
      const hx = heading + Math.PI / 2 + angle;
      car.setPosition(cx + sideX * off, cz + sideZ * off, hx);
      car.ai = { mode: 'block' };
      const glowMat = new THREE.MeshBasicMaterial({
        map: this.glowTexture, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, color: 0x2255ff,
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.08;
      car.group.add(glow);
      car.glowMat = glowMat;
      this.roadblock.push(car);
    }
  }

  clearRoadblock() {
    for (const car of this.roadblock) car.remove(this.scene);
    this.roadblock = [];
  }

  clearAll() {
    for (const car of this.cruisers) car.remove(this.scene);
    this.cruisers = [];
    this.clearRoadblock();
    this.bustedTimer = 0;
  }

  nearestDistance(playerPos) {
    let best = Infinity;
    for (const car of [...this.cruisers, ...this.roadblock]) {
      best = Math.min(best, Math.hypot(car.x - playerPos.x, car.z - playerPos.z));
    }
    return best;
  }

  // Returns 'busted' when the player is caught standing still.
  update(dt, now, stars, playerPos, playerSpeed, playerHeading) {
    const want = this.wantedCount(stars);
    this.spawnCooldown -= dt;
    while (this.cruisers.length < want && this.spawnCooldown <= 0) {
      this.spawnCruiserNear(playerPos, this.cruisers.length * 12);
      this.spawnCooldown = 0.4;
    }
    while (this.cruisers.length > want) {
      const car = this.cruisers.pop();
      car.remove(this.scene);
    }

    if (stars >= CONFIG.roadblockStars && this.roadblock.length === 0) {
      this.deployRoadblock(playerPos, playerHeading);
    } else if (stars < CONFIG.roadblockStars && this.roadblock.length > 0) {
      this.clearRoadblock();
    }

    for (const car of [...this.cruisers, ...this.roadblock]) {
      const glowColor = car.flashLights(now);
      if (car.glowMat) car.glowMat.color.setHex(glowColor);
    }

    let busted = false;
    for (const car of this.cruisers) {
      // Parked cruisers (staged roadblocks, screenshots) hold position.
      if (car.ai?.mode === 'parked') continue;
      const dx = playerPos.x - car.x;
      const dz = playerPos.z - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let err = wantHeading - car.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, err * 1.8));
      // Ram: full throttle until close, then match speed and push.
      const throttle = dist > 8 ? 1 : 0.35;
      car.drive(dt, throttle, steer, false);
      // A cruiser that loses the player by a lot respawns closer.
      if (dist > CONFIG.policeChaseRange) {
        const fresh = this.spawnCruiserNear(playerPos);
        car.remove(this.scene);
        const i = this.cruisers.indexOf(car);
        if (i >= 0) this.cruisers[i] = fresh;
      }
    }

    // Busted: standing still with a cruiser right on top of the player.
    if (stars > 0 && playerSpeed < 0.6 && this.nearestDistance(playerPos) < 7) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 3) busted = true;
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
    return busted ? 'busted' : null;
  }

  positions() {
    return [...this.cruisers, ...this.roadblock].map((c) => ({ x: c.x, z: c.z, police: true }));
  }
}
