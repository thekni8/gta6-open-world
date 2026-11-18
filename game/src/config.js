// Meridian Bay — tuning constants. One place for every number the game
// balances on, so a tweak here retunes the whole city at once.
export const CONFIG = {
  // City grid: roads run on both axes at these coordinates; blocks sit
  // between them. Pitch 60 = 46 m block + 14 m road.
  city: {
    pitch: 60,
    blockSize: 46,
    roadWidth: 14,
    roadsPerAxis: 9, // road centre lines at -240, -180, ... 240
    half: 270, // playable edge; sea west of it, port east of it
    seaX: -285, // water begins here (west edge)
    beachX: -268, // sand strip between city edge and water
    portX: 252, // container yard begins here (east edge)
  },
  player: {
    walkSpeed: 6.5,
    runSpeed: 11,
    accel: 40,
    radius: 0.55,
    health: 100,
    punchRange: 2.2,
    punchDamage: 25,
  },
  car: {
    accel: 26,
    brake: 42,
    maxSpeed: 42, // m/s, ~150 km/h
    maxReverse: 12,
    steer: 0.55, // rad/s at full lock, scaled down with speed
    grip: 6.5,
    radius: 1.6,
    damagePerHit: 8,
  },
  traffic: {
    count: 22,
    speed: 9,
    pedCount: 36,
    pedSpeed: 1.6,
  },
  police: {
    // police cars on the road per wanted star
    carsPerStar: [0, 1, 2, 3, 4, 5],
    chaseSpeed: 34,
    ramDamage: 6,
    roadblockAtStars: 3,
    // seconds with no police line-of-sight before a star decays
    decaySeconds: 14,
    sightRange: 55,
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
    pistolRange: 90,
    magazine: 12,
    reloadSeconds: 1.1,
    fireInterval: 0.22,
    enemyHealth: 60,
    enemyDamage: 5,
    enemyShotInterval: 1.6,
    enemyRange: 42,
  },
  missions: {
    reward: [400, 600, 900, 1200, 2500],
  },
  // Golden-hour palette: warm low sun, peach haze, teal sea.
  palette: {
    sky: 0x7fb8e2,
    fog: 0xe8c9a8,
    sun: 0xffb066,
    road: 0x3a3f46,
    roadLine: 0xd8c86a,
    sidewalk: 0x9aa0a3,
    sand: 0xe8d29a,
    sea: 0x1f7f8c,
    grass: 0x6f9e5a,
    building: [
      0xe8b48c, 0xd99a7a, 0xc98d7a, 0xa8b8c8, 0x8fb0a0,
      0xe0cfa0, 0xb8a8c8, 0xd8d0c0, 0x9ab8d8, 0xc8a0a0,
    ],
    tower: [0x7a9ab8, 0x8fb8d8, 0x6a8aa8, 0xa8c0d8],
    car: [
      0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad,
      0xe67e22, 0xecf0f1, 0x1a1a1a, 0x7f8c8d, 0x16a085,
    ],
    police: 0x1a2a4a,
    taxi: 0xf5c518,
  },
  saveKey: 'meridian-bay-save-v1',
};
