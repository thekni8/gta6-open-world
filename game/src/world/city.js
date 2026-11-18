// Meridian Bay city generation: road grid, pastel buildings, beach, sea,
// port, marina and park — all deterministic from a seed. Repeated props use
// InstancedMesh so the whole city costs a handful of draw calls.
import { CONFIG } from '../config.js';
import { makeRng } from '../util/random.js';

const { roadLines, roadWidth, half } = CONFIG.world;

function box(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...opts }),
  );
  m.castShadow = opts.castShadow !== false;
  m.receiveShadow = true;
  return m;
}

export function buildCity(scene, seed = 7) {
  const rng = makeRng(seed);
  const city = {
    colliders: [], // { minX, maxX, minZ, maxZ }
    buildings: [], // { x, z, w, d, h, color } — also drawn on the minimap
    boats: [],
    beacons: [],
  };

  // ---- ground layers ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 80, half * 2 + 80),
    new THREE.MeshStandardMaterial({ color: 0x7fae62, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Sea: big teal plane south of the beach, plus a deeper strip far out.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 420),
    new THREE.MeshStandardMaterial({ color: CONFIG.palette.sea, roughness: 0.35, metalness: 0.1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, 240 + 210);
  scene.add(sea);
  const seaDeep = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 300),
    new THREE.MeshStandardMaterial({ color: CONFIG.palette.seaDeep, roughness: 0.3 }),
  );
  seaDeep.rotation.x = -Math.PI / 2;
  seaDeep.position.set(0, 0.04, 240 + 420 + 150);
  scene.add(seaDeep);

  // Sand beach along the whole south edge.
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2, 48),
    new THREE.MeshStandardMaterial({ color: CONFIG.palette.sand, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.03, 196 + 24);
  beach.receiveShadow = true;
  scene.add(beach);

  // ---- roads (asphalt strips) + block slabs ----
  const roadMat = new THREE.MeshStandardMaterial({ color: CONFIG.palette.road, roughness: 0.95 });
  const walkMat = new THREE.MeshStandardMaterial({ color: CONFIG.palette.sidewalk, roughness: 1 });
  const parkMat = new THREE.MeshStandardMaterial({ color: CONFIG.palette.grass, roughness: 1 });
  for (const line of roadLines) {
    for (const [w, d, x, z] of [
      [half * 2, roadWidth, 0, line],
      [roadWidth, half * 2, line, 0],
    ]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
      r.rotation.x = -Math.PI / 2;
      r.position.set(x, 0.02, z);
      r.receiveShadow = true;
      scene.add(r);
    }
  }

  // Block centres sit between neighbouring road lines.
  const blockCenters = [];
  const edges = [-half, ...roadLines.map((l) => l - roadWidth / 2)];
  const edges2 = [...roadLines.map((l) => l + roadWidth / 2), half];
  for (let i = 0; i < edges.length; i++) {
    blockCenters.push((edges[i] + edges2[i]) / 2);
  }
  const parkBlocks = new Set(['56,112', '112,112', '56,168', '112,168']);
  const blockSize = 44;

  for (const cx of blockCenters) {
    for (const cz of blockCenters) {
      const key = `${Math.round(cx)},${Math.round(cz)}`;
      const isPark = parkBlocks.has(key);
      const isPort = cx < -196;
      const isMarina = cx > 196;
      if (isPort || isMarina) continue; // strips get their own treatment
      const slab = new THREE.Mesh(
        new THREE.PlaneGeometry(blockSize, blockSize),
        isPark ? parkMat : walkMat,
      );
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(cx, 0.015, cz);
      slab.receiveShadow = true;
      scene.add(slab);
    }
  }

  // ---- lane dashes (one instanced mesh) ----
  {
    const dashGeo = new THREE.PlaneGeometry(2.6, 0.35);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
    const spots = [];
    for (const line of roadLines) {
      for (let t = -half + 8; t < half - 4; t += 9) {
        spots.push({ x: t, z: line, rot: 0 });
        spots.push({ x: line, z: t, rot: Math.PI / 2 });
      }
    }
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, spots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    spots.forEach((sp, i) => {
      e.set(-Math.PI / 2, 0, sp.rot);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(sp.x, 0.045, sp.z), q, s);
      dashes.setMatrixAt(i, m4);
    });
    dashes.instanceMatrix.needsUpdate = true;
    scene.add(dashes);
  }

  // ---- buildings (one instanced mesh + rooftop boxes) ----
  const buildingSpots = [];
  for (const cx of blockCenters) {
    for (const cz of blockCenters) {
      const key = `${Math.round(cx)},${Math.round(cz)}`;
      if (parkBlocks.has(key) || cx < -196 || cx > 196) continue;
      const downtown = Math.abs(cx) <= 84 && Math.abs(cz) <= 84;
      const palette = downtown ? CONFIG.palette.downtown : CONFIG.palette.buildings;
      const layout = rng.pick(['single', 'single', 'pair', 'quad']);
      const spots = [];
      if (layout === 'single') spots.push({ x: cx, z: cz, w: 30, d: 30 });
      else if (layout === 'pair') {
        const horizontal = rng.chance(0.5);
        spots.push(
          { x: cx + (horizontal ? -11 : 0), z: cz + (horizontal ? 0 : -11), w: horizontal ? 18 : 30, d: horizontal ? 30 : 18 },
          { x: cx + (horizontal ? 11 : 0), z: cz + (horizontal ? 0 : 11), w: horizontal ? 18 : 30, d: horizontal ? 30 : 18 },
        );
      } else {
        for (const dx of [-11, 11]) for (const dz of [-11, 11]) spots.push({ x: cx + dx, z: cz + dz, w: 18, d: 18 });
      }
      for (const sp of spots) {
        const h = downtown ? rng.range(22, 58) : rng.range(7, 20);
        const color = rng.pick(palette);
        buildingSpots.push({ ...sp, h, color });
        city.colliders.push({ minX: sp.x - sp.w / 2, maxX: sp.x + sp.w / 2, minZ: sp.z - sp.d / 2, maxZ: sp.z + sp.d / 2 });
        city.buildings.push({ x: sp.x, z: sp.z, w: sp.w, d: sp.d, h, color });
      }
    }
  }
  {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
    const inst = new THREE.InstancedMesh(geo, mat, buildingSpots.length);
    const m4 = new THREE.Matrix4();
    const color = new THREE.Color();
    buildingSpots.forEach((b, i) => {
      m4.makeScale(b.w, b.h, b.d);
      m4.setPosition(b.x, 0, b.z);
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i, color.setHex(b.color));
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    scene.add(inst);
  }
  // Rooftop boxes on the taller towers, for silhouette variety.
  {
    const tall = buildingSpots.filter((b) => b.h > 24);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.9 });
    const inst = new THREE.InstancedMesh(geo, mat, tall.length);
    const m4 = new THREE.Matrix4();
    tall.forEach((b, i) => {
      m4.makeScale(b.w * 0.35, 3 + (b.h % 5), b.d * 0.35);
      m4.setPosition(b.x, b.h, b.z);
      inst.setMatrixAt(i, m4);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    scene.add(inst);
  }

  // ---- palms: beachfront avenue, beach, and park ----
  const palmSpots = [];
  for (let x = -190; x <= 190; x += 14) {
    palmSpots.push({ x, z: 176 });
    if (rng.chance(0.6)) palmSpots.push({ x: x + 7, z: 208 });
  }
  for (let x = -140; x <= 140; x += 28) {
    if (rng.chance(0.7)) palmSpots.push({ x, z: 100 });
    if (rng.chance(0.7)) palmSpots.push({ x: x + 14, z: 140 });
  }
  for (let i = 0; i < 14; i++) {
    palmSpots.push({ x: rng.range(40, 130), z: rng.range(95, 160) });
  }
  addPalms(scene, palmSpots, rng);

  // ---- park trees ----
  const treeSpots = [];
  for (let i = 0; i < 26; i++) {
    treeSpots.push({ x: rng.range(36, 132), z: rng.range(92, 162) });
  }
  addTrees(scene, treeSpots, rng);

  // ---- street lamps at intersections ----
  const lampSpots = [];
  for (const lx of roadLines) {
    for (const lz of roadLines) {
      if (rng.chance(0.75)) lampSpots.push({ x: lx + 8, z: lz + 8 });
    }
  }
  addLamps(scene, lampSpots);

  // ---- port: container stacks + cranes (west strip) ----
  const containerColors = [0xd94f3d, 0x3d7dd9, 0x3da35d, 0xe8a33d, 0x8a5fc0, 0xd97b3d];
  const containerSpots = [];
  for (let x = -234; x <= -206; x += 13) {
    for (let z = -20; z <= 180; z += 16) {
      if (rng.chance(0.75)) {
        const stack = rng.int(1, 2);
        for (let s = 0; s < stack; s++) {
          containerSpots.push({ x: x + rng.range(-1, 1), z: z + rng.range(-1, 1), y: s * 2.7, color: rng.pick(containerColors), rot: rng.chance(0.5) ? 0 : Math.PI / 2 });
        }
        city.colliders.push({ minX: x - 6, maxX: x + 6, minZ: z - 3.5, maxZ: z + 3.5 });
      }
    }
  }
  {
    const geo = new THREE.BoxGeometry(12, 2.6, 3.2);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.15 });
    const inst = new THREE.InstancedMesh(geo, mat, containerSpots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    containerSpots.forEach((c, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.rot);
      m4.compose(new THREE.Vector3(c.x, c.y + 1.3, c.z), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i, color.setHex(c.color));
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    scene.add(inst);
  }
  // Three dockside cranes.
  for (const cz of [-8, 60, 128]) {
    const crane = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0xe8a33d, roughness: 0.7 });
    for (const dx of [-4, 4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), legMat);
      leg.position.set(dx, 13, 0);
      leg.castShadow = true;
      crane.add(leg);
    }
    const jib = new THREE.Mesh(new THREE.BoxGeometry(30, 1.6, 1.6), legMat);
    jib.position.set(4, 27, 0);
    jib.castShadow = true;
    crane.add(jib);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 3.5, 4), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
    cab.position.set(0, 24, 0);
    crane.add(cab);
    crane.position.set(-214, 0, cz);
    scene.add(crane);
    city.colliders.push({ minX: -219, maxX: -209, minZ: cz - 3, maxZ: cz + 3 });
  }

  // ---- marina: docks, boats, beach umbrellas ----
  for (let i = 0; i < 4; i++) {
    const dock = box(3, 0.5, 26, 0x9a7d5a);
    dock.position.set(150 + i * 22, 0.3, 252);
    scene.add(dock);
  }
  const boatColors = [0xffffff, 0xffd166, 0xef476f, 0x118ab2, 0x06d6a0];
  for (let i = 0; i < 10; i++) {
    const boat = new THREE.Group();
    const hull = box(3.4, 1.4, 9, rng.pick(boatColors));
    hull.position.y = 0.7;
    const cabin = box(2.2, 1.4, 3.4, 0xf5f2ea);
    cabin.position.set(0, 2, -0.5);
    boat.add(hull, cabin);
    const bx = 130 + i * 13 + rng.range(-3, 3);
    const bz = 258 + (i % 3) * 16 + rng.range(-3, 3);
    boat.position.set(bx, 0.1, bz);
    boat.rotation.y = rng.range(-0.3, 0.3);
    scene.add(boat);
    city.boats.push({ group: boat, baseY: 0.1, phase: rng.range(0, Math.PI * 2) });
  }
  // A few more boats scattered along the bay.
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = box(3, 1.2, 8, rng.pick(boatColors));
    hull.position.y = 0.6;
    boat.add(hull);
    const bx = -190 + i * 60 + rng.range(-10, 10);
    const bz = 280 + rng.range(0, 60);
    boat.position.set(bx, 0.1, bz);
    boat.rotation.y = rng.range(0, Math.PI);
    scene.add(boat);
    city.boats.push({ group: boat, baseY: 0.1, phase: rng.range(0, Math.PI * 2) });
  }
  // Beach umbrellas.
  {
    const spots = [];
    for (let i = 0; i < 14; i++) {
      spots.push({ x: rng.range(-180, 180), z: rng.range(204, 232), color: rng.pick([0xef476f, 0xffd166, 0x118ab2, 0x06d6a0, 0xff8fa3]) });
    }
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 5);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    const topGeo = new THREE.ConeGeometry(2.2, 1.1, 8);
    const topMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const tops = new THREE.InstancedMesh(topGeo, topMat, spots.length);
    const m4 = new THREE.Matrix4();
    const color = new THREE.Color();
    spots.forEach((u, i) => {
      m4.makeTranslation(u.x, 1.3, u.z);
      poles.setMatrixAt(i, m4);
      m4.makeTranslation(u.x, 2.9, u.z);
      tops.setMatrixAt(i, m4);
      tops.setColorAt(i, color.setHex(u.color));
    });
    poles.instanceMatrix.needsUpdate = true;
    tops.instanceMatrix.needsUpdate = true;
    if (tops.instanceColor) tops.instanceColor.needsUpdate = true;
    tops.castShadow = true;
    scene.add(poles, tops);
  }

  // ---- helpers ----
  city.isOnRoad = (x, z) => {
    for (const l of roadLines) {
      if (Math.abs(z - l) <= roadWidth / 2 + 1) return true;
      if (Math.abs(x - l) <= roadWidth / 2 + 1) return true;
    }
    return false;
  };

  city.nearestRoadPoint = (x, z) => {
    let best = null;
    let bestD = Infinity;
    for (const l of roadLines) {
      const dZ = Math.abs(z - l);
      if (dZ < bestD) { bestD = dZ; best = { x, z: l, axis: 'x' }; }
      const dX = Math.abs(x - l);
      if (dX < bestD) { bestD = dX; best = { x: l, z, axis: 'z' }; }
    }
    return best;
  };

  // Push a circle out of every building/container collider. Returns true on hit.
  city.collideCircle = (pos, radius) => {
    let hit = false;
    for (const c of city.colliders) {
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          // centre inside the box: shove out along the smallest overlap
          const pushes = [
            { x: c.minX - radius, z: pos.z },
            { x: c.maxX + radius, z: pos.z },
            { x: pos.x, z: c.minZ - radius },
            { x: pos.x, z: c.maxZ + radius },
          ];
          let bestPush = pushes[0];
          let bestDist = Infinity;
          for (const p of pushes) {
            const dd = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
            if (dd < bestDist) { bestDist = dd; bestPush = p; }
          }
          pos.x = bestPush.x;
          pos.z = bestPush.z;
        }
      }
    }
    // World bounds: keep everyone out of deep water and off the map edge.
    pos.x = Math.max(-half + 2, Math.min(half - 2, pos.x));
    pos.z = Math.max(-half + 2, Math.min(246, pos.z));
    return hit;
  };

  city.update = (dt, t) => {
    for (const b of city.boats) {
      b.group.position.y = b.baseY + Math.sin(t * 0.7 + b.phase) * 0.18;
      b.group.rotation.z = Math.sin(t * 0.5 + b.phase) * 0.02;
    }
  };

  return city;
}

