// Meridian Bay — boot and the one loop. The world advances in fixed 1/60 s
// steps, the renderer paints what is there, and the game moves between four
// screens: title, play, paused and game over.
//
// ?seed=N fixes the city layout. ?shot=cover|foot|drive|mission (with &seed=N)
// stages that scene instead of running the loop, paints it and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { STEP, PLAYER, CAR, WANTED, MISSIONS } from './config.js';
import { createRandom, clamp } from './util/random.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_RELOAD, ACTION_MAP, createInput } from './input.js';
import { createCity, resolveCircle } from './world/city.js';
import { createDaylight } from './world/daylight.js';
import { createCharacter, updateCharacter, hurtPlayer } from './player/character.js';
import { createCamera, updateCamera, snapCamera } from './player/camera.js';
import { createCar, driveCar, damageCar, parkCar } from './vehicles/cars.js';
import { createTraffic, updateTraffic, spawnParkedCar } from './vehicles/traffic.js';
import { createPedestrians, updatePedestrians, scarePedestrians } from './people/pedestrians.js';
import { createWanted, addWanted, clearWanted, updateWanted, policeWanted } from './police/wanted.js';
import { spawnPolice, updatePoliceCar } from './police/chase.js';
import { STORY, MISSION_DEFS } from './missions/story.js';
import { createMissionManager, placePosition, currentDef, currentObjective, startMission, showMessage, advanceStep, completeMission, failMission, retryMission, updateMissions, missionTarget } from './missions/manager.js';
import { createCombat, reloadWeapon, updateCombatTimers, shootPistol, punch, pruneTracers } from './combat/weapons.js';
import { createHud, updateHud } from './ui/hud.js';
import { createMinimap, drawMinimap } from './ui/minimap.js';
import { createMenus, showScreen, showGameOver, showHelp, hideHelp, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './ui/menus.js';
import { createSound, unlockAudio, soundFx, updateSound } from './audio/sound.js';
import { createEffects, spawnSparks, spawnSmoke, spawnSkid, addShake, updateEffects, shakeOffset } from './effects/particles.js';
import { saveGame, loadGame, clearSave } from './save/storage.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 15;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

window.addEventListener('error', (event) => {
  window.__gameError = String(event.message || event.error || 'unknown error');
});

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

const rng = createRandom(seed);
const daylight = createDaylight(scene, renderer);
const city = createCity(scene, rng);
const cam = createCamera(camera);
const input = createInput(canvas);
const hud = createHud();
const minimap = createMinimap(document.getElementById('minimap'));
const menus = createMenus();
const sound = createSound();
const fx = createEffects(scene);

// --- Game state ------------------------------------------------------------
const player = createCharacter(scene);
player.cash = 0;
const wanted = createWanted();
const mission = createMissionManager(scene, city.places);
const combat = createCombat();
const traffic = createTraffic(scene, rng, city.roadCenters);
const peds = createPedestrians(scene, rng, city.roadCenters);
for (const ped of peds) ped.isPed = true;

const parkedCars = [];
const parkedSpots = [
  { x: 74, z: 80, heading: 0 }, { x: -74, z: -80, heading: Math.PI },
  { x: 148, z: -68, heading: Math.PI / 2 }, { x: -222, z: 150, heading: 0 },
  { x: 222, z: -150, heading: Math.PI }, { x: 0, z: 228, heading: Math.PI / 2 },
  { x: -37, z: 185, heading: 0 },
];
for (const spot of parkedSpots) {
  parkedCars.push(spawnParkedCar(scene, spot.x, spot.z, spot.heading, {}));
}
// The gold coupe for mission 2, parked by the old-town garage.
const coupe = spawnParkedCar(scene, city.places.stealSpot.x + 6, city.places.stealSpot.z, Math.PI / 2, { color: 0xe8c832, kind: 'sedan' });
coupe.missionTarget = true;
parkedCars.push(coupe);

// A starter car for Kai, parked near the safehouse.
const starterCar = spawnParkedCar(scene, -30, 178, 0, { color: 0x2e6fc2 });
starterCar.playerOwned = true;
parkedCars.push(starterCar);

const police = [];
const shooters = [];
const G = {
  player,
  wanted,
  mission,
  combat,
  city,
  traffic,
  peds,
  police,
  shooters,
  inCar: false,
  playerCar: null,
  nearCar: null,
  nearMissionCar: null,
  objective: '',
  missionTarget: null,
  hasSave: !!loadGame(),
  screen: SCREEN_TITLE,
  time: 0,
  autosaveTimer: AUTOSAVE_SECONDS,
  shootersSpawnedFor: -1,
  threatPos: null,
  shotMode: !!shot,
};

function allCars() {
  return [...traffic, ...parkedCars, ...police, ...(G.playerCar ? [G.playerCar] : [])];
}

function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of [...traffic, ...parkedCars]) {
    if (car.health <= 0) continue;
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(car) {
  if (!car) return;
  // Pull a traffic car out of the AI fleet: it is Kai's now.
  const ti = traffic.indexOf(car);
  if (ti >= 0) traffic.splice(ti, 1);
  const pi = parkedCars.indexOf(car);
  if (pi >= 0) parkedCars.splice(pi, 1);
  car.isPlayer = true;
  G.inCar = true;
  G.playerCar = car;
  player.group.visible = false;
  if (!car.playerOwned) {
    addWanted(wanted, WANTED.stealCar, 'stole a car');
    soundFx.steal(sound);
    showMessage(mission, 'Car stolen — the heat is on!', 3);
  }
  car.playerOwned = true;
  snapCamera(cam, car.pos, car.heading);
}

function enterCarAt(x, z, heading) {
  // Move the nearest parked car to the spot and put Kai in it (screenshot staging).
  let car = null;
  let bestD = Infinity;
  for (const c of parkedCars) {
    const d = Math.hypot(c.pos.x - x, c.pos.z - z);
    if (d < bestD) {
      bestD = d;
      car = c;
    }
  }
  if (!car) car = starterCar;
  parkCar(car, x, z, heading);
  car.playerOwned = true; // staged cars are Kai's own: no steal heat in shots
  enterCar(car);
}
G.enterCarAt = enterCarAt;

function exitCar() {
  const car = G.playerCar;
  if (!car) return;
  car.isPlayer = false;
  G.inCar = false;
  G.playerCar = null;
  player.pos.set(car.pos.x + Math.sin(car.heading + Math.PI / 2) * 2.5, 0, car.pos.z + Math.cos(car.heading + Math.PI / 2) * 2.5);
  resolveCircle(player.pos, PLAYER.radius, city.colliders);
  player.group.visible = true;
  player.group.position.copy(player.pos);
  snapCamera(cam, player.pos, player.heading);
}

function spawnShootersAtPort() {
  const port = city.places.port;
  for (let i = 0; i < 6; i += 1) {
    // A loose line in the open ground east of the container stacks, facing the road.
    const x = port.x + 44 + (i % 3) * 8;
    const z = port.z - 2 + Math.floor(i / 3) * 10;
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 0.85, 3, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a2a2a }),
    );
    mesh.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a077 }));
    head.position.y = 0.95;
    mesh.add(head);
    mesh.position.set(x, 1.0, z);
    scene.add(mesh);
    shooters.push({
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: Math.atan2(player.pos.x - x, player.pos.z - z),
      health: 100,
      dead: false,
      isShooter: true,
      radius: 1.1,
      shootTimer: 1 + i * 0.3,
    });
  }
  G.shootersSpawnedFor = mission.index;
  showMessage(mission, 'Harbor Kings shooters at the port — take them all down!', 5);
}

