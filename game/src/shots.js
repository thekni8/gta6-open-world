// Screenshot scenes behind ?shot=cover|foot|drive|mission. Each one sets up a
// real game state and then plays the real rules forward for a fixed number of
// steps with a simple autopilot, so the frame is what the game really looks
// like — and the same seed always gives the same frame.
import { STEP } from './config.js';
import { startMission } from './missions/manager.js';
import { addWanted } from './police/wanted.js';

/** Drive forward and steer toward the mission beacon, staying on the roads:
 *  first along the current avenue to the beacon's street, then along that
 *  street to the beacon. Cutting across blocks looks wrong and runs people over. */
function roadAutopilot(G) {
  const car = G.playerCar;
  const target = G.missionTarget;
  if (!car || !target) return { throttle: 1, steer: 0, shoot: false };
  const roads = G.city.roadCenters;
  const snap = (v) => roads.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const sx = snap(car.pos.x);
  const tz = snap(target.z);
  // Phase 1: drive along the current avenue (x = sx) to the beacon's street.
  // Phase 2: turn onto that street and drive to the beacon.
  const onAvenue = Math.abs(car.pos.x - sx) < 8;
  const nearStreet = Math.abs(car.pos.z - tz) < 8;
  let goal;
  if (onAvenue && !nearStreet) goal = { x: sx, z: tz };
  else goal = { x: target.x, z: nearStreet ? tz : target.z };
  const dx = goal.x - car.pos.x;
  const dz = goal.z - car.pos.z;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 1.6)), shoot: false };
}

/** Drive forward and steer gently toward the mission beacon. */
function driveAutopilot(G) {
  return roadAutopilot(G);
}

function runSteps(G, stepWorld, seconds, auto) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(STEP, auto);
}

/**
 * Stage the named scene. `helpers` carries the camera snap and the mission
 * pieces main.js owns. Unknown names stage the cover.
 */
export function stageShot(name, G, stepWorld, helpers) {
  const { snapCamera, cam, player, mission, wanted, coupe } = helpers;
  const places = G.city.places;
  G.screen = 'play';
  player.cash = 1250;

  if (name === 'foot') {
    // On foot downtown, mission 1 active, pedestrians and traffic around.
    player.pos.set(places.downtown.x + 6, 0, places.downtown.z + 40);
    player.heading = Math.PI;
    startMission(mission, wanted);
    snapCamera(cam, player.pos, player.heading);
    runSteps(G, stepWorld, 4, { throttle: 0.4, steer: 0, shoot: false });
    return;
  }

  if (name === 'drive') {
    // Driving north up the beachfront avenue, traffic ahead, mission 1 active.
    startMission(mission, wanted);
    player.pos.set(222, 0, 180);
    player.heading = Math.PI;
    // Put Kai in a car on the beachfront road, heading north.
    if (G.enterCarAt) G.enterCarAt(222, 190, Math.PI);
    snapCamera(cam, player.pos, player.heading);
    runSteps(G, stepWorld, 3, () => driveAutopilot(G));
    return;
  }

  if (name === 'mission') {
    // Mission 4: the port ambush. Kai on foot east of the container stacks,
    // shooters in the open ahead of him, wanted level 2, crosshair live.
    mission.index = 3;
    mission.step = 1;
    mission.state = 'active';
    mission.kills = 0;
    helpers.spawnShootersAtPort();
    player.pos.set(places.port.x + 62, 0, places.port.z + 22);
    // Face the shooters' line, not the port itself: they stand east of the stacks.
    player.heading = Math.atan2(-133 - player.pos.x, 223 - player.pos.z);
    snapCamera(cam, player.pos, player.heading);
    runSteps(G, stepWorld, 2.5, { throttle: 0, steer: 0, shoot: true });
    // Frame Kai against the shooters: camera high behind him, looking at
    // their line. (No police in this shot — the cover already shows the heat.)
    const alive = G.shooters.filter((s) => !s.dead);
    if (alive.length > 0) {
      const cx = alive.reduce((a, s) => a + s.pos.x, 0) / alive.length;
      const cz = alive.reduce((a, s) => a + s.pos.z, 0) / alive.length;
      const fx = Math.sin(player.heading);
      const fz = Math.cos(player.heading);
      helpers.camera.position.set(player.pos.x - fx * 11, 7, player.pos.z - fz * 11);
      helpers.camera.lookAt(cx, 1.5, cz);
    }
    return;
  }

  // Cover (default): a police chase at wanted level 3, mid-mission 3.
  // Start on a lamp-free avenue so nothing blocks the camera.
  mission.index = 2;
  mission.step = 0;
  mission.state = 'active';
  addWanted(wanted, 3, 'getaway');
  if (G.enterCarAt) G.enterCarAt(74, 190, Math.PI);
  player.heading = Math.PI;
  snapCamera(cam, player.pos, player.heading);
  // Two cruisers close behind, so the chase is in the frame from the start.
  if (helpers.spawnPoliceNear) {
    helpers.spawnPoliceNear(18);
    helpers.spawnPoliceNear(26);
  }
  // Short run: the car is still on its straight northward stretch when the
  // frame is taken, so the cruiser behind it sits on the same road.
  runSteps(G, stepWorld, 2, () => driveAutopilot(G));
  // Frame the chase from ahead of the player's car, looking back down the
  // road: the car drives toward the camera and the pursuing cruisers trail
  // behind it, all in one frame.
  const car = G.playerCar;
  if (car) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const rx = fz;
    const rz = -fx;
    const camPos = {
      x: car.pos.x + fx * 12 + rx * 5,
      z: car.pos.z + fz * 12 + rz * 5,
    };
    // Put the nearest cruiser right behind the getaway car, so the chase
    // reads in one frame: car, cruiser, road, city.
    const cop = G.police[0];
    if (car && cop) {
      const cfx = Math.sin(car.heading);
      const cfz = Math.cos(car.heading);
      cop.pos.set(car.pos.x - cfx * 13, 0, car.pos.z - cfz * 13);
      cop.heading = car.heading;
      cop.speed = 18;
      cop.group.position.copy(cop.pos);
      cop.group.rotation.y = cop.heading;
    }
    for (const c of G.city.colliders) {
      if (camPos.x > c.minX - 1 && camPos.x < c.maxX + 1 && camPos.z > c.minZ - 1 && camPos.z < c.maxZ + 1) {
        camPos.x = car.pos.x + fx * 10;
        camPos.z = car.pos.z + fz * 10;
        break;
      }
    }
    helpers.camera.position.set(camPos.x, 5.5, camPos.z);
    helpers.camera.lookAt(car.pos.x - fx * 10, 1.5, car.pos.z - fz * 10);
  }
}
