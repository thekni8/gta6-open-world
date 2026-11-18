// Meridian Bay — boot, game loop, and the state machine that ties every
// system together: menu / playing / paused / mission end, car enter-exit,
// collisions, busted/wasted, saving, and screenshot staging.
import { CFG } from './config.js';
import { createInput } from './input.js';
import { createCity } from './world/city.js';
import { createDaylight } from './world/daylight.js';
import { createPlayer } from './player/character.js';
import { createCamera } from './player/camera.js';
import { createCar, driveCar, carSpeedKmh } from './vehicles/cars.js';
import { createTraffic } from './vehicles/traffic.js';
import { createPedestrians } from './people/pedestrians.js';
import { createWanted } from './police/wanted.js';
import { createChase } from './police/chase.js';
import { createMissionManager } from './missions/manager.js';
import { createCombat } from './combat/weapons.js';
import { createHud } from './ui/hud.js';
import { createMinimap } from './ui/minimap.js';
import { createMenus } from './ui/menus.js';
import { createSound } from './audio/sound.js';
import { createEffects } from './effects/particles.js';
import { loadSave, writeSave, clearSave } from './save/storage.js';
import { MISSIONS } from './missions/story.js';

const SPAWN = { x: 4, z: 0 };

const params = new URLSearchParams(window.location.search);
// ?perf=1 disables antialiasing + shadows for fast software-rendered testing.
const perfMode = params.get('perf') === '1';

const renderer = new THREE.WebGLRenderer({ antialias: !perfMode });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game-container').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const G = {
  scene, camera, renderer,
  cash: CFG.startCash,
  completedMissions: new Set(),
  missionIndex: 0,
  state: 'menu',
  time: 0,
  bustedT: 0,
  headlight: null,
};

G.input = createInput(renderer.domElement);
G.city = createCity(scene);
G.daylight = createDaylight(scene, renderer, perfMode);
G.player = createPlayer(scene, SPAWN.x, SPAWN.z);
// Face downtown (north) at spawn, with the camera behind — the first
// mission's delivery car is ahead-right in the opening frame.
G.player.heading = Math.PI;
G.player.group.rotation.y = Math.PI;
G.cameraRig = createCamera(camera);
G.cameraRig.setYaw(0);
G.traffic = createTraffic(scene, G.city);
G.peds = createPedestrians(scene, G.city);
G.wanted = createWanted(G.city);
G.chase = createChase(scene, G.city);
G.fx = createEffects(scene, G.cameraRig);
G.sound = createSound();
G.combat = createCombat(scene, G.city, G.fx, G.sound);
G.hud = createHud();
G.minimap = createMinimap(document.getElementById('minimap'));
G.missions = createMissionManager(G);

// The player's own car, parked near spawn so free roam starts with a ride.
const starterCar = createCar(scene, { type: 'sedan', color: 0x3a6fd8, role: 'parked', x: 12, z: 6, heading: Math.PI / 2 });
G.traffic.parked.push(starterCar);

G.saveGame = () => {
  writeSave({
    cash: G.cash,
    completed: [...G.completedMissions],
    missionIndex: G.missionIndex,
    x: G.player.x, z: G.player.z,
    health: G.player.health,
  });
};

function allCarGroups() {
  const groups = [];
  for (const c of G.traffic.all()) groups.push(c.group);
  for (const c of G.chase.all()) groups.push(c.group);
  const mc = G.missions.missionCar();
  if (mc) groups.push(mc.group);
  if (G.player.inCar) groups.push(G.player.inCar.group);
  return groups;
}

function enterCar(car, stolen) {
  G.player.inCar = car;
  car.role = 'player';
  G.player.group.visible = false;
  G.player.setPos(car.x, car.z);
  G.sound.enterCar();
  if (stolen) {
    G.wanted.addHeat(CFG.heatStealCar, 'steal');
    G.hud.toast('Car stolen — the police are on their way!');
    G.peds.fleeFrom(car.x, car.z, 30);
  }
  if (!G.headlight) {
    G.headlight = new THREE.PointLight(0xfff2b0, 0, 34, 1.6);
    G.headlight.position.set(0, 1.2, 3);
  }
  car.group.add(G.headlight);
  G.headlight.intensity = car.lightsOn ? 80 : 0;
}

