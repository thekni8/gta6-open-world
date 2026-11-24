// Third-person follow camera: mouse orbit, a different pull-back for
// driving, and a simple collision rule that pulls the camera in rather
// than letting it clip through buildings.

export class FollowCamera {
  constructor(camera, solidMeshes) {
    this.camera = camera;
    this.solidMeshes = solidMeshes;
    this.yaw = Math.PI; // behind the player, looking north by default
    this.pitch = 0.32;
    this.distance = 7.5;
    this.targetDistance = 7.5;
    this.shake = 0;
    this.raycaster = new THREE.Raycaster();
    this.desired = new THREE.Vector3();
    this.smoothed = new THREE.Vector3(0, 4, 8);
    this.lookTarget = new THREE.Vector3();
  }

  addLook(dx, dy) {
    this.yaw -= dx * 0.0026;
    this.pitch = Math.max(0.05, Math.min(1.05, this.pitch + dy * 0.0022));
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  setDriving(driving) {
    this.targetDistance = driving ? 9.5 : 7.5;
  }

  snapTo(target) {
    this.smoothed.copy(target);
  }

  update(dt, targetPos, targetHeight) {
    this.distance += (this.targetDistance - this.distance) * Math.min(1, dt * 4);
    const cy = Math.cos(this.pitch);
    const sy = Math.sin(this.pitch);
    this.desired.set(
      targetPos.x + Math.sin(this.yaw) * cy * this.distance,
      targetPos.y + targetHeight + sy * this.distance,
      targetPos.z + Math.cos(this.yaw) * cy * this.distance,
    );
    // Pull in rather than clip: raycast from the target toward the camera.
    const dir = this.desired.clone().sub(targetPos);
    const dist = dir.length();
    if (dist > 0.5) {
      this.raycaster.set(
        new THREE.Vector3(targetPos.x, targetPos.y + targetHeight, targetPos.z),
        dir.normalize(),
      );
      this.raycaster.far = dist;
      const hits = this.raycaster.intersectObjects(this.solidMeshes, false);
      if (hits.length > 0 && hits[0].distance > 1.2) {
        this.desired.copy(targetPos).addScaledVector(dir, hits[0].distance - 0.5);
        this.desired.y = Math.max(this.desired.y, targetPos.y + 0.6);
      }
    }
    if (this.desired.y < 0.7) this.desired.y = 0.7;
    this.smoothed.lerp(this.desired, Math.min(1, dt * 9));
    this.camera.position.copy(this.smoothed);
    if (this.shake > 0.001) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const s = this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.lookTarget.set(targetPos.x, targetPos.y + targetHeight + 0.4, targetPos.z);
    this.camera.lookAt(this.lookTarget);
  }
}

// Meridian Bay round 9 — witness touch
