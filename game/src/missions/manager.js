// Mission runtime: starts missions, advances steps, spawns mission cars
// and gunmen, runs the countdown, places the 3D beacon + minimap marker,
// and pays out (or fails) at the end.
import { CFG } from '../config.js';
import { MISSIONS } from './story.js';
import { createCar } from '../vehicles/cars.js';

export function createMissionManager(G) {
  let current = null; // { def, stepIndex, timeLeft, choice, stepCar, killsNeeded }
  let beacon = null;
  let ring = null;
  let onEvent = null;

  function makeBeacon() {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 60, 10, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffc832, transparent: true, opacity: 0.45,
      side: THREE.DoubleSide, depthWrite: false,
    });
    beacon = new THREE.Mesh(geo, mat);
    const ringGeo = new THREE.RingGeometry(6.5, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffc832, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    });
    ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    G.scene.add(beacon, ring);
  }

  function placeBeacon(x, z) {
    if (!beacon) makeBeacon();
    beacon.visible = true;
    ring.visible = true;
    beacon.position.set(x, 30, z);
    ring.position.set(x, 0.15, z);
  }

  function hideBeacon() {
    if (beacon) beacon.visible = false;
    if (ring) ring.visible = false;
  }

  function step() {
    return current ? current.def.steps[current.stepIndex] : null;
  }

  function enterStep() {
    const s = step();
    if (!s) return;
    if (s.type === 'goto' || s.type === 'stealCar') placeBeacon(s.x, s.z);
    else if (s.type === 'choose') placeBeacon(s.options[0].x, s.options[0].z);
    else hideBeacon();
    if (s.type === 'enterCar' || s.type === 'stealCar') {
      const c = createCar(G.scene, {
        type: s.car.type, color: s.car.color, role: 'mission',
        x: s.car.x, z: s.car.z, heading: Math.PI / 2,
      });
      c.missionCar = true;
      current.stepCar = c;
    }
    if (s.type === 'eliminate') {
      const spots = s.dynamic
        ? (current.choice === 'kings' ? s.spawnsKings : s.spawnsVespers)
        : s.spawns;
      G.combat.spawnEnemies(spots.slice(0, s.count));
      current.killsNeeded = s.count;
      if (spots.length) placeBeacon(spots[0].x, spots[0].z);
    }
    onEvent?.('step', s);
  }

  function advance() {
    current.stepIndex += 1;
    if (current.stepIndex >= current.def.steps.length) {
      complete();
      return;
    }
    enterStep();
  }

  function complete() {
    const def = current.def;
    G.cash += def.reward;
    G.completedMissions.add(def.id);
    G.combat.clearEnemies();
    hideBeacon();
    onEvent?.('complete', def);
    current = null;
    G.saveGame();
  }

  function fail(reason) {
    const def = current.def;
    G.combat.clearEnemies();
    if (current.stepCar) {
      G.scene.remove(current.stepCar.group);
      current.stepCar = null;
    }
    hideBeacon();
    onEvent?.('fail', { def, reason });
    current = null;
  }

  return {
    get current() { return current; },
    get active() { return current !== null; },
    set onEvent(fn) { onEvent = fn; },
    objectiveText() {
      const s = step();
      if (!s) return 'Free roam — explore Meridian Bay';
      if (s.type === 'eliminate') {
        const left = G.combat.aliveCount();
        return `${s.text} (${current.killsNeeded - left}/${current.killsNeeded})`;
      }
      return s.text;
    },
    timeLeft() { return current ? current.timeLeft : 0; },
    marker() {
      const s = step();
      if (!s) return null;
      if (s.type === 'goto' || s.type === 'stealCar' || s.type === 'enterCar') {
        return { x: s.car ? s.car.x : s.x, z: s.car ? s.car.z : s.z };
      }
      if (s.type === 'choose') {
        return s.options.map((o) => ({ x: o.x, z: o.z, label: o.label }));
      }
      if (s.type === 'eliminate') {
        const alive = G.combat.enemies.filter((e) => !e.dead);
        return alive.length ? { x: alive[0].x, z: alive[0].z } : null;
      }
      if (s.type === 'loseWanted') return { x: G.city.hideout.x, z: G.city.hideout.z };
      return null;
    },
    startMission(index) {
      const def = MISSIONS[index];
      if (!def) return false;
      current = { def, stepIndex: 0, timeLeft: def.timeLimit, choice: null, stepCar: null, killsNeeded: 0 };
      if (def.startWanted) G.wanted.setStars(def.startWanted);
      enterStep();
      onEvent?.('start', def);
      return true;
    },
    missionCar() { return current?.stepCar || null; },
    update(dt) {
      if (!current) return;
      current.timeLeft -= dt;
      if (current.timeLeft <= 0) { fail('Time ran out'); return; }
      const s = step();
      const px = G.player.x, pz = G.player.z;
      if (beacon?.visible) {
        beacon.rotation.y += dt * 0.8;
        const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.08;
        ring.scale.setScalar(pulse);
      }
      if (s.type === 'goto') {
        const d = Math.hypot(px - s.x, pz - s.z);
        if (d < CFG.markerRadius) {
          if (s.onArrive) onEvent?.('flavor', s.onArrive);
          if (s.clearsWanted) G.wanted.clear();
          advance();
        }
      } else if (s.type === 'enterCar' || s.type === 'stealCar') {
        if (G.player.inCar === current.stepCar) {
          if (s.type === 'stealCar') G.wanted.addHeat(CFG.heatStealCar, 'steal');
          advance();
        }
      } else if (s.type === 'loseWanted') {
        if (G.wanted.stars() === 0) advance();
      } else if (s.type === 'eliminate') {
        if (G.combat.aliveCount() === 0) advance();
      } else if (s.type === 'choose') {
        for (const o of s.options) {
          if (Math.hypot(px - o.x, pz - o.z) < CFG.markerRadius) {
            current.choice = o.id;
            onEvent?.('flavor', o.id === 'kings'
              ? 'The Harbor Kings welcome you. The Vespers won\'t forget this.'
              : 'The Vesper Syndicate owns the night — and now it owns you.');
            advance();
            break;
          }
        }
      }
    },
    failCurrent(reason) { if (current) fail(reason); },
  };
}
