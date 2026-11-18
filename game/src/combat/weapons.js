/* Combat: pistol hitscan with a center crosshair, melee punch,
   and the gunman enemies used by the port and finale missions —
   with floating health bars and return fire. */
(function () {
  const CFG = MB.CFG;
  let fireCooldown = 0;
  let reloadT = 0;
  const raycaster = new THREE.Raycaster();

  // Ray vs building AABB (slab test) — shots stop at walls.
  function blockedByBuilding(ox, oy, oz, dx, dy, dz, maxD) {
    const cols = MB.W.colliders;
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      let tmin = 0, tmax = maxD;
      // X slab
      if (Math.abs(dx) < 1e-6) { if (ox < b.minX || ox > b.maxX) continue; }
      else {
        let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (Math.abs(dz) < 1e-6) { if (oz < b.minZ || oz > b.maxZ) continue; }
      else {
        let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (tmax >= 0 && tmin <= maxD) return true; // buildings are tall: ignore Y
    }
    return false;
  }

  function muzzlePos() {
    const p = MB.W.player;
    if (MB.S.inCar && MB.W.currentCar) {
      const c = MB.W.currentCar;
      return new THREE.Vector3(c.pos.x + Math.sin(c.heading) * 2, 1.4, c.pos.z + Math.cos(c.heading) * 2);
    }
    return new THREE.Vector3(p.pos.x + Math.sin(p.heading) * 0.8, 1.4, p.pos.z + Math.cos(p.heading) * 0.8);
  }

  function shoot() {
    if (fireCooldown > 0 || reloadT > 0) return;
    if (MB.S.ammo <= 0) { reload(); MB.HUD.toast('Reloading… (R)'); return; }
    fireCooldown = CFG.pistolFireDelay;
    MB.S.ammo--;
    MB.S.shotsFired++;
    MB.Sound.shoot();
    const m = muzzlePos();
    MB.FX.muzzle(m.x, m.y, m.z);
    MB.FX.shake(0.06);
    MB.Peds.fleeFrom(m.x, m.z, 30);
    if (MB.S.wanted > 0 || MB.W.cops.length > 0) MB.Wanted.addCrime('shoot');

    // Aim: from the camera through the screen center.
    raycaster.setFromCamera({ x: 0, y: 0 }, MB.W.camera);
    const dir = raycaster.ray.direction;
    const origin = raycaster.ray.origin;
    let best = null, bestD = CFG.pistolRange;
    function testTarget(x, y, z, radius, ref) {
      const dx = x - origin.x, dy = y - origin.y, dz = z - origin.z;
      const along = dx * dir.x + dy * dir.y + dz * dir.z;
      if (along < 0 || along > bestD) return;
      const px = origin.x + dir.x * along, py = origin.y + dir.y * along, pz = origin.z + dir.z * along;
      const miss = Math.hypot(x - px, y - py, z - pz);
      if (miss < radius && !blockedByBuilding(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, along)) {
        best = ref; bestD = along;
      }
    }
    MB.W.enemies.forEach(function (e) {
      if (!e.dead) testTarget(e.pos.x, e.pos.y + 1.2, e.pos.z, 1.6, { type: 'enemy', ref: e });
    });
    MB.W.peds.forEach(function (pd) {
      if (!pd.dead) testTarget(pd.pos.x, 1.2, pd.pos.z, 1.4, { type: 'ped', ref: pd });
    });
    MB.W.roadCars.concat(MB.W.cops).forEach(function (c) {
      testTarget(c.pos.x, 1, c.pos.z, 2.4, { type: 'car', ref: c });
    });
    if (best) {
      const hx = origin.x + dir.x * bestD, hy = origin.y + dir.y * bestD, hz = origin.z + dir.z * bestD;
      if (best.type === 'enemy') hitEnemy(best.ref, CFG.pistolDamage);
      else if (best.type === 'ped') MB.Peds.hitPed(best.ref, CFG.pistolDamage);
      else if (best.type === 'car') {
        best.ref.damage = Math.min(100, (best.ref.damage || 0) + 12);
        MB.FX.sparks(hx, hy, hz);
        if (best.ref.damage >= 100 && !best.ref.dead) {
          best.ref.dead = true;
          if (best.ref.police) MB.Wanted.addCrime('killCop');
        }
      }
    } else {
      // Impact puff at max range / ground.
      const hx = origin.x + dir.x * bestD, hz = origin.z + dir.z * bestD;
      MB.FX.sparks(hx, Math.max(0.2, origin.y + dir.y * bestD), hz);
    }
  }

  function punch() {
    const p = MB.W.player;
    if (!p || MB.S.inCar) return;
    MB.Sound.punch();
    MB.FX.shake(0.05);
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    let best = null, bd = CFG.meleeRange;
    MB.W.enemies.forEach(function (e) {
      if (e.dead) return;
      const d = MB.Util.dist2d(p.pos.x, p.pos.z, e.pos.x, e.pos.z);
      const facing = ((e.pos.x - p.pos.x) * fx + (e.pos.z - p.pos.z) * fz) / Math.max(d, 0.01);
      if (d < bd && facing > 0.3) { bd = d; best = { type: 'enemy', ref: e }; }
    });
    MB.W.peds.forEach(function (pd) {
      if (pd.dead) return;
      const d = MB.Util.dist2d(p.pos.x, p.pos.z, pd.pos.x, pd.pos.z);
      const facing = ((pd.pos.x - p.pos.x) * fx + (pd.pos.z - p.pos.z) * fz) / Math.max(d, 0.01);
      if (d < bd && facing > 0.3) { bd = d; best = { type: 'ped', ref: pd }; }
    });
    if (best) {
      if (best.type === 'enemy') hitEnemy(best.ref, CFG.meleeDamage);
      else MB.Peds.hitPed(best.ref, CFG.meleeDamage);
      MB.FX.blood(best.ref.pos.x, 1.2, best.ref.pos.z);
    }
  }

  function reload() {
    if (reloadT > 0 || MB.S.ammo === CFG.pistolMag || MB.S.reserveAmmo <= 0) return;
    reloadT = 1.1;
    MB.Sound.click();
  }

  // --- Gunman enemies ---
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function spawnEnemy(x, z) {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xb07a4a });
    const shirt = new THREE.MeshLambertMaterial({ color: 0xa8231e });
    const pants = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
    function part(mat, w, h, d, px, py, pz) {
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(w, h, d); m.position.set(px, py, pz);
      m.castShadow = true;
      g.add(m); return m;
    }
    part(shirt, 0.85, 0.9, 0.5, 0, 1.25, 0);
    part(skin, 0.5, 0.5, 0.45, 0, 1.95, 0);
    part(pants, 0.55, 0.2, 0.5, 0, 1.72, 0);
    part(pants, 0.32, 0.85, 0.4, -0.22, 0.42, 0);
    part(pants, 0.32, 0.85, 0.4, 0.22, 0.42, 0);
    part(shirt, 0.26, 0.8, 0.34, -0.58, 1.25, 0);
    part(shirt, 0.26, 0.8, 0.34, 0.58, 1.25, 0);
    part(new THREE.MeshLambertMaterial({ color: 0x111111 }), 0.12, 0.16, 0.55, 0.58, 0.95, 0.3);
    // Floating health bar.
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide }));
    barBg.position.y = 2.6;
    const barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x37e05a, side: THREE.DoubleSide }));
    barFg.position.y = 2.6; barFg.position.z = 0.01;
    g.add(barBg); g.add(barFg);
    g.position.set(x, 0, z);
    MB.W.scene.add(g);
    const e = {
      mesh: g, barFg: barFg,
      pos: new THREE.Vector3(x, 0, z),
      heading: 0,
      health: CFG.enemyHealth,
      dead: false,
      shootT: 1 + Math.random(),
      strafeDir: Math.random() < 0.5 ? 1 : -1,
    };
    g.userData.enemy = e;
    MB.W.enemies.push(e);
    return e;
  }

  function hitEnemy(e, dmg) {
    if (e.dead) return;
    e.health -= dmg;
    MB.FX.blood(e.pos.x, 1.3, e.pos.z);
    e.barFg.scale.x = Math.max(0.01, e.health / CFG.enemyHealth);
    e.barFg.material = new THREE.MeshBasicMaterial({
      color: e.health > 50 ? 0x37e05a : (e.health > 25 ? 0xffc93c : 0xff3a2e),
      side: THREE.DoubleSide,
    });
    if (e.health <= 0) {
      e.dead = true;
      e.mesh.rotation.x = -Math.PI / 2;
      e.mesh.position.y = 0.3;
      MB.S.kills++;
      MB.Missions.onEnemyKilled(e);
    }
  }

  function clearEnemies() {
    for (let i = 0; i < MB.W.enemies.length; i++) MB.W.scene.remove(MB.W.enemies[i].mesh);
    MB.W.enemies.length = 0;
  }

  function updateEnemies(dt) {
    const p = MB.W.player;
    if (!p) return;
    for (let i = 0; i < MB.W.enemies.length; i++) {
      const e = MB.W.enemies[i];
      if (e.dead) continue;
      // Face the camera so the health bar always reads.
      e.barFg.parent.children.forEach(function (c) { if (c.geometry && c.geometry.type === 'PlaneGeometry') c.lookAt(MB.W.camera.position); });
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      e.heading = Math.atan2(dx, dz);
      e.mesh.rotation.y = e.heading;
      // Close to firing range, then strafe.
      if (dist > 18) {
        const nx = e.pos.x + Math.sin(e.heading) * 3.4 * dt;
        const nz = e.pos.z + Math.cos(e.heading) * 3.4 * dt;
        const fixed = MB.City.collideCircle(nx, nz, 0.8);
        e.pos.x = fixed.x; e.pos.z = fixed.z;
      } else if (dist > 8) {
        const sx = Math.cos(e.heading) * e.strafeDir;
        const sz = -Math.sin(e.heading) * e.strafeDir;
        e.pos.x = MB.Util.clamp(e.pos.x + sx * 1.6 * dt, -235, 235);
        e.pos.z = MB.Util.clamp(e.pos.z + sz * 1.6 * dt, -235, 235);
        if (Math.random() < dt * 0.4) e.strafeDir *= -1;
      }
      e.mesh.position.x = e.pos.x; e.mesh.position.z = e.pos.z;
      // Return fire.
      e.shootT -= dt;
      if (e.shootT <= 0 && dist < CFG.enemyShootRange) {
        e.shootT = 0.9 + Math.random() * 0.8;
        MB.FX.muzzle(e.pos.x + Math.sin(e.heading) * 0.8, 1.3, e.pos.z + Math.cos(e.heading) * 0.8);
        MB.Sound.shoot();
        const hitChance = MB.Util.clamp(0.55 - dist / 120, 0.18, 0.55);
        if (Math.random() < hitChance) MB.Character.damage(CFG.enemyDamage);
      }
    }
  }

  function update(dt) {
    fireCooldown = Math.max(0, fireCooldown - dt);
    if (reloadT > 0) {
      reloadT -= dt;
      if (reloadT <= 0) {
        const need = CFG.pistolMag - MB.S.ammo;
        const take = Math.min(need, MB.S.reserveAmmo);
        MB.S.ammo += take;
        MB.S.reserveAmmo -= take;
      }
    }
    if (MB.Input.wasPressed('KeyR')) reload();
    if (MB.Input.wasPressed('KeyQ')) punch();
    if (MB.Input.isMouseDown()) shoot();
    updateEnemies(dt);
  }

  MB.Weapons = {
    update: update,
    shoot: shoot,
    punch: punch,
    reload: reload,
    spawnEnemy: spawnEnemy,
    hitEnemy: hitEnemy,
    clearEnemies: clearEnemies,
  };
})();
