// Mission state machine: starts missions, tracks steps and the countdown,
// spawns mission cars and gunmen, pays rewards, and handles fail/restart.
import { CONFIG } from '../config.js';
import { MISSIONS, HIDEOUT } from './story.js';
import { Car } from '../vehicles/cars.js';

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.active = null; // { def, stepIndex, timeLeft, kills, chosenSide }
    this.completed = new Set(game.save.missionsDone || []);
    this.stealCar = null;
    this.choiceMarkers = [];
  }

  get currentIndex() {
    return this.game.save.missionIndex;
  }

  nextMission() {
    return MISSIONS[this.currentIndex] || null;
  }

  inHideout(x, z) {
    return Math.hypot(x - HIDEOUT.x, z - HIDEOUT.z) < HIDEOUT.radius;
  }

  currentStep() {
    if (!this.active) return null;
    return this.active.def.steps[this.active.stepIndex];
  }

  objectiveText() {
    if (!this.active) return 'Free roam — explore Meridian Bay';
    const step = this.currentStep();
    if (!step) return this.active.def.title;
    if (step.type === 'eliminate') {
      return `${step.label} (${this.active.kills}/${step.count})`;
    }
    return step.label;
  }

  startMission(index) {
    const def = MISSIONS[index];
    if (!def) return false;
    this.cleanupMissionObjects();
    this.active = { def, stepIndex: 0, timeLeft: def.timeLimit, kills: 0, chosenSide: null };
    const game = this.game;
    if (def.startWanted) game.wanted.setStars(def.startWanted, game);
    game.sound.missionStart();
    game.hud.showToast(`${def.title} — ${def.giver}`, def.briefing);
    this._enterStep();
    return true;
  }

  _enterStep() {
    const game = this.game;
    const step = this.currentStep();
    if (!step) return;
    game.beacon.hide();
    if (step.type === 'goto' || step.type === 'gotoCar') {
      game.beacon.show(step.x, step.z);
    } else if (step.type === 'steal') {
      // The marked coupe: bright red, parked at the marker.
      this.stealCar = new Car(game.scene, { x: step.x, z: step.z, angle: Math.PI / 2, color: 0xd91e1e, kind: 'sedan' });
      this.stealCar.driver = null;
      game.beacon.show(step.x, step.z);
    } else if (step.type === 'eliminate') {
      const spawns = step.spawns || this.active.rivalSpawns || [];
      for (const [x, z] of spawns) game.weapons.spawnEnemy(game, x, z);
      if (spawns.length > 0) game.beacon.show(spawns[0][0], spawns[0][1]);
    } else if (step.type === 'choice') {
      // Two beacons, one per crew; the manager watches both.
      for (const opt of step.options) {
        const marker = game.makeChoiceMarker(opt);
        this.choiceMarkers.push(marker);
      }
    }
  }

  onEnemyDown() {
    if (!this.active) return;
    const step = this.currentStep();
    if (step?.type === 'eliminate') {
      this.active.kills += 1;
      if (this.active.kills >= step.count) this._advance();
    }
  }

  onPlayerEnterCar(car) {
    if (!this.active) return;
    const step = this.currentStep();
    if (step?.type === 'steal' && car === this.stealCar) {
      this._advance();
    }
  }

  _advance() {
    const game = this.game;
    this.active.stepIndex += 1;
    this.active.kills = 0;
    if (this.active.stepIndex >= this.active.def.steps.length) {
      this._complete();
      return;
    }
    game.sound.pickup();
    this._enterStep();
  }

  _complete() {
    const game = this.game;
    const def = this.active.def;
    this.completed.add(def.id);
    game.save.missionsDone = [...this.completed];
    game.save.missionIndex = Math.min(MISSIONS.length, def.id + 1);
    game.cash += def.reward;
    game.save.cash = game.cash;
    game.saveGame();
    game.sound.missionComplete();
    game.particles.cashBurst(game.player.pos.x, 2, game.player.pos.z);
    this.cleanupMissionObjects();
    this.active = null;
    game.hud.showMissionComplete(def);
    game.state = 'missionEnd';
    game.stateTimer = 0;
  }

  fail(reason) {
    const game = this.game;
    if (!this.active) return;
    const def = this.active.def;
    game.sound.missionFailed();
    this.cleanupMissionObjects();
    this.active = null;
    game.wanted.clear();
    game.police.clearAll();
    game.hud.showMissionFailed(def, reason);
    game.state = 'missionEnd';
    game.stateTimer = 0;
  }

  cleanupMissionObjects() {
    const game = this.game;
    if (this.stealCar) {
      // Keep the coupe in the world if the player is driving it; else remove.
      if (game.player.car !== this.stealCar) this.stealCar.remove();
      this.stealCar = null;
    }
    game.weapons.clearEnemies(game);
    for (const m of this.choiceMarkers) game.scene.remove(m);
    this.choiceMarkers = [];
    game.beacon.hide();
  }

  update(dt) {
    if (!this.active) return;
    const game = this.game;
    const player = game.player;
    this.active.timeLeft -= dt;
    if (this.active.timeLeft <= 0) {
      this.fail('Out of time');
      return;
    }
    const step = this.currentStep();
    if (!step) return;
    const dist = (x, z) => Math.hypot(player.pos.x - x, player.pos.z - z);
    switch (step.type) {
      case 'goto':
        if (dist(step.x, step.z) < step.radius) this._advance();
        break;
      case 'gotoCar':
        if (player.inCar && player.car === this.stealCar && dist(step.x, step.z) < step.radius) {
          this._advance();
        } else if (!player.inCar && dist(step.x, step.z) < step.radius) {
          game.hud.showToast('Bring the coupe', 'You need to arrive in the stolen coupe.');
        }
        break;
      case 'loseHeat':
        if (game.wanted.stars === 0) this._advance();
        break;
      case 'choice': {
        for (const opt of step.options) {
          if (dist(opt.x, opt.z) < 10) {
            this.active.chosenSide = opt.name;
            const rivalAt = opt.name === 'Harbor Kings'
              ? [[140, -140], [152, -128], [128, -128], [140, -156]]
              : [[-140, -140], [-152, -128], [-128, -128], [-140, -156]];
            this.active.rivalSpawns = rivalAt;
            game.hud.showToast(`Side chosen: ${opt.name}`, 'Now finish the rival crew.');
            for (const m of this.choiceMarkers) game.scene.remove(m);
            this.choiceMarkers = [];
            this._advance();
            break;
          }
        }
        break;
      }
      default:
        break;
    }
  }
}