function updateShooters(dt) {
  for (const s of shooters) {
    if (s.dead) continue;
    const dx = player.pos.x - s.pos.x;
    const dz = player.pos.z - s.pos.z;
    const dist = Math.hypot(dx, dz);
    s.heading = Math.atan2(dx, dz);
    s.mesh.rotation.y = s.heading;
    s.shootTimer -= dt;
    // Close in slowly, shoot when in range and in the open.
    if (dist > 14) {
      s.pos.x += Math.sin(s.heading) * 2.2 * dt;
      s.pos.z += Math.cos(s.heading) * 2.2 * dt;
      s.mesh.position.set(s.pos.x, 1.0, s.pos.z);
    }
    if (s.shootTimer <= 0 && dist < 45) {
      s.shootTimer = 1.6;
      if (Math.random() < 0.55) {
        hurtPlayer(player, 5);
        spawnSparks(fx, player.pos.x, 1.4, player.pos.z, 4);
        addShake(fx, 0.15);
      }
      // A red tracer back toward the player, so the shot reads.
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(s.pos.x, 1.4, s.pos.z),
        new THREE.Vector3(player.pos.x, 1.2, player.pos.z),
      ]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff4444 }));
      scene.add(line);
      combat.tracers.push({ mesh: line, life: 0.1 });
    }
  }
  const kills = shooters.filter((s) => s.dead).length;
  if (mission.index === 3 && mission.state === 'active') mission.kills = kills;
}

