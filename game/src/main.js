// Meridian Bay — boot, game loop, and the state machine (menu / playing /
// paused / mission end / busted / wasted). Wires every system together.
import { CONFIG, districtAt } from './config.js';
import { makeRng } from './util/random.js';
import { Input } from './input.js';
import { loadSave, writeSave, clearSave, defaultSave, hasSave } from './save/storage.js';
import { Sound } from './audio/sound.js';
import { Particles } from './effects/particles.js';
import { setupDaylight } from './world/daylight.js';
import { buildCity, makeBeacon } from './world/city.js';
import { Traffic } from './vehicles/traffic.js';
import { Pedestrians } from './people/pedestrians.js';
import { Player } from './player/character.js';
import { CameraRig } from './player/camera.js';
import { Wanted } from './police/wanted.js';
import { Police } from './police/chase.js';
import { Weapons } from './combat/weapons.js';
import { MissionManager } from './missions/manager.js';
import { Hud } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { Menus } from './ui/menus.js';
import { scenarioFromUrl, applyScenario } from './scenarios.js';

class Game {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get('seed')) || 7;
    this.rng = makeRng(this.seed);
    this.time = 0;
    this.state = 'menu';
    this.stateTimer = 0;
    this.cash = 250;
    this.save = loadSave() || defaultSave();
    this.cash = this.save.cash ?? 250;
    this.lastMissionFailed = false;
    this.chaosAt = null;
    this.headlightsOn = false;

    // Renderer + scene.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    document.getElementById('game-container').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

    setupDaylight(this.scene, this.renderer);
    this.city = buildCity(this.scene, this.seed);
    this.beacon = makeBeacon(this.scene);

    this.input = new Input(this.renderer.domElement);
    this.sound = new Sound();
    this.particles = new Particles(this.scene);
    this.player = new Player(this.scene, this.city, this.save.playerX ?? 0, this.save.playerZ ?? 40);
    this.cameraRig = new CameraRig(this.camera, this.city);
    this.traffic = new Traffic(this.scene, this.city, this.rng);
    this.traffic.spawn(16);
    this.peds = new Pedestrians(this.scene, this.city, this.rng);
    this.peds.spawn(34);
    this.wanted = new Wanted();
    this.police = new Police(this.scene, this.city, this.rng);
    this.weapons = new Weapons(this.scene, this.city);
    this.missions = new MissionManager(this);
    this.minimap = new Minimap(document.getElementById('minimap'), this.city);
    this.hud = new Hud(this);
    this.menus = new Menus(this);

    window.addEventListener('resize', () => this._onResize());
    this._onResize();

    // Busted / wasted overlays: click anywhere to respawn.
    for (const id of ['busted-overlay', 'wasted-overlay']) {
      document.getElementById(id).addEventListener('click', () => this.respawn());
    }

    // Screenshot scenarios boot straight into a staged live game.
    this.scenario = scenarioFromUrl();
    if (this.scenario) {
      this.state = 'playing';
      this.menus.hideStart();
      document.getElementById('hud').classList.add('visible');
      applyScenario(this, this.scenario);
    } else {
      this.menus.showStart(hasSave(), this.save);
    }

    // Test hooks for the automated playtest (window.__mb).
    window.__mb = {
      game: this,
      startMission: (i) => this.missions.startMission(i),
      teleport: (x, z) => { this.player.pos.set(x, 0, z); if (this.player.car) { this.player.car.pos.set(x, 0, z); } },
      setWanted: (n) => this.wanted.setStars(n, this),
      state: () => ({
        state: this.state,
        cash: this.cash,
        mission: this.missions.active?.def.id ?? null,
        step: this.missions.active?.stepIndex ?? null,
        timeLeft: this.missions.active?.timeLeft ?? null,
        stars: this.wanted.stars,
        health: this.player.health,
        inCar: this.player.inCar,
        police: this.police.cars.length,
        enemies: this.weapons.aliveEnemies().length,
        x: this.player.pos.x,
        z: this.player.pos.z,
      }),
    };

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._loop());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  currentZone() {
    return districtAt(this.player.pos.x, this.player.pos.z);
  }

  saveGame() {
    this.save.cash = this.cash;
    this.save.playerX = this.player.pos.x;
    this.save.playerZ = this.player.pos.z;
    writeSave(this.save);
  }

  newGame() {
    clearSave();
    this.save = defaultSave();
    this.cash = this.save.cash;
    this._resetWorld();
    this.player.pos.set(0, 0, 28);
    this._beginPlay();
    this.hud.showToast('Welcome to Meridian Bay', 'Press M to start your first mission — or explore the city. Steal a car with E.', 7);
  }

  continueGame() {
    this.save = loadSave() || defaultSave();
    this.cash = this.save.cash ?? 250;
    this._resetWorld();
    this.player.pos.set(this.save.playerX ?? 0, 0, this.save.playerZ ?? 40);
    this._beginPlay();
  }

  _resetWorld() {
    this.missions.cleanupMissionObjects();
    this.missions.active = null;
    this.wanted.clear();
    this.police.clearAll();
    this.player.health = CONFIG.player.maxHealth;
    this.player.dead = false;
    this.player.ammo = CONFIG.player.pistolAmmo;
    this.player.reserve = CONFIG.player.pistolReserve;
    if (this.player.inCar) this.exitCar();
    this.hud.hideEndOverlays();
    this.hud.hideMissionOverlay();
  }

  _beginPlay() {
    this.state = 'playing';
    this.menus.hideStart();
    this.menus.hidePause();
    document.getElementById('hud').classList.add('visible');
    this.sound.ensure();
    this.sound.startMusic();
    this.input.requestLock();
  }

  quitToMenu() {
    this.saveGame();
    this._resetWorld();
    this.state = 'menu';
    document.getElementById('hud').classList.remove('visible');
    this.menus.hidePause();
    this.menus.showStart(hasSave(), this.save);
    this.input.releaseLock();
    this.sound.setEngine(0, false);
    this.sound.setSiren(false);
  }

  togglePause(force) {
    const wantPause = force !== undefined ? force : this.state === 'playing';
    if (wantPause && this.state === 'playing') {
      this.state = 'paused';
      this.menus.showPause();
      this.input.releaseLock();
      this.sound.setEngine(0, false);
      this.sound.setSiren(false);
    } else if (!wantPause && this.state === 'paused') {
      this.state = 'playing';
      this.menus.hidePause();
      this.input.requestLock();
    }
  }

  restartMission() {
    const idx = this.missions.active ? this.missions.active.def.id : this.save.missionIndex;
    this._resetWorld();
    this._beginPlay();
    this.missions.startMission(Math.min(idx, 4));
  }

  resumeAfterMissionEnd() {
    this.hud.hideMissionOverlay();
    if (this.lastMissionFailed) {
      this.lastMissionFailed = false;
      this.restartMission();
      return;
    }
    this.state = 'playing';
    this.input.requestLock();
  }

  enterCar(car, { silent = false } = {}) {
    this.traffic.removeFromTraffic(car);
    const pi = this.police.cars.indexOf(car);
    if (pi !== -1) this.police.cars.splice(pi, 1);
    const bi = this.police.roadblockCars.indexOf(car);
    if (bi !== -1) this.police.roadblockCars.splice(bi, 1);
    car.driver = 'player';
    this.player.car = car;
    this.player.inCar = true;
    this.player.group.visible = false;
    if (!silent) {
      this.sound.uiClick();
      if (!car.stolen) {
        car.stolen = true;
        this.wanted.commit('stealCar', this);
        this.hud.showToast('Car stolen', 'The police noticed. Watch the stars.', 3);
      }
    }
    this.missions.onPlayerEnterCar(car);
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    this.traffic.parked.push(car);
    const f = car.forward();
    // Step out on the driver's side.
    this.player.pos.set(car.pos.x - f.z * 2.4, 0, car.pos.z + f.x * 2.4);
    this.city.collideCircle(this.player.pos, CONFIG.player.radius);
    this.player.car = null;
    this.player.inCar = false;
    this.player.group.visible = true;
    this.sound.setEngine(0, false);
  }

  onWantedChange(stars) {
    this.police.setTargetCount(CONFIG.police.carsPerStar[stars] || 0);
    if (stars >= 3) this.hud.showToast('Wanted level ' + stars, 'The whole force is after you. Break line of sight to cool off.', 3);
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.hud.showBusted();
    this.input.releaseLock();
    this.sound.setSiren(false);
    this.sound.setEngine(0, false);
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.hud.showWasted();
    this.input.releaseLock();
    this.sound.setEngine(0, false);
  }

  respawn() {
    const fine = Math.min(100, this.cash);
    this.cash -= fine;
    this._resetWorld();
    this.player.pos.set(0, 0, 28);
    this.player.health = CONFIG.player.maxHealth;
    this.player.dead = false;
    this.state = 'playing';
    this.hud.hideEndOverlays();
    this.input.requestLock();
    this.hud.showToast('Back on the streets', fine > 0 ? `The city took $${fine} off you.` : 'No cash to take. Lucky.', 4);
  }

  makeChoiceMarker(opt) {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: opt.color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 30;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 4, 24),
      new THREE.MeshBasicMaterial({ color: opt.color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    group.add(beam, ring);
    group.position.set(opt.x, 0, opt.z);
    this.scene.add(group);
    return group;
  }

  _loop() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;

    if (this.state === 'menu') {
      // Slow cinematic orbit over downtown behind the start screen.
      const t = this.time * 0.05;
      this.camera.position.set(Math.sin(t) * 130, 65, Math.cos(t) * 130);
      this.camera.lookAt(0, 0, 20);
      this.city.update(dt, this.time);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }
    if (this.state === 'paused') {
      this.renderer.render(this.scene, this.camera);
      if (this.input.pressed('Escape')) this.togglePause(false);
      this.input.endFrame();
      return;
    }
    if (this.state === 'missionEnd') {
      // World idles behind the overlay; the Continue button resumes.
      this.city.update(dt, this.time);
      this.beacon.update(this.time);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted') {
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }

    // ---- playing ----
    if (this.input.pressed('Escape')) {
      this.togglePause(true);
      this.input.endFrame();
      return;
    }
    if (this.input.pressed('KeyM')) {
      const next = this.missions.nextMission();
      if (next && !this.missions.active) this.missions.startMission(next.id);
      else if (this.missions.active) this.hud.showToast('Mission in progress', this.missions.objectiveText(), 3);
    }
    if (this.input.pressed('KeyR')) this.player.reload(this);

    // Mouse look + shooting.
    this.cameraRig.updateMouse(this.input.mouseDX, this.input.mouseDY);
    if (this.input.consumeMousePress() && !this.player.inCar && this.state === 'playing') {
      this.weapons.tryAttack(this);
    }

    this.player.update(dt, this);
    if (this.player.dead && this.state === 'playing') {
      this.wasted();
      this.input.endFrame();
      return;
    }
    this.traffic.update(dt, this);
    this.peds.update(dt, this);
    this.police.update(dt, this, this.time);
    this.wanted.update(dt, this);
    this.weapons.update(dt, this);
    this.missions.update(dt);
    this.particles.update(dt);
    this.city.update(dt, this.time);
    this.beacon.update(this.time);

    // Car-vs-car and car-vs-pedestrian collisions for the player's car.
    this._playerCarCollisions(dt);

    // Engine hum follows the player's car (or silence on foot).
    if (!this.player.inCar) this.sound.setEngine(0, false);

    this.cameraRig.update(dt, this, this.particles.shakeOffset());
    this.hud.update(dt);
    this.minimap.draw(this, this.time);

    // Chaos marker expires after a few seconds.
    if (this.chaosAt && this.time - this.chaosAt.t > 4) this.chaosAt = null;

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _playerCarCollisions(dt) {
    const player = this.player;
    if (!player.inCar || !player.car) return;
    const car = player.car;
    // Against traffic + police cars: bounce apart, both take damage.
    const others = [...this.traffic.cars, ...this.police.cars, ...this.police.roadblockCars, ...this.traffic.parked];
    for (const other of others) {
      if (other === car) continue;
      const dx = car.pos.x - other.pos.x;
      const dz = car.pos.z - other.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.6 && d > 0.01) {
        const push = (3.6 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        car.pos.x += nx * push;
        car.pos.z += nz * push;
        other.pos.x -= nx * push;
        other.pos.z -= nz * push;
        const impact = Math.abs(car.speed - other.speed);
        if (impact > 5) {
          car.crash(impact * 0.5);
          other.crash(impact * 0.5);
          this.sound.crash();
          this.particles.sparks(car.pos.x, 0.8, car.pos.z);
          this.particles.addShake(0.4);
          if (other.isPolice) this.wanted.commit('hitPolice', this);
        }
        car.speed *= 0.82;
        other.speed *= 0.82;
      }
    }
    // Against pedestrians: the dark side of arcade driving.
    for (const ped of this.peds.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(car.pos.x - ped.pos.x, car.pos.z - ped.pos.z);
      if (d < 2.2 && Math.abs(car.speed) > 3) {
        const wentDown = this.peds.hit(ped, 100, this);
        this.particles.blood(ped.pos.x, 1, ped.pos.z);
        this.particles.addShake(0.3);
        if (!ped.isEnemy) {
          this.wanted.commit(wentDown ? 'killPedestrian' : 'hitPedestrian', this);
          this.peds.scare(car.pos.x, car.pos.z, 30);
          this.chaosAt = { x: car.pos.x, z: car.pos.z, t: this.time };
        }
        car.speed *= 0.9;
      }
    }
  }
}

new Game();
