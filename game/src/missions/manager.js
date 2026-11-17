// Mission manager — starts missions, tracks objectives, pays rewards,
// fails and restarts. The mission marker (a 3D beacon + minimap pin) always
// points at the current step's place.
import * as THREE from 'three';
import { MISSION_DEFS, STORY, stepText } from './story.js';
import { addWanted } from '../police/wanted.js';

export function createMissionManager(scene, places) {
  // The beacon: a tall glowing pillar the player can see across the city.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4, 6, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  ring.visible = false;
  scene.add(ring);
  return {
    scene,
    places,
    beacon,
    ring,
    index: -1, // -1 = between missions; 0..4 = active mission
    step: 0,
    kills: 0,
    completed: [],
    state: 'idle', // idle | active | complete | failed
    message: '',
    messageTimer: 0,
    choice: null, // 'kings' | 'vesper' once mission 5 resolves
  };
}

/** The world position of a named place (missions add a couple of extras). */
export function placePosition(manager, name) {
  if (name === 'garageDrop') return manager.places.kingsGarage; // legacy alias
  if (name === 'choice') return manager.places.garage; // beacon sits between both; the choice is made by arrival
  return manager.places[name] ?? manager.places.downtown;
}

export function currentDef(manager) {
  return manager.index >= 0 ? MISSION_DEFS[manager.index] : null;
}

export function currentObjective(manager) {
  const def = currentDef(manager);
  if (!def || manager.state !== 'active') return manager.completed.length === MISSION_DEFS.length ? 'Meridian Bay is yours. Free roam!' : 'Press Enter to start the next mission';
  return stepText(def, manager.step, manager.kills);
}

/** Start the next mission in the arc. */
export function startMission(manager, wanted) {
  if (manager.index + 1 >= MISSION_DEFS.length) return null;
  manager.index += 1;
  manager.step = 0;
  manager.kills = 0;
  manager.state = 'active';
  const def = MISSION_DEFS[manager.index];
  showMessage(manager, def.intro, 6);
  if (def.wantedOnStart) addWanted(wanted, def.wantedOnStart, 'mission heat');
  moveBeacon(manager);
  return def;
}

export function showMessage(manager, text, seconds = 4) {
  manager.message = text;
  manager.messageTimer = seconds;
}

function moveBeacon(manager) {
  const def = currentDef(manager);
  if (!def || manager.state !== 'active') {
    manager.beacon.visible = false;
    manager.ring.visible = false;
    return;
  }
  const step = def.steps[manager.step];
  const pos = placePosition(manager, step.place);
  manager.beacon.position.set(pos.x, 30, pos.z);
  manager.ring.position.set(pos.x, 0.3, pos.z);
  manager.beacon.visible = true;
  manager.ring.visible = true;
}

/** Advance one step; complete the mission (and pay) when the steps run out. */
export function advanceStep(manager, player) {
  const def = currentDef(manager);
  if (!def) return;
  manager.step += 1;
  if (manager.step >= def.steps.length) {
    completeMission(manager, player);
  } else {
    moveBeacon(manager);
  }
}

export function completeMission(manager, player) {
  const def = currentDef(manager);
  manager.state = 'complete';
  manager.completed.push(def.id);
  player.cash += def.reward;
  const outro = manager.index === 4
    ? (manager.choice === 'vesper' ? STORY.outroVesper : STORY.outroKings)
    : def.outro;
  showMessage(manager, `${def.name} complete! +$${def.reward}. ${outro}`, 7);
  manager.beacon.visible = false;
  manager.ring.visible = false;
}

export function failMission(manager, reason) {
  if (manager.state !== 'active') return;
  manager.state = 'failed';
  showMessage(manager, `Mission failed — ${reason}. Press Enter to retry.`, 6);
  manager.beacon.visible = false;
  manager.ring.visible = false;
}

/** Retry the failed mission from its first step. */
export function retryMission(manager) {
  if (manager.state !== 'failed') return;
  manager.step = 0;
  manager.kills = 0;
  manager.state = 'active';
  const def = currentDef(manager);
  showMessage(manager, def.intro, 6);
  moveBeacon(manager);
}

/**
 * Per-frame mission check: proximity to the current objective, combat kills,
 * and the final choice. `hooks` carries the live game bits the manager needs.
 */
export function updateMissions(manager, hooks, dt) {
  if (manager.messageTimer > 0) manager.messageTimer -= dt;
  const def = currentDef(manager);
  if (!def || manager.state !== 'active') return;
  const step = def.steps[manager.step];
  if (!step) return;
  const pos = placePosition(manager, step.place);
  const px = hooks.playerPos.x;
  const pz = hooks.playerPos.z;
  const dist = Math.hypot(px - pos.x, pz - pos.z);

  if (def.choice && manager.step === 0) {
    // Mission 5: arriving at the garage backs the Kings, the club backs Vesper.
    const dGarage = Math.hypot(px - manager.places.garage.x, pz - manager.places.garage.z);
    const dClub = Math.hypot(px - manager.places.nightclub.x, pz - manager.places.nightclub.z);
    if (dGarage < 12) {
      manager.choice = 'kings';
      completeMission(manager, hooks.player);
    } else if (dClub < 12) {
      manager.choice = 'vesper';
      completeMission(manager, hooks.player);
    }
    return;
  }
  if (step.combat) {
    // Combat step: the port must be reached first, then every shooter down.
    if (manager.step === 0 && dist < step.radius) {
      advanceStep(manager, hooks.player);
      return;
    }
    if (manager.kills >= def.enemies) advanceStep(manager, hooks.player);
    return;
  }
  if (step.steal) {
    // Steal step completes when the player drives the marked car away.
    if (hooks.stolenTarget && hooks.inCar && hooks.carId === hooks.stolenTarget.id) {
      advanceStep(manager, hooks.player);
    }
    return;
  }
  if (dist < step.radius) advanceStep(manager, hooks.player);
}

/** The beacon's current target, for the minimap. */
export function missionTarget(manager) {
  const def = currentDef(manager);
  if (!def || manager.state !== 'active') return null;
  const step = def.steps[manager.step];
  return step ? placePosition(manager, step.place) : null;
}
