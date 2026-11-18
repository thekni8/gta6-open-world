// Particles, skid marks, muzzle flashes and screen shake. One pooled
// THREE.Points cloud for sparks/smoke, plus flat ribbon quads for tyre marks.
export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.max = 600;
    this.positions = new Float32Array(this.max * 3);
    this.colors = new Float32Array(this.max * 3);
    this.items = [];
    for (let i = 0; i < this.max; i++) {
      this.items.push({ alive: false, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, gravity: 0, size: 1 });
      this.positions[i * 3 + 1] = -100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // Skid marks: a pool of flat dark quads laid on the road.
    this.skidGeo = new THREE.PlaneGeometry(0.35, 1.6);
    this.skidMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55, depthWrite: false });
    this.skids = [];
    this.skidIndex = 0;
    for (let i = 0; i < 120; i++) {
      const m = new THREE.Mesh(this.skidGeo, this.skidMat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = -10;
      m.visible = false;
      scene.add(m);
      this.skids.push(m);
    }
    this.shake = 0;
    this._color = new THREE.Color();
  }

  burst(x, y, z, { count = 12, color = 0xffcc66, speed = 6, life = 0.7, gravity = 9, up = 3 } = {}) {
    this._color.setHex(color);
    let spawned = 0;
    for (let i = 0; i < this.max && spawned < count; i++) {
      const p = this.items[i];
      if (p.alive) continue;
      p.alive = true;
      p.life = 0;
      p.maxLife = life * (0.6 + Math.random() * 0.8);
      p.gravity = gravity;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * s;
      p.vz = Math.sin(a) * s;
      p.vy = up * (0.4 + Math.random());
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      this.colors[i * 3] = this._color.r;
      this.colors[i * 3 + 1] = this._color.g;
      this.colors[i * 3 + 2] = this._color.b;
      spawned++;
    }
  }

  sparks(x, y, z) {
    this.burst(x, y, z, { count: 14, color: 0xffdd55, speed: 8, life: 0.5, gravity: 14, up: 4 });
  }

  smoke(x, y, z) {
    this.burst(x, y, z, { count: 8, color: 0x555555, speed: 1.5, life: 1.4, gravity: -1.5, up: 2 });
  }

  blood(x, y, z) {
    this.burst(x, y, z, { count: 10, color: 0xcc2222, speed: 4, life: 0.5, gravity: 10, up: 2 });
  }

  muzzle(x, y, z) {
    this.burst(x, y, z, { count: 6, color: 0xffe066, speed: 3, life: 0.12, gravity: 0, up: 0.5 });
  }

  cashBurst(x, y, z) {
    this.burst(x, y, z, { count: 18, color: 0x7be382, speed: 5, life: 0.9, gravity: 6, up: 5 });
  }

  addSkid(x, z, angle) {
    const m = this.skids[this.skidIndex];
    this.skidIndex = (this.skidIndex + 1) % this.skids.length;
    m.position.set(x, 0.06, z);
    m.rotation.z = -angle;
    m.visible = true;
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      if (!p.alive) continue;
      any = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.alive = false;
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      p.vy -= p.gravity * dt;
      this.positions[i * 3] += p.vx * dt;
      this.positions[i * 3 + 1] += p.vy * dt;
      this.positions[i * 3 + 2] += p.vz * dt;
      if (this.positions[i * 3 + 1] < 0.05) {
        this.positions[i * 3 + 1] = 0.05;
        p.vy = 0;
      }
    }
    if (any) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
  }

  shakeOffset() {
    if (this.shake <= 0.01) return { x: 0, y: 0 };
    const s = this.shake * 0.35;
    return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
  }
}
