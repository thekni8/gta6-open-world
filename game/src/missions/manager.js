// Mission state: triggers, objectives, rewards, fail and restart. The
// manager owns the objective beacon (light pillar + bouncing arrow) and
// spawns mission-specific things (the M2 getaway car, the M4 gunmen).

import { MISSIONS } from './story.js';
import { Car } from '../vehicles/cars.js';
import { Enemies } from '../combat/enemies.js';

export class MissionManager {
  constructor(scene, colliders, hooks) {
    this.scene = scene;
    this.colliders = colliders;
    this.hooks = hooks; // { toast, setWanted, onComplete, onFail }
    this.index = 0;
    this.objectiveIndex = 0;
    this.active = false;
    this.finished = false;
    this.missionCar = null;
    this.enemies = new Enemies(scene, colliders);
    this.choiceMade = null;

    // Objective beacon: a tall light pillar and a bouncing yellow arrow.
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xffd23f, transparent: true, opacity: 0.08,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.beacon = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 60, 12, 1, true), pillarMat);
    pillar.position.y = 30;
    this.beacon.add(pillar);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.0, 4), arrowMat);
    this.arrow.rotation.x = Math.PI;
    this.arrow.position.y = 4.2;
    this.beacon.add(this.arrow);
    this.beacon.visible = false;
    scene.add(this.beacon);
  }

  get mission() {
    return MISSIONS[this.index] ?? null;
  }

  get objective() {
    const m = this.mission;
    if (!m) return null;
    return m.objectives[this.objectiveIndex] ?? null;
  }

  get objectiveText() {
    const o = this.objective;
    if (!o) return '';
    if (o.type === 'eliminate') {
      const left = this.enemies.aliveCount();
      return `${o.text} — ${o.count - left}/${o.count} eliminated`;
    }
    return o.text;
  }

  marker() {
    const o = this.objective;
    if (!o) return null;
    if (o.type === 'choice') return { x: o.kings.x, z: o.kings.z, second: { x: o.vesper.x, z: o.vesper.z } };
    return { x: o.x, z: o.z };
  }

  startMission(i) {
    this.index = i;
    this.objectiveIndex = 0;
    this.active = true;
    this.finished = false;
    this.choiceMade = null;
    this.enemies.clear();
    this.clearMissionCar();
    const m = this.mission;
    if (!m) {
      this.active = false;
      return;
    }
    this.hooks.toast(`MISSION ${m.id}: ${m.title}`, m.intro);
    if (m.onStart === 'wanted3') this.hooks.setWanted(3);
    this.setupObjective();
    this.updateBeacon();
  }

  setupObjective() {
    const o = this.objective;
    if (!o) return;
    if (o.type === 'enterCar') {
      this.missionCar = new Car(this.scene, this.colliders, o.carColor ?? 0x4f7ec9);
      this.missionCar.setPosition(o.x, o.z, Math.PI / 2);
      this.missionCar.ai = { parked: true };
    }
    if (o.type === 'eliminate') {
      this.enemies.spawn(o.count, { x: o.x, z: o.z }, 26);
    }
    this.updateBeacon();
  }

  clearMissionCar() {
    if (this.missionCar) {
      this.missionCar.remove(this.scene);
      this.missionCar = null;
    }
  }

  updateBeacon() {
    const m = this.marker();
    if (!m || !this.active) {
      this.beacon.visible = false;
      return;
    }
    this.beacon.visible = true;
    this.beacon.position.set(m.x, 0, m.z);
  }

  advance() {
    this.objectiveIndex++;
    if (this.objectiveIndex >= this.mission.objectives.length) {
      this.completeMission();
      return;
    }
    this.setupObjective();
    this.hooks.toast('OBJECTIVE UPDATED', this.objectiveText);
  }

  completeMission() {
    const m = this.mission;
    this.active = false;
    this.finished = true;
    this.beacon.visible = false;
    this.enemies.clear();
    this.clearMissionCar();
    this.hooks.onComplete(m);
  }

  fail(reason) {
    if (!this.active) return;
    this.active = false;
    this.beacon.visible = false;
    this.enemies.clear();
    this.hooks.onFail(this.mission, reason);
  }

  retry() {
    this.startMission(this.index);
  }

  // ctx: { playerPos, inCar, enteredCar, wantedStars }
  update(dt, now, ctx) {
    if (this.active) {
      this.arrow.position.y = 4.2 + Math.sin(now * 3) * 0.8;
      this.arrow.rotation.y += dt * 2;
    }
    if (!this.active) return;
    const o = this.objective;
    if (!o) return;
    const p = ctx.playerPos;
    if (o.type === 'goto') {
      if (Math.hypot(p.x - o.x, p.z - o.z) < 9) this.advance();
    } else if (o.type === 'enterCar') {
      if (ctx.inCar && ctx.enteredCar === this.missionCar) {
        this.hooks.toast('CAR STOLEN', 'The Kings will want this one clean. Get to the hideout.');
        this.advance();
      }
    } else if (o.type === 'loseWanted') {
      if (ctx.wantedStars === 0) this.advance();
    } else if (o.type === 'eliminate') {
      if (this.enemies.aliveCount() === 0) this.advance();
    } else if (o.type === 'choice') {
      if (Math.hypot(p.x - o.kings.x, p.z - o.kings.z) < 10) {
        this.choiceMade = 'Harbor Kings';
        this.advance();
      } else if (Math.hypot(p.x - o.vesper.x, p.z - o.vesper.z) < 10) {
        this.choiceMade = 'Vesper Syndicate';
        this.advance();
      }
    }
  }
}

// Meridian Bay round 9 — witness touch