function spawnPoliceNear(dist) {
  const cop = spawnPolice(scene, G.inCar && G.playerCar ? G.playerCar.pos : player.pos, rng, city.roadCenters, dist);
  police.push(cop);
  return cop;
}

function updatePolice(dt) {
  const want = policeWanted(wanted);
  // Spawn up to the wanted count, one at a time.
  if (police.length < want) {
    const cop = spawnPolice(scene, G.inCar ? G.playerCar.pos : player.pos, rng, city.roadCenters);
    police.push(cop);
  } else if (police.length > want) {
    const cop = police.pop();
    scene.remove(cop.group);
  }
  const playerPos = G.inCar ? G.playerCar.pos : player.pos;
  let anySeen = false;
  for (const cop of police) {
    const dist = Math.hypot(cop.pos.x - playerPos.x, cop.pos.z - playerPos.z);
    if (dist < 70) anySeen = true;
    const dmg = updatePoliceCar(cop, playerPos, G.playerCar, dt, city.colliders, allCars(), wanted.stars, rng);
    if (dmg > 0) {
      if (hurtPlayer(player, dmg)) die();
      spawnSparks(fx, playerPos.x, 1, playerPos.z, 6);
      soundFx.crash(sound);
      addShake(fx, 0.4);
    }
  }
  const layingLow = playerPos.x > city.layLowZone.minX && playerPos.x < city.layLowZone.maxX
    && playerPos.z > city.layLowZone.minZ && playerPos.z < city.layLowZone.maxZ;
  updateWanted(wanted, dt, layingLow, anySeen);
  if (wanted.stars === 0 && police.length > 0) {
    for (const cop of police) scene.remove(cop.group);
    police.length = 0;
  }
}

function carHitsPeds() {
  if (!G.inCar || !G.playerCar) return;
  const car = G.playerCar;
  if (Math.abs(car.speed) < 3) return;
  for (const ped of peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z);
    if (d < 2.2) {
      ped.dead = true;
      ped.health = 0;
      ped.mesh.visible = false;
      addWanted(wanted, WANTED.killPed, 'ran over a pedestrian');
      scarePedestrians(peds, car.pos.x, car.pos.z, 30);
      spawnSparks(fx, ped.pos.x, 1, ped.pos.z, 8);
      soundFx.crash(sound);
      addShake(fx, 0.3);
    }
  }
}