function exitCar() {
  const car = G.player.inCar;
  if (!car) return;
  G.player.inCar = null;
  car.role = 'parked';
  car.speed = 0;
  G.traffic.parked.push(car);
  const side = car.heading + Math.PI / 2;
  const px = car.x + Math.sin(side) * 2.6;
  const pz = car.z + Math.cos(side) * 2.6;
  const fixed = G.city.resolveCircle(px, pz, CFG.playerRadius);
  G.player.setPos(fixed.x, fixed.z);
  G.player.group.visible = true;
  G.player.heading = car.heading;
  G.player.group.rotation.y = car.heading;
  if (G.headlight) car.group.remove(G.headlight);
}

function nearestEnterableCar() {
  let best = null, bd = 4.2;
  const consider = (c) => {
    const d = Math.hypot(c.x - G.player.x, c.z - G.player.z);
    if (d < bd) { bd = d; best = c; }
  };
  for (const c of G.traffic.parked) consider(c);
  const mc = G.missions.missionCar();
  if (mc) consider(mc);
  return best;
}

function resetPlayerForMission() {
  G.player.health = CFG.playerHealth;
  G.player.heal(100);
  if (G.player.inCar) {
    const car = G.player.inCar;
    G.player.inCar = null;
    car.role = 'parked';
    G.traffic.parked.push(car);
    if (G.headlight) car.group.remove(G.headlight);
  }
  G.player.group.visible = true;
  G.player.setPos(SPAWN.x, SPAWN.z);
  G.wanted.clear();
  G.chase.clearAll();
  G.combat.clearEnemies();
  G.bustedT = 0;
}

function startMission(index) {
  resetPlayerForMission();
  G.missionIndex = index;
  G.state = 'playing';
  G.menus.hideAll();
  G.hud.show();
  G.input.clear(); // the menu button's click must not leak in as a shot
  G.input.consumeMouse(); // drain menu-time mouse drift
  const ok = G.missions.startMission(index);
  if (!ok) { G.state = 'playing'; return; }
  const def = MISSIONS[index];
  G.hud.toast(`${def.title} — ${def.intro}`, 5);
  G.sound.missionStart();
}

function startFreeRoam() {
  resetPlayerForMission();
  G.state = 'playing';
  G.menus.hideAll();
  G.hud.show();
  G.input.clear();
  G.hud.toast('Free roam — Meridian Bay is yours. Steal a car, lose the cops, have fun.', 4);
}

G.missions.onEvent = (kind, data) => {
  if (kind === 'complete') {
    G.sound.missionComplete();
    G.sound.cash();
    G.state = 'complete';
    G.input.releaseLock();
    G.menus.showComplete(data, G.cash);
  } else if (kind === 'fail') {
    G.sound.missionFail();
    G.state = 'fail';
    G.input.releaseLock();
    G.menus.showFail(data.def, data.reason);
  } else if (kind === 'flavor') {
    G.hud.toast(data, 4);
  } else if (kind === 'step') {
    G.sound.uiClick();
  }
};

G.menus = createMenus({
  newGame() {
    clearSave();
    G.cash = CFG.startCash;
    G.completedMissions = new Set();
    G.sound.ensure();
    startMission(0);
  },
  continueGame() {
    const save = loadSave();
    G.sound.ensure();
    if (!save) { startMission(0); return; }
    G.cash = save.cash ?? CFG.startCash;
    G.completedMissions = new Set(save.completed || []);
    G.missionIndex = save.missionIndex ?? 0;
    G.player.setPos(save.x ?? SPAWN.x, save.z ?? SPAWN.z);
    G.player.health = save.health ?? CFG.playerHealth;
    if (G.missionIndex >= MISSIONS.length) startFreeRoam();
    else startMission(G.missionIndex);
  },
  freeRoam() { G.sound.ensure(); startFreeRoam(); },
  resume() {
    G.state = 'playing';
    G.menus.hideAll();
    G.hud.show();
    G.input.clear();
  },
  restartMission() {
    if (G.missions.active) startMission(G.missionIndex);
    else startFreeRoam();
  },
  saveQuit() {
    G.saveGame();
    G.state = 'menu';
    G.menus.showStart(true, G.cash, Math.min(G.missionIndex + 1, 5));
    G.hud.hide();
  },
  nextMission() {
    const next = G.missionIndex + 1;
    if (next >= MISSIONS.length) {
      G.state = 'end';
      G.menus.showEnd(G.cash);
    } else {
      startMission(next);
    }
  },
  retryMission() { startMission(G.missionIndex); },
  freeRoamFromFail() { startFreeRoam(); },
  closeMap() {
    G.state = 'playing';
    G.menus.hideAll();
    G.hud.show();
    G.input.clear();
  },
});

