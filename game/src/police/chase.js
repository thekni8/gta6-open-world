// Police response: black-and-white interceptors that spawn on the road
// ring around the player, chase with a touch of interception (they aim
// where the player is going, not where they are), ram on contact, and —
// at 3+ stars — set roadblocks across the road ahead. Light bars flash
// red/blue; the siren is the sound engine's job.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, angleDelta, range } from '../util/random.js';
import { Car } from '../vehicles/cars.js';

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.flashTimer = 0;
    this.blockTimer = 0;
    this.onRam = null; // () => {} — wired by main for damage + shake
    // Chase pressure: a fresh escalation (stars rising) bootstraps the
    // fleet once; after that, replacements only arrive while the player
    // is seen. A chaser that loses the trail while the player is unseen
    // is NOT replaced — that is how the player loses the cops.
    this.reinforce = false;
    this.bootstrapped = false;
    this.lastStars = 0;
  }

  makeInterceptor(x, z, heading) {
    const car = new Car(this.scene, CONFIG.palette.police, 'sedan', x, z, heading);
    // White doors: a thin white box over the body.
    const doors = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.4, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }),
    );
    doors.position.set(0, 0.62, 0);
    car.group.add(doors);
    // Light bar: two emissive blocks, toggled red/blue.
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    red.position.set(-0.4, 1.66, -0.2);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }),
    );
    blue.position.set(0.4, 1.66, -0.2);
    car.group.add(red);
    car.group.add(blue);
    car.lightRed = red;
    car.lightBlue = blue;
    car.isPolice = true;
    return car;
  }

  /** How many interceptors the current stars call for. */
  desiredCount(stars) {
    return CONFIG.police.fleet[clamp(stars, 0, 5)];
  }

  spawnNear(playerPos, minDist = 80) {
    // Spawn on a road ring around the player, beyond police sight (58 m),
    // so a fresh interceptor has to close in — and a player who keeps
    // outrunning the fleet can genuinely lose it. Presets pass a small
    // minDist to stage interceptors right behind the getaway.
    for (let tries = 0; tries < 12; tries++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = range(this.rng, minDist, minDist + 60);
      const x = playerPos.x + Math.sin(angle) * dist;
      const z = playerPos.z + Math.cos(angle) * dist;
      const road = this.city.nearestRoad(x, z);
      if (Math.abs(road.x) > 300 || Math.abs(road.z) > 300) continue;
      const car = this.makeInterceptor(
        road.x,
        road.z,
        Math.atan2(playerPos.x - road.x, playerPos.z - road.z),
      );
      this.cars.push(car);
      return car;
    }
    return null;
  }

  /** A roadblock: two interceptors parked across the road ahead. */
  roadblock(playerPos, playerHeading) {
    const ahead = 34;
    const cx = playerPos.x + Math.sin(playerHeading) * ahead;
    const cz = playerPos.z + Math.cos(playerHeading) * ahead;
    const road = this.city.nearestRoad(cx, cz);
    const perp = playerHeading + Math.PI / 2;
    for (const side of [-1, 1]) {
      const car = this.makeInterceptor(
        road.x + Math.sin(perp) * side * 2.4,
        road.z + Math.cos(perp) * side * 2.4,
        playerHeading + Math.PI / 2,
      );
      car.speed = 0;
      car.blocker = true;
      car.blockAge = 0;
      this.cars.push(car);
    }
  }

  /** Remove every parked roadblock car (one roadblock at a time). */
  clearBlockers() {
    for (let i = this.cars.length - 1; i >= 0; i--) {
      if (this.cars[i].blocker) {
        this.cars[i].remove();
        this.cars.splice(i, 1);
      }
    }
  }

  /** Can any CHASING police car see the player right now? Parked
   *  roadblock cars are obstacles, not surveillance — they don't count,
   *  or a roadblock ahead would keep the player "seen" forever. */
  canSee(playerPos) {
    for (const car of this.cars) {
      if (car.blocker) continue;
      const d = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      if (d < CONFIG.police.sight) return true;
    }
    return false;
  }

  clearAll() {
    for (const car of this.cars) car.remove();
    this.cars = [];
  }

  update(dt, stars, playerPos, playerHeading, playerCar, playerSpeed, onPlayerHit) {
    this.flashTimer += dt;
    const flash = Math.floor(this.flashTimer * 6) % 2 === 0;
    // Track the chase episode: a rise in stars re-arms the bootstrap, and
    // clean heat resets it.
    if (stars > this.lastStars) {
      this.reinforce = true;
      this.bootstrapped = false;
    }
    if (stars === 0) {
      this.reinforce = false;
      this.bootstrapped = false;
    }
    this.lastStars = stars;
    // Match the fleet to the wanted level. Roadblock cars are parked, not
    // chasers: they never count toward the fleet size and are never trimmed
    // for it, or a fresh roadblock would evict its own chasers (or itself).
    const want = this.desiredCount(stars);
    const chasers = this.cars.filter((c) => !c.blocker);
    const seen = this.canSee(playerPos);
    // Top the fleet up only while the player is seen — or once, to
    // bootstrap a fresh chase. While unseen, a retired chaser is not
    // replaced: outrun the fleet and the heat genuinely dies.
    if (this.reinforce && (seen || (chasers.length === 0 && !this.bootstrapped))) {
      while (chasers.length < want) {
        const spawned = this.spawnNear(playerPos);
        if (!spawned) break;
        chasers.push(spawned);
      }
      if (chasers.length > 0) this.bootstrapped = true;
    }
    while (chasers.length > want) {
      // Drop the farthest chaser first.
      let far = 0;
      let fd = -1;
      chasers.forEach((c, i) => {
        const d = Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z);
        if (d > fd) {
          fd = d;
          far = i;
        }
      });
      const dropped = chasers.splice(far, 1)[0];
      dropped.remove();
      this.cars.splice(this.cars.indexOf(dropped), 1);
    }
    // Roadblocks at 3+ stars, at most once per cooldown — and only one
    // roadblock on the road at a time, so parked interceptors never pile up.
    this.blockTimer -= dt;
    if (stars >= CONFIG.police.roadblockStars && this.blockTimer <= 0) {
      this.clearBlockers();
      this.roadblock(playerPos, playerHeading);
      this.blockTimer = CONFIG.police.roadblockCooldown;
    }
    const retire = []; // chasers that lost the trail, blockers that gave up
    for (const car of this.cars) {
      car.lightRed.visible = flash;
      car.lightBlue.visible = !flash;
      if (car.blocker) {
        // Parked across the road, just flashing — for 40 s, then it gives
        // up and leaves, so a long chase never litters the city with them.
        car.blockAge += dt;
        if (car.blockAge > 40) retire.push(car);
        continue;
      }
      // Chase: aim a little ahead of a moving player (interception), then
      // steer, throttle up, and ram on contact.
      const lead = playerCar ? Math.min(1.2, playerSpeed * 0.03) : 0;
      const tx = playerPos.x + Math.sin(playerHeading) * playerSpeed * lead;
      const tz = playerPos.z + Math.cos(playerHeading) * playerSpeed * lead;
      const dx = tx - car.pos.x;
      const dz = tz - car.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      const turn = clamp(angleDelta(car.heading, wantHeading), -1, 1);
      car.steer = turn * 0.6;
      car.speed += (CONFIG.police.pursuitSpeed - car.speed) * Math.min(1, dt * 0.8);
      car.heading += turn * 1.8 * dt * Math.sign(car.speed || 1);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      this.city.collideCircle(car.pos, CONFIG.car.radius);
      car.group.position.copy(car.pos);
      car.group.rotation.y = car.heading;
      const spin = (car.speed * dt) / 0.36;
      for (const w of car.group.userData.wheels) w.rotation.x += spin;
      // Ram: close contact damages the player's car or the player.
      if (dist < 3.4) {
        car.speed *= 0.4;
        onPlayerHit?.(CONFIG.police.ramDamage);
        this.onRam?.();
        // Bounce the interceptor back so it doesn't stick.
        car.pos.x -= Math.sin(car.heading) * 1.2;
        car.pos.z -= Math.cos(car.heading) * 1.2;
      }
      // Give up if hopelessly far behind: the interceptor lost the trail
      // and leaves. (Respawning it beside the player would make escape
      // impossible — the fleet already tops itself up from the spawn ring
      // while stars remain, so pressure stays on without a rubber band.)
      if (dist > 350) {
        retire.push(car);
      }
    }
    for (const car of retire) {
      car.remove();
      this.cars.splice(this.cars.indexOf(car), 1);
    }
    // Drop blockers once the heat is gone.
    if (stars < CONFIG.police.roadblockStars) this.clearBlockers();
  }
}