function trafficHitsPlayer() {
  if (G.inCar) return;
  for (const car of traffic) {
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < 2.0 && Math.abs(car.speed) > 2) {
      if (hurtPlayer(player, 8)) die();
      player.pos.x += (player.pos.x - car.pos.x) * 0.8;
      player.pos.z += (player.pos.z - car.pos.z) * 0.8;
      addShake(fx, 0.4);
      soundFx.crash(sound);
      scarePedestrians(peds, player.pos.x, player.pos.z, 20);
      break;
    }
  }
  // Police cruisers must never end up under Kai on foot: shove him clear.
  for (const cop of police) {
    const dx = player.pos.x - cop.pos.x;
    const dz = player.pos.z - cop.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.8) {
      if (d > 0.001) {
        player.pos.x = cop.pos.x + (dx / d) * 2.8;
        player.pos.z = cop.pos.z + (dz / d) * 2.8;
      } else {
        player.pos.x = cop.pos.x + Math.cos(cop.heading) * 2.8;
        player.pos.z = cop.pos.z - Math.sin(cop.heading) * 2.8;
      }
      player.group.position.copy(player.pos);
    }
  }
}

function die() {
  if (G.screen === SCREEN_OVER) return;
  G.screen = SCREEN_OVER;
  if (mission.state === 'active') failMission(mission, 'Kai went down');
  player.cash = Math.max(0, player.cash - MISSIONS.failCashPenalty);
  clearWanted(wanted);
  for (const cop of police) scene.remove(cop.group);
  police.length = 0;
  soundFx.fail(sound);
  saveGame(G);
  showGameOver(menus, 'Kai is down', `The Meridian Bay streets got the better of him. -$${MISSIONS.failCashPenalty} hospital bill. Press Enter to get back up.`);
}

function respawn() {
  player.health = PLAYER.maxHealth;
  if (G.inCar) exitCar();
  player.pos.set(city.places.safehouse.x, 0, city.places.safehouse.z);
  player.group.position.copy(player.pos);
  player.group.visible = true;
  snapCamera(cam, player.pos, player.heading);
  G.screen = SCREEN_PLAY;
  showScreen(menus, SCREEN_PLAY, G);
  if (mission.state === 'failed') retryMission(mission);
  saveGame(G);
}

function resetGame(fromSave) {
  const save = fromSave ? loadGame() : null;
  player.health = PLAYER.maxHealth;
  player.cash = save ? save.cash : 0;
  player.pos.set(save ? save.x : city.places.playerStart.x, 0, save ? save.z : city.places.playerStart.z);
  player.group.position.copy(player.pos);
  player.group.visible = true;
  combat.ammo = save ? save.ammo : PLAYER.pistolAmmo;
  combat.reserve = save ? save.reserve : PLAYER.pistolReserve;
  mission.index = save ? save.missionIndex : -1;
  mission.completed = save ? (save.completed || []) : [];
  mission.choice = save ? (save.choice || null) : null;
  mission.state = 'idle';
  mission.step = 0;
  mission.kills = 0;
  clearWanted(wanted);
  G.inCar = false;
  G.playerCar = null;
  G.time = 0;
  snapCamera(cam, player.pos, player.heading);
  G.screen = SCREEN_PLAY;
  showScreen(menus, SCREEN_PLAY, G);
  showMessage(mission, save ? 'Welcome back to Meridian Bay.' : STORY.intro, 6);
  unlockAudio(sound);
  saveGame(G);
}

/** One fixed world step. `auto` drives the player for screenshot staging: either
 *  a fixed input object or a function returning one fresh every step. */
