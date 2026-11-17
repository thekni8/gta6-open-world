// Police chase — black-and-white cruisers that spawn at the city edge, hunt the
// player, ram the getaway car, and at high stars set up roadblocks ahead.
import * as THREE from 'three';
import { POLICE_SPEED, POLICE_RAM_DAMAGE } from '../config.js';
import { createCar } from '../vehicles/cars.js';
import { clamp } from '../util/random.js';

export function createPoliceCar(scene, x, z, heading) {
  const car = createCar(scene, x, z, heading, { isPolice: true, color: 0x1c2f4a });
  // Light bar: red and blue beacons that flash.
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  red.position.set(-0.35, 1.55, -0.2);
  car.group.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
  blue.position.set(0.35, 1.55, -0.2);
  car.group.add(blue);
  car.lightRed = red;
  car.lightBlue = blue;
  car.flashPhase = Math.random() * 10;
  car.ramCooldown = 0;
  car.stuckTimer = 0;
  return car;
}

/** Spawn a cruiser on a road near the player, out of direct sight. */
export function spawnPolice(scene, playerPos, rng, roadCenters, distOverride = null) {
  const angle = rng.range(0, Math.PI * 2);
  const dist = distOverride ?? rng.range(55, 80);
  let x = playerPos.x + Math.sin(angle) * dist;
  let z = playerPos.z + Math.cos(angle) * dist;
  // Snap to the nearest road so cruisers arrive on asphalt, not through blocks.
  let best = null;
  let bestD = Infinity;
  for (const c of roadCenters) {
    for (const [cx, cz] of [[c, z], [x, c]]) {
      const d = Math.hypot(cx - x, cz - z);
      if (d < bestD) {
        bestD = d;
        best = [cx, cz];
      }
    }
  }
  if (best) {
    x = best[0];
    z = best[1];
  }
  x = clamp(x, -240, 260);
  z = clamp(z, -240, 240);
  const heading = Math.atan2(playerPos.x - x, playerPos.z - z);
  return createPoliceCar(scene, x, z, heading);
}

/**
 * Chase step for one cruiser: steer at the player, ram when close, and give up
 * briefly when hopelessly stuck. Returns 'ram' when it lands a hit this frame.
 */
export function updatePoliceCar(car, playerPos, playerCar, dt, colliders, others, stars, rng) {
  car.flashPhase += dt * 10;
  const on = Math.sin(car.flashPhase) > 0;
  car.lightRed.material.color.setHex(on ? 0xff2222 : 0x550000);
  car.lightBlue.material.color.setHex(on ? 0x113366 : 0x2266ff);
  car.ramCooldown = Math.max(0, car.ramCooldown - dt);

  const dx = playerPos.x - car.pos.x;
  const dz = playerPos.z - car.pos.z;
  const dist = Math.hypot(dx, dz);
  const wantHeading = Math.atan2(dx, dz);
  let diff = wantHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  // At 4+ stars, one cruiser holds a roadblock ahead of the player instead.
  const speed = POLICE_SPEED[Math.min(stars, 5)];
  if (Math.abs(diff) > 1.2 && dist < 25) {
    car.speed = Math.max(0, car.speed - 24 * dt);
  } else {
    car.heading += clamp(diff, -2.2 * dt, 2.2 * dt);
    car.speed += (speed - car.speed) * Math.min(1, dt * 1.5);
  }
  const before = car.pos.clone();
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  // Reuse the driving collision: push out of buildings and other cars.
  const hitWall = driveCarWallOnly(car, colliders, others);
  if (hitWall) {
    car.speed *= 0.4;
    car.stuckTimer += dt;
    if (car.stuckTimer > 2.5) {
      // Reverse out of the jam, then rejoin the chase.
      car.heading += Math.PI * 0.7;
      car.stuckTimer = 0;
    }
  } else {
    car.stuckTimer = 0;
  }
  car.group.position.copy(car.pos);
  car.group.rotation.y = car.heading;
  for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.38;

  // Ram: close, fast and cooled down — shove the player's car and hurt Kai.
  let rammed = false;
  if (dist < 4.5 && car.speed > 8 && car.ramCooldown <= 0) {
    car.ramCooldown = 1.2;
    rammed = true;
    if (playerCar) {
      playerCar.speed *= 0.75;
      const push = 3;
      playerCar.pos.x += Math.sin(car.heading) * push;
      playerCar.pos.z += Math.cos(car.heading) * push;
    }
  }
  return rammed ? POLICE_RAM_DAMAGE : 0;
}

// Collision-only pass for police cars (no throttle logic): buildings + cars.
function driveCarWallOnly(car, colliders, others) {
  let hit = false;
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const nx = Math.max(c.minX, Math.min(car.pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(car.pos.z, c.maxZ));
    const dx = car.pos.x - nx;
    const dz = car.pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < 1.6 * 1.6) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        car.pos.x = nx + (dx / d) * 1.6;
        car.pos.z = nz + (dz / d) * 1.6;
      }
    }
  }
  for (const other of others) {
    if (other === car) continue;
    const dx = car.pos.x - other.pos.x;
    const dz = car.pos.z - other.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.2 && d > 0.001) {
      car.pos.x = other.pos.x + (dx / d) * 3.2;
      car.pos.z = other.pos.z + (dz / d) * 3.2;
    }
  }
  return hit;
}
