// Cars: low-poly box-and-wedge models built at runtime, plus arcade
// driving physics (acceleration, braking, handbrake slides, steering that
// tightens at low speed) and simple damage states with smoke.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, pick } from '../util/random.js';

const P = CONFIG.palette;

function makeCarModel(color, kind = 'sedan') {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const chrome = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 });

  const bodyLen = kind === 'truck' ? 5.6 : 4.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, bodyLen), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, kind === 'truck' ? 1.6 : 2.2), glass);
  cabin.position.set(0, 1.28, kind === 'truck' ? 1.1 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 2.6), dark);
    bed.position.set(0, 1.1, -1.2);
    group.add(bed);
  }
  // Bumpers, lights, grille.
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.25, 0.3), chrome);
  bumperF.position.set(0, 0.4, bodyLen / 2);
  group.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = -bodyLen / 2;
  group.add(bumperR);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    head.position.set(sx, 0.72, bodyLen / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xd02020 }));
    tail.position.set(sx, 0.72, -bodyLen / 2 - 0.02);
    group.add(tail);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.36, wz);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }
  // Police light bar, added by the chase module on police cars.
  group.userData = { wheels, bodyLen, headlightMat: lightMat };
  return group;
}

export class Car {
  constructor(scene, color, kind = 'sedan', x = 0, z = 0, heading = 0) {
    this.scene = scene;
    this.group = makeCarModel(color, kind);
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

  /** Drive with arcade physics. input: {throttle, brake, steer, handbrake}. */
  drive(dt, input, city) {
    const cfg = CONFIG.car;
    const steerTarget = input.steer * cfg.steer * (this.speed >= 0 ? 1 : -1);
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
    this.speed = clamp(this.speed, -cfg.maxReverse, cfg.maxSpeed);
    // Steering bites harder at low speed, less at high speed.
    const grip = input.handbrake ? 0.35 : 1;
    const turnRate = this.steer * clamp(Math.abs(this.speed) / 8, 0, 1) * 1.9 * grip;
    this.heading += turnRate * dt * Math.sign(this.speed || 1);
    const dx = Math.sin(this.heading) * this.speed * dt;
    const dz = Math.cos(this.heading) * this.speed * dt;
    this.pos.x += dx;
    this.pos.z += dz;
    const before = this.pos.clone();
    city.collideCircle(this.pos, CONFIG.car.radius);
    if (this.pos.distanceTo(before) > 0.01 && Math.abs(this.speed) > 6) {
      // Scraped a building: shed speed, take damage.
      this.speed *= 0.55;
      this.damage(CONFIG.car.damagePerHit * 0.5);
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

export function randomCarColor(rng) {
  return pick(rng, P.car);
}