function addPalms(scene, spots, rng) {
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 5.2, 6);
  trunkGeo.translate(0, 2.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const crownGeo = new THREE.ConeGeometry(2.6, 1.8, 7);
  crownGeo.translate(0, 0.4, 0);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x3f9e4d, roughness: 1 });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  spots.forEach((p, i) => {
    const tilt = rng.range(-0.08, 0.08);
    const rot = rng.range(0, Math.PI * 2);
    e.set(tilt, rot, rng.range(-0.08, 0.08));
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, rng.range(0.9, 1.25), 1));
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(p.x, 5.2, p.z), q, new THREE.Vector3(1, 1, 1));
    crowns.setMatrixAt(i, m4);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks, crowns);
}

function addTrees(scene, spots, rng) {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 2.6, 6);
  trunkGeo.translate(0, 1.3, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }), spots.length);
  const leafGeo = new THREE.IcosahedronGeometry(2.1, 0);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x4da34d, roughness: 1 }), spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach((p, i) => {
    const s = rng.range(0.8, 1.3);
    m4.makeScale(1, 1, 1);
    m4.setPosition(p.x, 0, p.z);
    trunks.setMatrixAt(i, m4);
    m4.makeScale(s, s, s);
    m4.setPosition(p.x, 3.4 * s, p.z);
    leaves.setMatrixAt(i, m4);
  });
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true;
  leaves.castShadow = true;
  scene.add(trunks, leaves);
}

function addLamps(scene, spots) {
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 6, 5);
  poleGeo.translate(0, 3, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.6, metalness: 0.4 }), spots.length);
  const headGeo = new THREE.SphereGeometry(0.42, 8, 6);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0.9 }), spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach((p, i) => {
    m4.makeTranslation(p.x, 0, p.z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(p.x, 6.1, p.z);
    heads.setMatrixAt(i, m4);
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  poles.castShadow = true;
  scene.add(poles, heads);
}

// Tall glowing objective beacon + ground ring, repositioned by missions.
export function makeBeacon(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23d }),
  );
  diamond.position.y = 6;
  group.add(beam, ring, diamond);
  group.visible = false;
  scene.add(group);
  return {
    group,
    show(x, z) {
      group.position.set(x, 0, z);
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    update(t) {
      if (!group.visible) return;
      diamond.position.y = 6 + Math.sin(t * 2.2) * 0.7;
      diamond.rotation.y = t * 1.5;
      ring.scale.setScalar(1 + Math.sin(t * 2.2) * 0.08);
    },
  };
}
