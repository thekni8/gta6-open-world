/* Menus: start screen, pause, mission-complete/fail, big-map overlay.
   Wires the buttons to the game state machine in main.js. */
(function () {
  let els = {};

  function init() {
    ['start-screen', 'pause-screen', 'mission-screen', 'bigmap', 'btn-new', 'btn-continue',
     'btn-freeroam', 'btn-controls', 'controls-box', 'continue-num', 'btn-resume',
     'btn-restart-mission', 'btn-quit-menu', 'mission-end-title', 'mission-end-text',
     'mission-end-reward', 'btn-mission-next', 'btn-mission-retry'].forEach(function (id) {
      els[id] = document.getElementById(id);
    });
    const save = MB.Storage.load();
    if (save && save.missionIndex > 0 && save.missionIndex < MB.Story.missions.length) {
      els['continue-num'].textContent = save.missionIndex + 1;
    } else {
      els['btn-continue'].style.display = 'none';
    }
    els['btn-new'].addEventListener('click', function () {
      MB.Sound.unlock(); MB.Sound.click();
      MB.Storage.clear();
      MB.Main.newGame();
    });
    els['btn-continue'].addEventListener('click', function () {
      MB.Sound.unlock(); MB.Sound.click();
      MB.Main.continueGame();
    });
    els['btn-freeroam'].addEventListener('click', function () {
      MB.Sound.unlock(); MB.Sound.click();
      MB.Main.freeRoam();
    });
    els['btn-controls'].addEventListener('click', function () {
      MB.Sound.click();
      els['controls-box'].classList.toggle('hidden');
    });
    els['btn-resume'].addEventListener('click', function () { MB.Sound.click(); MB.Main.resume(); });
    els['btn-restart-mission'].addEventListener('click', function () {
      MB.Sound.click();
      MB.Main.resume();
      MB.Missions.restartMission();
    });
    els['btn-quit-menu'].addEventListener('click', function () {
      MB.Sound.click();
      MB.Main.quitToMenu();
    });
    els['btn-mission-next'].addEventListener('click', function () {
      MB.Sound.click();
      hideMissionEnd();
      MB.Main.afterMissionEnd();
    });
    els['btn-mission-retry'].addEventListener('click', function () {
      MB.Sound.click();
      hideMissionEnd();
      MB.Main.resume();
      MB.Missions.restartMission();
    });
  }

  function showStart() {
    els['start-screen'].classList.remove('hidden');
    els['pause-screen'].classList.add('hidden');
    els['mission-screen'].classList.add('hidden');
  }
  function hideStart() { els['start-screen'].classList.add('hidden'); }
  function showPause() { els['pause-screen'].classList.remove('hidden'); }
  function hidePause() { els['pause-screen'].classList.add('hidden'); }
  function toggleBigMap() {
    const open = els['bigmap'].classList.toggle('hidden');
    return !open;
  }
  function hideBigMap() { els['bigmap'].classList.add('hidden'); }

  function showMissionEnd(won, title, text, reward) {
    els['mission-end-title'].textContent = won ? 'MISSION COMPLETE' : 'MISSION FAILED';
    els['mission-end-title'].style.color = won ? '#7dff9a' : '#ff7a6e';
    els['mission-end-text'].textContent = title + (text ? ' ' + text : '');
    els['mission-end-reward'].textContent = reward || '';
    els['btn-mission-next'].textContent = won ? 'CONTINUE' : 'BACK TO THE CITY';
    els['btn-mission-retry'].classList.toggle('hidden', won);
    els['mission-screen'].classList.remove('hidden');
    MB.S.mode = 'missionEnd';
  }
  function hideMissionEnd() { els['mission-screen'].classList.add('hidden'); }

  MB.Menus = {
    init: init,
    showStart: showStart, hideStart: hideStart,
    showPause: showPause, hidePause: hidePause,
    toggleBigMap: toggleBigMap, hideBigMap: hideBigMap,
    showMissionEnd: showMissionEnd, hideMissionEnd: hideMissionEnd,
  };
})();
