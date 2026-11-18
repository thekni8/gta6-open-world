// Screenshot staging: ?shot=cover|foot|drive|mission stages a dense, live
// scene — an active mission with a countdown, traffic and pedestrians in
// frame, police close in the chase shot — then the camera is placed for it.
// Every shot shows the full HUD: big minimap, stars, objective + timer.
import { Car, randomCarColor } from './vehicles/cars.js';

export function scenarioFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot');
}

function givePlayerCar(game, x, z, angle, color = 0x118ab2) {
  const car = new Car(game.scene, { x, z, angle, color, kind: 'sedan' });
  car.driver = 'player';
  game.enterCar(car, { silent: true });
  return car;
}

function addTrafficOnRoad(game, roadZ, xs, angle) {
  for (const x of xs) {
    const car = new Car(game.scene, {
      x, z: roadZ + (Math.random() < 0.5 ? -3 : 3),
      angle,
      color: randomCarColor(game.rng),
      kind: 'sedan',
    });
    car.driver = 'traffic';
    car.route = { horizontal: true, line: roadZ, dir: angle < 0 ? 1 : -1, targetSpeed: 11 };
    car.speed = 9;
    game.traffic.cars.push(car);
  }
}

function addPedsNear(game, cx, cz, count) {
  for (let i = 0; i < count; i++) {
    const x = cx + (Math.random() - 0.5) * 46;
    const z = cz + (Math.random() - 0.5) * 36;
    const ped = game.peds._makePed(x, z);
    game.peds.peds.push(ped);
  }
}

export function applyScenario(game, name) {
  const player = game.player;
  if (name === 'cover') {
    // Police chase on the beachfront avenue: wanted 3, mission live,
    // cruisers flanking and a roadblock ahead, traffic and peds in frame.
    game.missions.startMission(2); // Heat Run — wanted 3 + timer
    givePlayerCar(game, -52, 168, -Math.PI / 2, 0x118ab2);
    player.car.speed = 24;
    game.police.spawnCruiser(game, -66, 162); // flanking behind-left
    game.police.spawnCruiser(game, -44, 174); // flanking right
    game.police.spawnCruiser(game, -78, 168); // chasing behind
    for (const c of game.police.cars) { c.speed = 22; c.angle = -Math.PI / 2; }
    game.police.spawnRoadblock(game); // ahead on the avenue
    addTrafficOnRoad(game, 168, [-20, 8, 30, -95], -Math.PI / 2);
    addPedsNear(game, -40, 180, 8);
    game.cameraRig.setView(Math.PI / 2 + 0.25, 0.5, 13);
    game.cameraRig.firstFrame = true;
  } else if (name === 'foot') {
    // On foot downtown: mission live, peds and traffic all around.
    game.missions.startMission(0); // First Delivery — timer running
    player.pos.set(-6, 0, 30);
    player.angle = Math.PI * 0.85;
    addPedsNear(game, 0, 28, 12);
    addTrafficOnRoad(game, 28, [-40, -12, 24, 52], -Math.PI / 2);
    addTrafficOnRoad(game, -28, [-30, 10, 44], Math.PI / 2);
    game.cameraRig.setView(Math.PI * 0.9, 0.5, 10);
    game.cameraRig.firstFrame = true;
  } else if (name === 'drive') {
    // Speeding along the beachfront strip: palms, sea, mission + timer.
    game.missions.startMission(1); // Borrowed Wheels — timer running
    givePlayerCar(game, -70, 168, -Math.PI / 2, 0xd94f3d);
    player.car.speed = 27;
    addTrafficOnRoad(game, 168, [-30, 5, 40, -105, 70], -Math.PI / 2);
    addPedsNear(game, -50, 185, 8);
    game.cameraRig.setView(Math.PI / 2 + 0.15, 0.42, 13);
    game.cameraRig.firstFrame = true;
  } else if (name === 'mission') {
    // Port Ambush shootout: gunmen with health bars, crates and cranes.
    game.missions.startMission(3);
    // Jump straight to the shootout step.
    game.missions.active.stepIndex = 1;
    game.missions._enterStep();
    player.pos.set(-206, 0, 74);
    player.angle = Math.PI * 1.25;
    // One gunman close and visible, mid-frame.
    game.weapons.spawnEnemy(game, -214, 62);
    game.cameraRig.setView(Math.PI * 1.2, 0.45, 9);
    game.cameraRig.firstFrame = true;
  }
}
