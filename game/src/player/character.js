// Kai Mercer on foot: movement, a simple walk-cycle animation, health,
// and the handoff to a car when he climbs in.

import { CONFIG } from '../config.js';
import { resolveCircle } from '../world/city.js';

export class Character {
  constructor(scene, colliders) {
    this.colliders = colliders;
    this.group = new THREE.Group();
    this.hp = CONFIG.playerMaxHp;
    this.heading = 0; // radians, facing direction
    this.speed = 0;
    this.walkPhase = 0;
    this.moving = false;

    const jacket = new THREE.MeshLambertMaterial({ color: 0x2e8b8b });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const hair = new THREE.MeshLambertMaterial({ color: 0x1c1a17 });

    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.62, 4, 10), jacket);
    this.torso.position.y = 1.18;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
    this.head.position.y = 1.92;
    this.head.castShadow = true;
    this.group.add(this.head);
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, 1.1), hair);
    hairTop.position.y = 1.96;
    this.group.add(hairTop);

    this.legL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.78, 8), pants);
    this.legL.position.set(-0.16, 0.42, 0);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.16;
    this.group.add(this.legL, this.legR);

    this.armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.66, 8), jacket);
    this.armL.position.set(-0.46, 1.2, 0);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.46;
    this.group.add(this.armL, this.armR);

    // The pistol in his right hand.
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    this.gun = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.34), gunMat);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.07), gunMat);
    grip.position.set(0, -0.09, 0.1);
    this.gun.add(barrel, grip);
    this.gun.position.set(0.46, 0.95, 0.28);
    this.gun.rotation.x = Math.PI / 2;
    this.group.add(this.gun);

    scene.add(this.group);
    this.position = this.group.position;
    this.position.set(0, 0, 0);
  }

  get x() { return this.position.x; }
  get z() { return this.position.z; }

  setPosition(x, z, heading = 0) {
    this.position.set(x, 0, z);
    this.heading = heading;
    this.group.rotation.y = heading;
  }

  // Move relative to the camera yaw. Returns true while actually moving.
  update(dt, input, camYaw) {
    const axes = input.moveAxes();
    const sprint = input.isDown('shift');
    const maxSpeed = sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed;
    let mx = 0;
    let mz = 0;
    if (axes.forward !== 0 || axes.strafe !== 0) {
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      // Camera looks along -Z rotated by yaw; forward is (-sin, -cos).
      mx = -sin * axes.forward + cos * axes.strafe;
      mz = -cos * axes.forward - sin * axes.strafe;
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      this.heading = Math.atan2(mx, mz);
      this.group.rotation.y = this.heading;
    }
    const target = (axes.forward !== 0 || axes.strafe !== 0) ? maxSpeed : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    this.moving = this.speed > 0.3;
    if (this.moving) {
      this.position.x += mx * this.speed * dt;
      this.position.z += mz * this.speed * dt;
      resolveCircle(this.position, CONFIG.playerRadius, this.colliders);
      this.walkPhase += dt * this.speed * 1.35;
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.7;
      this.armR.rotation.x = swing * 0.7;
      this.torso.position.y = 1.18 + Math.abs(Math.sin(this.walkPhase)) * 0.05;
    } else {
      this.legL.rotation.x *= 0.8;
      this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8;
      this.armR.rotation.x *= 0.8;
    }
    // Keep inside the playable map.
    this.position.x = Math.max(-CONFIG.worldBound, Math.min(CONFIG.worldBound + 90, this.position.x));
    this.position.z = Math.max(-CONFIG.worldBound, Math.min(330, this.position.z));
    return this.moving;
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  }

  heal(amount) {
    this.hp = Math.min(CONFIG.playerMaxHp, this.hp + amount);
  }

  // World position of the gun muzzle, for tracers and flashes.
  muzzleWorld(out) {
    out.set(0.46, 1.35, 0.5);
    return this.group.localToWorld(out);
  }

  setVisible(v) {
    this.group.visible = v;
  }
}
