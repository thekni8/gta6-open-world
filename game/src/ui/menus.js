// Menus: start screen, pause, mission complete / fail, wasted / busted,
// story complete, and the full-map overlay. DOM overlays; main.js wires
// each button to the real action.
export function createMenus(callbacks) {
  const $ = (id) => document.getElementById(id);
  const screens = {
    start: $('screen-start'),
    pause: $('screen-pause'),
    complete: $('screen-complete'),
    fail: $('screen-fail'),
    end: $('screen-end'),
    map: $('screen-map'),
  };
  let visible = null;

  function show(name) {
    for (const k of Object.keys(screens)) {
      screens[k].style.display = k === name ? 'flex' : 'none';
    }
    visible = name;
  }
  function hideAll() {
    for (const k of Object.keys(screens)) screens[k].style.display = 'none';
    visible = null;
  }

  $('btn-new').addEventListener('click', () => callbacks.newGame());
  $('btn-continue').addEventListener('click', () => callbacks.continueGame());
  $('btn-freeroam').addEventListener('click', () => callbacks.freeRoam());
  $('btn-resume').addEventListener('click', () => callbacks.resume());
  $('btn-restart-mission').addEventListener('click', () => callbacks.restartMission());
  $('btn-save-quit').addEventListener('click', () => callbacks.saveQuit());
  $('btn-complete-next').addEventListener('click', () => callbacks.nextMission());
  $('btn-fail-retry').addEventListener('click', () => callbacks.retryMission());
  $('btn-fail-roam').addEventListener('click', () => callbacks.freeRoamFromFail());
  $('btn-end-roam').addEventListener('click', () => callbacks.freeRoam());
  $('btn-map-close').addEventListener('click', () => callbacks.closeMap());

  return {
    get visible() { return visible; },
    showStart(hasSave, cash, mission) {
      $('btn-continue').style.display = hasSave ? 'block' : 'none';
      $('save-line').textContent = hasSave
        ? `Continue — $${cash.toLocaleString('en-US')} · Mission ${mission} of 5`
        : 'No save yet — start the story.';
      show('start');
    },
    showPause(missionTitle) {
      $('pause-mission').textContent = missionTitle ? `Current mission: ${missionTitle}` : 'Free roam';
      show('pause');
    },
    showComplete(def, cash) {
      $('complete-title').textContent = `Mission complete: ${def.title}`;
      $('complete-reward').textContent = `+$${def.reward.toLocaleString('en-US')}`;
      $('complete-cash').textContent = `Total cash: $${cash.toLocaleString('en-US')}`;
      $('complete-outro').textContent = def.outro;
      $('btn-complete-next').textContent = def.id >= 5 ? 'Finish the story' : 'Next mission';
      show('complete');
    },
    showFail(def, reason) {
      $('fail-title').textContent = `${def.title} — failed`;
      $('fail-reason').textContent = reason;
      show('fail');
    },
    showWasted(kind) {
      $('fail-title').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
      $('fail-reason').textContent = kind === 'busted'
        ? 'The Meridian Bay PD caught up with you.'
        : 'Kai Mercer went down. The city moves on — but the story doesn\'t have to end here.';
      show('fail');
    },
    showEnd(cash) {
      $('end-cash').textContent = `Final cash: $${cash.toLocaleString('en-US')}`;
      show('end');
    },
    showMap() { show('map'); },
    hideAll,
  };
}
