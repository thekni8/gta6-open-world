/* Mission state machine: start / step advance / timer / fail /
   complete / rewards. Owns the objective beacon and the mission HUD. */
(function () {
  let rt = null; // runtime: {def, index, step, timer, killsNeeded, killsGot, choice}

  function currentDef() {
    return MB.Story.missions[MB.S.missionIndex] || null;
  }

  function objectivePos() {
    if (!rt) return null;
    const step = rt.def.steps[rt.step];
    if (!step) return null;
    if (step.type === 'enterCar' || step.type === 'stealCar') {
      const car = MB.W.missionCars[step.car];
      return car ? { x: car.pos.x, z: car.pos.z } : null;
    }
    if (step.type === 'reach') return { x: step.x, z: step.z };
    if (step.type === 'choose') return null; // two markers; minimap draws both
    if (step.type === 'eliminate') {
      const alive = MB.W.enemies.filter(function (e) { return !e.dead; });
      return alive.length ? { x: alive[0].pos.x, z: alive[0].pos.z } : null;
    }
    return null; // evade: no marker
  }

  function objectiveText() {
    if (!rt) return MB.S.freeRoam ? 'Free roam — explore Meridian Bay' : '';
    const step = rt.def.steps[rt.step];
    if (!step) return '';
    if (step.type === 'eliminate') return step.text + ' (' + rt.killsGot + '/' + rt.killsNeeded + ')';
    return step.text;
  }

  function spawnMissionCars() {
    clearMissionCars();
    const P = MB.Story.places;
    const delivery = MB.Cars.createCar(P.deliveryCar.x, P.deliveryCar.z, Math.PI, { color: 0x2c6fd3, mission: 'delivery' });
    delivery.parked = true;
    MB.W.roadCars.push(delivery);
    MB.W.missionCars.delivery = delivery;
    const target = MB.Cars.createCar(P.targetCar.x, P.targetCar.z, Math.PI / 2, { color: 0xf2c14e, mission: 'target' });
    target.parked = true;
    MB.W.roadCars.push(target);
    MB.W.missionCars.target = target;
  }

  function clearMissionCars() {
    ['delivery', 'target'].forEach(function (k) {
      const c = MB.W.missionCars[k];
      if (c) {
        if (MB.W.currentCar === c) MB.Cars.exitCar();
        MB.Cars.removeCar(c);
      }
      delete MB.W.missionCars[k];
    });
  }

  function startMission(index) {
    MB.S.missionIndex = index;
    const def = MB.Story.missions[index];
    if (!def) { // story complete
      rt = null;
      MB.S.freeRoam = true;
      MB.City.setBeacon(0, 0, false);
      return;
    }
    MB.Weapons.clearEnemies();
    spawnMissionCars();
    rt = { def: def, index: index, step: 0, timer: def.time, killsNeeded: 0, killsGot: 0, choice: null };
    MB.S.mission = rt;
    MB.S.freeRoam = false;
    MB.S.dead = false;
    MB.S.health = MB.CFG.playerMaxHealth;
    if (def.startWanted) MB.Wanted.setWanted(def.startWanted);
    MB.HUD.showIntro(def);
    MB.Sound.pickup();
    updateBeacon();
  }

  function restartMission() {
    if (rt) startMission(rt.index);
    else if (MB.S.missionIndex < MB.Story.missions.length) startMission(MB.S.missionIndex);
  }

  function updateBeacon() {
    const pos = objectivePos();
    if (pos) MB.City.setBeacon(pos.x, pos.z, true);
    else MB.City.setBeacon(0, 0, false);
  }

  function advanceStep() {
    rt.step++;
    rt.killsGot = 0;
    const step = rt.def.steps[rt.step];
    if (!step) { completeMission(); return; }
    if (step.type === 'eliminate') {
      rt.killsNeeded = step.count;
      spawnGunmen(step);
    }
    MB.Sound.pickup();
    updateBeacon();
  }

  function spawnGunmen(step) {
    MB.Weapons.clearEnemies();
    const P = MB.Story.places;
    let spots = [];
    if (step.spawn === 'port') spots = P.portSpawns;
    else if (step.spawn === 'choice') {
      const base = rt.choice === 'kings' ? P.vesperClub : P.kingsHQ;
      // Rivals ambush at the chosen HQ: spawn around the player's side door.
      const cx = rt.choice === 'kings' ? P.kingsHQ.x : P.vesperClub.x;
      const cz = rt.choice === 'kings' ? P.kingsHQ.z : P.vesperClub.z;
      spots = [
        { x: cx - 14, z: cz - 6 }, { x: cx + 12, z: cz + 8 },
        { x: cx - 6, z: cz + 14 }, { x: cx + 16, z: cz - 10 },
      ];
    }
    for (let i = 0; i < step.count && i < spots.length; i++) {
      MB.Weapons.spawnEnemy(spots[i].x, spots[i].z);
    }
    MB.HUD.toast(step.count + ' gunmen — take them down!');
  }

  function completeMission() {
    const def = rt.def;
    const reward = def.reward;
    MB.S.cash += reward;
    MB.S.missionIndex = rt.index + 1;
    MB.S.mission = null;
    rt = null;
    MB.City.setBeacon(0, 0, false);
    MB.Wanted.setWanted(0);
    MB.Sound.missionWin();
    MB.Storage.save();
    MB.Menus.showMissionEnd(true, def.name + ' complete.', def.outro, '+$' + reward);
  }

  function failMission(reason) {
    const def = rt ? rt.def : null;
    MB.S.mission = null;
    rt = null;
    MB.City.setBeacon(0, 0, false);
    MB.Wanted.setWanted(0);
    MB.Weapons.clearEnemies();
    MB.Sound.missionFail();
    MB.Menus.showMissionEnd(false, 'Mission failed — ' + reason, def ? def.intro : '', '');
  }

  function update(dt) {
    if (!rt || MB.S.mode !== 'playing') return;
    rt.timer -= dt;
    if (rt.timer <= 0) { failMission('time ran out'); return; }
    const step = rt.def.steps[rt.step];
    if (!step) return;
    const p = MB.W.player;
    if (!p) return;
    if (step.type === 'enterCar' || step.type === 'stealCar') {
      const car = MB.W.missionCars[step.car];
      if (car && MB.S.inCar && MB.W.currentCar === car) {
        if (step.type === 'stealCar') {
          MB.Wanted.addCrime('steal');
          MB.S.carsStolen++;
          MB.HUD.toast('Stolen! The cops noticed.');
        }
        advanceStep();
      }
    } else if (step.type === 'reach') {
      const d = MB.Util.dist2d(p.pos.x, p.pos.z, step.x, step.z);
      if (d < step.radius && (!step.inCar || MB.S.inCar)) advanceStep();
    } else if (step.type === 'evade') {
      if (MB.S.wanted === 0) advanceStep();
    } else if (step.type === 'choose') {
      for (let i = 0; i < step.options.length; i++) {
        const o = step.options[i];
        if (MB.Util.dist2d(p.pos.x, p.pos.z, o.x, o.z) < 10) {
          rt.choice = o.side;
          MB.HUD.toast(o.side === 'kings' ? 'You ride with the Harbor Kings.' : 'You ride with the Vesper Syndicate.');
          advanceStep();
          break;
        }
      }
    } else if (step.type === 'eliminate') {
      if (rt.killsGot >= rt.killsNeeded) advanceStep();
    }
  }

  function onEnemyKilled() {
    if (rt) rt.killsGot++;
  }
  function onPlayerDeath() {
    if (rt) failMission('Kai went down');
    else {
      MB.S.health = MB.CFG.playerMaxHealth;
      MB.S.dead = false;
      const P = MB.Story.places;
      MB.W.player.pos.set(P.spawn.x, 0, P.spawn.z);
      MB.Wanted.setWanted(0);
      MB.HUD.toast('You wake up at the hideout. The city waits.');
    }
  }
  function onWantedLost() { /* evade steps poll wanted directly */ }

  MB.Missions = {
    startMission: startMission,
    restartMission: restartMission,
    update: update,
    currentDef: currentDef,
    objectivePos: objectivePos,
    objectiveText: objectiveText,
    onEnemyKilled: onEnemyKilled,
    onPlayerDeath: onPlayerDeath,
    onWantedLost: onWantedLost,
    runtime: function () { return rt; },
    setRuntime: function (r) { rt = r; MB.S.mission = r; },
    spawnMissionCars: spawnMissionCars,
    clearMissionCars: clearMissionCars,
    updateBeacon: updateBeacon,
  };
})();
