// Kai Mercer on foot: a low-poly figure — rust jacket, dark jeans, cap —
// with arcade movement (WASD relative to the camera, Shift to sprint),
// health, and a walk cycle with swinging limbs and a bobbing torso.

import * as THREE from 'three';
import { CONFIG } from '../config.js';

function limb(w, h, d, mat, y) {
  const pivot = new THREE.Group();
  pivot.position.y = y;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = -h / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

export class Character {
  constructor(scene) {
    this.group = new THREE.Group();
    this.health = CONFIG.player.health;
    this.heading = 0;
    this.speed = 0;
    this.walkPhase = 0;
    this.alive = true;
    this.pos = new THREE.Vector3(128, 0, 224);

    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const jacket = new THREE.MeshLambertMaterial({ color: 0xb84a32 });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
    const cap = new THREE.MeshLambertMaterial({ color: 0x274a6a });
    const shoe = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    // Torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.42), jacket);
    this.torso.position.y = 1.26;
    this.torso.castShadow = true;
    this.group.add(this.torso);
    // Head + cap
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
    this.head.position.y = 1.93;
    this.head.castShadow = true;
    this.group.add(this.head);
    const capTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.46), cap);
    capTop.position.y = 2.18;
    this.group.add(capTop);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.24), cap);
    brim.position.set(0, 2.13, 0.3);
    this.group.add(brim);
    // Arms, pivoted at the shoulder
    this.armL = limb(0.22, 0.78, 0.22, jacket, 1.62);
    this.armL.position.x = -0.47;
    this.group.add(this.armL);
    this.armR = limb(0.22, 0.78, 0.22, jacket, 1.62);
    this.armR.position.x = 0.47;
    this.group.add(this.armR);
    // Legs, pivoted at the hip, with shoe blocks at the bottom
    this.legL = limb(0.26, 0.85, 0.26, jeans, 0.85);
    this.legL.position.x = -0.18;
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.44), shoe);
    shoeL.position.set(0, -0.82, 0.08);
    this.legL.add(shoeL);
    this.group.add(this.legL);
    this.legR = limb(0.26, 0.85, 0.26, jeans, 0.85);
    this.legR.position.x = 0.18;
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.44), shoe);
    shoeR.position.set(0, -0.82, 0.08);
    this.legR.add(shoeR);
    this.group.add(this.legR);

    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  /** Move on foot. axis = {x: strafe, y: forward} in camera space. */
  update(dt, axis, camYaw, sprinting, city) {
    if (!this.alive) return;
    const moving = axis.x !== 0 || axis.y !== 0;
    const target = moving ? (sprinting ? CONFIG.player.sprint : CONFIG.player.walk) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    if (this.speed > 0.1) {
      // Camera-relative direction: camera yaw 0 looks toward -Z.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const dx = -sin * axis.y + cos * axis.x;
      const dz = -cos * axis.y - sin * axis.x;
      const len = Math.hypot(dx, dz) || 1;
      this.pos.x += (dx / len) * this.speed * dt;
      this.pos.z += (dz / len) * this.speed * dt;
      this.heading = Math.atan2(dx, dz);
      city.collideCircle(this.pos, CONFIG.player.radius);
      this.walkPhase += dt * this.speed * 1.7;
    }
    // Walk cycle: legs and arms swing in opposition, torso bobs.
    const swing = Math.min(1, this.speed / CONFIG.player.walk) * 0.62;
    const s = Math.sin(this.walkPhase);
    this.legL.rotation.x = s * swing;
    this.legR.rotation.x = -s * swing;
    this.armL.rotation.x = -s * swing * 0.8;
    this.armR.rotation.x = s * swing * 0.8;
    const bob = Math.abs(Math.cos(this.walkPhase)) * 0.05 * Math.min(1, this.speed / 4);
    this.torso.position.y = 1.26 + bob;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  /** Take damage; returns true if Kai went down. */
  damage(amount) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.alive = false;
      this.group.rotation.x = -Math.PI / 2; // fall flat
      this.group.position.y = 0.4;
      return true;
    }
    return false;
  }

  heal(amount) {
    this.health = Math.min(CONFIG.player.health, this.health + amount);
  }

  respawn(x, z) {
    this.pos.set(x, 0, z);
    this.health = CONFIG.player.health;
    this.alive = true;
    this.group.rotation.x = 0;
    this.group.position.copy(this.pos);
  }

  setVisible(v) {
    this.group.visible = v;
  }
}
