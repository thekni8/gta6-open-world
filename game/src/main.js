/* Boot, game loop, and the top-level state machine
   (menu / playing / paused / missionEnd). Owns the renderer,
   the menu backdrop camera, and the per-frame update order. */
(function () {
  let menuAngle = 0;
  let saveTimer = 0;

  function initRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    document.getElementById('game-root').appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    camera.position.set(0, 40, 80);
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    MB.W.renderer = renderer;
    MB.W.camera = camera;
    MB.W.scene = new THREE.Scene();
    MB.W.clock = new THREE.Clock();
  }

  function buildWorld() {
    MB.Daylight.init(MB.W.scene);
    MB.City.build(MB.W.scene);
    MB.FX.init(MB.W.scene);
    MB.Traffic.spawnTraffic();
    MB.Peds.spawnPeds();
    const P = MB.Story.places;
    MB.Character.createPlayer(P.spawn.x, P.spawn.z);
    MB.CameraRig.setYaw(Math.PI);
  }

  function newGame() {
    MB.resetState(false);
    MB.Storage.clear();
    startPlaying();
    MB.Missions.startMission(0);
  }

  function continueGame() {
    const save = MB.Storage.load();
    MB.resetState(false);
    startPlaying();
    if (save) MB.Storage.applySave(save);
    MB.Missions.startMission(MB.S.missionIndex);
  }

  function freeRoam() {
    MB.resetState(true);
    startPlaying();
    MB.S.freeRoam = true;
    MB.Missions.spawnMissionCars();
    MB.HUD.toast('Free roam — steal a car, lose the cops, own the city.');
  }

  function startPlaying() {
    MB.Menus.hideStart();
    MB.Menus.hidePause();
    MB.Menus.hideMissionEnd();
    MB.HUD.show();
    MB.S.mode = 'playing';
    MB.S.dead = false;
  }

  function resume() {
    MB.Menus.hidePause();
    MB.Menus.hideMissionEnd();
    MB.S.mode = 'playing';
  }

  function pause() {
    if (MB.S.mode !== 'playing') return;
    MB.S.mode = 'paused';
    MB.Storage.save();
    MB.Menus.showPause();
  }

  function quitToMenu() {
    MB.Storage.save();
    MB.Menus.hidePause();
    MB.Menus.hideMissionEnd();
    MB.Menus.hideBigMap();
    MB.HUD.hide();
    MB.S.mode = 'menu';
  }

  function afterMissionEnd() {
    // Continue pressed on the mission-end screen.
    resume();
    if (MB.S.missionIndex < MB.Story.missions.length) {
      MB.Missions.startMission(MB.S.missionIndex);
    } else {
      MB.S.freeRoam = true;
      MB.HUD.toast('Story complete! Free roam — Meridian Bay is yours.');
    }
  }

  function handleGlobalKeys() {
    if (MB.Input.wasPressed('Escape')) {
      const bigmap = document.getElementById('bigmap');
      if (bigmap && !bigmap.classList.contains('hidden')) { MB.Menus.hideBigMap(); return; }
      if (MB.S.mode === 'playing') pause();
      else if (MB.S.mode === 'paused') resume();
    }
    if (MB.Input.wasPressed('KeyM') && MB.S.mode === 'playing') MB.Menus.toggleBigMap();
    if (MB.Input.wasPressed('KeyH') && MB.S.mode === 'playing') MB.Sound.horn();
    if (MB.Input.wasPressed('KeyF') && MB.S.inCar && MB.W.currentCar) {
      const car = MB.W.currentCar;
      MB.Cars.setLights(car, !car.lights);
    }
    if (MB.Input.wasPressed('KeyE') && MB.S.mode === 'playing') {
      if (MB.S.inCar) {
        MB.Cars.exitCar();
      } else {
        const p = MB.W.player;
        const car = MB.Cars.nearestCar(p.pos.x, p.pos.z, 4.2);
        if (car) {
          if (car.police) MB.Wanted.addCrime('steal');
          else if (car.ai && car.ai.kind === 'traffic') { MB.Wanted.addCrime('steal'); MB.S.carsStolen++; }
          else if (car.mission !== 'delivery') MB.S.carsStolen++;
          MB.Cars.enterCar(car);
        }
      }
    }
  }

  function updatePlaying(dt) {
    const p = MB.W.player;
    // Zone label follows the player.
    if (p) MB.S.zone = MB.City.zoneAt(p.pos.x, p.pos.z);
    if (MB.S.inCar && MB.W.currentCar) MB.Cars.drivePlayer(MB.W.currentCar, dt);
    else MB.Character.update(dt);
    MB.Traffic.update(dt);
    MB.Peds.update(dt);
    MB.Chase.update(dt);
    MB.Wanted.update(dt);
    MB.Weapons.update(dt);
    MB.Missions.update(dt);
    MB.FX.update(dt);
    MB.CameraRig.update(dt);
    MB.Daylight.follow(p.pos.x, p.pos.z);
    MB.City.pulseBeacon(MB.S.time);
    MB.Sound.updateSiren(dt, MB.S.wanted);
    MB.Sound.setEngine(MB.S.inCar ? Math.abs((MB.W.currentCar || { speed: 0 }).speed) / MB.CFG.carMaxSpeed : 0, MB.S.inCar);
    MB.HUD.update();
    MB.Minimap.update();
    saveTimer += dt;
    if (saveTimer > 20) { saveTimer = 0; MB.Storage.save(); }
  }

  function updateMenu(dt) {
    // Slow cinematic orbit over downtown behind the start screen.
    menuAngle += dt * 0.05;
    const cam = MB.W.camera;
    cam.position.set(Math.sin(menuAngle) * 120, 55, Math.cos(menuAngle) * 120);
    cam.lookAt(0, 0, 0);
    MB.Traffic.update(dt);
    MB.Peds.update(dt);
    MB.FX.update(dt);
    MB.City.pulseBeacon(MB.S.time);
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(MB.W.clock.getDelta(), 0.05);
    MB.S.time += dt;
    handleGlobalKeys();
    if (MB.S.mode === 'playing') updatePlaying(dt);
    else if (MB.S.mode === 'menu') updateMenu(dt);
    else if (MB.S.mode === 'missionEnd') {
      // World idles behind the end screen.
      MB.Traffic.update(dt);
      MB.Peds.update(dt);
      MB.FX.update(dt);
    }
    MB.W.renderer.render(MB.W.scene, MB.W.camera);
    MB.Input.endFrame();
  }

  function boot() {
    initRenderer();
    buildWorld();
    MB.HUD.init();
    MB.Minimap.init();
    MB.Menus.init();
    MB.HUD.hide();
    MB.Menus.showStart();
    // Scenario jump (?scene=...) skips the menu for screenshots/tests.
    const staged = MB.Scenarios.applyFromUrl();
    if (!staged) MB.S.mode = 'menu';
    MB.W.clock.start();
    loop();
    // Expose a small debug API for playtests (not a cheat menu — the
    // same hooks the shot script uses to stage scenes).
    window.MB_DEBUG = {
      state: function () { return MB.S; },
      mission: function () { return MB.Missions.runtime(); },
      startMission: function (i) { MB.Missions.startMission(i); },
      setWanted: function (s) { MB.Wanted.setWanted(s); },
      teleport: function (x, z) { MB.Scenarios.putPlayerOnFoot(x, z, 0); },
      giveCash: function (n) { MB.S.cash += n; },
      killAllEnemies: function () { MB.W.enemies.forEach(function (e) { MB.Weapons.hitEnemy(e, 999); }); },
    };
  }

  MB.Main = {
    boot: boot,
    newGame: newGame,
    continueGame: continueGame,
    freeRoam: freeRoam,
    resume: resume,
    pause: pause,
    quitToMenu: quitToMenu,
    afterMissionEnd: afterMissionEnd,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
