// Meridian Bay — tuning constants and world layout.
// One place for every number the rest of the game shares, so balancing
// never means hunting through gameplay code.

export const CFG = {
  // World layout: a 9x9 road grid, roads every 60 units, road half-width 7.
  roadSpacing: 60,
  roadHalfWidth: 7,
  roadCoords: [-240, -180, -120, -60, 0, 60, 120, 180, 240],
  cityBound: 270,
  beachStart: 232,
  seaStart: 300,

  // Player on foot.
  walkSpeed: 6.5,
  sprintSpeed: 10.5,
  playerRadius: 0.9,
  playerHealth: 100,
  healthRegenDelay: 5,
  healthRegenRate: 6,

  // Driving (arcade physics, units per second).
  carAccel: 16,
  carBrake: 30,
  carMaxSpeed: 38,
  carMaxReverse: 11,
  carDrag: 0.55,
  carGrip: 7.5,
  handbrakeDecel: 22,
  carRadius: 2.3,
  trafficSpeed: 13,
  trafficCount: 16,
  policeTopSpeed: 44,

  // Wanted level: heat 0..100 maps to stars at these thresholds.
  starThresholds: [10, 30, 50, 70, 90],
  heatDecayPerSecond: 3.5,
  heatDecayDelay: 6,
  crimeHeat: {
    stealCar: 22,
    hitPedestrian: 18,
    hurtPedestrian: 30,
    shootNearPolice: 14,
    ramPoliceCar: 16,
    hurtPolice: 40,
    killEnemy: 0,
  },
  policeTargetByStars: [0, 2, 3, 4, 6, 8],
  roadblockStars: 4,
  bustedRange: 11,
  bustedSeconds: 3,

  // Combat.
  pistolDamage: 34,
  pistolRange: 90,
  pistolAmmo: 12,
  pistolReloadSeconds: 1.4,
  pistolFireInterval: 0.22,
  meleeDamage: 25,
  meleeRange: 2.6,
  enemyHealth: 60,
  enemyDamage: 9,
  enemyShootInterval: 1.9,
  enemyAggroRange: 45,

  // People.
  pedestrianCount: 26,
  pedWalkSpeed: 2.2,
  pedFleeSpeed: 6.5,

  // Economy.
  startingCash: 250,
  deathFine: 120,
  bustedFine: 200,
  missionRewards: [500, 800, 1200, 1800, 3000],

  // Rendering.
  shadowMapSize: 2048,
  shadowRadius: 130,
  fogNear: 170,
  fogFar: 520,
  skyColor: 0x8fc7e8,
  sunColor: 0xffd9a3,
  sunIntensity: 2.6,
  hemiSky: 0xbfe3ff,
  hemiGround: 0x8a7a66,

  saveKey: 'meridian-bay-save-v1',
};

// Named places the missions, HUD and minimap all agree on.
export const LANDMARKS = {
  // Landmarks sit on roads or road edges, never inside a block: a player
  // teleported to one must not land inside a building and get shoved out.
  safehouse: { x: -180, z: -210, name: 'Kai\'s Safehouse' },
  garage: { x: 210, z: 120, name: 'Harbor Kings Garage' },
  sprayShop: { x: 60, z: -210, name: 'Spray & Lay Low' },
  port: { x: 225, z: 60, name: 'Meridian Port' },
  downtown: { x: 0, z: 0, name: 'Downtown' },
  marina: { x: -210, z: -150, name: 'Marina Club' },
  beach: { x: 0, z: 240, name: 'Bayfront Beach' },
  plaza: { x: 0, z: 60, name: 'Meridian Plaza' },
};

// District names shown on the HUD as the player moves around.
export function districtAt(x, z) {
  if (z > CFG.beachStart) return 'Bayfront Beach';
  if (x > 180) return 'Meridian Port';
  if (x < -180 && z < -60) return 'Marina District';
  if (Math.abs(x) < 120 && Math.abs(z) < 120) return 'Downtown';
  if (z < -180) return 'Old Town North';
  if (x < -120) return 'Westside';
  return 'Old Town';
}

// Pastel building palettes per district, so each area reads differently.
export const PALETTES = {
  downtown: [0x9fb4c7, 0xb7c4ce, 0x8fa8bd, 0xc9b8a3, 0xa8b8a0, 0xd8cdbd],
  oldtown: [0xe8c9a0, 0xd9a08c, 0xc9d6c0, 0xe0d3b8, 0xb8c9d9, 0xd9b8c4],
  marina: [0xf2e3c9, 0xc9e0e8, 0xe8d3c0, 0xd9e8d3, 0xf0d9b8],
  port: [0xb8a894, 0x9a938a, 0xc0b49a, 0x8a9aa8],
};

export const CAR_COLORS = [
  0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0xe67e22, 0x8e44ad,
  0xecf0f1, 0x2c3e50, 0x1abc9c, 0xd35400, 0x7f8c8d, 0xfd79a8,
];

export const PED_SHIRTS = [
  0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6,
  0x1abc9c, 0xe67e22, 0xfd79a8, 0x95a5a6, 0x2d3436,
];
