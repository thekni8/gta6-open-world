// Combat: pistol with a center crosshair, melee punch, and the armed
// gunmen missions 4 and 5 throw at you — with health bars, muzzle flashes,
// and hit feedback. Raycast shooting, occluded by buildings and cars.
import { CFG } from '../config.js';
import { buildCharacterMesh } from '../player/character.js';

function makeHealthBar() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 10;
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(1.7, 0.26, 1);
  sprite.renderOrder = 10;
  return {
    sprite,
    draw(frac) {
      const g = c.getContext('2d');
      g.fillStyle = '#222'; g.fillRect(0, 0, 64, 10);
      g.fillStyle = frac > 0.5 ? '#37d05a' : frac > 0.25 ? '#f2c230' : '#e84040';
      g.fillRect(1, 1, Math.max(0, 62 * frac), 8);
      tex.needsUpdate = true;
    },
  };
}

export function createCombat(scene, city, fx, sound) {
  const enemies = [];
  let ammo = CFG.pistolMag;
  let reloadT = 0;
  let fireT = 0;
  const raycaster = new THREE.Raycaster();

  function spawnEnemy(x, z, shirt = 0x6a1a2a) {
    const mesh = buildCharacterMesh(shirt, 0x8a5a3a);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const bar = makeHealthBar();
    bar.draw(1);
    bar.sprite.position.set(0, 2.7, 0);
    mesh.add(bar.sprite);
    const enemy = {
      mesh, bar, x, z, health: CFG.enemyHealth,
      fireT: 0.5 + Math.random(), dead: false, deathT: 0,
      heading: Math.atan2(0 - x, 0 - z),
    };
    mesh.traverse((o) => { o.userData.enemy = enemy; });
    enemies.push(enemy);
    return enemy;
  }

  function damageEnemy(enemy, dmg, hitPoint) {
    if (enemy.dead) return false;
    enemy.health -= dmg;
    enemy.bar.draw(Math.max(0, enemy.health / CFG.enemyHealth));
    fx.hitSpark(hitPoint.x, hitPoint.y, hitPoint.z);
    if (enemy.health <= 0) {
      enemy.dead = true;
      enemy.deathT = 0;
      enemy.mesh.rotation.x = Math.PI / 2;
      enemy.mesh.position.y = 0.3;
      enemy.bar.sprite.visible = false;
      sound?.enemyDown();
      return true;
    }
    sound?.hitMarker();
    return false;
  }

  return {
    enemies,
    get ammo() { return ammo; },
    get reloading() { return reloadT > 0; },
    spawnEnemies(spots) {
      for (const s of spots) spawnEnemy(s.x, s.z, s.shirt);
    },
    clearEnemies() {
      for (const e of enemies) scene.remove(e.mesh);
      enemies.length = 0;
    },
    aliveCount() { return enemies.filter((e) => !e.dead).length; },
    reload() {
      if (reloadT <= 0 && ammo < CFG.pistolMag) {
        reloadT = CFG.pistolReloadS;
        sound?.reload();
      }
    },
    // Fire the pistol through the crosshair. Returns 'enemy' | 'world' | 'car' | null.
    shoot(camera, blockers, carGroups) {
      if (fireT > 0 || reloadT > 0) return 'busy';
      if (ammo <= 0) { this.reload(); return 'empty'; }
      fireT = CFG.pistolFireS;
      ammo -= 1;
      sound?.gunshot();
      fx.muzzle(camera);
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.far = CFG.pistolRange;
      const targets = [];
      for (const e of enemies) if (!e.dead) targets.push(e.mesh);
      for (const cg of carGroups || []) targets.push(cg);
      const hits = raycaster.intersectObjects(targets.concat(blockers), true);
      if (!hits.length) return 'miss';
      const hit = hits[0];
      const enemy = hit.object.userData.enemy;
      if (enemy && !enemy.dead) {
        const killed = damageEnemy(enemy, CFG.pistolDamage, hit.point);
        return killed ? 'kill' : 'enemy';
      }
      fx.hitSpark(hit.point.x, hit.point.y, hit.point.z);
      return hit.object.userData.isCar ? 'car' : 'world';
    },
    // Melee punch: nearest living enemy in front, within reach.
    melee(playerPos, playerHeading) {
      sound?.punch();
      let best = null, bd = CFG.meleeRange;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - playerPos.x, e.z - playerPos.z);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) return false;
      const killed = damageEnemy(best, CFG.meleeDamage, new THREE.Vector3(best.x, 1.4, best.z));
      fx.hitSpark(best.x, 1.4, best.z);
      return killed ? 'kill' : 'enemy';
    },
    update(dt, playerPos, onPlayerHit) {
      fireT = Math.max(0, fireT - dt);
      if (reloadT > 0) {
        reloadT -= dt;
        if (reloadT <= 0) ammo = CFG.pistolMag;
      }
      for (const e of enemies) {
        if (e.dead) {
          e.deathT += dt;
          if (e.deathT > 2.5) e.mesh.position.y -= dt * 0.8;
          continue;
        }
        const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
        const dist = Math.hypot(dx, dz);
        e.heading = Math.atan2(dx, dz);
        e.mesh.rotation.y = e.heading;
        // Close in slowly if far away; hold ground and shoot when in range.
        if (dist > 26) {
          const nx = e.x + Math.sin(e.heading) * 4.5 * dt;
          const nz = e.z + Math.cos(e.heading) * 4.5 * dt;
          const fixed = city.resolveCircle(nx, nz, 0.8);
          e.x = fixed.x; e.z = fixed.z;
          e.mesh.position.set(e.x, 0, e.z);
        }
        if (dist < 48) {
          e.fireT -= dt;
          if (e.fireT <= 0) {
            e.fireT = CFG.enemyFireS * (0.8 + Math.random() * 0.5);
            fx.enemyMuzzle(e.x, e.z, e.heading);
            sound?.enemyShot(dist);
            // Hit chance falls with distance; point-blank is dangerous.
            const chance = dist < 8 ? 0.55 : dist < 20 ? 0.32 : 0.14;
            if (Math.random() < chance) onPlayerHit?.(CFG.enemyDamage);
          }
        }
      }
      // Sweep long-dead enemies out of the list.
      for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].dead && enemies[i].deathT > 4) {
          scene.remove(enemies[i].mesh);
          enemies.splice(i, 1);
        }
      }
    },
  };
}
