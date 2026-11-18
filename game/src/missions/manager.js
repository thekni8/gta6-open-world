// Mission manager: runs the active mission's stage machine, owns the 3D
// objective beacon and the minimap marker, and hands out rewards, failure
// and completion. Free roam is simply "no mission active".

import { MISSIONS, HIDEOUTS } from './story.js';
import { Car } from '../vehicles/cars.js';
import { formatCash } from '../util/random.js';

const THREE = window.THREE;

export class MissionManager {
  constructor(G) {
    this.G = G;
    this.active = null; // { def, stageIndex, stageState }
    this.beacon = null;
    this.markerRing = null;
    this.targetCar = null;
    this.choiceMade = null;
  }

  get currentStage() {
    if (!this.active) return null;
    return this.active.def.stages[this.active.stageIndex];
  }

  get objectiveText() {
    const stage = this.currentStage;
    if (!stage) return 'Free roam — explore Meridian Bay';
    return stage.label;
  }

  get targetPos() {
    const stage = this.currentStage;
    if (!stage || !stage.pos) return null;
    return stage.pos;
  }

  unlockedCount() {
    return this.G.save.unlocked;
  }

  startMission(index) {
    const G = this.G;
    if (index < 0 || index >= MISSIONS.length) return false;
    if (index > G.save.unlocked) {
      G.hud.toast('Finish the previous mission to unlock this one.');
      return false;
    }
    this.clearMissionObjects();
    const def = MISSIONS[index];
    this.active = { def, stageIndex: 0, stageState: {} };
    this.choiceMade = null;
    G.hud.showBanner(def.title, def.briefing);
    G.audio.missionStart();
    this.enterStage();
    G.saveGame();
    return true;
  }

  enterStage() {
    const G = this.G;
    const stage = this.currentStage;
    if (!stage) return;
    this.clearBeacon();
    const state = this.active.stageState = {};
    if (stage.type === 'steal') {
      // Park the target coupe where the briefing says it is.
      this.targetCar = new Car(G, stage.pos.x, stage.pos.z, Math.PI / 4, {
        driver: 'none',
        color: stage.carColor,
        kind: stage.carKind,
        isMissionTarget: true,
      });
      G.parkedCars.push(this.targetCar);
      this.showBeacon(stage.pos, 0xffd54a);
    } else if (stage.type === 'killAll') {
      G.combat.spawnEnemies(stage.pos, stage.enemies || 5, 'vesper');
      this.showBeacon(stage.pos, 0xff5252);
    } else if (stage.type === 'choice') {
      G.state = 'paused';
      G.input.exitPointerLock();
      G.menus.showChoice((crew) => this.onCrewChosen(crew));
      this.showBeacon(stage.pos, 0x9b59b6);
    } else if (stage.type === 'escapeTo') {
      const hideout = HIDEOUTS[this.choiceMade || 'harbor'];
      stage.pos = { x: hideout.x, z: hideout.z };
      stage.label = `Reach the ${this.choiceMade === 'harbor' ? 'Harbor Kings' : 'Vesper Syndicate'} hideout`;
      G.combat.spawnEnemies(
        { x: (G.player.x + hideout.x) / 2, z: (G.player.z + hideout.z) / 2 },
        stage.enemies || 4,
        this.choiceMade === 'harbor' ? 'vesper' : 'harbor',
      );
      this.showBeacon(stage.pos, 0x1abc9c);
    } else if (stage.pos) {
      this.showBeacon(stage.pos, 0xffd54a);
    }
    if (stage.wantedOnEnter) {
      // The heat arrives when the player reaches the checkpoint, not before.
      state.wantedOnEnter = stage.wantedOnEnter;
    }
    G.hud.setObjective(this.objectiveText);
  }

  // Jump straight to a stage (used by the ?shot=mission demo setup).
  debugJumpToStage(index) {
    if (!this.active) return;
    this.active.stageIndex = index;
    this.enterStage();
  }

  onCrewChosen(crew) {
    this.choiceMade = crew;
    const G = this.G;
    G.hud.toast(crew === 'harbor'
      ? 'You sided with the Harbor Kings. The Syndicate is coming for you.'
      : 'You sided with the Vesper Syndicate. The Kings will not forgive this.');
    this.advanceStage();
  }

