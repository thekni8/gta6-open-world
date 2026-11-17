// Kai Mercer on foot: a low-poly figure (capsule body, head, swinging
// limbs) with arcade movement — WASD relative to the camera, Shift to
// sprint, health, and a simple walk-cycle animation.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp } from '../util/random.js';

export class Character {
  constructor(scene) {
    this.group = new THREE.Group();
    this.health = CONFIG.player.health;
    this.heading = 0; // radians, 0 = facing -Z... facing +Z? see update
    this.speed = 0;
    this.walkPhase = 0;
    this.alive = true;
    this.pos = new THREE.Vector3(30, 0, 210);

    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
    const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    // Torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), jacket);
    this.torso.position.y = 1.25;
    this.torso.castShadow = true;
    this.group.add(this.torso);
    // Head
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
    this.head.position.y = 1.92;
    this.head.castShadow = true;
    this.group.add(this.head);
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), hair);
    hairTop.position.y = 2.16;
    this.group.add(hairTop);
    // Arms (pivot at the shoulder)
    this.armL = new THREE.Group();
    this.armL.position.set(-0.45, 1.6, 0);
    const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), jacket);
    armLMesh.position.y = -0.35;
    armLMesh.castShadow = true;
    this.armL.add(armLMesh);
    this.group.add(this.armL);
    this.armR = new THREE.Group();
    this.armR.position.set(0.45, 1.6, 0);
    const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), jacket);
    armRMesh.position.y = -0.35;
    armRMesh.castShadow = true;
    this.armR.add(armRMesh);
    this.group.add(this.armR);
    // Legs (pivot at the hip)
    this.legL = new THREE.Group();
    this.legL.position.set(-0.18, 0.85, 0);
    const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.26), jeans);
    legLMesh.position.y = -0.42;
    legLMesh.castShadow = true;
    this.legL.add(legLMesh);
    this.group.add(this.legL);
    this.legR = new THREE.Group();
    this.legR.position.set(0.18, 0.85, 0);
    const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.26), jeans);
    legRMesh.position.y = -0.42;
    legRMesh.castShadow = true;
    this.legR.add(legRMesh);
    this.group.add(this.legR);

    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  /** Move on foot. axis = {x: strafe, y: forward} in camera space. */
  update(dt, axis, camYaw, sprinting, city) {
    if (!this.alive) return;
    const targetSpeed = axis.y !== 0 || axis.x !== 0
      ? (sprinting ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed)
      : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 10);
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
      this.walkPhase += dt * this.speed * 1.6;
    }
    // Walk cycle: legs and arms swing in opposition, torso bobs.
    const swing = Math.min(1, this.speed / CONFIG.player.walkSpeed) * 0.6;
    const s = Math.sin(this.walkPhase);
    this.legL.rotation.x = s * swing;
    this.legR.rotation.x = -s * swing;
    this.armL.rotation.x = -s * swing * 0.8;
    this.armR.rotation.x = s * swing * 0.8;
    this.torso.position.y = 1.25 + Math.abs(Math.cos(this.walkPhase)) * 0.05 * Math.min(1, this.speed / 4);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

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
