// Meridian Bay — the city. A 7x7 road grid with five districts (downtown towers,
// old town, marina, beachfront strip, industrial port), a sand beach and the sea.
// Builds the Three.js meshes once and hands back the colliders, the road graph
// and the named places the missions and traffic use.
import * as THREE from 'three';
import { CITY, COLORS } from '../config.js';

const ROAD_CENTERS = [-222, -148, -74, 0, 74, 148, 222];
const BLOCK_CENTERS = [-259, -185, -111, -37, 37, 111, 185, 259];

/** Push a circle (x, z, radius) out of every building AABB it overlaps. */
export function resolveCircle(pos, radius, colliders) {
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: shove out along the smallest penetration axis.
        const px = Math.min(pos.x - c.minX, c.maxX - pos.x);
        const pz = Math.min(pos.z - c.minZ, c.maxZ - pos.z);
        if (px < pz) pos.x = pos.x - c.minX < c.maxX - pos.x ? c.minX - radius : c.maxX + radius;
        else pos.z = pos.z - c.minZ < c.maxZ - pos.z ? c.minZ - radius : c.maxZ + radius;
      }
    }
  }
}

/** True when the point is on a road (not inside a block). */
export function onRoad(x, z) {
  const half = CITY.roadWidth / 2 + 1;
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) < half || Math.abs(z - c) < half) return true;
  }
  return false;
}

