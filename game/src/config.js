// Meridian Bay — tuning constants. One place for every number the rest of
// the game balances against: world size, speeds, wanted heat, rewards.
export const CONFIG = {
  world: {
    half: 240,            // city ground spans -240..240 on x and z
    roadSpacing: 56,
    roadWidth: 12,
    roadLines: [-196, -140, -84, -28, 28, 84, 140, 196],
    blockHalf: 22,        // buildings live inside blocks between roads
    seaStart: 240,        // z beyond this is open water
    beachStart: 196,      // z beyond this is sand
    portEdge: -196,       // x below this is the industrial port strip
    marinaEdge: 196,      // x above this is the marina strip
  },
  palette: {
    // pastel sun-soaked building colours, cycled with a seeded shuffle
    buildings: [0xf2e3c6, 0xf6c9a0, 0xf2a65a, 0xe98d7a, 0xd98cb3, 0x9fc6e8, 0x8fd0c2, 0xb5d99c, 0xf7e08b, 0xcbb7e8, 0xf5f0e6, 0xe8b4b8],
    downtown: [0x9fc6e8, 0xb8cfe0, 0x8fb8d8, 0xd8c9a8, 0xc9d6e3],
    road: 0x484d55,
    sidewalk: 0xcfc8b8,
    grass: 0x6fbf5a,
    sand: 0xf0dca8,
    sea: 0x2fa8c9,
    seaDeep: 0x1b7fa8,
  },
  player: {
    walkSpeed: 6.5,
    sprintSpeed: 10.5,
    radius: 0.7,
    maxHealth: 100,
    punchDamage: 15,
    punchRange: 2.2,
    pistolDamage: 34,
    pistolAmmo: 12,
    pistolReserve: 48,
    pistolRange: 90,
  },
  car: {
    playerMaxSpeed: 40,
    playerAccel: 22,
    playerBrake: 34,
    playerReverseMax: 12,
    trafficSpeed: 11,
    policeMaxSpeed: 46,
    radius: 1.9,
    maxHealth: 100,
  },
  wanted: {
    // heat points per crime; stars are heat bands
    stealCar: 25,
    hitPedestrian: 30,
    hitPolice: 45,
    shootWitnessed: 20,
    killPedestrian: 40,
    starBands: [0, 20, 45, 70, 95, 120], // heat needed for stars 0..5
    decayPerSecond: 1.6,   // while unseen by police
    hideoutDecay: 14,      // per second inside the park hideout
    seenRadius: 55,        // police "see" the player inside this range
    bustRadius: 3.2,       // police car touching a slow on-foot player
    bustSeconds: 1.6,
  },
  police: {
    carsPerStar: [0, 1, 2, 3, 4, 5],
    roadblockAtStars: 4,
    spawnDistance: 70,
    ramDamage: 8,
  },
  missions: {
    rewards: [500, 800, 1200, 2000, 5000],
    failPenalty: 0,
  },
  hud: {
    minimapSize: 248,      // big and bright: legible at contact-sheet size
  },
  saveKey: 'meridian-bay-save-v1',
};

export const DISTRICTS = [
  { name: 'DOWNTOWN', x0: -84, x1: 84, z0: -84, z1: 84 },
  { name: 'OLD TOWN', x0: -240, x1: -84, z0: -240, z1: -28 },
  { name: 'BAYFRONT BEACH', x0: -196, x1: 196, z0: 168, z1: 240 },
  { name: 'MERIDIAN PORT', x0: -240, x1: -168, z0: -28, z1: 196 },
  { name: 'MARINA', x0: 168, x1: 240, z0: -84, z1: 196 },
  { name: 'PALM PARK', x0: 28, x1: 140, z0: 84, z1: 168 },
  { name: 'NORTHSIDE', x0: -84, x1: 240, z0: -240, z1: -84 },
  { name: 'HARBOUR VIEW', x0: -168, x1: 28, z0: 84, z1: 168 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'MERIDIAN BAY';
}
