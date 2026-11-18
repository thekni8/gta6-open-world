// Meridian Bay itself: roads, blocks, buildings, beach, port and props.
// The layout is seeded, so the same seed always builds the same city.
// Static scenery is merged into one mesh per material (see util/merge.js),
// so the whole city renders in a few dozen draw calls instead of a thousand.
// Collision is a flat list of axis-aligned boxes the gameplay code pushes
// circles out of — cheap, and good enough for arcade driving and walking.

import { CFG, PALETTES, districtAt } from '../config.js';
import { SeededRandom } from '../util/random.js';
import { GeometryBuckets, translationMatrix, mergeGeometries } from '../util/merge.js';

const THREE = window.THREE;

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e4dc';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#2c3e50';
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 14) {
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3f45';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() > 0.5 ? '#42474e' : '#32363c';
    g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  }
  // Yellow dashed centre line along the road, white edge lines.
  g.fillStyle = '#f5d76e';
  g.fillRect(8, 62, 48, 4);
  g.fillRect(72, 62, 48, 4);
  g.fillStyle = '#dfe6e9';
  g.fillRect(0, 4, 128, 2);
  g.fillRect(0, 122, 128, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export class City {
  constructor(G) {
    this.G = G;
    this.rng = new SeededRandom(G.seed);
    this.group = new THREE.Group();
    this.colliders = [];
    this.clouds = [];
    this.boats = [];
    this.windowTex = makeWindowTexture();
    this.roadTex = makeRoadTexture();
    this.buildingMats = new Map();
    this.buckets = new GeometryBuckets(this.group);
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBeachAndSea();
    this.buildPortProps();
    this.buildPalmsAndLights();
    this.buildClouds();
    this.buckets.flush(true, true);
    G.scene.add(this.group);
  }

  buildingMaterial(color) {
    let mat = this.buildingMats.get(color);
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ map: this.windowTex, color });
      this.buildingMats.set(color, mat);
    }
    return mat;
  }

  addCollider(minX, maxX, minZ, maxZ) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshLambertMaterial({ color: 0x7d9b6a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.group.add(ground);
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 560),
      new THREE.MeshLambertMaterial({ color: 0xb9b3a4 }),
    );
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = 0;
    slab.receiveShadow = true;
    this.group.add(slab);
  }

  buildRoads() {
    const len = 560;
    const roadMat = new THREE.MeshLambertMaterial({ map: this.roadTex });
    const walkMat = new THREE.MeshLambertMaterial({ color: 0xd8d2c2 });
    for (const c of CFG.roadCoords) {
      // Sidewalk apron under each road, then the asphalt strip on top.
      for (const [width, y, mat, uvU] of [
        [22, 0.02, walkMat, 1],
        [14, 0.05, roadMat, len / 16],
      ]) {
        const geoX = new THREE.PlaneGeometry(len, width);
        const uvX = geoX.attributes.uv;
        for (let i = 0; i < uvX.count; i++) uvX.setXY(i, uvX.getX(i) * uvU, uvX.getY(i));
        this.buckets.add(mat, geoX, translationMatrix(0, y, c, 0, -Math.PI / 2, 0));
        const geoZ = new THREE.PlaneGeometry(len, width);
        const uvZ = geoZ.attributes.uv;
        for (let i = 0; i < uvZ.count; i++) uvZ.setXY(i, uvZ.getX(i) * uvU, uvZ.getY(i));
        this.buckets.add(mat, geoZ, translationMatrix(c, y, 0, 0, -Math.PI / 2, Math.PI / 2));
      }
    }
  }

  addBuilding(x, z, w, h, d, color) {
    // Windows tile by world size via UV scaling, so towers keep small windows.
    this.buckets.box(
      this.buildingMaterial(color), w, h, d, x, h / 2, z, 0,
      Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 11)),
    );
    this.buckets.box(this.roofMat(), w * 0.94, 0.6, d * 0.94, x, h + 0.3, z);
    this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  }

  roofMat() {
    if (!this._roofMat) this._roofMat = new THREE.MeshLambertMaterial({ color: 0x6b6259 });
    return this._roofMat;
  }

  buildBlocks() {
    const rng = this.rng;
    const centers = [];
    for (let i = 0; i < 8; i++) centers.push(-210 + i * 60);
    for (const bx of centers) {
      for (const bz of centers) {
        if (bz > 210) continue; // beach blocks stay open
        const district = districtAt(bx, bz);
        if (district === 'Meridian Port') {
          this.buildPortBlock(bx, bz);
          continue;
        }
        const palette = PALETTES[district === 'Downtown' ? 'downtown'
          : district === 'Marina District' ? 'marina' : 'oldtown'];
        const downtown = district === 'Downtown';
        const count = downtown ? rng.int(1, 2) : rng.int(2, 4);
        for (let k = 0; k < count; k++) {
          const w = downtown ? rng.range(18, 30) : rng.range(12, 20);
          const d = downtown ? rng.range(18, 30) : rng.range(12, 20);
          const h = downtown ? rng.range(34, 85) : rng.range(8, 22);
          const ox = count === 1 ? 0 : rng.range(-11, 11);
          const oz = count === 1 ? 0 : rng.range(-11, 11);
          const x = bx + ox;
          const z = bz + oz;
          if (Math.abs(x - bx) + w / 2 > 21 || Math.abs(z - bz) + d / 2 > 21) continue;
          this.addBuilding(x, z, w, h, d, rng.pick(palette));
        }
        if (!downtown && rng.chance(0.5)) {
          this.addTree(bx + rng.range(-16, 16), bz + rng.range(-16, 16));
        }
      }
    }
  }

  buildPortBlock(bx, bz) {
    const rng = this.rng;
    const colors = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085];
    const n = rng.int(3, 6);
    for (let k = 0; k < n; k++) {
      const w = 12;
      const d = 5;
      const h = 4.5;
      const x = bx + rng.range(-14, 14);
      const z = bz + rng.range(-14, 14);
      const stack = rng.chance(0.4) ? 2 : 1;
      const mat = this.containerMat(rng.pick(colors));
      for (let s = 0; s < stack; s++) {
        this.buckets.box(mat, w, h, d, x, h / 2 + s * h, z);
      }
      this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    }
  }

  containerMat(color) {
    if (!this._containerMats) this._containerMats = new Map();
    let mat = this._containerMats.get(color);
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ color });
      this._containerMats.set(color, mat);
    }
    return mat;
  }

  buildBeachAndSea() {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 80),
      new THREE.MeshLambertMaterial({ color: 0xead9a8 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.04, 266);
    sand.receiveShadow = true;
    this.group.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 500),
      new THREE.MeshLambertMaterial({ color: 0x2e8fa3, transparent: true, opacity: 0.92 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, 560);
    this.group.add(sea);
    // A wooden pier jutting into the bay.
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
    this.buckets.box(woodMat, 8, 1.2, 60, -60, 0.6, 300);
    this.addCollider(-64, -56, 270, 330);
    // Umbrellas and a few boats for the postcard shot.
    const rng = this.rng;
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const umbrellaColors = [0xe74c3c, 0x3498db, 0xf1c40f, 0xffffff];
    for (let i = 0; i < 10; i++) {
      const x = rng.range(-240, 240);
      const z = rng.range(240, 285);
      this.buckets.add(
        poleMat, new THREE.CylinderGeometry(0.12, 0.12, 3, 5),
        translationMatrix(x, 1.5, z),
      );
      const topMat = this.containerMat(rng.pick(umbrellaColors));
      this.buckets.add(
        topMat, new THREE.ConeGeometry(2.6, 1.2, 8),
        translationMatrix(x, 3.4, z),
      );
    }
    for (let i = 0; i < 4; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(7, 1.6, 2.6),
        new THREE.MeshLambertMaterial({ color: rng.pick([0xffffff, 0xe74c3c, 0x3498db]) }),
      );
      hull.position.y = 0.8;
      boat.add(hull);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 6, 5),
        new THREE.MeshLambertMaterial({ color: 0x7f8c8d }),
      );
      mast.position.y = 4;
      boat.add(mast);
      boat.position.set(rng.range(-220, 220), 0, rng.range(330, 420));
      boat.rotation.y = rng.range(0, Math.PI * 2);
      this.group.add(boat);
      this.boats.push(boat);
    }
  }

  buildPortProps() {
    // Two gantry cranes over the docks.
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xe67e22 });
    const cableMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    for (const [x, z] of [[248, 30], [248, 150]]) {
      for (const dx of [-4, 4]) {
        this.buckets.box(craneMat, 1.6, 34, 1.6, x + dx, 17, z);
      }
      this.buckets.box(craneMat, 26, 2, 2, x - 6, 34, z);
      this.buckets.add(
        cableMat, new THREE.CylinderGeometry(0.08, 0.08, 14, 4),
        translationMatrix(x - 16, 27, z),
      );
      this.addCollider(x - 5, x + 5, z - 2, z + 2);
    }
  }

  addTree(x, z) {
    if (!this._trunkMat) this._trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
    if (!this._crownMat) this._crownMat = new THREE.MeshLambertMaterial({ color: 0x3e8e4f });
    this.buckets.add(
      this._trunkMat, new THREE.CylinderGeometry(0.35, 0.5, 4, 6),
      translationMatrix(x, 2, z),
    );
    this.buckets.add(
      this._crownMat, new THREE.IcosahedronGeometry(3.2, 0),
      translationMatrix(x, 6, z),
    );
    this.addCollider(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
  }

  addPalm(x, z) {
    if (!this._palmTrunk) this._palmTrunk = new THREE.MeshLambertMaterial({ color: 0x8a6b45 });
    if (!this._palmFrond) this._palmFrond = new THREE.MeshLambertMaterial({ color: 0x2f9e5f });
    this.buckets.add(
      this._palmTrunk, new THREE.CylinderGeometry(0.28, 0.42, 7, 6),
      translationMatrix(x, 3.5, z, 0, 0, 0.12),
    );
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.buckets.add(
        this._palmFrond, new THREE.ConeGeometry(1.1, 5.5, 4),
        translationMatrix(
          x + Math.cos(a) * 1.6, 7.6, z + Math.sin(a) * 1.6,
          0, Math.sin(a) * 1.1, -Math.cos(a) * 1.1,
        ),
      );
    }
    this.addCollider(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
  }

  buildPalmsAndLights() {
    const rng = this.rng;
    // Palm-lined beachfront strip — the postcard road.
    for (let x = -240; x <= 240; x += 24) {
      this.addPalm(x + rng.range(-2, 2), 226);
      this.addPalm(x + 12 + rng.range(-2, 2), 254);
    }
    for (let i = 0; i < 14; i++) {
      this.addPalm(rng.range(-240, 240), rng.range(-240, 210));
    }
    // Streetlights along the two main avenues.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x55595e });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
    for (const c of CFG.roadCoords) {
      for (const [x, z] of [[c, 0], [0, c]]) {
        if (x === 0 && z === 0) continue;
        this.buckets.add(
          poleMat, new THREE.CylinderGeometry(0.14, 0.18, 7, 5),
          translationMatrix(x + 8.5, 3.5, z + 8.5),
        );
        this.buckets.add(
          headMat, new THREE.SphereGeometry(0.45, 8, 6),
          translationMatrix(x + 8.5, 7.2, z + 8.5),
        );
      }
    }
  }

  buildClouds() {
    const rng = this.rng;
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group();
      const puffs = rng.int(2, 4);
      const geos = [];
      for (let k = 0; k < puffs; k++) {
        const puff = new THREE.SphereGeometry(rng.range(6, 13), 8, 6);
        puff.scale(1, 0.45, 1);
        puff.translate(k * rng.range(7, 11) - puffs * 4, rng.range(-1, 1), rng.range(-3, 3));
        geos.push(puff);
      }
      const merged = new THREE.Mesh(mergeGeometries(geos), mat);
      cloud.add(merged);
      cloud.position.set(rng.range(-400, 400), rng.range(95, 130), rng.range(-400, 400));
      this.group.add(cloud);
      this.clouds.push(cloud);
    }
  }

  // Push a circle out of every building it overlaps. Returns the corrected
  // position plus whether it hit anything and the push-out normal.
  collideCircle(x, z, r) {
    let hit = false;
    let nx = 0;
    let nz = 0;
    for (const b of this.colliders) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        nx = dx * push;
        nz = dz * push;
        x += nx;
        z += nz;
      } else {
        // Centre inside the box: shove out along the smallest penetration.
        const pl = x - b.minX + r;
        const pr = b.maxX - x + r;
        const pt = z - b.minZ + r;
        const pb = b.maxZ - z + r;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) { x = b.minX - r; nx = -1; }
        else if (m === pr) { x = b.maxX + r; nx = 1; }
        else if (m === pt) { z = b.minZ - r; nz = -1; }
        else { z = b.maxZ + r; nz = 1; }
      }
    }
    return { x, z, hit, nx, nz };
  }

  // True when a point sits inside any building (with a small margin).
  // Police and camera code probe ahead with this before committing.
  pointInCollider(x, z, pad) {
    const p = pad || 0;
    for (const b of this.colliders) {
      if (x > b.minX - p && x < b.maxX + p && z > b.minZ - p && z < b.maxZ + p) {
        return true;
      }
    }
    return false;
  }

  isOnRoad(x, z) {
    for (const c of CFG.roadCoords) {
      if (Math.abs(x - c) < CFG.roadHalfWidth + 1) return true;
      if (Math.abs(z - c) < CFG.roadHalfWidth + 1) return true;
    }
    return false;
  }

  nearestRoadCoord(v) {
    let best = CFG.roadCoords[0];
    for (const c of CFG.roadCoords) {
      if (Math.abs(c - v) < Math.abs(best - v)) best = c;
    }
    return best;
  }

  randomRoadPoint(rng) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.pick(CFG.roadCoords);
    const along = rng.range(-230, 230);
    return axis === 'x'
      ? { x: along, z: road, axis, road, along }
      : { x: road, z: along, axis, road, along };
  }

  roadPointNear(x, z, minD, maxD, rng) {
    for (let tries = 0; tries < 24; tries++) {
      const p = this.randomRoadPoint(rng);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d >= minD && d <= maxD) return p;
    }
    return this.randomRoadPoint(rng);
  }

  update(dt, t) {
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 1.1;
      if (cloud.position.x > 480) cloud.position.x = -480;
    }
    for (let i = 0; i < this.boats.length; i++) {
      this.boats[i].position.y = Math.sin(t * 0.7 + i * 1.7) * 0.25;
      this.boats[i].rotation.z = Math.sin(t * 0.5 + i) * 0.03;
    }
  }
}
