// Pedestrians: capsule people walking the sidewalks, chatting in place,
// fleeing when shots ring out or a car comes at them. They make the city
// feel alive — and hitting one is a crime the police notice.
import { CFG } from '../config.js';
import { makeRng } from '../util/random.js';
import { buildCharacterMesh } from '../player/character.js';

export function createPedestrians(scene, city, rngSeed = 4242) {
  const rng = makeRng(rngSeed);
  const peds = [];

  function sidewalkPoint() {
    const p = city.randomRoadPoint(rng);
    const alongX = rng.chance(0.5);
    if (alongX) return { x: p.x, z: Math.round(p.z / 40) * 40 + rng.pick([-9.5, 9.5]) };
    return { x: Math.round(p.x / 40) * 40 + rng.pick([-9.5, 9.5]), z: p.z };
  }

  function spawnPed() {
    const p = sidewalkPoint();
    const mesh = buildCharacterMesh(rng.pick(CFG.pedShirts), rng.pick([0xc98a5a, 0x8a5a3a, 0xe8b88a, 0x6a4530]));
    mesh.scale.setScalar(rng.range(0.92, 1.06));
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    const ped = {
      mesh, x: p.x, z: p.z,
      heading: rng.range(0, Math.PI * 2),
      target: sidewalkPoint(),
      speed: CFG.pedWalk * rng.range(0.8, 1.3),
      phase: rng.range(0, Math.PI * 2),
      state: 'walk', // walk | flee | down
      fleeT: 0,
      downT: 0,
    };
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < CFG.pedCount; i++) spawnPed();

  function fleeFrom(x, z, radius) {
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeT = rng.range(2.5, 5);
        ped.heading = Math.atan2(ped.x - x, ped.z - z) + rng.range(-0.5, 0.5);
      }
    }
  }

  return {
    peds,
    fleeFrom,
    // A car hit: the ped goes down, then gets up and runs.
    knockDown(ped) {
      if (ped.state === 'down') return;
      ped.state = 'down';
      ped.downT = 2.2;
      ped.mesh.rotation.x = Math.PI / 2;
      ped.mesh.position.y = 0.3;
    },
    update(dt) {
      for (const ped of peds) {
        if (ped.state === 'down') {
          ped.downT -= dt;
          if (ped.downT <= 0) {
            ped.state = 'flee';
            ped.fleeT = 4;
            ped.mesh.rotation.x = 0;
            ped.mesh.position.y = 0;
            ped.heading = rng.range(0, Math.PI * 2);
          }
          continue;
        }
        let speed = ped.speed;
        if (ped.state === 'flee') {
          speed = CFG.pedFlee;
          ped.fleeT -= dt;
          if (ped.fleeT <= 0) { ped.state = 'walk'; ped.target = sidewalkPoint(); }
        } else {
          const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.5) { ped.target = sidewalkPoint(); continue; }
          ped.heading = Math.atan2(dx, dz);
        }
        const nx = ped.x + Math.sin(ped.heading) * speed * dt;
        const nz = ped.z + Math.cos(ped.heading) * speed * dt;
        const fixed = city.resolveCircle(nx, nz, 0.7);
        ped.x = fixed.x; ped.z = fixed.z;
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.heading;
        ped.phase += dt * (ped.state === 'flee' ? 14 : 8);
        const s = Math.sin(ped.phase);
        ped.mesh.userData.legL.rotation.x = s * 0.5;
        ped.mesh.userData.legR.rotation.x = -s * 0.5;
        ped.mesh.userData.armL.rotation.x = -s * 0.35;
        ped.mesh.userData.armR.rotation.x = s * 0.35;
      }
    },
  };
}
