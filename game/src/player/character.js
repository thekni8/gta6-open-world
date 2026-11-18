/* Kai Mercer on foot: movement, sprint, simple walk animation,
   health and damage, and entering/exiting cars. */
(function () {
  const CFG = MB.CFG;
  let mesh = null, legL = null, legR = null, armL = null, armR = null, torso = null;
  let walkPhase = 0, stepTimer = 0;

  function buildMesh() {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xc68e5e });
    const shirt = new THREE.MeshLambertMaterial({ color: 0x2c6fd3 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x222831 });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    function part(mat, w, h, d, x, y, z) {
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(w, h, d); m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m); return m;
    }
    torso = part(shirt, 0.85, 0.9, 0.5, 0, 1.25, 0);
    part(skin, 0.5, 0.5, 0.45, 0, 1.95, 0);            // head
    part(pants, 0.55, 0.18, 0.5, 0, 1.72, 0);           // cap
    legL = part(pants, 0.32, 0.85, 0.4, -0.22, 0.42, 0);
    legR = part(pants, 0.32, 0.85, 0.4, 0.22, 0.42, 0);
    armL = part(shirt, 0.26, 0.8, 0.34, -0.58, 1.25, 0);
    armR = part(shirt, 0.26, 0.8, 0.34, 0.58, 1.25, 0);
    // Pistol in the right hand.
    const gun = part(new THREE.MeshLambertMaterial({ color: 0x111111 }), 0.12, 0.16, 0.5, 0.58, 0.95, 0.25);
    gun.name = 'pistol';
    mesh = g;
    MB.W.scene.add(g);
    MB.W.playerMesh = g;
  }

  function createPlayer(x, z) {
    if (!mesh) buildMesh();
    const p = {
      pos: new THREE.Vector3(x, 0, z),
      heading: Math.PI,           // faces -z... rotated to face camera start
      speed: 0,
      moving: false,
      sprinting: false,
    };
    MB.W.player = p;
    mesh.position.copy(p.pos);
    mesh.rotation.y = p.heading;
    return p;
  }

  function damage(amount, fromX, fromZ) {
    if (MB.S.dead || MB.S.mode !== 'playing') return;
    MB.S.health = Math.max(0, MB.S.health - amount);
    MB.HUD.flashHurt();
    MB.FX.shake(0.25);
    if (MB.S.health <= 0) {
      MB.S.dead = true;
      MB.Missions.onPlayerDeath();
    }
  }

  function heal(amount) {
    MB.S.health = Math.min(CFG.playerMaxHealth, MB.S.health + amount);
  }

  function update(dt) {
    const p = MB.W.player;
    if (!p || MB.S.inCar) {
      if (mesh) mesh.visible = MB.S.inCar ? false : true;
      return;
    }
    mesh.visible = true;
    const axes = MB.Input.axes();
    const sprint = MB.Input.isDown('ShiftLeft') || MB.Input.isDown('ShiftRight');
    const speed = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
    // Movement is camera-relative: forward = away from camera.
    const camYaw = MB.CameraRig.yaw();
    let mx = 0, mz = 0;
    if (axes.forward !== 0 || axes.strafe !== 0) {
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      mx = fx * axes.forward + rx * axes.strafe;
      mz = fz * axes.forward + rz * axes.strafe;
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
    }
    const moving = (mx !== 0 || mz !== 0);
    p.moving = moving;
    p.sprinting = moving && sprint;
    if (moving) {
      const nx = p.pos.x + mx * speed * dt;
      const nz = p.pos.z + mz * speed * dt;
      const fixed = MB.City.collideCircle(nx, nz, CFG.playerRadius);
      p.pos.x = MB.Util.clamp(fixed.x, -CFG.worldHalf, CFG.seaX - 2);
      p.pos.z = MB.Util.clamp(fixed.z, -CFG.worldHalf, CFG.worldHalf);
      const targetHeading = Math.atan2(mx, mz);
      p.heading = MB.Util.angleLerp(p.heading, targetHeading, Math.min(1, dt * 12));
      walkPhase += dt * (sprint ? 13 : 9);
      stepTimer -= dt;
      if (stepTimer <= 0) { MB.Sound.step(); stepTimer = sprint ? 0.28 : 0.42; }
    }
    // Walk-cycle swing.
    const swing = moving ? Math.sin(walkPhase) * 0.55 : 0;
    legL.rotation.x = swing; legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8; armR.rotation.x = swing * 0.8;
    if (!moving) {
      legL.rotation.x *= 0.8; legR.rotation.x *= 0.8;
      armL.rotation.x *= 0.8; armR.rotation.x *= 0.8;
    }
    mesh.position.copy(p.pos);
    mesh.rotation.y = p.heading;
    MB.S.speedKmh = 0;
  }

  MB.Character = {
    createPlayer: createPlayer,
    update: update,
    damage: damage,
    heal: heal,
    mesh: function () { return mesh; },
  };
})();
