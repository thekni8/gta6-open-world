// Meridian Bay — tuning constants. One place for every number the game
// balances on: world size, speeds, wanted thresholds, rewards, colors.
export const CFG = {
  // World grid: streets every 40 units from -200 to 200, road half-width 7.
  worldHalf: 220,
  streetStep: 40,
  streetMin: -200,
  streetMax: 200,
  roadHalf: 7,
  sidewalk: 3,
  blockGap: 26,

  // Player on foot
  walkSpeed: 7,
  sprintSpeed: 11.5,
  playerRadius: 0.9,
  playerHealth: 100,

  // Driving (arcade)
  carAccel: 26,
  carBrake: 42,
  carReverse: 12,
  carMaxSpeed: 46,
  carMaxReverse: 14,
  carTurn: 1.9,
  handbrakeTurn: 2.9,
  carDrag: 0.55,
  carRadius: 2.2,

  // Traffic + pedestrians
  trafficCount: 16,
  trafficSpeed: 11,
  pedCount: 34,
  pedWalk: 2.2,
  pedFlee: 6.5,

  // Wanted / police
  heatPerStar: 20,
  heatStealCar: 22,
  heatHitPed: 14,
  heatKillPed: 34,
  heatHitCop: 26,
  heatShoot: 4,
  heatKillCop: 40,
  heatDecayFar: 2.2,
  heatDecayHideout: 9,
  policeSight: 55,
  maxPoliceCars: 4,

  // Combat
  pistolDamage: 34,
  pistolRange: 90,
  pistolMag: 12,
  pistolReloadS: 1.1,
  pistolFireS: 0.22,
  meleeDamage: 25,
  meleeRange: 2.6,
  enemyHealth: 60,
  enemyDamage: 7,
  enemyFireS: 1.4,

  // Missions
  markerRadius: 9,
  startCash: 200,

  // Look
  skyColor: 0x87c5e8,
  fogColor: 0xa8d0e8,
  fogNear: 120,
  fogFar: 420,
  sunColor: 0xfff1c4,
  sunIntensity: 1.35,
  hemiSky: 0xbfe3ff,
  hemiGround: 0x8a7a5a,
  hemiIntensity: 0.75,
  grassColor: 0x69b34c,
  roadColor: 0x3d3d42,
  sidewalkColor: 0xb9b3a4,
  sandColor: 0xe8d29a,
  seaColor: 0x2e9ec4,

  // District palettes (pastel, sun-soaked)
  buildingPalettes: {
    downtown: [0xe8b04b, 0xd97b6c, 0x7fa8c9, 0x9db98a, 0xc9a06a, 0xb08ac9, 0x6fa8a0],
    oldtown: [0xe8c37a, 0xd98a7a, 0xa8c686, 0x7fb3c9, 0xc9a0b4, 0xe8a85c],
    beach: [0xf2e3c6, 0xf5c9a8, 0xa8d8c9, 0xf2f2e8, 0xe8b8b0],
    port: [0x9a8a7a, 0x8a9aa8, 0xb0a890, 0x7a8a9a],
  },
  carColors: [0xd84040, 0x3a6fd8, 0xf2c230, 0x37b268, 0xe8e8e8, 0x2b2b30, 0xe87a30, 0x7a4fd0, 0x40c8c8, 0xc94f7c],
  containerColors: [0xd84f2a, 0x2a7fd8, 0x37b268, 0xe8a020, 0x7a4fd0, 0x40a8a0],
  pedShirts: [0xd84040, 0x3a6fd8, 0xf2c230, 0x37b268, 0xe87a30, 0x7a4fd0, 0x40c8c8, 0xf2f2f2, 0x2b2b30],
};

export const DISTRICTS = [
  { name: 'MERIDIAN PORT', test: (x, z) => x > 120 && z < -120 },
  { name: 'DOWNTOWN', test: (x, z) => x >= -60 && x <= 120 && z >= -120 && z <= 60 },
  { name: 'OLD TOWN', test: (x, z) => x < -60 && z < 60 },
  { name: 'MARINA', test: (x, z) => x > 100 && z >= 120 },
  { name: 'BAYFRONT BEACH', test: (x, z) => z > 170 },
  { name: 'HARBOR PARK', test: (x, z) => x >= -40 && x <= 40 && z >= 80 && z <= 160 },
  { name: 'SOUTHSHORE', test: (x, z) => z >= 60 },
  { name: 'NORTHGATE', test: (x, z) => z < -120 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d.name;
  return 'MERIDIAN BAY';
}
