// Mission manager: starts each mission, tracks its objectives, pays the
// reward, and handles fail/restart. It talks to the rest of the game
// through the context object main.js hands it (ctx), so missions stay
// decoupled from the systems they drive.

import { MISSIONS, ENDINGS } from './story.js';
import { flatDist } from '../util/random.js';

export class MissionManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.index = 0; // next mission to play
    this.active = null; // the running mission's runtime state
    this.completed = 0;
    this.state = 'idle'; // idle | active | done | failed | story-done
    this.onEvent = null; // (kind, payload) => {} — HUD toasts, sounds
  }

  /** The marker the minimap and the 3D beacon should point at, or null. */
  markerPos() {
    if (!this.active) return null;
    if (this.active.phase === 'choice') return this.active.choiceTarget ?? null;
    return this.active.targetPos;
  }

  objectiveText() {
    if (this.state === 'story-done') return 'Story complete — free roam. Earn cash, lose the cops, own the bay.';
    if (!this.active) return 'Visit the start marker to begin the next mission.';
    const m = this.active.def;
    if (m.type === 'eliminate' || m.type === 'eliminate-choice') {
      if (this.active.phase === 'choice') {
        return 'Choose your crew: gold marker (Harbor Kings) or purple marker (Vesper)';
      }
      return `Eliminate the gunmen (${this.active.kills}/${m.enemies})`;
    }
    if (m.type === 'steal-deliver' && this.active.phase === 'deliver') {
      return 'Deliver the gold car to the safehouse';
    }
    if (m.type === 'escape' && this.active.phase === 'hideout') {
      return 'Reach the park hideout';
    }
    return m.objective;
  }

  startMission(i) {
    const def = MISSIONS[i];
    if (!def) return false;
    const ctx = this.ctx;
    const targetPos = ctx.landmarkPos(def.target);
    this.active = {
      def,
      index: i,
      phase: 'go',
      targetPos,
      timeLeft: def.timeLimit,
      kills: 0,
      choiceTarget: null,
    };
    this.state = 'active';
    if (def.wantedOnStart) ctx.setWanted(def.wantedOnStart);
    if (def.type === 'eliminate' || def.type === 'eliminate-choice') {
      ctx.spawnEnemies(def.enemies, targetPos);
    }
    if (def.type === 'steal-deliver') {
      this.active.missionCar = ctx.spawnMissionCar(targetPos);
    }
    ctx.showMarker(targetPos);
    this.onEvent?.('briefing', def);
    return true;
  }

  /** The player reached the current marker. */
  atMarker() {
    const a = this.active;
    if (!a) return;
    const m = a.def;
    if (m.type === 'reach') return this.complete();
    if (m.type === 'steal-deliver' && a.phase === 'deliver') return this.complete();
    if (m.type === 'escape' && a.phase === 'hideout') return this.complete();
  }

  /** The player stole the mission car. */
  stoleMissionCar() {
    const a = this.active;
    if (!a || a.def.type !== 'steal-deliver' || a.phase !== 'go') return;
    a.phase = 'deliver';
    a.targetPos = this.ctx.landmarkPos(a.def.deliverTo);
    this.ctx.showMarker(a.targetPos);
    this.onEvent?.('objective', 'Deliver the car to the safehouse');
  }

  /** An enemy was eliminated during an eliminate mission. */
  enemyKilled() {
    const a = this.active;
    if (!a) return;
    const m = a.def;
    if (m.type !== 'eliminate' && m.type !== 'eliminate-choice') return;
    a.kills += 1;
    if (a.kills < m.enemies) return;
    if (m.type === 'eliminate-choice') {
      a.phase = 'choice';
      const harbor = this.ctx.landmarkPos('marina');
      const vesper = this.ctx.landmarkPos('downtown');
      // Two choice markers: gold at the marina (Harbor Kings), purple downtown (Vesper).
      a.choiceMarkers = { harbor, vesper };
      a.choiceTarget = harbor;
      this.ctx.showChoiceMarkers(harbor, vesper);
      this.onEvent?.('objective', 'Choose your crew — gold marker: Harbor Kings, purple marker: Vesper Syndicate');
    } else {
      this.complete();
    }
  }

  /** The player entered a choice marker. */
  atChoiceMarker(which) {
    const a = this.active;
    if (!a || a.phase !== 'choice') return;
    a.choice = which;
    this.complete(which);
  }

  complete(choice) {
    const a = this.active;
    const m = a.def;
    this.completed += 1;
    this.index = a.index + 1;
    this.ctx.addCash(m.reward);
    this.ctx.clearWanted();
    this.ctx.clearEnemies();
    this.ctx.hideMarker();
    this.state = this.index >= MISSIONS.length ? 'story-done' : 'done';
    const outro = choice ? ENDINGS[choice] : m.outro;
    this.onEvent?.('complete', { def: m, reward: m.reward, outro, choice });
    this.active = null;
    this.ctx.saveGame();
  }

  fail(reason) {
    const a = this.active;
    if (!a) return;
    this.state = 'failed';
    this.ctx.clearEnemies();
    this.ctx.hideMarker();
    this.onEvent?.('failed', { def: a.def, reason });
    this.active = null;
  }

  /** Restart the mission that just failed. */
  retry() {
    return this.startMission(Math.max(0, this.index));
  }

  /** Jump straight into the next mission. */
  beginNext() {
    if (this.index >= MISSIONS.length) {
      this.state = 'story-done';
      return false;
    }
    return this.startMission(this.index);
  }

  update(dt) {
    const a = this.active;
    if (!a) return;
    a.timeLeft -= dt;
    if (a.timeLeft <= 0) {
      this.fail('Time ran out.');
      return;
    }
    const ctx = this.ctx;
    const playerPos = ctx.playerPos();
    // Escape mission: once the heat is gone, the hideout opens.
    if (a.def.type === 'escape' && a.phase === 'go' && ctx.wantedStars() === 0) {
      a.phase = 'hideout';
      a.targetPos = ctx.landmarkPos(a.def.target);
      ctx.showMarker(a.targetPos);
      this.onEvent?.('objective', 'Heat is off — reach the park hideout');
    }
    // Reach checks: within range of the marker (on foot or in the car).
    if (a.targetPos && a.phase !== 'choice') {
      const d = flatDist(playerPos.x, playerPos.z, a.targetPos.x, a.targetPos.z);
      const radius = a.def.type === 'steal-deliver' && a.phase === 'deliver' ? 12 : 9;
      if (d < radius) {
        if (a.def.type === 'steal-deliver' && a.phase === 'go') {
          // Standing at the car park is not enough — steal the car first.
        } else {
          this.atMarker();
        }
      }
    }
    // Choice markers.
    if (a.phase === 'choice' && a.choiceMarkers) {
      const dh = flatDist(playerPos.x, playerPos.z, a.choiceMarkers.harbor.x, a.choiceMarkers.harbor.z);
      const dv = flatDist(playerPos.x, playerPos.z, a.choiceMarkers.vesper.x, a.choiceMarkers.vesper.z);
      if (dh < 10) this.atChoiceMarker('harbor');
      else if (dv < 10) this.atChoiceMarker('vesper');
    }
    // Death fails an active mission.
    if (!ctx.playerAlive()) this.fail('Kai went down.');
  }
}
