// Pedestrians: figures strolling the sidewalks, turning at corners, and
// fleeing when the player shoots, speeds past, or runs one down. Hitting
// one is a crime — the wanted system is watching.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { range, choice } from '../util/random.js';

const SHIRTS = [0xd95f4b, 0x4b8fd9, 0x6abf6a, 0xd9c24b, 0x9b59b6, 0xe8e8e8, 0x34495e, 0xe67e22];
const PANTS = [0x2a3550, 0x4a4a4a, 0x6a4a2a, 0x2a2a2a];
const SKINS = [0xc98d64, 0x8a5a3a, 0xe8b890, 0x6a4a2a];
const HEADINGS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export class Pedestrians {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    this.onHit = null; // (ped) => {} — wired by main for wanted + effects
    for (let i = 0; i < CONFIG.crowd.pedestrians; i++) this.spawnPed();
  }

  makeFigure() {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: choice(this.rng, SHIRTS) });
    const pants = new THREE.MeshLambertMaterial({ color: choice(this.rng, PANTS) });
    const skin = new THREE.MeshLambertMaterial({ color: choice(this.rng, SKINS) });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), shirt);
    torso.position.y = 1.2;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.24), pants);
    legL.position.set(-0.16, 0.4, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.16;
    group.add(legR);
    group.userData = { legL, legR };
    return group;
  }

  spawnPed(at) {
    // Sidewalk: just off a road centre line, on a block edge.
    const p = at ?? this.city.randomRoadPoint();
    const road = this.city.nearestRoad(p.x, p.z);
    const side = this.rng() < 0.5 ? 9.5 : -9.5;
    const onXRoad = Math.abs(road.x - p.x) < Math.abs(road.z - p.z);
    const x = onXRoad ? road.x + side : p.x;
    const z = onXRoad ? p.z : road.z + side;
    const mesh = this.makeFigure();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const ped = {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: choice(this.rng, HEADINGS),
      speed: range(this.rng, CONFIG.crowd.pedWalkMin, CONFIG.crowd.pedWalkMax),
      phase: this.rng() * 10,
      state: 'walk', // walk | flee | down
      downTimer: 0,
      fleeTimer: 0,
    };
    mesh.userData.ped = ped;
    this.peds.push(ped);
    return ped;
  }

  /** Flee from a point (gunfire, a speeding car). */
  scare(x, z, radius = 22) {
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeTimer = range(this.rng, 2, 4);
        ped.heading = Math.atan2(ped.pos.x - x, ped.pos.z - z);
      }
    }
  }

  /** Knock a pedestrian down (car hit or bullet). */
  knockDown(ped) {
    ped.state = 'down';
    ped.downTimer = 6;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.35;
    return ped;
  }

  update(dt, player, playerCar) {
    for (const ped of this.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'walk';
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
        }
        continue;
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
      }
      const speed = ped.state === 'flee' ? ped.speed * 2.6 : ped.speed;
      // Turn at corners sometimes; fleeing peds run straight.
      if (ped.state === 'walk' && this.rng() < dt * 0.25) {
        ped.heading = choice(this.rng, HEADINGS);
      }
      ped.pos.x += Math.sin(ped.heading) * speed * dt;
      ped.pos.z += Math.cos(ped.heading) * speed * dt;
      this.city.collideCircle(ped.pos, 0.5);
      ped.mesh.position.copy(ped.pos);
      ped.mesh.rotation.y = ped.heading;
      ped.phase += dt * speed * 3;
      const swing = Math.sin(ped.phase) * 0.4;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      // Keep peds inside the city.
      if (Math.abs(ped.pos.x) > 300 || Math.abs(ped.pos.z) > 300) {
        const p = this.city.randomRoadPoint();
        ped.pos.set(p.x, 0, p.z);
      }
      // Collision with the player's car: knock down, report the crime.
      if (playerCar && Math.abs(playerCar.speed) > 3) {
        const d = Math.hypot(ped.pos.x - playerCar.pos.x, ped.pos.z - playerCar.pos.z);
        if (d < 2.2) {
          this.knockDown(ped);
          this.onHit?.(ped);
        }
      }
    }
    while (this.peds.length < CONFIG.crowd.pedestrians) this.spawnPed();
  }
}
