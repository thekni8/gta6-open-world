// Meridian Bay — boot, game loop, and the wiring between every system.
// The state machine is menu / playing / paused / end. URL presets
// (?scene=chase|foot|drive|mission) drop the player straight into a live
// game state for screenshots; they use the same systems as normal play.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { seededRandom, clamp, flatDist } from './util/random.js';
import { Input } from './input.js';
import { SoundEngine } from './audio/sound.js';
import { Daylight } from './world/daylight.js';
import { buildCity } from './world/city.js';
import { Character } from './player/character.js';
import { FollowCamera } from './player/camera.js';
import { Car } from './vehicles/cars.js';
import { Traffic } from './vehicles/traffic.js';
import { Pedestrians } from './people/pedestrians.js';
import { Wanted } from './police/wanted.js';
import { Police } from './police/chase.js';
import { MISSIONS } from './missions/story.js';
import { MissionManager } from './missions/manager.js';
import { Weapons, Enemies } from './combat/weapons.js';
import { Particles } from './effects/particles.js';
import { Save } from './save/storage.js';
import { HUD } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { Menus } from './ui/menus.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.mode = 'menu'; // menu | playing | paused | end
    this.cash = 200;
    this.autoDrive = false;
    this.crimeCooldown = {};
    this.menuOrbit = 0;
    this.saveTimer = 0;
    this.smokeTimer = 0;
    this.exhaustTimer = 0;
    // Screenshot staging: ?scene=… presets set sceneName; the game raises
    // window.__shotReady once the staged action has settled (police closed
    // in, traffic in frame), so the shot driver captures the peak moment.
    this.sceneName = null;
    this.shotTimer = 0;
    this.chaseBlockerStaged = false;

    // Test hooks (never part of normal play): ?fast=1 drops shadows and
    // tone mapping so the game runs fast in a software renderer, and
    // ?speed=N advances N× game time per frame so long missions can be
    // play-tested in minutes. Screenshots always use the full-quality path.
    const params = new URLSearchParams(window.location.search);
    this.fastMode = params.get('fast') === '1';
    this.timeScale = Math.max(1, Math.min(8, Number(params.get('speed')) || 1));

    const canvas = $('game');
    // Fast mode also drops antialiasing: MSAA is pure fill cost in a
    // software renderer, and test frames don't need smooth edges.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.fastMode });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.fastMode;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = this.fastMode ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const rng = seededRandom(CONFIG.world.seed);
    this.rng = rng;
    this.daylight = new Daylight(this.scene);
    this.city = buildCity(this.scene, rng);
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.particles = new Particles(this.scene);
    this.player = new Character(this.scene);
    this.followCam = new FollowCamera(this.camera);
    this.traffic = new Traffic(this.scene, this.city, rng);
    this.peds = new Pedestrians(this.scene, this.city, rng);
    this.wanted = new Wanted();
    this.police = new Police(this.scene, this.city, rng);
    this.enemies = new Enemies(this.scene, this.city, rng);
    this.weapons = new Weapons(this.scene, this.camera, rng);
    this.hud = new HUD();
    this.minimap = new Minimap($('minimap'), this.city);
    this.playerCar = null;
    this.missionCar = null;
    this.headlightL = null;
    this.headlightR = null;
    this.headlightsOn = false;
    this.markerPos = null;
    this.choiceMarkers = null;

    this.buildMarkerBeacons();
    this.buildHeadlights();
    this.wireSystems();

    this.missions = new MissionManager(this.ctx());
    this.missions.onEvent = (kind, payload) => this.onMissionEvent(kind, payload);
    this.menus = new Menus({
      newGame: () => this.newGame(),
      continueGame: () => this.continueGame(),
      resume: () => this.setMode('playing'),
      restartMission: () => this.restartMission(),
      quitToMenu: () => this.quitToMenu(),
      toggleMute: () => this.sound.toggleMute(),
      nextMission: () => this.nextMission(),
      retryMission: () => this.retryMission(),
    });

    window.addEventListener('keydown', () => this.sound.ensure(), { once: true });
    canvas.addEventListener('mousedown', () => this.sound.ensure(), { once: true });

    // Automation hooks (screenshots / play-testing only).
    window.__game = {
      mode: () => this.mode,
      wanted: () => this.wanted.stars,
      cash: () => this.cash,
      mission: () => (this.missions.active ? this.missions.active.def.id : null),
      driving: () => !!this.playerCar,
      health: () => this.player.health,
      shotReady: () => !!window.__shotReady,
      pos: () => ({ x: this.playerPos().x, z: this.playerPos().z }),
      enemies: () => this.enemies.list.length,
      police: () => this.police.cars.length,
      ammo: () => this.weapons.ammo,
      // Test-only helpers (play-testing in a headless browser): move Kai
      // or his car, turn toward the nearest gunman, and patch health up.
      teleport: (x, z) => {
        if (this.playerCar) {
          this.playerCar.pos.set(x, 0, z);
          this.playerCar.group.position.copy(this.playerCar.pos);
          this.playerCar.speed = 0;
        } else {
          this.player.pos.set(x, 0, z);
          this.player.group.position.copy(this.player.pos);
        }
      },
      faceNearestEnemy: () => {
        const pp = this.playerPos();
        let best = null;
        let bd = Infinity;
        for (const e of this.enemies.list) {
          const d = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        if (!best) return false;
        const dx = best.pos.x - pp.x;
        const dz = best.pos.z - pp.z;
        this.player.heading = Math.atan2(dx, dz);
        this.followCam.yaw = Math.atan2(-dx, -dz);
        return true;
      },
      setHealth: (n) => {
        this.player.health = n;
      },
      setAutoDrive: (on) => {
        this.autoDrive = on;
      },
      missionCarPos: () => {
        const c = this.missionCar;
        return c ? { x: c.pos.x, z: c.pos.z } : null;
      },
      nearestPoliceDist: () => {
        const pp = this.playerPos();
        let bd = null;
        for (const c of this.police.cars) {
          const d = Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z);
          if (bd === null || d < bd) bd = d;
        }
        return bd;
      },
    };
    window.__ready = false;

    this.menus.showStart(!!Save.load());
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  // ---- context handed to missions / combat -------------------------------
  ctx() {
    return {
      scene: this.scene,
      city: this.city,
      enemies: this.enemies,
      peds: this.peds,
      traffic: this.traffic,
      police: this.police,
      particles: this.particles,
      playerPos: () => this.playerPos(),
      wantedStars: () => this.wanted.stars,
      playerAlive: () => this.player.alive,
      landmarkPos: (name) => {
        const l = this.city.landmarks[name];
        return { x: l.x, z: l.z };
      },
      setWanted: (n) => {
        this.wanted.stars = n;
        this.wanted.onChange?.(n);
      },
      spawnEnemies: (n, center) => this.enemies.spawn(n, center),
      spawnMissionCar: (at) => this.spawnMissionCar(at),
      showMarker: (pos) => this.showMarker(pos),
      hideMarker: () => this.hideMarker(),
      showChoiceMarkers: (h, v) => this.showChoiceMarkers(h, v),
      addCash: (n) => this.addCash(n),
      clearWanted: () => this.wanted.clear(),
      clearEnemies: () => this.enemies.clear(),
      saveGame: () => this.saveGame(),
    };
  }

  // ---- markers ------------------------------------------------------------
  buildMarkerBeacons() {
    const mk = (color) => {
      const g = new THREE.Group();
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.4, 42, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      beam.position.y = 21;
      g.add(beam);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.2, 3.0, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.12;
      g.add(ring);
      g.visible = false;
      this.scene.add(g);
      return g;
    };
    this.beacon = mk(0xffd23f);
    this.beaconHarbor = mk(0xffd23f);
    this.beaconVesper = mk(0xb45fd9);
  }

  showMarker(pos) {
    this.markerPos = pos;
    this.choiceMarkers = null;
    this.beacon.position.set(pos.x, 0, pos.z);
    this.beacon.visible = true;
    this.beaconHarbor.visible = false;
    this.beaconVesper.visible = false;
  }

  showChoiceMarkers(harbor, vesper) {
    this.markerPos = null;
    this.choiceMarkers = { harbor, vesper };
    this.beacon.visible = false;
    this.beaconHarbor.position.set(harbor.x, 0, harbor.z);
    this.beaconHarbor.visible = true;
    this.beaconVesper.position.set(vesper.x, 0, vesper.z);
    this.beaconVesper.visible = true;
  }

  hideMarker() {
    this.markerPos = null;
    this.choiceMarkers = null;
    this.beacon.visible = false;
    this.beaconHarbor.visible = false;
    this.beaconVesper.visible = false;
  }

  buildHeadlights() {
    const mkLight = () => {
      const s = new THREE.SpotLight(0xfff2b0, 0, 55, 0.5, 0.5, 1.2);
      s.visible = false;
      this.scene.add(s);
      this.scene.add(s.target);
      return s;
    };
    this.headlightL = mkLight();
    this.headlightR = mkLight();
  }

  updateHeadlights() {
    const car = this.playerCar;
    const on = this.headlightsOn && !!car;
    for (const [light, side] of [[this.headlightL, -0.65], [this.headlightR, 0.65]]) {
      light.visible = on;
      if (car) {
        const fx = Math.sin(car.heading);
        const fz = Math.cos(car.heading);
        light.position.set(
          car.pos.x + Math.cos(car.heading) * side * -1 + fx * 2,
          1.1,
          car.pos.z + fz * 2 + Math.sin(car.heading) * side,
        );
        light.target.position.set(car.pos.x + fx * 30, 0, car.pos.z + fz * 30);
      }
    }
  }

  // ---- wiring -------------------------------------------------------------
  wireSystems() {
    this.peds.onHit = () => this.addCrime('hitPedestrian');
    this.police.onRam = () => {
      this.followCam.addShake(0.35);
      this.sound.thud(0.8);
      const p = this.playerPos();
      this.particles.spark(p.x, 1, p.z, 14);
    };
    this.wanted.onChange = (stars) => {
      this.sound.setSiren(stars);
      if (stars > 0) this.hud.toast(`Wanted level ${stars} — lose the cops!`);
    };
    this.weapons.onShot = () => {
      this.sound.shot();
      const pp = this.playerPos();
      this.peds.scare(pp.x, pp.z, 26);
      this.addCrime('shoot');
    };
    this.weapons.onHit = (kind) => {
      if (kind === 'enemy') this.missions.enemyKilled();
      if (kind === 'ped') this.addCrime('killPedestrian');
      if (kind === 'car') {
        // Shooting a police car is worse than shooting a civilian one.
        const pp = this.playerPos();
        const nearPolice = this.police.cars.some(
          (c) => flatDist(c.pos.x, c.pos.z, pp.x, pp.z) < 40,
        );
        if (nearPolice) this.addCrime('hitPolice');
      }
    };
  }

  addCrime(kind) {
    const now = performance.now();
    if (this.crimeCooldown[kind] && now - this.crimeCooldown[kind] < 2500) return;
    this.crimeCooldown[kind] = now;
    this.wanted.addCrime(kind);
  }

  onMissionEvent(kind, payload) {
    if (kind === 'briefing') {
      this.hud.toast(`${payload.title} — ${payload.intro}`, 6500);
    } else if (kind === 'objective') {
      this.hud.toast(payload, 5000);
    } else if (kind === 'complete') {
      this.sound.cash();
      this.setMode('end');
      const next = this.missions.index < MISSIONS.length;
      this.menus.showEnd({
        title: `${payload.def.title} — Complete`,
        text: `${payload.outro} Reward: $${payload.reward.toLocaleString('en-US')}.`,
        nextLabel: next ? 'Next mission' : 'Free roam',
        showNext: true,
        showRetry: false,
      });
    } else if (kind === 'failed') {
      this.setMode('end');
      this.menus.showEnd({
        title: `${payload.def.title} — Failed`,
        text: payload.reason,
        nextLabel: 'Retry mission',
        showNext: false,
        showRetry: true,
      });
    }
  }

  // ---- mode / flow ----------------------------------------------------------
  setMode(mode) {
    this.mode = mode;
    if (mode === 'playing') {
      this.menus.hidePause();
      this.menus.hideEnd();
      this.menus.hideStart();
      this.hud.show();
      document.exitPointerLock?.();
    } else if (mode === 'paused') {
      this.menus.showPause();
    } else if (mode === 'menu') {
      this.hud.hide();
      this.menus.showStart(!!Save.load());
    }
  }

  newGame() {
    Save.clear();
    this.cash = 200;
    const s = this.city.landmarks.spawn;
    this.player.respawn(s.x, s.z);
    this.playerCar = null;
    this.autoDrive = false;
    this.wanted.clear();
    this.police.clearAll();
    this.enemies.clear();
    this.missions.index = 0;
    this.missions.completed = 0;
    this.missions.active = null;
    this.missions.state = 'idle';
    this.setMode('playing');
    this.sound.ensure();
    this.sound.startMusic();
    this.hud.toast('Meridian Bay — Kai Mercer, driver-for-hire. Mission 1 is waiting.', 6000);
    this.missions.startMission(0);
  }

  continueGame() {
    const save = Save.load();
    if (!save) return this.newGame();
    this.cash = save.cash ?? 200;
    this.player.respawn(save.x ?? 128, save.z ?? 224);
    this.player.health = save.health ?? 100;
    this.missions.index = clamp(save.missionIndex ?? 0, 0, MISSIONS.length - 1);
    this.missions.completed = save.missionIndex ?? 0;
    this.setMode('playing');
    this.sound.ensure();
    this.sound.startMusic();
    this.hud.toast(`Welcome back, Kai. $${this.cash.toLocaleString('en-US')} in your pocket.`, 5000);
    this.missions.beginNext();
  }

  restartMission() {
    const s = this.city.landmarks.spawn;
    this.player.respawn(s.x, s.z);
    if (this.playerCar) this.exitCar();
    this.wanted.clear();
    this.police.clearAll();
    this.enemies.clear();
    this.hideMarker();
    this.setMode('playing');
    this.missions.retry();
  }

  nextMission() {
    this.menus.hideEnd();
    this.setMode('playing');
    if (!this.missions.beginNext()) {
      this.hud.toast('Story complete — free roam. The bay is yours.', 6000);
    }
  }

  retryMission() {
    this.menus.hideEnd();
    this.restartMission();
  }

  quitToMenu() {
    this.saveGame();
    this.setMode('menu');
  }

  saveGame() {
    const p = this.playerPos();
    Save.write({
      cash: this.cash,
      missionIndex: this.missions.index,
      x: Math.round(p.x),
      z: Math.round(p.z),
      health: Math.round(this.player.health),
    });
  }

  addCash(n) {
    this.cash += n;
  }

  // ---- cars ---------------------------------------------------------------
  spawnMissionCar(at) {
    const car = new Car(this.scene, CONFIG.palette.gold, 'sport', at.x + 6, at.z, 0);
    car.isMissionCar = true;
    this.traffic.cars.push(car);
    this.missionCar = car;
    return car;
  }

  giveCar(color, x, z, heading) {
    if (this.playerCar) this.exitCar();
    const car = new Car(this.scene, color, 'sedan', x, z, heading);
    this.traffic.cars.push(car);
    this.enterCar(car, true);
    return car;
  }

  enterCar(car, quiet = false) {
    const i = this.traffic.cars.indexOf(car);
    if (i >= 0) this.traffic.cars.splice(i, 1);
    this.playerCar = car;
    this.player.setVisible(false);
    if (!quiet) this.addCrime('stealCar');
    if (car.isMissionCar) this.missions.stoleMissionCar();
    this.sound.ensure();
    this.sound.thud(0.3);
  }

  exitCar() {
    const car = this.playerCar;
    if (!car) return;
    this.playerCar = null;
    this.traffic.cars.push(car);
    car.speed = 0;
    // Step out on the car's side (lateral = local +X).
    const latX = Math.cos(car.heading);
    const latZ = -Math.sin(car.heading);
    this.player.pos.set(car.pos.x + latX * 2.4, 0, car.pos.z + latZ * 2.4);
    this.player.heading = car.heading;
    this.player.setVisible(true);
    this.player.group.position.copy(this.player.pos);
    this.headlightsOn = false;
  }

  tryEnterCar() {
    if (this.playerCar) {
      this.exitCar();
      return;
    }
    const car = this.traffic.nearestCar(this.player.pos.x, this.player.pos.z, 5.5);
    if (car && !car.isPolice) this.enterCar(car);
    else if (car && car.isPolice) this.hud.toast('That one has a light bar. Pick another.', 2500);
    else this.hud.toast('No car close enough — walk up to one and press E.', 2500);
  }

  // ---- damage / death -------------------------------------------------------
  damagePlayer(amount) {
    if (this.mode !== 'playing') return;
    if (this.playerCar) {
      const destroyed = this.playerCar.damage(amount);
      this.followCam.addShake(0.3);
      this.hud.flashDamage();
      if (destroyed) {
        this.particles.explosion(this.playerCar.pos.x, 1, this.playerCar.pos.z);
        this.sound.thud(1);
        const car = this.playerCar;
        this.exitCar();
        this.player.damage(25);
        this.traffic.removeCar(car);
      }
      return;
    }
    const died = this.player.damage(amount);
    this.hud.flashDamage();
    this.followCam.addShake(0.4);
    if (died) {
      this.cash = Math.floor(this.cash * 0.9);
      this.player.respawn(
        this.city.landmarks.safehouse.x,
        this.city.landmarks.safehouse.z,
      );
      this.wanted.clear();
      this.police.clearAll();
      this.missions.fail('Kai went down.');
      this.setMode('end');
      this.menus.showEnd({
        title: 'Kai went down',
        text: 'The bay chews up drivers who stop moving. You wake at the safehouse, 10% lighter.',
        nextLabel: 'Back on your feet',
        showNext: false,
        showRetry: true,
      });
      this.saveGame();
    }
  }

  playerPos() {
    return this.playerCar ? this.playerCar.pos : this.player.pos;
  }

  // ---- scene presets (screenshots) ------------------------------------------
  // Every preset stages a busy frame: traffic ahead, pedestrians on the
  // sidewalk, police already closing in — the same live systems as play.
  applyScene(name) {
    this.sceneName = name;
    this.shotTimer = 0;
    this.chaseBlockerStaged = false;
    window.__shotReady = false;
    this.newGame();
    const L = this.city.landmarks;
    if (name === 'chase') {
      // Hot Pursuit: wanted 3, escape the PD — the cover shot.
      this.missions.active = null;
      this.hideMarker();
      this.missions.startMission(2);
      const car = this.giveCar(0xc0392b, -256, -40, 0);
      car.speed = 26;
      this.followCam.yaw = Math.PI;
      this.followCam.pitch = 0.3;
      this.autoDrive = true;
      this.player.heading = 0;
      // Two interceptors start close behind so the frame shows the chase
      // at once, not an empty road waiting for them to arrive.
      const pp = this.playerPos();
      this.police.spawnNear(pp, 16);
      this.police.spawnNear(pp, 22);
      // No roadblock while the shot is staging: parked blockers across the
      // road ahead would stop the getaway dead before the camera fires.
      this.police.blockTimer = 45;
      // Traffic to weave through, same direction, up the beachfront road.
      for (const z of [45, 95]) {
        const tc = this.traffic.spawnCar({ x: -256, z });
        tc.heading = 0;
        tc.cruise = 9;
      }
      // Pedestrians scattering on the sidewalk beside the chase.
      for (let i = 0; i < 4; i++) {
        this.peds.spawnPed({ x: -244, z: -24 + i * 14 });
      }
    } else if (name === 'foot') {
      this.player.respawn(8, 64);
      this.player.heading = Math.PI;
      this.followCam.yaw = Math.PI * 0.95;
      this.followCam.pitch = 0.3;
      // A little street life around the player for the shot.
      for (let i = 0; i < 8; i++) {
        this.peds.spawnPed({ x: 8 + (i - 4) * 3, z: 52 + i * 5 });
      }
      // Cars rolling past on the cross street.
      for (const x of [-40, 30]) {
        const tc = this.traffic.spawnCar({ x, z: 64 });
        tc.heading = Math.PI / 2;
        tc.cruise = 9;
      }
    } else if (name === 'drive') {
      const car = this.giveCar(0x2e86c1, -256, 128, 0);
      car.speed = 24;
      this.followCam.yaw = Math.PI;
      this.followCam.pitch = 0.3;
      this.autoDrive = true;
      // Traffic ahead on the beachfront strip, sea glinting to the left.
      for (const z of [210, 250]) {
        const tc = this.traffic.spawnCar({ x: -256, z });
        tc.heading = 0;
        tc.cruise = 10;
      }
      for (let i = 0; i < 3; i++) {
        this.peds.spawnPed({ x: -244, z: 148 + i * 12 });
      }
    } else if (name === 'mission') {
      // Port Ambush: gunmen at the port, Kai on foot in the crosshair.
      this.missions.active = null;
      this.hideMarker();
      this.missions.startMission(3);
      this.player.respawn(L.port.x - 22, L.port.z + 8);
      this.player.heading = Math.PI / 2;
      this.followCam.yaw = -Math.PI / 2;
      this.followCam.pitch = 0.3;
      // Gunmen stand on the camera axis, in the crosshair.
      const first = this.enemies.list[0];
      if (first) {
        first.pos.set(this.player.pos.x + 16, 0, this.player.pos.z);
        first.mesh.position.copy(first.pos);
      }
      const second = this.enemies.list[1];
      if (second) {
        second.pos.set(this.player.pos.x + 20, 0, this.player.pos.z + 7);
        second.mesh.position.copy(second.pos);
      }
    }
    this.setMode('playing');
  }

  // ---- per-frame --------------------------------------------------------------
  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05) * this.timeScale;
    const input = this.input.poll();
    this.followCam.orbit(input.dx, input.dy);

    if (this.mode === 'paused' && (input.pressed.has('Escape') || input.pressed.has('KeyP'))) {
      this.setMode('playing');
      return;
    }

    if (this.mode === 'menu') {
      // Slow orbit over downtown behind the start screen.
      this.menuOrbit += dt * 0.05;
      const cx = Math.sin(this.menuOrbit) * 150;
      const cz = Math.cos(this.menuOrbit) * 150;
      this.camera.position.set(cx, 90, cz);
      this.camera.lookAt(0, 20, 0);
      this.traffic.update(dt, this.player.pos, null);
      this.peds.update(dt, this.player, null);
      this.particles.update(dt);
      this.renderer.render(this.scene, this.camera);
      window.__ready = true;
      return;
    }
    if (this.mode !== 'playing') {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Pause / map / mute.
    if (input.pressed.has('Escape') || input.pressed.has('KeyP')) {
      this.setMode('paused');
      return;
    }
    if (input.pressed.has('KeyM')) {
      $('map-overlay').classList.toggle('hidden');
    }
    if (input.pressed.has('KeyN')) {
      const muted = this.sound.toggleMute();
      this.hud.toast(muted ? 'Sound off' : 'Sound on', 1500);
    }

    const axis = this.input.moveAxis();
    const playerPos = this.playerPos();

    // --- enter / exit car, lights, reload, melee
    if (input.pressed.has('KeyE')) this.tryEnterCar();
    if (input.pressed.has('KeyF')) {
      this.headlightsOn = !this.headlightsOn;
      this.hud.toast(this.headlightsOn ? 'Headlights on' : 'Headlights off', 1200);
    }
    if (input.pressed.has('KeyR')) this.weapons.reload();
    if (input.pressed.has('KeyQ')) this.weapons.melee(this.ctx());

    // --- movement
    if (this.playerCar) {
      const car = this.playerCar;
      // Auto-drive (screenshot presets): steer back toward the centre line
      // of the road the car is on, with only a gentle weave.
      const laneSteer = (() => {
        const road = this.city.nearestRoad(car.pos.x, car.pos.z);
        const rx = Math.cos(car.heading);
        const rz = -Math.sin(car.heading);
        const lateral = (car.pos.x - road.x) * rx + (car.pos.z - road.z) * rz;
        return Math.max(-0.35, Math.min(0.35, -lateral * 0.08))
          + Math.sin(performance.now() / 2600) * 0.06;
      })();
      const driveInput = this.autoDrive
        ? { throttle: true, brake: false, steer: laneSteer, handbrake: false }
        : {
            throttle: axis.y > 0,
            brake: axis.y < 0,
            steer: -axis.x,
            handbrake: this.input.down('Space'),
          };
      const speed = car.drive(dt, driveInput, this.city);
      this.sound.setEngine(Math.abs(speed) / CONFIG.car.topSpeed, true);
      // Skid marks while handbraking at speed.
      if (driveInput.handbrake && Math.abs(speed) > 8 && Math.random() < dt * 20) {
        this.particles.skid(
          car.pos.x - Math.sin(car.heading) * 1.4,
          car.pos.z - Math.cos(car.heading) * 1.4,
          car.heading,
        );
      }
      // Smoke from a wrecked car.
      this.smokeTimer -= dt;
      if (car.smoking && this.smokeTimer <= 0) {
        this.smokeTimer = 0.12;
        this.particles.smoke(car.pos.x, 1.2, car.pos.z);
      }
      // Exhaust puffs while speeding — the chase reads as motion, not a still.
      this.exhaustTimer -= dt;
      if (Math.abs(speed) > 12 && this.exhaustTimer <= 0) {
        this.exhaustTimer = 0.09;
        this.particles.exhaust(
          car.pos.x - Math.sin(car.heading) * 2.2, 0.5,
          car.pos.z - Math.cos(car.heading) * 2.2,
        );
      }
      // Collisions with traffic cars.
      for (const other of [...this.traffic.cars]) {
        const d = flatDist(other.pos.x, other.pos.z, car.pos.x, car.pos.z);
        if (d < 3.4 && d > 0.01) {
          const push = (3.4 - d) / 2;
          const nx = (car.pos.x - other.pos.x) / d;
          const nz = (car.pos.z - other.pos.z) / d;
          car.pos.x += nx * push;
          car.pos.z += nz * push;
          other.pos.x -= nx * push;
          other.pos.z -= nz * push;
          if (Math.abs(car.speed) > 6 || Math.abs(other.speed) > 6) {
            this.particles.spark(car.pos.x, 1, car.pos.z, 8);
            this.sound.thud(0.6);
            this.followCam.addShake(0.25);
            car.damage(4);
            other.damage(4);
            car.speed *= 0.6;
            other.speed *= 0.6;
          }
        }
      }
      // Police cars are solid too.
      for (const pc of this.police.cars) {
        const d = flatDist(pc.pos.x, pc.pos.z, car.pos.x, car.pos.z);
        if (d < 3.4 && d > 0.01) {
          car.pos.x += ((car.pos.x - pc.pos.x) / d) * (3.4 - d);
          car.pos.z += ((car.pos.z - pc.pos.z) / d) * (3.4 - d);
          car.speed *= 0.7;
        }
      }
    } else {
      this.player.update(dt, axis, this.followCam.yaw, this.input.sprinting(), this.city);
      this.sound.setEngine(0, false);
      // Traffic cars can run the player down.
      for (const tc of this.traffic.cars) {
        const d = flatDist(tc.pos.x, tc.pos.z, this.player.pos.x, this.player.pos.z);
        if (d < 1.9 && Math.abs(tc.speed) > 2) {
          this.damagePlayer(18);
          this.player.pos.x += (this.player.pos.x - tc.pos.x) * 1.5;
          this.player.pos.z += (this.player.pos.z - tc.pos.z) * 1.5;
          tc.speed *= 0.3;
          this.addCrime('hitPedestrian'); // the driver hit someone — you
        }
      }
      // Shooting.
      if (input.clicked) this.weapons.shoot(this.ctx());
    }

    // --- systems
    this.weapons.update(dt);
    this.traffic.update(dt, this.player.pos, this.playerCar);
    this.peds.update(dt, this.player, this.playerCar);
    const sh = this.city.landmarks.safehouse;
    const inLayLow = flatDist(playerPos.x, playerPos.z, sh.x, sh.z) < sh.r;
    this.wanted.update(dt, this.police.canSee(playerPos), inLayLow);
    this.police.update(
      dt,
      this.wanted.stars,
      playerPos,
      this.playerCar ? this.playerCar.heading : this.player.heading,
      this.playerCar,
      this.playerCar ? Math.abs(this.playerCar.speed) : this.player.speed,
      (dmg) => this.damagePlayer(dmg),
    );
    this.enemies.update(dt, playerPos, (dmg) => this.damagePlayer(dmg));
    this.missions.update(dt);
    this.particles.update(dt);
    this.daylight.follow(playerPos.x, playerPos.z);
    this.updateHeadlights();

    // --- camera + HUD
    const focusPos = this.playerCar ? this.playerCar.pos : this.player.pos;
    const focusHeading = this.playerCar ? this.playerCar.heading : this.player.heading;
    this.followCam.update(dt, focusPos, focusHeading, this.city, !!this.playerCar);
    this.hud.update({
      health: this.player.health,
      cash: this.cash,
      stars: this.wanted.stars,
      objective: this.missions.objectiveText(),
      timeLeft: this.missions.active ? this.missions.active.timeLeft : null,
      driving: !!this.playerCar,
      speed: this.playerCar ? this.playerCar.speed : 0,
      ammo: this.weapons.ammo,
      reloading: this.weapons.reloading,
    });
    this.minimap.draw({
      player: { x: focusPos.x, z: focusPos.z },
      playerHeading: focusHeading,
      traffic: this.traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      police: this.police.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      marker: this.markerPos,
      choiceMarkers: this.choiceMarkers,
    });

    // Big map overlay mirrors the minimap.
    if (!$('map-overlay').classList.contains('hidden')) {
      const big = $('bigmap');
      if (big) {
        const ctx2d = big.getContext('2d');
        ctx2d.clearRect(0, 0, big.width, big.height);
        ctx2d.drawImage(this.minimap.canvas, 0, 0, big.width, big.height);
      }
    }

    // Autosave every 30 s while playing.
    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      this.saveGame();
    }

    // Screenshot staging: once the preset has run a couple of seconds, the
    // chase has closed in and the frame is at its busiest — signal the shot
    // driver. (Headless renderers run game time far slower than wall time,
    // so the threshold is short on purpose.)
    if (this.sceneName && !window.__shotReady) {
      this.shotTimer += dt;
      // Chase cover: drop the roadblock across the road ahead a moment
      // before the shot, so the frame catches the getaway reaching it —
      // interceptors behind on the minimap, blockers ahead in the frame.
      if (this.sceneName === 'chase' && !this.chaseBlockerStaged && this.shotTimer > 1.8) {
        this.chaseBlockerStaged = true;
        this.police.roadblock(this.playerPos(), this.playerCar ? this.playerCar.heading : 0);
      }
      if (this.shotTimer > 2.5) window.__shotReady = true;
    }

    this.renderer.render(this.scene, this.camera);
    window.__ready = true;
  }
}

try {
  const game = new Game();
  const params = new URLSearchParams(window.location.search);
  const scene = params.get('scene');
  if (scene) game.applyScene(scene);
} catch (err) {
  console.error(err);
  window.__error = String(err && err.message ? err.message : err);
  window.__gameError = window.__error;
  const el = document.getElementById('fatal');
  if (el) {
    el.textContent = `Game failed to start: ${err.message}`;
    el.classList.remove('hidden');
  }
}
