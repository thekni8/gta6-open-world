// Cars: low-poly box-and-wedge models, arcade driving physics shared by the
// player, traffic and police, plus damage, smoke and explosions.
// Heading convention: forward is (sin heading, cos heading); the mesh is
// built facing +z so rotation.y = heading.

import { CFG, CAR_COLORS } from '../config.js';
import { clamp, angleLerp } from '../util/random.js';

const THREE = window.THREE;

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.85 });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xdfe6e9 });

export function buildCarMesh(color, kind) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const tall = kind === 'van' || kind === 'truck';
  const bodyLen = kind === 'truck' ? 5.4 : 4.4;
  const bodyH = tall ? 1.5 : 0.85;

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, bodyH, bodyLen), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);

  if (!tall) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, 2.2), bodyMat);
    cabin.position.set(0, 1.5, -0.25);
    cabin.castShadow = true;
    group.add(cabin);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.1), glassMat);
    windshield.position.set(0, 1.5, 0.88);
    windshield.rotation.x = 0.25;
    group.add(windshield);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.1), glassMat);
    rearGlass.position.set(0, 1.5, -1.38);
    rearGlass.rotation.x = -0.2;
    group.add(rearGlass);
  } else {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 1.4), glassMat);
    cab.position.set(0, 1.8, bodyLen / 2 - 0.8);
    group.add(cab);
  }

  // Headlights and taillights.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6b8, emissive: 0x555533 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x550000 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.08), headMat);
    h.position.set(sx, 0.78, bodyLen / 2 + 0.02);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.08), tailMat);
    t.position.set(sx, 0.78, -bodyLen / 2 - 0.02);
    group.add(t);
  }
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.18, 0.18), chromeMat);
  bumper.position.set(0, 0.42, bodyLen / 2 + 0.05);
  group.add(bumper);

  const wheels = [];
  const wy = 0.42;
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz * (bodyLen / 4.4));
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  group.userData.wheels = wheels;
  group.userData.bodyMat = bodyMat;
  group.userData.kind = kind;
  return group;
}

// One police light bar: two emissive domes the chase code flashes.
export function addPoliceLightBar(mesh) {
  const bar = new THREE.Group();
  const red = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.22, 0.4),
    new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1 }),
  );
  red.position.x = -0.35;
  const blue = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.22, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2266ff, emissive: 0x0044ff, emissiveIntensity: 1 }),
  );
  blue.position.x = 0.35;
  bar.add(red, blue);
  bar.position.y = 1.95;
  mesh.add(bar);
  mesh.userData.lightBar = { red, blue };
  return bar;
}

export class Car {
  constructor(G, x, z, heading, opts = {}) {
    this.G = G;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.kind = opts.kind || 'sedan';
    this.color = opts.color ?? 0x2980b9;
    this.driver = opts.driver || 'none'; // player | traffic | police | none
    this.isPolice = !!opts.isPolice;
    this.owned = !!opts.owned;
    this.isMissionTarget = !!opts.isMissionTarget;
    this.dead = false;
    this.smoking = false;
    this.drifting = false;
    this.wheelSpin = 0;
    this.mesh = buildCarMesh(this.color, this.kind);
    if (this.isPolice) addPoliceLightBar(this.mesh);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    G.scene.add(this.mesh);
  }

  get speed01() {
    return clamp(Math.abs(this.speed) / CFG.carMaxSpeed, 0, 1);
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.wheelSpin += this.speed * 0.09;
    for (const w of this.mesh.userData.wheels) {
      w.rotation.x = this.wheelSpin;
    }
    // Front wheels yaw with the steering.
    const front = this.mesh.userData.wheels;
    front[0].rotation.y = this.steer * 0.4;
    front[1].rotation.y = this.steer * 0.4;
  }

  // Arcade drive step: throttle -1..1, steer -1..1, handbrake boolean.
  // Shared by the player, traffic and police so every car handles alike.
  driveStep(dt, throttle, steerInput, handbrake) {
    const maxFwd = this.isPolice ? CFG.policeTopSpeed : CFG.carMaxSpeed;
    if (throttle > 0) this.speed += CFG.carAccel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CFG.carBrake * dt;
      else this.speed += CFG.carAccel * 0.6 * throttle * dt; // reverse
    }
    // Drag + rolling resistance.
    this.speed -= this.speed * CFG.carDrag * dt;
    if (handbrake) {
      this.speed -= Math.sign(this.speed) * CFG.handbrakeDecel * dt;
      if (Math.abs(this.speed) < 1) this.speed = 0;
    }
    this.speed = clamp(this.speed, -CFG.carMaxReverse, maxFwd);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;

