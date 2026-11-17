// Meridian Bay itself: a deterministic grid city — downtown towers in the
// middle, old-town streets around them, a beach and marina on the west
// shore, and the container port on the east edge. Buildings are low-poly
// boxes with canvas-painted window facades; every solid also registers an
// AABB the cars and the player collide with.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { range, int, pick, shuffle } from '../util/random.js';

const P = CONFIG.palette;
const C = CONFIG.city;

function facadeTexture(base, floors, cols, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  // Subtle vertical shading so faces read as separate slabs.
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 0, 4, 128);
  g.fillRect(60, 0, 4, 128);
  const cw = 64 / cols;
  const ch = 128 / floors;
  for (let r = 0; r < floors; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() < 0.35;
      g.fillStyle = lit ? '#ffe9a8' : '#2a3542';
      g.fillRect(c * cw + 2, r * ch + 3, cw - 4, ch - 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const buildings = []; // {minX,maxX,minZ,maxZ,h} collision boxes
  const roadCoords = [];
  for (let k = -4; k <= 4; k++) roadCoords.push(k * C.pitch);

  // ---- ground: grass base, sand strip, sea
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 1100),
    new THREE.MeshLambertMaterial({ color: P.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 640),
    new THREE.MeshLambertMaterial({ color: P.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(C.beachX - 6, 0.02, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 700),
    new THREE.MeshLambertMaterial({ color: P.sea, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(C.seaX - 160, 0.0, 0);
  group.add(sea);

  // ---- roads: dark strips + dashed centre lines
  const roadMat = new THREE.MeshLambertMaterial({ color: P.road });
  const dashMat = new THREE.MeshLambertMaterial({ color: P.roadLine });
  for (const c of roadCoords) {
    const stripX = new THREE.Mesh(new THREE.PlaneGeometry(620, C.roadWidth), roadMat);
    stripX.rotation.x = -Math.PI / 2;
    stripX.position.set(0, 0.05, c);
    stripX.receiveShadow = true;
    group.add(stripX);
    const stripZ = new THREE.Mesh(new THREE.PlaneGeometry(C.roadWidth, 620), roadMat);
    stripZ.rotation.x = -Math.PI / 2;
    stripZ.position.set(c, 0.05, 0);
    stripZ.receiveShadow = true;
    group.add(stripZ);
    // Centre dashes along both axes.
    for (let t = -300; t < 300; t += 12) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), dashMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(c, 0.08, t);
      group.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 4), dashMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(t, 0.08, c);
      group.add(d2);
    }
  }

  // ---- shared facade materials (a handful, reused across the city)
  const facadeMats = [];
  for (let i = 0; i < 10; i++) {
    const hex = `#${P.building[i].toString(16).padStart(6, '0')}`;
    facadeMats.push(new THREE.MeshLambertMaterial({ map: facadeTexture(hex, int(rng, 4, 9), int(rng, 3, 5), rng) }));
  }
  const towerMats = [];
  for (let i = 0; i < 4; i++) {
    const hex = `#${P.tower[i].toString(16).padStart(6, '0')}`;
    towerMats.push(new THREE.MeshLambertMaterial({ map: facadeTexture(hex, 16, 6, rng) }));
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x555a60 });
  const parkMat = new THREE.MeshLambertMaterial({ color: 0x5d8a4a });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a34 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

  function addBuilding(cx, cz, w, h, d, mat) {
    const m = box(w, h, d, mat);
    m.position.set(cx, h / 2, cz);
    group.add(m);
    const roof = box(w + 0.4, 0.5, d + 0.4, roofMat);
    roof.position.set(cx, h + 0.25, cz);
    group.add(roof);
    buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });
    return m;
  }

  function addTree(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), trunkMat);
    trunk.position.set(x, 1.2, z);
    trunk.castShadow = true;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), leafMat);
    crown.position.set(x, 3.4, z);
    crown.castShadow = true;
    group.add(crown);
  }

  // ---- blocks: downtown towers in the middle, low blocks elsewhere,
  // a park plaza, and the safehouse block.
  const parkBlock = { bx: -3, bz: 2 };
  const safeBlock = { bx: 2, bz: 3 };
  for (let bx = -4; bx <= 3; bx++) {
    for (let bz = -4; bz <= 3; bz++) {
      const cx = bx * C.pitch + C.pitch / 2;
      const cz = bz * C.pitch + C.pitch / 2;
      const downtown = Math.abs(bx - -0.5) <= 1 && Math.abs(bz - -0.5) <= 1;
      // Sidewalk slab under every block so streets read as streets, not lawn.
      if (!(bx === parkBlock.bx && bz === parkBlock.bz)) {
        const slab = box(C.blockSize, 0.3, C.blockSize, new THREE.MeshLambertMaterial({ color: P.sidewalk }));
        slab.position.set(cx, 0.15, cz);
        group.add(slab);
      }
      if (bx === parkBlock.bx && bz === parkBlock.bz) {
        const lawn = box(C.blockSize, 0.3, C.blockSize, parkMat);
        lawn.position.set(cx, 0.15, cz);
        group.add(lawn);
        for (let i = 0; i < 7; i++) addTree(cx + range(rng, -18, 18), cz + range(rng, -18, 18));
        continue;
      }
      if (bx === safeBlock.bx && bz === safeBlock.bz) {
        // Safehouse: small pastel house with a green roof.
        const house = box(16, 7, 12, facadeMats[5]);
        house.position.set(cx, 3.5, cz);
        group.add(house);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(11, 4, 4), new THREE.MeshLambertMaterial({ color: 0x3a7a4a }));
        roof.position.set(cx, 9, cz);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);
        buildings.push({ minX: cx - 8, maxX: cx + 8, minZ: cz - 6, maxZ: cz + 6, h: 7 });
        addTree(cx - 14, cz - 12);
        addTree(cx + 14, cz + 12);
        continue;
      }
      if (downtown) {
        const h = range(rng, 45, 95);
        const w = range(rng, 20, 30);
        addBuilding(cx + range(rng, -4, 4), cz + range(rng, -4, 4), w, h, w, pick(rng, towerMats));
        // A low annex beside the tower.
        addBuilding(cx + 14, cz - 12, 12, range(rng, 8, 14), 12, pick(rng, facadeMats));
      } else {
        const n = int(rng, 2, 3);
        const spots = shuffle(rng, [
          [-11, -11], [11, -11], [-11, 11], [11, 11], [0, -11], [0, 11],
        ]).slice(0, n);
        for (const [ox, oz] of spots) {
          const w = range(rng, 12, 18);
          const d = range(rng, 12, 18);
          addBuilding(cx + ox, cz + oz, w, range(rng, 8, 26), d, pick(rng, facadeMats));
        }
      }
    }
  }

  // ---- street lamps along every road, every 60 m
  for (const c of roadCoords) {
    for (let t = -270; t <= 270; t += 60) {
      for (const [x, z] of [[c + 8, t], [t, c + 8]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 6), lampMat);
        pole.position.set(x, 2.75, z);
        group.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampHeadMat);
        head.position.set(x, 5.6, z);
        group.add(head);
      }
    }
  }

  // ---- marina: piers and boats on the west shore
  const marina = { x: -278, z: 120 };
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  for (let i = 0; i < 3; i++) {
    const pier = box(3, 0.6, 34, pierMat);
    pier.position.set(-276, 0.3, 90 + i * 42);
    group.add(pier);
  }
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf0ead8 });
  for (let i = 0; i < 5; i++) {
    const hull = box(3.2, 1.4, 9, hullMat);
    hull.position.set(-292 - (i % 2) * 8, 0.7, 86 + i * 20);
    group.add(hull);
    const cabin = box(2, 1.2, 3, new THREE.MeshLambertMaterial({ color: 0x2e86c1 }));
    cabin.position.set(-292 - (i % 2) * 8, 1.9, 86 + i * 20);
    group.add(cabin);
  }

  // ---- port: container stacks and a gantry crane on the east edge
  const port = { x: 262, z: -60 };
  const containerColors = [0xc0392b, 0x2e86c1, 0x27ae60, 0xe67e22, 0x8e44ad];
  for (let i = 0; i < 14; i++) {
    const px = 256 + (i % 4) * 9;
    const pz = -110 + Math.floor(i / 4) * 26 + range(rng, -3, 3);
    const stack = int(rng, 1, 3);
    for (let s = 0; s < stack; s++) {
      const cont = box(8, 2.6, 2.6, new THREE.MeshLambertMaterial({ color: pick(rng, containerColors) }));
      cont.position.set(px, 1.3 + s * 2.6, pz);
      group.add(cont);
    }
    buildings.push({ minX: px - 4, maxX: px + 4, minZ: pz - 1.3, maxZ: pz + 1.3, h: stack * 2.6 });
  }
  // Gantry crane: two legs, a top beam, a hanging hook block.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8a020 });
  for (const dz of [-14, 14]) {
    const leg = box(2, 26, 2, craneMat);
    leg.position.set(258, 13, port.z + dz);
    group.add(leg);
  }
  const beam = box(3, 2.5, 40, craneMat);
  beam.position.set(258, 26, port.z);
  group.add(beam);
  buildings.push({ minX: 256, maxX: 260, minZ: port.z - 15, maxZ: port.z + 15, h: 26 });

  // ---- beach palms
  for (let i = 0; i < 10; i++) {
    addTree(C.beachX - 2 + range(rng, -2, 2), -260 + i * 55 + range(rng, -8, 8));
  }

  const city = {
    group,
    buildings,
    roadCoords,
    landmarks: {
      spawn: { x: 30, z: 210 },
      safehouse: { x: safeBlock.bx * C.pitch + C.pitch / 2, z: safeBlock.bz * C.pitch + C.pitch / 2, r: 20 },
      marina,
      port,
      downtown: { x: 0, z: 0 },
      beach: { x: -262, z: -40 },
      park: { x: parkBlock.bx * C.pitch + C.pitch / 2, z: parkBlock.bz * C.pitch + C.pitch / 2 },
    },
  };

  /** Push a circle (x/z, radius) out of every building AABB it overlaps. */
  city.collideCircle = function collideCircle(pos, radius) {
    for (const b of buildings) {
      const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          // Centre inside the box: shove out along the smallest overlap.
          const pushL = pos.x - b.minX + radius;
          const pushR = b.maxX - pos.x + radius;
          const pushU = pos.z - b.minZ + radius;
          const pushD = b.maxZ - pos.z + radius;
          const m = Math.min(pushL, pushR, pushU, pushD);
          if (m === pushL) pos.x = b.minX - radius;
          else if (m === pushR) pos.x = b.maxX + radius;
          else if (m === pushU) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
      }
    }
    // Keep the player and cars inside the playable bowl (beach to port).
    pos.x = Math.max(-282, Math.min(312, pos.x));
    pos.z = Math.max(-310, Math.min(310, pos.z));
  };

  /** The nearest road centre-line point to (x, z). */
  city.nearestRoad = function nearestRoad(x, z) {
    let bestX = roadCoords[0];
    let bestZ = roadCoords[0];
    let bd = Infinity;
    for (const rx of roadCoords) {
      const d = Math.abs(x - rx);
      if (d < bd) { bd = d; bestX = rx; }
    }
    bd = Infinity;
    for (const rz of roadCoords) {
      const d = Math.abs(z - rz);
      if (d < bd) { bd = d; bestZ = rz; }
    }
    // Snap to whichever axis is closer to a road.
    const dx = Math.abs(x - bestX);
    const dz = Math.abs(z - bestZ);
    return dx < dz ? { x: bestX, z } : { x, z: bestZ };
  };

  /** A random point on a random road, for spawning traffic. */
  city.randomRoadPoint = function randomRoadPoint() {
    const alongX = rng() < 0.5;
    const road = pick(rng, roadCoords);
    const t = range(rng, -260, 260);
    return alongX ? { x: road, z: t } : { x: t, z: road };
  };

  return city;
}
