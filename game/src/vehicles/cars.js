/* Car models (low-poly box builds), arcade driving physics,
   damage states, headlights, and enter/exit. */
(function () {
  const CFG = MB.CFG;
  let nextId = 1;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });

  function buildCarMesh(colorHex, isPolice, isTaxi) {
    const g = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color: colorHex });
    const glass = new THREE.MeshLambertMaterial({ color: 0x1a2836 });
    const chrome = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    function part(mat, w, h, d, x, y, z) {
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(w, h, d); m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m); return m;
    }
    part(paint, 2.0, 0.75, 4.4, 0, 0.65, 0);            // body
    part(glass, 1.8, 0.65, 2.3, 0, 1.3, -0.15);         // cabin
    part(paint, 2.02, 0.18, 1.1, 0, 0.95, 1.85);        // hood lip
    part(chrome, 1.9, 0.22, 0.15, 0, 0.55, 2.22);       // front bumper
    part(chrome, 1.9, 0.22, 0.15, 0, 0.55, -2.22);      // rear bumper
    // Headlights + taillights.
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
    part(hlMat, 0.4, 0.22, 0.1, -0.65, 0.72, 2.24);
    part(hlMat, 0.4, 0.22, 0.1, 0.65, 0.72, 2.24);
    part(tlMat, 0.45, 0.22, 0.1, -0.65, 0.72, -2.24);
    part(tlMat, 0.45, 0.22, 0.1, 0.65, 0.72, -2.24);
    // Wheels.
    const wheels = [];
    [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(function (p) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.42, p[1]);
      w.castShadow = true;
      g.add(w); wheels.push(w);
    });
    let lightbar = null, lightL = null, lightR = null;
    if (isPolice) {
      part(new THREE.MeshLambertMaterial({ color: 0x111111 }), 1.7, 0.3, 1.2, 0, 1.75, -0.1);
      lightL = part(new THREE.MeshBasicMaterial({ color: 0x2244ff }), 0.55, 0.28, 0.5, -0.45, 1.95, -0.1);
      lightR = part(new THREE.MeshBasicMaterial({ color: 0xff2222 }), 0.55, 0.28, 0.5, 0.45, 1.95, -0.1);
      lightbar = true;
      part(new THREE.MeshLambertMaterial({ color: 0x111111 }), 2.02, 0.5, 1.4, 0, 0.7, -0.6);
    }
    if (isTaxi) {
      part(new THREE.MeshBasicMaterial({ color: 0xf2c14e }), 0.8, 0.25, 0.5, 0, 1.75, -0.1);
    }
    g.userData.wheels = wheels;
    g.userData.lightL = lightL; g.userData.lightR = lightR;
    return g;
  }

  function createCar(x, z, heading, opts) {
    opts = opts || {};
    // Police cruisers are always white-and-black; anything else picks a paint color.
    const color = (opts.color !== undefined) ? opts.color
      : (opts.police ? 0xe8e8e8 : MB.Random.makeRng(nextId * 7919).pick(MB.PALETTE.cars));
    const mesh = buildCarMesh(color, !!opts.police, !!opts.taxi);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    MB.W.scene.add(mesh);
    const car = {
      id: nextId++,
      mesh: mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: heading,
      speed: 0,
      color: color,
      police: !!opts.police,
      taxi: !!opts.taxi,
      parked: !!opts.parked,
      mission: opts.mission || null,
      damage: 0,               // 0..100; smoke at 50+, dead at 100
      dead: false,
      lights: false,
      steerVis: 0,
      ai: opts.ai || null,     // traffic/police brain state
      driver: opts.driver || null,
      honkT: 0,
    };
    mesh.userData.car = car;
    return car;
  }

  function removeCar(car) {
    MB.W.scene.remove(car.mesh);
    const i = MB.W.roadCars.indexOf(car);
    if (i >= 0) MB.W.roadCars.splice(i, 1);
    if (MB.W.currentCar === car) MB.W.currentCar = null;
  }

  function setLights(car, on) {
    car.lights = on;
    // Headlight cones: two SpotLights are expensive; fake with emissive glow quads.
    if (!car.glowL) {
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.35, depthWrite: false });
      const g1 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7), glowMat);
      g1.rotation.x = -Math.PI / 2; g1.position.set(0, 0.12, 5.6);
      car.mesh.add(g1);
      car.glowL = g1;
    }
    car.glowL.visible = on;
  }

  function flashPoliceLights(car, t) {
    const on = Math.floor(t * 6) % 2 === 0;
    if (car.mesh.userData.lightL) car.mesh.userData.lightL.visible = on;
    if (car.mesh.userData.lightR) car.mesh.userData.lightR.visible = !on;
  }

  // Arcade driving step for the player's car.
  function drivePlayer(car, dt) {
    const axes = MB.Input.axes();
    const handbrake = MB.Input.isDown('Space');
    if (car.dead) { car.speed *= (1 - 2 * dt); }
    else if (axes.forward > 0) car.speed += CFG.carAccel * dt * (car.speed < 0 ? 2.2 : 1);
    else if (axes.forward < 0) {
      if (car.speed > 0.5) car.speed -= CFG.carBrake * dt;
      else car.speed -= CFG.carAccel * 0.55 * dt;
    } else {
      car.speed -= car.speed * (handbrake ? 2.4 : 0.55) * dt;
      if (Math.abs(car.speed) < 0.05) car.speed = 0;
    }
    car.speed = MB.Util.clamp(car.speed, -CFG.carReverseMax, CFG.carMaxSpeed * (1 - car.damage / 240));
    const spd = Math.abs(car.speed);
    const steer = axes.strafe * (car.speed >= 0 ? 1 : -1);
    car.heading += steer * CFG.carTurnRate * dt * MB.Util.clamp(spd / 8, 0, 1) * (handbrake ? 1.5 : 1);
    const grip = handbrake ? CFG.handbrakeGrip : CFG.carGrip;
    // Velocity blends toward heading (arcade drift).
    const vx = Math.sin(car.heading) * car.speed;
    const vz = Math.cos(car.heading) * car.speed;
    car.velX = MB.Util.lerp(car.velX || 0, vx, grip);
    car.velZ = MB.Util.lerp(car.velZ || 0, vz, grip);
    const nx = car.pos.x + car.velX * dt;
    const nz = car.pos.z + car.velZ * dt;
    const hit = collideCar(car, nx, nz);
    if (hit) {
      car.speed *= 0.35;
      car.velX *= -0.25; car.velZ *= -0.25;
      car.damage = Math.min(100, car.damage + 4 + spd * 0.25);
      MB.FX.sparks(car.pos.x, 1, car.pos.z);
      MB.FX.shake(Math.min(0.7, 0.15 + spd * 0.012));
      MB.Sound.crash(spd > 15);
      if (car.damage >= 100 && !car.dead) { car.dead = true; MB.HUD.toast('Car wrecked! Find another ride.'); }
    }
    car.pos.x = MB.Util.clamp(car.pos.x, -CFG.worldHalf, CFG.seaX - 3);
    car.pos.z = MB.Util.clamp(car.pos.z, -CFG.worldHalf, CFG.worldHalf);
    // Skid marks + smoke when sliding hard or damaged.
    const slide = Math.hypot((car.velX || 0) - vx, (car.velZ || 0) - vz);
    if ((handbrake && spd > 8) || slide > 6) {
      MB.FX.skid(car.pos.x - Math.sin(car.heading) * 1.5, car.pos.z - Math.cos(car.heading) * 1.5, car.heading);
      if (Math.random() < 0.4) MB.Sound.skid();
    }
    if (car.damage > 55 && Math.random() < dt * 6) MB.FX.smoke(car.pos.x, 1.4, car.pos.z);
    if (car.police) flashPoliceLights(car, MB.S.time);
    syncMesh(car, dt);
    MB.S.speedKmh = Math.round(Math.abs(car.speed) * 3.6);
    MB.Sound.setEngine(Math.abs(car.speed) / CFG.carMaxSpeed, true);
  }

  // Returns true on a building hit; also resolves car-vs-car bumps.
  function collideCar(car, nx, nz) {
    let hit = false;
    const fixed = MB.City.collideCircle(nx, nz, 2.1);
    if (fixed.x !== nx || fixed.z !== nz) hit = true;
    car.pos.x = fixed.x; car.pos.z = fixed.z;
    for (let i = 0; i < MB.W.roadCars.length; i++) {
      const o = MB.W.roadCars[i];
      if (o === car) continue;
      const d = MB.Util.dist2d(car.pos.x, car.pos.z, o.pos.x, o.pos.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const px = (car.pos.x - o.pos.x) / d * push, pz = (car.pos.z - o.pos.z) / d * push;
        car.pos.x += px; car.pos.z += pz;
        if (!o.parked) { o.pos.x -= px; o.pos.z -= pz; syncMesh(o, 0); }
        if (Math.abs(car.speed) > 6) {
          car.damage = Math.min(100, car.damage + 2);
          o.damage = Math.min(100, (o.damage || 0) + 3);
          MB.FX.sparks(car.pos.x, 1, car.pos.z);
          if (o.police) MB.Wanted.addCrime('hitCop');
          else MB.Wanted.addCrime('hitCar');
        }
        hit = true;
      }
    }
    return hit;
  }

  function syncMesh(car, dt) {
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    const wheels = car.mesh.userData.wheels || [];
    const spin = (car.speed || 0) * (dt || 0.016) / 0.42;
    for (let i = 0; i < wheels.length; i++) wheels[i].rotation.x += spin;
    if (car.damage > 55) {
      // Damage tilt: wrecked cars sag.
      car.mesh.rotation.z = 0.04 * Math.min(1, (car.damage - 55) / 45);
    }
  }

  function enterCar(car) {
    MB.S.inCar = true;
    MB.S.carId = car.id;
    MB.W.currentCar = car;
    car.parked = false;
    if (car.ai) car.ai = null; // player takes over; traffic brain off
    MB.W.player.pos.copy(car.pos);
    MB.Sound.click();
    MB.HUD.toast(car.police ? 'You stole a police car!' : 'Car jacked');
  }

  function exitCar() {
    const car = MB.W.currentCar;
    if (!car) return;
    MB.S.inCar = false;
    MB.S.carId = null;
    MB.W.currentCar = null;
    car.speed = 0;
    const p = MB.W.player;
    p.pos.set(car.pos.x - Math.cos(car.heading) * 2.6, 0, car.pos.z + Math.sin(car.heading) * 2.6);
    p.heading = car.heading;
    MB.Sound.click();
  }

  function nearestCar(x, z, maxD) {
    let best = null, bd = maxD;
    for (let i = 0; i < MB.W.roadCars.length; i++) {
      const c = MB.W.roadCars[i];
      const d = MB.Util.dist2d(x, z, c.pos.x, c.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    for (let i = 0; i < MB.W.cops.length; i++) {
      const c = MB.W.cops[i];
      const d = MB.Util.dist2d(x, z, c.pos.x, c.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  MB.Cars = {
    createCar: createCar,
    removeCar: removeCar,
    drivePlayer: drivePlayer,
    syncMesh: syncMesh,
    collideCar: collideCar,
    setLights: setLights,
    flashPoliceLights: flashPoliceLights,
    enterCar: enterCar,
    exitCar: exitCar,
    nearestCar: nearestCar,
  };
})();
