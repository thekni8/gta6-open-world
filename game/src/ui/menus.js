// Menus: the start screen, pause, mission complete / failed, controls
// help and the full-map overlay. Plain DOM over the 3D canvas.

import { INTRO_TEXT } from '../missions/story.js';

export class Menus {
  constructor(hooks) {
    this.hooks = hooks; // { onNewGame, onContinue, onResume, onRestartMission, onQuitToMenu }
    this.mapOpen = false;
    this.helpOpen = false;

    this.startEl = document.getElementById('start-screen');
    this.pauseEl = document.getElementById('pause-screen');
    this.completeEl = document.getElementById('mission-complete');
    this.failEl = document.getElementById('mission-failed');
    this.helpEl = document.getElementById('help-screen');
    this.mapEl = document.getElementById('map-overlay');

    document.getElementById('btn-new-game').addEventListener('click', () => this.hooks.onNewGame());
    document.getElementById('btn-continue').addEventListener('click', () => this.hooks.onContinue());
    document.getElementById('btn-controls').addEventListener('click', () => this.showHelp(true));
    document.getElementById('btn-resume').addEventListener('click', () => this.hooks.onResume());
    document.getElementById('btn-restart-mission').addEventListener('click', () => this.hooks.onRestartMission());
    document.getElementById('btn-quit-menu').addEventListener('click', () => this.hooks.onQuitToMenu());
    document.getElementById('btn-complete-continue').addEventListener('click', () => this.hooks.onResume());
    document.getElementById('btn-fail-retry').addEventListener('click', () => this.hooks.onRestartMission());
    document.getElementById('btn-fail-menu').addEventListener('click', () => this.hooks.onQuitToMenu());
    document.getElementById('btn-help-close').addEventListener('click', () => this.showHelp(false));
    document.getElementById('btn-map-close').addEventListener('click', () => this.showMap(false));

    document.getElementById('start-subtitle').textContent = INTRO_TEXT.subtitle;
    document.getElementById('start-kai').textContent = INTRO_TEXT.kai;
    document.getElementById('start-kings').textContent = INTRO_TEXT.kings;
    document.getElementById('start-vesper').textContent = INTRO_TEXT.vesper;
  }

  showStart(canContinue) {
    this.hideAll();
    this.startEl.style.display = 'flex';
    document.getElementById('btn-continue').style.display = canContinue ? 'block' : 'none';
  }

  showPause() {
    this.hideAll();
    this.pauseEl.style.display = 'flex';
  }

  showComplete(mission, cash) {
    this.hideAll();
    document.getElementById('complete-title').textContent = `MISSION ${mission.id} COMPLETE`;
    document.getElementById('complete-name').textContent = mission.title;
    document.getElementById('complete-outro').textContent = mission.outro;
    document.getElementById('complete-reward').textContent = `+$${mission.reward.toLocaleString('en-US')} — Cash $${cash.toLocaleString('en-US')}`;
    this.completeEl.style.display = 'flex';
  }

  showFailed(mission, reason) {
    this.hideAll();
    document.getElementById('fail-title').textContent = mission ? `MISSION ${mission.id} FAILED` : 'BUSTED';
    document.getElementById('fail-reason').textContent = reason;
    this.failEl.style.display = 'flex';
  }

  showHelp(open) {
    this.helpOpen = open;
    this.helpEl.style.display = open ? 'flex' : 'none';
  }

  showMap(open) {
    this.mapOpen = open;
    this.mapEl.style.display = open ? 'flex' : 'none';
  }

  hideAll() {
    for (const el of [this.startEl, this.pauseEl, this.completeEl, this.failEl, this.helpEl, this.mapEl]) {
      el.style.display = 'none';
    }
    this.helpOpen = false;
    this.mapOpen = false;
  }
}
