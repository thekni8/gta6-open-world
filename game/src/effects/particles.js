/* Particles, skid marks, muzzle flashes, and screen shake.
   One pooled THREE.Points cloud for sparks/smoke; skid marks are flat
   dark quads that fade; shake is a decaying camera offset. */
(function () {
  const MAX = 420;
  let points = null, geo = null;
  let pos = null, vel = [], life = [], maxLife = [], col = null;
  let skids = [];
  let shakeAmt = 0;
  const tmpColor = new THREE.Color();

  function init(scene) {
    geo = new THREE.BufferGeometry();
    pos = new Float32Array(MAX * 3);
    col = new Float32Array(MAX * 3);
    for (let i = 0; i < MAX; i++) {
      pos[i * 3 + 1] = -100; // park below ground
      vel.push(new THREE.Vector3());
      life.push(0); maxLife.push(1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
  }

  let cursor = 0;
  function spawn(x, y, z, vx, vy, vz, ttl, hex) {
    const i = cursor; cursor = (cursor + 1) % MAX;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i].set(vx, vy, vz);
    life[i] = ttl; maxLife[i] = ttl;
    tmpColor.setHex(hex);
    col[i * 3] = tmpColor.r; col[i * 3 + 1] = tmpColor.g; col[i * 3 + 2] = tmpColor.b;
  }

  function burst(x, y, z, n, hex, speed) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, up = Math.random() * 3 + 1;
      const s = (Math.random() * 0.7 + 0.3) * (speed || 5);
      spawn(x, y, z, Math.cos(a) * s, up, Math.sin(a) * s, 0.4 + Math.random() * 0.5, hex);
    }
  }

  const skidGeo = new THREE.PlaneGeometry(0.5, 1.4);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false });
  function addSkid(x, z, heading) {
    if (skids.length > 220) {
      const old = skids.shift();
      MB.W.scene.remove(old.mesh);
    }
    const m = new THREE.Mesh(skidGeo, skidMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = -heading;
    m.position.set(x, 0.06, z);
    MB.W.scene.add(m);
    skids.push({ mesh: m, life: 9 });
  }

  function update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { pos[i * 3 + 1] = -100; continue; }
      vel[i].y -= 9 * dt;
      pos[i * 3] += vel[i].x * dt;
      pos[i * 3 + 1] += vel[i].y * dt;
      pos[i * 3 + 2] += vel[i].z * dt;
      if (pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 0.05; vel[i].y *= -0.3; }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    for (let i = skids.length - 1; i >= 0; i--) {
      skids[i].life -= dt;
      if (skids[i].life <= 0) {
        MB.W.scene.remove(skids[i].mesh);
        skids.splice(i, 1);
      }
    }
    shakeAmt = Math.max(0, shakeAmt - dt * 2.2);
  }

  MB.FX = {
    init: init,
    update: update,
    sparks: function (x, y, z) { burst(x, y, z, 14, 0xffc93c, 7); },
    smoke: function (x, y, z) { burst(x, y, z, 6, 0x888888, 2.5); },
    blood: function (x, y, z) { burst(x, y, z, 10, 0xc22a1e, 4); },
    muzzle: function (x, y, z) { burst(x, y, z, 5, 0xffe27a, 6); },
    skid: addSkid,
    shake: function (amt) { shakeAmt = Math.min(1.2, shakeAmt + amt); },
    shakeOffset: function () {
      if (shakeAmt <= 0.01) return { x: 0, y: 0 };
      return { x: (Math.random() - 0.5) * shakeAmt * 0.7, y: (Math.random() - 0.5) * shakeAmt * 0.7 };
    },
  };
})();
