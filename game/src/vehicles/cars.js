// Car models and arcade driving physics. Every car is a small group of
// boxes: body, cabin, wheels, plus police light bars and damage smoke.
import { CONFIG } from '../config.js';

const CAR_COLORS = [0xd94f3d, 0x3d7dd9, 0xe8e8e8, 0x2b2f36, 0xe8a33d, 0x3da35d, 0x8a5fc0, 0xef8fb0, 0x7fb8c9, 0xc9c9c9];

let wheelGeo = null;
let bodyGeo = null;
let cabinGeo = null;

function sharedGeos() {
  if (!wheelGeo) {
    wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    bodyGeo = new THREE.BoxGeometry(1.9, 0.62, 4.2);
    cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.1);
  }
  return { wheelGeo, bodyGeo, cabinGeo };
}

export function makeCarMesh(color, kind = 'sedan') {
  sharedGeos();
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.35 });
  // Slate blue-grey cabins: shaded glass, never a black hole.
  const glass = new THREE.MeshStandardMaterial({ color: 0x4a607a, roughness: 0.15, metalness: 0.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });

  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(cabinGeo, kind === 'taxi' ? paint : glass);
  cabin.position.set(0, 1.18, kind === 'truck' ? -0.9 : -0.15);
  cabin.castShadow = true;
  group.add(cabin);

  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.9), paint);
    bed.position.set(0, 0.95, 1.0);
    group.add(bed);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xffd23d, emissive: 0xcc9900, emissiveIntensity: 0.6 }),
    );
    sign.position.set(0, 1.55, -0.15);
    group.add(sign);
  }

  // Headlights + taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xfff2a0, emissiveIntensity: 0.7 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xcc0000, emissiveIntensity: 0.7 });
  for (const sx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.08), headMat);
    h.position.set(sx, 0.66, -2.12);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.08), tailMat);
    t.position.set(sx, 0.66, 2.12);
    group.add(t);
  }

  const wheels = [];
  for (const [wx, wz] of [[-0.85, -1.35], [0.85, -1.35], [-0.85, 1.35], [0.85, 1.35]]) {
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.position.set(wx, 0.38, wz);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }

  let lightBar = null;
  let glowRed = null;
  let glowBlue = null;
  if (kind === 'police') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 }),
    );
    red.position.x = -0.4;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x0044ff, emissiveIntensity: 2 }),
    );
    blue.position.x = 0.4;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.56, -0.15);
    group.add(lightBar);
    // Police livery: white doors stripe via a thin white box over the body.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.3, 2.2), new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 }));
    stripe.position.set(0, 0.68, 0.1);
    group.add(stripe);
    // Flashing light glow pools on the asphalt under the cruiser.
    const glowGeo = new THREE.CircleGeometry(3.4, 20);
    glowRed = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.22, depthWrite: false }));
    glowRed.rotation.x = -Math.PI / 2;
    glowRed.position.set(-1.2, 0.08, 0);
    glowBlue = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0x2266ff, transparent: true, opacity: 0.22, depthWrite: false }));
    glowBlue.rotation.x = -Math.PI / 2;
    glowBlue.position.set(1.2, 0.08, 0);
    group.add(glowRed, glowBlue);
  }

  return { group, wheels, lightBar, glowRed, glowBlue };
}

export function randomCarColor(rng) {
  return rng ? rng.pick(CAR_COLORS) : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
}

// A drivable car: arcade physics with steering that tightens at low speed,
// handbrake slides, crash damage and smoke.
export class Car {
  constructor(scene, { x = 0, z = 0, angle = 0, color = 0xd94f3d, kind = 'sedan' } = {}) {
    this.scene = scene;
    this.kind = kind;
    this.color = color;
    const { group, wheels, lightBar, glowRed, glowBlue } = makeCarMesh(color, kind);
    this.group = group;
    this.wheels = wheels;
    this.lightBar = lightBar;
    this.glowRed = glowRed;
    this.glowBlue = glowBlue;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = angle;
    scene.add(group);
    this.pos = new THREE.Vector3(x, 0, z);
    this.angle = angle;
    this.speed = 0; // signed, units/second; forward is -Z of the group
    this.health = CONFIG.car.maxHealth;
    this.dead = false;
    this.smoking = false;
    this.isPolice = kind === 'police';
    this.stolen = false;
    this.driver = null; // 'player' | 'traffic' | 'police' | null (parked)
    this._flashT = 0;
  }

  forward() {
    return { x: -Math.sin(this.angle), z: -Math.cos(this.angle) };
  }

  // Arcade drive step. throttle -1..1, steer -1..1, handbrake bool.
  drive(dt, throttle, steer, handbrake) {
    if (this.dead) {
      this.speed *= Math.max(0, 1 - dt * 2);
    } else {
      const maxSpeed = this.isPolice ? CONFIG.car.policeMaxSpeed : CONFIG.car.playerMaxSpeed;
      if (throttle > 0) {
        this.speed += CONFIG.car.playerAccel * throttle * dt;
        if (this.speed > maxSpeed) this.speed = maxSpeed;
      } else if (throttle < 0) {
        if (this.speed > 0.5) this.speed -= CONFIG.car.playerBrake * dt;
        else this.speed = Math.max(-CONFIG.car.playerReverseMax, this.speed + CONFIG.car.playerAccel * 0.6 * throttle * dt);
      } else {
        this.speed *= Math.max(0, 1 - dt * (handbrake ? 3.5 : 0.55));
        if (Math.abs(this.speed) < 0.05) this.speed = 0;
      }
      if (handbrake) this.speed *= Math.max(0, 1 - dt * 1.8);
      // Steering: sharper at low speed, and reversed when reversing.
      const dir = this.speed >= 0 ? 1 : -1;
      const grip = handbrake ? 1.6 : 1.0;
      const steerRate = 1.9 * grip * Math.min(1, 10 / (Math.abs(this.speed) + 6));
      this.angle += steer * steerRate * dir * dt * Math.min(1, Math.abs(this.speed) / 3 + 0.15);
    }
    const f = this.forward();
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.angle;
    // Wheel spin + front-wheel steer visual.
    const spin = (this.speed * dt) / 0.38;
    for (let i = 0; i < 4; i++) {
      this.wheels[i].rotation.x += spin;
      if (i < 2) this.wheels[i].rotation.y = 0;
    }
    // Body roll/lean for feel.
    this.group.rotation.z = -steer * Math.min(0.06, Math.abs(this.speed) * 0.0015);
  }

  // Slide along a wall after a collision: caller already resolved position.
  crash(speedLost) {
    if (this.dead) return;
    this.health -= Math.abs(speedLost) * 1.6;
    if (this.health <= 30 && !this.smoking) this.smoking = true;
    if (this.health <= 0) {
      this.dead = true;
      this.health = 0;
    }
  }

  updateLights(t) {
    if (!this.lightBar) return;
    const on = Math.sin(t * 14) > 0;
    this.lightBar.children[0].material.emissiveIntensity = on ? 2.4 : 0.15;
    this.lightBar.children[1].material.emissiveIntensity = on ? 0.15 : 2.4;
    if (this.glowRed) this.glowRed.material.opacity = on ? 0.3 : 0.05;
    if (this.glowBlue) this.glowBlue.material.opacity = on ? 0.05 : 0.3;
  }

  speedKmh() {
    return Math.abs(this.speed) * 3.2;
  }

  remove() {
    this.scene.remove(this.group);
  }
}
