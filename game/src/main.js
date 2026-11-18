// Meridian Bay — boot, game loop and state machine.
// Wires every subsystem together, owns the menu/playing/paused states,
// and runs the ?shot= demo setups the screenshots are taken from.

import { CFG, LANDMARKS, districtAt } from './config.js';
import { Input } from './input.js';
import { City } from './world/city.js';
import { Daylight } from './world/daylight.js';
import { Character } from './player/character.js';
import { CameraRig } from './player/camera.js';
import { Car, PlayerDriving } from './vehicles/cars.js';
import { Traffic } from './vehicles/traffic.js';
import { Pedestrians } from './people/pedestrians.js';
import { Wanted } from './police/wanted.js';
import { Police } from './police/chase.js';
import { MissionManager } from './missions/manager.js';
import { Combat } from './combat/weapons.js';
import { HUD } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { Menus } from './ui/menus.js';
import { Sound } from './audio/sound.js';
import { Effects } from './effects/particles.js';
import { loadSave, writeSave, defaultSave, hasSave } from './save/storage.js';
import { SeededRandom } from './util/random.js';

const THREE = window.THREE;

class Game {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.seed = parseInt(params.get('seed') || '20261118', 10);
    this.shotMode = params.get('shot') || null;
    this.state = 'menu'; // menu | playing | paused
    this.time = 0;
    this.bigMapOpen = false;
    this.cityDistrict = 'Downtown';
    this.menuOrbitAngle = 0;

    // Renderer + scene.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 60, 120);

    // Save first: several systems read it at boot.
    this.save = loadSave() || defaultSave();

