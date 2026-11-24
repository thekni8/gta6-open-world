// Vesper gunmen: mission enemies with health bars, cover positions and
// return fire. They shoot back, miss often, and go down in three hits.

import { CONFIG } from '../config.js';
import { makeRng } from '../util/random.js';
import { resolveCircle } from '../world/city.js';

export class Enemies {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.list = [];
    this.rng = makeRng(31337);
  }

  spawn(count, center, radius) {
    this.clear();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + this.rng.range(-0.4, 0.4);
      const r = this.rng.range(radius * 0.45, radius);
      const x = center.x + Math.cos(angle) * r;
      const z = center.z + Math.sin(angle) * r;
      this.list.push(this.makeGunman(x, z));
    }
  }

  makeGunman(x, z) {
    const group = new THREE.Group();
    const coat = new THREE.MeshLambertMaterial({ color: 0x7a2020 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x1e1e24 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 4, 10), coat);
    torso.position.y = 1.16;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
    head.position.y = 1.9;
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 6), pants);
    legL.position.set(-0.15, 0.4, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.4), gunMat);
    gun.position.set(0.42, 1.3, 0.35);
    group.add(torso, head, legL, legR, gun);
    group.position.set(x, 0, z);

    // Health bar: white rim + dark backing + colored fill, billboarded.
    const bar = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(2.34, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }));
    rim.position.z = -0.01;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x51d96a, depthTest: false }));
    fg.position.z = 0.01;
    bar.add(rim, bg, fg);
    bar.position.y = 2.5;
    bar.renderOrder = 10;
    group.add(bar);

    this.scene.add(group);
    const enemy = {
      group, torso, bar, fg,
      x, z, hp: CONFIG.gunmanHp, maxHp: CONFIG.gunmanHp,
      alive: true, shootTimer: this.rng.range(0.8, 2.2),
      strafeDir: this.rng.chance(0.5) ? 1 : -1,
    };
    torso.userData.enemy = enemy;
    head.userData.enemy = enemy;
    return enemy;
  }

  aliveCount() {
    return this.list.filter((e) => e.alive).length;
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.group);
    this.list = [];
  }

  raycastTargets() {
    const out = [];
    for (const e of this.list) {
      if (e.alive) out.push(e.torso, e.group.children[1]);
    }
    return out;
  }

  damage(enemy, amount) {
    if (!enemy.alive) return false;
    enemy.hp -= amount;
    const frac = Math.max(0, enemy.hp / enemy.maxHp);
    enemy.fg.scale.x = frac;
    enemy.fg.position.x = -(1 - frac) * 1.05;
    enemy.fg.material.color.setHex(frac > 0.5 ? 0x51d96a : frac > 0.25 ? 0xf2c230 : 0xe84a4a);
    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.group.rotation.x = -Math.PI / 2;
      enemy.group.position.y = 0.35;
      enemy.bar.visible = false;
      return true;
    }
    return false;
  }

  // Gunmen strafe a little and shoot at the player. onShot(from, to, hit)
  // lets the game draw the tracer and apply damage.
  update(dt, playerPos, camera, onShot) {
    for (const e of this.list) {
      if (!e.alive) continue;
      e.bar.quaternion.copy(camera.quaternion);
      const dx = playerPos.x - e.x;
      const dz = playerPos.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.group.rotation.y = Math.atan2(dx, dz);
      if (dist > 14 && dist < 60) {
        // Close the distance slowly, strafing as they go.
        const step = 2.2 * dt;
        e.x += (dx / dist) * step + (-dz / dist) * e.strafeDir * step * 0.5;
        e.z += (dz / dist) * step + (dx / dist) * e.strafeDir * step * 0.5;
        e.group.position.x = e.x;
        e.group.position.z = e.z;
        resolveCircle(e.group.position, 0.5, this.colliders);
        e.x = e.group.position.x;
        e.z = e.group.position.z;
        if (this.rng.chance(dt * 0.4)) e.strafeDir *= -1;
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 55) {
        e.shootTimer = this.rng.range(1.3, 2.4);
        const from = new THREE.Vector3(e.x, 1.4, e.z);
        const to = new THREE.Vector3(playerPos.x, 1.3, playerPos.z);
        const hit = this.rng.chance(0.34);
        onShot?.(from, to, hit);
      }
    }
  }
}

// Meridian Bay round 9 — witness touch
