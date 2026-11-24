// Meridian Bay: the city itself. One continuous charcoal asphalt plane
// under everything (so roads run unbroken through every intersection),
// sidewalk slabs that never cross a road, pastel towers downtown, a
// boardwalk and teal sea to the south, and the container port to the east.

import { CONFIG, BUILDING_COLORS } from '../config.js';
import { makeRng, hash2 } from '../util/random.js';

export const ROAD_LINES = [];
for (let i = 0; i < CONFIG.roadCount; i++) {
  ROAD_LINES.push(-272 + i * CONFIG.roadPitch);
}
export const BLOCK_CENTERS = [];
for (let i = 0; i < CONFIG.roadCount - 1; i++) {
  BLOCK_CENTERS.push(-238 + i * CONFIG.roadPitch);
}

// Warm window patterns drawn once on canvas and shared by the buildings.
// Windows are amber and cream, never pure black.
function makeWindowTexture(rng, variant) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 256);
  const warm = ['#ffd98a', '#ffe9b8', '#f7c873', '#ffedb8', '#f2c979'];
  const cols = variant === 0 ? 4 : variant === 1 ? 5 : 3;
  const rows = 10;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng.chance(0.14)) continue; // a dark-ish pane, still warm grey
      ctx.fillStyle = rng.chance(0.14) ? '#b8a98a' : rng.pick(warm);
      const w = 128 / cols;
      const h = 256 / rows;
      ctx.fillRect(c * w + 4, r * h + 5, w - 8, h - 10);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ color, ...(opts.mat || {}) });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (opts.ry) mesh.rotation.y = opts.ry;
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  return mesh;
}

// Push a circle (x, z, radius) out of every AABB collider it overlaps.
export function resolveCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Center inside the box: push out along the smallest penetration.
        const pushes = [
          { d: pos.x - c.minX + radius, x: c.minX - radius, z: pos.z },
          { d: c.maxX - pos.x + radius, x: c.maxX + radius, z: pos.z },
          { d: pos.z - c.minZ + radius, x: pos.x, z: c.minZ - radius },
          { d: c.maxZ - pos.z + radius, x: pos.x, z: c.maxZ + radius },
        ];
        pushes.sort((a, b) => a.d - b.d);
        pos.x = pushes[0].x;
        pos.z = pushes[0].z;
      }
    }
  }
}