    // Subsystems, in dependency order.
    this.input = new Input();
    this.input.attach(this.renderer.domElement);
    this.input.onAnyKey = () => this.audio.unlock();
    this.audio = new Sound(this);
    this.fx = new Effects(this);
    this.city = new City(this);
    this.daylight = new Daylight(this);
    this.player = new Character(this, this.save.playerPos.x, this.save.playerPos.z);
    this.cameraRig = new CameraRig(this);
    this.driving = new PlayerDriving(this);
    this.parkedCars = [];
    this.spawnParkedCars();
    this.traffic = new Traffic(this);
    this.peds = new Pedestrians(this);
    this.wanted = new Wanted(this);
    this.police = new Police(this);
    this.combat = new Combat(this);
    this.missions = new MissionManager(this);
    this.hud = new HUD(this);
    this.minimap = new Minimap(this);
    this.menus = new Menus(this);
    this.wireMenuCallbacks();

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !this.shotMode) this.pauseGame();
    });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'playing' && !this.shotMode
        && this.input.pointerLockedEver) {
        this.pauseGame();
      }
    });
    this.renderer.domElement.addEventListener('mousedown', () => {
      if (this.state === 'playing') {
        this.input.pointerLockedEver = true;
        this.input.requestPointerLock();
      }
    });

    // Debug handle for playtests and screenshots (not part of gameplay).
    window.__mb = {
      game: this,
      startMission: (i) => this.missions.startMission(i),
      setWanted: (heat) => this.wanted.setHeat(heat),
      teleport: (x, z) => this.player.teleport(x, z),
      giveCash: (n) => { this.save.cash += n; },
      state: () => ({
        state: this.state,
        cash: this.save.cash,
        stars: this.wanted.stars,
        health: this.player.health,
        mission: this.missions.active ? this.missions.active.def.title : null,
        stage: this.missions.active ? this.missions.active.stageIndex : -1,
        objective: this.missions.objectiveText,
        enemiesAlive: this.combat.enemiesAlive(),
        police: this.police.cars.filter((c) => !c.dead).length,
        inCar: !!this.player.inCar,
        pos: { x: Math.round(this.player.x), z: Math.round(this.player.z) },
      }),
    };

    if (this.shotMode) {
      this.setupShotScene();
    } else {
      this.menus.showStart(hasSave());
      this.hud.hide();
    }
    this.lastFrame = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  spawnParkedCars() {
    const rng = new SeededRandom(this.seed + 99);
    // Kai's own ride outside the safehouse — the one car that is never a crime.
    const starter = new Car(this, LANDMARKS.safehouse.x + 8, LANDMARKS.safehouse.z + 4, Math.PI / 2, {
      driver: 'none', color: 0x1abc9c, kind: 'sedan', owned: true,
    });
    this.parkedCars.push(starter);
    for (let i = 0; i < 7; i++) {
      const p = this.city.randomRoadPoint(rng);
      const side = rng.chance(0.5) ? 1 : -1;
      const x = p.axis === 'x' ? p.x : p.x + side * 5.5;
      const z = p.axis === 'x' ? p.z + side * 5.5 : p.z;
      const heading = p.axis === 'x' ? Math.PI / 2 : 0;
      this.parkedCars.push(new Car(this, x, z, heading, {
        driver: 'none',
        color: [0xc0392b, 0x2980b9, 0xf1c40f, 0xe67e22, 0xecf0f1, 0x2c3e50][i % 6],
        kind: rng.chance(0.2) ? 'van' : 'sedan',
      }));
    }
  }

  wireMenuCallbacks() {
    const m = this.menus;
    m.on('newGame', () => this.newGame());
    m.on('continueGame', () => this.continueGame());
    m.on('resume', () => this.resumeGame());
    m.on('restartMission', () => this.restartMission());
    m.on('quitToTitle', () => this.quitToTitle());
    m.on('pickMission', (i) => this.pickMission(i));
    m.on('respawn', () => this.respawn());
    m.on('choiceMade', () => this.resumeGame());
    m.on('closeBigMap', () => this.toggleBigMap(false));
  }

  newGame() {
    this.save = defaultSave();
    writeSave(this.save);
    this.resetWorldToSafehouse();
    this.beginPlaying();
    this.hud.toast('Welcome to Meridian Bay. Mission 1: First Delivery.');
    this.missions.startMission(0);
  }

  continueGame() {
    this.resetWorldToSave();
    this.beginPlaying();
    this.hud.toast('Back in Meridian Bay. Press J to start your next mission.');
  }

  pickMission(i) {
    if (this.state === 'menu') {
      this.resetWorldToSave();
      this.beginPlaying();
    } else {
      this.resumeGame();
    }
    this.missions.startMission(i);
  }

  restartMission() {
    const active = this.missions.active;
    this.resumeGame();
    if (active) this.missions.startMission(active.def.id);
    else this.hud.toast('No mission is running.');
  }

  beginPlaying() {
    this.state = 'playing';
    this.menus.hideAll();
    this.hud.show();
    this.input.requestPointerLock();
  }

  resumeGame() {
    if (this.state !== 'playing') {
      this.state = 'playing';
      this.menus.hideAll();
      this.hud.show();
    }
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.saveGame();
    this.input.exitPointerLock();
    this.menus.showPause();
  }

  quitToTitle() {
    this.saveGame();
    if (this.missions.active) {
      this.missions.clearMissionObjects();
      this.missions.active = null;
    }
    this.state = 'menu';
    this.hud.hide();
    this.menus.showStart(hasSave());
  }

  resetWorldToSafehouse() {
    this.player.healFull();
    if (this.player.inCar) this.player.exitCar();
    this.player.teleport(LANDMARKS.safehouse.x, LANDMARKS.safehouse.z);
    this.wanted.clear();
    this.police.clearAll();
    this.combat.clearEnemies();
    this.cameraRig.snapTo(this.player);
  }

  resetWorldToSave() {
    this.resetWorldToSafehouse();
    this.player.teleport(this.save.playerPos.x, this.save.playerPos.z);
  }

  saveGame() {
    this.save.playerPos = { x: this.player.x, z: this.player.z };
    writeSave(this.save);
  }

  onPlayerDied(source) {
    if (this.missions.active) {
      this.missions.clearMissionObjects();
      this.missions.active = null;
    }
    this.state = 'paused';
    this.input.exitPointerLock();
    this.menus.showDead(source);
  }

  onPlayerBusted() {
    const fine = Math.min(this.save.cash, CFG.bustedFine);
    this.save.cash -= fine;
    if (this.missions.active) {
      this.missions.clearMissionObjects();
      this.missions.active = null;
    }
    this.state = 'paused';
    this.input.exitPointerLock();
    this.menus.showBusted(fine);
  }

  respawn() {
    const fine = Math.min(this.save.cash, CFG.deathFine);
    this.save.cash -= fine;
    this.resetWorldToSafehouse();
    this.saveGame();
    this.resumeGame();
    this.hud.toast(`You woke up at the safehouse. Medical bill: $${fine}.`);
  }

  toggleBigMap(open) {
    if (this.state !== 'playing') return;
    this.bigMapOpen = open === undefined ? !this.bigMapOpen : open;
    this.menus.showBigMap(this.bigMapOpen);
  }

  tryEnterOrExitCar() {
    const player = this.player;
    if (player.inCar) {
      player.exitCar();
      this.audio.uiClick();
      return;
    }
    const all = [...this.traffic.cars, ...this.parkedCars, ...this.police.cars];
    let best = null;
    let bestD = 4.5;
    for (const car of all) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) return;
    this.traffic.removeCar(best);
    const pi = this.parkedCars.indexOf(best);
    if (pi !== -1) this.parkedCars.splice(pi, 1);
    const ci = this.police.cars.indexOf(best);
    if (ci !== -1) this.police.cars.splice(ci, 1);
    player.enterCar(best);
    this.audio.uiClick();
    if (!best.owned && !best.isMissionTarget) {
      this.wanted.addCrime('stealCar');
      this.hud.toast('Car stolen! The PD won\'t like that.');
    }
    this.cameraRig.yaw = best.heading;
  }

  setupShotScene() {
    // Deterministic demo setups for the four screenshots. The game itself is
    // fully playable from each one — these are just starting positions.
    this.state = 'playing';
    this.menus.hideAll();
    this.hud.show();
    const shot = this.shotMode;
    if (shot === 'chase') {
      const car = new Car(this, -30, -60, Math.PI / 2, {
        driver: 'none', color: 0xe74c3c, kind: 'sedan', owned: true,
      });
      this.parkedCars.push(car);
      this.player.teleport(-30, -60);
      this.player.enterCar(car);
      car.speed = 22;
      this.cameraRig.yaw = Math.PI / 2;
      this.missions.startMission(2);
      this.wanted.setHeat(58);
      for (let i = 0; i < 4; i++) this.police.spawnCruiser(-30, -60, 35, 70);
      this.hud.hideBanner();
      this.hud.showBanner('HEAT RUN', 'Checkpoint 1 — Bayfront. Lose the heat after the third.');
    } else if (shot === 'drive') {
      const car = new Car(this, -120, 210, Math.PI / 2, {
        driver: 'none', color: 0x2980b9, kind: 'sedan', owned: true,
      });
      this.parkedCars.push(car);
      this.player.teleport(-120, 210);
      this.player.enterCar(car);
      car.speed = 30;
      this.cameraRig.yaw = Math.PI / 2;
    } else if (shot === 'mission') {
      this.player.teleport(200, 120);
      this.player.heading = Math.PI / 2;
      this.cameraRig.yaw = Math.PI / 2;
      this.missions.startMission(3);
      this.missions.debugJumpToStage(1);
      this.hud.hideBanner();
      this.hud.showBanner('PORT AMBUSH', 'Defeat the Vesper gunmen at the port.');
    } else {
      // foot: Kai on foot downtown among peds and traffic.
      this.player.teleport(-24, -24);
      this.player.heading = Math.PI * 0.75;
      this.cameraRig.yaw = Math.PI * 0.75;
      this.hud.toast('Downtown Meridian Bay — press J to start a mission.');
    }
    this.cameraRig.snapTo(this.player.inCar || this.player);
  }

  frame() {
    const now = performance.now();
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    if (this.state === 'playing') {
      this.updatePlaying(dt);
    } else if (this.state === 'menu') {
      this.updateMenuCamera(dt);
      this.city.update(dt, this.time);
    }
    this.fx.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  updateMenuCamera(dt) {
    this.menuOrbitAngle += dt * 0.05;
    const r = 150;
    const cx = Math.sin(this.menuOrbitAngle) * r;
    const cz = Math.cos(this.menuOrbitAngle) * r;
    this.camera.position.set(cx, 70, cz);
    this.camera.lookAt(0, 10, 0);
  }

  updatePlaying(dt) {
    const input = this.input;
    // Global keys.
    if (input.pressed('Escape')) {
      if (this.bigMapOpen) this.toggleBigMap(false);
      else this.pauseGame();
      return;
    }
    if (input.pressed('KeyM')) this.toggleBigMap();
    if (input.pressed('KeyJ') && !this.missions.active) {
      const next = [0, 1, 2, 3, 4].find(
        (i) => !this.save.completed.includes(i) && i <= this.save.unlocked,
      );
      if (next !== undefined) this.missions.startMission(next);
      else this.hud.toast('Every mission is complete — Meridian Bay is yours.');
    }
    if (input.pressed('KeyE')) this.tryEnterOrExitCar();

    const player = this.player;
    const inCar = !!player.inCar;
    if (!inCar) player.update(dt, input, this.cameraRig.yaw);
    else this.driving.update(dt);
    this.traffic.update(dt);
    this.peds.update(dt);
    this.wanted.update(dt);
    this.police.update(dt);
    this.combat.update(dt);
    this.missions.update(dt);
    this.city.update(dt, this.time);
    this.cityDistrict = districtAt(player.x, player.z);
    this.daylight.update(player.x, player.z);
    const target = player.inCar || player;
    this.cameraRig.update(dt, target, inCar, inCar ? player.inCar.speed01 : 0);
    this.hud.update(dt);
    this.minimap.update();
    if (!inCar) this.audio.setEngine(0, false);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Boot once the DOM is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Game());
} else {
  new Game();
}
