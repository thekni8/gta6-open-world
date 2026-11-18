// Third-person follow camera: orbits with the mouse (pointer lock, or Q/E
// as a fallback), pulls in instead of clipping through buildings, and kicks
// the FOV out a little at driving speed.

import { clamp, lerp } from '../util/random.js';

const THREE = window.THREE;

export class CameraRig {
  constructor(G) {
    this.G = G;
    this.yaw = 0;
    this.pitch = 0.32;
    this.distance = 9;
    this.currentPos = new THREE.Vector3(0, 6, 12);
    this.lookTarget = new THREE.Vector3();
    this.shakeOffset = new THREE.Vector3();
  }

  update(dt, target, driving, speed01) {
    const G = this.G;
    const input = G.input;
    const { dx, dy } = input.consumeMouse();
    this.yaw -= dx * 0.0026;
    this.pitch = clamp(this.pitch + dy * 0.0022, -0.15, 1.05);
    // Q/E orbit the camera without the mouse — handy on a trackpad.
    if (input.isDown('KeyQ')) this.yaw += dt * 2.2;
    if (input.isDown('KeyE') && driving) this.yaw -= dt * 2.2;

    const wantDist = driving ? 12.5 : 8.5;
    this.distance = lerp(this.distance, wantDist, Math.min(1, dt * 3));
    const camHeight = driving ? 4.6 : 3.4;
    const headY = driving ? 1.6 : 2.2;

    const cx = target.x - Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const cz = target.z - Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;
    const cy = headY + Math.sin(this.pitch) * this.distance + camHeight * 0.4;

    // Collision: step from the head to the wanted camera spot; stop short of
    // the first building the segment would enter.
    let dist = this.distance;
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = target.x + (cx - target.x) * t;
      const pz = target.z + (cz - target.z) * t;
      const py = headY + (cy - headY) * t;
      if (py < 26 && this.pointInBuilding(px, pz)) {
        dist = Math.max(2.5, this.distance * ((i - 1) / steps));
        break;
      }
    }
    const fx = target.x - Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
    const fz = target.z - Math.cos(this.yaw) * Math.cos(this.pitch) * dist;
    const fy = headY + Math.sin(this.pitch) * dist + camHeight * 0.4;

    const smooth = Math.min(1, dt * (driving ? 5 : 8));
    this.currentPos.x = lerp(this.currentPos.x, fx, smooth);
    this.currentPos.y = lerp(this.currentPos.y, fy, smooth);
    this.currentPos.z = lerp(this.currentPos.z, fz, smooth);

    // Screen shake from the effects system, decaying on its own.
    const sh = G.fx.shakeAmount;
    this.shakeOffset.set(
      (Math.random() - 0.5) * sh,
      (Math.random() - 0.5) * sh,
      (Math.random() - 0.5) * sh,
    );
    const cam = G.camera;
    cam.position.copy(this.currentPos).add(this.shakeOffset);
    this.lookTarget.set(target.x, headY, target.z);
    cam.lookAt(this.lookTarget);
    const wantFov = driving ? 62 + speed01 * 12 : 60;
    if (Math.abs(cam.fov - wantFov) > 0.1) {
      cam.fov = lerp(cam.fov, wantFov, Math.min(1, dt * 4));
      cam.updateProjectionMatrix();
    }
  }

  pointInBuilding(x, z) {
    for (const b of this.G.city.colliders) {
      if (x > b.minX - 0.5 && x < b.maxX + 0.5 && z > b.minZ - 0.5 && z < b.maxZ + 0.5) {
        return true;
      }
    }
    return false;
  }

  snapTo(target) {
    const cx = target.x - Math.sin(this.yaw) * this.distance;
    const cz = target.z - Math.cos(this.yaw) * this.distance;
    this.currentPos.set(cx, 5, cz);
  }
}