export function buildCity(scene) {
  const rng = makeRng(CONFIG.citySeed);
  const colliders = [];
  const solidMeshes = []; // for the camera pull-in raycast
  const group = new THREE.Group();
  scene.add(group);

  const addCollider = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ });

  // --- Ground: one unbroken charcoal asphalt sheet for the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 1100),
    new THREE.MeshLambertMaterial({ color: CONFIG.asphaltColor }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // --- Sea (south) and sand.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 420),
    new THREE.MeshLambertMaterial({ color: CONFIG.seaColor }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, 340 + 210);
  group.add(sea);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 52),
    new THREE.MeshLambertMaterial({ color: CONFIG.sandColor }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.06, 318);
  sand.receiveShadow = true;
  group.add(sand);
  // Boardwalk planks along the beach front.
  const boardwalk = box(1100, 0.18, 9, 0xb98d5f, 0, 0.09, 296.5, { shadow: false });
  group.add(boardwalk);

  // --- Port dock paving (east).
  const dock = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 470),
    new THREE.MeshLambertMaterial({ color: CONFIG.dockColor }),
  );
  dock.rotation.x = -Math.PI / 2;
  dock.position.set(300 + 75, 0.04, 0);
  dock.receiveShadow = true;
  group.add(dock);

  // --- Road markings: small yellow dashes and white zebra stripes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xe8c547 });
  const dashGeo = new THREE.BoxGeometry(2.4, 0.02, 0.28);
  for (const r of ROAD_LINES) {
    for (let t = -260; t <= 260; t += 12) {
      const d1 = new THREE.Mesh(dashGeo, dashMat);
      d1.position.set(t, 0.03, r);
      group.add(d1);
      const d2 = new THREE.Mesh(dashGeo, dashMat);
      d2.rotation.y = Math.PI / 2;
      d2.position.set(r, 0.03, t);
      group.add(d2);
    }
  }
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  const zebraGeo = new THREE.BoxGeometry(0.7, 0.02, 11);
  const zebraSpots = [
    { x: 0, z: -68, along: 'x' }, { x: 0, z: 68, along: 'x' },
    { x: -68, z: 0, along: 'z' }, { x: 68, z: 0, along: 'z' },
    { x: 0, z: 272, along: 'x' }, { x: -136, z: 272, along: 'x' },
    { x: 136, z: -136, along: 'z' }, { x: -204, z: 136, along: 'x' },
  ];
  for (const spot of zebraSpots) {
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(zebraGeo, zebraMat);
      if (spot.along === 'x') {
        s.position.set(spot.x - 3.6 + i * 1.45, 0.03, spot.z);
      } else {
        s.rotation.y = Math.PI / 2;
        s.position.set(spot.x, 0.03, spot.z - 3.6 + i * 1.45);
      }
      group.add(s);
    }
  }

  // --- Blocks: sidewalk slabs, buildings, parks.
  const windowTex = [makeWindowTexture(rng, 0), makeWindowTexture(rng, 1), makeWindowTexture(rng, 2)];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b6f75 });
  const parkTrees = [];
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const downtown = Math.abs(bx) <= 102 && Math.abs(bz) <= 102;
      const roll = hash2(bx, bz);
      // Sidewalk slab fills the block and stops at the road edge.
      const slab = box(52, 0.24, 52, CONFIG.sidewalkColor, bx, 0.12, bz, { shadow: false });
      group.add(slab);
      if (roll < 0.12) {
        // Park block: lawn, palms and a bench or two.
        const lawn = box(46, 0.1, 46, 0x7fae6a, bx, 0.28, bz, { shadow: false });
        group.add(lawn);
        for (let i = 0; i < 5; i++) {
          const px = bx + rng.range(-19, 19);
          const pz = bz + rng.range(-19, 19);
          parkTrees.push([px, pz]);
        }
        continue;
      }
      const count = downtown ? (roll < 0.5 ? 1 : 2) : rng.int(2, 4);
      for (let i = 0; i < count; i++) {
        const w = downtown ? rng.range(16, 24) : rng.range(10, 18);
        const d = downtown ? rng.range(16, 24) : rng.range(10, 18);
        const h = downtown ? rng.range(38, 88) : rng.range(8, 24);
        const ox = count === 1 ? 0 : (i % 2 === 0 ? -1 : 1) * 12;
        const oz = count === 1 ? 0 : (i < 2 ? -1 : 1) * 12;
        const x = bx + ox + rng.range(-2, 2);
        const z = bz + oz + rng.range(-2, 2);
        const tex = windowTex[rng.int(0, 2)].clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 14)));
        const side = new THREE.MeshLambertMaterial({ color: rng.pick(BUILDING_COLORS), map: tex });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
          [side, side, roofMat, roofMat, side, side]);
        building.position.set(x, 0.24 + h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        solidMeshes.push(building);
        addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
        // Rooftop box on taller towers.
        if (h > 30 && rng.chance(0.7)) {
          const top = box(w * 0.3, 3, d * 0.3, 0x8a8f94, x + rng.range(-3, 3), 0.24 + h + 1.5, z + rng.range(-3, 3));
          group.add(top);
        }
      }
    }
  }

  // --- Palms: beach row, park trees, a few on wide sidewalks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x4f9a5a });
  function palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 5.4 * s, 6), trunkMat);
    trunk.position.y = 2.7 * s;
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 3.4 * s, 5), frondMat);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.1 * s, 5.6 * s, Math.sin(a) * 1.1 * s);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      frond.castShadow = true;
      g.add(frond);
    }
    g.position.set(x, 0, z);
    group.add(g);
    addCollider(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
    return g;
  }
  for (let x = -320; x <= 320; x += 26) palm(x + rng.range(-4, 4), 291, rng.range(0.9, 1.25));
  for (const [px, pz] of parkTrees) palm(px, pz, rng.range(0.8, 1.1));
  for (let i = 0; i < 14; i++) {
    const bx = rng.pick(BLOCK_CENTERS);
    const bz = rng.pick(BLOCK_CENTERS);
    palm(bx + rng.range(-22, 22), bz + 24.5, 0.9);
  }

  // --- Streetlamps along the main avenues and the beach road (never in the port).
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xfff2c9, emissive: 0xffe9a8, emissiveIntensity: 0.6 });
  function lamp(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6), poleMat);
    pole.position.y = 3.25;
    pole.castShadow = true;
    g.add(pole);
    const arm = box(1.8, 0.12, 0.12, 0x3a3f45, 0.8, 6.4, 0, { shadow: false });
    g.add(arm);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampHeadMat);
    head.position.set(1.6, 6.3, 0);
    g.add(head);
    g.position.set(x, 0, z);
    group.add(g);
    addCollider(x - 0.25, x + 0.25, z - 0.25, z + 0.25);
  }
  for (let t = -272; t <= 272; t += 34) {
    lamp(9.5, t);
    lamp(t, 9.5);
    lamp(-9.5, t);
  }
  for (let x = -272; x <= 272; x += 34) lamp(x, 281.5);

  // --- The port: stacked multi-color containers and tall yellow cranes.
  const containerColors = [0xc94f4f, 0x4f7ec9, 0xe8c547, 0x7fb069, 0xe07b39, 0x8e6cc9, 0x4fb0c9];
  const portRows = [
    { x: 330, z: -150 }, { x: 330, z: -60 }, { x: 330, z: 110 }, { x: 330, z: 170 },
    { x: 380, z: -120 }, { x: 380, z: 40 }, { x: 380, z: 150 },
  ];
  for (const row of portRows) {
    const stacks = rng.int(3, 5);
    for (let s = 0; s < stacks; s++) {
      const levels = rng.int(1, 3);
      const cx = row.x + s * 13.5;
      for (let l = 0; l < levels; l++) {
        const c = box(12, 2.7, 2.7, rng.pick(containerColors), cx, 1.35 + l * 2.75, row.z + rng.range(-1, 1));
        group.add(c);
        solidMeshes.push(c);
      }
      addCollider(cx - 6, cx + 6, row.z - 1.6, row.z + 1.6);
    }
  }
  function crane(x, z) {
    const g = new THREE.Group();
    const yellow = new THREE.MeshLambertMaterial({ color: 0xf2c230 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 46, 3.4), yellow);
    tower.position.y = 23;
    tower.castShadow = true;
    g.add(tower);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(34, 2.2, 2.2), yellow);
    jib.position.set(10, 45, 0);
    jib.castShadow = true;
    g.add(jib);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 2.2), yellow);
    counter.position.set(-12, 45, 0);
    g.add(counter);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 18, 4),
      new THREE.MeshBasicMaterial({ color: 0x222222 }));
    cable.position.set(24, 36, 0);
    g.add(cable);
    const hook = box(2.4, 1.6, 2.4, 0x3a3f45, 24, 26.5, 0);
    g.add(hook);
    g.position.set(x, 0, z);
    g.rotation.y = rng.range(-0.3, 0.3);
    group.add(g);
    solidMeshes.push(tower);
    addCollider(x - 2.2, x + 2.2, z - 2.2, z + 2.2);
  }
  crane(352, -190);
  crane(352, -20);
  crane(352, 205);
  crane(410, 90);

  // --- Marina docks (north edge): a few moored boats.
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  for (let i = 0; i < 5; i++) {
    const bx = -180 + i * 80;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 9), hullMat);
    hull.position.set(bx, 0.8, -312);
    hull.castShadow = true;
    group.add(hull);
    const cab = box(2, 1.4, 3, CONFIG.cabinColor, bx, 2.2, -312);
    group.add(cab);
  }

  // A wooden pier reaching into the sea at the beach.
  const pier = box(6, 0.5, 60, 0xa87f52, -102, 0.4, 360, { shadow: false });
  group.add(pier);

  return {
    colliders,
    solidMeshes,
    roadLines: ROAD_LINES,
    portCenter: { x: 350, z: 20 },
    // The open concrete pad where the port firefight happens.
    missionRing: { x: 352, z: 20, r: 30 },
    hideout: { x: -34, z: -34 },
    update() {},
  };
}
