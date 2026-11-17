// Pedestrians — capsule people who stroll the sidewalks, cross at corners,
// and flee screaming when violence breaks out nearby.
import * as THREE from 'three';
import { PEDS } from '../config.js';
import { clamp } from '../util/random.js';
import { resolveCircle, onRoad } from '../world/city.js';

const SHIRT_COLORS = [0xe86a5a, 0x5a9e6f, 0xe8c832, 0x8a6fc2, 0xe8e8e8, 0x3a3f46, 0xd98a7a, 0x6fb8d8];

export function createPedestrians(scene, rng, roadCenters) {
  const peds = [];
  const bodyGeo = new THREE.CapsuleGeometry(0.42, 0.85, 3, 8);
  for (let i = 0; i < PEDS.count; i += 1) {
    const mat = new THREE.MeshLambertMaterial({ color: SHIRT_COLORS[i % SHIRT_COLORS.length] });
    const mesh = new THREE.Mesh(bodyGeo, mat);
    mesh.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd9a077 }),
    );
    head.position.y = 0.95;
    mesh.add(head);
    const x = rng.range(-250, 250);
    const z = rng.range(-250, 250);
    mesh.position.set(x, 1.0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: rng.range(0, Math.PI * 2),
      speed: 0,
      target: null,
      fleeing: false,
      fleeTimer: 0,
      health: 100,
      dead: false,
      panic: 0,
    });
  }
  return peds;
}

/** Pick a sidewalk waypoint: a nearby intersection corner. */
function pickTarget(ped, rng) {
  const step = 74;
  const nx = ped.pos.x + (rng.chance(0.5) ? step : -step) * (rng.chance(0.5) ? 1 : 0);
  const nz = ped.pos.z + (rng.chance(0.5) ? step : -step);
  return { x: clamp(nx, -260, 270), z: clamp(nz, -260, 260) };
}

export function updatePedestrians(peds, playerPos, threatPos, dt, colliders, rng) {
  for (const ped of peds) {
    if (ped.dead) continue;
    const dxp = ped.pos.x - playerPos.x;
    const dzp = ped.pos.z - playerPos.z;
    const distPlayer = Math.hypot(dxp, dzp);
    // Flee when the player is violent nearby, or a threat (gunfire) is close.
    const threatNear = threatPos && Math.hypot(ped.pos.x - threatPos.x, ped.pos.z - threatPos.z) < 26;
    if ((distPlayer < 6 && ped.panic > 0.3) || threatNear) {
      ped.fleeing = true;
      ped.fleeTimer = 2.5;
    }
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) ped.fleeing = false;
    }
    const speed = ped.fleeing ? PEDS.fleeSpeed : PEDS.walkSpeed;
    if (!ped.target || Math.hypot(ped.target.x - ped.pos.x, ped.target.z - ped.pos.z) < 2) {
      ped.target = pickTarget(ped, rng);
    }
    let tx = ped.target.x;
    let tz = ped.target.z;
    if (ped.fleeing) {
      // Run away from the player, staying on the sidewalks where possible.
      const away = Math.atan2(dxp, dzp);
      tx = ped.pos.x + Math.sin(away) * 30;
      tz = ped.pos.z + Math.cos(away) * 30;
    }
    const dx = tx - ped.pos.x;
    const dz = tz - ped.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.1) {
      const want = Math.atan2(dx, dz);
      let diff = want - ped.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.heading += clamp(diff, -3 * dt, 3 * dt);
      ped.pos.x += Math.sin(ped.heading) * speed * dt;
      ped.pos.z += Math.cos(ped.heading) * speed * dt;
    }
    ped.pos.x = clamp(ped.pos.x, -275, 300);
    ped.pos.z = clamp(ped.pos.z, -275, 275);
    resolveCircle(ped.pos, 0.5, colliders);
    ped.mesh.position.set(ped.pos.x, 1.0 + Math.abs(Math.sin(performance.now() * 0.006 + ped.heading)) * 0.06, ped.pos.z);
    ped.mesh.rotation.y = ped.heading;
    ped.panic = Math.max(0, ped.panic - dt * 0.2);
  }
}

/** Scare every pedestrian near a point (gunshots, crashes). */
export function scarePedestrians(peds, x, z, radius) {
  for (const ped of peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) {
      ped.panic = 1;
      ped.fleeing = true;
      ped.fleeTimer = 3;
    }
  }
}
