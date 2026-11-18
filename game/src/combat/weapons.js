// Melee + pistol combat: raycast shooting from the camera, muzzle flash,
// tracers, hit feedback, and enemy gunmen with health bars for missions.
import { CONFIG } from '../config.js';

export class Weapons {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cooldown = 0;
    this.raycaster = new THREE.Raycaster();
    this.tracers = [];
    this.tracerGeo = new THREE.BufferGeometry();
    this.enemies = []; // mission gunmen (ped-shaped, hostile)
    this.enemyHealthBars = [];
  }

  // Spawn a hostile gunman at a position. Returns the ped record.
  // The spawn point is nudged to clear ground — an enemy entombed inside
  // a container or a building could never be seen or shot.
  spawnEnemy(game, x, z) {
    const spot = this._clearSpot(game, x, z);
    const ped = game.peds._makePed(spot.x, spot.z);
    ped.isEnemy = true;
    ped.health = 100;
    ped.state = 'guard';
    ped.shootTimer = 1 + Math.random();
    ped.target = { x, z };
    // Enemies wear dark red — readable as hostile at a glance.
    ped.group.children[0].material = new THREE.MeshStandardMaterial({ color: 0x8c1d18, roughness: 0.9 });
    game.peds.peds.push(ped);
    // Floating health bar (two thin quads, billboarded in update).
    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: false }),
    );
    barBg.renderOrder = 10;
    const barFg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xff3333, depthTest: false }),
    );
    barFg.renderOrder = 11;
    barBg.position.y = 2.4;
    barFg.position.y = 2.4;
    ped.group.add(barBg, barFg);
    ped.healthBar = barFg;
    ped.healthBarBg = barBg;
    this.enemies.push(ped);
    return ped;
  }

  // Find clear ground near (x, z): outside every building/container
  // collider, so a spawned enemy is always visible and hittable.
  _clearSpot(game, x, z) {
    const fits = (px, pz) => {
      for (const c of game.city.colliders) {
        if (px > c.minX - 1 && px < c.maxX + 1 && pz > c.minZ - 1 && pz < c.maxZ + 1) return false;
      }
      return true;
    };
    if (fits(x, z)) return { x, z };
    for (let r = 2; r <= 14; r += 2) {
      for (let a = 0; a < 8; a++) {
        const px = x + Math.cos((a / 8) * Math.PI * 2) * r;
        const pz = z + Math.sin((a / 8) * Math.PI * 2) * r;
        if (fits(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  clearEnemies(game) {
    for (const e of this.enemies) {
      game.peds.peds.splice(game.peds.peds.indexOf(e), 1);
      game.scene.remove(e.group);
    }
    this.enemies = [];
  }

  aliveEnemies() {
    return this.enemies.filter((e) => e.state !== 'down');
  }

  // Player attacks: punch if a target is close, otherwise fire the pistol.
  tryAttack(game) {
    const player = game.player;
    if (this.cooldown > 0 || player.dead) return;
    // Melee first: anyone within punch range gets a fist.
    const victim = game.peds.nearest(player.pos.x, player.pos.z, CONFIG.player.punchRange);
    if (victim && !victim.isEnemy) {
      this.cooldown = 0.35;
      player.punchTimer = 0.25;
      game.sound.punch();
      game.particles.blood(victim.pos.x, 1.2, victim.pos.z);
      const wentDown = game.peds.hit(victim, CONFIG.player.punchDamage, game);
      game.wanted.commit(wentDown ? 'killPedestrian' : 'hitPedestrian', game);
      game.peds.scare(player.pos.x, player.pos.z, 25);
      game.chaosAt = { x: player.pos.x, z: player.pos.z, t: game.time };
      return;
    }
    if (victim && victim.isEnemy) {
      this.cooldown = 0.35;
      player.punchTimer = 0.25;
      game.sound.punch();
      const wentDown = game.peds.hit(victim, CONFIG.player.punchDamage, game);
      if (wentDown) game.missions?.onEnemyDown?.(victim);
      return;
    }
    // Pistol: fire along the camera's horizontal look direction from the
    // muzzle at chest height. (A screen-centre ray from the high follow
    // camera dives into the ground metres ahead; the horizontal ray aims
    // where the player is looking, like a real third-person shooter.)
    if (player.ammo <= 0) {
      game.sound.uiClick();
      player.reload(game);
      return;
    }
    this.cooldown = 0.22;
    player.ammo -= 1;
    game.sound.gunshot();
    const muzzle = player.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    game.particles.muzzle(muzzle.x, muzzle.y, muzzle.z);
    const camera = game.cameraRig.camera;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const origin = muzzle.clone();
    let bestDist = CONFIG.player.pistolRange;
    let hitPed = null;
    for (const p of game.peds.peds) {
      if (p.state === 'down') continue;
      const toPed = new THREE.Vector3(p.pos.x - origin.x, 1.2 - origin.y, p.pos.z - origin.z);
      const along = toPed.dot(dir);
      if (along < 0 || along > bestDist) continue;
      const closest = origin.clone().add(dir.clone().multiplyScalar(along));
      const perp = Math.hypot(closest.x - p.pos.x, closest.y - 1.2, closest.z - p.pos.z);
      if (perp < 0.9) {
        bestDist = along;
        hitPed = p;
      }
    }
    // Building walls block the shot.
    for (const c of this.city.colliders) {
      const t = rayHitsBox(origin, dir, c, bestDist);
      if (t !== null && t < bestDist) {
        bestDist = t;
        hitPed = null;
      }
    }
    const hitPoint = origin.clone().add(dir.clone().multiplyScalar(bestDist));
    this._spawnTracer(muzzle, hitPoint);
    if (hitPed) {
      game.particles.blood(hitPed.pos.x, 1.3, hitPed.pos.z);
      game.hud.showDamageNumber(CONFIG.player.pistolDamage);
      const wentDown = game.peds.hit(hitPed, CONFIG.player.pistolDamage, game);
      if (!hitPed.isEnemy) {
        game.wanted.commit(wentDown ? 'killPedestrian' : 'shootWitnessed', game);
        game.peds.scare(player.pos.x, player.pos.z, 30);
      } else if (wentDown) {
        game.missions?.onEnemyDown?.(hitPed);
      }
    } else if (bestDist < CONFIG.player.pistolRange - 0.5) {
      game.particles.sparks(hitPoint.x, hitPoint.y, hitPoint.z);
    }
    game.chaosAt = { x: player.pos.x, z: player.pos.z, t: game.time };
    if (!hitPed || !hitPed.isEnemy) game.wanted.commit('shootWitnessed', game);
  }

  _spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(line);
    this.tracers.push({ line, life: 0.15 });
  }

  update(dt, game) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    // Fade tracers out fast.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        tr.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    // Enemy AI: stand ground and shoot at the player in range.
    const player = game.player;
    for (const e of this.enemies) {
      if (e.state === 'down') continue;
      // Billboard the health bar toward the camera.
      if (e.healthBar) {
        e.healthBar.lookAt(game.cameraRig.camera.position);
        e.healthBarBg.lookAt(game.cameraRig.camera.position);
        const frac = Math.max(0, e.health / 100);
        e.healthBar.scale.x = frac;
        e.healthBar.position.x = -(1 - frac) * 0.75;
      }
      const dist = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
      if (dist > 55 || player.dead) continue;
      // Face the player.
      e.angle = Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
      e.group.rotation.y = e.angle;
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 45) {
        e.shootTimer = 1.1 + Math.random() * 0.9;
        game.sound.gunshot();
        game.particles.muzzle(e.pos.x, 1.4, e.pos.z);
        const from = new THREE.Vector3(e.pos.x, 1.4, e.pos.z);
        const to = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
        this._spawnTracer(from, to);
        // Hit chance falls with distance; the player can dodge behind cover.
        const hitChance = Math.max(0.12, 0.55 - dist * 0.008);
        if (Math.random() < hitChance) {
          player.damage(7 + Math.random() * 6, game);
          game.particles.blood(player.pos.x, 1.2, player.pos.z);
        } else {
          game.particles.sparks(to.x + (Math.random() - 0.5) * 2, to.y, to.z + (Math.random() - 0.5) * 2);
        }
      }
    }
  }
}

// Slab-method ray vs AABB (y is 0..60 for buildings). Returns t or null.
function rayHitsBox(origin, dir, box, maxT) {
  let tMin = 0;
  let tMax = maxT;
  const axes = [
    [origin.x, dir.x, box.minX, box.maxX],
    [origin.y, dir.y, 0, 60],
    [origin.z, dir.z, box.minZ, box.maxZ],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }
  }
  return tMin;
}
