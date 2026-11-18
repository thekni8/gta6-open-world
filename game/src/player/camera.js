// Third-person follow camera. It orbits with the mouse, trails behind
// Kai or his car, eases behind the car's heading while driving, and pulls
// in when a building would block the view. Screen shake is a decaying
// wobble added on crashes and hits.

import * as THREE from 'three';
import { clamp, angleDelta } from '../util/random.js';

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // 0 = camera sits toward +Z, looking toward -Z
    this.pitch = 0.3;
    this.distance = 8.5;
    this.lookAt = new THREE.Vector3();
    this.shake = 0;
  }

  orbit(dx, dy) {
    this.yaw -= dx * 0.0032;
    this.pitch = clamp(this.pitch + dy * 0.0028, -0.12, 1.05);
  }

  addShake(amount) {
    this.shake = Math.min(0.9, this.shake + amount);
  }

  /** Follow `pos` (player or car) with heading `heading`.
   *  On foot the camera looks at a point well ahead of Kai, so the
   *  crosshair ray runs near chest height instead of diving into the
   *  ground a few metres past him (which would make shooting useless). */
  update(dt, pos, heading, city, driving) {
    // While driving, the camera eases behind the car's heading; on foot it
    // stays where the mouse put it.
    if (driving) {
      this.yaw += angleDelta(this.yaw, heading + Math.PI) * Math.min(1, dt * 1.7);
    }
    const wantedDist = driving ? 10.5 : 8;
    this.distance += (wantedDist - this.distance) * Math.min(1, dt * 3);
    const height = driving ? 3.9 : 1.35 + Math.sin(this.pitch) * this.distance * 0.5;
    const cosP = Math.cos(this.pitch);
    const camX = pos.x + Math.sin(this.yaw) * cosP * this.distance;
    const camZ = pos.z + Math.cos(this.yaw) * cosP * this.distance;
    const camY = pos.y + height + (driving ? Math.sin(this.pitch) * this.distance : 0);

    // Pull the camera in if a building sits between it and the player.
    let clearDist = this.distance;
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sx = pos.x + (camX - pos.x) * t;
      const sz = pos.z + (camZ - pos.z) * t;
      const sy = pos.y + 1.6 + (camY - (pos.y + 1.6)) * t;
      let blocked = false;
      for (const b of city.buildings) {
        if (sx > b.minX && sx < b.maxX && sz > b.minZ && sz < b.maxZ && sy < b.h) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        clearDist = this.distance * Math.max(0.1, t - 0.12);
        break;
      }
    }
    clearDist = Math.max(2.5, clearDist);
    const fx = pos.x + Math.sin(this.yaw) * cosP * clearDist;
    const fz = pos.z + Math.cos(this.yaw) * cosP * clearDist;
    const fy = pos.y + height + (driving ? Math.sin(this.pitch) * clearDist : 0);
    // Over-the-shoulder on foot: Kai sits left of the crosshair, not under it.
    const shoulder = driving ? 0 : 1.4;
    const rx = Math.cos(this.yaw) * shoulder;
    const rz = -Math.sin(this.yaw) * shoulder;

    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake;
    const shx = (Math.random() - 0.5) * sh * 0.7;
    const shy = (Math.random() - 0.5) * sh * 0.7;

    this.camera.position.set(fx + rx + shx, fy + shy, fz + rz);
    if (driving) {
      this.lookAt.set(pos.x, pos.y + 1.7, pos.z);
    } else {
      // Aim point far ahead at chest height: the crosshair ray is honest.
      const ax = -Math.sin(this.yaw);
      const az = -Math.cos(this.yaw);
      this.lookAt.set(pos.x + ax * 18 + rx, pos.y + 1.5, pos.z + az * 18 + rz);
    }
    this.camera.lookAt(this.lookAt);
  }
}
