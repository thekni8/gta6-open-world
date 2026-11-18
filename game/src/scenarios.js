// Screenshot staging: ?shot=cover|foot|drive|mission stages a dense, live
// scene — an active mission with a countdown, traffic and pedestrians in
// frame, police close in the chase shot — then the camera is placed for it.
// Every shot shows the full HUD: big minimap, stars, objective + timer.
// Staging follows the Argon vet: angled cameras (never a straight vanishing
// point), a physical police blockade for the cover, close pedestrians on
// foot, downtown — not the beach twice — for the drive shot, and a
// mid-firefight port with a wounded gunman.
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

function addTrafficOnRoad(game, line, positions, angle, horizontal = true) {
  for (const t of positions) {
    const x = horizontal ? t : line + (Math.random() < 0.5 ? -3 : 3);
    const z = horizontal ? line + (Math.random() < 0.5 ? -3 : 3) : t;
    const car = new Car(game.scene, { x, z, angle, color: randomCarColor(game.rng), kind: 'sedan' });
    car.driver = 'traffic';
    car.route = { horizontal, line, dir: 1, targetSpeed: 11 };
    car.speed = 9;
    game.traffic.cars.push(car);
  }
}

function addPedsNear(game, cx, cz, count, spread = 40) {
  for (let i = 0; i < count; i++) {
    const x = cx + (Math.random() - 0.5) * spread;
    const z = cz + (Math.random() - 0.5) * spread * 0.7;
    const ped = game.peds._makePed(x, z);
    game.peds.peds.push(ped);
  }
}

function addPedAt(game, x, z) {
  const ped = game.peds._makePed(x, z);
  game.peds.peds.push(ped);
  return ped;
}

function parkCar(game, x, z, angle, color) {
  const car = new Car(game.scene, { x, z, angle, color, kind: 'sedan' });
  car.driver = null;
  game.traffic.parked.push(car);
  return car;
}

