// Screenshot staging: puts the game into the exact mid-action states the
// four screenshots need. Every staged value (cash, HP, ammo, wanted,
// kills) is reachable through normal play; staging just sets it directly
// so the screenshots show a game in progress, never mission-start state.

export function stageShot(game, name) {
  const g = game;
  g.startPlaying();
  g.police.clearAll();
  g.traffic.cars.forEach((c) => { if (c.ai) c.ai.parked = false; });
  g.missions.enemies.clear();
  g.missions.clearMissionCar();
  g.wanted.clear();
  g.hud.clearToasts();

  if (name === 'cover') return stageCover(g);
  if (name === 'foot') return stageFoot(g);
  if (name === 'drive') return stageDrive(g);
  if (name === 'mission') return stageMission(g);
  return false;
}

function stageCover(g) {
  // Police chase at wanted 3, coastal intersection, camera yawed ~20°.
  g.missions.startMission(2); // HEAT ON THE HARBOR
  g.setHudState({ cash: 1250, hp: 82, ammo: 7, reserve: 36, wanted: 3, kills: 0 });
  const car = g.spawnPlayerCar(-60, 272, Math.PI / 2, 0xc94f4f);
  g.enterCar(car);
  car.speed = 8; // creeping through the blockade, ~29 km/h
  // Cruiser 1: angled ~45° across the player's front fender.
  const c1 = g.police.spawnCruiserNear({ x: -60, z: 272 });
  c1.setPosition(-51, 277.5, Math.PI / 2 + Math.PI / 4);
  c1.ai.mode = 'parked';
  // Cruiser 2: close behind, offset left so its nose peeks past the car.
  const c2 = g.police.spawnCruiserNear({ x: -60, z: 272 });
  c2.setPosition(-73, 268.5, Math.PI / 2);
  c2.ai.mode = 'parked';
  // Two more cars on the beach road so the frame is full.
  const t1 = g.traffic.placeAt(-16, 268.4, Math.PI / 2);
  t1.ai.parked = false;
  t1.speed = 10;
  const t2 = g.traffic.placeAt(6, 275.6, -Math.PI / 2);
  t2.ai.parked = false;
  t2.speed = 10;
  // Pedestrians on the boardwalk edge, close to the road.
  g.peds.spawnAt(-45, 288);
  g.peds.spawnAt(-70, 289);
  g.peds.spawnAt(-30, 287);
  g.setCameraYaw(Math.PI / 2 + Math.PI + 0.35, 0.34);
  g.hud.clearToasts();
  g.hud.toast('WANTED LEVEL 3', 'The heat is on — lay low at the hideout.');
  g.markShotReady();
  return true;
}

function stageFoot(g) {
  // On foot downtown: [E] prompt + bouncing arrow over the blue car.
  g.missions.startMission(1); // BORROWED WHEELS
  g.setHudState({ cash: 480, hp: 91, ammo: 12, reserve: 48, wanted: 0, kills: 0 });
  // The delivery car waits at the roadside (30, -63); Kai stands 2.8 m off.
  g.teleportPlayer(28, -61, Math.atan2(30 - 28, -63 - (-61)));
  g.peds.spawnAt(24, -56);
  g.peds.spawnAt(33, -58);
  g.peds.spawnAt(36, -64);
  g.setCameraYaw(Math.atan2(30 - 28, -63 - (-61)) + Math.PI, 0.3);
  g.hud.clearToasts();
  g.markShotReady();
  return true;
}

function stageDrive(g) {
  // Dense downtown drive at 135+ km/h — not the beach road again.
  g.missions.startMission(0); // FIRST DELIVERY
  g.missions.objectiveIndex = 1;
  g.missions.updateBeacon();
  g.setHudState({ cash: 2400, hp: 100, ammo: 9, reserve: 48, wanted: 0, kills: 0 });
  const car = g.spawnPlayerCar(-46, 0, Math.PI / 2, 0x2e8b8b);
  g.enterCar(car);
  car.speed = 38; // ~137 km/h
  g.cruiseSpeed = 38; // hold it: no throttle input in a still shot
  // Cross-traffic ahead, close enough to read: five on this road, two crossing.
  const ahead = [
    [-8, -3.6, Math.PI / 2], [10, 3.6, -Math.PI / 2], [28, -3.6, Math.PI / 2],
    [46, 3.6, -Math.PI / 2], [64, -3.6, Math.PI / 2],
    [68, -24, 0], [68, 26, Math.PI],
  ];
  for (const [x, z, h] of ahead) {
    const t = g.traffic.placeAt(x, z, h);
    t.ai.parked = false;
    t.speed = 10;
  }
  g.peds.spawnAt(5, -12);
  g.peds.spawnAt(25, 12);
  g.peds.spawnAt(-5, -13);
  g.setCameraYaw(Math.PI / 2 + Math.PI + 0.18, 0.26);
  g.hud.clearToasts();
  g.markShotReady();
  return true;
}

function stageMission(g) {
  // Port firefight mid-action: 3/6 gunmen down, the rest half-hurt.
  // Ammo staged at 9: the screenshot's shot spends one, leaving 8/12.
  g.missions.startMission(3); // PORT AMBUSH
  g.missions.objectiveIndex = 1;
  g.missions.setupObjective();
  g.setHudState({ cash: 650, hp: 78, ammo: 9, reserve: 48, wanted: 0, kills: 3 });
  g.teleportPlayer(330, 30, Math.atan2(352 - 330, 20 - 30));
  const enemies = g.missions.enemies.list;
  // The three survivors stand in a 17–23 m band ahead of the player so
  // their half-depleted health bars read clearly in the frame.
  const survivorSpots = [[342, 18], [348, 26], [338, 8]];
  let survivor = 0;
  enemies.forEach((e, i) => {
    if (i < 3) {
      g.missions.enemies.damage(e, 999);
    } else {
      const spot = survivorSpots[survivor++];
      e.x = spot[0];
      e.z = spot[1];
      e.group.position.set(spot[0], 0, spot[1]);
      e.hp = 50;
      const frac = 0.5;
      e.fg.scale.x = frac;
      e.fg.position.x = -(1 - frac) * 1.05;
      e.fg.material.color.setHex(0xf2c230);
    }
  });
  g.setCameraYaw(Math.atan2(352 - 330, 20 - 30) + Math.PI, 0.3);
  g.hud.clearToasts();
  g.markShotReady();
  return true;
}

// Meridian Bay round 9 — witness touch
