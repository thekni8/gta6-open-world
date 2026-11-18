// Menus: start screen (New Game / Continue / Controls), pause menu, and
// the controls help panel. All DOM overlays above the 3D view.
export class Menus {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of [
      'start-screen', 'btn-new', 'btn-continue', 'btn-controls', 'save-info',
      'pause-menu', 'btn-resume', 'btn-restart-mission', 'btn-pause-controls',
      'btn-music', 'btn-quit', 'help-panel', 'btn-close-help', 'btn-close-help-2',
      'mission-list',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.el['btn-new'].addEventListener('click', () => {
      this.game.sound.ensure();
      this.game.sound.uiClick();
      this.game.newGame();
    });
    this.el['btn-continue'].addEventListener('click', () => {
      this.game.sound.ensure();
      this.game.sound.uiClick();
      this.game.continueGame();
    });
    this.el['btn-controls'].addEventListener('click', () => this.showHelp(true));
    this.el['btn-close-help'].addEventListener('click', () => this.showHelp(false));
    this.el['btn-close-help-2'].addEventListener('click', () => this.showHelp(false));
    this.el['btn-resume'].addEventListener('click', () => this.game.togglePause(false));
    this.el['btn-restart-mission'].addEventListener('click', () => {
      this.game.sound.uiClick();
      this.game.restartMission();
    });
    this.el['btn-pause-controls'].addEventListener('click', () => this.showHelp(true));
    this.el['btn-music'].addEventListener('click', () => {
      const on = this.game.sound.toggleMusic();
      this.el['btn-music'].textContent = on ? 'Music: On' : 'Music: Off';
    });
    this.el['btn-quit'].addEventListener('click', () => {
      this.game.sound.uiClick();
      this.game.quitToMenu();
    });
  }

  showStart(hasSave, save) {
    this.el['start-screen'].classList.add('visible');
    this.el['pause-menu'].classList.remove('visible');
    this.el['btn-continue'].style.display = hasSave ? 'block' : 'none';
    if (hasSave && save) {
      const done = (save.missionsDone || []).length;
      this.el['save-info'].textContent =
        `Continue — ${done}/5 missions done · $${(save.cash || 0).toLocaleString()} cash`;
    } else {
      this.el['save-info'].textContent = 'No save yet — start a new game.';
    }
    this._renderMissionList(save);
  }

  hideStart() {
    this.el['start-screen'].classList.remove('visible');
  }

  showPause() {
    this.el['pause-menu'].classList.add('visible');
  }

  hidePause() {
    this.el['pause-menu'].classList.remove('visible');
  }

  showHelp(show) {
    this.el['help-panel'].classList.toggle('visible', show);
  }

  _renderMissionList(save) {
    const done = new Set((save && save.missionsDone) || []);
    const titles = ['First Delivery', 'Borrowed Wheels', 'Heat Run', 'Port Ambush', 'The Choice'];
    this.el['mission-list'].innerHTML = titles.map((t, i) =>
      `<div class="mission-row ${done.has(i) ? 'done' : ''}"><span>${done.has(i) ? '✓' : '○'}</span> ${i + 1}. ${t}</div>`,
    ).join('');
  }
}