function onPlayerHit(dmg) {
  if (G.player.damage(dmg)) {
    G.hud.flashDamage();
    G.state = 'fail';
    G.input.releaseLock();
    G.missions.failCurrent('Kai went down');
    G.menus.showWasted('wasted');
    G.sound.missionFail();
    return;
  }
  G.hud.flashDamage();
  G.cameraRig.addShake(0.35);
}

function onPoliceRam(car) {
  if (G.player.inCar) {
    const pc = G.player.inCar;
    const push = Math.sin(car.heading - pc.heading) * 4;
    pc.heading += push * 0.02;
    pc.setHeading(pc.heading);
    pc.speed *= 0.82;
    pc.health = Math.max(0, pc.health - 4);
    G.fx.crash((car.x + pc.x) / 2, (car.z + pc.z) / 2, 12);
    G.sound.crash();
    G.cameraRig.addShake(0.4);
  } else {
    onPlayerHit(6);
  }
}

function updatePlaying(dt) {
  const input = G.input;
  const player = G.player;

  // Pause / map keys.
  if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
    G.state = 'paused';
    input.releaseLock();
    G.menus.showPause(G.missions.active ? MISSIONS[G.missionIndex].title : null);
    return;
  }
  if (input.wasPressed('KeyM')) {
    G.state = 'map';
    G.menus.showMap();
    G.hud.hide();
    return;
  }

  // Enter / exit cars.
  if (input.wasPressed('KeyE')) {
    if (player.inCar) exitCar();
    else {
      const car = nearestEnterableCar();
      if (car) {
        const mc = G.missions.missionCar();
        const isMissionCar = car === mc;
        const step = G.missions.current?.def.steps[G.missions.current.stepIndex];
        const freeTake = isMissionCar && step && step.type === 'enterCar';
        if (isMissionCar) {
          const i = G.traffic.parked.indexOf(car);
          if (i >= 0) G.traffic.parked.splice(i, 1);
        } else {
          G.traffic.claimParked(car);
        }
        enterCar(car, !isMissionCar && !freeTake);
      }
    }
  }

  // Headlights.
  if (input.wasPressed('KeyF') && player.inCar) {
    player.inCar.lightsOn = !player.inCar.lightsOn;
    if (G.headlight) G.headlight.intensity = player.inCar.lightsOn ? 80 : 0;
  }

  // Combat (on foot only).
  if (!player.inCar) {
    if (input.clicked() || input.firing()) {
      const result = G.combat.shoot(camera, G.city.blockers, allCarGroups());
      if (result === 'enemy' || result === 'kill' || result === 'world' || result === 'car' || result === 'miss') {
        G.peds.fleeFrom(player.x, player.z, 42);
        if (!G.missions.active) G.wanted.addHeat(CFG.heatShoot, 'shoot');
      }
    }
    if (input.wasPressed('KeyQ')) G.combat.melee(player, player.heading);
    if (input.wasPressed('KeyR')) G.combat.reload();
  }

  // Movement.
  let speed = 0;
  if (player.inCar) {
    const car = player.inCar;
    const hitWall = driveCar(car, G.city, input, dt, G.fx);
    if (hitWall) {
      G.sound.crash();
      G.cameraRig.addShake(0.3);
      G.peds.fleeFrom(car.x, car.z, 25);
    }
    player.setPos(car.x, car.z);
    player.heading = car.heading;
    speed = car.speed;
    // Car vs pedestrians.
    for (const ped of G.peds.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.6 && Math.abs(car.speed) > 3) {
        G.peds.knockDown(ped);
        G.wanted.addHeat(CFG.heatHitPed, 'hit-ped');
        G.fx.crash(ped.x, ped.z, 6);
        G.peds.fleeFrom(car.x, car.z, 30);
      }
    }
    // Car vs other cars (circle push + damage).
    for (const other of G.traffic.all().concat(G.chase.all())) {
      if (other === car) continue;
      const dx = car.x - other.x, dz = car.z - other.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.3 && d > 0.01) {
        const push = (4.3 - d) / 2;
        const nx = dx / d, nz = dz / d;
        const fixed = G.city.resolveCircle(car.x + nx * push, car.z + nz * push, CFG.carRadius);
        car.setPos(fixed.x, fixed.z);
        if (Math.abs(car.speed) > 6) {
          G.fx.crash((car.x + other.x) / 2, (car.z + other.z) / 2, Math.abs(car.speed));
          G.sound.crash();
          G.cameraRig.addShake(0.35);
          car.health = Math.max(0, car.health - 6);
          if (other.role === 'police' || other.role === 'roadblock') {
            G.wanted.addHeat(CFG.heatHitCop, 'hit-cop');
          }
        }
        car.speed *= 0.6;
      }
    }
    // Wrecked car: smoke, then force the player out.
    if (car.health <= 0) {
      G.fx.smoke(car.x, 1.4, car.z);
      car.speed = 0;
      if (!car.wreckToasted) {
        car.wreckToasted = true;
        G.hud.toast('Car wrecked — get out and find another ride!');
        setTimeout(() => { if (G.player.inCar === car) exitCar(); }, 1200);
      }
    } else if (car.health < 40 && Math.random() < dt * 6) {
      G.fx.smoke(car.x, 1.2, car.z);
    }
  } else {
    speed = player.updateOnFoot(input, G.city, G.cameraRig.yaw, dt);
  }

  // Systems.
  G.traffic.update(dt, player.inCar, { x: player.x, z: player.z }, G.chase.all());
  G.peds.update(dt);
  const policeNear = G.chase.nearestDist(player.x, player.z) < CFG.policeSight;
  G.wanted.update(dt, { x: player.x, z: player.z }, policeNear);
  const stars = G.wanted.stars();
  G.chase.update(dt, stars, { x: player.x, z: player.z }, player.heading, speed, G.time, onPoliceRam);
  G.combat.update(dt, { x: player.x, z: player.z }, onPlayerHit);
  G.missions.update(dt);
  G.fx.update(dt);
  G.city.update(dt, G.time);
  G.daylight.update(player.x, player.z);

  // Busted: on foot, cops right on top of you, standing still.
  if (stars > 0 && !player.inCar) {
    const nd = G.chase.nearestDist(player.x, player.z);
    if (nd < 6 && !player.moving) {
      G.bustedT += dt;
      if (G.bustedT > 2.5) {
        G.sound.busted();
        G.state = 'fail';
        input.releaseLock();
        G.missions.failCurrent('Busted by the Meridian Bay PD');
        G.menus.showWasted('busted');
        return;
      }
    } else {
      G.bustedT = 0;
    }
  }

  // Audio follows the action.
  G.sound.setEngine(player.inCar ? carSpeedKmh(player.inCar) : 0, !!player.inCar);
  G.sound.setSiren(stars > 0, G.chase.nearestDist(player.x, player.z));

  // Camera + HUD + minimap.
  const target = player.inCar || player;
  G.cameraRig.update(input, target, player.moving, !!player.inCar, speed, dt, G.city.blockers);
  const nearCar = !player.inCar ? nearestEnterableCar() : null;
  const mc = G.missions.missionCar();
  const mission = G.missions.active ? MISSIONS[G.missionIndex] : null;
  G.hud.update(dt, {
    health: player.health,
    cash: G.cash,
    stars,
    objective: G.missions.objectiveText(),
    timeLeft: G.missions.timeLeft(),
    missionTitle: mission?.title || '',
    missionIndex: mission ? mission.id : 0,
    x: player.x, z: player.z,
    driving: !!player.inCar,
    speedKmh: player.inCar ? carSpeedKmh(player.inCar) : 0,
    ammo: G.combat.ammo,
    mag: CFG.pistolMag,
    reloading: G.combat.reloading,
    prompt: nearCar ? (nearCar === mc ? 'E — Get in the car' : 'E — Steal car') : '',
  });
  // Minimap redraws at 10 Hz — plenty for a live map, much cheaper.
  G._mapT = (G._mapT || 0) + dt;
  if (G._mapT >= 0.1) {
    G._mapT = 0;
    G.minimap.draw({
      streets: G.city.streets,
      hideout: G.city.hideout,
      cars: G.traffic.all(),
      peds: G.peds.peds,
      police: G.chase.all(),
      marker: G.missions.marker(),
      player: { x: player.x, z: player.z, heading: player.heading },
      time: G.time,
    });
  }
}

