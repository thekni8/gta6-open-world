// Effects — impact sparks, damage smoke, skid marks and screen shake.
// All cheap Three.js primitives, pooled so the frame rate stays up.
import * as THREE from 'three';

export function createEffects(scene) {
  return {
    scene,
    particles: [], // {mesh, vel, life, maxLife}
    skids: [],
    shake: 0,
    smokeTimer: 0,
  };
}

const SPARK_COLORS = [0xffd23e, 0xff7a2a, 0xffffff];

/** Burst of sparks at a point (crashes, bullet hits). */
export function spawnSparks(fx, x, y, z, count = 10) {
  for (let i = 0; i < count; i += 1) {
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SPARK_COLORS[i % SPARK_COLORS.length] }));
    mesh.position.set(x, y, z);
    fx.scene.add(mesh);
    fx.particles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 7 + 2, (Math.random() - 0.5) * 10),
      life: 0.5,
      maxLife: 0.5,
      gravity: -18,
      fade: true,
    });
  }
}

/** A puff of grey smoke (damaged cars, exhaust on hard acceleration). */
export function spawnSmoke(fx, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5 }),
  );
  mesh.position.set(x, y, z);
  fx.scene.add(mesh);
  fx.particles.push({
    mesh,
    vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 2.2, (Math.random() - 0.5) * 1.5),
    life: 1.1,
    maxLife: 1.1,
    gravity: 0.5,
    fade: true,
    grow: true,
  });
}

/** A dark skid quad on the road under a sliding car. */
export function spawnSkid(fx, x, z, heading) {
  if (fx.skids.length > 60) {
    const old = fx.skids.shift();
    fx.scene.remove(old);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x14161a, transparent: true, opacity: 0.55 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -heading;
  mesh.position.set(x, 0.25, z);
  fx.scene.add(mesh);
  fx.skids.push(mesh);
}

/** Kick the camera. `amount` 0..1. */
export function addShake(fx, amount) {
  fx.shake = Math.min(1, fx.shake + amount);
}

export function updateEffects(fx, dt, damagedCars) {
  for (const p of fx.particles) {
    p.life -= dt;
    p.vel.y += p.gravity * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.fade) p.mesh.material.opacity = Math.max(0, p.life / p.maxLife) * 0.6;
    if (p.grow) p.mesh.scale.setScalar(1 + (1 - p.life / p.maxLife) * 2);
  }
  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    if (fx.particles[i].life <= 0) {
      fx.scene.remove(fx.particles[i].mesh);
      fx.particles.splice(i, 1);
    }
  }
  fx.shake = Math.max(0, fx.shake - dt * 2.2);
  // Damaged cars trail smoke.
  fx.smokeTimer -= dt;
  if (fx.smokeTimer <= 0) {
    fx.smokeTimer = 0.25;
    for (const car of damagedCars) {
      if (car.damage > 0.35 && car.health > 0) {
        spawnSmoke(fx, car.pos.x, 1.2, car.pos.z);
      }
    }
  }
}

/** The frame's camera shake offset (added to the camera after lookAt). */
export function shakeOffset(fx) {
  const s = fx.shake * fx.shake * 0.5;
  return new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0);
}
