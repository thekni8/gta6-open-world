// Menus: start screen, pause, mission complete/failed, the final crew
// choice, wasted/busted, and the controls panel. Pure DOM over the canvas.

import { MISSIONS, CREWS } from '../missions/story.js';
import { formatCash } from '../util/random.js';

export class Menus {
  constructor(G) {
    this.G = G;
    this.callbacks = {};
    this.choiceCallback = null;
    this.el = {};
    for (const id of [
      'start-screen', 'pause-screen', 'mission-complete', 'mission-failed',
      'choice-screen', 'dead-screen', 'busted-screen', 'controls-panel',
      'bigmap', 'mission-list', 'pause-mission-list', 'btn-continue',
      'complete-title', 'complete-text', 'fail-title', 'fail-text',
      'dead-text', 'busted-text', 'choice-harbor-blurb', 'choice-vesper-blurb',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.el['choice-harbor-blurb'].textContent = CREWS.harbor.blurb;
    this.el['choice-vesper-blurb'].textContent = CREWS.vesper.blurb;
    this.wireButtons();
  }

  on(name, fn) {
    this.callbacks[name] = fn;
  }

  call(name, arg) {
    if (this.callbacks[name]) this.callbacks[name](arg);
  }

  wireButtons() {
    const bind = (id, fn) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => {
        this.G.audio.unlock();
        this.G.audio.uiClick();
        fn();
      });
    };
    bind('btn-new', () => this.call('newGame'));
    bind('btn-continue', () => this.call('continueGame'));
    bind('btn-controls', () => this.toggleControls());
    bind('btn-controls-close', () => this.toggleControls());
    bind('btn-resume', () => this.call('resume'));
    bind('btn-restart-mission', () => this.call('restartMission'));
    bind('btn-pause-controls', () => this.toggleControls());
    bind('btn-quit-title', () => this.call('quitToTitle'));
    bind('btn-next-mission', () => { this.call('nextMission'); this.call('resume'); });
    bind('btn-freeroam', () => { this.call('freeRoam'); this.call('resume'); });
    bind('btn-retry', () => { this.call('retryMission'); this.call('resume'); });
    bind('btn-fail-freeroam', () => { this.call('freeRoam'); this.call('resume'); });
    bind('btn-harbor', () => this.pickCrew('harbor'));
    bind('btn-vesper', () => this.pickCrew('vesper'));
    bind('btn-respawn', () => this.call('respawn'));
    bind('btn-busted-ok', () => this.call('respawn'));
    bind('btn-bigmap-close', () => this.call('closeBigMap'));
  }

  hideAll() {
    for (const id of [
      'start-screen', 'pause-screen', 'mission-complete', 'mission-failed',
      'choice-screen', 'dead-screen', 'busted-screen', 'controls-panel', 'bigmap',
    ]) {
      this.el[id].style.display = 'none';
    }
  }

  show(id) {
    this.el[id].style.display = 'flex';
  }

  showStart(hasSave) {
    this.hideAll();
    this.renderMissionList(this.el['mission-list']);
    this.el['btn-continue'].style.display = hasSave ? 'block' : 'none';
    this.show('start-screen');
  }

  showPause() {
    this.hideAll();
    this.renderMissionList(this.el['pause-mission-list']);
    this.show('pause-screen');
  }

  showMissionComplete(def, onNext) {
    this.hideAll();
    this.callbacks.nextMission = onNext;
    this.el['complete-title'].textContent = 'MISSION COMPLETE';
    this.el['complete-text'].innerHTML =
      `<strong>${def.title}</strong><br>${def.outro}<br><br>` +
      `<span class="reward">Reward: ${formatCash(def.reward)}</span>`;
    const nextBtn = document.getElementById('btn-next-mission');
    nextBtn.style.display = def.id + 1 < MISSIONS.length ? 'block' : 'none';
    this.show('mission-complete');
  }

  showMissionFailed(def, reason, onRetry) {
    this.hideAll();
    this.callbacks.retryMission = onRetry;
    this.el['fail-title'].textContent = 'MISSION FAILED';
    this.el['fail-text'].innerHTML =
      `<strong>${def.title}</strong><br>${reason}<br><br>Try again — the city isn't going anywhere.`;
    this.show('mission-failed');
  }

  showChoice(callback) {
    this.choiceCallback = callback;
    this.hideAll();
    this.show('choice-screen');
  }

  pickCrew(crew) {
    const cb = this.choiceCallback;
    this.choiceCallback = null;
    this.hideAll();
    if (cb) cb(crew);
    this.call('choiceMade');
  }

  showDead(reason) {
    this.hideAll();
    this.el['dead-text'].textContent = reason === 'explosion'
      ? 'Your car went up in flames.'
      : 'You were taken down in the streets of Meridian Bay.';
    this.show('dead-screen');
  }

  showBusted(fine) {
    this.hideAll();
    this.el['busted-text'].textContent =
      `The Meridian PD caught up with you. Fine paid: ${formatCash(fine)}.`;
    this.show('busted-screen');
  }

  toggleControls() {
    const p = this.el['controls-panel'];
    p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
  }

  showBigMap(show) {
    this.el.bigmap.style.display = show ? 'flex' : 'none';
  }

  renderMissionList(container) {
    if (!container) return;
    const G = this.G;
    container.innerHTML = '';
    MISSIONS.forEach((m, i) => {
      const unlocked = i <= G.save.unlocked;
      const done = G.save.completed.includes(i);
      const row = document.createElement('button');
      row.className = 'mission-row' + (done ? ' done' : '') + (unlocked ? '' : ' locked');
      row.innerHTML = `<span class="mission-num">${i + 1}</span>
        <span class="mission-name">${m.title}</span>
        <span class="mission-meta">${done ? '✓ DONE' : unlocked ? formatCash(m.reward) : '🔒 LOCKED'}</span>`;
      if (unlocked) {
        row.addEventListener('click', () => {
          G.audio.unlock();
          G.audio.uiClick();
          this.call('pickMission', i);
        });
      }
      container.appendChild(row);
    });
  }
}
