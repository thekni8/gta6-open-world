// Menus — start screen (New Game / Continue / Controls), pause, mission
// complete/fail and game over. Plain DOM overlays the game canvas hides or shows.
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createMenus() {
  return {
    title: document.getElementById('menu-title'),
    pause: document.getElementById('menu-pause'),
    over: document.getElementById('menu-over'),
    help: document.getElementById('menu-help'),
    titleButtons: document.getElementById('title-buttons'),
    continueBtn: document.getElementById('btn-continue'),
    newBtn: document.getElementById('btn-new'),
    helpBtn: document.getElementById('btn-help'),
    helpClose: document.getElementById('btn-help-close'),
    resumeBtn: document.getElementById('btn-resume'),
    quitBtn: document.getElementById('btn-quit'),
    retryBtn: document.getElementById('btn-retry'),
    overTitle: document.getElementById('over-title'),
    overText: document.getElementById('over-text'),
    pauseCash: document.getElementById('pause-cash'),
  };
}

export function showScreen(menus, screen, g) {
  menus.title.style.display = screen === SCREEN_TITLE ? 'flex' : 'none';
  menus.pause.style.display = screen === SCREEN_PAUSED ? 'flex' : 'none';
  menus.over.style.display = screen === SCREEN_OVER ? 'flex' : 'none';
  menus.help.style.display = 'none';
  if (screen === SCREEN_TITLE) {
    menus.continueBtn.style.display = g && g.hasSave ? 'block' : 'none';
  }
  if (screen === SCREEN_PAUSED && g) {
    menus.pauseCash.textContent = `Cash: $${g.player.cash.toLocaleString('en-US')} · Missions complete: ${g.mission.completed.length}/5`;
  }
}

export function showGameOver(menus, title, text) {
  menus.overTitle.textContent = title;
  menus.overText.textContent = text;
  menus.title.style.display = 'none';
  menus.pause.style.display = 'none';
  menus.over.style.display = 'flex';
}

export function showHelp(menus) {
  menus.help.style.display = 'flex';
}

export function hideHelp(menus) {
  menus.help.style.display = 'none';
}
