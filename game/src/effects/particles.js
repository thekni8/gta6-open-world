// Particles and skid marks: sparks, smoke and dust from one pooled
// THREE.Points cloud, plus dark rubber laid down by handbrake turns.

const MAX_PARTICLES = 800;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.gravity = new Float32Array(MAX_PARTICLES);
    this.cursor = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.22, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);

    // Skid marks: a pool of dark flat quads.
    this.skids = [];
    this.skidMat = new THREE.MeshBasicMaterial({ color: 0x141518, transparent: true, opacity: 0.7 });
    this.skidGeo = new THREE.PlaneGeometry(0.4, 1.4);
    this.skidCursor = 0;
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(this.skidGeo, this.skidMat.clone());
      m.rotation.x = -Math.PI / 2;
      m.position.y = -999;
      m.visible = false;
      scene.add(m);
      this.skids.push({ mesh: m, life: 0 });
    }
  }

  burst(pos, colorHex, count, speed, life, gravity = 9) {
    const c = new THREE.Color(colorHex);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      this.positions[i * 3] = pos.x;
      this.positions[i * 3 + 1] = pos.y;
      this.positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.velocities[i * 3] = Math.cos(a) * s;
      this.velocities[i * 3 + 1] = up * s;
      this.velocities[i * 3 + 2] = Math.sin(a) * s;
      this.colors[i * 3] = c.r;
      this.colors[i * 3 + 1] = c.g;
      this.colors[i * 3 + 2] = c.b;
      this.life[i] = life * (0.6 + Math.random() * 0.7);
      this.maxLife[i] = this.life[i];
      this.gravity[i] = gravity;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  smoke(pos, count = 2) {
    this.burst(pos, 0x777777, count, 1.2, 1.4, -1.5);
  }

  laySkid(x, z, heading) {
    const s = this.skids[this.skidCursor];
    this.skidCursor = (this.skidCursor + 1) % this.skids.length;
    s.mesh.position.set(x, 0.05, z);
    s.mesh.rotation.z = heading;
    s.mesh.visible = true;
    s.mesh.material.opacity = 0.7;
    s.life = 9;
  }

  update(dt) {
    let anyAlive = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      anyAlive = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -999;
        continue;
      }
      this.velocities[i * 3 + 1] -= this.gravity[i] * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      if (this.positions[i * 3 + 1] < 0.05) this.positions[i * 3 + 1] = 0.05;
    }
    if (anyAlive) this.points.geometry.attributes.position.needsUpdate = true;
    for (const s of this.skids) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, (s.life / 9) * 0.7);
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
}