  advanceStage() {
    const G = this.G;
    G.audio.stageClear();
    this.active.stageIndex++;
    if (this.active.stageIndex >= this.active.def.stages.length) {
      this.completeMission();
    } else {
      this.enterStage();
    }
  }

  completeMission() {
    const G = this.G;
    const def = this.active.def;
    G.save.cash += def.reward;
    G.save.unlocked = Math.max(G.save.unlocked, def.id + 1);
    if (!G.save.completed.includes(def.id)) G.save.completed.push(def.id);
    this.clearMissionObjects();
    this.active = null;
    G.hud.setObjective('Free roam — explore Meridian Bay');
    G.audio.missionWin();
    G.saveGame();
    G.state = 'paused';
    G.input.exitPointerLock();
    G.menus.showMissionComplete(def, () => {
      if (def.id + 1 < MISSIONS.length) this.startMission(def.id + 1);
    });
  }

  failMission(reason) {
    const G = this.G;
    if (!this.active) return;
    const def = this.active.def;
    this.clearMissionObjects();
    this.active = null;
    G.hud.setObjective('Free roam — explore Meridian Bay');
    G.audio.missionFail();
    G.state = 'paused';
    G.input.exitPointerLock();
    G.menus.showMissionFailed(def, reason, () => this.startMission(def.id));
  }

  clearMissionObjects() {
    this.clearBeacon();
    this.G.combat.clearEnemies();
    if (this.targetCar && !this.targetCar.dead) {
      // The target car stays in the world as a normal parked car.
      this.targetCar.isMissionTarget = false;
    }
    this.targetCar = null;
  }

  showBeacon(pos, color) {
    const G = this.G;
    this.clearBeacon();
    const group = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 12, 1, true), beamMat);
    beam.position.y = 30;
    group.add(beam);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color }),
    );
    diamond.position.y = 8;
    diamond.name = 'beaconDiamond';
    group.add(diamond);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.5, 5.5, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    group.add(ring);
    group.position.set(pos.x, 0, pos.z);
    G.scene.add(group);
    this.beacon = group;
  }

  clearBeacon() {
    if (this.beacon) {
      this.G.scene.remove(this.beacon);
      this.beacon = null;
    }
  }

  distanceToTarget() {
    const pos = this.targetPos;
    if (!pos) return null;
    return Math.hypot(this.G.player.x - pos.x, this.G.player.z - pos.z);
  }

  update(dt) {
    if (this.beacon) {
      const diamond = this.beacon.getObjectByName('beaconDiamond');
      if (diamond) {
        diamond.rotation.y += dt * 2;
        diamond.position.y = 8 + Math.sin(this.G.time * 2) * 0.8;
      }
    }
    if (!this.active) return;
    const G = this.G;
    const stage = this.currentStage;
    const player = G.player;
    if (stage.type === 'goto' || stage.type === 'deliver' || stage.type === 'escapeTo') {
      const d = Math.hypot(player.x - stage.pos.x, player.z - stage.pos.z);
      if (stage.type === 'deliver' && this.targetCar) {
        // The delivery only counts if the target car arrives with the player.
        const carD = Math.hypot(this.targetCar.x - stage.pos.x, this.targetCar.z - stage.pos.z);
        if (this.targetCar.dead) {
          this.failMission('The coupe was wrecked.');
          return;
        }
        if (carD < stage.radius && player.inCar === this.targetCar) this.advanceStage();
        return;
      }
      if (d < stage.radius) {
        if (stage.type === 'goto' && this.active.stageState.wantedOnEnter) {
          G.wanted.setHeat(55); // wanted level 3 the moment the run goes hot
          G.hud.toast('It\'s a setup — the PD is all over you!');
        }
        this.advanceStage();
      }
    } else if (stage.type === 'steal') {
      if (this.targetCar && player.inCar === this.targetCar) {
        G.wanted.addCrime('stealCar');
        G.hud.toast('Nice — now get it to the garage.');
        this.advanceStage();
      } else if (this.targetCar && this.targetCar.dead) {
        this.failMission('The coupe was wrecked before you could take it.');
      }
    } else if (stage.type === 'escape') {
      if (G.wanted.stars === 0) this.advanceStage();
    } else if (stage.type === 'killAll') {
      if (G.combat.enemiesAlive() === 0) this.advanceStage();
    }
    // Choice stages advance from the menu callback, not here.
  }
}
