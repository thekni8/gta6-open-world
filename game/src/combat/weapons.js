// Combat — fists up close, a pistol at range. Hitscan shots from the camera
// centre, tracer feedback, enemy health and the wanted heat a gunshot brings.
import * as THREE from 'three';
import { PLAYER, WANTED } from '../config.js';
import { addWanted } from '../police/wanted.js';
import { scarePedestrians } from '../people/pedestrians.js';

export function createCombat() {
  return {
    ammo: PLAYER.pistolAmmo,
    reserve: PLAYER.pistolReserve,
    cooldown: 0,
    reloadTimer: 0,
    meleeCooldown: 0,
    tracers: [], // {mesh, life} lines that fade out
    shotsFired: 0, // debug counter: pistol rounds actually discharged
  };
}

/** Reload the pistol from the reserve. */
export function reloadWeapon(combat) {
  if (combat.reloadTimer > 0 || combat.ammo === PLAYER.pistolAmmo || combat.reserve <= 0) return;
  combat.reloadTimer = 1.1;
}

export function updateCombatTimers(combat, dt) {
  combat.cooldown = Math.max(0, combat.cooldown - dt);
  combat.meleeCooldown = Math.max(0, combat.meleeCooldown - dt);
  if (combat.reloadTimer > 0) {
    combat.reloadTimer -= dt;
    if (combat.reloadTimer <= 0) {
      const need = PLAYER.pistolAmmo - combat.ammo;
      const take = Math.min(need, combat.reserve);
      combat.ammo += take;
      combat.reserve -= take;
    }
  }
  for (const t of combat.tracers) t.life -= dt;
  combat.tracers = combat.tracers.filter((t) => t.life > 0);
}

/**
 * Fire the pistol from the camera toward the crosshair. `targets` are
 * {pos, health, radius, onHit} — pedestrians, shooters, police. Returns the
 * hit target or null. Fires a tracer and a bang through `fx`.
 */
export function shootPistol(combat, scene, camera, targets, fx, wanted, peds) {
  if (combat.cooldown > 0 || combat.reloadTimer > 0) return null;
  if (combat.ammo <= 0) {
    reloadWeapon(combat);
    return null;
  }
  combat.ammo -= 1;
  combat.cooldown = 0.28;
  combat.shotsFired += 1;
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const end = origin.clone().addScaledVector(dir, 60);
  let best = null;
  let bestT = Infinity;
  for (const t of targets) {
    if (t.dead || t.health <= 0) continue;
    const to = new THREE.Vector3(t.pos.x - origin.x, (t.pos.y ?? 1) - origin.y, t.pos.z - origin.z);
    const along = to.dot(dir);
    if (along < 0 || along > 60) continue;
    const closest = origin.clone().addScaledVector(dir, along);
    const d = Math.hypot(closest.x - t.pos.x, closest.y - (t.pos.y ?? 1), closest.z - t.pos.z);
    if (d < (t.radius ?? 1.2) + 0.6 && along < bestT) {
      bestT = along;
      best = t;
    }
  }
  const hitPoint = best ? new THREE.Vector3(best.pos.x, best.pos.y ?? 1, best.pos.z) : end;
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([origin, hitPoint]);
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe94a }));
  scene.add(tracer);
  combat.tracers.push({ mesh: tracer, life: 0.12 });
  if (fx) fx.gunshot();
  if (best) {
    best.health -= PLAYER.pistolDamage;
    if (fx) fx.hitMarker();
    if (best.health <= 0) {
      best.dead = true;
      if (best.isCop) addWanted(wanted, WANTED.killCop, 'killed a cop');
      else if (best.isPed) addWanted(wanted, WANTED.killPed, 'killed a pedestrian');
      if (best.mesh) best.mesh.visible = false;
    }
  } else if (wanted) {
    addWanted(wanted, 0, 'shot fired');
    if (wanted.stars === 0) wanted.stars = 1; // firing a gun in public draws heat
  }
  if (peds) scarePedestrians(peds, origin.x, origin.z, 30);
  return best;
}

/** Punch: short range, no ammo, no noise — but a witness still calls it in. */
export function punch(combat, playerPos, heading, targets, wanted) {
  if (combat.meleeCooldown > 0) return null;
  combat.meleeCooldown = 0.45;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  for (const t of targets) {
    if (t.dead || t.health <= 0) continue;
    const dx = t.pos.x - playerPos.x;
    const dz = t.pos.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    const facing = (dx * fx + dz * fz) / Math.max(d, 0.001);
    if (d < PLAYER.punchRange && facing > 0.3) {
      t.health -= PLAYER.punchDamage;
      if (t.health <= 0) {
        t.dead = true;
        if (t.isCop) addWanted(wanted, WANTED.killCop, 'killed a cop');
        else if (t.isPed) addWanted(wanted, WANTED.hitPed, 'beat a pedestrian');
        if (t.mesh) t.mesh.visible = false;
      } else if (t.isPed) {
        t.panic = 1;
        t.fleeing = true;
        t.fleeTimer = 3;
      }
      return t;
    }
  }
  return null;
}

/** Remove tracer lines from the scene once they fade. */
export function pruneTracers(combat, scene) {
  for (const t of combat.tracers) {
    if (t.life <= 0) scene.remove(t.mesh);
  }
  combat.tracers = combat.tracers.filter((t) => t.life > 0);
}
