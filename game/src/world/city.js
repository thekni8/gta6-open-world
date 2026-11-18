/* Meridian Bay city generation: road grid, pastel buildings with
   window textures, beach + sea, port, marina, parks, and street props.
   Deterministic (seeded) so the city is identical every run. */
(function () {
  const CFG = MB.CFG, PAL = MB.PALETTE;
  let scene = null;
  let beaconMesh = null, beaconRing = null;

  // --- procedural window textures (shared, cheap) ---
  function windowTexture(baseHex, floors, cols) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#' + baseHex.toString(16).padStart(6, '0');
    g.fillRect(0, 0, 128, 256);
    // subtle vertical shading
    const grad = g.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.18)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.06)'); grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 256);
    const ww = 128 / cols, wh = 256 / floors;
    for (let f = 0; f < floors; f++) {
      for (let col = 0; col < cols; col++) {
        const lit = ((f * 7 + col * 3) % 5 === 0);
        g.fillStyle = lit ? '#ffe9a8' : '#18222e';
        g.fillRect(col * ww + ww * 0.22, f * wh + wh * 0.25, ww * 0.56, wh * 0.5);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function box(w, h, d, mat, x, y, z, shadow) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    scene.add(m);
    return m;
  }

  function addCollider(minX, maxX, minZ, maxZ) {
    MB.W.colliders.push({ minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ });
  }

  // Circle-vs-AABB resolve: pushes a circle out of every building box.
  function collideCircle(x, z, r) {
    for (let i = 0; i < MB.W.colliders.length; i++) {
      const b = MB.W.colliders[i];
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = cx + dx / d * r; z = cz + dz / d * r;
        } else {
          // center inside the box: push out along the smallest penetration
          const pl = x - b.minX, pr = b.maxX - x, pt = z - b.minZ, pb = b.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.minX - r; else if (m === pr) x = b.maxX + r;
          else if (m === pt) z = b.minZ - r; else z = b.maxZ + r;
        }
      }
    }
    return { x: x, z: z };
  }

  function zoneAt(x, z) {
    if (x > 170) return 'BAYFRONT BEACH';
    if (z < -184) return 'MERIDIAN PORT';
    if (x > 120 && z > 140) return 'THE MARINA';
    if (Math.abs(x) < 95 && Math.abs(z) < 95) return 'DOWNTOWN';
    if (x < -95) return 'OLD TOWN';
    if (z > 140) return 'PALM DISTRICT';
    if (z < -140) return 'HARBOR SIDE';
    return 'MIDTOWN';
  }

  function buildGround() {
    const groundMat = new THREE.MeshLambertMaterial({ color: PAL.grass });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Sea: big teal plane east of the beach, just above ground level
    // so it reads from a low camera, and wide enough to fill the horizon.
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 1100),
      new THREE.MeshLambertMaterial({ color: PAL.sea }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(CFG.seaX + 450, 0.05, 0);
    scene.add(sea);
    // Sand strip.
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(CFG.seaX - CFG.beachX + 14, 500),
      new THREE.MeshLambertMaterial({ color: PAL.sand }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set((CFG.beachX + CFG.seaX) / 2, 0.02, 0);
    sand.receiveShadow = true;
    scene.add(sand);
  }

  function buildRoads() {
    const roadMat = new THREE.MeshLambertMaterial({ color: PAL.road });
    const walkMat = new THREE.MeshLambertMaterial({ color: PAL.sidewalk });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2c14e });
    const L = CFG.roadLines, W = CFG.roadWidth;
    const len = 500;
    L.forEach(function (c) {
      // road surface + sidewalks, both directions
      const r1 = new THREE.Mesh(new THREE.PlaneGeometry(W, len), roadMat);
      r1.rotation.x = -Math.PI / 2; r1.position.set(c, 0.03, 0); r1.receiveShadow = true; scene.add(r1);
      const r2 = new THREE.Mesh(new THREE.PlaneGeometry(len, W), roadMat);
      r2.rotation.x = -Math.PI / 2; r2.position.set(0, 0.03, c); r2.receiveShadow = true; scene.add(r2);
      [c - W / 2 - 2.5, c + W / 2 + 2.5].forEach(function (s) {
        const w1 = new THREE.Mesh(new THREE.PlaneGeometry(5, len), walkMat);
        w1.rotation.x = -Math.PI / 2; w1.position.set(s, 0.04, 0); w1.receiveShadow = true; scene.add(w1);
        const w2 = new THREE.Mesh(new THREE.PlaneGeometry(len, 5), walkMat);
        w2.rotation.x = -Math.PI / 2; w2.position.set(0, 0.04, s); w2.receiveShadow = true; scene.add(w2);
      });
    });
    // Center dashes along every road (shared geometry, cheap).
    const dashGeo = new THREE.PlaneGeometry(1.1, 4.2);
    L.forEach(function (c) {
      for (let t = -230; t <= 230; t += 16) {
        const d1 = new THREE.Mesh(dashGeo, dashMat);
        d1.rotation.x = -Math.PI / 2; d1.position.set(c, 0.05, t); scene.add(d1);
        const d2 = new THREE.Mesh(dashGeo, dashMat);
        d2.rotation.x = -Math.PI / 2; d2.rotation.z = Math.PI / 2; d2.position.set(t, 0.05, c); scene.add(d2);
      }
    });
  }

  function buildBuildings(rng) {
    // Materials for every color any district palette can pick.
    const mats = {};
    PAL.buildings.concat(PAL.downtown, PAL.oldtown).forEach(function (hex) {
      if (!mats[hex]) mats[hex] = new THREE.MeshLambertMaterial({ map: windowTexture(hex, 8, 4) });
    });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a8378 });
    const L = CFG.roadLines, W = CFG.roadWidth;
    // Block bounds: between road edges.
    const edges = [-240];
    L.forEach(function (c) { edges.push(c - W / 2 - 5, c + W / 2 + 5); });
    edges.push(240);
    const parks = [{ bx: 1, bz: 5 }, { bx: 5, bz: 1 }, { bx: 6, bz: 6 }]; // block indices kept green
    function isPark(bx, bz) { return parks.some(function (p) { return p.bx === bx && p.bz === bz; }); }

    for (let bx = 0; bx < 8; bx++) {
      for (let bz = 0; bz < 8; bz++) {
        const x0 = edges[bx * 2], x1 = edges[bx * 2 + 1];
        const z0 = edges[bz * 2], z1 = edges[bz * 2 + 1];
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        // Beach / port / marina blocks get no buildings.
        if (x0 > CFG.beachX - 10 || z1 < CFG.portZ + 8) continue;
        if (isPark(bx, bz)) { buildPark(cx, cz, x1 - x0, z1 - z0, rng); continue; }
        // Block slab.
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0),
          new THREE.MeshLambertMaterial({ color: PAL.plaza }));
        slab.rotation.x = -Math.PI / 2; slab.position.set(cx, 0.045, cz);
        slab.receiveShadow = true; scene.add(slab);
        const downtown = Math.abs(cx) < 95 && Math.abs(cz) < 95;
        const oldtown = cx < -95;
        const n = rng.int(1, downtown ? 2 : 4);
        for (let i = 0; i < n; i++) {
          const bw = rng.range(12, (x1 - x0) / n * 0.92);
          const bd = rng.range(12, (z1 - z0) * 0.85);
          const px = x0 + (i + 0.5) * ((x1 - x0) / n) + rng.range(-2, 2);
          const pz = cz + rng.range(-4, 4);
          let h;
          if (downtown) h = rng.range(20, 58);
          else if (oldtown) h = rng.range(8, 16);
          else h = rng.range(10, 30);
          const palette = downtown ? PAL.downtown : (oldtown ? PAL.oldtown : PAL.buildings);
          const hex = rng.pick(palette);
          const m = box(bw, h, bd, mats[hex], px, h / 2, pz);
          m.material = mats[hex];
          // Roof cap + the occasional rooftop box.
          box(bw * 1.02, 0.8, bd * 1.02, roofMat, px, h + 0.4, pz);
          if (rng.chance(0.4)) box(rng.range(3, 6), rng.range(2, 4), rng.range(3, 6), roofMat, px + rng.range(-4, 4), h + 2, pz + rng.range(-4, 4));
          addCollider(px - bw / 2, px + bw / 2, pz - bd / 2, pz + bd / 2);
        }
      }
    }
  }

  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44, side: THREE.DoubleSide });
  function palm(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.3 * s, 5.5 * s, 6), trunkMat);
    trunk.position.y = 2.75 * s; trunk.castShadow = true; g.add(trunk);
    // Six drooping fronds: each a pivot group rotated around the trunk,
    // with a narrow leaf plane angled down and outward.
    for (let i = 0; i < 6; i++) {
      const pivot = new THREE.Group();
      pivot.position.y = 5.5 * s;
      pivot.rotation.y = (i / 6) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.6 * s, 3.4 * s), leafMat);
      leaf.position.set(0, 0.35 * s, 1.7 * s);
      leaf.rotation.x = -1.2; // droop: tip falls below the crown
      leaf.castShadow = true;
      pivot.add(leaf);
      g.add(pivot);
    }
    // Coconuts: two small brown spheres under the crown.
    const nutMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    [[0.3, 0.2], [-0.3, -0.15]].forEach(function (o) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 6, 5), nutMat);
      nut.position.set(o[0] * s, 5.2 * s, o[1] * s);
      g.add(nut);
    });
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }

  function tree(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2.5 * s, 6), trunkMat);
    trunk.position.y = 1.25 * s; trunk.castShadow = true; g.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2 * s, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x3d8b3d }));
    crown.position.y = 3.6 * s; crown.castShadow = true; g.add(crown);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  function buildPark(cx, cz, w, d, rng) {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ color: PAL.grassDark }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, 0.045, cz);
    lawn.receiveShadow = true; scene.add(lawn);
    for (let i = 0; i < 7; i++) tree(cx + rng.range(-w / 2 + 4, w / 2 - 4), cz + rng.range(-d / 2 + 4, d / 2 - 4), rng.range(0.9, 1.4));
    // Footpath cross.
    const pathMat = new THREE.MeshLambertMaterial({ color: PAL.sand });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(3, d), pathMat);
    p1.rotation.x = -Math.PI / 2; p1.position.set(cx, 0.06, cz); scene.add(p1);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(w, 3), pathMat);
    p2.rotation.x = -Math.PI / 2; p2.position.set(cx, 0.06, cz); scene.add(p2);
  }

  function buildBeach(rng) {
    // Umbrellas + loungers along the sand.
    const umbColors = [0xf2c14e, 0x2c6fd3, 0xd33a2c, 0x2fae5f, 0xe88ca0];
    for (let z = -180; z <= 180; z += 26) {
      const x = CFG.beachX + 12 + rng.range(0, 18);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 5), trunkMat);
      pole.position.set(x, 1.5, z + rng.range(-4, 4)); pole.castShadow = true; scene.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 8),
        new THREE.MeshLambertMaterial({ color: rng.pick(umbColors) }));
      top.position.set(x, 3.4, pole.position.z); top.castShadow = true; scene.add(top);
      box(1.8, 0.35, 0.8, new THREE.MeshLambertMaterial({ color: 0xffffff }), x + 1.5, 0.3, pole.position.z + 1.5);
    }
    // Palms lining the beachfront road (x = 180 line).
    for (let z = -225; z <= 225; z += 18) { palm(188, z, 1.15); palm(172, z + 9, 1.0); }
    // Boats bobbing offshore.
    for (let i = 0; i < 8; i++) {
      const bx = CFG.seaX + 18 + rng.range(0, 55);
      const bz = rng.range(-200, 200);
      const hull = box(7, 1.6, 2.6, new THREE.MeshLambertMaterial({ color: rng.pick(PAL.cars) }), bx, 0.4, bz);
      hull.rotation.y = rng.range(0, Math.PI);
      box(3, 1.4, 2, new THREE.MeshLambertMaterial({ color: 0xffffff }), bx, 1.8, bz);
    }
    // Boardwalk strip.
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(10, 480),
      new THREE.MeshLambertMaterial({ color: 0xc9a06a }));
    walk.rotation.x = -Math.PI / 2; walk.position.set(CFG.beachX + 2, 0.05, 0);
    walk.receiveShadow = true; scene.add(walk);
  }

  function buildPort(rng) {
    // Container yard + cranes on the north strip.
    const contColors = [0xd33a2c, 0x2c6fd3, 0x2fae5f, 0xf2c14e, 0xff7a1a, 0x17a2b8];
    for (let x = -220; x <= 160; x += 14) {
      const stack = rng.int(1, 3);
      for (let s = 0; s < stack; s++) {
        const w = 10, h = 3, d = 4;
        box(w, h, d, new THREE.MeshLambertMaterial({ color: rng.pick(contColors) }),
          x + rng.range(-2, 2), 1.5 + s * 3.1, -212 + rng.range(-8, 8));
      }
      if (rng.chance(0.5)) addCollider(x - 5, x + 5, -224, -200);
    }
    // Two gantry cranes.
    [-120, 40].forEach(function (cx) {
      const mat = new THREE.MeshLambertMaterial({ color: 0xf2c14e });
      box(2, 26, 2, mat, cx - 8, 13, -218);
      box(2, 26, 2, mat, cx + 8, 13, -218);
      box(22, 2.5, 3, mat, cx, 26, -218);
      box(3, 3, 3, new THREE.MeshLambertMaterial({ color: 0x222831 }), cx + 4, 23, -218);
      addCollider(cx - 10, cx + 10, -221, -215);
    });
    // Dock edge + a cargo ship silhouette.
    const dock = new THREE.Mesh(new THREE.PlaneGeometry(480, 12),
      new THREE.MeshLambertMaterial({ color: 0x8a8378 }));
    dock.rotation.x = -Math.PI / 2; dock.position.set(0, 0.05, -236); scene.add(dock);
    box(70, 8, 14, new THREE.MeshLambertMaterial({ color: 0x37475c }), -40, 2, -248);
    box(16, 10, 12, new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }), -60, 10, -248);
  }

  function buildMarina(rng) {
    // Wooden piers + moored boats in the south-east corner.
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
    for (let i = 0; i < 4; i++) {
      const z = 160 + i * 16;
      const pier = new THREE.Mesh(new THREE.PlaneGeometry(34, 3), pierMat);
      pier.rotation.x = -Math.PI / 2; pier.position.set(216, 0.1, z); scene.add(pier);
      for (let b = 0; b < 3; b++) {
        const bx = 202 + b * 11;
        box(6, 1.4, 2.4, new THREE.MeshLambertMaterial({ color: rng.pick(PAL.cars) }), bx, 0.3, z + 3.4);
        box(2.4, 1.2, 1.8, new THREE.MeshLambertMaterial({ color: 0xffffff }), bx, 1.5, z + 3.4);
      }
    }
    // Marina clubhouse.
    box(16, 7, 12, new THREE.MeshLambertMaterial({ map: windowTexture(0xe88ca0, 2, 4) }), 178, 3.5, 176);
    addCollider(170, 186, 170, 182);
  }

  function buildStreetProps(rng) {
    // Street lamps along every road, both sides, staggered.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 7, 5);
    const headGeo = new THREE.SphereGeometry(0.32, 6, 5);
    function onRoad(v) {
      return CFG.roadLines.some(function (c) { return Math.abs(v - c) < 8; });
    }
    function lampAt(x, z) {
      // Never plant a lamp in the middle of a cross street.
      if (onRoad(x) || onRoad(z)) return;
      if (x > CFG.beachX || z < CFG.portZ) return;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 3.5, z); pole.castShadow = true; scene.add(pole);
      const head = new THREE.Mesh(headGeo, lampMat);
      head.position.set(x, 7.1, z); scene.add(head);
    }
    CFG.roadLines.forEach(function (c) {
      for (let t = -225; t <= 225; t += 30) {
        lampAt(c - 9, t); lampAt(c + 9, t + 15);
        lampAt(t, c - 9); lampAt(t + 15, c + 9);
      }
    });
    // Scattered palms on sidewalks + a few downtown trees.
    for (let i = 0; i < 40; i++) {
      const line = rng.pick(CFG.roadLines);
      const along = rng.range(-220, 220);
      if (rng.chance(0.5)) palm(line + 9.5, along, rng.range(0.9, 1.2));
      else palm(along, line + 9.5, rng.range(0.9, 1.2));
    }
    // Colorful shop awnings on downtown blocks.
    const awnColors = [0xd33a2c, 0x2c6fd3, 0x2fae5f, 0xf2c14e];
    for (let i = 0; i < 18; i++) {
      const x = rng.range(-80, 80), z = rng.range(-80, 80);
      const line = CFG.roadLines.reduce(function (a, b) { return Math.abs(b - x) < Math.abs(a - x) ? b : a; });
      box(8, 0.4, 3, new THREE.MeshLambertMaterial({ color: rng.pick(awnColors) }), line + 10, 4.2, z);
    }
  }

  function buildBeacon() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.35, depthWrite: false });
    beaconMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), mat);
    beaconMesh.visible = false;
    scene.add(beaconMesh);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    beaconRing = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.2, 24), ringMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.visible = false;
    scene.add(beaconRing);
  }

  function build(scn) {
    scene = scn;
    MB.W.colliders.length = 0;
    const rng = MB.Random.makeRng(1337);
    buildGround();
    buildRoads();
    buildBuildings(rng);
    buildBeach(rng);
    buildPort(rng);
    buildMarina(rng);
    buildStreetProps(rng);
    buildBeacon();
  }

  function setBeacon(x, z, visible) {
    if (!beaconMesh) return;
    beaconMesh.visible = !!visible;
    beaconRing.visible = !!visible;
    if (visible) {
      beaconMesh.position.set(x, 30, z);
      beaconRing.position.set(x, 0.15, z);
    }
  }
  function pulseBeacon(t) {
    if (beaconMesh && beaconMesh.visible) {
      beaconMesh.material.opacity = 0.25 + 0.15 * Math.sin(t * 4);
      const s = 1 + 0.12 * Math.sin(t * 4);
      beaconRing.scale.set(s, s, 1);
    }
  }

  MB.City = {
    build: build,
    zoneAt: zoneAt,
    collideCircle: collideCircle,
    setBeacon: setBeacon,
    pulseBeacon: pulseBeacon,
    // Nearest road-line coordinate to a position (for traffic/ped routing).
    nearestRoadLine: function (v) {
      return CFG.roadLines.reduce(function (a, b) { return Math.abs(b - v) < Math.abs(a - v) ? b : a; });
    },
  };
})();
