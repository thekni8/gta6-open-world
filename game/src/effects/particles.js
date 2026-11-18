// Particles and skid marks. One pooled THREE.Points cloud carries
// sparks, smoke, exhaust, blood, and explosions — a few hundred short-lived
// points, recycled rather than re-created. Tyres leave fading dark quads
// on the asphalt when a car slides.

import * as THREE from 'three';

const POOL_SIZE = 700;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.live = []; // {x,y,z, vx,vy,vz, life, span, r,g,b, gravity}
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POOL_SIZE * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(POOL_SIZE * 3), 3));
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.cloud = new THREE.Points(geo, mat);
    this.cloud.frustumCulled = false;
    scene.add(this.cloud);
    this.skids = []; // {mesh, life}
    this.skidMat = new THREE.MeshBasicMaterial({
      color: 0x14161a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
  }

  burst(x, y, z, count, color, speed, lift, life, gravity = -6) {
    for (let i = 0; i < count; i++) {
      if (this.live.length >= POOL_SIZE) this.live.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      const span = life * (0.6 + Math.random() * 0.6);
      this.live.push({
        x, y, z,
        vx: Math.cos(a) * s,
        vy: lift * (0.5 + Math.random()),
        vz: Math.sin(a) * s,
        life: span,
        span,
        r: color.r,
        g: color.g,
        b: color.b,
        gravity,
      });
    }
  }

  spark(x, y, z, count = 14) {
    this.burst(x, y, z, count, { r: 1, g: 0.85, b: 0.4 }, 6, 3, 0.5, -9);
  }

  smoke(x, y, z) {
    this.burst(x, y, z, 2, { r: 0.25, g: 0.25, b: 0.25 }, 0.8, 1.6, 1.4, 1.5);
  }

  /** Exhaust puff from a speeding car: faint, fast-fading, drifts up. */
  exhaust(x, y, z) {
    this.burst(x, y, z, 1, { r: 0.22, g: 0.22, b: 0.24 }, 0.5, 1.2, 0.7, 2.0);
  }

  blood(x, y, z) {
    this.burst(x, y, z, 10, { r: 0.6, g: 0.05, b: 0.05 }, 3, 2, 0.5, -9);
  }

  explosion(x, y, z) {
    this.burst(x, y, z, 42, { r: 1, g: 0.5, b: 0.1 }, 9, 6, 0.8, -7);
    this.burst(x, y, z, 26, { r: 0.2, g: 0.2, b: 0.2 }, 4, 5, 1.6, 1.5);
  }

  /** A skid quad under a sliding car, fading over nine seconds. */
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
    const posAttr = this.cloud.geometry.getAttribute('position');
    const colAttr = this.cloud.geometry.getAttribute('color');
    let n = 0;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.live.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy = 0;
      }
      const fade = p.life / p.span;
      posAttr.setXYZ(n, p.x, p.y, p.z);
      colAttr.setXYZ(n, p.r * fade, p.g * fade, p.b * fade);
      n++;
    }
    // Park the unused tail of the buffer far below the world.
    for (let i = n; i < POOL_SIZE; i++) posAttr.setXYZ(i, 0, -100, 0);
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
