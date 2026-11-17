// Third-person follow camera: orbits with the mouse, trails behind the
// player or their car, and pulls in when a building would block the view.

import * as THREE from 'three';
import { clamp } from '../util/random.js';

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // 0 = looking toward -Z from behind the player
    this.pitch = 0.32;
    this.distance = 9;
    this.target = new THREE.Vector3();
    this.shake = 0;
  }

  orbit(dx, dy) {
    this.yaw -= dx * 0.0032;
    this.pitch = clamp(this.pitch + dy * 0.0028, -0.15, 1.1);
  }

  addShake(amount) {
    this.shake = Math.min(0.9, this.shake + amount);
  }

  /** Follow `pos` (player or car) with heading `heading` for the default view.
   *  On foot the camera looks at a point well ahead of the player, so the
   *  crosshair ray runs near chest height instead of diving into the ground
   *  a few metres past the player (which made shooting useless). */
  update(dt, pos, heading, city, driving) {
    // When the player turns on foot, the camera stays where the mouse put
    // it; when driving, it eases behind the car's heading.
    if (driving) {
      const behind = heading + Math.PI;
      let d = behind - this.yaw;
      d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.yaw += d * Math.min(1, dt * 1.6);
    }
    const dist = driving ? 12 : 8;
    this.distance += (dist - this.distance) * Math.min(1, dt * 3);
    // Low on-foot camera: just above the shoulder line, so the aim ray
    // stays near chest height out to 40 m.
    const height = driving ? 4.6 : 1.3 + Math.sin(this.pitch) * this.distance * 0.5;
    const cx = pos.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const cz = pos.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;
    const cy = pos.y + height + (driving ? Math.sin(this.pitch) * this.distance : 0);

    // Pull the camera in if a building sits between it and the player.
    let finalDist = this.distance;
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sx = pos.x + (cx - pos.x) * t;
      const sz = pos.z + (cz - pos.z) * t;
      const sy = pos.y + 1.6 + (cy - (pos.y + 1.6)) * t;
      for (const b of city.buildings) {
        if (sx > b.minX && sx < b.maxX && sz > b.minZ && sz < b.maxZ && sy < b.h) {
          finalDist = this.distance * (t - 0.12);
          break;
        }
      }
      if (finalDist < this.distance) break;
    }
    finalDist = Math.max(2.5, finalDist);
    const fx = pos.x + Math.sin(this.yaw) * Math.cos(this.pitch) * finalDist;
    const fz = pos.z + Math.cos(this.yaw) * Math.cos(this.pitch) * finalDist;
    const fy = pos.y + height + (driving ? Math.sin(this.pitch) * finalDist : 0);
    // Over-the-shoulder: shift camera and aim point right on foot, so Kai
    // sits left of the crosshair instead of under it.
    const shoulder = driving ? 0 : 1.4;
    const rx = Math.cos(this.yaw) * shoulder;
    const rz = -Math.sin(this.yaw) * shoulder;

    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake;
    const shx = (Math.random() - 0.5) * sh * 0.7;
    const shy = (Math.random() - 0.5) * sh * 0.7;

    this.camera.position.set(fx + rx + shx, fy + shy, fz + rz);
    if (driving) {
      this.target.set(pos.x, pos.y + 1.7, pos.z);
    } else {
      // Aim point far ahead at chest height: the crosshair ray is honest.
      const ax = -Math.sin(this.yaw);
      const az = -Math.cos(this.yaw);
      this.target.set(pos.x + ax * 18 + rx, pos.y + 1.5, pos.z + az * 18 + rz);
    }
    this.camera.lookAt(this.target);
  }
}
