// Kai Mercer on foot: capsule character with walk/run, simple leg-swing
// animation, health, and getting in and out of cars. Driving itself lives
// in vehicles/cars.js.
import { CFG } from '../config.js';
import { clamp } from '../util/random.js';

export function buildCharacterMesh(shirt = 0x2a7fd8, skin = 0xc98a5a) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.05, 0.5),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  torso.position.y = 1.15;
  torso.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.52, 0.5),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.98;
  head.castShadow = true;
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.18, 0.54),
    new THREE.MeshLambertMaterial({ color: 0x201510 }),
  );
  hair.position.y = 2.28;
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2b3240 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.4), legMat);
  legL.position.set(-0.24, 0.42, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.4), legMat);
  legR.position.set(0.24, 0.42, 0);
  const armMat = new THREE.MeshLambertMaterial({ color: shirt });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.32), armMat);
  armL.position.set(-0.6, 1.15, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.32), armMat);
  armR.position.set(0.6, 1.15, 0);
  g.add(torso, head, hair, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, torso };
  return g;
}

export function createPlayer(scene, x, z) {
  const group = buildCharacterMesh();
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    group,
    heading: 0,
    health: CFG.playerHealth,
    inCar: null,
    walkPhase: 0,
    moving: false,
    get x() { return group.position.x; },
    get z() { return group.position.z; },
    setPos(x, z) { group.position.x = x; group.position.z = z; },
    damage(amount) {
      this.health = Math.max(0, this.health - amount);
      return this.health <= 0;
    },
    heal(amount) { this.health = Math.min(CFG.playerHealth, this.health + amount); },
    // On-foot movement, camera-relative. Returns speed for the camera/audio.
    updateOnFoot(input, city, cameraYaw, dt) {
      const a = input.axis();
      const sprint = input.sprint();
      const speed = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
      // Forward is where the camera looks: the camera sits at
      // target + (sin yaw, cos yaw), so it looks along -(sin yaw, cos yaw).
      const fx = -Math.sin(cameraYaw), fz = -Math.cos(cameraYaw);
      const sx = Math.cos(cameraYaw), sz = -Math.sin(cameraYaw);
      let mx = fx * a.f + sx * a.s;
      let mz = fz * a.f + sz * a.s;
      const len = Math.hypot(mx, mz);
      this.moving = len > 0.01;
      if (this.moving) {
        mx /= len; mz /= len;
        const target = Math.atan2(mx, mz);
        let d = target - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.heading += clamp(d, -10 * dt, 10 * dt);
        group.rotation.y = this.heading;
        const nx = this.x + mx * speed * dt;
        const nz = this.z + mz * speed * dt;
        const fixed = city.resolveCircle(nx, nz, CFG.playerRadius);
        this.setPos(fixed.x, fixed.z);
        this.walkPhase += dt * (sprint ? 13 : 9);
      }
      // Leg/arm swing, eases to a stand when idle.
      const amp = this.moving ? 0.55 : 0;
      const s = Math.sin(this.walkPhase);
      const u = group.userData;
      u.legL.rotation.x = s * amp;
      u.legR.rotation.x = -s * amp;
      u.armL.rotation.x = -s * amp * 0.7;
      u.armR.rotation.x = s * amp * 0.7;
      return this.moving ? speed : 0;
    },
  };
}