function stepWorld(dt, auto = null) {
  G.time += dt;
  const actions = auto ? 0 : input.takeActions();
  const dragDX = auto ? 0 : input.takeDragDX();
  const autoInput = typeof auto === 'function' ? auto() : auto;

  // Title / game-over confirms come first: the loop still steps once per frame there.
  if (actions & ACTION_CONFIRM) {
    if (G.screen === SCREEN_TITLE) {
      resetGame(false);
      return;
    }
    if (G.screen === SCREEN_OVER) {
      respawn();
      return;
    }
  }
  // Pause / resume.
  if (actions & ACTION_PAUSE) {
    if (G.screen === SCREEN_PLAY) {
      G.screen = SCREEN_PAUSED;
      showScreen(menus, SCREEN_PAUSED, G);
      saveGame(G);
    } else if (G.screen === SCREEN_PAUSED) {
      G.screen = SCREEN_PLAY;
      showScreen(menus, SCREEN_PLAY, G);
    }
  }
  if (G.screen !== SCREEN_PLAY && !G.shotMode) return;
  if (actions & ACTION_MAP) {
    minimap.big = !minimap.big;
    const mm = document.getElementById('minimap');
    mm.style.width = minimap.big ? '420px' : '200px';
    mm.style.height = minimap.big ? '420px' : '200px';
    minimap.canvas.width = minimap.big ? 420 : 200;
    minimap.canvas.height = minimap.big ? 420 : 200;
    minimap.size = minimap.canvas.width;
  }
  if (actions & ACTION_RELOAD) reloadWeapon(combat);

  // Mission start / retry on Enter while playing.
  if (actions & ACTION_CONFIRM && G.screen === SCREEN_PLAY) {
    if (mission.state === 'idle' && mission.index + 1 < MISSION_DEFS.length) {
      const def = startMission(mission, wanted);
      if (def) soundFx.missionStart(sound);
    } else if (mission.state === 'failed') {
      retryMission(mission);
    } else if (mission.state === 'complete' && mission.index + 1 < MISSION_DEFS.length) {
      const def = startMission(mission, wanted);
      if (def) soundFx.missionStart(sound);
    }
  }

  // Enter / exit cars.
  G.nearCar = G.inCar ? null : nearestCar(CAR.enterRange);
  G.nearMissionCar = G.nearCar && G.nearCar.missionTarget ? G.nearCar : null;
  if (actions & ACTION_ENTER_CAR) {
    if (G.inCar) exitCar();
    else if (G.nearCar) enterCar(G.nearCar);
  }

  // Player movement: on foot or driving.
  const throttle = autoInput ? autoInput.throttle : input.throttle();
  const steer = autoInput ? autoInput.steer : input.steer();
  const sprint = autoInput ? false : input.sprint();
  const handbrake = autoInput ? false : input.handbrake();
  if (G.inCar && G.playerCar) {
    const hit = driveCar(G.playerCar, throttle, steer, handbrake, dt, city.colliders, allCars());
    if (hit) {
      soundFx.crash(sound);
      addShake(fx, 0.35);
      spawnSparks(fx, G.playerCar.pos.x, 1, G.playerCar.pos.z, 6);
      scarePedestrians(peds, G.playerCar.pos.x, G.playerCar.pos.z, 15);
    }
    if (handbrake && Math.abs(G.playerCar.speed) > 10) {
      spawnSkid(fx, G.playerCar.pos.x, G.playerCar.pos.z, G.playerCar.heading);
    }
    G.player.pos.copy(G.playerCar.pos);
  } else {
    // Camera-relative movement on foot.
    const fwd = { x: -Math.sin(cam.yaw), z: -Math.cos(cam.yaw) };
    const right = { x: -fwd.z, z: fwd.x };
    const mx = fwd.x * throttle + right.x * steer;
    const mz = fwd.z * throttle + right.z * steer;
    updateCharacter(player, { x: mx, z: mz }, sprint, dt, city.colliders, allCars());
    if (player.speed > 5 && Math.random() < dt * 2) soundFx.footstep(sound);
  }

  // Combat: click to shoot or punch.
  const clicked = autoInput ? autoInput.shoot : input.takeMouseClick();
  const held = autoInput ? autoInput.shoot : input.mouseHeld();
  if (!G.inCar && (clicked || held)) {
    // Police cruisers are targets too, but their health lives on the car:
    // the wrapper reads and writes it live through accessors.
    const copTargets = police.map((c) => {
      const t = { pos: c.pos, isCop: true, radius: 1.6, car: c };
      Object.defineProperty(t, 'health', {
        get() { return c.health; },
        set(v) { c.health = v; },
      });
      Object.defineProperty(t, 'dead', {
        get() { return c.health <= 0; },
        set(v) { if (v) c.health = 0; },
      });
      return t;
    });
    const targets = [...peds, ...shooters, ...copTargets];
    // Punch when the nearest target is close, otherwise shoot.
    let nearest = null;
    let nearestD = Infinity;
    for (const t of targets) {
      if (t.dead || t.health <= 0) continue;
      const d = Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
      if (d < nearestD) {
        nearestD = d;
        nearest = t;
      }
    }
    if (nearest && nearestD < PLAYER.punchRange) {
      punch(combat, player.pos, player.heading, targets, wanted);
    } else {
      const hitTarget = shootPistol(combat, scene, camera, targets, {
        gunshot: () => soundFx.gunshot(sound),
        hitMarker: () => soundFx.hitMarker(sound),
      }, wanted, peds);
      if (hitTarget && hitTarget.car) {
        damageCar(hitTarget.car, PLAYER.pistolDamage);
        if (hitTarget.car.health <= 0) {
          hitTarget.dead = true;
          addWanted(wanted, WANTED.killCop, 'disabled a cruiser');
        }
      }
      if (hitTarget && hitTarget.isShooter) {
        hitTarget.mesh.visible = !hitTarget.dead;
        if (hitTarget.dead) mission.kills = shooters.filter((s) => s.dead).length;
      }
      G.threatPos = { x: player.pos.x, z: player.pos.z };
    }
  }
  updateCombatTimers(combat, dt);
  pruneTracers(combat, scene);

  // Mission 4 shooters appear when the combat step starts.
  if (mission.index === 3 && mission.step === 1 && mission.state === 'active' && G.shootersSpawnedFor !== 3) {
    spawnShootersAtPort();
  }
  updateShooters(dt);

  // World systems.
  updateTraffic(traffic, G.playerCar, dt, city.colliders, city.roadCenters, rng);
  updatePedestrians(peds, player.pos, G.threatPos, dt, city.colliders, rng);
  G.threatPos = null;
  carHitsPeds();
  trafficHitsPlayer();
  updatePolice(dt);
  updateMissions(mission, {
    playerPos: G.inCar ? G.playerCar.pos : player.pos,
    player,
    inCar: G.inCar,
    carId: G.playerCar ? G.playerCar.id : -1,
    stolenTarget: coupe,
  }, dt);
  if (mission.state === 'complete' && mission.completed.length > 0) {
    // Reward fanfare once, when the state flips to complete.
    if (!G._fanfareFor || G._fanfareFor !== mission.index) {
      G._fanfareFor = mission.index;
      soundFx.missionComplete(sound);
      soundFx.cash(sound);
      saveGame(G);
    }
  }

  // Camera, light, sound, effects, HUD.
  const target = G.inCar ? G.playerCar.pos : player.pos;
  const heading = G.inCar ? G.playerCar.heading : player.heading;
  updateCamera(cam, target, heading, G.inCar, dragDX, dt, city.colliders);
  daylight.setTimeOfDay(G.time);
  updateEffects(fx, dt, allCars());
  updateSound(sound, dt, G.inCar ? G.playerCar.speed : player.speed, wanted.stars, G.screen === SCREEN_PLAY);
  G.objective = currentObjective(mission);
  G.missionTarget = missionTarget(mission);
  updateHud(hud, G);
  drawMinimap(minimap, G);

  // Health regen, slow but steady, out of combat.
  if (player.health > 0 && player.health < PLAYER.maxHealth && wanted.stars === 0) {
    player.health = Math.min(PLAYER.maxHealth, player.health + dt * 2);
  }
  if (player.health <= 0 && G.screen === SCREEN_PLAY) die();

  // HUD visibility follows the screen.
  hud.root.classList.toggle('on', G.screen === SCREEN_PLAY || G.screen === SCREEN_PAUSED || G.shotMode);

  // Autosave.
  G.autosaveTimer -= dt;
  if (G.autosaveTimer <= 0) {
    G.autosaveTimer = AUTOSAVE_SECONDS;
    if (G.screen === SCREEN_PLAY) saveGame(G);
  }
}

