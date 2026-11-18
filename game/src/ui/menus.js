// Menus: the start screen (New Game / Continue / Controls), the pause
// menu, and the mission complete / failed screens. All DOM; the game
// logic lives in main.js and calls back in through the handlers.

export class Menus {
  constructor(handlers) {
    this.h = handlers;
    this.el = {
      start: document.getElementById('menu-start'),
      pause: document.getElementById('menu-pause'),
      end: document.getElementById('menu-end'),
      endTitle: document.getElementById('end-title'),
      endText: document.getElementById('end-text'),
      btnEndNext: document.getElementById('btn-end-next'),
      btnEndRetry: document.getElementById('btn-end-retry'),
      controls: document.getElementById('controls-panel'),
      btnContinue: document.getElementById('btn-continue'),
    };
    document.getElementById('btn-new').addEventListener('click', () => this.h.newGame());
    this.el.btnContinue.addEventListener('click', () => this.h.continueGame());
    document.getElementById('btn-controls').addEventListener('click', () => {
      this.el.controls.classList.toggle('hidden');
    });
    document.getElementById('btn-resume').addEventListener('click', () => this.h.resume());
    document.getElementById('btn-restart').addEventListener('click', () => this.h.restartMission());
    document.getElementById('btn-quit').addEventListener('click', () => this.h.quitToMenu());
    document.getElementById('btn-mute').addEventListener('click', (e) => {
      const muted = this.h.toggleMute();
      e.target.textContent = muted ? 'Sound: OFF' : 'Sound: ON';
    });
    this.el.btnEndNext.addEventListener('click', () => this.h.nextMission());
    this.el.btnEndRetry.addEventListener('click', () => this.h.retryMission());
  }

  showStart(hasSave) {
    this.el.start.classList.remove('hidden');
    this.el.pause.classList.add('hidden');
    this.el.end.classList.add('hidden');
    this.el.btnContinue.classList.toggle('hidden', !hasSave);
  }

  hideStart() {
    this.el.start.classList.add('hidden');
  }

  showPause() {
    this.el.pause.classList.remove('hidden');
  }

  hidePause() {
    this.el.pause.classList.add('hidden');
  }

  /** Mission complete / failed: title, text, and the right buttons. */
  showEnd({ title, text, nextLabel, showNext, showRetry }) {
    this.el.endTitle.textContent = title;
    this.el.endText.textContent = text;
    this.el.btnEndNext.textContent = nextLabel;
    this.el.btnEndNext.classList.toggle('hidden', !showNext);
    this.el.btnEndRetry.classList.toggle('hidden', !showRetry);
    this.el.end.classList.remove('hidden');
  }

  hideEnd() {
    this.el.end.classList.add('hidden');
  }
}
