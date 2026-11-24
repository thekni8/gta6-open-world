// Tuning constants for Meridian Bay: speeds, wanted thresholds, colors,
// prices and city dimensions. One place to tune the whole game.

export const CONFIG = {
  citySeed: 20261124,
  // City grid: roads every 68 m, 16 m wide, nine roads each way.
  roadPitch: 68,
  roadWidth: 16,
  roadCount: 9,
  worldBound: 340,
  beachZ: 300,
  portX: 300,

  // Player on foot.
  walkSpeed: 6,
  sprintSpeed: 9.5,
  playerRadius: 0.55,
  playerMaxHp: 100,

  // Driving (arcade).
  carMaxSpeed: 42, // m/s, about 151 km/h
  carAccel: 16,
  carBrake: 32,
  carReverseMax: 12,
  carTurnRate: 1.9,
  handbrakeGripLoss: 0.45,
  trafficSpeed: 11,

  // Wanted level.
  maxWanted: 5,
  wantedDecaySeconds: 26, // one star fades after this long unseen
  layLowRadius: 26,
  policeChaseRange: 190,
  roadblockStars: 4,

  // Combat.
  pistolDamage: 34,
  pistolMag: 12,
  pistolReserveStart: 48,
  pistolRange: 70,
  pistolFireInterval: 0.22,
  meleeDamage: 20,
  meleeRange: 2.4,
  gunmanHp: 100,

  // Economy.
  startCash: 200,
  missionRewards: [400, 600, 800, 1200, 2000],

  // Look.
  asphaltColor: 0x2b2e33,
  sidewalkColor: 0x9aa0a6,
  sandColor: 0xe9d6a4,
  seaColor: 0x1f8fa8,
  dockColor: 0x8b8f94,
  cabinColor: 0x5a6b7a, // slate blue-grey, never pitch black
  skyColor: 0x8fc7e8,
  fogColor: 0xf2c98f,
  sunColor: 0xffe3b3,
};

export const DISTRICTS = [
  { name: 'BAYFRONT BEACH', test: (x, z) => z >= 268 },
  { name: 'MERIDIAN PORT', test: (x, z) => x >= 292 && z < 292 },
  { name: 'DOWNTOWN', test: (x, z) => Math.abs(x) < 140 && Math.abs(z) < 140 },
  { name: 'OLD TOWN', test: (x, z) => x < -140 && z < 292 },
  { name: 'MARINA DISTRICT', test: (x, z) => z < -140 && x >= -140 },
  { name: 'HARBOR HEIGHTS', test: () => true },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d.name;
  return 'MERIDIAN BAY';
}

export const WEAPONS = {
  pistol: { name: '9MM PISTOL', icon: '▸', damage: CONFIG.pistolDamage, mag: CONFIG.pistolMag, range: CONFIG.pistolRange },
  fists: { name: 'FISTS', icon: '✊', damage: CONFIG.meleeDamage, mag: 0, range: CONFIG.meleeRange },
};

export const CAR_COLORS = [
  0xc94f4f, 0x4f7ec9, 0xe8c547, 0x7fb069, 0xd9d9d9, 0x3a3f4a,
  0xe07b39, 0x8e6cc9, 0x4fb0c9, 0xb8b0a1, 0x5f8f7b, 0xc94f8e,
];

export const BUILDING_COLORS = [
  0xf2e3c9, 0xe8c9a8, 0xd9e2e8, 0xf2d1c9, 0xcfe0d4, 0xe8e0c9,
  0xd4c9e8, 0xf2e8d5, 0xc9d9e8, 0xe8c9c9, 0xd9e8c9, 0xe8d9b0,
];
