// Meridian Bay — tuning constants. One place for every number the systems share:
// speeds, wanted thresholds, prices, colours and city dimensions.
export const STEP = 1 / 60;

export const CITY = {
  pitch: 74, // road centre to road centre (60 block + 14 road)
  roadWidth: 14,
  blocks: 3, // block indices run -3..3, so the grid spans about 520 units
  groundSize: 620,
  beachX: 283, // sand starts here, east edge of the city
  waterX: 348, // sea starts here
  maxCoord: 270, // keep actors inside the built city
};

export const PLAYER = {
  walkSpeed: 7,
  sprintSpeed: 11,
  radius: 0.6,
  maxHealth: 100,
  punchDamage: 25,
  punchRange: 2.2,
  pistolDamage: 34,
  pistolAmmo: 12,
  pistolReserve: 60,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 38, // ~137 km/h, arcade
  maxReverse: 10,
  steer: 1.9,
  grip: 6.5,
  radius: 1.6,
  enterRange: 4.5,
};

export const TRAFFIC = {
  count: 14,
  speed: 9,
  minGap: 7,
};

export const PEDS = {
  count: 26,
  walkSpeed: 1.6,
  fleeSpeed: 4.2,
};

export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killPed: 2,
  killCop: 2,
  decaySeconds: 14, // quiet seconds per star lost while unseen
  layLowMultiplier: 2.5, // decay is faster inside the lay-low zone (the beach)
  maxStars: 5,
};

// Police cars per wanted level (index = stars).
export const POLICE_PER_STAR = [0, 1, 2, 3, 4, 5];
export const POLICE_SPEED = [0, 15, 17, 19, 21, 24];
export const POLICE_RAM_DAMAGE = 6;

export const MISSIONS = {
  reward: [400, 600, 900, 1200, 2000],
  failCashPenalty: 150,
};

export const COLORS = {
  sky: 0x87bfe8,
  fog: 0xa8c8e0,
  sun: 0xffe0b3,
  road: 0x494f58,
  sidewalk: 0xa8adb5,
  sand: 0xe8d29a,
  sea: 0x1f7f8f,
  grass: 0x5d8a4a,
  buildingPalette: [0xe8b48c, 0xd98a7a, 0x8fb8d8, 0xf2d492, 0xb8a8d8, 0x9ac8a0, 0xe0e0e0, 0xc47a6a],
  carPalette: [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x222831, 0xd86a1e, 0x7a4a9e],
  policeCar: 0x1c2f4a,
  taxi: 0xf2c200,
};

export const SAVE_KEY = 'meridian-bay-save-v1';
export const BEST_KEY = 'meridian-bay-best-cash';
