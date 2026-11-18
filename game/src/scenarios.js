/* Staged scenes for screenshots and playtesting. ?scene=cover|foot|
   drive|mission jumps straight into a dense, mission-active moment
   with the full HUD on — no menu in the way. The same staging calls
   are exposed for the shot script to re-pose a scene right before
   capture. Nothing here is a cheat: every scene is reachable in play. */
(function () {
  function putPlayerInCar(x, z, heading, colorHex, speed) {
    // Remove the previous player car outright: exiting it would leave it
    // parked on the spawn point, and the new car would spawn inside it.
    if (MB.S.inCar && MB.W.currentCar) {
      const old = MB.W.currentCar;
      MB.S.inCar = false; MB.S.carId = null; MB.W.currentCar = null;
      MB.Cars.removeCar(old);
    }
    const car = MB.Cars.createCar(x, z, heading, { color: colorHex });
    MB.W.roadCars.push(car);
    car.speed = speed || 0;
    MB.Cars.enterCar(car);
    MB.W.player.pos.set(x, 0, z);
    return car;
  }

  function putPlayerOnFoot(x, z, heading) {
    if (MB.S.inCar) MB.Cars.exitCar();
    MB.W.player.pos.set(x, 0, z);
    MB.W.player.heading = heading;
    MB.W.playerMesh.position.set(x, 0, z);
    MB.W.playerMesh.rotation.y = heading;
  }

  function placeCop(x, z, heading, speed, cruise) {
    const cop = MB.Chase.spawnCop(false);
    cop.pos.set(x, 0, z);
    cop.heading = heading;
    cop.speed = speed || 8;
    if (cruise) {
      cop.ai.state = 'cruise';
      cop.ai.cruiseSpeed = speed || 8;
    }
    MB.Cars.syncMesh(cop, 0);
    return cop;
  }

  function clearCops() { MB.Chase.clearAll(); }

  function beginPlaying() {
    MB.Menus.hideStart();
    MB.HUD.show();
    MB.S.mode = 'playing';
  }

  // COVER: Mission 3 getaway north up the beachfront road — wanted 3,
  // cruisers flanking close behind and one blocking ahead, sea on the
  // right, city on the left, timer running.
  function stageCover() {
    MB.Missions.startMission(2);
    const rt = MB.Missions.runtime();
    rt.timer = 239; // 3:59
    const car = putPlayerInCar(180, 60, Math.PI, 0xd33a2c, 15);
    clearCops();
    MB.Wanted.setWanted(3);
    clearCops();
    // Cruisers ahead-flanking the player car — large in frame, cruising
    // in formation so they hold the shot instead of ramming.
    placeCop(174, 48, Math.PI, 14, true);
    placeCop(186, 50, Math.PI, 14, true);
    // One blocker further ahead on the road.
    placeCop(180, 28, Math.PI, 6, true);
    // Civilian traffic ahead, for density.
    const t1 = MB.Cars.createCar(183, 6, Math.PI, { color: 0x2fae5f });
    t1.ai = { kind: 'traffic', vertical: true, line: 180, dir: -1, speed: 10 };
    t1.speed = 10;
    MB.W.roadCars.push(t1);
    const t2 = MB.Cars.createCar(177, -16, 0, { color: 0xf2c14e });
    t2.ai = { kind: 'traffic', vertical: true, line: 180, dir: 1, speed: 10 };
    t2.speed = 10;
    MB.W.roadCars.push(t2);
    MB.CameraRig.setYaw(Math.PI);
    MB.CameraRig.setPitch(0.3);
    return car;
  }

  // FOOT: Mission 1 on foot downtown, standing on the road with the
  // delivery car ahead and the street canyon in frame.
  function stageFoot() {
    MB.Missions.startMission(0);
    const rt = MB.Missions.runtime();
    rt.timer = 150; // 2:30
    // Delivery car ahead of the player, in frame.
    const car = MB.W.missionCars.delivery;
    if (car) { car.pos.set(3, 0, 20); car.heading = Math.PI; MB.Cars.syncMesh(car, 0); }
    // Two pedestrians on the sidewalks nearby, for life.
    if (MB.W.peds[0]) { MB.W.peds[0].pos.set(9, 0, 18); MB.W.peds[0].target = { x: 9, z: -40 }; }
    if (MB.W.peds[1]) { MB.W.peds[1].pos.set(-9, 0, 44); MB.W.peds[1].target = { x: -9, z: 90 }; }
    putPlayerOnFoot(0, 30, Math.PI * 0.96);
    MB.CameraRig.setYaw(Math.PI * 0.96);
    MB.CameraRig.setPitch(0.3);
  }

  // DRIVE: Mission 1 delivery leg, speeding down the beachfront strip.
  function stageDrive() {
    MB.Missions.startMission(0);
    const rt = MB.Missions.runtime();
    rt.timer = 150;
    rt.step = 1; // already in the car, driving to the marina
    MB.Missions.updateBeacon();
    const car = MB.W.missionCars.delivery;
    if (car) {
      car.pos.set(180, 0, -60);
      car.heading = 0; // south, down the beachfront road
      car.speed = 17;
      MB.Cars.enterCar(car);
    } else {
      putPlayerInCar(180, -60, 0, 0x2c6fd3, 17);
    }
    // Traffic ahead on the road so the frame reads busy.
    const t1 = MB.Cars.createCar(183, -28, 0, { color: 0xd33a2c });
    t1.ai = { kind: 'traffic', vertical: true, line: 180, dir: 1, speed: 10 };
    t1.speed = 10;
    MB.W.roadCars.push(t1);
    const t2 = MB.Cars.createCar(177, -6, Math.PI, { color: 0x2fae5f });
    t2.ai = { kind: 'traffic', vertical: true, line: 180, dir: -1, speed: 10 };
    t2.speed = 10;
    MB.W.roadCars.push(t2);
    MB.CameraRig.setYaw(0);
    MB.CameraRig.setPitch(0.38);
  }

  // MISSION: Mission 4 shootout at the port — gunmen in frame.
  function stageMission() {
    MB.Missions.startMission(3);
    const rt = MB.Missions.runtime();
    rt.timer = 299; // 4:59
    rt.step = 1;
    rt.killsNeeded = 6;
    MB.Weapons.clearEnemies();
    // Gunmen staged in the open, just ahead of the player, with the
    // container yard as a colorful backdrop — all six in the eyeline.
    [[-11, -200], [-4, -206], [5, -201], [12, -207], [-1, -212], [16, -199]].forEach(function (s) {
      MB.Weapons.spawnEnemy(s[0], s[1]);
    });
    putPlayerOnFoot(0, -186, Math.PI);
    MB.CameraRig.setYaw(Math.PI);
    MB.CameraRig.setPitch(0.36);
    MB.Missions.updateBeacon();
  }

  function applyFromUrl() {
    const q = new URLSearchParams(window.location.search);
    const scene = q.get('scene');
    if (!scene) return false;
    beginPlaying();
    if (scene === 'cover') stageCover();
    else if (scene === 'foot') stageFoot();
    else if (scene === 'drive') stageDrive();
    else if (scene === 'mission') stageMission();
    else return false;
    return true;
  }

  MB.Scenarios = {
    applyFromUrl: applyFromUrl,
    stageCover: stageCover,
    stageFoot: stageFoot,
    stageDrive: stageDrive,
    stageMission: stageMission,
    putPlayerInCar: putPlayerInCar,
    putPlayerOnFoot: putPlayerOnFoot,
    placeCop: placeCop,
  };
})();
