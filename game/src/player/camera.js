// Third-person follow camera: mouse orbit, smooth lag, look-ahead while
// driving, and a pull-in rule so it never clips through buildings.
export class CameraRig {
  constructor(camera, city) {
    this.camera = camera;
    this.city = city;
    this.yaw = Math.PI;
    this.pitch = 0.42;
    this.distance = 9.5;
    this.targetDistance = 9.5;
    this.lookTarget = new THREE.Vector3();
    this.smoothedPos = new THREE.Vector3(0, 6, 12);
    this.firstFrame = true;
  }

  // Mouse deltas steer the orbit; pitch is clamped so the camera never
  // goes under the ground or straight overhead.
  updateMouse(dx, dy) {
    this.yaw -= dx * 0.0026;
    this.pitch = Math.max(0.12, Math.min(1.15, this.pitch + dy * 0.0022));
  }

  setView(yaw, pitch, distance) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.distance = distance;
    this.targetDistance = distance;
  }

  update(dt, game, shakeOffset) {
    const player = game.player;
    const inCar = player.inCar && player.car;
    // Driving pulls the camera back and lower; on foot it sits closer.
    this.targetDistance = inCar ? 12.5 : 9.0;
    this.distance += (this.targetDistance - this.distance) * Math.min(1, dt * 3);

    // Look target: the player, plus speed look-ahead while driving.
    const focus = player.pos;
    this.lookTarget.set(focus.x, focus.y + 1.7, focus.z);
    if (inCar) {
      const f = player.car.forward();
      this.lookTarget.x += f.x * Math.abs(player.car.speed) * 0.22;
      this.lookTarget.z += f.z * Math.abs(player.car.speed) * 0.22;
      this.lookTarget.y = 1.9;
    }

    // Orbit position from yaw/pitch/distance.
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    let camX = this.lookTarget.x + Math.sin(this.yaw) * cosP * this.distance;
    let camZ = this.lookTarget.z + Math.cos(this.yaw) * cosP * this.distance;
    let camY = this.lookTarget.y + sinP * this.distance;

    // Pull-in: step the camera toward the target until it clears buildings.
    const probe = new THREE.Vector3();
    let dist = this.distance;
    for (let d = this.distance; d > 2.5; d -= 1.2) {
      probe.set(
        this.lookTarget.x + Math.sin(this.yaw) * cosP * d,
        0,
        this.lookTarget.z + Math.cos(this.yaw) * cosP * d,
      );
      let blocked = false;
      for (const c of this.city.colliders) {
        if (probe.x > c.minX - 0.5 && probe.x < c.maxX + 0.5 && probe.z > c.minZ - 0.5 && probe.z < c.maxZ + 0.5) {
          blocked = true;
          break;
        }
      }
      if (!blocked) { dist = d; break; }
      dist = d;
    }
    camX = this.lookTarget.x + Math.sin(this.yaw) * cosP * dist;
    camZ = this.lookTarget.z + Math.cos(this.yaw) * cosP * dist;
    camY = this.lookTarget.y + sinP * dist;
    camY = Math.max(1.6, camY);

    // Smooth follow + screen shake.
    const k = this.firstFrame ? 1 : Math.min(1, dt * 7);
    this.smoothedPos.x += (camX - this.smoothedPos.x) * k;
    this.smoothedPos.y += (camY - this.smoothedPos.y) * k;
    this.smoothedPos.z += (camZ - this.smoothedPos.z) * k;
    this.firstFrame = false;
    this.camera.position.set(
      this.smoothedPos.x + (shakeOffset?.x || 0),
      this.smoothedPos.y + (shakeOffset?.y || 0),
      this.smoothedPos.z,
    );
    this.camera.lookAt(this.lookTarget);
  }
}
