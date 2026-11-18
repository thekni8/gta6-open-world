// Combat: Kai's pistol (raycast from the crosshair) and melee punch, plus
// enemy gunmen who advance, take shots and fall when their health is gone.

import { CFG } from '../config.js';
import { buildPersonMesh } from '../player/character.js';
import { clamp } from '../util/random.js';

const THREE = window.THREE;

const FACTIONS = {
  vesper: { shirt: 0x8e44ad, skin: 0xe0ac69, hair: 0x1a1a1a, name: 'Vesper gunman' },
  harbor: { shirt: 0x16a085, skin: 0xc68642, hair: 0x4a3221, name: 'Harbor enforcer' },
};

class Enemy {
  constructor(G, x, z, faction) {
    this.G = G;
    this.x = x;
    this.z = z;
    this.heading = Math.atan2(G.player.x - x, G.player.z - z);
    this.health = CFG.enemyHealth;
    this.maxHealth = CFG.enemyHealth;
    this.faction = faction;
    this.shootTimer = 1 + Math.random() * 1.5;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 2 + Math.random() * 2;
    this.walkPhase = Math.random() * 6;
    this.dead = false;
    const f = FACTIONS[faction] || FACTIONS.vesper;
    this.mesh = buildPersonMesh(f.shirt, f.skin, f.hair);
    this.mesh.position.set(x, 0, z);
    // A slim health bar floating over the head.
    const barGeo = new THREE.PlaneGeometry(1.6, 0.18);
    this.barBg = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.8 }));
    this.barBg.position.y = 2.7;
    this.barFg = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xff4444 }));
    this.barFg.position.y = 2.7;
    this.barFg.position.z = 0.01;
    this.mesh.add(this.barBg, this.barFg);
    G.scene.add(this.mesh);
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.health -= amount;
    this.G.fx.burst(this.x, 1.4, this.z, 0xcc2222, 6, 3);
    if (this.health <= 0) {
      this.dead = true;
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.3;
      this.barBg.visible = false;
      this.barFg.visible = false;
      this.G.audio.enemyDown();
      this.G.hud.toast('Gunman down.');
    }
  }

  update(dt) {
    if (this.dead) return;
    const G = this.G;
    const player = G.player;
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    const dist = Math.hypot(dx, dz);
    this.heading = Math.atan2(dx, dz);
    // Advance until in range, then strafe to stay a moving target.
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 1.5 + Math.random() * 2;
      this.strafeDir *= -1;
    }
    let mx = 0;
    let mz = 0;
    if (dist > 16) {
      mx = dx / dist;
      mz = dz / dist;
    } else {
      mx = -dz / dist * this.strafeDir * 0.6;
      mz = dx / dist * this.strafeDir * 0.6;
    }
    const speed = dist > 16 ? 5.2 : 2.6;
    const nx = this.x + mx * speed * dt;
    const nz = this.z + mz * speed * dt;
    const c = G.city.collideCircle(nx, nz, 0.9);
    if (!c.hit) {
      this.x = nx;
      this.z = nz;
    } else {
      // Blocked: slide along the wall instead of pinning against it.
      const sx = this.x + mx * speed * dt;
      if (!G.city.collideCircle(sx, this.z, 0.9).hit) this.x = sx;
      const sz = this.z + mz * speed * dt;
      if (!G.city.collideCircle(this.x, sz, 0.9).hit) this.z = sz;
    }
    this.walkPhase += dt * speed * 1.5;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const s = Math.sin(this.walkPhase);
    const { legL, legR, armL, armR } = this.mesh.userData.limbs;
    legL.rotation.x = s * 0.6;
    legR.rotation.x = -s * 0.6;
    armR.rotation.x = -1.35; // gun raised
    armL.rotation.x = -0.5;
    // Face the health bar at the camera.
    this.barBg.lookAt(G.camera.position);
    this.barFg.lookAt(G.camera.position);
    this.barFg.scale.x = clamp(this.health / this.maxHealth, 0, 1);
    this.barFg.position.x = -(1 - this.barFg.scale.x) * 0.8;
    // Shoot the player when in range and roughly in the open.
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && dist < CFG.enemyAggroRange && !player.dead) {
      this.shootTimer = CFG.enemyShootInterval * (0.8 + Math.random() * 0.5);
      const hitChance = dist < 20 ? 0.42 : 0.24;
      this.G.fx.muzzle(this.x, 1.7, this.z, this.heading);
      this.G.audio.enemyShot(dist);
      if (Math.random() < hitChance) {
        player.takeDamage(CFG.enemyDamage, 'gunman');
        this.G.fx.burst(player.x, 1.4, player.z, 0xff3333, 5, 2.5);
      } else {
        // Near miss: kick up dust by the player.
        this.G.fx.burst(
          player.x + (Math.random() - 0.5) * 3, 0.4, player.z + (Math.random() - 0.5) * 3,
          0xcccccc, 4, 2,
        );
      }
    }
  }

  dispose() {
    this.G.scene.remove(this.mesh);
  }
}

// Distance from a point to a ray (origin + normalized direction), plus how
// far along the ray the closest point sits. Null when the point is behind.
function rayDistanceToPoint(origin, dir, px, py, pz) {
  const ox = px - origin.x;
  const oy = py - origin.y;
  const oz = pz - origin.z;
  const along = ox * dir.x + oy * dir.y + oz * dir.z;
  if (along < 0) return null;
  const cx = origin.x + dir.x * along;
  const cy = origin.y + dir.y * along;
  const cz = origin.z + dir.z * along;
  const dist = Math.hypot(px - cx, py - cy, pz - cz);
  return { dist, along };
}

