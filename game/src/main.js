// Meridian Bay — boot, game loop and state machine.
// Menu / playing / paused / mission-end, and every system wired together.

import { CONFIG, districtAt, WEAPONS } from './config.js';
import { Input } from './input.js';
import { buildCity } from './world/city.js';
import { createDaylight } from './world/daylight.js';
import { Character } from './player/character.js';
import { FollowCamera } from './player/camera.js';
import { Car } from './vehicles/cars.js';
import { TrafficManager } from './vehicles/traffic.js';
import { PedestrianManager } from './people/pedestrians.js';
import { WantedSystem } from './police/wanted.js';
import { PoliceManager } from './police/chase.js';
import { MissionManager } from './missions/manager.js';
import { MISSIONS } from './missions/story.js';
import { Weapons } from './combat/weapons.js';
import { ParticleSystem } from './effects/particles.js';
import { SoundEngine } from './audio/sound.js';
import { HUD } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { Menus } from './ui/menus.js';
import { saveGame, loadGame, hasSave, clearSave } from './save/storage.js';
import { stageShot } from './shots/staging.js';

class Game {
  constructor() {
    this.mode = 'menu';
    this.cash = CONFIG.startCash;
    this.kills = 0;
    this.currentCar = null;
    this.parkedCars = [];
    this.saveTimer = 0;
    this.shotReadyFrames = -1;
    this.menuAngle = 0;
    this.headlights = false;
    this.time = 0;

    const container = document.getElementById('game-container');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1400);
    this.camera.position.set(0, 60, 120);

    this.city = buildCity(this.scene);
    this.daylight = createDaylight(this.scene, CONFIG);
    this.input = new Input(this.renderer.domElement);
    // Esc leaves pointer lock without a keydown, so a lock loss while
    // playing is the pause signal.
    this.input.onLockChange = (locked) => {
      if (!locked && this.mode === 'playing') this.pause();
    };
    this.character = new Character(this.scene, this.city.colliders);
    this.character.setPosition(0, -20, Math.PI);
    this.followCam = new FollowCamera(this.camera, this.city.solidMeshes);
    this.followCam.snapTo(new THREE.Vector3(0, 4, -12));

    this.traffic = new TrafficManager(this.scene, this.city.colliders);
    this.traffic.spawn(12);
    this.peds = new PedestrianManager(this.scene, this.city.colliders);
    this.peds.spawn(22);
    this.wanted = new WantedSystem();
    this.police = new PoliceManager(this.scene, this.city.colliders);
    this.particles = new ParticleSystem(this.scene);
    this.sound = new SoundEngine();
    this.weapons = new Weapons(this.scene, this.particles, {
      onShoot: () => {
        this.sound.shot();
        const m = this.missions.mission;
        const inShootout = m && m.id === 4 && this.missions.objective?.type === 'eliminate';
        if (!inShootout) this.wanted.addCrime('shoot');
        this.peds.scare(this.playerPos());
        this.traffic.scare(this.playerPos());
      },
      onDamageNumber: (pos, amount) => this.hud.damageNumber(pos, amount),
    });
    this.missions = new MissionManager(this.scene, this.city.colliders, {
      toast: (t, x) => this.hud.toast(t, x),
      setWanted: (n) => this.wanted.setStars(n),
      onComplete: (m) => this.onMissionComplete(m),
      onFail: (m, reason) => this.onMissionFail(m, reason),
    });
    this.hud = new HUD(this.camera, this.renderer);
    this.minimap = new Minimap('minimap-canvas', 220, 130);
    this.bigMap = new Minimap('map-canvas', 560, 380);
    this.menus = new Menus({
      onNewGame: () => this.newGame(),
      onContinue: () => this.continueGame(),
      onResume: () => this.resume(),
      onRestartMission: () => this.restartMission(),
      onQuitToMenu: () => this.quitToMenu(),
    });

    this.spawnParkedCars();
    this.wireEvents();
    this.menus.showStart(hasSave());
    this.hud.hide();

    // Debug hooks for playtesting and screenshot staging.
    window.__game = this;
    window.__stageShot = (name) => stageShot(this, name);
    window.__fireOnce = () => this.fireAtNearestEnemy();
    window.__shotReady = false;