function box(w, h, d, color, x, y, z, parent) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = h > 4;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground: grass-green base, then road and sidewalk slabs on top of it.
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(CITY.groundSize + 140, 1, CITY.groundSize),
    new THREE.MeshLambertMaterial({ color: COLORS.grass }),
  );
  ground.position.set(40, -0.5, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: dark strips along every grid line, plus a pale sidewalk border.
  const roadMat = new THREE.MeshLambertMaterial({ color: COLORS.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
  const span = 540;
  for (const c of ROAD_CENTERS) {
    const vRoad = new THREE.Mesh(new THREE.BoxGeometry(CITY.roadWidth, 0.2, span), roadMat);
    vRoad.position.set(c, 0.1, 0);
    vRoad.receiveShadow = true;
    group.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.BoxGeometry(span, 0.2, CITY.roadWidth), roadMat);
    hRoad.position.set(0, 0.1, c);
    hRoad.receiveShadow = true;
    group.add(hRoad);
    const vWalk = new THREE.Mesh(new THREE.BoxGeometry(CITY.roadWidth + 6, 0.12, span), walkMat);
    vWalk.position.set(c, 0.05, 0);
    group.add(vWalk);
    const hWalk = new THREE.Mesh(new THREE.BoxGeometry(span, 0.12, CITY.roadWidth + 6), walkMat);
    hWalk.position.set(0, 0.05, c);
    group.add(hWalk);
  }
  // Centre dashes on the roads, so the streets read as streets from above.
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  for (const c of ROAD_CENTERS) {
    for (let t = -260; t <= 260; t += 16) {
      const dv = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 5), dashMat);
      dv.position.set(c, 0.22, t);
      group.add(dv);
      const dh = new THREE.Mesh(new THREE.BoxGeometry(5, 0.05, 0.7), dashMat);
      dh.position.set(t, 0.22, c);
      group.add(dh);
    }
  }

  // Beach sand, boardwalk and the sea to the east.
  const sand = new THREE.Mesh(
    new THREE.BoxGeometry(66, 0.3, CITY.groundSize),
    new THREE.MeshLambertMaterial({ color: COLORS.sand }),
  );
  sand.position.set(316, 0.15, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.BoxGeometry(300, 0.3, CITY.groundSize + 200),
    new THREE.MeshLambertMaterial({ color: COLORS.sea }),
  );
  sea.position.set(500, 0.1, 0);
  group.add(sea);
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.4, CITY.groundSize),
    new THREE.MeshLambertMaterial({ color: 0xb98a5e }),
  );
  boardwalk.position.set(285, 0.2, 0);
  group.add(boardwalk);

  // Palm trees along the beachfront strip.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (let z = -250; z <= 250; z += 34) {
    const x = 296 + rng.range(-3, 3);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3, 7), leafMat);
    crown.position.set(x, 8.2, z);
    crown.castShadow = true;
    group.add(crown);
  }

  // Buildings, one or two per block, taller downtown, low and pastel in old town.
  const windowMat = new THREE.MeshLambertMaterial({ color: 0x2a3542 });
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const isPort = bz >= 185 && bx <= -111;
      const isDowntown = Math.abs(bx) <= 111 && Math.abs(bz) <= 111;
      if (isPort) continue; // the port gets containers, not buildings
      const color = rng.pick(COLORS.buildingPalette);
      const tall = isDowntown ? rng.range(16, 42) : rng.range(6, 16);
      const w = rng.range(24, 40);
      const d = rng.range(24, 40);
      const x = bx + rng.range(-6, 6);
      const z = bz + rng.range(-6, 6);
      box(w, tall, d, color, x, tall / 2, z, group);
      // Roof cap and a lit window band, so blocks read at dusk.
      box(w * 0.7, 1.2, d * 0.7, 0x5a5a5a, x, tall + 0.6, z, group);
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.2, Math.min(2.5, tall * 0.25), d + 0.2),
        windowMat,
      );
      band.position.set(x, tall * 0.62, z);
      group.add(band);
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      if (rng.chance(0.45)) {
        const w2 = rng.range(12, 20);
        const d2 = rng.range(12, 20);
        const x2 = bx + rng.range(-16, 16);
        const z2 = bz + rng.range(-16, 16);
        if (Math.abs(x2 - x) > (w + w2) / 2 + 2 || Math.abs(z2 - z) > (d + d2) / 2 + 2) {
          const h2 = rng.range(4, 9);
          box(w2, h2, d2, rng.pick(COLORS.buildingPalette), x2, h2 / 2, z2, group);
          colliders.push({ minX: x2 - w2 / 2, maxX: x2 + w2 / 2, minZ: z2 - d2 / 2, maxZ: z2 + d2 / 2 });
        }
      }
    }
  }

  // The industrial port: stacked shipping containers in the south-west corner.
  const containerColors = [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xd86a1e];
  for (let ix = 0; ix < 4; ix += 1) {
    for (let iz = 0; iz < 3; iz += 1) {
      const x = -259 + ix * 34;
      const z = 203 + iz * 30;
      const stack = rng.int(1, 2);
      for (let s = 0; s < stack; s += 1) {
        box(26, 7, 9, containerColors[(ix + iz + s) % containerColors.length], x, 3.5 + s * 7, z, group);
      }
      colliders.push({ minX: x - 13, maxX: x + 13, minZ: z - 4.5, maxZ: z + 4.5 });
    }
  }

  // Street lamps along the main avenues.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const c of [-148, 0, 148]) {
    for (let t = -240; t <= 240; t += 74) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6), lampMat);
      pole.position.set(c + 10.5, 3, t + 37);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), bulbMat);
      bulb.position.set(c + 10.5, 6.2, t + 37);
      group.add(bulb);
    }
  }

  // Marina: wooden piers and moored boats at the north-east shore.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  for (const pz of [-190, -150]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 6), pierMat);
    pier.position.set(330, 0.4, pz);
    group.add(pier);
  }
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  for (const [bx, bz] of [[322, -176], [330, -138], [318, -205]]) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 2, 3.4), boatMat);
    hull.position.set(bx, 1, bz);
    hull.castShadow = true;
    group.add(hull);
  }

  return {
    colliders,
    roadCenters: ROAD_CENTERS,
    blockCenters: BLOCK_CENTERS,
    places: {
      playerStart: { x: 0, z: 120 },
      taxiStand: { x: 74, z: 74 },
      marina: { x: 300, z: -170 },
      downtown: { x: 0, z: 0 },
      oldTown: { x: -185, z: -37 },
      beachfront: { x: 300, z: 120 },
      port: { x: -185, z: 220 },
      garage: { x: -148, z: 148 },
      stealSpot: { x: -185, z: -37 },
      kingsGarage: { x: -148, z: 222 },
      nightclub: { x: 148, z: -74 },
      safehouse: { x: -37, z: 185 },
    },
    // Lay low here (the beach) and the heat fades faster.
    layLowZone: { minX: 283, maxX: 620, minZ: -310, maxZ: 310 },
  };
}
