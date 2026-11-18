/* Pedestrians: capsule people walking the sidewalks, turning at
   corners, chatting in place, and fleeing from gunfire and speeding cars. */
(function () {
  const CFG = MB.CFG;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  function buildPedMesh(shirtHex) {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xc68e5e });
    const shirt = new THREE.MeshLambertMaterial({ color: shirtHex });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
    function part(mat, w, h, d, x, y, z) {
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(w, h, d); m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m); return m;
    }
    part(shirt, 0.8, 0.85, 0.45, 0, 1.2, 0);
    part(skin, 0.45, 0.45, 0.4, 0, 1.88, 0);
    part(pants, 0.3, 0.8, 0.36, -0.2, 0.4, 0);
    part(pants, 0.3, 0.8, 0.36, 0.2, 0.4, 0);
    part(shirt, 0.22, 0.7, 0.3, -0.52, 1.2, 0);
    part(shirt, 0.22, 0.7, 0.3, 0.52, 1.2, 0);
    return g;
  }

  function randomSidewalkPoint(rng) {
    const line = rng.pick(CFG.roadLines);
    const along = rng.range(-220, 220);
    const side = rng.chance(0.5) ? 1 : -1;
    if (rng.chance(0.5)) return { x: line + side * 9, z: along };
    return { x: along, z: line + side * 9 };
  }

  function spawnPeds() {
    const rng = MB.Random.makeRng(777);
    for (let i = 0; i < CFG.pedCount; i++) {
      const p = randomSidewalkPoint(rng);
      // Keep peds off the beach road's sea side and out of the port.
      if (p.x > CFG.beachX - 2) p.x = CFG.beachX - 6;
      if (p.z < CFG.portZ + 6) p.z = CFG.portZ + 10;
      const mesh = buildPedMesh(rng.pick(MB.PALETTE.shirts));
      mesh.position.set(p.x, 0, p.z);
      MB.W.scene.add(mesh);
      const ped = {
        mesh: mesh,
        pos: new THREE.Vector3(p.x, 0, p.z),
        heading: rng.range(0, Math.PI * 2),
        target: randomSidewalkPoint(rng),
        speed: CFG.pedSpeed * rng.range(0.8, 1.3),
        state: 'walk',         // walk | idle | flee
        stateT: rng.range(0, 4),
        health: 100,
        dead: false,
        walkPhase: rng.range(0, 6),
      };
      mesh.userData.ped = ped;
      MB.W.peds.push(ped);
    }
  }

  function fleeFrom(x, z, radius) {
    for (let i = 0; i < MB.W.peds.length; i++) {
      const ped = MB.W.peds[i];
      if (ped.dead) continue;
      const d = MB.Util.dist2d(ped.pos.x, ped.pos.z, x, z);
      if (d < radius) {
        ped.state = 'flee';
        ped.stateT = 3 + Math.random() * 2;
        const a = Math.atan2(ped.pos.x - x, ped.pos.z - z);
        ped.target = {
          x: MB.Util.clamp(ped.pos.x + Math.sin(a) * 40, -230, 230),
          z: MB.Util.clamp(ped.pos.z + Math.cos(a) * 40, -230, 230),
        };
      }
    }
  }

  function hitPed(ped, damage, fromX, fromZ) {
    if (ped.dead) return;
    ped.health -= damage;
    MB.FX.blood(ped.pos.x, 1.2, ped.pos.z);
    fleeFrom(ped.pos.x, ped.pos.z, 25);
    if (ped.health <= 0) {
      ped.dead = true;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.3;
      MB.Wanted.addCrime('killPed');
      MB.S.kills++;
    }
  }

  function update(dt) {
    for (let i = 0; i < MB.W.peds.length; i++) {
      const ped = MB.W.peds[i];
      if (ped.dead) continue;
      ped.stateT -= dt;
      if (ped.state === 'idle' && ped.stateT <= 0) {
        ped.state = 'walk';
        const rng = MB.Random.makeRng((Math.random() * 1e9) | 0);
        ped.target = randomSidewalkPoint(rng);
      }
      if (ped.state === 'flee' && ped.stateT <= 0) ped.state = 'walk';
      if (ped.state === 'walk' || ped.state === 'flee') {
        const dx = ped.target.x - ped.pos.x, dz = ped.target.z - ped.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) {
          if (ped.state === 'flee') ped.state = 'walk';
          else { ped.state = 'idle'; ped.stateT = 2 + Math.random() * 5; }
        } else {
          const spd = ped.state === 'flee' ? ped.speed * 2.6 : ped.speed;
          const targetHeading = Math.atan2(dx / d, dz / d);
          ped.heading = MB.Util.angleLerp(ped.heading, targetHeading, Math.min(1, dt * 6));
          const nx = ped.pos.x + Math.sin(ped.heading) * spd * dt;
          const nz = ped.pos.z + Math.cos(ped.heading) * spd * dt;
          const fixed = MB.City.collideCircle(nx, nz, 0.7);
          ped.pos.x = MB.Util.clamp(fixed.x, -235, 235);
          ped.pos.z = MB.Util.clamp(fixed.z, -235, 235);
          ped.walkPhase += dt * (ped.state === 'flee' ? 12 : 7);
          ped.mesh.position.y = Math.abs(Math.sin(ped.walkPhase)) * 0.06;
        }
      }
      ped.mesh.position.x = ped.pos.x;
      ped.mesh.position.z = ped.pos.z;
      ped.mesh.rotation.y = ped.heading;
    }
  }

  MB.Peds = { spawnPeds: spawnPeds, update: update, fleeFrom: fleeFrom, hitPed: hitPed };
})();
