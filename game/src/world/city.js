// Meridian Bay itself: street grid, districts, buildings, beach, marina,
// port, park, props. Deterministic from a seed, so the city is identical
// every run. Also owns collision (building AABBs) and the road graph that
// traffic, police and missions drive on.
import { CFG, districtAt } from '../config.js';
import { makeRng } from '../util/random.js';

const STREETS = [];
for (let s = CFG.streetMin; s <= CFG.streetMax; s += CFG.streetStep) STREETS.push(s);

function facadeTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#2c3440';
  for (let y = 14; y < 250; y += 30) {
    for (let x = 12; x < 120; x += 28) g.fillRect(x, y, 18, 20);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#48484f'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#4e4e56';
  for (let i = 0; i < 260; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  g.fillStyle = '#e8c832';
  g.fillRect(61, 8, 6, 52); // center dash
  g.fillStyle = '#d8d8d0';
  g.fillRect(4, 0, 4, 128); g.fillRect(120, 0, 4, 128); // edge lines
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 55);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCity(scene) {
  const rng = makeRng(20261118);
  const colliders = [];
  const blockers = [];
  const boats = [];
  const group = new THREE.Group();
  scene.add(group);

  const addCollider = (cx, cz, hw, hd) => {
    colliders.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd });
  };

  // ---- Ground: grass base, sand strip, sea ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: CFG.grassColor }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -20);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 46),
    new THREE.MeshLambertMaterial({ color: CFG.sandColor }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, 208);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 300),
    new THREE.MeshLambertMaterial({ color: CFG.seaColor, transparent: true, opacity: 0.96 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, 380);
  group.add(sea);

  // ---- Roads (textured asphalt with dashes) ----
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTexture() });
  const roadGeo = new THREE.PlaneGeometry(CFG.roadHalf * 2, 448);
  roadGeo.rotateX(-Math.PI / 2);
  for (const s of STREETS) {
    const rz = new THREE.Mesh(roadGeo, roadMat);
    rz.position.set(s, 0.015, 0);
    rz.receiveShadow = true;
    group.add(rz);
    const rx = new THREE.Mesh(roadGeo, roadMat);
    rx.rotation.y = Math.PI / 2;
    rx.position.set(0, 0.015, s);
    rx.receiveShadow = true;
    group.add(rx);
  }

  // ---- Block slabs (sidewalk / grass / concrete), instanced ----
  const slabGeo = new THREE.BoxGeometry(33, 0.5, 33);
  const slabMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const blockCenters = [];
  for (let ix = 0; ix < 10; ix++) {
    for (let iz = 0; iz < 10; iz++) {
      blockCenters.push({ x: -180 + ix * 40, z: -180 + iz * 40 });
    }
  }
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, blockCenters.length);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  blockCenters.forEach((b, i) => {
    m4.makeTranslation(b.x, 0.05, b.z);
    slabs.setMatrixAt(i, m4);
    const park = b.x >= -40 && b.x <= 40 && b.z >= 80 && b.z <= 160;
    const port = b.x >= 120 && b.z <= -120;
    slabs.setColorAt(i, col.setHex(park ? 0x5da844 : port ? 0x9a958a : CFG.sidewalkColor));
  });
  slabs.receiveShadow = true;
  group.add(slabs);

  // ---- Buildings ----
  const facade = facadeTexture();
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4640 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0); // pivot at base
  const paletteMats = {};
  function buildingMat(colorHex) {
    if (!paletteMats[colorHex]) {
      paletteMats[colorHex] = new THREE.MeshLambertMaterial({ map: facade, color: colorHex });
    }
    return paletteMats[colorHex];
  }
  function districtOf(x, z) {
    if (x > 120 && z < -120) return 'port';
    if (z > 160) return 'beach';
    if (x >= -60 && x <= 120 && z >= -120 && z <= 60) return 'downtown';
    if (x < -60) return 'oldtown';
    return 'oldtown';
  }
  for (const b of blockCenters) {
    const park = b.x >= -40 && b.x <= 40 && b.z >= 80 && b.z <= 160;
    const port = b.x >= 120 && b.z <= -120;
    if (park || port) continue;
    const d = districtOf(b.x, b.z);
    const palette = CFG.buildingPalettes[d];
    const tall = d === 'downtown';
    const spots = rng.chance(0.55)
      ? [{ dx: 0, dz: 0, w: rng.range(18, 24), d: rng.range(18, 24) }]
      : [
        { dx: -6, dz: -6, w: rng.range(9, 12), d: rng.range(9, 12) },
        { dx: 6, dz: -6, w: rng.range(9, 12), d: rng.range(9, 12) },
        { dx: -6, dz: 6, w: rng.range(9, 12), d: rng.range(9, 12) },
        { dx: 6, dz: 6, w: rng.range(9, 12), d: rng.range(9, 12) },
      ];
    for (const s of spots) {
      const h = tall ? rng.range(24, 58) : d === 'beach' ? rng.range(7, 14) : rng.range(9, 20);
      const mat = buildingMat(rng.pick(palette));
      const mesh = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
      mesh.scale.set(s.w, h, s.d);
      mesh.position.set(b.x + s.dx, 0.3, b.z + s.dz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      blockers.push(mesh);
      addCollider(b.x + s.dx, b.z + s.dz, s.w / 2 + 0.2, s.d / 2 + 0.2);
      // Rooftop box on tall towers for a skyline that isn't flat
      if (tall && rng.chance(0.5)) {
        const top = new THREE.Mesh(boxGeo, roofMat);
        top.scale.set(s.w * 0.4, rng.range(2, 5), s.d * 0.4);
        top.position.set(b.x + s.dx, 0.3 + h, b.z + s.dz);
        top.castShadow = true;
        group.add(top);
      }
    }
  }

  // ---- Port: stacked containers (instanced, bright) + cranes ----
  const contGeo = new THREE.BoxGeometry(8, 3, 3.4);
  const contMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const contSpots = [];
  for (const bx of [140, 180]) {
    for (const bz of [-180, -140]) {
      for (let i = 0; i < 5; i++) {
        const cx = bx + rng.range(-11, 11);
        const cz = bz + rng.range(-11, 11);
        const stack = rng.int(1, 3);
        for (let k = 0; k < stack; k++) contSpots.push({ x: cx, y: 0.3 + k * 3.1, z: cz, ry: rng.chance(0.5) ? 0 : Math.PI / 2 });
        addCollider(cx, cz, 4.4, 4.4);
      }
    }
  }
  const containers = new THREE.InstancedMesh(contGeo, contMat, contSpots.length);
  contSpots.forEach((c, i) => {
    m4.makeRotationY(c.ry);
    m4.setPosition(c.x, c.y, c.z);
    containers.setMatrixAt(i, m4);
    containers.setColorAt(i, col.setHex(rng.pick(CFG.containerColors)));
  });
  containers.castShadow = true;
  group.add(containers);
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xe8a020 });
  for (const [cx, cz] of [[132, -196], [188, -132]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3), craneMat);
    leg.position.set(cx, 17, cz);
    leg.castShadow = true;
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 2.4, 2.4), craneMat);
    arm.position.set(cx + 10, 33, cz);
    arm.castShadow = true;
    group.add(arm);
    addCollider(cx, cz, 2, 2);
  }

  // ---- Palms: beachfront avenue + park edges (instanced trunks + fronds) ----
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const frondGeo = new THREE.BoxGeometry(0.5, 0.18, 5.2);
  frondGeo.translate(0, 0, 2.2);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44 });
  const palmSpots = [];
  // Avenue palms sit 10 units off the nearest north-south street so none
  // lands on a road centerline.
  for (let x = -190; x <= 190; x += 20) {
    palmSpots.push({ x: x + rng.range(-2, 2), z: 186 });
    if (rng.chance(0.5)) palmSpots.push({ x: x + rng.range(-2, 2), z: 174 });
  }
  for (let i = 0; i < 26; i++) {
    palmSpots.push({ x: rng.range(-40, 40), z: rng.range(84, 156) });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length * 6);
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  palmSpots.forEach((p, i) => {
    const lean = rng.range(-0.12, 0.12);
    eul.set(lean, rng.range(0, Math.PI * 2), 0);
    q.setFromEuler(eul);
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, 1, 1));
    trunks.setMatrixAt(i, m4);
    for (let f = 0; f < 6; f++) {
      eul.set(-0.55 + rng.range(-0.15, 0.15), (f / 6) * Math.PI * 2, 0, 'YXZ');
      q.setFromEuler(eul);
      m4.compose(new THREE.Vector3(p.x, 6.8, p.z), q, new THREE.Vector3(1, 1, 1));
      fronds.setMatrixAt(i * 6 + f, m4);
    }
  });
  trunks.castShadow = true;
  fronds.castShadow = true;
  group.add(trunks, fronds);

  // ---- Park trees (trunk + round canopy), benches, pond ----
  // Trees live inside the park blocks only — never on roads, where they
  // would block the camera and the player's path.
  const treeSpots = [];
  for (let i = 0; i < 34; i++) treeSpots.push({ x: rng.range(-38, 38), z: rng.range(84, 156) });
  const treeTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const canopyGeo = new THREE.IcosahedronGeometry(2.6, 0);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x3d9e4f });
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeSpots.length);
  treeSpots.forEach((p, i) => {
    m4.makeTranslation(p.x, 0, p.z);
    treeTrunks.setMatrixAt(i, m4);
    m4.makeTranslation(p.x, 7.6, p.z);
    canopies.setMatrixAt(i, m4);
  });
  canopies.castShadow = true;
  group.add(treeTrunks, canopies);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(11, 24),
    new THREE.MeshLambertMaterial({ color: 0x4fb8d8 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(0, 0.35, 120);
  group.add(pond);

  // ---- Street lamps (instanced pole + glowing head) ----
  // Lamps sit on sidewalk corners: east of north-south streets, and at the
  // southeast corner of each intersection — never on a road centerline.
  const lampSpots = [];
  for (const s of STREETS) {
    for (let t = -180; t <= 180; t += 40) {
      lampSpots.push({ x: s + 9.5, z: t });
      lampSpots.push({ x: t + 9.5, z: s + 9.5 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5, 5);
  poleGeo.translate(0, 2.5, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333338 });
  const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0x887733 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  lampSpots.forEach((p, i) => {
    m4.makeTranslation(p.x, 0, p.z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(p.x, 5.1, p.z);
    heads.setMatrixAt(i, m4);
  });
  group.add(poles, heads);

  // ---- Beach umbrellas (colorful cones) ----
  const umbSpots = [];
  for (let i = 0; i < 16; i++) umbSpots.push({ x: rng.range(-190, 190), z: rng.range(212, 228) });
  const umbPoleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5);
  umbPoleGeo.translate(0, 1.3, 0);
  const umbConeGeo = new THREE.ConeGeometry(2.2, 1.1, 8);
  const umbPoles = new THREE.InstancedMesh(umbPoleGeo, poleMat, umbSpots.length);
  const umbCones = new THREE.InstancedMesh(umbConeGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), umbSpots.length);
  umbSpots.forEach((p, i) => {
    m4.makeTranslation(p.x, 0, p.z);
    umbPoles.setMatrixAt(i, m4);
    m4.makeTranslation(p.x, 2.8, p.z);
    umbCones.setMatrixAt(i, m4);
    umbCones.setColorAt(i, col.setHex(rng.pick([0xe84f4f, 0x2a7fd8, 0xf2c230, 0x37b268, 0xf2f2f2])));
  });
  group.add(umbPoles, umbCones);

  // ---- Boats: marina docks + anchored in the bay ----
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x2a7fd8 });
  function makeBoat(x, z, ry, scale = 1) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 8), hullMat);
    hull.position.y = 0.4;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 3.4), cabinMat);
    cabin.position.set(0, 1.6, -0.6);
    boat.add(hull, cabin);
    boat.position.set(x, 0, z);
    boat.rotation.y = ry;
    boat.scale.setScalar(scale);
    group.add(boat);
    boats.push({ group: boat, baseY: 0, phase: rng.range(0, Math.PI * 2) });
    return boat;
  }
  for (let i = 0; i < 7; i++) makeBoat(128 + i * 12, 238 + (i % 2) * 8, Math.PI / 2 + rng.range(-0.2, 0.2));
  for (let i = 0; i < 5; i++) makeBoat(rng.range(-160, 60), rng.range(250, 300), rng.range(0, Math.PI * 2), rng.range(0.8, 1.4));
  // Marina piers
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  for (let i = 0; i < 4; i++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 26), pierMat);
    pier.position.set(124 + i * 24, 0.4, 222);
    group.add(pier);
  }

  // ---- Downtown billboards (bright signs) ----
  const signColors = [0xe84f4f, 0x2a7fd8, 0xf2c230, 0x37b268];
  for (let i = 0; i < 6; i++) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(10, 4, 0.6),
      new THREE.MeshLambertMaterial({ color: signColors[i % 4] }),
    );
    sign.position.set(rng.range(-40, 100), rng.range(14, 26), rng.range(-100, 40));
    sign.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    group.add(sign);
  }

  function resolveCircle(x, z, r) {
    // Push a circle out of building AABBs; returns corrected {x, z}.
    for (const c of colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Center inside the box: push out along the smallest penetration.
          const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
          else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
        }
      }
    }
    x = Math.max(-CFG.worldHalf, Math.min(CFG.worldHalf, x));
    z = Math.max(-CFG.worldHalf, Math.min(230, z));
    return { x, z };
  }

  function nearestStreetPoint(x, z) {
    let bx = STREETS[0], bz = STREETS[0];
    for (const s of STREETS) {
      if (Math.abs(s - x) < Math.abs(bx - x)) bx = s;
      if (Math.abs(s - z) < Math.abs(bz - z)) bz = s;
    }
    return Math.abs(bx - x) < Math.abs(bz - z) ? { x: bx, z } : { x, z: bz };
  }

  function randomRoadPoint(r) {
    const vertical = r.chance(0.5);
    const s = r.pick(STREETS);
    const t = r.range(-200, 200);
    return vertical ? { x: s, z: t } : { x: t, z: s };
  }

  return {
    group,
    colliders,
    blockers,
    streets: STREETS,
    districtAt,
    resolveCircle,
    nearestStreetPoint,
    randomRoadPoint,
    hideout: { x: 0, z: 120 },
    update(dt, t) {
      for (const b of boats) {
        b.group.position.y = Math.sin(t * 0.7 + b.phase) * 0.18;
        b.group.rotation.z = Math.sin(t * 0.5 + b.phase) * 0.02;
      }
    },
  };
}
