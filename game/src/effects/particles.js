// Juice: pooled particles (sparks, smoke, muzzle flashes, explosions),
// fading skid marks on the asphalt, and the screen-shake amount the camera
// reads every frame.

const THREE = window.THREE;
const MAX_PARTICLES = 500;

// A soft round sprite so particles read as sparks and puffs, not the
// hard squares PointsMaterial draws by default.
function makeSoftCircleTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class Effects {
  constructor(G) {
    this.G = G;
    this.shakeAmount = 0;
    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        alive: false, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, gravity: 0,
      });
    }
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    for (let i = 0; i < MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -100;
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.42, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true, map: makeSoftCircleTexture(),
      alphaTest: 0.02,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    G.scene.add(this.points);
    // One reusable point light for muzzle flashes and explosions.
    this.flashLight = new THREE.PointLight(0xffcc66, 0, 26, 1.8);
    G.scene.add(this.flashLight);
    this.flashTimer = 0;
    // Skid marks: a pool of flat dark quads reused oldest-first.
    this.skidPool = [];
    this.skidIndex = 0;
    const skidGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 140; i++) {
      const m = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({
        color: 0x111111, transparent: true, opacity: 0, depthWrite: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.08;
      m.visible = false;
      m.userData.fade = 0;
      G.scene.add(m);
      this.skidPool.push(m);
    }
  }

  shake(amount) {
    this.shakeAmount = Math.min(1.2, this.shakeAmount + amount);
  }

  spawn(x, y, z, vx, vy, vz, life, colorHex, gravity) {
    const p = this.particles.find((q) => !q.alive);
    if (!p) return;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = life;
    p.maxLife = life;
    p.gravity = gravity || 0;
    const c = new THREE.Color(colorHex);
    const idx = this.particles.indexOf(p);
    this.colors[idx * 3] = c.r;
    this.colors[idx * 3 + 1] = c.g;
    this.colors[idx * 3 + 2] = c.b;
  }

  burst(x, y, z, colorHex, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, z, Math.cos(a) * s, up * s, Math.sin(a) * s, 0.5 + Math.random() * 0.5, colorHex, 6);
    }
  }

  sparks(x, y, z, count) {
    this.burst(x, y, z, 0xffcc44, count, 6);
    this.burst(x, y, z, 0xffffff, Math.ceil(count / 2), 4);
  }

  smoke(x, y, z) {
    this.spawn(
      x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.8, 1.6 + Math.random(), (Math.random() - 0.5) * 0.8,
      1.4 + Math.random() * 0.8, 0x555555, -0.5,
    );
  }

  muzzle(x, y, z, heading) {
    this.flashLight.position.set(x + Math.sin(heading) * 1.2, y, z + Math.cos(heading) * 1.2);
    this.flashLight.intensity = 14;
    this.flashTimer = 0.06;
    this.burst(x + Math.sin(heading), y, z + Math.cos(heading), 0xffdd55, 4, 5);
  }

  explosion(x, y, z) {
    this.flashLight.position.set(x, y + 2, z);
    this.flashLight.color.setHex(0xff7722);
    this.flashLight.intensity = 60;
    this.flashTimer = 0.35;
    this.burst(x, y + 1, z, 0xff6622, 26, 9);
    this.burst(x, y + 1, z, 0xffcc44, 18, 6);
    this.burst(x, y + 1, z, 0x333333, 14, 3.5);
  }

  skidMark(x1, z1, x2, z2) {
    const m = this.skidPool[this.skidIndex];
    this.skidIndex = (this.skidIndex + 1) % this.skidPool.length;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return;
    m.position.set((x1 + x2) / 2, 0.08, (z1 + z2) / 2);
    m.scale.set(0.55, Math.max(0.5, len), 1);
    m.rotation.z = -Math.atan2(dx, dz);
    m.material.opacity = 0.55;
    m.visible = true;
    m.userData.fade = 9;
  }

  update(dt) {
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.2);
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flashLight.intensity = 0;
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy = 0;
      }
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    for (const m of this.skidPool) {
      if (!m.visible) continue;
      m.userData.fade -= dt;
      if (m.userData.fade <= 0) {
        m.visible = false;
        m.material.opacity = 0;
      } else if (m.userData.fade < 3) {
        m.material.opacity = 0.55 * (m.userData.fade / 3);
      }
    }
  }
}
