// Third-person follow camera. Orbits with the mouse drag, pulls in instead of
// clipping through buildings, and swings behind the car while driving.
import * as THREE from 'three';
import { clamp } from '../util/random.js';

export function createCamera(camera) {
  return {
    camera,
    yaw: 0,
    pitch: 0.32,
    distance: 11,
    currentPos: new THREE.Vector3(0, 8, 130),
  };
}

/**
 * Follow `target` (a Vector3) at `heading` when driving. `dragDX` orbits the
 * camera; the camera eases toward its ideal spot and shortens when a building
 * stands between it and the target.
 */
export function updateCamera(cam, target, heading, driving, dragDX, dt, colliders) {
  cam.yaw -= dragDX * 0.004;
  if (driving) {
    // Ease the orbit back behind the car while driving.
    let diff = heading + Math.PI - cam.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cam.yaw += diff * Math.min(1, dt * 1.5);
  }
  const dist = driving ? 13 : 10;
  const height = driving ? 5.5 : 4.5;
  const pitch = driving ? 0.22 : cam.pitch;
  const ideal = new THREE.Vector3(
    target.x - Math.sin(cam.yaw) * Math.cos(pitch) * dist,
    target.y + height + Math.sin(pitch) * dist * 0.5,
    target.z - Math.cos(cam.yaw) * Math.cos(pitch) * dist,
  );
  // Pull in rather than clip: shorten the ray until it clears the buildings.
  let best = 1;
  for (const c of colliders) {
    // Cheap segment-vs-AABB test on the XZ line, sampled.
    for (let t = 0.2; t < 1; t += 0.2) {
      const x = target.x + (ideal.x - target.x) * t;
      const z = target.z + (ideal.z - target.z) * t;
      if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) {
        best = Math.min(best, Math.max(0.25, t - 0.15));
        break;
      }
    }
  }
  const finalPos = new THREE.Vector3().lerpVectors(target, ideal, best);
  finalPos.y = Math.max(finalPos.y, 1.2);
  cam.currentPos.lerp(finalPos, Math.min(1, dt * 8));
  cam.camera.position.copy(cam.currentPos);
  cam.camera.lookAt(target.x, target.y + 1.6, target.z);
  cam.distance = dist;
}

/** Snap the camera behind the player (used after teleports and shot staging). */
export function snapCamera(cam, target, heading) {
  cam.yaw = heading + Math.PI;
  cam.currentPos.set(
    target.x - Math.sin(cam.yaw) * 10,
    target.y + 5,
    target.z - Math.cos(cam.yaw) * 10,
  );
  cam.camera.position.copy(cam.currentPos);
  cam.camera.lookAt(target.x, target.y + 1.6, target.z);
}

export { clamp };
