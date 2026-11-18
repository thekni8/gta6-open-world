// Cars: low-poly models built at runtime from boxes and wedges, plus
// arcade driving physics — acceleration, braking, handbrake slides, and
// steering that bites harder at low speed — and simple damage states
// (a wrecked car smokes before it dies).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, choice } from '../util/random.js';

const P = CONFIG.palette;

/** Build a car model: sedan, sport (spoiler + low hood), or van. */
function buildCarModel(color, kind = 'sedan') {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const chrome = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 });

  const bodyLen = kind === 'van' ? 5.4 : 4.4;
  const bodyH = kind === 'van' ? 1.15 : 0.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, bodyH, bodyLen), paint);
  body.position.y = 0.55 + bodyH / 2;
  body.castShadow = true;
  group.add(body);

  if (kind === 'van') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 1.6), glass);
    cab.position.set(0, 1.9, 1.4);
    cab.castShadow = true;
    group.add(cab);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), glass);
    cabin.position.set(0, 1.28, -0.2);
    cabin.castShadow = true;
    group.add(cabin);
    // Sloped hood wedge up front.
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 1.1), paint);
    hood.position.set(0, 0.98, 1.7);
    hood.rotation.x = -0.12;
    group.add(hood);
  }
  if (kind === 'sport') {
    // Rear spoiler on two struts.
    for (const sx of [-0.7, 0.7]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), dark);
      strut.position.set(sx, 1.1, -2.05);
      group.add(strut);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.5), dark);
    wing.position.set(0, 1.28, -2.05);
    group.add(wing);
  }
  // Bumpers, headlights, taillights.
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.25, 0.3), chrome);
  bumperF.position.set(0, 0.4, bodyLen / 2);
  group.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = -bodyLen / 2;
  group.add(bumperR);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd02020 });
  for (const sx of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    head.position.set(sx, 0.72, bodyLen / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(sx, 0.72, -bodyLen / 2 - 0.02);
    group.add(tail);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  const wz = kind === 'van' ? 1.8 : 1.45;
  for (const [wx, wzz] of [[-0.95, wz], [0.95, wz], [-0.95, -wz], [0.95, -wz]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.36, wzz);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }
  group.userData = { wheels, bodyLen, headlightMat: headMat };
  return group;
}

export class Car {
  constructor(scene, color, kind = 'sedan', x = 0, z = 0, heading = 0) {
    this.scene = scene;
    this.group = buildCarModel(color, kind);
    this.kind = kind;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0; // signed m/s along the heading
    this.steer = 0;
    this.health = 100;
    this.smoking = false;
    this.color = color;
    this.group.position.copy(this.pos);
    this.group.rotation.y = heading;
    this.group.userData.car = this;
    scene.add(this.group);
  }

  /** Arcade drive. input: {throttle, brake, steer (-1..1), handbrake}. */
  drive(dt, input, city) {
    const cfg = CONFIG.car;
    const steerTarget = input.steer * cfg.steerLock * (this.speed >= 0 ? 1 : -1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    if (input.throttle) this.speed += cfg.accel * dt;
    if (input.brake) {
      if (this.speed > 0.5) this.speed -= cfg.brake * dt;
      else this.speed -= cfg.accel * 0.55 * dt; // reverse
    }
    if (!input.throttle && !input.brake) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
    }
    if (input.handbrake) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 30 * dt);
    }
    this.speed = clamp(this.speed, -cfg.topReverse, cfg.topSpeed);
    // Steering bites harder at low speed; the handbrake loosens the grip.
    const grip = input.handbrake ? 0.35 : 1;
    const turnRate = this.steer * clamp(Math.abs(this.speed) / 8, 0, 1) * 1.9 * grip;
    this.heading += turnRate * dt * Math.sign(this.speed || 1);
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    const before = this.pos.clone();
    city.collideCircle(this.pos, cfg.radius);
    if (this.pos.distanceTo(before) > 0.01 && Math.abs(this.speed) > 6) {
      // Scraped a building: shed speed, take damage.
      this.speed *= 0.55;
      this.damage(cfg.scrapeDamage);
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    // Wheel spin + front-wheel steer.
    const spin = (this.speed * dt) / 0.36;
    for (const w of this.group.userData.wheels) w.rotation.x += spin;
    this.group.userData.wheels[0].rotation.y = this.steer * 0.5;
    this.group.userData.wheels[1].rotation.y = this.steer * 0.5;
    return Math.abs(this.speed);
  }

  /** Damage the car; returns true when it is destroyed. */
  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health < 45 && !this.smoking) this.smoking = true;
    return this.health <= 0;
  }

  repair() {
    this.health = 100;
    this.smoking = false;
  }

  remove() {
    this.scene.remove(this.group);
  }
}

export function randomPaint(rng) {
  return choice(rng, P.paint);
}

export function randomKind(rng) {
  const roll = rng();
  if (roll < 0.15) return 'van';
  if (roll < 0.35) return 'sport';
  return 'sedan';
}
