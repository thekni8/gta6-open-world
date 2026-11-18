// Third-person follow camera: orbits with the mouse (or arrow keys),
// sits higher and further back while driving, pulls in instead of clipping
// through buildings, and eases back behind the car at speed.
import { clamp, angleLerp } from '../util/random.js';

export function createCamera(camera) {
  let yaw = Math.PI; // behind the player, looking north
  let pitch = 0.42;
  let dist = 9;
  let shake = 0;
  let shakeX = 0, shakeY = 0;

  return {
    get yaw() { return yaw; },
    setYaw(y) { yaw = y; },
    setPitch(p) { pitch = clamp(p, 0.12, 1.25); },
    setDist(d) { dist = d; },
    addShake(amount) { shake = Math.min(0.9, shake + amount); },
    update(input, target, moving, driving, speed, dt, blockers) {
      const m = input.consumeMouse();
      yaw -= m.dx * 0.0028;
      pitch = clamp(pitch + m.dy * 0.0022, 0.12, 1.25);
      const ok = input.orbitKeys();
      if (ok !== 0) yaw += ok * 1.9 * dt;
      // Driving: pull further back and lower; auto-center behind the car.
      const wantDist = driving ? 12.5 : 8.5;
      const wantPitch = driving ? 0.34 : 0.46;
      dist += (wantDist - dist) * Math.min(1, dt * 2.2);
      if (Math.abs(speed) > 14 && driving) {
        yaw = angleLerp(yaw, target.heading + Math.PI, Math.min(1, dt * 1.4));
      }
      pitch += (wantPitch - pitch) * Math.min(1, dt * 0.6);

      const tx = target.x, tz = target.z;
      const ty = driving ? 1.6 : 1.9;
      const cx = tx + Math.sin(yaw) * Math.cos(pitch) * dist;
      const cz = tz + Math.cos(yaw) * Math.cos(pitch) * dist;
      const cy = ty + Math.sin(pitch) * dist;

      // Pull in rather than clip: raycast from target to the wanted spot.
      let finalDist = dist;
      if (blockers && blockers.length) {
        const dir = new THREE.Vector3(cx - tx, cy - ty, cz - tz);
        const len = dir.length();
        dir.normalize();
        const ray = new THREE.Raycaster(new THREE.Vector3(tx, ty, tz), dir, 0.5, len);
        const hits = ray.intersectObjects(blockers, false);
        if (hits.length) finalDist = Math.max(2.5, hits[0].distance - 0.6);
      }
      const fx = tx + Math.sin(yaw) * Math.cos(pitch) * finalDist;
      const fz = tz + Math.cos(yaw) * Math.cos(pitch) * finalDist;
      const fy = ty + Math.sin(pitch) * finalDist;

      // Screen shake decays fast.
      shake = Math.max(0, shake - dt * 2.4);
      shakeX = (Math.random() - 0.5) * shake * 0.5;
      shakeY = (Math.random() - 0.5) * shake * 0.5;

      camera.position.set(fx + shakeX, Math.max(1.2, fy + shakeY), fz);
      camera.lookAt(tx, ty + 0.4, tz);
    },
  };
}
