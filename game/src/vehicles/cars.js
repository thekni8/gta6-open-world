// Cars — low-poly box-built models, arcade driving physics (acceleration,
// braking, handbrake, steering that fades with speed) and visible damage.
import * as THREE from 'three';
import { CAR, COLORS } from '../config.js';
import { clamp, moveToward } from '../util/random.js';
import { resolveCircle } from '../world/city.js';

let carId = 0;

/** Build a car mesh from boxes: body, cabin, wheels, lights. `kind` changes the look. */
export function buildCarMesh(color, kind = 'sedan') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.15, kind === 'taxi' ? -0.1 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe94a }));
    sign.position.set(0, 1.6, -0.1);
    group.add(sign);
  }
  if (kind === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.6), darkMat);
    bed.position.set(0, 0.95, 1.3);
    group.add(bed);
  }
  // Headlights and taillights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    hl.position.set(sx, 0.6, -2.22);
    group.add(hl);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.65, 0.65]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tl.position.set(sx, 0.6, 2.22);
    group.add(tl);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-1.0, -1.45], [1.0, -1.45], [-1.0, 1.45], [1.0, 1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  return { group, wheels };
}

export function createCar(scene, x, z, heading, options = {}) {
  const kind = options.kind ?? 'sedan';
  const color = options.color ?? COLORS.carPalette[carId % COLORS.carPalette.length];
  const { group, wheels } = buildCarMesh(color, kind);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  const car = {
    id: carId,
    kind,
    group,
    wheels,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    health: 100,
    damage: 0, // 0..1, smoke and handling worsen as it grows
    isPolice: !!options.isPolice,
    isPlayer: false,
    headlights: false,
    brakeLights: false,
    smokeTimer: 0,
  };
  carId += 1;
  return car;
}

/** Arcade driving step for the player's car. Returns true on a hard impact. */
export function driveCar(car, throttle, steer, handbrake, dt, colliders, others) {
  const forward = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
  if (throttle > 0) car.speed += CAR.accel * throttle * dt * (1 - car.damage * 0.4);
  else if (throttle < 0) {
    car.speed += (car.speed > 0.5 ? -CAR.brake : CAR.reverseAccel * throttle) * dt;
  } else {
    car.speed = moveToward(car.speed, 0, 8 * dt);
  }
  if (handbrake) car.speed = moveToward(car.speed, 0, 26 * dt);
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steerAuthority = clamp(Math.abs(car.speed) / 6, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading += steer * CAR.steer * steerAuthority * dt * (handbrake ? 1.6 : 1);
  car.pos.addScaledVector(forward, car.speed * dt);
  if (handbrake && Math.abs(car.speed) > 8) {
    // Handbrake slide: a little sideways drift, very GTA.
    car.pos.x += Math.cos(car.heading) * steer * car.speed * 0.12 * dt;
    car.pos.z -= Math.sin(car.heading) * steer * car.speed * 0.12 * dt;
  }
  car.pos.x = clamp(car.pos.x, -280, 345);
  car.pos.z = clamp(car.pos.z, -280, 280);
  const beforeX = car.pos.x;
  const beforeZ = car.pos.z;
  resolveCircle(car.pos, CAR.radius, colliders);
  let hit = false;
  if (Math.abs(car.pos.x - beforeX) > 0.01 || Math.abs(car.pos.z - beforeZ) > 0.01) {
    if (Math.abs(car.speed) > 6) hit = true;
    car.speed *= 0.55;
  }
  // Soft car-car push-out.
  for (const other of others) {
    if (other === car) continue;
    const dx = car.pos.x - other.pos.x;
    const dz = car.pos.z - other.pos.z;
    const d = Math.hypot(dx, dz);
    const min = 3.2;
    if (d < min && d > 0.001) {
      car.pos.x = other.pos.x + (dx / d) * min;
      car.pos.z = other.pos.z + (dz / d) * min;
      if (Math.abs(car.speed) > 8) hit = true;
      car.speed *= 0.7;
    }
  }
  if (hit) damageCar(car, 6);
  car.group.position.copy(car.pos);
  car.group.rotation.y = car.heading;
  car.group.rotation.z = -steer * clamp(Math.abs(car.speed) / 30, 0, 1) * 0.05;
  for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.38;
  car.brakeLights = throttle < 0 || handbrake;
  return hit;
}

/** Damage a car: smoke, worse handling, and at 0 health it stops dead. */
export function damageCar(car, amount) {
  car.health = Math.max(0, car.health - amount);
  car.damage = 1 - car.health / 100;
  if (car.health <= 0) car.speed = 0;
  return car.health <= 0;
}

/** Park a car neatly on a road, facing along it. */
export function parkCar(car, x, z, heading) {
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.speed = 0;
  car.group.position.copy(car.pos);
  car.group.rotation.y = heading;
}