function renderFrame() {
  const shake = shakeOffset(fx);
  camera.position.add(shake);
  renderer.render(scene, camera);
  camera.position.sub(shake);
}

function runShot(name) {
  G.screen = SCREEN_PLAY;
  G.shotMode = true;
  showScreen(menus, SCREEN_PLAY, G);
  stageShot(name, G, stepWorld, { snapCamera, cam, camera, player, mission, wanted, coupe, spawnShootersAtPort, spawnPoliceNear });
  let painted = 0;
  function paint() {
    renderFrame();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  showScreen(menus, SCREEN_TITLE, G);
  document.getElementById('status').textContent = 'Meridian Bay. Press Enter or click New Game to start.';
  menus.newBtn.addEventListener('click', () => {
    clearSave();
    resetGame(false);
  });
  menus.continueBtn.addEventListener('click', () => resetGame(true));
  menus.helpBtn.addEventListener('click', () => showHelp(menus));
  menus.helpClose.addEventListener('click', () => hideHelp(menus));
  menus.resumeBtn.addEventListener('click', () => {
    G.screen = SCREEN_PLAY;
    showScreen(menus, SCREEN_PLAY, G);
  });
  menus.quitBtn.addEventListener('click', () => {
    G.screen = SCREEN_TITLE;
    showScreen(menus, SCREEN_TITLE, G);
  });
  menus.retryBtn.addEventListener('click', () => respawn());
  canvas.addEventListener('pointerdown', () => unlockAudio(sound));

  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Title screen: slow aerial orbit over the whole city while it idles.
    if (G.screen === SCREEN_TITLE) {
      const titleActions = input.takeActions();
      if (titleActions & ACTION_CONFIRM) resetGame(false);
      const angle = G.time * 0.05 + 0.6;
      G.time += STEP;
      camera.position.set(Math.sin(angle) * 200, 120, Math.cos(angle) * 200);
      camera.lookAt(40, 0, 0);
      updateTraffic(traffic, null, STEP, city.colliders, city.roadCenters, rng);
      updatePedestrians(peds, player.pos, null, STEP, city.colliders, rng);
      renderFrame();
      return;
    }
    while (accumulator >= STEP) {
      stepWorld(STEP);
      accumulator -= STEP;
      if (G.screen !== SCREEN_PLAY) break;
    }
    if (G.screen === SCREEN_PLAY || G.screen === SCREEN_PAUSED) renderFrame();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Playtest hook: positions of the actors, for debugging shot staging.
window.__debugState = () => ({
  player: { x: Math.round(player.pos.x), z: Math.round(player.pos.z), heading: +player.heading.toFixed(2), health: Math.round(player.health) },
  camera: { x: Math.round(camera.position.x), y: Math.round(camera.position.y), z: Math.round(camera.position.z) },
  car: G.playerCar ? { x: Math.round(G.playerCar.pos.x), z: Math.round(G.playerCar.pos.z), heading: +G.playerCar.heading.toFixed(2) } : null,
  combat: { ammo: combat.ammo, cooldown: +combat.cooldown.toFixed(2), shotsFired: combat.shotsFired },
  pointerDowns: input.pointerDowns(),
  nearCarDist: G.nearCar ? +Math.hypot(G.nearCar.pos.x - player.pos.x, G.nearCar.pos.z - player.pos.z).toFixed(1) : null,
  shooters: shooters.map((s) => ({ x: Math.round(s.pos.x), z: Math.round(s.pos.z), dead: s.dead, health: s.health })),
  police: police.map((c) => ({ x: Math.round(c.pos.x), z: Math.round(c.pos.z) })),
  mission: { index: mission.index, step: mission.step, kills: mission.kills, state: mission.state },
});

if (shot) runShot(shot);
else runGame();
