// Meridian Bay — every tuning number in one place. The city grid, the
// feel of walking and driving, how hard the police push back, and the
// golden-hour palette all live here, so one edit retunes the whole game.

export const CONFIG = {
  // The city is a 9x9 road grid: roads on both axes at -256..256 in steps
  // of 64, blocks of 50 m between them, 14 m of asphalt per road.
  world: {
    pitch: 64,
    block: 50,
    roadWidth: 14,
    roads: [-256, -192, -128, -64, 0, 64, 128, 192, 256],
    bound: 300, // playable edge; the sea and the port sit just past it
    seaEdge: -296, // water begins west of here
    sandEdge: -278, // beach strip between the last road and the water
    portEdge: 268, // container yard begins east of here
    seed: 20261118,
  },

  player: {
    walk: 6.8,
    sprint: 11.5,
    accel: 42,
    radius: 0.55,
    health: 100,
    reach: 2.3, // melee range
    punch: 26, // melee damage
  },

  car: {
    accel: 27,
    brake: 44,
    topSpeed: 44, // m/s, about 158 km/h
    topReverse: 13,
    steerLock: 0.6,
    radius: 1.7,
    scrapeDamage: 5,
  },

  crowd: {
    trafficCars: 28,
    cruiseMin: 7,
    cruiseMax: 11.5,
    pedestrians: 44,
    pedWalkMin: 1.1,
    pedWalkMax: 2.1,
  },

  police: {
    // Interceptors on the road for each wanted level (index = stars).
    fleet: [0, 1, 2, 3, 4, 5],
    pursuitSpeed: 35,
    ramDamage: 6,
    roadblockStars: 3,
    roadblockCooldown: 25,
    decaySeconds: 14, // unseen seconds before a star drops
    sight: 58,
  },

  wanted: {
    stealCar: 1,
    hitPedestrian: 1,
    shoot: 1,
    hitPolice: 2,
    killPedestrian: 1,
    maxStars: 5,
  },

  combat: {
    pistolDamage: 34,
    pistolRange: 95,
    magazine: 12,
    reloadTime: 1.1,
    fireGap: 0.22,
    enemyHealth: 60,
    enemyDamage: 5,
    enemyShotGap: 1.6,
    enemyRange: 44,
    enemyChaseSpeed: 4.6,
  },

  // Late-afternoon Meridian Bay: warm sun, peach haze, teal water.
  palette: {
    sky: 0x7fb4e0,
    haze: 0xe9c9a6,
    sun: 0xffb168,
    road: 0x3a3f46,
    roadLine: 0xd8c86a,
    sidewalk: 0x9aa0a3,
    sand: 0xe8d29a,
    sea: 0x1f7f8c,
    grass: 0x6f9e5a,
    facade: [
      0xe8b48c, 0xd99a7a, 0xc98d7a, 0xa8b8c8, 0x8fb0a0,
      0xe0cfa0, 0xb8a8c8, 0xd8d0c0, 0x9ab8d8, 0xc8a0a0,
    ],
    tower: [0x7a9ab8, 0x8fb8d8, 0x6a8aa8, 0xa8c0d8],
    paint: [
      0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad,
      0xe67e22, 0xecf0f1, 0x1a1a1a, 0x7f8c8d, 0x16a085,
    ],
    police: 0x1a2a4a,
    gold: 0xf5c518,
  },

  saveKey: 'meridian-bay-save-v3',
};