    // Steering bites harder at low speed, less at full speed.
    const speedFactor = clamp(Math.abs(this.speed) / 12, 0, 1);
    const steerAuthority = 2.1 * (1 - speedFactor * 0.55);
    this.steer = angleLerp(this.steer, steerInput, Math.min(1, dt * 8));
    const grip = handbrake ? CFG.carGrip * 0.35 : CFG.carGrip;
    this.heading += this.steer * steerAuthority * Math.sign(this.speed) * dt
      * clamp(Math.abs(this.speed) / 6, 0, 1);
    this.drifting = handbrake && Math.abs(this.speed) > 8;

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    // A drifting car keeps some of its old velocity direction.
    const slide = this.drifting ? 0.35 : 0.06;
    this.vx = this.vx === undefined ? 0 : this.vx;
    this.vz = this.vz === undefined ? 0 : this.vz;
    const targetVx = fx * this.speed;
    const targetVz = fz * this.speed;
    const blend = Math.min(1, grip * dt * (1 - slide) + slide);
    this.vx += (targetVx - this.vx) * blend;
    this.vz += (targetVz - this.vz) * blend;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.x = clamp(this.x, -CFG.cityBound, CFG.cityBound);
    this.z = clamp(this.z, -CFG.cityBound, CFG.cityBound + 40);
  }

  // Building + world collision after a drive step. Returns true on impact.
  collideWorld() {
    const c = this.G.city.collideCircle(this.x, this.z, CFG.carRadius);
    if (!c.hit) return false;
    const impact = Math.abs(this.speed);
    this.x = c.x;
    this.z = c.z;
    // Bounce: kill most of the speed along the impact normal.
    const nx = c.nx;
    const nz = c.nz;
    const nLen = Math.hypot(nx, nz) || 1;
    const ux = nx / nLen;
    const uz = nz / nLen;
    const along = (this.vx || 0) * ux + (this.vz || 0) * uz;
    if (along < 0) {
      this.vx -= 1.6 * along * ux;
      this.vz -= 1.6 * along * uz;
    }
    this.speed *= 0.45;
    if (impact > 6) {
      this.damage(impact * 0.9);
      this.G.fx.sparks(this.x, 1, this.z, Math.min(14, impact | 0));
      this.G.audio.crash(Math.min(1, impact / 30));
      if (this.driver === 'player') this.G.fx.shake(Math.min(0.7, impact / 40));
    }
    return true;
  }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 35 && !this.smoking) {
      this.smoking = true;
    }
    if (this.health <= 0) {
      this.health = 0;
      this.explode();
    }
  }

  explode() {
    if (this.dead) return;
    this.dead = true;
    this.G.fx.explosion(this.x, 1, this.z);
    this.G.audio.explosion();
    this.G.fx.shake(0.9);
    // Char the body and sink the wreck a touch.
    this.mesh.userData.bodyMat.color.setHex(0x1a1a1a);
    this.mesh.position.y = -0.25;
    if (this.driver === 'player') {
      this.G.player.exitCar();
      this.G.player.takeDamage(25, 'explosion');
    }
  }

  updateSmoke(dt) {
    if (this.smoking && !this.dead && Math.random() < dt * 14) {
      this.G.fx.smoke(this.x + Math.sin(this.heading) * 1.8, 1.4, this.z + Math.cos(this.heading) * 1.8);
    }
  }

  dispose() {
    this.G.scene.remove(this.mesh);
  }
}

// Player-car handling: input -> drive step, skid marks, engine sound.
export class PlayerDriving {
  constructor(G) {
    this.G = G;
    this.lastSkidX = 0;
    this.lastSkidZ = 0;
    this.skidTimer = 0;
  }

  update(dt) {
    const G = this.G;
    const car = G.player.inCar;
    if (!car) return;
    const input = G.input;
    const throttle = (input.isDown('KeyW') ? 1 : 0) + (input.isDown('KeyS') ? -1 : 0);
    const steer = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const handbrake = input.isDown('Space');
    car.driveStep(dt, throttle, steer, handbrake);
    car.collideWorld();
    this.checkCarCollisions(car, dt);
    this.checkPedCollisions(car, dt);
    car.updateSmoke(dt);
    car.syncMesh();
    // Skid marks while drifting or handbraking hard.
    this.skidTimer -= dt;
    if ((car.drifting || (handbrake && Math.abs(car.speed) > 6)) && this.skidTimer <= 0) {
      this.skidTimer = 0.05;
      const bx = car.x - Math.sin(car.heading) * 1.6;
      const bz = car.z - Math.cos(car.heading) * 1.6;
      if (this.lastSkidX !== 0) {
        G.fx.skidMark(this.lastSkidX, this.lastSkidZ, bx, bz);
      }
      this.lastSkidX = bx;
      this.lastSkidZ = bz;
    } else if (!car.drifting) {
      this.lastSkidX = 0;
    }
    G.audio.setEngine(car.speed01, true);
  }

  checkCarCollisions(car, dt) {
    const G = this.G;
    const all = [...G.traffic.cars, ...G.police.cars, ...G.parkedCars];
    for (const other of all) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const d2 = dx * dx + dz * dz;
      const min = CFG.carRadius * 2 - 0.4;
      if (d2 >= min * min || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const ux = dx / d;
      const uz = dz / d;
      car.x -= ux * push;
      car.z -= uz * push;
      other.x += ux * push;
      other.z += uz * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 5) {
        car.damage(rel * 0.55);
        other.damage(rel * 0.55);
        G.fx.sparks((car.x + other.x) / 2, 1, (car.z + other.z) / 2, 8);
        G.audio.crash(Math.min(1, rel / 30));
        G.fx.shake(0.3);
        if (other.isPolice) G.wanted.addCrime('ramPoliceCar');
      }
      car.speed *= 0.72;
      other.speed *= 0.72;
      other.syncMesh();
    }
  }

  checkPedCollisions(car, dt) {
    const G = this.G;
    for (const ped of G.peds.list) {
      if (ped.state === 'down') continue;
      const dx = ped.x - car.x;
      const dz = ped.z - car.z;
      if (dx * dx + dz * dz > 6.5) continue;
      if (Math.abs(car.speed) > 3) {
        ped.knockDown(car.speed);
        G.wanted.addCrime(Math.abs(car.speed) > 14 ? 'hurtPedestrian' : 'hitPedestrian');
        G.fx.shake(0.25);
        G.audio.thud();
      }
    }
  }
}
