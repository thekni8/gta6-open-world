// Cars: low-poly box-and-wedge models with slate blue-grey cabins, arcade
// driving physics, damage states and headlights.

import { CONFIG } from '../config.js';
import { resolveCircle } from '../world/city.js';

// Build a car mesh facing +Z. Police cruisers get a light bar.
export function buildCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const cabinMat = new THREE.MeshLambertMaterial({ color: CONFIG.cabinColor });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1e22 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.72, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 1.1), bodyMat);
  hood.position.set(0, 1.02, 1.55);
  group.add(hood);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.62, 2.1), cabinMat);
  cabin.position.set(0, 1.28, -0.25);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  // Headlights and taillights (emissive, so they read at dusk).
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0xffedb0, emissiveIntensity: 1.4 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0xaa1111, emissiveIntensity: 1.2 });
  for (const sx of [-0.62, 0.62]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), headMat);
    head.position.set(sx, 0.66, 2.21);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
    tail.position.set(sx, 0.7, -2.21);
    group.add(tail);
  }

  let lightBar = null;
  if (opts.police) {
    const bar = new THREE.Group();
    const redMat = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 });
    const blueMat = new THREE.MeshLambertMaterial({ color: 0x2255ff, emissive: 0x0033ff, emissiveIntensity: 2 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), redMat);
    red.position.x = -0.42;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), blueMat);
    blue.position.x = 0.42;
    bar.add(red, blue);
    bar.position.set(0, 1.68, -0.25);
    group.add(bar);
    lightBar = { redMat, blueMat };
    // Black doors stripe for the cruiser look.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 1.6), darkMat);
    stripe.position.set(0, 0.72, -0.2);
    group.add(stripe);
  }

  return { group, wheels, lightBar };
}

export class Car {
  constructor(scene, colliders, color, opts = {}) {
    this.colliders = colliders;
    const built = buildCarMesh(color, opts);
    this.group = built.group;
    this.wheels = built.wheels;
    this.lightBar = built.lightBar;
    this.heading = 0;
    this.speed = 0; // m/s along the heading
    this.damage = 0; // 0..100
    this.headlightsOn = false;
    this.isPolice = !!opts.police;
    this.radius = 2.4;
    this.skidding = false;
    scene.add(this.group);
    this.position = this.group.position;
  }

  get x() { return this.position.x; }
  get z() { return this.position.z; }

  setPosition(x, z, heading = 0) {
    this.position.set(x, 0, z);
    this.heading = heading;
    this.group.rotation.y = heading;
    this.speed = 0;
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  kmh() {
    return Math.abs(this.speed) * 3.6;
  }

  // Arcade drive step. throttle -1..1, steer -1..1, handbrake bool.
  // Returns { crashed } when a hard impact happened this frame.
  drive(dt, throttle, steer, handbrake) {
    const worn = 1 - (this.damage / 100) * 0.45;
    const maxSpeed = CONFIG.carMaxSpeed * worn;
    if (throttle > 0) this.speed += CONFIG.carAccel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed += CONFIG.carBrake * throttle * dt;
      else this.speed = Math.max(-CONFIG.carReverseMax, this.speed + CONFIG.carAccel * throttle * dt * 0.6);
    } else {
      this.speed -= this.speed * Math.min(1, dt * 0.7);
    }
    if (handbrake) this.speed -= this.speed * Math.min(1, dt * 2.2);
    this.speed = Math.max(-CONFIG.carReverseMax, Math.min(maxSpeed, this.speed));

    const grip = handbrake ? CONFIG.handbrakeGripLoss : 1;
    const turnAmount = steer * CONFIG.carTurnRate * grip * dt * Math.min(1, Math.abs(this.speed) / 6);
    this.heading += turnAmount * (this.speed >= 0 ? 1 : -1);
    this.skidding = handbrake && Math.abs(this.speed) > 8;

    const f = this.forward();
    const prevX = this.position.x;
    const prevZ = this.position.z;
    this.position.x += f.x * this.speed * dt;
    this.position.z += f.z * this.speed * dt;
    const before = { x: this.position.x, z: this.position.z };
    resolveCircle(this.position, this.radius, this.colliders);
    const crashed = Math.abs(before.x - this.position.x) > 0.01 || Math.abs(before.z - this.position.z) > 0.01;
    if (crashed) {
      const impact = Math.abs(this.speed);
      this.speed *= -0.22;
      if (impact > 6) this.damage = Math.min(100, this.damage + impact * 0.9);
    }
    this.position.x = Math.max(-CONFIG.worldBound - 10, Math.min(CONFIG.worldBound + 130, this.position.x));
    this.position.z = Math.max(-CONFIG.worldBound - 10, Math.min(332, this.position.z));
    this.group.rotation.y = this.heading;
    const spin = (this.speed * dt) / 0.36;
    for (const w of this.wheels) w.rotation.x += spin;
    return { crashed, impactSpeed: crashed ? Math.abs(this.speed) : 0, movedFrom: { x: prevX, z: prevZ } };
  }

  // Police light-bar flash. phase flips red/blue; also returns the glow color.
  flashLights(time) {
    if (!this.lightBar) return 0;
    const on = Math.floor(time * 6) % 2 === 0;
    this.lightBar.redMat.emissiveIntensity = on ? 3.2 : 0.25;
    this.lightBar.blueMat.emissiveIntensity = on ? 0.25 : 3.2;
    return on ? 0xff2222 : 0x2255ff;
  }

  remove(scene) {
    scene.remove(this.group);
  }
}

// Meridian Bay round 9 — witness touch
