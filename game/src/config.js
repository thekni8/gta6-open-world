/* Meridian Bay — tuning constants, palette, and the shared game state object.
   Every other module reads/writes MB.S (state) and MB.W (live world refs). */
window.MB = window.MB || {};
(function () {
  const CFG = {
    // City layout
    worldHalf: 240,            // playable square is [-240, 240] on x and z
    roadLines: [-180, -120, -60, 0, 60, 120, 180],
    roadWidth: 13,
    beachX: 196,               // sand starts here; sea beyond x = 246
    seaX: 246,
    portZ: -196,               // port strip is z < -196
    // Player on foot
    walkSpeed: 6.5,
    sprintSpeed: 11,
    playerRadius: 0.9,
    playerMaxHealth: 100,
    // Driving (arcade)
    carAccel: 26,
    carBrake: 42,
    carMaxSpeed: 46,           // ~165 km/h
    carReverseMax: 12,
    carTurnRate: 1.9,
    carGrip: 0.92,
    handbrakeGrip: 0.55,
    // Traffic + peds
    trafficCount: 22,
    pedCount: 34,
    trafficSpeed: 11,
    pedSpeed: 1.8,
    // Wanted
    wantedMax: 5,
    heatPerStar: 100,
    heatDecayPerSec: 2.2,      // while no cop can see the player
    heatDecayHiding: 9,        // inside a lay-low zone
    stealHeat: 60,
    hitPedHeat: 45,
    hitCopHeat: 120,
    shootHeat: 30,
    killHeat: 70,
    // Combat
    pistolDamage: 34,
    pistolMag: 12,
    pistolRange: 70,
    pistolFireDelay: 0.22,
    meleeDamage: 25,
    meleeRange: 3.0,
    enemyHealth: 100,
    enemyDamage: 7,
    enemyShootRange: 42,
    // Economy
    startCash: 200,
    missionRewards: [500, 700, 900, 1200, 2500],
    // Camera
    camFootDist: 8.5,
    camFootHeight: 4.2,
    camCarDist: 10,
    camCarHeight: 4.2,
    // Save
    saveKey: 'meridian-bay-save-v6',
  };

  // Sun-soaked pastel palette for buildings, cars, and props.
  const PALETTE = {
    buildings: [0xf2c14e, 0xe88ca0, 0x7fb069, 0x6ba3b7, 0xd97b4f, 0xb5a6d6, 0x8fc1a9, 0xe5e0d0, 0xc96f6f, 0x5f8fce, 0x9db38a, 0xe0a458],
    downtown: [0x5f8fce, 0x6ba3b7, 0x8a9bb5, 0x7fb069, 0xb5a6d6, 0xd97b4f],
    oldtown: [0xe0a458, 0xc96f6f, 0xe5e0d0, 0xd97b4f, 0x9db38a],
    cars: [0xd33a2c, 0x2c6fd3, 0x2fae5f, 0xf2c14e, 0xe8e8e8, 0x222831, 0x8e44ad, 0x17a2b8, 0xff7a1a, 0x7fb069],
    shirts: [0xf2c14e, 0x2c6fd3, 0xd33a2c, 0x2fae5f, 0xe88ca0, 0xffffff, 0x222831, 0xff7a1a],
    grass: 0x69c24a,
    grassDark: 0x4da336,
    sand: 0xf2ddae,
    sea: 0x1fa8c9,
    road: 0x2b2f36,
    sidewalk: 0xb9b3a4,
    plaza: 0xcfc8b4,
  };

  // Mutable run state. Reset by MB.resetState() on New Game.
  function freshState() {
    return {
      mode: 'menu',            // menu | playing | paused | missionEnd
      missionIndex: 0,         // 0-based; 5 = story done
      cash: CFG.startCash,
      health: CFG.playerMaxHealth,
      wanted: 0,
      heat: 0,
      ammo: CFG.pistolMag,
      reserveAmmo: 60,
      freeRoam: false,
      time: 0,
      speedKmh: 0,
      inCar: false,
      carId: null,
      zone: 'DOWNTOWN',
      dead: false,
      mission: null,           // active mission runtime (see missions/manager.js)
      kills: 0,
      carsStolen: 0,
      shotsFired: 0,
      muted: false,
    };
  }

  MB.CFG = CFG;
  MB.PALETTE = PALETTE;
  MB.S = freshState();
  MB.resetState = function (keepProgress) {
    const saved = keepProgress ? { missionIndex: MB.S.missionIndex, cash: MB.S.cash } : null;
    MB.S = freshState();
    if (saved) { MB.S.missionIndex = saved.missionIndex; MB.S.cash = saved.cash; }
  };
  // Live world references, filled in by main.js and the world builders.
  MB.W = {
    scene: null, camera: null, renderer: null, clock: null,
    colliders: [],             // {minX,maxX,minZ,maxZ} building boxes
    roadCars: [],              // traffic + parked cars
    peds: [],
    cops: [],
    enemies: [],
    missionCars: {},
    playerMesh: null,
    player: null,              // {pos:Vector3, heading, vel, onFoot...}
    currentCar: null,
    beacon: null,
    minimapDirty: true,
  };
})();