function updateMenu(dt) {
  // Slow cinematic orbit over downtown behind the title screen.
  const t = G.time * 0.05;
  camera.position.set(Math.sin(t) * 130, 62, Math.cos(t) * 130 - 20);
  camera.lookAt(0, 0, -10);
  G.city.update(dt, G.time);
  G.daylight.update(0, 0);
}

// ---------- Screenshot staging (URL ?shot=cover|foot|drive|mission) ----------
// Uses only the game's own public systems: starts a real mission, teleports
// the player, spawns real police — the shots are genuine gameplay frames.
function dressScene(carSpots, pedSpots) {
  // Pull a few traffic cars and pedestrians into frame so no shot is empty.
  carSpots.forEach((s, i) => {
    const car = G.traffic.cars[i % G.traffic.cars.length];
    car.setPos(s.x, s.z);
    car.setHeading(s.heading);
    car.speed = s.speed ?? 8;
    car.lane.alongX = Math.abs(Math.sin(s.heading)) > 0.5;
    car.lane.dir = car.lane.alongX ? Math.sign(Math.sin(s.heading)) : Math.sign(Math.cos(s.heading));
    car.lane.street = car.lane.alongX ? s.z : s.x;
  });
  pedSpots.forEach((s, i) => {
    const ped = G.peds.peds[i % G.peds.peds.length];
    ped.x = s.x; ped.z = s.z;
    ped.state = 'walk';
    ped.target = { x: s.x + 20, z: s.z };
    ped.mesh.position.set(s.x, 0, s.z);
  });
}

