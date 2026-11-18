// Kai Mercer on foot: movement, walk-cycle animation, health and entering
// or leaving cars. The mesh is a low-poly figure built from boxes — shirt,
// jeans, skin and hair — with legs that swing while he walks.

import { CFG } from '../config.js';
import { clamp, angleLerp } from '../util/random.js';

const THREE = window.THREE;

export function buildPersonMesh(shirtColor, skinColor, hairColor) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const hair = new THREE.MeshLambertMaterial({ color: hairColor });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.95, 0.42), shirt);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.44), skin);
  head.position.y = 1.95;
  head.castShadow = true;
  group.add(head);

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.48), hair);
  hairTop.position.y = 2.24;
  group.add(hairTop);

  const legGeo = new THREE.BoxGeometry(0.3, 0.75, 0.34);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.21, 0.38, 0);
  legL.geometry = legGeo.clone();
  legL.geometry.translate(0, -0.32, 0);
  legL.position.y = 0.72;
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.geometry = legGeo.clone();
  legR.geometry.translate(0, -0.32, 0);
  legR.position.set(0.21, 0.72, 0);
  legR.castShadow = true;
  group.add(legR);

  const armGeo = new THREE.BoxGeometry(0.22, 0.8, 0.26);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.geometry = armGeo.clone();
  armL.geometry.translate(0, -0.34, 0);
  armL.position.set(-0.52, 1.6, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.geometry = armGeo.clone();
  armR.geometry.translate(0, -0.34, 0);
  armR.position.set(0.52, 1.6, 0);
  group.add(armR);

  group.userData.limbs = { legL, legR, armL, armR };
  return group;
}

export class Character {
  constructor(G, x, z) {
    this.G = G;
    this.x = x;
    this.z = z;
    this.heading = 0; // radians; 0 faces -z... we use atan2(dx, dz) convention
    this.speed = 0;
    this.health = CFG.playerHealth;
    this.maxHealth = CFG.playerHealth;
    this.inCar = null;
    this.walkPhase = 0;
    this.lastDamageAt = -99;
    this.dead = false;
    this.mesh = buildPersonMesh(0x1abc9c, 0xc68642, 0x1a1a1a);
    this.mesh.position.set(x, 0, z);
    G.scene.add(this.mesh);
  }

  get position() {
    return { x: this.x, z: this.z };
  }

  update(dt, input, cameraYaw) {
    if (this.dead || this.inCar) return;
    const G = this.G;
    // Movement relative to the camera yaw: W walks away from the camera,
    // D strafes to the camera's right. Forward is (sin yaw, cos yaw) and
    // right is (-cos yaw, sin yaw) in world xz.
    const fwd = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const right = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const moving = fwd !== 0 || right !== 0;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const topSpeed = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
    if (moving) {
      const len = Math.hypot(fwd, right);
      const f = fwd / len;
      const r = right / len;
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      const wx = sin * f - cos * r;
      const wz = cos * f + sin * r;
      const targetHeading = Math.atan2(wx, wz);
      this.heading = angleLerp(this.heading, targetHeading, Math.min(1, dt * 12));
      this.speed = lerpSpeed(this.speed, topSpeed, dt * 8);
      this.x += wx * this.speed * dt;
      this.z += wz * this.speed * dt;
      this.walkPhase += dt * this.speed * 1.35;
      if (Math.sin(this.walkPhase) > 0.96 && this.speed > 3) {
        G.audio.footstep();
      }
    } else {
      this.speed = lerpSpeed(this.speed, 0, dt * 10);
      this.walkPhase *= 0.9;
    }
    // World bounds + building collision.
    this.x = clamp(this.x, -CFG.cityBound, CFG.cityBound);
    this.z = clamp(this.z, -CFG.cityBound, CFG.cityBound + 60);
    const c = G.city.collideCircle(this.x, this.z, CFG.playerRadius);
    this.x = c.x;
    this.z = c.z;
    // Health regen after a calm stretch.
    if (G.time - this.lastDamageAt > CFG.healthRegenDelay && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + CFG.healthRegenRate * dt);
    }
    this.syncMesh(dt, moving);
  }

  syncMesh(dt, moving) {
    const m = this.mesh;
    m.position.set(this.x, 0, this.z);
    m.rotation.y = this.heading;
    const swing = moving ? Math.min(1, this.speed / CFG.walkSpeed) * 0.75 : 0;
    const s = Math.sin(this.walkPhase);
    const { legL, legR, armL, armR } = m.userData.limbs;
    legL.rotation.x = s * swing;
    legR.rotation.x = -s * swing;
    armL.rotation.x = -s * swing * 0.8;
    armR.rotation.x = s * swing * 0.8;
    if (this.G.combat && this.G.combat.aiming) {
      armR.rotation.x = -1.35; // pistol raised
      armL.rotation.x = -0.6;
    }
    m.visible = !this.inCar;
  }

  enterCar(car) {
    this.inCar = car;
    car.driver = 'player';
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    const side = 2.8;
    const px = car.x + Math.cos(car.heading) * side;
    const pz = car.z - Math.sin(car.heading) * side;
    const c = this.G.city.collideCircle(px, pz, CFG.playerRadius);
    this.x = c.x;
    this.z = c.z;
    this.heading = car.heading;
    this.inCar = null;
    car.driver = 'none';
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }

  takeDamage(amount, source) {
    if (this.dead) return;
    this.health -= amount;
    this.lastDamageAt = this.G.time;
    this.G.fx.shake(0.25);
    this.G.hud.damageFlash();
    this.G.audio.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.G.onPlayerDied(source);
    }
  }

  healFull() {
    this.health = this.maxHealth;
    this.dead = false;
  }

  teleport(x, z) {
    this.x = x;
    this.z = z;
    this.mesh.position.set(x, 0, z);
    if (this.inCar) {
      this.inCar.x = x;
      this.inCar.z = z;
      this.inCar.syncMesh();
    }
  }
}

function lerpSpeed(current, target, t) {
  return current + (target - current) * Math.min(1, t);
}
