/* Third-person follow camera: mouse-drag orbit, smooth follow,
   and a pull-in rule so it never clips through buildings. */
(function () {
  const CFG = MB.CFG;
  let yaw = Math.PI, pitch = 0.32;
  let curDist = 9, curHeight = 4.5;
  let desiredYaw = null; // scenario override

  function yawValue() { return yaw; }

  function setYaw(y) { yaw = y; desiredYaw = null; }
  function setPitch(p) { pitch = MB.Util.clamp(p, 0.05, 1.1); }

  function update(dt) {
    const cam = MB.W.camera;
    if (!cam) return;
    const d = MB.Input.mouseDelta();
    yaw -= d.x * 0.005;
    pitch = MB.Util.clamp(pitch + d.y * 0.003, 0.08, 1.05);
    const p = MB.W.player;
    const car = MB.W.currentCar;
    let tx, tz, ty, targetDist, targetHeight;
    if (MB.S.inCar && car) {
      tx = car.pos.x; tz = car.pos.z; ty = 1.6;
      targetDist = CFG.camCarDist; targetHeight = CFG.camCarHeight;
      // Driving camera gently swings behind the car's heading.
      const carYaw = Math.atan2(Math.sin(car.heading), Math.cos(car.heading));
      let dy = carYaw - yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      if (Math.abs(d.x) < 1) yaw += dy * Math.min(1, dt * 1.4);
    } else if (p) {
      tx = p.pos.x; tz = p.pos.z; ty = 1.7;
      targetDist = CFG.camFootDist; targetHeight = CFG.camFootHeight;
    } else return;
    curDist = MB.Util.lerp(curDist, targetDist, Math.min(1, dt * 3));
    curHeight = MB.Util.lerp(curHeight, targetHeight, Math.min(1, dt * 3));

    // Pull-in: step the camera toward the target until clear of buildings,
    // but never closer than 3.2 units — inside the player's head helps no one.
    let dist = curDist;
    for (let tries = 0; tries < 6 && dist > 3.2; tries++) {
      const cx = tx - Math.sin(yaw) * Math.cos(pitch) * dist;
      const cz = tz - Math.cos(yaw) * Math.cos(pitch) * dist;
      if (!insideBuilding(cx, cz)) break;
      dist = Math.max(3.2, dist * 0.72);
    }
    const shake = MB.FX.shakeOffset();
    const cx = tx - Math.sin(yaw) * Math.cos(pitch) * dist + shake.x;
    const cz = tz - Math.cos(yaw) * Math.cos(pitch) * dist;
    const cy = ty + Math.sin(pitch) * dist + curHeight * 0.15 + shake.y;
    cam.position.set(cx, Math.max(1.2, cy), cz);
    cam.lookAt(tx, ty, tz);
  }

  function insideBuilding(x, z) {
    const cols = MB.W.colliders;
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      if (x > b.minX - 0.5 && x < b.maxX + 0.5 && z > b.minZ - 0.5 && z < b.maxZ + 0.5) return true;
    }
    return false;
  }

  MB.CameraRig = { update: update, yaw: yawValue, setYaw: setYaw, setPitch: setPitch };
})();
