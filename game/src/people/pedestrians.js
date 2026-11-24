// Pedestrians: capsule walkers strolling the sidewalks, pausing at corners,
// and fleeing when shots ring out or a car mounts the curb.

import { CONFIG } from '../config.js';
import { makeRng } from '../util/random.js';
import { ROAD_LINES, BLOCK_CENTERS, resolveCircle } from '../world/city.js';

const SHIRTS = [0xe8c547, 0x4f7ec9, 0xc94f4f, 0x7fb069, 0xe07b39, 0x8e6cc9, 0xd9d9d9, 0x4fb0c9];

export class PedestrianManager {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.peds = [];
    this.rng = makeRng(4242);
  }

  spawn(count) {
    for (let i = 0; i < count; i++) {
      const bx = this.rng.pick(BLOCK_CENTERS);
      const bz = this.rng.pick(BLOCK_CENTERS);
      this.spawnAt(bx + this.rng.range(-22, 22), bz + this.rng.range(-22, 22));
    }
  }

  spawnAt(x, z) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: this.rng.pick(SHIRTS) });
    const pants = new THREE.MeshLambertMaterial({ color: 0x33363c });
    const skin = new THREE.MeshLambertMaterial({ color: this.rng.pick([0xc98d64, 0x8a5a3b, 0xe8b48a, 0x6b4226]) });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 4, 8), shirt);
    torso.position.y = 1.12;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
    head.position.y = 1.82;
    head.castShadow = true;
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.7, 6), pants);
    legL.position.set(-0.14, 0.38, 0);
    const legR = legL.clone();
    legR.position.x = 0.14;
    group.add(torso, head, legL, legR);
    group.position.set(x, 0, z);
    this.scene.add(group);
    const ped = {
      group, legL, legR,
      x, z,
      heading: this.rng.range(0, Math.PI * 2),
      speed: this.rng.range(1.1, 1.9),
      target: null,
      flee: 0,
      fleeDir: { x: 0, z: 0 },
      phase: this.rng.range(0, 6),
      alive: true,
    };
    this.pickTarget(ped);
    this.peds.push(ped);
    return ped;
  }

  // Pick a new sidewalk waypoint near a block edge.
  pickTarget(ped) {
    const bx = this.rng.pick(BLOCK_CENTERS);
    const bz = this.rng.pick(BLOCK_CENTERS);
    const edge = this.rng.int(0, 3);
    const t = this.rng.range(-22, 22);
    if (edge === 0) ped.target = { x: bx + t, z: bz - 24 };
    else if (edge === 1) ped.target = { x: bx + t, z: bz + 24 };
    else if (edge === 2) ped.target = { x: bx - 24, z: bz + t };
    else ped.target = { x: bx + 24, z: bz + t };
  }

  scare(point, radius = 55) {
    for (const ped of this.peds) {
      const dx = ped.x - point.x;
      const dz = ped.z - point.z;
      const d = Math.hypot(dx, dz);
      if (d < radius && d > 0.1) {
        ped.flee = 4;
        ped.fleeDir = { x: dx / d, z: dz / d };
      }
    }
  }

  update(dt) {
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      let mx = 0;
      let mz = 0;
      let speed = ped.speed;
      if (ped.flee > 0) {
        ped.flee -= dt;
        mx = ped.fleeDir.x;
        mz = ped.fleeDir.z;
        speed = 4.2;
      } else if (ped.target) {
        const dx = ped.target.x - ped.x;
        const dz = ped.target.z - ped.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) {
          this.pickTarget(ped);
        } else {
          mx = dx / d;
          mz = dz / d;
        }
      }
      if (mx !== 0 || mz !== 0) {
        ped.heading = Math.atan2(mx, mz);
        ped.group.rotation.y = ped.heading;
        ped.x += mx * speed * dt;
        ped.z += mz * speed * dt;
        const pos = ped.group.position;
        pos.x = ped.x;
        pos.z = ped.z;
        resolveCircle(pos, 0.45, this.colliders);
        ped.x = pos.x;
        ped.z = pos.z;
        ped.phase += dt * speed * 2.4;
        const swing = Math.sin(ped.phase) * 0.5;
        ped.legL.rotation.x = swing;
        ped.legR.rotation.x = -swing;
      }
      ped.x = Math.max(-330, Math.min(420, ped.x));
      ped.z = Math.max(-330, Math.min(335, ped.z));
    }
  }

  positions() {
    return this.peds.filter((p) => p.alive).map((p) => ({ x: p.x, z: p.z }));
  }

  // The nearest ped within radius, for melee / collision checks.
  nearestTo(x, z, radius) {
    let best = null;
    let bestD = radius;
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }
}