    // Auto-stage from the URL: ?shot=cover|foot|drive|mission
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      this.newGameSilent();
      setTimeout(() => stageShot(this, shot), 60);
    }

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.loop());
  }

  // --- Setup -------------------------------------------------------------

  spawnParkedCars() {
    const spots = [
      [12, -68, 0, 0xc94f4f], [-12, 68, Math.PI, 0x4f7ec9],
      [76, -136, Math.PI / 2, 0xe8c547], [-76, 136, -Math.PI / 2, 0x7fb069],
      [12, 204, 0, 0xd9d9d9], [-140, -12, Math.PI / 2, 0xe07b39],
      [140, 272, Math.PI / 2, 0x8e6cc9], [-204, -68, 0, 0x4fb0c9],
    ];
    for (const [x, z, h, color] of spots) {
      const car = new Car(this.scene, this.city.colliders, color);
      car.setPosition(x, z, h);
      car.ai = { parked: true };
      this.parkedCars.push(car);
    }
  }

  wireEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.renderer.domElement.addEventListener('mousedown', () => {
      this.sound.unlock();
      if (this.mode === 'playing') this.input.lock();
    });
    window.addEventListener('keydown', () => this.sound.unlock());
  }

  // --- Flow --------------------------------------------------------------

  newGameSilent() {
    clearSave();
    this.cash = CONFIG.startCash;
    this.kills = 0;
    this.character.hp = CONFIG.playerMaxHp;
    this.weapons.ammo = CONFIG.pistolMag;
    this.weapons.reserve = CONFIG.pistolReserveStart;
    this.wanted.clear();
    this.police.clearAll();
    this.startPlaying();
  }

  newGame() {
    this.newGameSilent();
    this.missions.startMission(0);
    this.hud.toast('WELCOME TO MERIDIAN BAY', 'Rook has a job for you. Follow the yellow marker.');
  }

  continueGame() {
    const save = loadGame();
    this.newGameSilent();
    if (save) {
      this.cash = save.cash ?? CONFIG.startCash;
      this.kills = save.kills ?? 0;
      this.character.hp = save.hp ?? CONFIG.playerMaxHp;
      this.weapons.ammo = save.ammo ?? CONFIG.pistolMag;
      this.weapons.reserve = save.reserveAmmo ?? CONFIG.pistolReserveStart;
      if (save.position) this.character.setPosition(save.position.x, save.position.z, 0);
      this.missions.startMission(Math.min(save.missionIndex ?? 0, MISSIONS.length - 1));
    } else {
      this.missions.startMission(0);
    }
  }

  startPlaying() {
    this.mode = 'playing';
    this.menus.hideAll();
    this.hud.show();
    this.input.lock();
  }

  resume() {
    if (this.mode === 'complete') {
      const next = this.missions.index + 1;
      if (next < MISSIONS.length) {
        this.missions.startMission(next);
      } else {
        this.missions.active = false;
        this.hud.toast('STORY COMPLETE', 'Meridian Bay is yours now, Kai. Free roam.');
      }
    }
    this.startPlaying();
  }

  restartMission() {
    this.wanted.clear();
    this.police.clearAll();
    this.character.hp = CONFIG.playerMaxHp;
    this.character.setPosition(0, -20, Math.PI);
    if (this.currentCar) this.exitCar();
    this.missions.retry();
    this.startPlaying();
  }

  quitToMenu() {
    this.save();
    if (this.currentCar) this.exitCar();
    this.mode = 'menu';
    this.hud.hide();
    this.menus.showStart(hasSave());
    this.input.unlock();
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.menus.showPause();
    this.input.unlock();
    this.save();
  }

  onMissionComplete(mission) {
    this.cash += mission.reward;
    this.sound.missionJingle();
    this.save();
    this.mode = 'complete';
    this.menus.showComplete(mission, this.cash);
    this.input.unlock();
  }

  onMissionFail(mission, reason) {
    this.mode = 'failed';
    this.menus.showFailed(mission, reason);
    this.input.unlock();
  }

  save() {
    saveGame({
      missionIndex: this.missions.index,
      cash: this.cash,
      hp: this.character.hp,
      ammo: this.weapons.ammo,
      reserveAmmo: this.weapons.reserve,
      kills: this.kills,
      position: this.currentCar
        ? { x: this.currentCar.x, z: this.currentCar.z }
        : { x: this.character.x, z: this.character.z },
    });
  }

  // --- Player / car --------------------------------------------------------

  playerPos() {
    return this.currentCar ? this.currentCar.position : this.character.position;
  }

  playerHeading() {
    return this.currentCar ? this.currentCar.heading : this.character.heading;
  }

  playerSpeed() {
    return this.currentCar ? Math.abs(this.currentCar.speed) : this.character.speed;
  }

  spawnPlayerCar(x, z, heading, color) {
    const car = new Car(this.scene, this.city.colliders, color);
    car.setPosition(x, z, heading);
    car.playerOwned = true;
    this.parkedCars.push(car);
    return car;
  }

  teleportPlayer(x, z, heading) {
    if (this.currentCar) this.exitCar();
    this.character.setPosition(x, z, heading);
    this.followCam.snapTo(new THREE.Vector3(x, 4, z + 8));
  }

  nearestCar(maxDist = 4.5) {
    const p = this.character.position;
    let best = null;
    let bestD = maxDist;
    const candidates = [...this.parkedCars, ...this.traffic.cars];
    if (this.missions.missionCar) candidates.push(this.missions.missionCar);
    for (const car of candidates) {
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  enterCar(car) {
    if (!car.playerOwned) {
      this.wanted.addCrime('stealCar');
      this.hud.toast('CAR STOLEN', 'That one had an owner. The cops noticed.');
    }
    car.playerOwned = true;
    this.currentCar = car;
    this.missions.enteredCar = car;
    this.parkedCars = this.parkedCars.filter((c) => c !== car);
    this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
    this.character.setVisible(false);
    this.followCam.setDriving(true);
    this.sound.pickup();
  }

  exitCar() {
    const car = this.currentCar;
    if (!car) return;
    this.cruiseSpeed = 0;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.character.setPosition(car.x + side.x * 2.6, car.z + side.z * 2.6, car.heading);
    this.character.setVisible(true);
    this.currentCar = null;
    this.followCam.setDriving(false);
    this.parkedCars.push(car);
  }

  setCameraYaw(yaw, pitch) {
    this.followCam.yaw = yaw;
    this.followCam.pitch = pitch;
  }

  setHudState(s) {
    if (s.cash !== undefined) this.cash = s.cash;
    if (s.hp !== undefined) this.character.hp = s.hp;
    if (s.ammo !== undefined) this.weapons.ammo = s.ammo;
    if (s.reserve !== undefined) this.weapons.reserve = s.reserve;
    if (s.wanted !== undefined) this.wanted.setStars(s.wanted);
    if (s.kills !== undefined) this.kills = s.kills;
  }

  markShotReady() {
    this.shotReadyFrames = 3;
  }

  // --- Combat --------------------------------------------------------------

  aimDirection(out) {
    this.camera.getWorldDirection(out);
    return out;
  }

  playerShoot() {
    const origin = this.character.muzzleWorld(new THREE.Vector3());
    const dir = this.aimDirection(new THREE.Vector3());
    const hit = this.weapons.shoot(
      origin, dir,
      this.missions.enemies.raycastTargets(),
      this.city.solidMeshes,
    );
    if (hit) {
      const killed = this.missions.enemies.damage(hit, CONFIG.pistolDamage);
      if (killed) {
        this.kills++;
        this.sound.pickup();
      }
    }
    return hit;
  }

  fireAtNearestEnemy() {
    const p = this.playerPos();
    let best = null;
    let bestD = Infinity;
    for (const e of this.missions.enemies.list) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return null;
    const origin = this.character.muzzleWorld(new THREE.Vector3());
    const target = new THREE.Vector3(best.x, 1.3, best.z);
    const dir = target.clone().sub(origin).normalize();
    const hit = this.weapons.shoot(origin, dir, this.missions.enemies.raycastTargets(), this.city.solidMeshes);
    if (hit) {
      const killed = this.missions.enemies.damage(hit, CONFIG.pistolDamage);
      if (killed) this.kills++;
    }
    return hit;
  }

  // --- Loop ------------------------------------------------------------------

  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    if (this.mode === 'menu') {
      this.menuAngle += dt * 0.05;
      this.camera.position.set(Math.sin(this.menuAngle) * 130, 62, Math.cos(this.menuAngle) * 130);
      this.camera.lookAt(0, 0, 0);
      this.traffic.update(dt, this.time, null);
      this.peds.update(dt);
      this.daylight.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.mode !== 'playing') {
      // Esc resumes from pause (the keydown still arrives when unlocked).
      if (this.mode === 'paused' && this.input.wasPressed('escape')) {
        this.resume();
      } else {
        this.input.endFrame();
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const input = this.input;
    const look = input.consumeLook();
    this.followCam.addLook(look.dx, look.dy);

    // Global keys.
    if (input.wasPressed('escape')) {
      if (this.menus.mapOpen) this.menus.showMap(false);
      else if (this.menus.helpOpen) this.menus.showHelp(false);
      else this.pause();
    }
    if (input.wasPressed('m')) this.menus.showMap(!this.menus.mapOpen);
    if (input.wasPressed('f')) this.toggleHeadlights();
    if (input.wasPressed('r') && this.weapons.reload()) this.sound.reload();

    const driving = !!this.currentCar;
    if (driving) {
      this.updateDriving(dt);
    } else {
      this.character.update(dt, input, this.followCam.yaw);
      if (input.mouseDown) this.playerShoot();
      if (input.wasPressed('e')) {
        const car = this.nearestCar();
        if (car) this.enterCar(car);
      }
    }
    if (driving && input.wasPressed('e')) this.exitCar();

    // World systems.
    this.traffic.update(dt, this.time, driving ? null : this.character.position);
    this.peds.update(dt);
    this.daylight.update(dt);
    this.weapons.update(dt);
    this.particles.update(dt);
    this.sound.update(dt);

    // Wanted + police.
    const policeNear = this.police.nearestDistance(this.playerPos()) < 80;
    this.wanted.update(dt, this.playerPos(), policeNear);
    const busted = this.police.update(
      dt, this.time, this.wanted.stars,
      this.playerPos(), this.playerSpeed(), this.playerHeading(),
    );
    this.sound.setSiren(this.wanted.stars > 0);
    if (busted) {
      this.cash = Math.max(0, this.cash - 100);
      this.wanted.clear();
      this.police.clearAll();
      this.character.setPosition(-34, -34, 0);
      if (this.currentCar) this.exitCar();
      this.missions.fail('The Meridian Bay PD caught up with Kai. $100 in fines.');
      this.hud.toast('BUSTED', 'The cops took you in. $100 fine.');
    }

    // Missions + enemies.
    this.missions.update(dt, this.time, {
      playerPos: this.playerPos(),
      inCar: driving,
      enteredCar: this.missions.enteredCar,
      wantedStars: this.wanted.stars,
    });
    this.missions.enemies.update(dt, this.playerPos(), this.camera, (from, to, hit) => {
      this.weapons.enemyShot(from, to);
      if (hit) {
        this.hud.flashDamage();
        this.followCam.addShake(0.4);
        if (this.character.damage(7)) {
          this.missions.fail('Kai was taken down at the port.');
        }
      }
    });

    // Car-vs-pedestrian collisions while driving.
    if (driving && Math.abs(this.currentCar.speed) > 5) {
      const car = this.currentCar;
      const ped = this.peds.nearestTo(car.x, car.z, 2.8);
      if (ped) {
        ped.alive = false;
        ped.group.rotation.x = -Math.PI / 2;
        ped.group.position.y = 0.3;
        this.wanted.addCrime('hitPed');
        this.peds.scare({ x: car.x, z: car.z });
        this.followCam.addShake(0.5);
        this.sound.crash();
      }
    }

    // Camera + HUD.
    const target = this.playerPos();
    this.followCam.update(dt, target, driving ? 1.8 : 1.5);
    this.updateHud();
    this.hud.update(dt);

    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      this.save();
    }

    if (this.shotReadyFrames > 0) {
      this.shotReadyFrames--;
      if (this.shotReadyFrames === 0) window.__shotReady = true;
    }

    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }

  updateDriving(dt) {
    const car = this.currentCar;
    const input = this.input;
    const axes = input.moveAxes();
    // Cruise control (used by screenshot staging): hold a target speed
    // until the driver touches W/S.
    let throttle = axes.forward;
    if (this.cruiseSpeed && axes.forward === 0) {
      throttle = car.speed < this.cruiseSpeed ? 0.85 : 0;
    } else if (axes.forward !== 0) {
      this.cruiseSpeed = 0;
    }
    const steer = -axes.strafe;
    const handbrake = input.isDown(' ');
    const result = car.drive(dt, throttle, steer, handbrake);
    if (result.crashed && Math.abs(car.speed) > 4) {
      this.followCam.addShake(0.5);
      this.sound.crash();
      this.particles.burst(car.position.clone().setY(1), 0xffd76a, 8, 4, 0.4);
      if (this.police.nearestDistance(car.position) < 8) this.wanted.addCrime('crashCop');
    }
    if (car.skidding) {
      const back = { x: -Math.sin(car.heading), z: -Math.cos(car.heading) };
      this.particles.laySkid(
        car.x + back.x * 1.4 + Math.cos(car.heading) * 0.9,
        car.z + back.z * 1.4 - Math.sin(car.heading) * 0.9,
        car.heading,
      );
    }
    if (car.damage > 50 && Math.random() < dt * 6) {
      this.particles.smoke(car.position.clone().setY(1.4), 1);
    }
    this.sound.setEngine(Math.abs(car.speed) / CONFIG.carMaxSpeed, true);
  }

  toggleHeadlights() {
    this.headlights = !this.headlights;
    const car = this.currentCar;
    if (!car) return;
    if (this.headlights && !car.headlight) {
      car.headlight = new THREE.PointLight(0xfff2c9, 30, 26, 1.6);
      car.headlight.position.set(0, 1, 2.6);
      car.group.add(car.headlight);
    }
    if (car.headlight) car.headlight.visible = this.headlights;
  }

  updateHud() {
    const driving = !!this.currentCar;
    this.hud.setState({
      hp: this.character.hp,
      cash: this.cash,
      stars: this.wanted.stars,
      weaponIcon: WEAPONS.pistol.icon,
      weaponName: WEAPONS.pistol.name,
      ammo: this.weapons.ammo,
      mag: CONFIG.pistolMag,
      reserve: this.weapons.reserve,
      kills: this.kills,
      driving,
      speedKmh: driving ? this.currentCar.kmh() : 0,
    });
    if (this.missions.active && this.missions.mission) {
      const m = this.missions.mission;
      const o = this.missions.objective;
      const progress = o?.type === 'eliminate'
        ? `${o.count - this.missions.enemies.aliveCount()}/${o.count} ELIMINATED`
        : '';
      this.hud.setObjective(`MISSION ${m.id}: ${m.title}`, this.missions.objectiveText, progress);
    } else if (this.missions.finished) {
      this.hud.setObjective('FREE ROAM', 'Meridian Bay is yours — explore, earn, survive.');
    } else {
      this.hud.setObjective('', '');
    }
    const p = this.playerPos();
    const district = districtAt(p.x, p.z);
    const zone = this.wanted.inLayLowZone(p.x, p.z);
    this.hud.setDistrict(district, zone ? `${zone.name} — LAY LOW` : 'MERIDIAN BAY');
    if (!driving) {
      const car = this.nearestCar();
      if (car) {
        const screen = this.hud.project(new THREE.Vector3(car.x, 2.4, car.z));
        if (screen) {
          const label = car === this.missions.missionCar ? 'Enter Delivery Car' : 'Enter Car';
          this.hud.showPrompt('E', label, screen.x, screen.y);
        } else {
          this.hud.hidePrompt();
        }
      } else {
        this.hud.hidePrompt();
      }
    } else {
      this.hud.hidePrompt();
    }
    if (!this.sound.engineOsc) this.sound.setEngine(0, false);
    else if (!driving) this.sound.setEngine(0, false);
    this.minimap.draw({
      playerX: p.x, playerZ: p.z, playerHeading: this.playerHeading(),
      traffic: this.traffic.positions(),
      peds: this.peds.positions(),
      police: this.police.positions(),
      marker: this.missions.active ? this.missions.marker() : null,
      hideout: this.city.hideout,
      time: this.time,
    });
    if (this.menus.mapOpen) {
      this.bigMap.draw({
        playerX: p.x, playerZ: p.z, playerHeading: this.playerHeading(),
        traffic: this.traffic.positions(),
        peds: this.peds.positions(),
        police: this.police.positions(),
        marker: this.missions.active ? this.missions.marker() : null,
        hideout: this.city.hideout,
        time: this.time,
      });
    }
  }
}

new Game();