function stageShot(kind) {
  G.sound.ensure();
  if (kind === 'cover') {
    startMission(2); // Heat Wave: 3 stars, police already hunting
    G.missions.current.timeLeft = 239;
    const car = createCar(scene, { type: 'sedan', color: 0xd84040, role: 'player', x: 0, z: 175, heading: 0 });
    car.speed = 8;
    enterCar(car, false);
    G.player.heading = 0;
    // Roadblock ahead at the beach end of the road + two cruisers holding
    // alongside (roadblock role: they hold position instead of ramming).
    G.chase.spawnRoadblock({ x: 0, z: 175 }, 0);
    for (const [fx, fz] of [[-6.5, 180], [6.5, 182]]) {
      const flanker = createCar(scene, { type: 'police', color: 0xf2f2f2, role: 'roadblock', x: fx, z: fz, heading: 0 });
      flanker.blockT = 0;
      G.chase.roadblocks.push(flanker);
    }
    dressScene(
      [{ x: -3.5, z: 195, heading: 0 }, { x: 3.5, z: 156, heading: Math.PI }, { x: -3.5, z: 146, heading: 0 }],
      [{ x: -9.5, z: 168 }, { x: 9.5, z: 182 }, { x: -9.5, z: 192 }, { x: 9.5, z: 158 }],
    );
    G.cameraRig.setYaw(Math.PI);
    G.cameraRig.setPitch(0.48);
  } else if (kind === 'foot') {
    startMission(0);
    G.missions.current.timeLeft = 150;
    G.player.setPos(0, -24);
    // Angle the view toward the delivery car so it (and its beacon) are in frame.
    G.player.heading = 2.74;
    G.player.group.rotation.y = 2.74;
    dressScene(
      [{ x: -3.5, z: -44, heading: 0 }, { x: 3.5, z: -6, heading: Math.PI }, { x: -3.5, z: 8, heading: 0 }],
      [{ x: -9.5, z: -32 }, { x: 9.5, z: -18 }, { x: -9.5, z: -12 }, { x: 9.5, z: -38 }, { x: 9.5, z: -28 }],
    );
    G.cameraRig.setYaw(-0.4);
    G.cameraRig.setPitch(0.42);
  } else if (kind === 'drive') {
    startMission(0);
    // Complete step 1 by getting in the delivery car, then drive the strip.
    const mc = G.missions.missionCar();
    G.player.setPos(mc.x, mc.z);
    enterCar(mc, false);
    G.missions.update(0.01);
    G.missions.current.timeLeft = 150;
    mc.setPos(-60, 196.5);
    mc.setHeading(Math.PI / 2);
    mc.speed = 24;
    G.player.setPos(mc.x, mc.z);
    G.player.heading = Math.PI / 2;
    dressScene(
      [{ x: -35, z: 196.5, heading: Math.PI / 2 }, { x: -20, z: 203.5, heading: -Math.PI / 2 }, { x: 30, z: 196.5, heading: Math.PI / 2 }],
      [{ x: -80, z: 190.5 }, { x: -40, z: 209.5 }, { x: -10, z: 190.5 }, { x: 10, z: 209.5 }],
    );
    G.cameraRig.setYaw(-Math.PI / 2);
    G.cameraRig.setPitch(0.4);
  } else if (kind === 'mission') {
    startMission(3); // Port Ambush
    G.missions.current.timeLeft = 299;
    G.player.setPos(160, -152);
    G.player.heading = 0;
    G.player.group.rotation.y = 0;
    G.missions.update(0.01); // reach the port -> gunmen spawn
    G.missions.current.timeLeft = 299;
    // Step into the yard so the nearest gunman is big in frame with his health bar.
    G.player.setPos(165, -124);
    G.player.heading = 0;
    G.player.group.rotation.y = 0;
    G.cameraRig.setYaw(Math.PI);
    G.cameraRig.setPitch(0.42);
  }
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.time += dt;
  if (G.state === 'playing') updatePlaying(dt);
  else if (G.state === 'menu') updateMenu(dt);
  else if (G.state === 'paused') {
    if (G.input.wasPressed('Escape') || G.input.wasPressed('KeyP')) {
      G.state = 'playing';
      G.menus.hideAll();
      G.hud.show();
    }
  } else if (G.state === 'map') {
    G.minimap.drawTo(document.getElementById('map-canvas'), {
      streets: G.city.streets,
      hideout: G.city.hideout,
      cars: G.traffic.all(),
      peds: G.peds.peds,
      police: G.chase.all(),
      marker: G.missions.marker(),
      player: { x: G.player.x, z: G.player.z, heading: G.player.heading },
      time: G.time,
    });
    if (G.input.wasPressed('KeyM') || G.input.wasPressed('Escape')) {
      G.state = 'playing';
      G.menus.hideAll();
      G.hud.show();
    }
  }
  renderer.render(scene, camera);
  G.input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// First user gesture unlocks audio.
window.addEventListener('pointerdown', () => G.sound.ensure(), { once: true });
window.addEventListener('keydown', () => G.sound.ensure(), { once: true });

// Exposed for playtests (not part of gameplay).
window.__mb = {
  G,
  state: () => G.state,
  stars: () => G.wanted.stars(),
  mission: () => (G.missions.active ? MISSIONS[G.missionIndex].title : null),
  objective: () => G.missions.objectiveText(),
  cash: () => G.cash,
  playerPos: () => ({ x: G.player.x, z: G.player.z }),
  inCar: () => !!G.player.inCar,
  enemies: () => G.combat.aliveCount(),
  police: () => G.chase.all().length,
};

const params2 = params;
const shot = params2.get('shot');
if (shot) {
  stageShot(shot);
} else {
  const save = loadSave();
  G.menus.showStart(!!save, save?.cash ?? CFG.startCash, (save?.missionIndex ?? 0) + 1);
}
loop();
