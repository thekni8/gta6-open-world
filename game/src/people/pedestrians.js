// Pedestrians: capsule people strolling the sidewalks, chatting in place,
// and fleeing when shots ring out or a car bears down on them.
import { CONFIG } from '../config.js';

const SHIRT_COLORS = [0xe8e8e8, 0x3d7dd9, 0xd94f3d, 0x3da35d, 0xe8a33d, 0x8a5fc0, 0xef8fb0, 0x2b2f36, 0xffd166, 0x7fb8c9];
const SKIN_COLORS = [0xf2c9a0, 0xc98d5a, 0x8a5a34, 0xf7d7b5, 0xa06a3c];

export class Pedestrians {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    this.bodyGeo = new THREE.CapsuleGeometry(0.32, 0.75, 3, 8);
    this.headGeo = new THREE.SphereGeometry(0.24, 10, 8);
    this.legGeo = new THREE.BoxGeometry(0.16, 0.55, 0.2);
  }

  spawn(count) {
    for (let i = 0; i < count; i++) {
      const p = this._makePed();
      if (p) this.peds.push(p);
    }
  }

  _makePed(x = null, z = null) {
    const rng = this.rng;
    let px = x;
    let pz = z;
    if (px === null) {
      // Start on a sidewalk: just off a road line.
      const line = rng.pick(CONFIG.world.roadLines);
      const along = rng.range(-210, 210);
      if (rng.chance(0.5)) { px = along; pz = line + rng.pick([-9, 9]); }
      else { px = line + rng.pick([-9, 9]); pz = along; }
    }
    const group = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: rng.pick(SHIRT_COLORS), roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: rng.pick(SKIN_COLORS), roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: rng.pick([0x2b2f36, 0x3d5a80, 0x6b705c, 0x4a4a4a]), roughness: 0.9 });
    const body = new THREE.Mesh(this.bodyGeo, shirt);
    body.position.y = 1.05;
    body.castShadow = true;
    const head = new THREE.Mesh(this.headGeo, skin);
    head.position.y = 1.78;
    head.castShadow = true;
    const legL = new THREE.Mesh(this.legGeo, pants);
    legL.position.set(-0.14, 0.3, 0);
    const legR = new THREE.Mesh(this.legGeo, pants);
    legR.position.set(0.14, 0.3, 0);
    group.add(body, head, legL, legR);
    group.position.set(px, 0, pz);
    this.scene.add(group);
    return {
      group, legL, legR,
      pos: new THREE.Vector3(px, 0, pz),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 1.9),
      target: this._newTarget(px, pz),
      state: 'walk', // walk | flee | down
      health: 100,
      fleeTimer: 0,
      walkPhase: rng.range(0, Math.PI * 2),
      isEnemy: false,
    };
  }

  _newTarget(x, z) {
    // Pick a nearby sidewalk point: walk along the current road, then turn.
    const line = this.city.nearestRoadPoint(x, z);
    const side = this.rng.pick([-9, 9]);
    if (line.axis === 'x') {
      return { x: x + this.rng.range(-70, 70), z: line.z + side };
    }
    return { x: line.x + side, z: z + this.rng.range(-70, 70) };
  }

  // Everyone near a disturbance runs away from it.
  scare(x, z, radius = 40) {
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < radius) {
        p.state = 'flee';
        p.fleeTimer = 3 + Math.random() * 2;
        const a = Math.atan2(p.pos.x - x, p.pos.z - z);
        p.target = {
          x: p.pos.x + Math.sin(a) * 40,
          z: p.pos.z + Math.cos(a) * 40,
        };
      }
    }
  }

  update(dt, game) {
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      if (p.state === 'flee') {
        p.fleeTimer -= dt;
        if (p.fleeTimer <= 0) {
          p.state = 'walk';
          p.target = this._newTarget(p.pos.x, p.pos.z);
        }
      }
      const dx = p.target.x - p.pos.x;
      const dz = p.target.z - p.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        p.target = this._newTarget(p.pos.x, p.pos.z);
        continue;
      }
      const targetAngle = Math.atan2(dx, dz);
      let diff = targetAngle - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
      const speed = p.state === 'flee' ? p.speed * 2.6 : p.speed;
      const prevX = p.pos.x;
      const prevZ = p.pos.z;
      p.pos.x += Math.sin(p.angle) * speed * dt;
      p.pos.z += Math.cos(p.angle) * speed * dt;
      if (this.city.collideCircle(p.pos, 0.5)) {
        // Bumped into a building: pick a new target instead of hugging walls.
        p.pos.x = prevX;
        p.pos.z = prevZ;
        p.target = this._newTarget(p.pos.x, p.pos.z);
      }
      p.group.position.copy(p.pos);
      p.group.rotation.y = p.angle;
      // Walk-cycle leg swing.
      p.walkPhase += dt * speed * 4.2;
      const swing = Math.sin(p.walkPhase) * 0.55;
      p.legL.rotation.x = swing;
      p.legR.rotation.x = -swing;
      // A car bearing down scatters pedestrians.
      if (p.state !== 'flee' && game.player.inCar && game.player.car) {
        const car = game.player.car;
        if (Math.abs(car.speed) > 6 && Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z) < 9) {
          this.scare(car.pos.x, car.pos.z, 12);
        }
      }
    }
  }

  // Damage a pedestrian (shot or run over). Returns true if they went down.
  hit(ped, damage, game) {
    ped.health -= damage;
    if (ped.health <= 0 && ped.state !== 'down') {
      ped.state = 'down';
      ped.group.rotation.x = -Math.PI / 2;
      ped.group.position.y = 0.35;
      return true;
    }
    return false;
  }

  nearest(x, z, maxDist, { enemiesOnly = false } = {}) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      if (enemiesOnly && !p.isEnemy) continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
}