export function applyScenario(game, name) {
  const player = game.player;
  if (name === 'cover') {
    // Coastal intersection blockade: wanted 3, mission live, one cruiser
    // T-boned 45° across the player's fender, a second cruiser behind,
    // a roadblock ahead, cross-traffic, peds on the boardwalk. Camera
    // yawed ~25° off the road axis — never a straight vanishing point.
    game.missions.startMission(2); // Heat Run — wanted 3 + timer
    game.hud.hideToast();
    givePlayerCar(game, -88, 196, -Math.PI / 2, 0x118ab2);
    player.car.speed = 5;
    // T-bone cruiser: diagonal across the player's front fender.
    const ram = game.police.spawnCruiser(game, -80, 193.5);
    ram.angle = -Math.PI / 4;
    ram.group.rotation.y = ram.angle;
    ram.speed = 0;
    // Second cruiser tight behind the player.
    const tail = game.police.spawnCruiser(game, -94, 196);
    tail.angle = -Math.PI / 2;
    tail.group.rotation.y = tail.angle;
    tail.speed = 4;
    // Roadblock across the avenue ahead.
    for (const z of [192.6, 199.4]) {
      const block = new Car(game.scene, { x: -72, z, angle: Math.PI / 2, color: 0x1a3a5c, kind: 'police' });
      block.driver = 'police-block';
      game.police.roadblockCars.push(block);
    }
    addTrafficOnRoad(game, 196, [-30, -10, 18, -130], -Math.PI / 2, true);
    addTrafficOnRoad(game, -84, [150, 120, 96], 0, false); // cross-traffic, northbound
    addTrafficOnRoad(game, -84, [176, 140], Math.PI, false); // cross-traffic, southbound
    addPedsNear(game, -84, 212, 7, 36); // boardwalk peds
    game.cameraRig.setView(-0.85, 0.55, 19);
    game.cameraRig.firstFrame = true;
  } else if (name === 'foot') {
    // On foot downtown: mission live, pedestrians close to the camera,
    // On foot at a downtown intersection corner: mission live, pedestrians
    // close to the camera, a parked car beside the player so the [E]
    // prompt shows, towers and cross-traffic beyond — no blank wall.
    game.missions.startMission(0); // First Delivery — timer running
    game.hud.hideToast();
    player.pos.set(34, 0, 34);
    player.angle = 0.785; // facing north-east, into downtown
    parkCar(game, 37, 32, -Math.PI / 2, 0x3da35d);
    addPedAt(game, 38, 38);
    addPedAt(game, 42, 36);
    addPedAt(game, 36, 44);
    addPedAt(game, 44, 42);
    addPedAt(game, 20, 38);
    addPedAt(game, 36, 18);
    addPedsNear(game, 28, 28, 5, 40);
    addTrafficOnRoad(game, 28, [-40, -16, 44, 64], -Math.PI / 2, true);
    addTrafficOnRoad(game, -28, [-30, 10, 44], Math.PI / 2, true);
    addTrafficOnRoad(game, 28, [-8, 60], 0, false);
    game.cameraRig.setView(-2.8, 0.5, 10);
    game.cameraRig.firstFrame = true;
  } else if (name === 'drive') {
    // Downtown avenue, not the beach again: speeding past towers with
    // cross-traffic and the marina beacon glowing ahead, mission + timer.
    game.missions.startMission(0); // First Delivery
    game.missions.jumpToStep(1); // deliver leg — beacon at the marina
    game.hud.hideToast();
    givePlayerCar(game, -60, 28, -Math.PI / 2, 0xd94f3d);
    player.car.speed = 27;
    addTrafficOnRoad(game, 28, [-20, 8, 40, -100, 70], -Math.PI / 2, true);
    addTrafficOnRoad(game, 28, [-44], -Math.PI / 2, true); // about to be overtaken
    addTrafficOnRoad(game, 28, [-30], Math.PI / 2, true); // oncoming
    addTrafficOnRoad(game, -28, [-40, 30], Math.PI / 2, true);
    addTrafficOnRoad(game, -28, [-10, 70], 0, false);
    addTrafficOnRoad(game, 28, [0, 64], Math.PI, false);
    // Pedestrians on the sidewalks (z=19 north side, z=37 south side).
    addPedAt(game, -48, 19);
    addPedAt(game, -30, 37);
    addPedAt(game, -12, 19);
    addPedAt(game, 6, 37);
    addPedAt(game, 24, 19);
    addPedAt(game, -52, 37);
    addPedAt(game, -70, 19);
    addPedAt(game, -40, 19);
    addPedAt(game, -35, 37);
    // Pulled back + steeper pitch so the player's own car sits fully in
    // frame at the bottom instead of being cut off at the corner.
    // Angled three-quarter rear view, pulled back: the car sits in frame
    // at the bottom with the avenue and cross-traffic ahead.
    game.cameraRig.setView(Math.PI / 2 + 0.6, 0.5, 16);
    game.cameraRig.firstFrame = true;
  } else if (name === 'mission') {
    // Port Ambush mid-firefight: gunmen with health bars among double-
    // stacked containers and a yellow crane, the beacon in frame, one
    // gunman already wounded to 40% — the shot script fires the pistol
    // just before capture for a muzzle flash + tracer.
    game.missions.startMission(3);
    game.missions.jumpToStep(1); // the shootout
    game.hud.hideToast();
    // Fight staged on the open dock road: player on the road edge, gunmen
    // among the containers ahead, crane and beacon in frame behind them.
    player.pos.set(-198, 0, 70);
    player.angle = -2.26; // facing the gunman by the crane
    // On the camera-player axis, so the staged pistol shot hits him.
    const wounded = game.weapons.spawnEnemy(game, -203, 64);
    wounded.health = 40;
    game.cameraRig.setView(0.7, 0.42, 9);
    game.cameraRig.firstFrame = true;
  }
}
