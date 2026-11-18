// Kai Mercer on foot: WASD movement relative to the camera, sprint, health,
// entering/exiting cars, and the punch/shoot stance the camera reads.
import { CONFIG } from '../config.js';

export class Player {
  constructor(scene, city, startX, startZ) {
    this.scene = scene;
    this.city = city;
    this.pos = new THREE.Vector3(startX, 0, startZ);
    this.angle = Math.PI; // facing the camera start view
    this.health = CONFIG.player.maxHealth;
    this.ammo = CONFIG.player.pistolAmmo;
    this.reserve = CONFIG.player.pistolReserve;
    this.inCar = false;
    this.car = null;
    this.moving = false;
    this.sprinting = false;
    this.walkPhase = 0;
    this.stepTimer = 0;
    this.punchTimer = 0;
    this.dead = false;

    this.group = new THREE.Group();
    const jacket = new THREE.MeshStandardMaterial({ color: 0x1f6f8b, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98d5a, roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.8, 3, 10), jacket);
    body.position.y = 1.08;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.86;
    head.castShadow = true;
    // Kai's teal cap — the one recognisable silhouette in a crowd.
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0f4c5c, roughness: 0.7 }),
    );
    cap.position.y = 1.9;
    const brim = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.05, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0f4c5c, roughness: 0.7 }),
    );
    brim.position.set(0, 1.92, 0.28);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.22), pants);
    this.legL.position.set(-0.15, 0.32, 0);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.22), pants);
    this.legR.position.set(0.15, 0.32, 0);
    // Arms: swing while walking, raise when aiming.
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.16), jacket);
    this.armL.position.set(-0.46, 1.32, 0);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.16), jacket);
    this.armR.position.set(0.46, 1.32, 0);
    // The pistol, visible in the right hand.
    this.gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.14, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }),
    );
    this.gun.position.set(0.46, 1.05, 0.28);
    this.group.add(body, head, cap, brim, this.legL, this.legR, this.armL, this.armR, this.gun);
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  update(dt, game) {
    const input = game.input;
    if (this.dead) return;
    if (this.inCar) {
      this._driveCar(dt, game);
      return;
    }
    // On-foot movement, relative to the camera yaw.
    const yaw = game.cameraRig.yaw;
    let mx = 0;
    let mz = 0;
    if (input.down('KeyW')) { mx += -Math.sin(yaw); mz += -Math.cos(yaw); }
    if (input.down('KeyS')) { mx += Math.sin(yaw); mz += Math.cos(yaw); }
    if (input.down('KeyA')) { mx += -Math.cos(yaw); mz += Math.sin(yaw); }
    if (input.down('KeyD')) { mx += Math.cos(yaw); mz += -Math.sin(yaw); }
    const len = Math.hypot(mx, mz);
    this.moving = len > 0.01;
    this.sprinting = this.moving && input.down('ShiftLeft');
    if (this.moving) {
      mx /= len;
      mz /= len;
      const speed = this.sprinting ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed;
      const prevX = this.pos.x;
      const prevZ = this.pos.z;
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      if (this.city.collideCircle(this.pos, CONFIG.player.radius)) {
        // Slide along the wall: retry each axis separately.
        this.pos.x = prevX;
        this.pos.z = prevZ;
        this.pos.x += mx * speed * dt;
        this.city.collideCircle(this.pos, CONFIG.player.radius);
        const afterX = this.pos.x;
        this.pos.z += mz * speed * dt;
        this.city.collideCircle(this.pos, CONFIG.player.radius);
        this.pos.x = afterX;
      }
      // Face the direction of travel (unless aiming, handled by the camera).
      const targetAngle = Math.atan2(mx, mz);
      let diff = targetAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += Math.max(-10 * dt, Math.min(10 * dt, diff));
      this.walkPhase += dt * speed * 1.5;
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        game.sound.step();
        this.stepTimer = this.sprinting ? 0.28 : 0.38;
      }
    }
    // Walk-cycle animation.
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.6 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7;
    this.armR.rotation.x = swing * 0.7;
    if (this.punchTimer > 0) {
      this.punchTimer -= dt;
      this.armR.rotation.x = -1.6 * Math.max(0, this.punchTimer / 0.25);
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.angle;
    this.group.visible = true;

    // Enter a nearby car.
    if (input.pressed('KeyE')) {
      const car = game.traffic.nearestParked(this.pos.x, this.pos.z, 4.5)
        || game.traffic.nearestMoving(this.pos.x, this.pos.z, 4.5)
        || game.police.nearestCar(this.pos.x, this.pos.z, 4.5);
      if (car && !car.dead) game.enterCar(car);
    }
  }

  _driveCar(dt, game) {
    const input = game.input;
    const car = this.car;
    if (!car) { this.inCar = false; return; }
    const throttle = (input.down('KeyW') ? 1 : 0) + (input.down('KeyS') ? -1 : 0);
    const steer = (input.down('KeyA') ? 1 : 0) + (input.down('KeyD') ? -1 : 0);
    const handbrake = input.down('Space');
    const prevX = car.pos.x;
    const prevZ = car.pos.z;
    const prevSpeed = car.speed;
    car.drive(dt, throttle, steer, handbrake);
    // Building collision: stop dead with a crunch, not a phase-through.
    if (this.city.collideCircle(car.pos, CONFIG.car.radius)) {
      const lost = Math.abs(car.speed);
      car.pos.x = prevX;
      car.pos.z = prevZ;
      car.group.position.copy(car.pos);
      if (lost > 5) {
        car.crash(lost);
        game.sound.crash();
        game.particles.sparks(car.pos.x, 0.8, car.pos.z);
        game.particles.addShake(0.45);
        if (lost > 14) this.damage(6, game);
      }
      car.speed *= -0.25;
    }
    // Skid marks + squeal on hard handbrake turns.
    if (handbrake && Math.abs(car.speed) > 10) {
      const f = car.forward();
      game.particles.addSkid(car.pos.x - f.x * 1.4, car.pos.z - f.z * 1.4, car.angle);
      if (Math.random() < 0.3) game.sound.skid();
    }
    if (car.smoking && Math.random() < 0.35) {
      game.particles.smoke(car.pos.x, 1.2, car.pos.z);
    }
    if (car.dead && Math.random() < 0.5) {
      game.particles.smoke(car.pos.x, 1.2, car.pos.z);
    }
    // Keep the player glued to the car.
    this.pos.copy(car.pos);
    this.angle = car.angle + Math.PI;
    this.group.position.copy(this.pos);
    this.group.visible = false;
    game.sound.setEngine(Math.abs(car.speed) / CONFIG.car.playerMaxSpeed, true);
    // Exit the car.
    if (input.pressed('KeyE')) game.exitCar();
    if (input.pressed('KeyF')) game.toggleHeadlights?.();
  }

  damage(amount, game) {
    if (this.dead) return;
    this.health -= amount;
    game.particles.addShake(0.3);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.health = Math.min(CONFIG.player.maxHealth, this.health + amount);
  }

  reload(game) {
    const need = CONFIG.player.pistolAmmo - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    if (take > 0) game.sound.uiClick();
  }
}
