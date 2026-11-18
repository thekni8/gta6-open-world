// Combat: a pistol with a magazine and reload, a melee swing, tracer
// lines and hit feedback — plus the gunmen the missions throw at the
// player, who close in and take pot-shots back.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { range, clamp } from '../util/random.js';

export class Weapons {
  constructor(scene, camera, rng) {
    this.scene = scene;
    this.camera = camera;
    this.rng = rng;
    this.ammo = CONFIG.combat.magazine;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0;
    this.raycaster = new THREE.Raycaster();
    this.tracerMat = new THREE.LineBasicMaterial({
      color: 0xffe9a8,
      transparent: true,
      opacity: 0.9,
    });
    this.onShot = null; // () => {} — sound + scare peds
    this.onHit = null; // (kind, target) => {} — wanted, mission kills
  }

  /** Fire the pistol from the camera centre. Returns what was hit, if anything.
   *  Two-step aim: the camera ray through the crosshair finds the aim point
   *  (what the player sees), then the shot travels from Kai's chest to that
   *  point — so the bullet goes where the crosshair points, at chest height,
   *  instead of diving into the ground a few metres ahead. */
  shoot(ctx) {
    if (this.cooldown > 0 || this.reloading) return null;
    if (this.ammo <= 0) {
      this.reload();
      return null;
    }
    this.cooldown = CONFIG.combat.fireGap;
    this.ammo -= 1;
    this.onShot?.();
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    // Step 1: where does the crosshair point?
    this.raycaster.set(origin, dir);
    this.raycaster.far = CONFIG.combat.pistolRange;
    const worldTargets = [];
    for (const e of ctx.enemies.list) worldTargets.push(e.mesh);
    for (const p of ctx.peds.peds) if (p.state !== 'down') worldTargets.push(p.mesh);
    for (const c of ctx.traffic.cars) worldTargets.push(c.group);
    for (const c of ctx.police.cars) worldTargets.push(c.group);
    worldTargets.push(ctx.city.group);
    const worldHits = this.raycaster.intersectObjects(worldTargets, true);
    const aimPoint = worldHits.length > 0
      ? worldHits[0].point.clone()
      : origin.clone().addScaledVector(dir, CONFIG.combat.pistolRange);
    // Step 2: the shot, from Kai's chest to the aim point.
    const pp = ctx.playerPos();
    const muzzle = new THREE.Vector3(pp.x, pp.y + 1.4, pp.z);
    const shotDir = aimPoint.clone().sub(muzzle);
    const shotLen = shotDir.length();
    if (shotLen < 0.5) return null;
    shotDir.normalize();
    this.raycaster.set(muzzle, shotDir);
    this.raycaster.far = Math.min(shotLen, CONFIG.combat.pistolRange);
    const liveTargets = worldTargets.slice(0, -1); // everything but the city
    const hits = this.raycaster.intersectObjects(liveTargets, true);
    let end = aimPoint.clone();
    let hit = null;
    if (hits.length > 0) {
      const h = hits[0];
      end = h.point.clone();
      hit = this.identifyHit(h.object);
      if (hit) this.applyHit(hit, ctx, h.point);
    }
    this.showTracer(muzzle, end);
    ctx.particles.spark(end.x, end.y, end.z, 6);
    return hit;
  }

  identifyHit(object) {
    let o = object;
    while (o) {
      if (o.userData.enemy) return { kind: 'enemy', enemy: o.userData.enemy };
      if (o.userData.ped) return { kind: 'ped', ped: o.userData.ped };
      if (o.userData.car) return { kind: 'car', car: o.userData.car };
      o = o.parent;
    }
    return null;
  }

  applyHit(hit, ctx, point) {
    if (hit.kind === 'enemy') {
      const dead = hit.enemy.damage(CONFIG.combat.pistolDamage);
      ctx.particles.blood(point.x, point.y, point.z);
      if (dead) {
        ctx.enemies.remove(hit.enemy);
        this.onHit?.('enemy', hit.enemy);
      }
    } else if (hit.kind === 'ped') {
      ctx.peds.knockDown(hit.ped);
      this.onHit?.('ped', hit.ped);
    } else if (hit.kind === 'car') {
      const destroyed = hit.car.damage(CONFIG.combat.pistolDamage);
      if (destroyed) ctx.particles.explosion(hit.car.pos.x, 1, hit.car.pos.z);
      this.onHit?.('car', hit.car);
    }
  }

  showTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, this.tracerMat);
    this.scene.add(line);
    setTimeout(() => {
      this.scene.remove(line);
      geo.dispose();
    }, 60);
  }

  /** Melee swing: hurts the nearest enemy or ped within range. */
  melee(ctx) {
    if (this.cooldown > 0) return;
    this.cooldown = 0.45;
    const pp = ctx.playerPos();
    let best = null;
    let bd = CONFIG.player.reach;
    for (const e of ctx.enemies.list) {
      const d = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z);
      if (d < bd) {
        bd = d;
        best = { kind: 'enemy', enemy: e };
      }
    }
    if (!best) {
      for (const p of ctx.peds.peds) {
        if (p.state === 'down') continue;
        const d = Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z);
        if (d < bd) {
          bd = d;
          best = { kind: 'ped', ped: p };
        }
      }
    }
    if (best) {
      if (best.kind === 'enemy') {
        const dead = best.enemy.damage(CONFIG.player.punch);
        if (dead) {
          ctx.enemies.remove(best.enemy);
          this.onHit?.('enemy', best.enemy);
        }
      } else {
        ctx.peds.knockDown(best.ped);
        this.onHit?.('ped', best.ped);
      }
    }
    this.onShot?.();
  }

  reload() {
    if (this.reloading || this.ammo === CONFIG.combat.magazine) return;
    this.reloading = true;
    this.reloadTimer = CONFIG.combat.reloadTime;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = CONFIG.combat.magazine;
      }
    }
  }
}

/** 2D segment vs AABB test (slab method): does the segment from (x1,z1)
 *  to (x2,z2) cross the box? Used for line-of-sight at chest height —
 *  every solid in the city is taller than a gunman. */
function segmentHitsBox(x1, z1, x2, z2, b) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  let tMin = 0;
  let tMax = 1;
  for (const [p, d, lo, hi] of [[x1, dx, b.minX, b.maxX], [z1, dz, b.minZ, b.maxZ]]) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
    } else {
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

export class Enemies {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.list = [];
  }

  makeGunman() {
    const group = new THREE.Group();
    const vest = new THREE.MeshLambertMaterial({ color: 0x5a2a6a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.85, 0.4), vest);
    torso.position.y = 1.25;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
    head.position.y = 1.92;
    group.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), pants);
    gun.position.set(0.3, 1.3, 0.35);
    group.add(gun);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.26), pants);
    legL.position.set(-0.18, 0.42, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.18;
    group.add(legR);
    return group;
  }

  spawn(count, center) {
    for (let i = 0; i < count; i++) {
      const mesh = this.makeGunman();
      const x = center.x + range(this.rng, -16, 16);
      const z = center.z + range(this.rng, -16, 16);
      const pos = new THREE.Vector3(x, 0, z);
      // Never spawn inside a container or a wall: push out of any solid.
      this.city.collideCircle(pos, 0.5);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      const enemy = {
        mesh,
        pos,
        health: CONFIG.combat.enemyHealth,
        shootTimer: range(this.rng, 0.5, 1.5),
        heading: 0,
      };
      enemy.damage = (amount) => {
        enemy.health -= amount;
        return enemy.health <= 0;
      };
      mesh.userData.enemy = enemy;
      this.list.push(enemy);
    }
  }

  remove(enemy) {
    const i = this.list.indexOf(enemy);
    if (i >= 0) this.list.splice(i, 1);
    this.scene.remove(enemy.mesh);
  }

  clear() {
    for (const e of [...this.list]) this.remove(e);
  }

  /** Does a chest-height line from the enemy to the player clear every solid? */
  hasLineOfSight(from, to) {
    for (const b of this.city.buildings) {
      if (b.h < 1.2) continue;
      if (segmentHitsBox(from.x, from.z, to.x, to.z, b)) return false;
    }
    return true;
  }

  update(dt, playerPos, onShootPlayer) {
    for (const e of this.list) {
      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      e.heading = Math.atan2(dx, dz);
      e.mesh.rotation.y = e.heading;
      const los = this.hasLineOfSight(e.pos, playerPos);
      // Close in if far, or if cover blocks the shot (a gunman who can't
      // see the player walks around the container until he can — he never
      // just stands behind a box shooting through it). Hold and shoot
      // only when near with a clear line.
      if (dist > 26 || !los) {
        e.pos.x += Math.sin(e.heading) * CONFIG.combat.enemyChaseSpeed * dt;
        e.pos.z += Math.cos(e.heading) * CONFIG.combat.enemyChaseSpeed * dt;
        this.city.collideCircle(e.pos, 0.5);
        e.mesh.position.copy(e.pos);
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < CONFIG.combat.enemyRange && los) {
        e.shootTimer = CONFIG.combat.enemyShotGap * range(this.rng, 0.8, 1.3);
        // Inaccurate: only some shots land, fewer at range.
        if (this.rng() < clamp(0.38 - dist / 160, 0.1, 0.38)) {
          onShootPlayer?.(CONFIG.combat.enemyDamage);
        }
      }
    }
  }
}
