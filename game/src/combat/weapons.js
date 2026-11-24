// Combat: the 9mm pistol with crosshair shooting, muzzle flash, bullet
// tracers, hit sparks and floating damage numbers — plus a melee swing.

import { CONFIG } from '../config.js';

export class Weapons {
  constructor(scene, particles, hooks) {
    this.scene = scene;
    this.particles = particles;
    this.hooks = hooks; // { onDamageNumber(pos, amount), onShoot(), onKill(enemy) }
    this.ammo = CONFIG.pistolMag;
    this.reserve = CONFIG.pistolReserveStart;
    this.cooldown = 0;
    this.raycaster = new THREE.Raycaster();

    // Muzzle flash: a bright cone + a camera-facing glow sprite + a point
    // light, shown for a blink. The sprite is what reads from behind.
    this.flash = new THREE.Group();
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd76a, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.3, 8), flashMat);
    cone.rotation.x = Math.PI / 2;
    this.flash.add(cone);
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 64;
    glowCanvas.height = 64;
    const gctx = glowCanvas.getContext('2d');
    const grad = gctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,240,180,1)');
    grad.addColorStop(0.4, 'rgba(255,200,80,0.85)');
    grad.addColorStop(1, 'rgba(255,160,40,0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 64, 64);
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCanvas),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    glowSprite.scale.set(2.4, 2.4, 1);
    this.flash.add(glowSprite);
    this.flashLight = new THREE.PointLight(0xffc860, 20, 14, 2);
    this.flash.add(this.flashLight);
    this.flash.visible = false;
    scene.add(this.flash);
    this.flashTimer = 0;

    // Tracer: one reusable line, re-aimed every shot.
    const tracerGeo = new THREE.BufferGeometry();
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.9,
    }));
    this.tracer.visible = false;
    this.tracer.frustumCulled = false;
    scene.add(this.tracer);
    this.tracerTimer = 0;
  }

  get canFire() {
    return this.cooldown <= 0 && this.ammo > 0;
  }

  reload() {
    if (this.reserve <= 0 || this.ammo >= CONFIG.pistolMag) return false;
    const need = CONFIG.pistolMag - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    this.cooldown = Math.max(this.cooldown, 0.5);
    return true;
  }

  // Fire from origin along dir. targets: enemy meshes. solids: building meshes.
  // Returns the enemy hit (or null).
  shoot(origin, dir, targets, solids) {
    if (!this.canFire) return null;
    this.ammo--;
    this.cooldown = CONFIG.pistolFireInterval;
    this.hooks.onShoot?.();

    this.raycaster.set(origin, dir);
    this.raycaster.far = CONFIG.pistolRange;
    const hits = this.raycaster.intersectObjects([...targets, ...solids], false);
    const end = hits.length > 0
      ? hits[0].point.clone()
      : origin.clone().addScaledVector(dir, CONFIG.pistolRange);

    // Muzzle flash at the gun, tracer to the impact, sparks on the hit.
    this.flash.position.copy(origin).addScaledVector(dir, 0.5);
    this.flash.lookAt(end);
    this.flash.visible = true;
    this.flashTimer = 0.25;
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, origin.x, origin.y, origin.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.tracer.visible = true;
    this.tracerTimer = 0.3;

    let hitEnemy = null;
    if (hits.length > 0) {
      const hit = hits[0];
      const enemy = hit.object.userData.enemy;
      if (enemy && enemy.alive) {
        hitEnemy = enemy;
        this.particles.burst(end, 0xff5040, 10, 5, 0.45);
        this.hooks.onDamageNumber?.(end, CONFIG.pistolDamage);
      } else {
        this.particles.burst(end, 0xffd76a, 8, 4, 0.4);
      }
    }
    return hitEnemy;
  }

  // Draw an enemy tracer (their shot at the player).
  enemyShot(from, to) {
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    this.tracer.visible = true;
    this.tracerTimer = 0.15;
    this.particles.burst(to, 0xffd76a, 5, 3, 0.3);
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.visible = false;
    }
    if (this.tracerTimer > 0) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0) this.tracer.visible = false;
    }
  }
}
