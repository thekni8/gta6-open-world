// Juice: spark/smoke particle bursts, muzzle flashes, crash debris, skid
// marks that fade on the asphalt, and the screen-shake hook the camera
// reads. One pooled THREE.Points cloud keeps it cheap.
export function createEffects(scene, cameraRig) {
  const MAX = 420;
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const parts = [];
  for (let i = 0; i < MAX; i++) {
    parts.push({ alive: false, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, gravity: 0, size: 1 });
    positions[i * 3 + 1] = -100;
  }
  // Round soft particle sprite (radial gradient) — no square confetti.
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = 32; spriteCanvas.height = 32;
  const sg = spriteCanvas.getContext('2d');
  const grad = sg.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 32, 32);
  const spriteTex = new THREE.CanvasTexture(spriteCanvas);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, sizeAttenuation: true, map: spriteTex, alphaTest: 0.01,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const skidMat = new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.55, depthWrite: false });
  const skidGeo = new THREE.PlaneGeometry(0.5, 2.4);
  skidGeo.rotateX(-Math.PI / 2);
  const skids = [];
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b, gravity = 9) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX;
    p.alive = true; p.life = life; p.maxLife = life;
    p.vx = vx; p.vy = vy; p.vz = vz; p.gravity = gravity;
    const i = parts.indexOf(p);
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }

  function burst(x, y, z, n, color, speed, life, gravity) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.2;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawn(x, y, z, Math.cos(a) * s, up * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.7),
        color[0], color[1], color[2], gravity);
    }
  }

  return {
    hitSpark(x, y, z) { burst(x, y, z, 10, [1, 0.85, 0.3], 6, 0.5, 12); },
    crash(x, z, speed) {
      burst(x, 1, z, 12, [1, 0.7, 0.2], 8, 0.7, 10);
      burst(x, 1.2, z, 6, [0.5, 0.5, 0.5], 3, 1.2, -1);
      cameraRig?.addShake(Math.min(0.6, speed * 0.02));
    },
    muzzle(camera) {
      // A quick flash at the bottom-right of the view (the gun's position).
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const p = camera.position.clone().add(dir.multiplyScalar(2.2));
      p.y -= 0.5;
      burst(p.x, p.y, p.z, 6, [1, 0.9, 0.4], 3, 0.16, 0);
    },
    enemyMuzzle(x, z, heading) {
      burst(x + Math.sin(heading), 1.5, z + Math.cos(heading), 5, [1, 0.85, 0.3], 3, 0.15, 0);
    },
    smoke(x, y, z) { burst(x, y, z, 3, [0.45, 0.45, 0.45], 1.5, 1.4, -2); },
    skid(x, z, heading) {
      if (skids.length > 90) {
        const old = skids.shift();
        scene.remove(old.mesh);
      }
      const mesh = new THREE.Mesh(skidGeo, skidMat.clone());
      mesh.position.set(x, 0.06, z);
      mesh.rotation.y = heading;
      mesh.material.opacity = 0.55;
      scene.add(mesh);
      skids.push({ mesh, life: 9 });
    },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = parts[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          positions[i * 3 + 1] = -100;
          continue;
        }
        p.vy -= p.gravity * dt;
        positions[i * 3] += p.vx * dt;
        positions[i * 3 + 1] += p.vy * dt;
        positions[i * 3 + 2] += p.vz * dt;
        if (positions[i * 3 + 1] < 0.1) positions[i * 3 + 1] = 0.1;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      for (let i = skids.length - 1; i >= 0; i--) {
        skids[i].life -= dt;
        skids[i].mesh.material.opacity = Math.max(0, skids[i].life / 9) * 0.55;
        if (skids[i].life <= 0) {
          scene.remove(skids[i].mesh);
          skids.splice(i, 1);
        }
      }
    },
  };
}
