// Particles and skid marks: one pooled THREE.Points cloud for sparks,
// smoke and blood, plus fading dark quads the tyres leave behind, and a
// small explosion helper for destroyed cars.

import * as THREE from 'three';

const MAX_PARTICLES = 600;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.items = []; // {pos, vel, life, maxLife, size, color, gravity}
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
    const mat = new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.skids = [];
    this.skidMat = new THREE.MeshBasicMaterial({ color: 0x14161a, transparent: true, opacity: 0.55, depthWrite: false });
  }

  emit(x, y, z, count, color, speed, up, life, gravity = -6) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= MAX_PARTICLES) this.items.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.items.push({
        x, y, z,
        vx: Math.cos(a) * s,
        vy: up * (0.5 + Math.random()),
        vz: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.6),
        maxLife: life,
        r: color.r, g: color.g, b: color.b,
        gravity,
      });
    }
  }

  spark(x, y, z, count = 8) {
    this.emit(x, y, z, count, { r: 1, g: 0.85, b: 0.4 }, 5, 3, 0.4, -9);
  }

  smoke(x, y, z) {
    this.emit(x, y, z, 2, { r: 0.25, g: 0.25, b: 0.25 }, 0.8, 1.6, 1.4, 1.5);
  }

  blood(x, y, z) {
    this.emit(x, y, z, 10, { r: 0.6, g: 0.05, b: 0.05 }, 3, 2, 0.5, -9);
  }

  explosion(x, y, z) {
    this.emit(x, y, z, 40, { r: 1, g: 0.5, b: 0.1 }, 9, 6, 0.8, -7);
    this.emit(x, y, z, 25, { r: 0.2, g: 0.2, b: 0.2 }, 4, 5, 1.6, 1.5);
  }

  /** A skid quad under a sliding car. */
  skid(x, z, heading) {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1.6), this.skidMat);
    quad.rotation.x = -Math.PI / 2;
    quad.rotation.z = -heading;
    quad.position.set(x, 0.06, z);
    this.scene.add(quad);
    this.skids.push({ mesh: quad, life: 9 });
    if (this.skids.length > 120) {
      const old = this.skids.shift();
      this.scene.remove(old.mesh);
    }
  }

  update(dt) {
    // Particles.
    const posAttr = this.points.geometry.getAttribute('position');
    const colAttr = this.points.geometry.getAttribute('color');
    let n = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
      const fade = p.life / p.maxLife;
      posAttr.setXYZ(n, p.x, p.y, p.z);
      colAttr.setXYZ(n, p.r * fade, p.g * fade, p.b * fade);
      n++;
    }
    // Hide the unused tail of the buffer.
    for (let i = n; i < MAX_PARTICLES; i++) posAttr.setXYZ(i, 0, -100, 0);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    // Skid marks fade out.
    for (let i = this.skids.length - 1; i >= 0; i--) {
      const s = this.skids[i];
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, 0.55 * (s.life / 9));
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.skids.splice(i, 1);
      }
    }
  }
}