export class Combat {
  constructor(G) {
    this.G = G;
    this.ammo = CFG.pistolAmmo;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.aiming = false;
    this.enemies = [];
    this.lastShotAt = -99;
    this.raycaster = new THREE.Raycaster();
    this.crosshairNdc = new THREE.Vector2(0, 0);
  }

  shotsFiredRecently(seconds) {
    return this.G.time - this.lastShotAt < seconds;
  }

  spawnEnemies(pos, count, faction) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 14 + (i % 3) * 7;
      const x = pos.x + Math.cos(a) * r;
      const z = pos.z + Math.sin(a) * r;
      const c = this.G.city.collideCircle(x, z, 1);
      this.enemies.push(new Enemy(this.G, c.x, c.z, faction));
    }
    this.G.hud.toast(`${count} gunmen incoming — take cover and fight back!`);
  }

  enemiesAlive() {
    return this.enemies.filter((e) => !e.dead).length;
  }

  clearEnemies() {
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
  }

  update(dt) {
    const G = this.G;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = CFG.pistolAmmo;
        G.hud.toast('Reloaded.');
      }
    }
    const player = G.player;
    this.aiming = !player.inCar && !player.dead && G.input.mouseDown;
    if (G.input.consumeMousePressed() && !player.inCar && !player.dead && G.state === 'playing') {
      this.tryShoot();
    }
    if (G.input.pressed('KeyR') && !this.reloading && this.ammo < CFG.pistolAmmo) {
      this.reloading = true;
      this.reloadTimer = CFG.pistolReloadSeconds;
      G.audio.reload();
    }
    if (G.input.pressed('KeyF')) this.tryMelee();
    for (const e of this.enemies) e.update(dt);
    // Clean up long-dead bodies.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        e.deadTimer = (e.deadTimer || 0) + dt;
        if (e.deadTimer > 20) {
          e.dispose();
          this.enemies.splice(i, 1);
        }
      }
    }
    G.hud.setAmmo(this.ammo, this.reloading);
  }

  tryShoot() {
    const G = this.G;
    if (this.fireCooldown > 0 || this.reloading) return;
    if (this.ammo <= 0) {
      G.audio.dryFire();
      G.hud.toast('Out of ammo — press R to reload.');
      this.reloading = true;
      this.reloadTimer = CFG.pistolReloadSeconds;
      return;
    }
    this.fireCooldown = CFG.pistolFireInterval;
    this.ammo--;
    this.lastShotAt = G.time;
    const player = G.player;
    // Aim the player at the crosshair while firing.
    player.heading = Math.atan2(
      Math.sin(G.cameraRig.yaw), Math.cos(G.cameraRig.yaw),
    );
    const from = new THREE.Vector3(player.x, 1.6, player.z);
    const dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    this.raycaster.set(G.camera.position, dir);
    this.raycaster.far = CFG.pistolRange;
    G.fx.muzzle(from.x, from.y, from.z, player.heading);
    G.audio.shot();
    G.fx.shake(0.08);
    G.hud.kickCrosshair();
    // Crime: firing with police nearby draws heat.
    if (G.police.nearestChaserDistance() < 60) G.wanted.addCrime('shootNearPolice');

    // Test enemies first — they are the usual target. A true 3D test: the
    // distance from the enemy's chest to the crosshair ray. Wherever the
    // crosshair points, the bullet goes — no flat-ground approximation.
    const camPos = G.camera.position;
    let hitEnemy = null;
    let hitDist = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = rayDistanceToPoint(camPos, dir, e.x, 1.4, e.z);
      if (d === null || d.along > CFG.pistolRange) continue;
      if (d.dist < 1.5 && d.along < hitDist) {
        hitDist = d.along;
        hitEnemy = e;
      }
    }
    if (hitEnemy) {
      hitEnemy.takeDamage(CFG.pistolDamage);
      G.hud.hitMarker();
      return;
    }
    // Then pedestrians (a crime), then cars.
    const ped = G.peds.nearest(
      G.camera.position.x + dir.x * 12, G.camera.position.z + dir.z * 12, 3.5,
    );
    if (ped) {
      ped.knockDown(10);
      G.wanted.addCrime('hurtPedestrian');
      G.hud.hitMarker();
      return;
    }
    const cars = [...G.traffic.cars, ...G.police.cars, ...G.parkedCars];
    for (const car of cars) {
      if (car.dead) continue;
      const d = rayDistanceToPoint(camPos, dir, car.x, 1.0, car.z);
      if (d === null || d.along > CFG.pistolRange) continue;
      if (d.dist < 2.4) {
        car.damage(CFG.pistolDamage * 0.6);
        G.fx.sparks(car.x, 1, car.z, 5);
        if (car.isPolice) G.wanted.addCrime('hurtPolice');
        G.hud.hitMarker();
        return;
      }
    }
    // Miss: show the impact point so shots feel real.
    const end = G.camera.position.clone().add(dir.multiplyScalar(40));
    G.fx.burst(end.x, Math.max(0.3, end.y), end.z, 0xaaaaaa, 3, 2);
  }

  tryMelee() {
    const G = this.G;
    const player = G.player;
    if (player.inCar || player.dead) return;
    G.audio.punch();
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < CFG.meleeRange && (dx * fx + dz * fz) > 0) {
        e.takeDamage(CFG.meleeDamage);
        e.x += fx * 1.5;
        e.z += fz * 1.5;
        G.hud.hitMarker();
        return;
      }
    }
    const ped = G.peds.nearest(player.x + fx * 2, player.z + fz * 2, 2);
    if (ped) {
      ped.knockDown(5);
      G.wanted.addCrime('hurtPedestrian');
    }
  }
}
