// Meridian Bay itself: a deterministic grid city on a 64 m pitch —
// downtown towers at the core, low pastel blocks around them, a park with
// a pond, a safehouse block, a beach boardwalk and marina on the west
// shore, and the container port on the east edge. Buildings are low-poly
// boxes with canvas-painted window facades, and every solid registers an
// AABB the player and the cars collide with.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { range, int, choice, shuffle } from '../util/random.js';

const P = CONFIG.palette;
const W = CONFIG.world;

/** Paint a window facade: lit and dark windows over a pastel base. */
function paintFacade(base, floors, cols, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 160;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 96, 160);
  // A darker ground-floor band so buildings sit on the street.
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 148, 96, 12);
  const cw = 96 / cols;
  const ch = 148 / floors;
  for (let r = 0; r < floors; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() < 0.38;
      g.fillStyle = lit ? '#ffe9a8' : '#26303c';
      g.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function solidBox(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const buildings = []; // {minX,maxX,minZ,maxZ,h} collision boxes
  const roads = W.roads;

  // ---- ground: lawn base, sand strip, sea
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1150, 1150),
    new THREE.MeshLambertMaterial({ color: P.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 680),
    new THREE.MeshLambertMaterial({ color: P.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(W.sandEdge - 5, 0.02, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 720),
    new THREE.MeshLambertMaterial({ color: P.sea, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(W.seaEdge - 170, 0.0, 0);
  group.add(sea);

  // ---- roads: dark strips with dashed centre lines
  const roadMat = new THREE.MeshLambertMaterial({ color: P.road });
  const dashMat = new THREE.MeshLambertMaterial({ color: P.roadLine });
  for (const c of roads) {
    const stripX = new THREE.Mesh(new THREE.PlaneGeometry(640, W.roadWidth), roadMat);
    stripX.rotation.x = -Math.PI / 2;
    stripX.position.set(0, 0.05, c);
    stripX.receiveShadow = true;
    group.add(stripX);
    const stripZ = new THREE.Mesh(new THREE.PlaneGeometry(W.roadWidth, 640), roadMat);
    stripZ.rotation.x = -Math.PI / 2;
    stripZ.position.set(c, 0.05, 0);
    stripZ.receiveShadow = true;
    group.add(stripZ);
    for (let t = -310; t < 310; t += 12) {
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

  // ---- shared materials (a handful, reused across the city)
  const facadeMats = P.facade.map((hex) => {
    const css = `#${hex.toString(16).padStart(6, '0')}`;
    return new THREE.MeshLambertMaterial({ map: paintFacade(css, int(rng, 4, 9), int(rng, 3, 5), rng) });
  });
  const towerMats = P.tower.map((hex) => {
    const css = `#${hex.toString(16).padStart(6, '0')}`;
    return new THREE.MeshLambertMaterial({ map: paintFacade(css, 18, 6, rng) });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x555a60 });
  const lawnMat = new THREE.MeshLambertMaterial({ color: 0x5d8a4a });
  const pondMat = new THREE.MeshLambertMaterial({ color: 0x3a8fa8 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a34 });
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x2f8a4a });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: P.sidewalk });

  function addBuilding(cx, cz, w, h, d, mat) {
    const m = solidBox(w, h, d, mat);
    m.position.set(cx, h / 2, cz);
    group.add(m);
    const roof = solidBox(w + 0.4, 0.5, d + 0.4, roofMat);
    roof.position.set(cx, h + 0.25, cz);
    group.add(roof);
    // Rooftop clutter: AC units on low roofs, a mast on towers.
    if (h < 30) {
      const ac = solidBox(2.4, 1.0, 2.4, new THREE.MeshLambertMaterial({ color: 0x8a9096 }));
      ac.position.set(cx + w / 4, h + 1.0, cz - d / 4);
      group.add(ac);
    } else {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 10, 6), lampMat);
      mast.position.set(cx, h + 5, cz);
      group.add(mast);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff4040 }),
      );
      tip.position.set(cx, h + 10.2, cz);
      group.add(tip);
    }
    buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });
    return m;
  }

  function addTree(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.6, 6), trunkMat);
    trunk.position.set(x, 1.3, z);
    trunk.castShadow = true;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6), leafMat);
    crown.position.set(x, 3.7, z);
    crown.castShadow = true;
    group.add(crown);
  }

  function addPalm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5.5, 6), trunkMat);
    trunk.position.set(x, 2.75, z);
    trunk.rotation.z = range(rng, -0.12, 0.12);
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 5; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.4, 4), palmMat);
      frond.position.set(x, 5.6, z);
      frond.rotation.z = Math.PI / 2 + range(rng, -0.4, 0.4);
      frond.rotation.y = (i / 5) * Math.PI * 2;
      frond.castShadow = true;
      group.add(frond);
    }
  }

  // ---- blocks: downtown towers at the core, low blocks elsewhere,
  // a park with a pond, and the safehouse block.
  const parkBlock = { bx: -3, bz: 1 };
  const safeBlock = { bx: 2, bz: 2 };
  for (let bx = -4; bx <= 3; bx++) {
    for (let bz = -4; bz <= 3; bz++) {
      const cx = bx * W.pitch + W.pitch / 2;
      const cz = bz * W.pitch + W.pitch / 2;
      const downtown = bx >= -2 && bx <= 0 && bz >= -2 && bz <= 0;
      const isPark = bx === parkBlock.bx && bz === parkBlock.bz;
      const isSafe = bx === safeBlock.bx && bz === safeBlock.bz;
      if (!isPark) {
        // Sidewalk slab under every block so streets read as streets.
        const slab = solidBox(W.block, 0.3, W.block, sidewalkMat);
        slab.position.set(cx, 0.15, cz);
        group.add(slab);
      }
      if (isPark) {
        const lawn = solidBox(W.block, 0.3, W.block, lawnMat);
        lawn.position.set(cx, 0.15, cz);
        group.add(lawn);
        const pond = new THREE.Mesh(
          new THREE.CircleGeometry(9, 24),
          pondMat,
        );
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(cx - 6, 0.32, cz + 4);
        group.add(pond);
        for (let i = 0; i < 9; i++) addTree(cx + range(rng, -20, 20), cz + range(rng, -20, 20));
        continue;
      }
      if (isSafe) {
        // Safehouse: a small pastel house with a green pyramid roof.
        const house = solidBox(17, 7, 13, facadeMats[5]);
        house.position.set(cx, 3.5, cz);
        group.add(house);
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(12, 4.5, 4),
          new THREE.MeshLambertMaterial({ color: 0x3a7a4a }),
        );
        roof.position.set(cx, 9.2, cz);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);
        buildings.push({ minX: cx - 8.5, maxX: cx + 8.5, minZ: cz - 6.5, maxZ: cz + 6.5, h: 7 });
        addTree(cx - 16, cz - 14);
        addTree(cx + 16, cz + 14);
        continue;
      }
      if (downtown) {
        const h = range(rng, 48, 100);
        const w = range(rng, 22, 32);
        addBuilding(cx + range(rng, -4, 4), cz + range(rng, -4, 4), w, h, w, choice(rng, towerMats));
        addBuilding(cx + 15, cz - 13, 13, range(rng, 9, 15), 13, choice(rng, facadeMats));
      } else {
        const n = int(rng, 3, 4);
        const spots = shuffle(rng, [
          [-12, -12], [12, -12], [-12, 12], [12, 12], [0, -12], [0, 12],
        ]).slice(0, n);
        for (const [ox, oz] of spots) {
          const w = range(rng, 13, 19);
          const d = range(rng, 13, 19);
          addBuilding(cx + ox, cz + oz, w, range(rng, 8, 28), d, choice(rng, facadeMats));
        }
      }
    }
  }

  // ---- street trees along the sidewalks
  for (const c of roads) {
    for (let t = -256; t <= 256; t += 128) {
      if (Math.abs(t) < 32) continue; // keep intersections clear
      addTree(c + 11, t + 32);
      addTree(t + 32, c - 11);
    }
  }

  // ---- street lamps along every road
  for (const c of roads) {
    for (let t = -288; t <= 288; t += 64) {
      for (const [x, z] of [[c + 8.5, t], [t, c + 8.5]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 6), lampMat);
        pole.position.set(x, 2.75, z);
        group.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampGlowMat);
        head.position.set(x, 5.6, z);
        group.add(head);
      }
    }
  }

  // ---- beach boardwalk + palms along the west shore
  const boardwalk = solidBox(6, 0.4, 560, new THREE.MeshLambertMaterial({ color: 0xa8825a }));
  boardwalk.position.set(W.sandEdge + 8, 0.2, 0);
  group.add(boardwalk);
  for (let i = 0; i < 18; i++) {
    addPalm(W.sandEdge - 1 + range(rng, -2, 2), -272 + i * 32 + range(rng, -8, 8));
  }

  // ---- marina: piers and sailboats on the west shore
  const marina = { x: -288, z: 128 };
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  for (let i = 0; i < 3; i++) {
    const pier = solidBox(3, 0.6, 36, pierMat);
    pier.position.set(-284, 0.3, 96 + i * 44);
    group.add(pier);
  }
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf0ead8 });
  const sailMat = new THREE.MeshLambertMaterial({ color: 0xf8f4e8, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const bx = -300 - (i % 2) * 9;
    const bz = 92 + i * 20;
    const hull = solidBox(3.2, 1.4, 9, hullMat);
    hull.position.set(bx, 0.7, bz);
    group.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 5), lampMat);
    mast.position.set(bx, 4.5, bz);
    group.add(mast);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.5, 3), sailMat);
    sail.position.set(bx, 4.6, bz + 0.8);
    sail.rotation.y = Math.PI / 2;
    group.add(sail);
  }

  // ---- port: container stacks and a gantry crane on the east edge
  const port = { x: 278, z: -64 };
  const containerColors = [0xc0392b, 0x2e86c1, 0x27ae60, 0xe67e22, 0x8e44ad];
  for (let i = 0; i < 20; i++) {
    const px = 272 + (i % 4) * 9;
    const pz = -118 + Math.floor(i / 4) * 26 + range(rng, -3, 3);
    const stack = int(rng, 1, 3);
    for (let s = 0; s < stack; s++) {
      const cont = solidBox(8, 2.6, 2.6, new THREE.MeshLambertMaterial({ color: choice(rng, containerColors) }));
      cont.position.set(px, 1.3 + s * 2.6, pz);
      group.add(cont);
    }
    buildings.push({ minX: px - 4, maxX: px + 4, minZ: pz - 1.3, maxZ: pz + 1.3, h: stack * 2.6 });
  }
  // Gantry crane: two legs, a top beam, a hanging hook block.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8a020 });
  for (const dz of [-15, 15]) {
    const leg = solidBox(2, 28, 2, craneMat);
    leg.position.set(274, 14, port.z + dz);
    group.add(leg);
  }
  const beam = solidBox(3, 2.5, 42, craneMat);
  beam.position.set(274, 28, port.z);
  group.add(beam);
  const hook = solidBox(2, 2, 2, lampMat);
  hook.position.set(274, 22, port.z + 6);
  group.add(hook);
  buildings.push({ minX: 272, maxX: 276, minZ: port.z - 16, maxZ: port.z + 16, h: 28 });

  const city = {
    group,
    buildings,
    roadCoords: roads,
    landmarks: {
      spawn: { x: 128, z: 224 },
      safehouse: {
        x: safeBlock.bx * W.pitch + W.pitch / 2,
        z: safeBlock.bz * W.pitch + W.pitch / 2,
        r: 22,
      },
      marina,
      port,
      downtown: { x: 0, z: 0 },
      beach: { x: -272, z: -64 },
      park: {
        x: parkBlock.bx * W.pitch + W.pitch / 2,
        z: parkBlock.bz * W.pitch + W.pitch / 2,
      },
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
      if (d2 >= radius * radius) continue;
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
    // Keep everything inside the playable bowl (beach to port).
    pos.x = Math.max(-292, Math.min(316, pos.x));
    pos.z = Math.max(-316, Math.min(316, pos.z));
  };

  /** The nearest point on a road centre line to (x, z). */
  city.nearestRoad = function nearestRoad(x, z) {
    let bestX = roads[0];
    let bestZ = roads[0];
    let bd = Infinity;
    for (const rx of roads) {
      const d = Math.abs(x - rx);
      if (d < bd) {
        bd = d;
        bestX = rx;
      }
    }
    bd = Infinity;
    for (const rz of roads) {
      const d = Math.abs(z - rz);
      if (d < bd) {
        bd = d;
        bestZ = rz;
      }
    }
    return Math.abs(x - bestX) < Math.abs(z - bestZ)
      ? { x: bestX, z }
      : { x, z: bestZ };
  };

  /** A random point on a random road, for spawning traffic. */
  city.randomRoadPoint = function randomRoadPoint() {
    const alongX = rng() < 0.5;
    const road = choice(rng, roads);
    const t = range(rng, -260, 260);
    return alongX ? { x: road, z: t } : { x: t, z: road };
  };

  return city;
}
