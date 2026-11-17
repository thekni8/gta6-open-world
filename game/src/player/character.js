// Kai Mercer on foot — movement, simple walk animation, health and the
// low-poly character mesh (jacket, head, legs that swing as he walks).
import * as THREE from 'three';
import { PLAYER } from '../config.js';
import { clamp, moveToward } from '../util/random.js';
import { resolveCircle } from '../world/city.js';

export function createCharacter(scene) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6fc2 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), jacket);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skin);
  head.position.y = 1.95;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.6), new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
  cap.position.y = 2.26;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 0.36), pants);
  legL.position.set(-0.22, 0.4, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.22;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.3), jacket);
  armL.position.set(-0.6, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.6;
  group.add(armR);
  scene.add(group);

  const state = {
    group,
    pos: new THREE.Vector3(0, 0, 120),
    heading: 0,
    speed: 0,
    health: PLAYER.maxHealth,
    walkPhase: 0,
    legL,
    legR,
    armL,
    armR,
  };
  group.position.copy(state.pos);
  return state;
}

/**
 * Move Kai on foot. `move` is {x, z} in world space (camera-relative input),
 * already normalised; returns nothing, updates the mesh in place.
 */
export function updateCharacter(player, move, sprint, dt, colliders, cars) {
  const targetSpeed = move.x === 0 && move.z === 0 ? 0 : sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  player.speed = moveToward(player.speed, targetSpeed, 30 * dt);
  if (player.speed > 0.1) {
    const len = Math.hypot(move.x, move.z) || 1;
    const mx = (move.x / len) * player.speed * dt;
    const mz = (move.z / len) * player.speed * dt;
    player.pos.x += mx;
    player.pos.z += mz;
    player.heading = Math.atan2(mx, mz);
    player.walkPhase += dt * player.speed * 1.6;
    const swing = Math.sin(player.walkPhase) * 0.6;
    player.legL.rotation.x = swing;
    player.legR.rotation.x = -swing;
    player.armL.rotation.x = -swing * 0.8;
    player.armR.rotation.x = swing * 0.8;
  } else {
    player.legL.rotation.x *= 0.8;
    player.legR.rotation.x *= 0.8;
    player.armL.rotation.x *= 0.8;
    player.armR.rotation.x *= 0.8;
  }
  player.pos.x = clamp(player.pos.x, -280, 340);
  player.pos.z = clamp(player.pos.z, -280, 280);
  resolveCircle(player.pos, PLAYER.radius, colliders);
  // Soft push-out from parked and driven cars.
  for (const car of cars) {
    const dx = player.pos.x - car.pos.x;
    const dz = player.pos.z - car.pos.z;
    const d = Math.hypot(dx, dz);
    const min = 1.9;
    if (d < min && d > 0.001) {
      player.pos.x = car.pos.x + (dx / d) * min;
      player.pos.z = car.pos.z + (dz / d) * min;
    }
  }
  player.group.position.copy(player.pos);
  player.group.rotation.y = player.heading;
}

/** Deal damage to Kai; returns true when he goes down. */
export function hurtPlayer(player, amount) {
  player.health = Math.max(0, player.health - amount);
  return player.health <= 0;
}
