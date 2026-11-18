// Pedestrians: sidewalk walkers who stroll the grid, cross at corners and
// run for cover when shooting starts or a car bears down on them.

import { CFG, PED_SHIRTS } from '../config.js';
import { buildPersonMesh } from '../player/character.js';
import { SeededRandom, clamp } from '../util/random.js';

const SKIN_TONES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const HAIR_COLORS = [0x1a1a1a, 0x4a3221, 0x8a6b3a, 0xcccccc, 0x5a3a1a];

class Pedestrian {
  constructor(G, x, z, rng) {
    this.G = G;
    this.x = x;
    this.z = z;
    this.heading = rng.range(0, Math.PI * 2);
    this.speed = 0;
    this.state = 'walk'; // walk | flee | down
    this.stateTimer = 0;
    this.walkPhase = rng.range(0, 6);
    this.retargetTimer = rng.range(2, 8);
    this.target = { x, z };
    this.mesh = buildPersonMesh(rng.pick(PED_SHIRTS), rng.pick(SKIN_TONES), rng.pick(HAIR_COLORS));
    this.mesh.position.set(x, 0, z);
    G.scene.add(this.mesh);
  }

  pickSidewalkTarget() {
    const G = this.G;
    const rng = G.peds.rng;
    // Walk along a road on its sidewalk, or cross to the next block.
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.pick(CFG.roadCoords);
    const along = rng.range(-230, 230);
    const side = rng.chance(0.5) ? 1 : -1;
    const off = 9.5 * side;
    if (axis === 'x') this.target = { x: along, z: road + off };
    else this.target = { x: road + off, z: along };
  }

  knockDown(speed) {
    if (this.state === 'down') return;
    this.state = 'down';
    this.stateTimer = 6;
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.35;
    this.G.fx.burst(this.x, 1, this.z, 0xd8d8d8, 6, 3);
    this.G.audio.yelp();
  }

  update(dt) {
    const G = this.G;
    if (this.state === 'down') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'walk';
        this.mesh.rotation.x = 0;
        this.mesh.position.y = 0;
        this.pickSidewalkTarget();
      }
      return;
    }
    // Danger check: gunfire nearby, or the player's car closing fast.
    const px = G.player.x;
    const pz = G.player.z;
    const pd = Math.hypot(px - this.x, pz - this.z);
    const playerCar = G.player.inCar;
    const danger = G.combat.shotsFiredRecently(2.5) && pd < 30
      || (playerCar && Math.abs(playerCar.speed) > 12 && pd < 14);
    if (danger && this.state !== 'flee') {
      this.state = 'flee';
      this.stateTimer = 3.5;
      this.heading = Math.atan2(this.x - px, this.z - pz);
    }
    if (this.state === 'flee') {
      this.stateTimer -= dt;
      this.speed = CFG.pedFleeSpeed;
      this.x += Math.sin(this.heading) * this.speed * dt;
      this.z += Math.cos(this.heading) * this.speed * dt;
      if (this.stateTimer <= 0) {
        this.state = 'walk';
        this.pickSidewalkTarget();
      }
    } else {
      this.retargetTimer -= dt;
      const dx = this.target.x - this.x;
      const dz = this.target.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 2 || this.retargetTimer <= 0) {
        this.pickSidewalkTarget();
        this.retargetTimer = 8;
      } else {
        const want = Math.atan2(dx, dz);
        let diff = want - this.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.heading += clamp(diff, -dt * 3, dt * 3);
        this.speed = CFG.pedWalkSpeed;
        this.x += Math.sin(this.heading) * this.speed * dt;
        this.z += Math.cos(this.heading) * this.speed * dt;
      }
    }
    this.x = clamp(this.x, -CFG.cityBound, CFG.cityBound);
    this.z = clamp(this.z, -CFG.cityBound, CFG.cityBound + 40);
    const c = G.city.collideCircle(this.x, this.z, 0.8);
    this.x = c.x;
    this.z = c.z;
    this.walkPhase += dt * this.speed * 1.6;
    this.mesh.position.set(this.x, this.mesh.position.y, this.z);
    this.mesh.rotation.y = this.heading;
    const swing = Math.min(1, this.speed / CFG.pedWalkSpeed) * 0.6;
    const s = Math.sin(this.walkPhase);
    const { legL, legR, armL, armR } = this.mesh.userData.limbs;
    legL.rotation.x = s * swing;
    legR.rotation.x = -s * swing;
    armL.rotation.x = -s * swing * 0.7;
    armR.rotation.x = s * swing * 0.7;
  }

  dispose() {
    this.G.scene.remove(this.mesh);
  }
}

export class Pedestrians {
  constructor(G) {
    this.G = G;
    this.rng = new SeededRandom(G.seed + 31);
    this.list = [];
    for (let i = 0; i < CFG.pedestrianCount; i++) {
      this.spawnPed(true);
    }
  }

  spawnPed(anywhere) {
    const G = this.G;
    const p = G.city.randomRoadPoint(this.rng);
    const side = this.rng.chance(0.5) ? 1 : -1;
    const x = p.axis === 'x' ? p.x : p.x + side * 9.5;
    const z = p.axis === 'x' ? p.z + side * 9.5 : p.z;
    if (!anywhere && Math.hypot(x - G.player.x, z - G.player.z) > 170) return;
    const ped = new Pedestrian(G, x, z, this.rng);
    ped.pickSidewalkTarget();
    this.list.push(ped);
  }

  nearest(x, z, maxD) {
    let best = null;
    let bestD = maxD * maxD;
    for (const p of this.list) {
      if (p.state === 'down') continue;
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d2 < bestD) {
        bestD = d2;
        best = p;
      }
    }
    return best;
  }

  update(dt) {
    const G = this.G;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const ped = this.list[i];
      ped.update(dt);
      if (Math.hypot(ped.x - G.player.x, ped.z - G.player.z) > 230) {
        ped.dispose();
        this.list.splice(i, 1);
      }
    }
    while (this.list.length < CFG.pedestrianCount) {
      const before = this.list.length;
      this.spawnPed(false);
      if (this.list.length === before) break;
    }
  }
}
